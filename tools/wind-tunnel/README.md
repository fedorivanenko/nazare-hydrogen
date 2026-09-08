# Nazare Wind Tunnel v2

The Wind Tunnel measures software operability, not agent cleverness.

## Boundary

- **Pi** owns the coding-agent loop, model/provider protocol, and filesystem/shell tools.
- **Nazare** owns capability resolution and task compilation.
- **Wind Tunnel** owns the immutable baseline, isolated A/B worktrees, external verification, traces, patches, and metrics.

```text
GitHub source of truth
        |
        v
Railway Wind Tunnel controller
        |
        +-- raw worktree ---------> Pi ----+
        |                                  |
        +-- Nazare compile -> worktree -> Pi
                                           |
                                           v
                              external verification
                                           |
                                           v
                                     compare A/B
```

## MCP surface

- `workspace_status`
- `run_experiment`
- `get_run`
- `compare_runs`
- `exec` (development only)

`run_experiment` defaults to `experiments/luna-operability/experiment-02-marketing-consent.json` and runs both `raw` and `nazare` arms.

Each arm starts from the same local `baseline` tag in an isolated Git worktree. The Nazare arm compiles `.nazare/task.json` before Pi starts. After Pi exits, the Wind Tunnel itself runs the verification commands from the experiment definition; an agent saying that a task is complete is never counted as success.

## Pi

The adapter invokes the maintained Pi package in non-interactive JSON mode. The package is pinned in `pi-adapter.ts` and can be overridden with `WIND_TUNNEL_PI_PACKAGE`.

Provider credentials stay in Railway environment variables (for example `GROQ_API_KEY` or `OPENROUTER_API_KEY`). They are not stored in Git.

## Results

A completed experiment is persisted under `WIND_TUNNEL_RESULTS_DIR/<run-id>/` with per-arm metadata, agent JSONL, stderr, prompt, compiled task (Nazare arm), patch, and external verification results.

The Railway filesystem is runtime state only. GitHub remains the reproducible definition of the tunnel and experiments; durable result storage can be moved to object storage/Postgres later without changing the experiment protocol.
