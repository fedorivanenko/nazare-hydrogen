import { readFileSync } from "node:fs";

const subject = JSON.parse(readFileSync(".wind-tunnel/subject.json", "utf8"));
if (subject.version !== 1) throw new Error("Unsupported .wind-tunnel/subject.json version");
if (!subject.dependencies?.lockfile || !subject.dependencies?.install) throw new Error("Subject dependency contract is incomplete");
if (!subject.compile?.entrypoint || !subject.compile?.output) throw new Error("Subject compile contract is incomplete");
