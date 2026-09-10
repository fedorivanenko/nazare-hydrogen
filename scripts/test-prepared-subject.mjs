import { readFileSync } from "node:fs";

const contract = JSON.parse(readFileSync(".wind-tunnel/subject.json", "utf8"));
if (contract.version !== 1) throw new Error("Expected subject contract version 1");
if (contract.dependencies.lockfile !== "pnpm-lock.yaml") throw new Error("Prepared subject must be keyed by pnpm-lock.yaml");
if (!contract.compile.entrypoint.endsWith("compile-subject.ts")) throw new Error("Expected subject compiler entrypoint");
