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

This experiment enables fixed coding tools plus pinned Nazare registry tools:

```json
{
  "allow": ["read", "bash", "edit", "write", "nazare_find", "nazare_inspect", "nazare_compile"],
  "extensions": [".wind-tunnel/nazare-tools.ts"],
  "bootstrap": [{
    "id": "nazare-task-context",
    "entrypoint": ".wind-tunnel/prepare-change.ts",
    "timeoutMs": 3000,
    "maxOutputBytes": 24000,
    "required": true
  }]
}
```

Worker first executes pinned `.wind-tunnel/prepare-change.ts` and gives model bounded capability context plus focused source excerpts. Nazare tools then expose registry search, entity-neighborhood inspection, and capability-change compilation for model follow-up. Primary experiment uses `openai/gpt-oss-120b`; `gpt-oss-20b` remains lower-capacity comparison baseline.

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
