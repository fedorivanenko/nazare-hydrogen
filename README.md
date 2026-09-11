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

`.github/workflows/wind-tunnel.yml` submits exact pull-request SHA and an inline task definition to Nazare Wind Tunnel API. Canonical task:

```text
experiments/luna-operability/task-02-marketing-consent.json
```

Repository must remain publicly cloneable until Wind Tunnel supports authenticated source delivery.
