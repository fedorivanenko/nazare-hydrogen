# Nazare Wind Tunnel v1

The Wind Tunnel measures software operability, not agent cleverness.

## Architecture

Wind Tunnel is an experiment service. MCP is its control interface, not its execution runtime.

```text
ChatGPT / Codex / CLI
        |
        v
Railway control service
  OAuth + MCP
  freeze RunSpec
  inspect runs/artifacts
        |
        v
Postgres
  durable queue
  run state
  leases/events/metrics
        |
        v
Railway worker service
  claim + heartbeat
  disposable run workspace
        |
   +----+----+
   |         |
  raw      nazare
   |         |
   +----+----+
        |
   same Pi harness
        |
   verification
        |
        v
Railway S3 bucket
  immutable artifacts
  hashes + manifests
```

## Source of truth and provenance

GitHub `main` is the source of truth for Wind Tunnel code and experiment definitions. Railway deploys an exact GitHub commit as `/app`.

`start_experiment` freezes an immutable `RunSpec` containing:

- repository and deployed GitHub SHA
- experiment path/id and SHA-256 digest
- task path and SHA-256 digest
- requested arms
- Pi harness/package/provider/model/thinking/timeout
- normalized verifier configuration
- experimental controls declaring the only intended independent variable: Nazare context compilation

A worker refuses to execute a run if its deployed source SHA, experiment digest, task digest, or Pi package differs from the frozen `RunSpec`.

The synthetic Git commit created inside a disposable run workspace is implementation plumbing only and is reported as `workspaceBaselineCommit`; it is never confused with the externally meaningful GitHub source SHA.

## Control plane

The existing OAuth gateway remains the public boundary. `server-v2.ts` is only a compatibility entrypoint that imports `control.ts`.

The control process never executes Pi and never spawns a worker. Its MCP requests remain short-lived.

MCP surface:

- `workspace_status`
- `list_experiments`
- `get_experiment`
- `start_experiment`
- `get_run_status`
- `get_run`
- `get_run_artifacts`
- `compare_runs`

`get_run` is valid at every lifecycle stage because Postgres contains the canonical run from creation onward; there is no privileged `summary.json` that appears only at completion.

## Durable run model

Lifecycle describes infrastructure execution:

```text
queued -> preparing -> running -> verifying -> completed
                                      \-> failed
```

Experiment outcome is separate:

```text
pass | fail | inconclusive | null
```

A verifier failure is therefore a successfully executed experiment whose outcome is `fail`. Worker/process/source/storage failures produce lifecycle `failed`.

Postgres stores:

- immutable RunSpec
- mutable RunState
- per-arm state
- worker lease/attempt count
- append-only structured events
- artifact metadata and hashes

Workers claim rows with `FOR UPDATE SKIP LOCKED`, hold a renewable lease, and may recover abandoned nonterminal runs after lease expiry.

## A/B execution

For a normal `raw + nazare` experiment, both arms execute concurrently from the same disposable baseline and the same frozen Pi configuration.

Controlled variables are required to be identical:

- source SHA
- task digest
- harness and package
- provider/model/thinking
- runtime source image

The intended independent variable is only `contextCompiler`:

- `raw`: task + repository
- `nazare`: task + compiled `.nazare/task.json`

The worker deletes the entire run workspace after finalization.

## Artifacts

Large outputs live in the Railway S3-compatible bucket. Postgres stores only their manifest metadata.

Typical artifact types:

- `run.spec`
- `agent.prompt`
- `pi.transcript`
- `pi.stderr`
- `nazare.compiled-task`
- `git.patch`
- `git.changed-files`
- `verification.stdout`
- `verification.stderr`
- `verification.result`
- `metrics`
- `arm.error`

Every artifact has a SHA-256 digest, byte size, media type, object key, run id, and optional arm. Text artifacts pass through secret redaction before persistence.

## Railway resources

Target production resources:

```text
control          public OAuth/MCP service
worker           private long-running worker
Postgres         durable queue/state/events
artifacts bucket immutable S3-compatible artifacts
```

The old `/workspace` volume is not part of experiment persistence anymore. It may remain attached to `control` only to preserve OAuth client/token state across redeploys.

Both application services need `psql` installed because the current Postgres adapter deliberately uses the CLI process boundary to avoid adding a database runtime dependency to the Hydrogen application lockfile. The adapter is isolated behind `postgres-store.ts` and can later be replaced with a native driver without changing the domain or MCP surface.
