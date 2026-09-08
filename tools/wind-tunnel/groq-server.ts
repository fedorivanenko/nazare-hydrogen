import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {cp, mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const APP_DIR = process.env.WIND_TUNNEL_APP_DIR ?? '/app';
const ROOT_DIR = process.env.WIND_TUNNEL_ROOT ?? '/workspace';
const REPO_DIR = process.env.WIND_TUNNEL_REPO_DIR ?? path.join(ROOT_DIR, 'nazare-hydrogen');
const RESULTS_DIR = process.env.WIND_TUNNEL_RESULTS_DIR ?? path.join(ROOT_DIR, 'results');
const TOKEN = process.env.WIND_TUNNEL_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
const VERCEL_AI_GATEWAY_BASE_URL = process.env.VERCEL_AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1';
type LlmProvider = 'groq' | 'openrouter' | 'vercel';
const requestedProvider = process.env.LLM_PROVIDER;
if (requestedProvider && requestedProvider !== 'groq' && requestedProvider !== 'openrouter' && requestedProvider !== 'vercel') {
  throw new Error("Unsupported LLM_PROVIDER: " + requestedProvider);
}
const PROVIDER: LlmProvider = (requestedProvider as LlmProvider | undefined)
  ?? (AI_GATEWAY_API_KEY ? 'vercel' : OPENROUTER_API_KEY ? 'openrouter' : 'groq');
const DEFAULT_MODEL = PROVIDER === 'vercel'
  ? (process.env.VERCEL_MODEL ?? 'openai/gpt-oss-20b')
  : PROVIDER === 'openrouter'
    ? (process.env.OPENROUTER_MODEL ?? 'nvidia/nemotron-3-ultra-550b-a55b:free')
    : (process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b');
const MAX_BODY_BYTES = 1_000_000;
const MAX_OUTPUT_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_AGENT_STEPS = 24;
const DEFAULT_MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS ?? process.env.GROQ_MAX_TOKENS ?? 700);
const MAX_TOOL_CONTEXT_CHARS = 12_000;
const MAX_PROVIDER_RETRIES = 2;

let activeAgentRun: string | null = null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type ProcessResult = {
  command: string;
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

type AgentToolCall = {
  id: string;
  type: 'function';
  function: {name: string; arguments: string};
};

type AgentMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: AgentToolCall[];
  tool_call_id?: string;
};

function tail(text: string, max = 20_000) {
  return text.length <= max ? text : text.slice(-max);
}

function json(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(value));
}

function rpcResult(id: JsonRpcRequest['id'], result: unknown) {
  return {jsonrpc: '2.0', id: id ?? null, result};
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string, data?: unknown) {
  return {jsonrpc: '2.0', id: id ?? null, error: {code, message, ...(data === undefined ? {} : {data})}};
}

async function readJsonBody(req: IncomingMessage): Promise<JsonRpcRequest> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonRpcRequest;
}

async function runProcess(
  file: string,
  args: string[],
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProcessResult> {
  const started = Date.now();
  return await new Promise((resolve, reject) => {
    const child = spawn(file, args, {cwd, env});
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const append = (current: string, chunk: Buffer | string) => {
      if (Buffer.byteLength(current) >= MAX_OUTPUT_BYTES) return current;
      const next = current + chunk.toString();
      return Buffer.byteLength(next) > MAX_OUTPUT_BYTES ? next.slice(0, MAX_OUTPUT_BYTES) : next;
    };

    child.stdout?.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr?.on('data', chunk => { stderr = append(stderr, chunk); });
    child.on('error', reject);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
    }, Math.min(Math.max(timeoutMs, 1_000), MAX_TIMEOUT_MS));

    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        command: [file, ...args].join(' '),
        cwd,
        exitCode,
        signal,
        stdout,
        stderr,
        durationMs: Date.now() - started,
        timedOut,
      });
    });
  });
}

async function runShell(command: string, cwd = REPO_DIR, timeoutMs?: number) {
  // Normalize the agent shell through mise so Node tooling is always on PATH.
  // This keeps environment discovery out of benchmark measurements.
  return runProcess('/usr/local/bin/mise', ['exec', '--', '/bin/sh', '-lc', command], cwd, timeoutMs);
}

function safeRepoPath(relativePath: string) {
  const resolved = path.resolve(REPO_DIR, relativePath);
  const prefix = `${path.resolve(REPO_DIR)}${path.sep}`;
  if (resolved !== path.resolve(REPO_DIR) && !resolved.startsWith(prefix)) {
    throw new Error('Path escapes repository');
  }
  return resolved;
}

async function ensureWorkspace() {
  await mkdir(ROOT_DIR, {recursive: true});
  await mkdir(RESULTS_DIR, {recursive: true});
  const hasGit = existsSync(path.join(REPO_DIR, '.git'));
  const hasSource = existsSync(path.join(REPO_DIR, 'package.json')) && existsSync(path.join(REPO_DIR, 'app'));
  if (hasGit && hasSource) return;

  await rm(REPO_DIR, {recursive: true, force: true});
  await mkdir(REPO_DIR, {recursive: true});
  await cp(APP_DIR, REPO_DIR, {
    recursive: true,
    filter(source) {
      const relative = path.relative(APP_DIR, source);
      return relative !== 'benchmark-results' && !relative.startsWith(`benchmark-results${path.sep}`);
    },
  });

  const init = await runShell([
    'git init -q',
    'git config user.email wind-tunnel@nazare.local',
    'git config user.name "Nazare Wind Tunnel"',
    'git add -A',
    'git commit -qm "wind-tunnel baseline"',
    'git tag -f baseline',
  ].join(' && '));
  if (init.exitCode !== 0) throw new Error(`Failed to initialize workspace: ${init.stderr || init.stdout}`);
}

async function workspaceStatus() {
  const [head, statusResult] = await Promise.all([
    runShell('git rev-parse HEAD'),
    runShell('git status --short --branch'),
  ]);
  return {
    repoDir: REPO_DIR,
    head: head.stdout.trim(),
    status: statusResult.stdout,
    activeAgentRun,
    provider: PROVIDER,
    providerConfigured: Boolean(providerApiKey()),
    vercelConfigured: Boolean(AI_GATEWAY_API_KEY),
    openrouterConfigured: Boolean(OPENROUTER_API_KEY),
    groqConfigured: Boolean(GROQ_API_KEY),
    defaultModel: DEFAULT_MODEL,
  };
}

async function resetWorkspace(ref = 'baseline') {
  const verify = await runShell(`git rev-parse --verify ${JSON.stringify(ref)}^{commit}`);
  if (verify.exitCode !== 0) throw new Error(`Unknown git ref: ${ref}`);
  const reset = await runShell(`git reset --hard ${JSON.stringify(ref)} && git clean -fd`);
  if (reset.exitCode !== 0) throw new Error(reset.stderr || reset.stdout);
  return workspaceStatus();
}

async function gitDiff() {
  const result = await runShell('git diff --no-ext-diff --binary baseline -- .');
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

const agentTools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 source file from the repository. Use focused source inspection instead of dumping the entire repo.',
      parameters: {
        type: 'object',
        required: ['path'],
        properties: {
          path: {type: 'string', description: 'Repository-relative file path'},
          startLine: {type: 'number', minimum: 1, description: 'Optional 1-based first line'},
          endLine: {type: 'number', minimum: 1, description: 'Optional 1-based last line'},
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_patch',
      description: 'Apply a unified diff patch to repository files. Prefer this over rewriting whole files.',
      parameters: {
        type: 'object',
        required: ['patch'],
        properties: { patch: {type: 'string', description: 'Unified diff patch relative to repository root'} },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'exec',
      description: 'Run a shell command inside the repository. Use for search, git inspection, tests, lint, typecheck and build.',
      parameters: {
        type: 'object',
        required: ['command'],
        properties: {
          command: {type: 'string'},
          timeoutMs: {type: 'number', minimum: 1000, maximum: MAX_TIMEOUT_MS},
        },
        additionalProperties: false,
      },
    },
  },
] as const;

async function executeAgentTool(call: AgentToolCall) {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
  } catch {
    return {ok: false, error: 'Invalid JSON tool arguments'};
  }

  switch (call.function.name) {
    case 'read_file': {
      const relativePath = String(args.path ?? '');
      if (!relativePath) return {ok: false, error: 'path is required'};
      try {
        const content = await readFile(safeRepoPath(relativePath), 'utf8');
        const lines = content.split('\n');
        const startLine = Math.max(Number(args.startLine ?? 1), 1);
        const endLine = Math.max(Number(args.endLine ?? Math.min(lines.length, startLine + 199)), startLine);
        const excerpt = lines.slice(startLine - 1, endLine).join('\n');
        return {ok: true, path: relativePath, startLine, endLine: Math.min(endLine, lines.length), content: tail(excerpt, MAX_TOOL_CONTEXT_CHARS)};
      } catch (error) {
        return {ok: false, error: String(error)};
      }
    }
    case 'apply_patch': {
      const patchText = String(args.patch ?? '');
      if (!patchText.trim()) return {ok: false, error: 'patch is required'};
      const patchPath = path.join(ROOT_DIR, '.wind-tunnel-agent.patch');
      await writeFile(patchPath, patchText, 'utf8');
      const result = await runShell(`git apply --whitespace=nowarn ${JSON.stringify(patchPath)}`);
      await rm(patchPath, {force: true});
      return {ok: result.exitCode === 0, exitCode: result.exitCode, stdout: tail(result.stdout, 4000), stderr: tail(result.stderr, 4000)};
    }
    case 'exec': {
      const command = String(args.command ?? '').trim();
      if (!command) return {ok: false, error: 'command is required'};
      const result = await runShell(command, REPO_DIR, Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS));
      return {
        ok: result.exitCode === 0,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
        stdout: tail(result.stdout, MAX_TOOL_CONTEXT_CHARS),
        stderr: tail(result.stderr, 6_000),
      };
    }
    default:
      return {ok: false, error: `Unknown tool: ${call.function.name}`};
  }
}

function providerApiKey(provider: LlmProvider = PROVIDER) {
  if (provider === 'vercel') return AI_GATEWAY_API_KEY;
  return provider === 'openrouter' ? OPENROUTER_API_KEY : GROQ_API_KEY;
}

function providerBaseUrl(provider: LlmProvider = PROVIDER) {
  if (provider === 'vercel') return VERCEL_AI_GATEWAY_BASE_URL;
  return provider === 'openrouter' ? OPENROUTER_BASE_URL : GROQ_BASE_URL;
}

function providerKeyName(provider: LlmProvider = PROVIDER) {
  if (provider === 'vercel') return 'AI_GATEWAY_API_KEY';
  return provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'GROQ_API_KEY';
}

const OPENROUTER_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL ?? 'openrouter/free';
const GROQ_FALLBACK_MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b';
const EMPTY_MESSAGE_RETRIES = Math.max(0, Number(process.env.LLM_EMPTY_MESSAGE_RETRIES ?? 2));

type CompletionRoute = {provider: LlmProvider; model: string};

function completionRoutes(model: string, allowFallback: boolean): CompletionRoute[] {
  const routes: CompletionRoute[] = [{provider: PROVIDER, model}];
  if (!allowFallback) return routes;
  if (PROVIDER === 'vercel') {
    if (OPENROUTER_API_KEY) routes.push({provider: 'openrouter', model});
    if (GROQ_API_KEY && model === GROQ_FALLBACK_MODEL) routes.push({provider: 'groq', model});
    return routes;
  }
  if (PROVIDER !== 'openrouter') return routes;
  if (OPENROUTER_API_KEY && model !== OPENROUTER_FALLBACK_MODEL) {
    routes.push({provider: 'openrouter', model: OPENROUTER_FALLBACK_MODEL});
  }
  if (GROQ_API_KEY) routes.push({provider: 'groq', model: GROQ_FALLBACK_MODEL});
  return routes;
}

async function llmCompletion(provider: LlmProvider, model: string, messages: AgentMessage[], reasoningEffort: string, maxTokens: number) {
  const apiKey = providerApiKey(provider);
  if (!apiKey) {
    throw new Error(providerKeyName(provider) + ' is not configured');
  }

  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRIES; attempt++) {
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    };
    if (provider === 'groq') headers['Groq-Beta'] = 'inference-metrics';

    const body: Record<string, unknown> = {
      model,
      messages,
      tools: agentTools,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: maxTokens,
    };
    if (provider === 'groq') body.reasoning_effort = reasoningEffort;

    const response = await fetch(`${providerBaseUrl(provider)}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (response.ok) return JSON.parse(text) as any;
    if (response.status !== 429 || attempt === MAX_PROVIDER_RETRIES) {
      throw new Error(`${provider} ${response.status}: ${text}`);
    }
    const retryAfterHeader = response.headers.get('retry-after');
    const retryAfter = Number(retryAfterHeader ?? 2);
    await new Promise(resolve => setTimeout(resolve, Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 2) * 1000));
  }
  throw new Error(`${provider} retry loop exhausted`);
}

async function completionWithFallback(model: string, messages: AgentMessage[], reasoningEffort: string, maxTokens: number, allowFallback: boolean) {
  const attempts: Array<{provider: LlmProvider; model: string; attempt: number; error?: string}> = [];
  let lastError = 'No completion route succeeded';
  for (const route of completionRoutes(model, allowFallback)) {
    for (let attempt = 0; attempt <= EMPTY_MESSAGE_RETRIES; attempt++) {
      try {
        const response = await llmCompletion(route.provider, route.model, messages, reasoningEffort, maxTokens);
        if (response?.choices?.[0]?.message) {
          attempts.push({provider: route.provider, model: route.model, attempt});
          return {response, route, attempts};
        }
        lastError = `${route.provider}/${route.model} returned no assistant message`;
        attempts.push({provider: route.provider, model: route.model, attempt, error: lastError});
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        attempts.push({provider: route.provider, model: route.model, attempt, error: lastError});
        break;
      }
    }
  }
  throw new Error(`${lastError}; attempts=${JSON.stringify(attempts)}`);
}
async function runAgent(args: Record<string, unknown>) {
  if (activeAgentRun) throw new Error(`Agent run already active: ${activeAgentRun}`);
  if (!providerApiKey()) throw new Error(providerKeyName() + ' is not configured');

  const instruction = String(args.instruction ?? '').trim();
  if (!instruction) throw new Error('instruction is required');
  const model = typeof args.model === 'string' && args.model.trim() ? args.model.trim() : DEFAULT_MODEL;
  const allowFallback = args.allowFallback !== false;
  const reasoningEffort = typeof args.reasoningEffort === 'string' && args.reasoningEffort.trim()
    ? args.reasoningEffort.trim()
    : 'low';
  const maxSteps = Math.min(Math.max(Number(args.maxSteps ?? 12), 1), MAX_AGENT_STEPS);
  const maxTokens = Math.min(Math.max(Number(args.maxTokens ?? DEFAULT_MAX_TOKENS), 128), 2_000);
  const runId = randomUUID();
  activeAgentRun = runId;
  const runDir = path.join(RESULTS_DIR, runId);
  await mkdir(runDir, {recursive: true});

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const trace: unknown[] = [];
  const messages: AgentMessage[] = [
    {
      role: 'system',
      content: [
        'You are a coding agent operating inside one repository.',
        'Solve the user task by inspecting and modifying the repository with the provided tools.',
        'Prefer the smallest correct patch. Preserve existing architecture and constraints.',
        'Run relevant deterministic verification before finishing.',
        'Do not merely describe changes: modify the repository.',
        'When complete, give a concise final summary including verification results.',
      ].join(' '),
    },
    {role: 'user', content: instruction},
  ];

  let finalText = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let inferenceSeconds = 0;
  let steps = 0;

  try {
    for (steps = 1; steps <= maxSteps; steps++) {
      const completion = await completionWithFallback(model, messages, reasoningEffort, maxTokens, allowFallback);
      const {response, route, attempts} = completion;
      trace.push({step: steps, type: 'completion-route', provider: route.provider, model: route.model, attempts});
      const message = response?.choices?.[0]?.message;

      totalInputTokens += Number(response?.usage?.prompt_tokens ?? 0);
      totalOutputTokens += Number(response?.usage?.completion_tokens ?? 0);
      totalTokens += Number(response?.usage?.total_tokens ?? 0);
      inferenceSeconds += Number(response?.metadata?.total_time ?? 0);

      const assistant: AgentMessage = {
        role: 'assistant',
        content: typeof message.content === 'string' ? message.content : null,
        ...(Array.isArray(message.tool_calls) ? {tool_calls: message.tool_calls as AgentToolCall[]} : {}),
      };
      messages.push(assistant);
      trace.push({step: steps, type: 'assistant', content: assistant.content, toolCalls: assistant.tool_calls ?? [], usage: response?.usage ?? null, metrics: response?.metadata ?? null});

      const calls = assistant.tool_calls ?? [];
      if (calls.length === 0) {
        finalText = assistant.content ?? '';
        break;
      }

      for (const call of calls) {
        const toolStarted = Date.now();
        const result = await executeAgentTool(call);
        trace.push({step: steps, type: 'tool', id: call.id, name: call.function.name, arguments: call.function.arguments, durationMs: Date.now() - toolStarted, result});
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: tail(JSON.stringify(result), MAX_TOOL_CONTEXT_CHARS),
        });
        if (messages.length > 10) {
          const fixed = messages.slice(0, 2);
          const recent = messages.slice(-8);
          messages.splice(0, messages.length, ...fixed, ...recent);
        }
      }
    }

    const diff = await gitDiff();
    const status = await workspaceStatus();
    const metadata = {
      id: runId,
      provider: PROVIDER,
      model,
      reasoningEffort,
      allowFallback,
      maxTokens,
      maxSteps,
      instruction,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      steps,
      usage: {inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens},
      inferenceSeconds,
      toolCalls: trace.filter((event: any) => event?.type === 'tool').length,
      status,
      diffBytes: Buffer.byteLength(diff),
      completed: Boolean(finalText),
    };

    await Promise.all([
      writeFile(path.join(runDir, 'trace.json'), JSON.stringify(trace, null, 2)),
      writeFile(path.join(runDir, 'final.txt'), finalText),
      writeFile(path.join(runDir, 'diff.patch'), diff),
      writeFile(path.join(runDir, 'metadata.json'), JSON.stringify(metadata, null, 2)),
    ]);

    return {
      ...metadata,
      finalText: tail(finalText),
      diff: tail(diff, 120_000),
    };
  } catch (error) {
    const diff = await gitDiff().catch(() => '');
    const status = await workspaceStatus().catch(() => null);
    const errorText = error instanceof Error ? error.message : String(error);
    const metadata = {
      id: runId, provider: PROVIDER, model, reasoningEffort, allowFallback, maxTokens, maxSteps, instruction,
      startedAt, finishedAt: new Date().toISOString(), durationMs: Date.now() - started, steps,
      usage: {inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens},
      inferenceSeconds, toolCalls: trace.filter((event: any) => event?.type === 'tool').length,
      status, diffBytes: Buffer.byteLength(diff), completed: false, error: errorText,
    };
    await Promise.all([
      writeFile(path.join(runDir, 'trace.json'), JSON.stringify(trace, null, 2)),
      writeFile(path.join(runDir, 'final.txt'), ''),
      writeFile(path.join(runDir, 'diff.patch'), diff),
      writeFile(path.join(runDir, 'metadata.json'), JSON.stringify(metadata, null, 2)),
    ]);
    throw new Error(`Agent run ${runId} failed: ${errorText}`);
  } finally {
    activeAgentRun = null;
  }
}

async function getRun(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid run id');
  const runDir = path.join(RESULTS_DIR, id);
  const metadata = JSON.parse(await readFile(path.join(runDir, 'metadata.json'), 'utf8'));
  const [trace, finalText, diff] = await Promise.all([
    readFile(path.join(runDir, 'trace.json'), 'utf8'),
    readFile(path.join(runDir, 'final.txt'), 'utf8'),
    readFile(path.join(runDir, 'diff.patch'), 'utf8'),
  ]);
  return {
    metadata,
    traceTail: tail(trace, 100_000),
    finalText: tail(finalText),
    diff: tail(diff, 120_000),
  };
}

const tools = [
  {
    name: 'workspace_status',
    description: 'Inspect the persistent Nazare wind-tunnel worktree, model-provider configuration, and active agent state.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
  },
  {
    name: 'reset_workspace',
    description: 'Hard-reset the writable worktree to a local git ref. Defaults to the immutable baseline seeded from deployed main.',
    inputSchema: {
      type: 'object',
      properties: {ref: {type: 'string'}},
      additionalProperties: false,
    },
  },
  {
    name: 'exec',
    description: 'Run a shell command inside the writable Nazare worktree.',
    inputSchema: {
      type: 'object',
      required: ['command'],
      properties: {
        command: {type: 'string'},
        timeoutMs: {type: 'number', minimum: 1000, maximum: MAX_TIMEOUT_MS},
      },
      additionalProperties: false,
    },
  },
  {
    name: 'git_diff',
    description: 'Return the current worktree diff against the wind-tunnel baseline.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
  },
  {
    name: 'run_agent',
    description: 'Run the configured model-backed coding agent against the writable worktree. The agent can read, write, search and execute verification commands.',
    inputSchema: {
      type: 'object',
      required: ['instruction'],
      properties: {
        instruction: {type: 'string'},
        model: {type: 'string', description: 'Provider model id; defaults to OPENROUTER_MODEL/Nemotron free for OpenRouter or GROQ_MODEL for Groq'},
        allowFallback: {type: 'boolean', description: 'Retry empty completions, then fall back to OpenRouter free router and Groq; defaults to true'},
        reasoningEffort: {type: 'string', enum: ['low', 'medium', 'high']},
        maxSteps: {type: 'number', minimum: 1, maximum: MAX_AGENT_STEPS},
        maxTokens: {type: 'number', minimum: 128, maximum: 2000, description: 'Maximum completion tokens per model turn'},
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_run',
    description: 'Read a completed agent run including metadata, trace, final answer and patch.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {id: {type: 'string'}},
      additionalProperties: false,
    },
  },
] as const;

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'workspace_status':
      return workspaceStatus();
    case 'reset_workspace':
      return resetWorkspace(typeof args.ref === 'string' ? args.ref : 'baseline');
    case 'exec': {
      const command = String(args.command ?? '').trim();
      if (!command) throw new Error('command is required');
      return runShell(command, REPO_DIR, Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    }
    case 'git_diff':
      return {diff: await gitDiff()};
    case 'run_agent':
      return runAgent(args);
    case 'get_run':
      return getRun(String(args.id ?? ''));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function isAuthorized(req: IncomingMessage) {
  if (!TOKEN) return false;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

async function handleRpc(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) {
    json(res, TOKEN ? 401 : 503, {error: TOKEN ? 'unauthorized' : 'WIND_TUNNEL_TOKEN is not configured'});
    return;
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('allow', 'POST');
    res.end();
    return;
  }

  let body: JsonRpcRequest;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    json(res, 400, rpcError(null, -32700, 'Parse error', String(error)));
    return;
  }

  if (body.method === 'notifications/initialized') {
    res.statusCode = 202;
    res.end();
    return;
  }

  try {
    switch (body.method) {
      case 'initialize':
        json(res, 200, rpcResult(body.id, {
          protocolVersion: String(body.params?.protocolVersion ?? '2025-06-18'),
          capabilities: {tools: {listChanged: false}},
          serverInfo: {name: 'nazare-wind-tunnel', version: '0.2.0'},
          instructions: 'Operate the persistent Nazare benchmark worktree. Reset before controlled runs. run_agent uses the configured model provider with local function calling and records full traces and patches.',
        }));
        return;
      case 'ping':
        json(res, 200, rpcResult(body.id, {}));
        return;
      case 'tools/list':
        json(res, 200, rpcResult(body.id, {tools}));
        return;
      case 'tools/call': {
        const name = String(body.params?.name ?? '');
        const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
        const result = await callTool(name, args);
        json(res, 200, rpcResult(body.id, {
          content: [{type: 'text', text: JSON.stringify(result, null, 2)}],
          structuredContent: result,
          isError: false,
        }));
        return;
      }
      default:
        json(res, 200, rpcError(body.id, -32601, `Method not found: ${body.method}`));
    }
  } catch (error) {
    json(res, 200, rpcResult(body.id, {
      content: [{type: 'text', text: error instanceof Error ? error.message : String(error)}],
      isError: true,
    }));
  }
}

await ensureWorkspace();

createServer(async (req, res) => {
  if (req.url === '/health') {
    try {
      const repo = await stat(REPO_DIR);
      json(res, 200, {
        ok: repo.isDirectory(),
        repoDir: REPO_DIR,
        tokenConfigured: Boolean(TOKEN),
        provider: PROVIDER,
        providerConfigured: Boolean(providerApiKey()),
        openrouterConfigured: Boolean(OPENROUTER_API_KEY),
        groqConfigured: Boolean(GROQ_API_KEY),
        defaultModel: DEFAULT_MODEL,
      });
    } catch (error) {
      json(res, 500, {ok: false, error: String(error)});
    }
    return;
  }

  if (req.url === '/mcp') {
    await handleRpc(req, res);
    return;
  }

  json(res, 404, {error: 'not found'});
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Nazare wind tunnel MCP listening on :${PORT}`);
  console.log(`Workspace: ${REPO_DIR}`);
  console.log(`Provider: ${PROVIDER}; configured: ${Boolean(providerApiKey())}; model: ${DEFAULT_MODEL}`);
});
