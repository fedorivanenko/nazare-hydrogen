import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const APP_DIR = process.env.WIND_TUNNEL_APP_DIR ?? '/app';
const ROOT_DIR = process.env.WIND_TUNNEL_ROOT ?? '/workspace';
const REPO_DIR = process.env.WIND_TUNNEL_REPO_DIR ?? path.join(ROOT_DIR, 'nazare-hydrogen');
const RESULTS_DIR = process.env.WIND_TUNNEL_RESULTS_DIR ?? path.join(ROOT_DIR, 'results');
const TOKEN = process.env.WIND_TUNNEL_TOKEN;
const MAX_BODY_BYTES = 1_000_000;
const MAX_OUTPUT_BYTES = 20_000_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;

let activeAgentRun: string | null = null;

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

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
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
      return Buffer.byteLength(next) > MAX_OUTPUT_BYTES
        ? next.slice(0, MAX_OUTPUT_BYTES)
        : next;
    };

    child.stdout?.on('data', chunk => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', chunk => {
      stderr = append(stderr, chunk);
    });
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
  return runProcess('/bin/sh', ['-lc', command], cwd, timeoutMs);
}

async function ensureWorkspace() {
  await mkdir(ROOT_DIR, {recursive: true});
  await mkdir(RESULTS_DIR, {recursive: true});

  if (existsSync(path.join(REPO_DIR, '.git'))) return;

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

  if (init.exitCode !== 0) {
    throw new Error(`Failed to initialize workspace: ${init.stderr || init.stdout}`);
  }
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

async function runAgent(args: Record<string, unknown>) {
  if (activeAgentRun) throw new Error(`Agent run already active: ${activeAgentRun}`);

  const instruction = String(args.instruction ?? '').trim();
  if (!instruction) throw new Error('instruction is required');
  const model = typeof args.model === 'string' && args.model.trim() ? args.model.trim() : undefined;
  const timeoutMs = Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const runId = randomUUID();
  activeAgentRun = runId;
  const runDir = path.join(RESULTS_DIR, runId);
  await mkdir(runDir, {recursive: true});

  const codexArgs = [
    '--yes',
    '@openai/codex',
    'exec',
    '--ephemeral',
    '--json',
    '--sandbox',
    'workspace-write',
    '--cd',
    REPO_DIR,
    '--config',
    'approval_policy="never"',
  ];
  if (model) codexArgs.push('--model', model);
  codexArgs.push(instruction);

  const startedAt = new Date().toISOString();
  try {
    const result = await runProcess('npx', codexArgs, REPO_DIR, timeoutMs);
    const diff = await gitDiff();
    const status = await workspaceStatus();
    const metadata = {
      id: runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      model: model ?? null,
      instruction,
      process: {...result, stdout: undefined, stderr: undefined},
      status,
      diffBytes: Buffer.byteLength(diff),
    };
    await Promise.all([
      writeFile(path.join(runDir, 'stdout.jsonl'), result.stdout),
      writeFile(path.join(runDir, 'stderr.log'), result.stderr),
      writeFile(path.join(runDir, 'diff.patch'), diff),
      writeFile(path.join(runDir, 'metadata.json'), JSON.stringify(metadata, null, 2)),
    ]);
    return {
      ...metadata,
      stdoutTail: tail(result.stdout),
      stderrTail: tail(result.stderr),
      diff: tail(diff, 100_000),
    };
  } finally {
    activeAgentRun = null;
  }
}

async function getRun(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid run id');
  const runDir = path.join(RESULTS_DIR, id);
  const metadata = JSON.parse(await readFile(path.join(runDir, 'metadata.json'), 'utf8'));
  const [stdout, stderr, diff] = await Promise.all([
    readFile(path.join(runDir, 'stdout.jsonl'), 'utf8'),
    readFile(path.join(runDir, 'stderr.log'), 'utf8'),
    readFile(path.join(runDir, 'diff.patch'), 'utf8'),
  ]);
  return {
    metadata,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
    diff: tail(diff, 100_000),
  };
}

const tools = [
  {
    name: 'workspace_status',
    description: 'Inspect the persistent Nazare wind-tunnel worktree and active agent state.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
  },
  {
    name: 'reset_workspace',
    description: 'Hard-reset the writable worktree to a local git ref. Defaults to the immutable baseline seeded from deployed main.',
    inputSchema: {
      type: 'object',
      properties: {ref: {type: 'string', description: 'Local git ref; defaults to baseline'}},
      additionalProperties: false,
    },
  },
  {
    name: 'exec',
    description: 'Run an arbitrary shell command inside the writable Nazare worktree.',
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
    description: 'Run a non-interactive Codex coding agent against the writable worktree. The agent may edit files and run commands.',
    inputSchema: {
      type: 'object',
      required: ['instruction'],
      properties: {
        instruction: {type: 'string'},
        model: {type: 'string', description: 'Optional explicit Codex model id'},
        timeoutMs: {type: 'number', minimum: 1000, maximum: MAX_TIMEOUT_MS},
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_run',
    description: 'Read a completed agent run, including metadata, output tails, and captured patch.',
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
          serverInfo: {name: 'nazare-wind-tunnel', version: '0.1.0'},
          instructions: 'Operate the persistent Nazare benchmark worktree. Reset before controlled runs and inspect diffs/results after agent execution.',
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
      json(res, 200, {ok: repo.isDirectory(), repoDir: REPO_DIR, tokenConfigured: Boolean(TOKEN)});
    } catch (error) {
      json(res, 500, {ok: false, error: String(error)});
    }
    return;
  }

  if (req.url === '/mcp') {
    await handleRpc(req, res);
    return;
  }

  res.statusCode = 404;
  res.end('not found');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Nazare wind tunnel MCP listening on :${PORT}`);
  console.log(`Workspace: ${REPO_DIR}`);
});
