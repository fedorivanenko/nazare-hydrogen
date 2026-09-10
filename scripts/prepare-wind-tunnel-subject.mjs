import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "tsx", ".wind-tunnel/compile-subject.ts"], {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
