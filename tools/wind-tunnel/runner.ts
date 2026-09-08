import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {cp, mkdir, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {runPi} from './pi-adapter';
import {
  atomicWriteJson,
  getExperiment,
  getRunRecord,
  patchArmState,
  patchRunRecord,
  runDir,
  type Arm,
  type Experiment,
  type RunStatus,
} from './run-store';

const APP_DIR = process.env.WIND_TUNNEL_APP_DIR ?? '/app';
const SOURCE_SHA = process.env.WIND_TUNNEL_SOURCE_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local';
const RESULTS_DIR = process.env.WIND_TUNNEL_RESULTS_DIR ?? '/workspace/results';
const RUNTIME_ROOT = process.env.WIND_TUNNEL_RUNTIME_DIR ?? '/tmp/nazare-wind-tunnel';
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;

type ProcessResult = {
  command: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

type VerificationResult = {
  command: string;
  exitCode: number | null;
  durationMs: number;
  passed: boolean;
  timedOut: boolean;
  stdout: string;
  stderr: string;
};

function tail(text: string, max = 20_000) {
  return text.length <= max ? text : text.slice(-max);
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
      resolve({command: [file, ...args].join(' '), exitCode, signal, stdout, stderr, durationMs: Date.now() - started, timedOut});
    });
  });
}

async function runShell(command: string, cwd: string, timeoutMs?: number) {
  return runProcess('/bin/sh', ['-lc', command], cwd, timeoutMs);
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

async function createRunSnapshot(runId: string) {
  const jobDir = path.join(RUNTIME_ROOT, `job-${runId}`);
  const sourceDir = path.join(jobDir, 'source');
  await rm(jobDir, {recursive: true, force: true});
  await mkdir(sourceDir, {recursive: true});
  await cp(APP_DIR, sourceDir, {
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
  ].join(' && '), sourceDir, 120_000);
  if (init.exitCode !== 0) throw new Error(`Failed to create run source snapshot: ${init.stderr || init.stdout}`);
  const head = await runShell('git rev-parse HEAD', sourceDir);
  if (head.exitCode !== 0) throw new Error(head.stderr || head.stdout);
  return {jobDir, sourceDir, snapshotCommit: head.stdout.trim()};
}

async function createArmWorktree(sourceDir: string, jobDir: string, runId: string, arm: Arm, snapshotCommit: string) {
  const worktree = path.join(jobDir, `${runId}-${arm}`);
  const add = await runShell(`git worktree add --detach ${JSON.stringify(worktree)} ${JSON.stringify(snapshotCommit)}`, sourceDir, 60_000);
  if (add.exitCode !== 0) throw new Error(add.stderr || add.stdout);
  const sharedNodeModules = path.join(APP_DIR, 'node_modules');
  const armNodeModules = path.join(worktree, 'node_modules');
  if (existsSync(sharedNodeModules) && !existsSync(armNodeModules)) await symlink(sharedNodeModules, armNodeModules, 'dir');
  return worktree;
}

async function removeArmWorktree(sourceDir: string, worktree: string) {
  await runShell(`git worktree remove --force ${JSON.stringify(worktree)}`, sourceDir, 60_000);
  await rm(worktree, {recursive: true, force: true});
}

async function compileNazareTask(worktree: string, experiment: Experiment) {
  await mkdir(path.join(worktree, '.nazare'), {recursive: true});
  const command = `npm run nazare:registry -- compile ${JSON.stringify(experiment.nazare.capabilityId)} ${JSON.stringify(experiment.nazare.requestedChange)}`;
  const result = await runShell(command, worktree, 60_000);
  if (result.exitCode !== 0) throw new Error(`Nazare compile failed: ${result.stderr || result.stdout}`);
  const jsonStart = result.stdout.indexOf('{');
  if (jsonStart < 0) throw new Error('Nazare compile did not return JSON');
  const projection = JSON.parse(result.stdout.slice(jsonStart));
  await writeFile(path.join(worktree, '.nazare', 'task.json'), JSON.stringify(projection, null, 2));
  return {command, durationMs: result.durationMs, bytes: Buffer.byteLength(JSON.stringify(projection)), projection};
}

async function verify(worktree: string, commands: string[]) {
  const results: VerificationResult[] = [];
  let stdout = '';
  let stderr = '';
  for (const command of commands) {
    const result = await runShell(command, worktree, MAX_TIMEOUT_MS);
    const item = {
      command,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      passed: result.exitCode === 0 && !result.timedOut,
      timedOut: result.timedOut,
      stdout: tail(result.stdout),
      stderr: tail(result.stderr),
    };
    results.push(item);
    stdout += `\n$ ${command}\n${result.stdout}`;
    stderr += `\n$ ${command}\n${result.stderr}`;
  }
  return {results, stdout, stderr};
}

async function diffArtifacts(worktree: string, snapshotCommit: string) {
  const patch = await runShell(`git diff --no-ext-diff --binary ${JSON.stringify(snapshotCommit)} -- . ':(exclude).nazare/task.json'`, worktree);
  if (patch.exitCode !== 0) throw new Error(patch.stderr || patch.stdout);
  const changed = await runShell(`git diff --name-only ${JSON.stringify(snapshotCommit)} -- . ':(exclude).nazare/task.json'`, worktree);
  if (changed.exitCode !== 0) throw new Error(changed.stderr || changed.stdout);
  return {patch: patch.stdout, changedFiles: changed.stdout.split('\n').map(item => item.trim()).filter(Boolean)};
}

async function setRunStatus(runId: string, status: RunStatus, extra: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const record = await getRunRecord(RESULTS_DIR, runId);
  await patchRunRecord(RESULTS_DIR, runId, {
    status,
    startedAt: record.startedAt ?? (status === 'queued' ? null : now),
    finishedAt: status === 'completed' || status === 'failed' ? now : null,
    ...extra,
  });
}

async function runArm(
  runId: string,
  arm: Arm,
  experiment: Experiment,
  task: string,
  sourceDir: string,
  jobDir: string,
  snapshotCommit: string,
) {
  const resultDir = path.join(runDir(RESULTS_DIR, runId), arm);
  await mkdir(resultDir, {recursive: true});
  const startedAt = new Date().toISOString();
  await patchArmState(RESULTS_DIR, runId, arm, {status: 'preparing', startedAt, sourceSnapshotCommit: snapshotCommit});
  let worktree = '';
  try {
    worktree = await createArmWorktree(sourceDir, jobDir, runId, arm, snapshotCommit);
    const compiled = arm === 'nazare' ? await compileNazareTask(worktree, experiment) : null;
    if (compiled) await writeFile(path.join(resultDir, 'compiled-task.json'), JSON.stringify(compiled.projection, null, 2));
    const prompt = buildPrompt(task, arm);
    await writeFile(path.join(resultDir, 'prompt.txt'), prompt);

    await patchArmState(RESULTS_DIR, runId, arm, {status: 'running'});
    await setRunStatus(runId, 'running');
    const agent = await runPi({
      cwd: worktree,
      prompt,
      provider: experiment.agent.provider,
      model: experiment.agent.model,
      thinking: experiment.agent.thinking,
      timeoutMs: Number(experiment.agent.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    await Promise.all([
      writeFile(path.join(resultDir, 'agent.jsonl'), agent.stdout),
      writeFile(path.join(resultDir, 'agent.stderr.log'), agent.stderr),
    ]);

    const diff = await diffArtifacts(worktree, snapshotCommit);
    await Promise.all([
      writeFile(path.join(resultDir, 'patch.diff'), diff.patch),
      writeFile(path.join(resultDir, 'changed-files.json'), JSON.stringify(diff.changedFiles, null, 2)),
    ]);

    if (agent.exitCode !== 0 || agent.timedOut) {
      const finishedAt = new Date().toISOString();
      const error = agent.timedOut ? 'Pi execution timed out' : `Pi exited with code ${agent.exitCode}`;
      const metadata = {
        runId, experimentId: experiment.id, arm, startedAt, finishedAt,
        sourceSha: SOURCE_SHA, sourceSnapshotCommit: snapshotCommit,
        agent: {provider: experiment.agent.provider ?? null, model: experiment.agent.model ?? null, thinking: experiment.agent.thinking ?? null, exitCode: agent.exitCode, durationMs: agent.durationMs, timedOut: agent.timedOut},
        compiled: compiled ? {durationMs: compiled.durationMs, bytes: compiled.bytes} : null,
        patchBytes: Buffer.byteLength(diff.patch), changedFiles: diff.changedFiles, verification: [], passed: false, error,
      };
      await atomicWriteJson(path.join(resultDir, 'metadata.json'), metadata);
      await atomicWriteJson(path.join(resultDir, 'verification.json'), []);
      await Promise.all([writeFile(path.join(resultDir, 'verifier.stdout.log'), ''), writeFile(path.join(resultDir, 'verifier.stderr.log'), '')]);
      await patchArmState(RESULTS_DIR, runId, arm, {status: 'failed', finishedAt, passed: false, error});
      return metadata;
    }

    await patchArmState(RESULTS_DIR, runId, arm, {status: 'verifying'});
    await setRunStatus(runId, 'verifying');
    const verification = await verify(worktree, experiment.verification);
    await Promise.all([
      atomicWriteJson(path.join(resultDir, 'verification.json'), verification.results),
      writeFile(path.join(resultDir, 'verifier.stdout.log'), verification.stdout),
      writeFile(path.join(resultDir, 'verifier.stderr.log'), verification.stderr),
    ]);
    const passed = verification.results.every(item => item.passed);
    const finishedAt = new Date().toISOString();
    const metadata = {
      runId, experimentId: experiment.id, arm, startedAt, finishedAt,
      sourceSha: SOURCE_SHA, sourceSnapshotCommit: snapshotCommit,
      agent: {provider: experiment.agent.provider ?? null, model: experiment.agent.model ?? null, thinking: experiment.agent.thinking ?? null, exitCode: agent.exitCode, durationMs: agent.durationMs, timedOut: agent.timedOut},
      compiled: compiled ? {durationMs: compiled.durationMs, bytes: compiled.bytes} : null,
      patchBytes: Buffer.byteLength(diff.patch), changedFiles: diff.changedFiles,
      verification: verification.results.map(({stdout, stderr, ...item}) => ({...item, stdoutTail: stdout, stderrTail: stderr})),
      passed,
    };
    await atomicWriteJson(path.join(resultDir, 'metadata.json'), metadata);
    await patchArmState(RESULTS_DIR, runId, arm, {status: 'completed', finishedAt, passed, error: null});
    return metadata;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finishedAt = new Date().toISOString();
    await patchArmState(RESULTS_DIR, runId, arm, {status: 'failed', finishedAt, passed: false, error: message});
    await atomicWriteJson(path.join(resultDir, 'metadata.json'), {
      runId, experimentId: experiment.id, arm, startedAt, finishedAt,
      sourceSha: SOURCE_SHA, sourceSnapshotCommit: snapshotCommit, passed: false, error: message,
    });
    return {runId, experimentId: experiment.id, arm, sourceSha: SOURCE_SHA, sourceSnapshotCommit: snapshotCommit, passed: false, error: message};
  } finally {
    if (worktree) await removeArmWorktree(sourceDir, worktree);
  }
}

export async function executeRun(runId: string) {
  const initial = await getRunRecord(RESULTS_DIR, runId);
  let jobDir = '';
  try {
    await setRunStatus(runId, 'preparing');
    const snapshot = await createRunSnapshot(runId);
    jobDir = snapshot.jobDir;
    await patchRunRecord(RESULTS_DIR, runId, {sourceSnapshotCommit: snapshot.snapshotCommit});
    for (const arm of Object.keys(initial.arms) as Arm[]) {
      await patchArmState(RESULTS_DIR, runId, arm, {sourceSnapshotCommit: snapshot.snapshotCommit});
    }
    const experimentInfo = await getExperiment(snapshot.sourceDir, initial.experiment);
    const experiment = experimentInfo.definition;
    const task = await readFile(path.resolve(snapshot.sourceDir, experiment.taskFile), 'utf8');
    const armResults: Record<string, unknown> = {};
    for (const arm of Object.keys(initial.arms) as Arm[]) {
      armResults[arm] = await runArm(runId, arm, experiment, task, snapshot.sourceDir, snapshot.jobDir, snapshot.snapshotCommit);
    }
    const finalState = await getRunRecord(RESULTS_DIR, runId);
    const failed = Object.values(finalState.arms).some(arm => arm.status === 'failed');
    const summary = {
      id: runId,
      experimentId: experiment.id,
      sourceSha: SOURCE_SHA,
      sourceSnapshotCommit: snapshot.snapshotCommit,
      arms: armResults,
    };
    await atomicWriteJson(path.join(runDir(RESULTS_DIR, runId), 'summary.json'), summary);
    await setRunStatus(runId, failed ? 'failed' : 'completed', failed ? {error: 'One or more arms failed'} : {error: null});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setRunStatus(runId, 'failed', {error: message});
  } finally {
    if (jobDir) await rm(jobDir, {recursive: true, force: true});
  }
}

const argIndex = process.argv.indexOf('--run');
if (argIndex >= 0) {
  const runId = process.argv[argIndex + 1];
  if (!runId) throw new Error('--run requires a run id');
  await executeRun(runId);
}
