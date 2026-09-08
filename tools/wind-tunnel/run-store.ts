import {access, mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

export type Arm = 'raw' | 'nazare';
export type RunStatus = 'queued' | 'preparing' | 'running' | 'verifying' | 'completed' | 'failed';

export type ArmState = {
  arm: Arm;
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  elapsedMs: number;
  passed: boolean | null;
  error: string | null;
  sourceSha: string;
  sourceSnapshotCommit: string | null;
};

export type RunRecord = {
  id: string;
  experiment: string;
  experimentId: string;
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  elapsedMs: number;
  sourceSha: string;
  sourceSnapshotCommit: string | null;
  arms: Record<string, ArmState>;
  agent: {provider: string | null; model: string | null; thinking: string | null};
  error: string | null;
};

export type Experiment = {
  id: string;
  taskFile: string;
  agent: {provider?: string; model?: string; thinking?: string; timeoutMs?: number};
  nazare: {capabilityId: string; requestedChange: string};
  verification: string[];
};

const ARTIFACT_NAMES = [
  'patch.diff',
  'changed-files.json',
  'agent.jsonl',
  'agent.stderr.log',
  'prompt.txt',
  'compiled-task.json',
  'verification.json',
  'verifier.stdout.log',
  'verifier.stderr.log',
  'metadata.json',
] as const;

const MAX_ARTIFACT_BYTES = 400_000;

export function validateRunId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid run id');
}

export function runDir(resultsDir: string, id: string) {
  validateRunId(id);
  return path.join(resultsDir, id);
}

export async function atomicWriteJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), {recursive: true});
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2));
  const {rename} = await import('node:fs/promises');
  await rename(temp, file);
}

export async function readJsonIfExists<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export function computeElapsed(startedAt: string | null, finishedAt: string | null, now = Date.now()) {
  if (!startedAt) return 0;
  const start = Date.parse(startedAt);
  const end = finishedAt ? Date.parse(finishedAt) : now;
  return Math.max(0, end - start);
}

export function deriveRunStatus(record: RunRecord): RunStatus {
  if (record.status === 'completed' || record.status === 'failed') return record.status;
  const states = Object.values(record.arms).map(arm => arm.status);
  if (!states.length) return record.status;
  if (states.every(status => status === 'queued')) return record.status === 'preparing' ? 'preparing' : 'queued';
  if (states.some(status => status === 'running')) return 'running';
  if (states.some(status => status === 'verifying') && states.every(status => ['verifying', 'completed', 'failed'].includes(status))) return 'verifying';
  if (states.some(status => ['verifying', 'completed', 'failed'].includes(status))) return 'running';
  if (states.some(status => status === 'preparing')) return 'preparing';
  return record.status;
}

export function refreshElapsed(record: RunRecord): RunRecord {
  const arms: Record<string, ArmState> = {};
  for (const [name, arm] of Object.entries(record.arms)) {
    arms[name] = {...arm, elapsedMs: computeElapsed(arm.startedAt, arm.finishedAt)};
  }
  return {
    ...record,
    status: deriveRunStatus({...record, arms}),
    elapsedMs: computeElapsed(record.startedAt ?? record.createdAt, record.finishedAt),
    arms,
  };
}

export async function createRunRecord(
  resultsDir: string,
  input: {id: string; experiment: string; experimentId: string; sourceSha: string; arms: Arm[]; agent: Experiment['agent']},
) {
  const now = new Date().toISOString();
  const armStates = Object.fromEntries(input.arms.map(arm => [arm, {
    arm,
    status: 'queued' as const,
    startedAt: null,
    finishedAt: null,
    elapsedMs: 0,
    passed: null,
    error: null,
    sourceSha: input.sourceSha,
    sourceSnapshotCommit: null,
  }]));
  const record: RunRecord = {
    id: input.id,
    experiment: input.experiment,
    experimentId: input.experimentId,
    status: 'queued',
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    updatedAt: now,
    elapsedMs: 0,
    sourceSha: input.sourceSha,
    sourceSnapshotCommit: null,
    arms: armStates,
    agent: {provider: input.agent.provider ?? null, model: input.agent.model ?? null, thinking: input.agent.thinking ?? null},
    error: null,
  };
  await atomicWriteJson(path.join(runDir(resultsDir, input.id), 'run.json'), record);
  return record;
}

export async function getRunRecord(resultsDir: string, id: string) {
  const record = await readJsonIfExists<RunRecord>(path.join(runDir(resultsDir, id), 'run.json'));
  if (!record) throw new Error(`Run not found: ${id}`);
  return refreshElapsed(record);
}

export async function patchRunRecord(resultsDir: string, id: string, patch: Partial<RunRecord>) {
  const current = await getRunRecord(resultsDir, id);
  const next: RunRecord = {...current, ...patch, id: current.id, updatedAt: new Date().toISOString()};
  await atomicWriteJson(path.join(runDir(resultsDir, id), 'run.json'), next);
  return refreshElapsed(next);
}

export async function patchArmState(resultsDir: string, id: string, arm: Arm, patch: Partial<ArmState>) {
  const current = await getRunRecord(resultsDir, id);
  const previous = current.arms[arm];
  if (!previous) throw new Error(`Arm not requested: ${arm}`);
  const nextArm = {...previous, ...patch, arm};
  return patchRunRecord(resultsDir, id, {arms: {...current.arms, [arm]: nextArm}});
}

export async function safeGetRun(resultsDir: string, id: string) {
  const state = await getRunRecord(resultsDir, id);
  const summary = await readJsonIfExists<any>(path.join(runDir(resultsDir, id), 'summary.json'));
  const armMetadata: Record<string, unknown> = {};
  for (const arm of Object.keys(state.arms)) {
    const metadata = await readJsonIfExists(path.join(runDir(resultsDir, id), arm, 'metadata.json'));
    if (metadata) armMetadata[arm] = metadata;
  }
  return {
    ...state,
    summary,
    armResults: summary?.arms ?? armMetadata,
    complete: state.status === 'completed' || state.status === 'failed',
  };
}

async function readArtifact(file: string) {
  try {
    const info = await stat(file);
    const content = await readFile(file, 'utf8');
    const bytes = info.size;
    if (bytes <= MAX_ARTIFACT_BYTES) return {available: true, bytes, truncated: false, content};
    return {available: true, bytes, truncated: true, content: content.slice(-MAX_ARTIFACT_BYTES)};
  } catch (error: any) {
    if (error?.code === 'ENOENT') return {available: false, bytes: 0, truncated: false, content: null};
    throw error;
  }
}

export async function getRunArtifacts(resultsDir: string, id: string, arm?: Arm) {
  const state = await getRunRecord(resultsDir, id);
  const requested = arm ? [arm] : Object.keys(state.arms) as Arm[];
  const arms: Record<string, unknown> = {};
  for (const armName of requested) {
    if (!state.arms[armName]) throw new Error(`Arm not requested: ${armName}`);
    const dir = path.join(runDir(resultsDir, id), armName);
    const artifacts: Record<string, unknown> = {};
    for (const name of ARTIFACT_NAMES) artifacts[name] = await readArtifact(path.join(dir, name));
    arms[armName] = artifacts;
  }
  return {runId: id, status: state.status, arms};
}

export async function listExperiments(sourceDir: string) {
  const root = path.join(sourceDir, 'experiments');
  const files: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
    }
  }
  try { await access(root); } catch { return []; }
  await walk(root);
  const experiments = [];
  for (const full of files.sort()) {
    try {
      const definition = JSON.parse(await readFile(full, 'utf8')) as Experiment;
      if (!definition.id || !definition.taskFile || !Array.isArray(definition.verification)) continue;
      experiments.push({
        name: path.relative(sourceDir, full),
        id: definition.id,
        taskFile: definition.taskFile,
        agent: definition.agent,
        verification: definition.verification,
        nazare: definition.nazare,
      });
    } catch {
      // Ignore non-experiment JSON files under experiments/.
    }
  }
  return experiments;
}

export async function getExperiment(sourceDir: string, name: string) {
  const experiments = await listExperiments(sourceDir);
  const match = experiments.find(item => item.name === name || item.id === name || path.basename(item.name) === name);
  if (!match) throw new Error(`Experiment not found: ${name}`);
  const definition = JSON.parse(await readFile(path.join(sourceDir, match.name), 'utf8')) as Experiment;
  return {...match, definition};
}
