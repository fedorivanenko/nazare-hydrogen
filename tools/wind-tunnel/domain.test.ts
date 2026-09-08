import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeVerification, withElapsed, type ExperimentDefinition, type RunState} from './domain';
import {redactText} from './artifact-store';

test('normalizes legacy string verification into typed verifier specs', () => {
  const experiment: ExperimentDefinition = {
    id: 'x',
    taskFile: 'task.md',
    agent: {},
    nazare: {capabilityId: 'c', requestedChange: 'change'},
    verification: ['npm test', {id: 'lint', command: 'npm run lint', timeoutMs: 1234, required: false}],
  };
  assert.deepEqual(normalizeVerification(experiment), [
    {id: 'verify-1', command: 'npm test', timeoutMs: 30 * 60 * 1000, required: true},
    {id: 'lint', command: 'npm run lint', timeoutMs: 1234, required: false},
  ]);
});

test('elapsed time is derived rather than persisted as authoritative state', () => {
  const startedAt = new Date(Date.now() - 100).toISOString();
  const state: RunState = {
    runId: '11111111-1111-4111-8111-111111111111',
    status: 'running',
    outcome: null,
    createdAt: startedAt,
    startedAt,
    finishedAt: null,
    updatedAt: startedAt,
    elapsedMs: 0,
    error: null,
    workerId: 'worker-1',
    leaseUntil: null,
    attempts: 1,
    spec: {
      runId: '11111111-1111-4111-8111-111111111111',
      experiment: {name: 'experiments/x.json', id: 'x', digest: 'a'},
      source: {repository: 'fedorivanenko/nazare-hydrogen', githubSha: 'source'},
      task: {path: 'task.md', digest: 'b'},
      arms: ['raw', 'nazare'],
      agent: {harness: 'pi', package: 'pi@1', provider: 'provider', model: 'model', thinking: 'low', timeoutMs: 1000},
      verification: [],
      controls: {source: 'identical', task: 'identical', harness: 'identical', model: 'identical', provider: 'identical', independentVariable: 'contextCompiler'},
      createdAt: startedAt,
    },
    arms: {
      raw: {arm: 'raw', status: 'running', outcome: null, startedAt, finishedAt: null, elapsedMs: 0, error: null, workspaceBaselineCommit: 'baseline'},
      nazare: {arm: 'nazare', status: 'running', outcome: null, startedAt, finishedAt: null, elapsedMs: 0, error: null, workspaceBaselineCommit: 'baseline'},
    },
  };
  const refreshed = withElapsed(state);
  assert.ok(refreshed.elapsedMs >= 50);
  assert.ok(refreshed.arms.raw.elapsedMs >= 50);
  assert.equal(refreshed.arms.raw.workspaceBaselineCommit, refreshed.arms.nazare.workspaceBaselineCommit);
});

test('artifact redaction removes configured secrets before persistence', () => {
  const previous = process.env.TEST_API_KEY;
  const fakeSecret = ['fixture', 'secret', 'value', '123'].join('-');
  process.env.TEST_API_KEY = fakeSecret;
  try {
    const redacted = redactText(`token=${fakeSecret}`);
    assert.doesNotMatch(redacted, new RegExp(fakeSecret));
    assert.match(redacted, /\[REDACTED\]/);
  } finally {
    if (previous === undefined) delete process.env.TEST_API_KEY;
    else process.env.TEST_API_KEY = previous;
  }
});
