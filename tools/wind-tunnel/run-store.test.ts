import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createRunRecord,
  getRunArtifacts,
  patchArmState,
  patchRunRecord,
  safeGetRun,
  type Arm,
} from './run-store';

const SOURCE_SHA = '0123456789abcdef0123456789abcdef01234567';
const SNAPSHOT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

async function fixture(arms: Arm[] = ['raw', 'nazare']) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nazare-wind-tunnel-test-'));
  const runId = '11111111-1111-4111-8111-111111111111';
  await createRunRecord(root, {
    id: runId,
    experiment: 'experiments/test.json',
    experimentId: 'test-experiment',
    sourceSha: SOURCE_SHA,
    arms,
    agent: {provider: 'test-provider', model: 'test-model', thinking: 'low'},
  });
  return {root, runId};
}

test('incomplete runs are readable before summary.json exists', async () => {
  const {root, runId} = await fixture();
  try {
    const queued = await safeGetRun(root, runId);
    assert.equal(queued.status, 'queued');
    assert.equal(queued.summary, null);
    assert.equal(queued.complete, false);

    await patchRunRecord(root, runId, {
      status: 'running',
      startedAt: new Date(Date.now() - 25).toISOString(),
      sourceSnapshotCommit: SNAPSHOT,
    });
    const running = await safeGetRun(root, runId);
    assert.equal(running.status, 'running');
    assert.equal(running.summary, null);
    assert.ok(running.elapsedMs >= 0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('failed runs remain inspectable with per-arm failure state', async () => {
  const {root, runId} = await fixture(['raw']);
  try {
    const startedAt = new Date(Date.now() - 10).toISOString();
    const finishedAt = new Date().toISOString();
    await patchRunRecord(root, runId, {status: 'failed', startedAt, finishedAt, error: 'runner exploded'});
    await patchArmState(root, runId, 'raw', {
      status: 'failed',
      startedAt,
      finishedAt,
      passed: false,
      error: 'Pi exited with code 1',
      sourceSnapshotCommit: SNAPSHOT,
    });
    const failed = await safeGetRun(root, runId);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.complete, true);
    assert.equal(failed.arms.raw.passed, false);
    assert.equal(failed.arms.raw.error, 'Pi exited with code 1');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('artifact retrieval exposes present artifacts and marks missing ones unavailable', async () => {
  const {root, runId} = await fixture(['nazare']);
  try {
    const armDir = path.join(root, runId, 'nazare');
    await mkdir(armDir, {recursive: true});
    await writeFile(path.join(armDir, 'patch.diff'), 'diff --git a/a.ts b/a.ts\n');
    await writeFile(path.join(armDir, 'changed-files.json'), JSON.stringify(['a.ts']));
    await writeFile(path.join(armDir, 'agent.jsonl'), '{"type":"message"}\n');
    await writeFile(path.join(armDir, 'compiled-task.json'), '{"capability":"hero.emailCapture"}');
    await writeFile(path.join(armDir, 'verifier.stdout.log'), 'ok\n');
    await writeFile(path.join(armDir, 'verifier.stderr.log'), '');
    await writeFile(path.join(armDir, 'verification.json'), '[{"passed":true}]');

    const result = await getRunArtifacts(root, runId, 'nazare');
    const artifacts = result.arms.nazare as Record<string, any>;
    assert.equal(artifacts['patch.diff'].available, true);
    assert.match(artifacts['patch.diff'].content, /diff --git/);
    assert.equal(artifacts['compiled-task.json'].available, true);
    assert.equal(artifacts['verification.json'].available, true);
    assert.equal(artifacts['metadata.json'].available, false);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('raw and nazare arms preserve identical source provenance', async () => {
  const {root, runId} = await fixture();
  try {
    await patchRunRecord(root, runId, {sourceSnapshotCommit: SNAPSHOT});
    await patchArmState(root, runId, 'raw', {sourceSnapshotCommit: SNAPSHOT});
    await patchArmState(root, runId, 'nazare', {sourceSnapshotCommit: SNAPSHOT});
    const run = await safeGetRun(root, runId);
    assert.equal(run.arms.raw.sourceSha, SOURCE_SHA);
    assert.equal(run.arms.nazare.sourceSha, SOURCE_SHA);
    assert.equal(run.arms.raw.sourceSnapshotCommit, SNAPSHOT);
    assert.equal(run.arms.nazare.sourceSnapshotCommit, SNAPSHOT);
    assert.equal(run.arms.raw.sourceSnapshotCommit, run.arms.nazare.sourceSnapshotCommit);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
