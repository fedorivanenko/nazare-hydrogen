# Luna operability task

`task-02-marketing-consent.json` is canonical Wind Tunnel task definition.

It asks implementation agent to add explicit marketing consent across:

- Hero surface
- route/action executable binding
- business capability policy
- provider invocation boundary
- runtime evidence contract

Wind Tunnel receives task through `POST /api/runs`, checks out exact requested Git SHA, prepares dependencies, runs model mutation, and executes all commands in `verify`.

Trigger `.github/workflows/wind-tunnel.yml` with pull-request number and task path. Workflow polls run API and uploads result plus event evidence.
