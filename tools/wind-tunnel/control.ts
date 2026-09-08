import {createHash, randomUUID} from 'node:crypto';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {getArtifact} from './artifact-store';
import {
  normalizeVerification,
  type Arm,
  type ArmState,
  type ExperimentDefinition,
  type RunSpec,
} from './domain';
import {
  createRun,
  ensureSchema,
  getEvents,
  getRun,
  listActiveRuns,
  listArtifacts,
} from './postgres-store';

const PORT = Number(process.env.PORT ?? 3001);
const APP_DIR = process.env.WIND_TUNNEL_APP_DIR ?? '/app';
const SOURCE_SHA = process.env.WIND_TUNNEL_SOURCE_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local';
const SOURCE_REPO = process.env.WIND_TUNNEL_SOURCE_REPO ?? 'fedorivanenko/nazare-hydrogen';
const TOKEN = process.env.WIND_TUNNEL_TOKEN;
const PI_PACKAGE = process.env.WIND_TUNNEL_PI_PACKAGE ?? '@earendil-works/pi-coding-agent@0.85.1';
const DEFAULT_EXPERIMENT = 'experiments/luna-operability/experiment-02-marketing-consent.json';
const MAX_BODY_BYTES = 1_000_000;

type JsonRpcRequest = {jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown>};
type ExperimentInfo = {name: string; id: string; taskFile: string; agent: ExperimentDefinition['agent']; nazare: ExperimentDefinition['nazare']; verification: ReturnType<typeof normalizeVerification>; definition: ExperimentDefinition};

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
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

function safeSourcePath(relativePath: string) {
  const root = path.resolve(APP_DIR);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('Path must stay inside deployed source');
  return resolved;
}

async function listExperimentFiles() {
  const root = path.join(APP_DIR, 'experiments');
  const files: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
    }
  }
  await walk(root);
  return files.sort();
}

async function loadExperiment(name: string): Promise<ExperimentInfo> {
  const files = await listExperimentFiles();
  for (const full of files) {
    const relative = path.relative(APP_DIR, full);
    const raw = await readFile(full, 'utf8');
    let definition: ExperimentDefinition;
    try { definition = JSON.parse(raw) as ExperimentDefinition; }
    catch { continue; }
    if (!definition.id || !definition.taskFile || !Array.isArray(definition.verification)) continue;
    if (name !== relative && name !== definition.id && name !== path.basename(relative)) continue;
    return {
      name: relative,
      id: definition.id,
      taskFile: definition.taskFile,
      agent: definition.agent,
      nazare: definition.nazare,
      verification: normalizeVerification(definition),
      definition,
    };
  }
  throw new Error(`Experiment not found: ${name}`);
}

async function listExperiments() {
  const result = [];
  for (const full of await listExperimentFiles()) {
    const relative = path.relative(APP_DIR, full);
    try {
      const experiment = await loadExperiment(relative);
      result.push({name: experiment.name, id: experiment.id, taskFile: experiment.taskFile, agent: experiment.agent, nazare: experiment.nazare, verification: experiment.verification});
    } catch {
      // Ignore JSON files that are not experiment definitions.
    }
  }
  return result;
}

function parseArms(value: unknown): Arm[] {
  const requested = Array.isArray(value) ? value.map(String) : ['raw', 'nazare'];
  const arms = [...new Set(requested.filter((item): item is Arm => item === 'raw' || item === 'nazare'))];
  if (!arms.length) throw new Error('arms must contain raw and/or nazare');
  return arms;
}

async function startExperiment(args: Record<string, unknown>) {
  const experiment = await loadExperiment(String(args.experiment ?? DEFAULT_EXPERIMENT));
  const arms = parseArms(args.arms);
  const rawDefinition = await readFile(safeSourcePath(experiment.name), 'utf8');
  const task = await readFile(safeSourcePath(experiment.taskFile), 'utf8');
  const runId = randomUUID();
  const createdAt = new Date().toISOString();
  const spec: RunSpec = {
    runId,
    experiment: {name: experiment.name, id: experiment.id, digest: sha256(rawDefinition)},
    source: {repository: SOURCE_REPO, githubSha: SOURCE_SHA},
    task: {path: experiment.taskFile, digest: sha256(task)},
    arms,
    agent: {
      harness: experiment.agent.harness ?? 'pi',
      package: experiment.agent.package ?? PI_PACKAGE,
      provider: experiment.agent.provider ?? null,
      model: experiment.agent.model ?? null,
      thinking: experiment.agent.thinking ?? null,
      timeoutMs: Number(experiment.agent.timeoutMs ?? 15 * 60 * 1000),
    },
    verification: experiment.verification,
    controls: {
      source: 'identical',
      task: 'identical',
      harness: 'identical',
      model: 'identical',
      provider: 'identical',
      independentVariable: 'contextCompiler',
    },
    createdAt,
  };
  const armStates = Object.fromEntries(arms.map(arm => [arm, {
    arm,
    status: 'queued',
    outcome: null,
    startedAt: null,
    finishedAt: null,
    elapsedMs: 0,
    error: null,
    workspaceBaselineCommit: null,
  } satisfies ArmState]));
  await createRun(spec, armStates);
  return {runId, status: 'queued', sourceSha: SOURCE_SHA, experimentDigest: spec.experiment.digest, taskDigest: spec.task.digest};
}

async function getRunView(runId: string) {
  const [run, events, artifacts] = await Promise.all([getRun(runId), getEvents(runId), listArtifacts(runId)]);
  return {run, events, artifacts};
}

async function getRunArtifacts(runId: string, arm?: Arm, inline = true) {
  const records = await listArtifacts(runId, arm);
  if (!inline) return {runId, artifacts: records};
  const artifacts = [];
  for (const record of records) artifacts.push(await getArtifact(record));
  return {runId, artifacts};
}

async function compareRuns(ids: string[]) {
  if (!ids.length) throw new Error('ids must contain at least one run id');
  const runs = await Promise.all(ids.map(getRun));
  return runs.map(run => ({
    runId: run.runId,
    experimentId: run.spec.experiment.id,
    status: run.status,
    outcome: run.outcome,
    elapsedMs: run.elapsedMs,
    sourceSha: run.spec.source.githubSha,
    experimentDigest: run.spec.experiment.digest,
    taskDigest: run.spec.task.digest,
    arms: Object.fromEntries(Object.entries(run.arms).map(([name, arm]) => [name, {
      status: arm.status,
      outcome: arm.outcome,
      elapsedMs: arm.elapsedMs,
      error: arm.error,
      workspaceBaselineCommit: arm.workspaceBaselineCommit,
    }])),
  }));
}

async function workspaceStatus() {
  const active = await listActiveRuns();
  let defaultAgent: ExperimentDefinition['agent'] = {};
  try { defaultAgent = (await loadExperiment(DEFAULT_EXPERIMENT)).agent; } catch {}
  return {
    controller: 'wind-tunnel-control',
    version: '1.0.0',
    sourceOfTruth: 'railway-deployed-github-commit',
    sourceRepository: SOURCE_REPO,
    sourceSha: SOURCE_SHA,
    provider: defaultAgent.provider ?? null,
    model: defaultAgent.model ?? null,
    activeRuns: active.map(run => ({runId: run.runId, status: run.status, elapsedMs: run.elapsedMs, workerId: run.workerId, leaseUntil: run.leaseUntil})),
    persistence: {runs: 'postgres', artifacts: 's3'},
  };
}

const tools = [
  {name: 'workspace_status', description: 'Inspect Wind Tunnel control-plane health, immutable deployed-source provenance, and active durable runs.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'list_experiments', description: 'List experiment definitions available in the deployed GitHub source.', inputSchema: {type: 'object', properties: {}, additionalProperties: false}},
  {name: 'get_experiment', description: 'Inspect a declarative experiment definition and normalized verifier configuration.', inputSchema: {type: 'object', required: ['name'], properties: {name: {type: 'string'}}, additionalProperties: false}},
  {name: 'start_experiment', description: 'Freeze an immutable RunSpec in Postgres and enqueue it. Returns immediately; workers execute independently.', inputSchema: {type: 'object', properties: {experiment: {type: 'string'}, arms: {type: 'array', items: {type: 'string', enum: ['raw', 'nazare']}}}, additionalProperties: false}},
  {name: 'get_run_status', description: 'Read durable lifecycle, per-arm progress, elapsed time, worker lease, outcome, and immutable provenance.', inputSchema: {type: 'object', required: ['runId'], properties: {runId: {type: 'string'}}, additionalProperties: false}},
  {name: 'get_run', description: 'Read a run at any lifecycle stage, including event history and artifact manifest.', inputSchema: {type: 'object', required: ['runId'], properties: {runId: {type: 'string'}}, additionalProperties: false}},
  {name: 'get_run_artifacts', description: 'Retrieve immutable artifacts and hashes, optionally scoped to one arm. Text artifacts may be inlined with size limits.', inputSchema: {type: 'object', required: ['runId'], properties: {runId: {type: 'string'}, arm: {type: 'string', enum: ['raw', 'nazare']}, inline: {type: 'boolean'}}, additionalProperties: false}},
  {name: 'compare_runs', description: 'Compare durable run outcomes, provenance, lifecycle, and arm-level timing.', inputSchema: {type: 'object', required: ['ids'], properties: {ids: {type: 'array', items: {type: 'string'}, minItems: 1}}, additionalProperties: false}},
] as const;

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'workspace_status': return workspaceStatus();
    case 'list_experiments': return listExperiments();
    case 'get_experiment': return loadExperiment(String(args.name ?? ''));
    case 'start_experiment': return startExperiment(args);
    case 'get_run_status': return getRun(String(args.runId ?? ''));
    case 'get_run': return getRunView(String(args.runId ?? ''));
    case 'get_run_artifacts': return getRunArtifacts(String(args.runId ?? ''), args.arm ? String(args.arm) as Arm : undefined, args.inline !== false);
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
          serverInfo: {name: 'nazare-wind-tunnel', version: '1.0.0'},
          instructions: 'Wind Tunnel is an experiment control plane. Runs are immutable RunSpecs in Postgres; workers execute independently in disposable workspaces; artifacts are persisted to S3 with hashes and provenance.',
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

await ensureSchema();

createServer(async (req, res) => {
  if (req.url === '/health') {
    try {
      json(res, 200, {ok: true, ...(await workspaceStatus())});
    } catch (error) {
      json(res, 503, {ok: false, error: error instanceof Error ? error.message : String(error)});
    }
    return;
  }
  if (req.url === '/mcp') { await handleRpc(req, res); return; }
  res.statusCode = 404;
  res.end();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Nazare Wind Tunnel control v1 listening on ${PORT}`);
  console.log(`Immutable source: ${SOURCE_REPO}@${SOURCE_SHA}`);
});
