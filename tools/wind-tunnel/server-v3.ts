import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {cp, mkdir, readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {
  createRunRecord,
  getExperiment,
  getRunArtifacts,
  getRunRecord,
  listExperiments,
  safeGetRun,
  type Arm,
} from './run-store';

const PORT = Number(process.env.PORT ?? 3000);
const APP_DIR = process.env.WIND_TUNNEL_APP_DIR ?? '/app';
const SOURCE_SHA = process.env.WIND_TUNNEL_SOURCE_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local';
const RAILWAY_SHA = process.env.RAILWAY_GIT_COMMIT_SHA ?? null;
const RESULTS_DIR = process.env.WIND_TUNNEL_RESULTS_DIR ?? '/workspace/results';
const RUNTIME_DIR = process.env.WIND_TUNNEL_RUNTIME_DIR ?? '/tmp/nazare-wind-tunnel';
const SOURCE_DIR = path.join(RUNTIME_DIR, 'controller-source');
const TOKEN = process.env.WIND_TUNNEL_TOKEN;
const MAX_BODY_BYTES = 1_000_000;
const DEFAULT_EXPERIMENT = 'experiments/luna-operability/experiment-02-marketing-consent.json';

let sourceSnapshotCommit = '';

type JsonRpcRequest = {jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown>};
type ProcessResult = {exitCode: number | null; stdout: string; stderr: string};

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

async function runShell(command: string, cwd: string): Promise<ProcessResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-lc', command], {cwd, env: process.env});
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', exitCode => resolve({exitCode, stdout, stderr}));
  });
}

async function createControllerSnapshot() {
  await rm(SOURCE_DIR, {recursive: true, force: true});
  await mkdir(SOURCE_DIR, {recursive: true});
  await mkdir(RESULTS_DIR, {recursive: true});
  await cp(APP_DIR, SOURCE_DIR, {
    recursive: true,
    filter(source) {
      const relative = path.relative(APP_DIR, source);
      if (!relative) return true;
      const first = relative.split(path.sep)[0];
      return !['node_modules', 'dist', '.git', 'benchmark-results'].includes(first);
    },
  });
  const init = await runShell([
    'git init -q',
    'git config user.email wind-tunnel@nazare.local',
    'git config user.name "Nazare Wind Tunnel"',
    'git add -A',
    `git commit -qm "deployed source ${SOURCE_SHA}"`,
  ].join(' && '), SOURCE_DIR);
  if (init.exitCode !== 0) throw new Error(`Failed to create controller source snapshot: ${init.stderr || init.stdout}`);
  const head = await runShell('git rev-parse HEAD', SOURCE_DIR);
  if (head.exitCode !== 0) throw new Error(head.stderr || head.stdout);
  sourceSnapshotCommit = head.stdout.trim();
}

async function activeRuns() {
  const active = [];
  let entries: string[] = [];
  try { entries = await readdir(RESULTS_DIR); } catch { return active; }
  for (const entry of entries) {
    if (!/^[0-9a-f-]{36}$/i.test(entry)) continue;
    try {
      const run = await getRunRecord(RESULTS_DIR, entry);
      if (!['completed', 'failed'].includes(run.status)) active.push({runId: run.id, status: run.status, elapsedMs: run.elapsedMs});
    } catch {
      // Ignore unrelated or partially removed directories.
    }
  }
  return active;
}

async function workspaceStatus() {
  const statusResult = await runShell('git status --short --branch', SOURCE_DIR);
  const experiments = await listExperiments(SOURCE_DIR);
  const defaultExperiment = experiments.find(item => item.name === DEFAULT_EXPERIMENT);
  const runs = await activeRuns();
  return {
    controller: 'server-v3',
    version: '0.4.0',
    sourceOfTruth: 'github-main-via-railway-image',
    sourceSha: SOURCE_SHA,
    railwaySha: RAILWAY_SHA,
    sourceSnapshotCommit,
    sourceDir: SOURCE_DIR,
    resultsDir: RESULTS_DIR,
    sourceStatus: statusResult.stdout,
    provider: defaultExperiment?.agent.provider ?? null,
    model: defaultExperiment?.agent.model ?? null,
    activeExperiment: runs[0]?.runId ?? null,
    activeRuns: runs,
  };
}

function parseArms(value: unknown): Arm[] {
  const requested = Array.isArray(value) ? value.map(String) : ['raw', 'nazare'];
  const arms = [...new Set(requested.filter((arm): arm is Arm => arm === 'raw' || arm === 'nazare'))];
  if (!arms.length) throw new Error('arms must contain raw and/or nazare');
  return arms;
}

async function startExperiment(args: Record<string, unknown>) {
  const experimentName = String(args.experiment ?? DEFAULT_EXPERIMENT);
  const arms = parseArms(args.arms);
  const experiment = await getExperiment(SOURCE_DIR, experimentName);
  const runId = randomUUID();
  const record = await createRunRecord(RESULTS_DIR, {
    id: runId,
    experiment: experiment.name,
    experimentId: experiment.id,
    sourceSha: SOURCE_SHA,
    arms,
    agent: experiment.definition.agent,
  });

  const child = spawn('npx', ['tsx', 'tools/wind-tunnel/runner.ts', '--run', runId], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return {runId, status: record.status};
}

async function getRunStatus(runId: string) {
  const run = await getRunRecord(RESULTS_DIR, runId);
  return {
    runId: run.id,
    experimentId: run.experimentId,
    status: run.status,
    elapsedMs: run.elapsedMs,
    sourceSha: run.sourceSha,
    sourceSnapshotCommit: run.sourceSnapshotCommit,
    arms: run.arms,
    error: run.error,
  };
}

async function compareRuns(ids: string[]) {
  if (!ids.length) throw new Error('ids must contain at least one run id');
  const runs = await Promise.all(ids.map(id => safeGetRun(RESULTS_DIR, id)));
  return runs.map(run => {
    const arms = run.armResults as Record<string, any>;
    const compact = (arm: any) => arm ? {
      status: run.arms?.[arm.arm]?.status ?? null,
      passed: arm.passed ?? null,
      durationMs: arm.agent?.durationMs ?? null,
      compileMs: arm.compiled?.durationMs ?? null,
      patchBytes: arm.patchBytes ?? null,
    } : null;
    return {
      id: run.id,
      experimentId: run.experimentId,
      status: run.status,
      elapsedMs: run.elapsedMs,
      sourceSha: run.sourceSha,
      sourceSnapshotCommit: run.sourceSnapshotCommit,
      raw: compact(arms.raw),
      nazare: compact(arms.nazare),
    };
  });
}

const tools = [
  {name: 'workspace_status', description: 'Inspect immutable deployed-source identity, active runs, and the disposable Wind Tunnel runtime.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'list_experiments', description: 'List experiment definitions available in the immutable deployed source, including agent and verification configuration.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'get_experiment', description: 'Inspect one experiment definition and its verification configuration.', inputSchema: {type: 'object', required: ['name'], properties: {name: {type: 'string'}}, additionalProperties: false}},
  {name: 'start_experiment', description: 'Queue a controlled experiment and return immediately. Long-running Pi work continues in a detached runner. Raw and Nazare arms use the same deployed source snapshot and Pi configuration.', inputSchema: {type: 'object', properties: {experiment: {type: 'string'}, arms: {type: 'array', items: {type: 'string', enum: ['raw', 'nazare']}}}, additionalProperties: false}},
  {name: 'get_run_status', description: 'Read lifecycle and per-arm progress for an active or completed run.', inputSchema: {type: 'object', required: ['runId'], properties: {runId: {type: 'string'}}, additionalProperties: false}},
  {name: 'get_run', description: 'Read a run safely at any lifecycle stage. Summary is null until available; active runs never fail merely because summary.json is absent.', inputSchema: {type: 'object', required: ['runId'], properties: {runId: {type: 'string'}}, additionalProperties: false}},
  {name: 'get_run_artifacts', description: 'Read persisted run artifacts: patch/diff, changed files, Pi output, compiled Nazare task, verifier output, and verification result.', inputSchema: {type: 'object', required: ['runId'], properties: {runId: {type: 'string'}, arm: {type: 'string', enum: ['raw', 'nazare']}}, additionalProperties: false}},
  {name: 'compare_runs', description: 'Compare compact success, lifecycle, provenance, and cost metrics for experiment runs, including incomplete runs.', inputSchema: {type: 'object', required: ['ids'], properties: {ids: {type: 'array', items: {type: 'string'}, minItems: 1}}, additionalProperties: false}},
] as const;

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'workspace_status': return workspaceStatus();
    case 'list_experiments': return listExperiments(SOURCE_DIR);
    case 'get_experiment': return getExperiment(SOURCE_DIR, String(args.name ?? ''));
    case 'start_experiment': return startExperiment(args);
    case 'get_run_status': return getRunStatus(String(args.runId ?? ''));
    case 'get_run': return safeGetRun(RESULTS_DIR, String(args.runId ?? ''));
    case 'get_run_artifacts': return getRunArtifacts(RESULTS_DIR, String(args.runId ?? ''), args.arm ? String(args.arm) as Arm : undefined);
    case 'compare_runs': return compareRuns(Array.isArray(args.ids) ? args.ids.map(String) : []);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function isAuthorized(req: IncomingMessage) {
  return Boolean(TOKEN) && req.headers.authorization === `Bearer ${TOKEN}`;
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
  try { body = await readJsonBody(req); }
  catch (error) { json(res, 400, rpcError(null, -32700, 'Parse error', String(error))); return; }
  if (body.method === 'notifications/initialized') { res.statusCode = 202; res.end(); return; }
  try {
    switch (body.method) {
      case 'initialize':
        json(res, 200, rpcResult(body.id, {
          protocolVersion: String(body.params?.protocolVersion ?? '2025-06-18'),
          capabilities: {tools: {listChanged: false}},
          serverInfo: {name: 'nazare-wind-tunnel', version: '0.4.0'},
          instructions: 'GitHub/deployed source is immutable. MCP requests are short-lived. Detached Pi runners own execution; Nazare owns task compilation; the tunnel persists only metadata, artifacts, verification, and metrics.',
        }));
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

await createControllerSnapshot();

createServer(async (req, res) => {
  if (req.url === '/health') {
    const status = await workspaceStatus();
    const sourceMatchesRailway = !RAILWAY_SHA || SOURCE_SHA === RAILWAY_SHA;
    json(res, sourceMatchesRailway ? 200 : 503, {ok: sourceMatchesRailway, ...status});
    return;
  }
  if (req.url === '/mcp') { await handleRpc(req, res); return; }
  res.statusCode = 404;
  res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Nazare Wind Tunnel v0.4 listening on ${PORT}`);
  console.log(`Source SHA: ${SOURCE_SHA}`);
  console.log(`Controller source snapshot: ${sourceSnapshotCommit}`);
});
