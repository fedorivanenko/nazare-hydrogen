# Luna operability experiment

Goal: test whether Nazare's semantic layer lets a deliberately weaker coding model make a cross-cutting commercial change with less repository exploration and fewer mistakes.

## Hypothesis

Given the same model and same requested behavior, the Nazare-guided arm should need fewer exploratory reads/searches, touch the correct architectural entities sooner, preserve invariants, and pass verification with fewer repair loops.

## Base

Run both arms from the same commit on `experiment/luna-operability`.

## Task

Use `task-01-first-name-capture.md` unchanged in both arms.

The requested change intentionally crosses four implementation layers:

- Carcass surface: Hero form
- business capability: collect email subscribers
- provider adapter: Resend contact creation
- route/action wiring

## Arm A — raw repository

Give the model only:

1. the task text
2. normal shell/file/code-edit tools
3. the repository

Do not mention Nazare's registry or registry CLI.

## Arm B — Nazare-guided

Give the same model the same task plus this instruction:

> Before reading implementation files, locate the relevant business entity with `npm run nazare:registry -- find <query>`, then inspect/expand it and use `plan` for the requested capability change. Expand into source only after that. Preserve the returned policies and evidence requirements.

Suggested sequence:

```sh
npm run nazare:registry -- find "email subscriber"
npm run nazare:registry -- expand capability.collect-email-subscribers
npm run nazare:registry -- plan capability.collect-email-subscribers "Capture an optional first name with the email subscription"
```

Do not otherwise help the model.

## Verification gate

Both arms must finish with all of:

```sh
npm run lint
npm test
npm run typecheck
npm run build
```

A run that does not pass the full gate is not successful, even if the patch looks plausible.

## What to record

Record these for each arm:

- total wall-clock duration
- model tokens, if the harness exposes them
- number of repository search commands
- number of file reads before the first correct architectural file is opened
- files changed
- verification attempts
- repair loops after the first verification failure
- final verification result
- whether the capability, Carcass surface, provider adapter, and route wiring all remained semantically consistent

The primary signal is not raw speed. It is **solve + verify + repair cost under a hard correctness gate**.

## Interpretation

A useful result is not merely that Luna can solve the task. We want to see whether the semantic layer changes the shape of the work:

- entity-first instead of grep-first
- correct neighborhood discovered before source expansion
- fewer irrelevant reads
- fewer architectural violations
- lower repair cost

If Arm B only saves a few searches on this tiny repository, scale the same protocol to progressively more entangled tasks rather than over-interpreting the absolute delta.
