# Nazare Hydrogen

Shopify Hydrogen storefront and Nazare architecture experiment subject.

## Development

```bash
pnpm install
pnpm dev
```

Quality gate:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

## Nazare registry

`app/nazare/registry` declares storefront surfaces, capabilities, providers, policies, evidence, and executable bindings. `pnpm lint:nazare` verifies graph references, source files, and binding markers against implementation.

## Wind Tunnel

`.github/workflows/wind-tunnel.yml` automatically submits exact pull-request SHA and an inline task definition when a same-repository, non-draft pull request is opened, reopened, synchronized, or marked ready for review. New commits cancel older per-PR workflow runs and their Eve sessions. Canonical task:

```text
experiments/luna-operability/task-02-marketing-consent.json
```

Repository must remain publicly cloneable until Wind Tunnel supports authenticated source delivery.
