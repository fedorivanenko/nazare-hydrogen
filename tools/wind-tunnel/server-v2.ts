import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {cp, mkdir, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {runPi} from './pi-adapter';

const PORT = Number(process.env.PORT ?? 3000);
const APP_DIR = process.env.WIND_TUNNEL_APP_DIR ?? '/app';
const ROOT_DIR = process.env.WIND_TUNNEL_ROOT ?? '/workspace';
const REPO_DIR = process.env.WIND_TUNNEL_REPO_DIR ?? path.join(ROOT_DIR, 'nazare-hydrogen');
const RESULTS_DIR = process.env.WIND_TUNNEL_RESULTS_DIR ?? path.join(ROOT_DIR, 'results');
const RUNS_DIR = process.env.WIND_TUNNEL_RUNS_DIR ?? path.join(ROOT_DIR, 'runs');
const TOKEN = process.env.WIND_TUNNEL_TOKEN;
const MAX_BODY_BYTES = 1_000_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;

let activeExperiment: string | null = null;

type Arm = 'raw' | 'nazare';
type JsonRpcRequest = {jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown>};
type ProcessResult = {command: string; cwd: string; exitCode: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; durationMs: number; timedOut: boolean};
type Experiment = {
  id: string;
  taskFile: string;
  baseline?: string;
  agent: {provider?: string; model?: string; thinking?: string; timeoutMs?: number};
  nazare: {capabilityId: string; requestedChange: string};
  verification: string[];
};

type VerificationResult = {command: string; exitCode: number | null; durationMs: number; passed: boolean; stdoutTail: string; stderrTail: string};

function tail(text: string, max = 20_000) { return text.length <= max ? text : text.slice(-max); }
function json(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); }
function rpcResult(id: JsonRpcRequest['id'], result: unknown) { return {jsonrpc: '2.0', id: id ?? null, result}; }
function rpcError(id: JsonRpcRequest['id'], code: number, message: string, data?: unknown) { return {jsonrpc: '2.0', id: id ?? null, error: {code, message, ...(data === undefined ? {} : {data})}}; }

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

async function runProcess(file: string, args: string[], cwd: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ProcessResult> {
  const started = Date.now();
  return await new Promise((resolve, reject) => {
    const child = spawn(file, args, {cwd, env: process.env});
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const append = (current: string, chunk: Buffer | string) => (current + chunk.toString()).slice(-20_000_000);
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
      resolve({command: [file, ...args].join(' '), cwd, exitCode, signal, stdout, stderr, durationMs: Date.now() - started, timedOut});
    });
  });
}

async function runShell(command: string, cwd = REPO_DIR, timeoutMs?: number) {
  return runProcess('/bin/sh', ['-lc', command], cwd, timeoutMs);
}

async function ensureWorkspace() {
  await mkdir(ROOT_DIR, {recursive: true});
  await mkdir(RESULTS_DIR, {recursive: true});
  await mkdir(RUNS_DIR, {recursive: true});
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
  if (init.exitCode !== 0) throw new Error(`Failed to initialize workspace: ${init.stderr || init.stdout}`);
}

async function workspaceStatus() {
  const [head, statusResult, baseline] = await Promise.all([
    runShell('git rev-parse HEAD'),
    runShell('git status --short --branch'),
    runShell('git rev-parse baseline'),
  ]);
  return {repoDir: REPO_DIR, runsDir: RUNS_DIR, resultsDir: RESULTS_DIR, head: head.stdout.trim(), baseline: baseline.stdout.trim(), status: statusResult.stdout, activeExperiment};
}

async function loadExperiment(relativePath: string): Promise<Experiment> {
  const resolved = path.resolve(REPO_DIR, relativePath);
  if (!resolved.startsWith(`${path.resolve(REPO_DIR)}${path.sep}`)) throw new Error('Experiment path must stay inside repository');
  const experiment = JSON.parse(await readFile(resolved, 'utf8')) as Experiment;
  if (!experiment.id || !experiment.taskFile || !Array.isArray(experiment.verification)) throw new Error('Invalid experiment definition');
  return experiment;
}

async function createIsolatedWorktree(runId: string, arm: Arm, baseline: string) {
  const worktree = path.join(RUNS_DIR, `${runId}-${arm}`);
  await rm(worktree, {recursive: true, force: true});
  const add = await runShell(`git worktree add --detach ${JSON.stringify(worktree)} ${JSON.stringify(baseline)}`, REPO_DIR);
  if (add.exitCode !== 0) throw new Error(add.stderr || add.stdout);

  const sharedNodeModules = path.join(REPO_DIR, 'node_modules');
  const armNodeModules = path.join(worktree, 'node_modules');
  if (existsSync(sharedNodeModules) && !existsSync(armNodeModules)) {
    await symlink(sharedNodeModules, armNodeModules, 'dir');
  }
  return worktree;
}

async function removeWorktree(worktree: string) {
  await runShell(`git worktree remove --force ${JSON.stringify(worktree)}`, REPO_DIR, 60_000);
  await rm(worktree, {recursive: true, force: true});
}

function buildPrompt(task: string, arm: Arm) {
  const common = [
    'Complete the requested repository change.',
    'Do not weaken tests, lint rules, policies, evidence contracts, or architectural constraints.',
    'Use the repository tools available to you and leave the worktree with the implementation applied.',
    '',
    'TASK:',
    task.trim(),
  ].join('\n');
  if (arm === 'raw') return common;
  return [
    common,
    '',
    'NAZARE COMPILED CONTEXT:',
    'A task projection is available at .nazare/task.json.',
    'Treat it as the authoritative starting boundary for source files, dependencies, policies, bindings, evidence, and invariants.',
    'Stay inside that projected neighborhood unless source evidence or verification requires expansion.',
  ].join('\n');
}

async function compileNazareTask(worktree: string, experiment: Experiment) {
  await mkdir(path.join(worktree, '.nazare'), {recursive: true});
  const command = `npm run nazare:registry -- compile ${JSON.stringify(experiment.nazare.capabilityId)} ${JSON.stringify(experiment.nazare.requestedChange)}`;
  const result = await runShell(command, worktree, 60_000);
  if (result.exitCode !== 0) throw new Error(`Nazare compile failed: ${result.stderr || result.stdout}`);
  const parsed = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  const target = path.join(worktree, '.nazare', 'task.json');
  await writeFile(target, JSON.stringify(parsed, null, 2));
  return {command, durationMs: result.durationMs, bytes: Buffer.byteLength(JSON.stringify(parsed)), projection: parsed};
}

async function verify(worktree: string, commands: string[]): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const command of commands) {
    const result = await runShell(command, worktree, MAX_TIMEOUT_MS);
    results.push({command, exitCode: result.exitCode, durationMs: result.durationMs, passed: result.exitCode === 0 && !result.timedOut, stdoutTail: tail(result.stdout), stderrTail: tail(result.stderr)});
  }
  return results;
}

async function diffAgainst(worktree: string, baseline: string) {
  const result = await runShell(`git diff --no-ext-diff --binary ${JSON.stringify(baseline)} -- . ':(exclude).nazare/task.json'`, worktree);
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

async function runArm(runId: string, arm: Arm, experiment: Experiment, baseline: string, task: string) {
  const worktree = await createIsolatedWorktree(runId, arm, baseline);
  const resultDir = path.join(RESULTS_DIR, runId, arm);
  await mkdir(resultDir, {recursive: true});
  const startedAt = new Date().toISOString();
  try {
    const compiled = arm === 'nazare' ? await compileNazareTask(worktree, experiment) : null;
    const prompt = buildPrompt(task, arm);
    const agent = await runPi({
      cwd: worktree,
      prompt,
      provider: experiment.agent.provider,
      model: experiment.agent.model,
      thinking: experiment.agent.thinking,
      timeoutMs: Number(experiment.agent.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const patch = await diffAgainst(worktree, baseline);
    const verification = await verify(worktree, experiment.verification);
    const passed = agent.exitCode === 0 && !agent.timedOut && verification.every(item => item.passed);
    const metadata = {
      runId,
      experimentId: experiment.id,
      arm,
      startedAt,
      finishedAt: new Date().toISOString(),
      baseline,
      agent: {provider: experiment.agent.provider ?? null, model: experiment.agent.model ?? null, thinking: experiment.agent.thinking ?? null, exitCode: agent.exitCode, durationMs: agent.durationMs, timedOut: agent.timedOut},
      compiled: compiled ? {durationMs: compiled.durationMs, bytes: compiled.bytes} : null,
      patchBytes: Buffer.byteLength(patch),
      verification,
      passed,
    };
    await Promise.all([
      writeFile(path.join(resultDir, 'metadata.json'), JSON.stringify(metadata, null, 2)),
      writeFile(path.join(resultDir, 'agent.jsonl'), agent.stdout),
      writeFile(path.join(resultDir, 'agent.stderr.log'), agent.stderr),
      writeFile(path.join(resultDir, 'patch.diff'), patch),
      writeFile(path.join(resultDir, 'prompt.txt'), prompt),
      ...(compiled ? [writeFile(path.join(resultDir, 'compiled-task.json'), JSON.stringify(compiled.projection, null, 2))] : []),
    ]);
    return {...metadata, stdoutTail: tail(agent.stdout), stderrTail: tail(agent.stderr), patch: tail(patch, 100_000)};
  } finally {
    await removeWorktree(worktree);
  }
}

async function runExperiment(args: Record<string, unknown>) {
  if (activeExperiment) throw new Error(`Experiment already active: ${activeExperiment}`);
  const experimentPath = String(args.experiment ?? 'experiments/luna-operability/experiment-02-marketing-consent.json');
  const requestedArms = Array.isArray(args.arms) ? args.arms.map(String) : ['raw', 'nazare'];
  const arms = requestedArms.filter((arm): arm is Arm => arm === 'raw' || arm === 'nazare');
  if (!arms.length) throw new Error('arms must contain raw and/or nazare');

  const experiment = await loadExperiment(experimentPath);
  const taskPath = path.resolve(REPO_DIR, experiment.taskFile);
  const task = await readFile(taskPath, 'utf8');
  const baselineRef = experiment.baseline ?? 'baseline';
  const baselineResult = await runShell(`git rev-parse ${JSON.stringify(baselineRef)}`);
  if (baselineResult.exitCode !== 0) throw new Error(`Unknown baseline: ${baselineRef}`);
  const baseline = baselineResult.stdout.trim();
  const runId = randomUUID();
  activeExperiment = runId;
  await mkdir(path.join(RESULTS_DIR, runId), {recursive: true});
  try {
    const armResults: Record<string, unknown> = {};
    for (const arm of arms) armResults[arm] = await runArm(runId, arm, experiment, baseline, task);
    const summary = {id: runId, experimentId: experiment.id, baseline, arms: armResults};
    await writeFile(path.join(RESULTS_DIR, runId, 'summary.json'), JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    activeExperiment = null;
  }
}

async function getRun(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid run id');
  return JSON.parse(await readFile(path.join(RESULTS_DIR, id, 'summary.json'), 'utf8'));
}

async function compareRuns(ids: string[]) {
  const summaries = await Promise.all(ids.map(getRun));
  return summaries.map(summary => {
    const arms = summary.arms as Record<string, any>;
    return {
      id: summary.id,
      experimentId: summary.experimentId,
      raw: arms.raw ? {passed: arms.raw.passed, durationMs: arms.raw.agent.durationMs, patchBytes: arms.raw.patchBytes} : null,
      nazare: arms.nazare ? {passed: arms.nazare.passed, compileMs: arms.nazare.compiled?.durationMs ?? null, durationMs: arms.nazare.agent.durationMs, patchBytes: arms.nazare.patchBytes} : null,
    };
  });
}

const tools = [
  {name: 'workspace_status', description: 'Inspect the disposable Nazare wind-tunnel baseline and active experiment state.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'run_experiment', description: 'Run a declarative controlled experiment through the same Pi harness. By default runs raw and Nazare-compiled arms from isolated worktrees.', inputSchema: {type: 'object', properties: {experiment: {type: 'string'}, arms: {type: 'array', items: {type: 'string', enum: ['raw', 'nazare']}}}, additionalProperties: false}},
  {name: 'get_run', description: 'Read the summary for a completed controlled experiment.', inputSchema: {type: 'object', required: ['id'], properties: {id: {type: 'string'}}, additionalProperties: false}},
  {name: 'compare_runs', description: 'Compare compact success and cost metrics for completed experiment runs.', inputSchema: {type: 'object', required: ['ids'], properties: {ids: {type: 'array', items: {type: 'string'}, minItems: 1}}, additionalProperties: false}},
  {name: 'exec', description: 'Development-only shell access inside the immutable baseline workspace.', inputSchema: {type: 'object', required: ['command'], properties: {command: {type: 'string'}, timeoutMs: {type: 'number', minimum: 1000, maximum: MAX_TIMEOUT_MS}}, additionalProperties: false}},
] as const;

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'workspace_status': return workspaceStatus();
    case 'run_experiment': return runExperiment(args);
    case 'get_run': return getRun(String(args.id ?? ''));
    case 'compare_runs': return compareRuns(Array.isArray(args.ids) ? args.ids.map(String) : []);
    case 'exec': {
      const command = String(args.command ?? '').trim();
      if (!command) throw new Error('command is required');
      return runShell(command, REPO_DIR, Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function isAuthorized(req: IncomingMessage) { return Boolean(TOKEN) && req.headers.authorization === `Bearer ${TOKEN}`; }

async function handleRpc(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) { json(res, TOKEN ? 401 : 503, {error: TOKEN ? 'unauthorized' : 'WIND_TUNNEL_TOKEN is not configured'}); return; }
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('allow', 'POST'); res.end(); return; }
  let body: JsonRpcRequest;
  try { body = await readJsonBody(req); } catch (error) { json(res, 400, rpcError(null, -32700, 'Parse error', String(error))); return; }
  if (body.method === 'notifications/initialized') { res.statusCode = 202; res.end(); return; }
  try {
    switch (body.method) {
      case 'initialize':
        json(res, 200, rpcResult(body.id, {protocolVersion: String(body.params?.protocolVersion ?? '2025-06-18'), capabilities: {tools: {listChanged: false}}, serverInfo: {name: 'nazare-wind-tunnel', version: '0.2.0'}, instructions: 'Run controlled software-operability experiments. Pi owns the coding-agent loop; Nazare owns task compilation; the tunnel owns isolation, verification, and measurement.'}));
        return;
      case 'ping': json(res, 200, rpcResult(body.id, {})); return;
      case 'tools/list': json(res, 200, rpcResult(body.id, {tools})); return;
      case 'tools/call': {
        const result = await callTool(String(body.params?.name ?? ''), (body.params?.arguments ?? {}) as Record<string, unknown>);
        json(res, 200, rpcResult(body.id, {content: [{type: 'text', text: JSON.stringify(result, null, 2)}], structuredContent: result, isError: false}));
        return;
      }
      default: json(res, 200, rpcError(body.id, -32601, `Method not found: ${body.method}`));
    }
  } catch (error) {
    json(res, 200, rpcResult(body.id, {content: [{type: 'text', text: error instanceof Error ? error.message : String(error)}], isError: true}));
  }
}

await ensureWorkspace();

createServer(async (req, res) => {
  if (req.url === '/health') {
    try { const repo = await stat(REPO_DIR); json(res, 200, {ok: repo.isDirectory(), version: '0.2.0', harness: 'pi', repoDir: REPO_DIR, tokenConfigured: Boolean(TOKEN)}); }
    catch (error) { json(res, 500, {ok: false, error: String(error)}); }
    return;
  }
  if (req.url === '/mcp') { await handleRpc(req, res); return; }
  res.statusCode = 404; res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Nazare Wind Tunnel v2 listening on ${PORT}`);
});
