/// <reference types="node" />

import { writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { createProject, extractFileEvidence } from "./extract";

const input = process.argv[2];

if (!input) {
	console.error("Usage: pnpm nazare:evidence <path-to-ts-or-tsx-file>");
	process.exit(1);
}

const absoluteInput = resolve(process.cwd(), input);
const extension = extname(absoluteInput);

if (extension !== ".ts" && extension !== ".tsx") {
	console.error("Nazare evidence currently accepts only .ts and .tsx files.");
	process.exit(1);
}

const project = createProject(resolve(process.cwd(), "tsconfig.json"));
const evidence = extractFileEvidence(project, absoluteInput);
const output = absoluteInput.replace(/\.tsx?$/, ".evidence.json");

await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

console.log(
	`✓ Wrote evidence for ${relative(process.cwd(), absoluteInput)} → ${relative(
		process.cwd(),
		output,
	)}`,
);
