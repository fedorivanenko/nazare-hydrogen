# Nazare Wind Tunnel v2

The Wind Tunnel measures software operability, not agent cleverness.

## Source of truth

GitHub `main` is the only source of truth for Wind Tunnel code, experiment definitions, provider/model configuration, and deploy configuration. Railway is a disposable executor.

```text
GitHub main
   |
   | exact deployed SHA
   v
Railway image (/app, immutable)
   |
   +--> fresh disposable source snapshot (/tmp/nazare-wind-tunnel/source)
   |       |
   |       +--> raw worktree ---------> Pi
   |       |
   |       +--> Nazare compile -> worktree -> Pi
   |                                      |
   |                                      v
   |                              external verification
   |
   +--> durable results (/workspace/results)
```

The repository is never persisted under `/workspace`. Every container start deletes and recreates the runtime source/worktree tree under `/tmp` from the deployed `/app` snapshot. A deploy therefore replaces the Wind Tunnel instead of mutating an old one.

## Runtime identity

`bootstrap.ts` requires `RAILWAY_GIT_COMMIT_SHA` in Railway and passes it to the controller as `WIND_TUNNEL_SOURCE_SHA`. `/health` and `workspace_status` expose:

- controller/version
- Railway Git SHA
- source SHA
- disposable source-snapshot commit
- provider/model
- results/runtime paths

The controller returns unhealthy if the source SHA and Railway SHA disagree.

## Boundary

- **Pi** owns the coding-agent loop, model/provider protocol, filesystem and shell tools.
- **Nazare** owns capability resolution and task compilation.
- **Wind Tunnel** owns source identity, disposable A/B worktrees, external verification, traces, patches, and metrics.

The old custom Groq/tool-call harness has been retired. `groq-server.ts` is now only a compatibility entrypoint that loads `server-v2.ts` for the existing OAuth gateway.

## MCP surface

- `workspace_status`
- `run_experiment`
- `get_run`
- `compare_runs`

There is intentionally no shell/`exec` tool on the source snapshot: benchmark source is immutable from the controller surface.

`run_experiment` defaults to `experiments/luna-operability/experiment-02-marketing-consent.json` and runs both `raw` and `nazare` arms. Both arms are detached Git worktrees from the same disposable source snapshot. The Nazare arm compiles `.nazare/task.json` before Pi starts. After Pi exits, Wind Tunnel itself runs the verification gate; agent self-reporting never counts as success.

## Pi + Vercel AI Gateway

The adapter invokes Pi in non-interactive JSON mode. The package is pinned in `pi-adapter.ts` and can be overridden with `WIND_TUNNEL_PI_PACKAGE`.

The default experiment uses provider `vercel-ai-gateway` and model `openai/gpt-oss-20b`. Railway only needs `AI_GATEWAY_API_KEY` plus runtime/auth variables; provider/model selection lives in Git.

## Persistent state

Durable benchmark outputs live under `WIND_TUNNEL_RESULTS_DIR` (default `/workspace/results`). OAuth registration/token state may also live on the Railway volume so the ChatGPT connector survives redeploys, but no repository source, baseline, worktree, provider config, or build state is persisted there.
