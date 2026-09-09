# Luna operability experiment

Goal: measure whether a model can complete a cross-cutting commercial change inside a pinned repository and explicitly declared tool environment.

## Task

Run `task-02-marketing-consent.md` against the exact requested commit.

The task intentionally crosses:

- Carcass surface
- route/action executable binding
- business capability policy
- provider invocation boundary
- runtime evidence contract

## Pinned agent environment

Experiment definition declares:

- provider and model
- thinking level
- agent timeout
- enabled tool names
- repo-relative Pi tool extensions
- verification commands

Wind Tunnel records hashes and runtime versions in `environment.json` and `tool-manifest.json`. Ambient Pi extensions, skills, prompt templates, and context files are disabled.

This experiment currently enables the fixed coding toolset:

```json
{
  "allow": ["read", "bash", "edit", "write"],
  "extensions": []
}
```

Custom project tools can be added as pinned Pi extensions and named in the allowlist.

## Verification gate

Run must finish with all of:

```sh
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

Run that does not pass full gate is unsuccessful.

## Record

- completion status and wall-clock duration
- model usage and cost, when available
- tool calls, inputs, bounded outputs, latency, and failures
- files changed
- partial or final patch
- verification attempts and results
- whether surface, binding, capability policy, provider boundary, and evidence remain consistent

Primary signal: **solve and verify under pinned environment and hard correctness gate**. Full Pi transcript remains an artifact; token-level reasoning is not an effectiveness metric.
