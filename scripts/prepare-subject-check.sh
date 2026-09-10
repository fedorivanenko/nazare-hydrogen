#!/usr/bin/env bash
set -euo pipefail
node scripts/lint-subject-contract.mjs
node scripts/test-prepared-subject.mjs
pnpm exec tsx .wind-tunnel/compile-subject.ts
