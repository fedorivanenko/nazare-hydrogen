# Luna operability experiment

Goal: test whether Nazare can compile a cross-cutting commercial change into a sufficiently small, explicit task that a deliberately weaker coding model needs materially less repository exploration and repair.

## Hypothesis

Given the same model and requested behavior, the Nazare-guided arm should discover the complete executable neighborhood before source exploration, preserve architectural invariants, and reach the hard verification gate with fewer irrelevant reads and repair loops.

## Task

Run both arms from the same commit and use `task-02-marketing-consent.md` unchanged.

The task intentionally crosses:

- Carcass surface
- route/action executable binding
- business capability policy
- provider invocation boundary
- runtime evidence contract

## Arm A — raw repository

Give the model only the task text, normal shell/file/code-edit tools, and the repository. Do not mention the Nazare registry or registry CLI.

## Arm B — compiled Nazare context

Give the same model the same task plus this instruction:

> Before reading implementation files, locate the relevant business capability with `npm run nazare:registry -- find <query> capability`, then compile the requested change with `npm run nazare:registry -- compile <capability-id> <requested-change>`. Treat the compiled source projection, executable bindings, policies, evidence, and verification requirements as the task boundary. Expand outside it only if verification demonstrates that the projection is incomplete.

Suggested sequence:

```sh
npm run nazare:registry -- find "email subscriber" capability
npm run nazare:registry -- compile capability.collect-email-subscribers "Require explicit marketing consent before newsletter signup"
```

## Verification gate

Both arms must finish with all of:

```sh
npm run lint
npm test
npm run typecheck
npm run build
```

A run that does not pass the full gate is not successful.

## Record

- wall-clock duration
- model tokens, if available
- repository search commands
- files read before the first correct architectural file
- files read outside the compiled projection
- files changed
- verification attempts
- repair loops
- final gate result
- whether surface, binding, capability policy, provider boundary, and evidence remain consistent

The primary signal is **solve + verify + repair cost under a hard correctness gate**, not raw generation speed.

## Interpretation

We want to see a qualitative shape change:

- compiled task instead of repo reconstruction
- complete executable neighborhood before source expansion
- fewer irrelevant reads
- fewer architecture violations
- lower repair cost

If the compiled arm still has to rediscover required files outside the projection, that is evidence of a missing graph edge and should be fixed in the representation before adding more agent sophistication.
