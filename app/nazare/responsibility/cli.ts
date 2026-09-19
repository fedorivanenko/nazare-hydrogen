/// <reference types="node" />

import { writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { createProject, extractFileEvidence } from "../evidence/extract";
import { inferResponsibility } from "./infer";

const args = process.argv.slice(2);
let input: string | undefined;
let model = "alibaba/qwen3-coder-30b-a3b";
let dryRun = false;

for (let index = 0; index < args.length; index += 1) {
	const argument = args[index];
	if (argument === "--dry-run") {
		dryRun = true;
		continue;
	}
	if (argument === "--model") {
		model = args[index + 1] ?? "";
		index += 1;
		continue;
	}
	if (argument?.startsWith("--model=")) {
		model = argument.slice("--model=".length);
		continue;
	}
	if (argument?.startsWith("--")) {
		console.error(`Unknown option: ${argument}`);
		process.exit(1);
	}
	if (input) {
		console.error(`Unexpected argument: ${argument}`);
		process.exit(1);
	}
	input = argument;
}

if (!input || !model) {
	console.error(
		"Usage: pnpm nazare:responsibility <path-to-ts-or-tsx-file> [--model <model-id>] [--dry-run]",
	);
	process.exit(1);
}

const absoluteInput = resolve(process.cwd(), input);
const extension = extname(absoluteInput);
if (extension !== ".ts" && extension !== ".tsx") {
	console.error(
		"Nazare responsibility inference accepts only .ts and .tsx files.",
	);
	process.exit(1);
}

const project = createProject(resolve(process.cwd(), "tsconfig.json"));
const evidence = extractFileEvidence(project, absoluteInput);
const result = await inferResponsibility(evidence, model);
const evidenceOutput = absoluteInput.replace(/\.tsx?$/, ".evidence.json");
const responsibilityOutput = absoluteInput.replace(
	/\.tsx?$/,
	".responsibility.json",
);

if (dryRun) {
	console.log(JSON.stringify(result.responsibility, null, "\t"));
} else {
	await Promise.all([
		writeFile(
			evidenceOutput,
			`${JSON.stringify(evidence, null, "\t")}\n`,
			"utf8",
		),
		writeFile(
			responsibilityOutput,
			`${JSON.stringify(result.responsibility, null, "\t")}\n`,
			"utf8",
		),
	]);
	console.log(
		`✓ Wrote ${relative(process.cwd(), evidenceOutput)} and ${relative(
			process.cwd(),
			responsibilityOutput,
		)}`,
	);
}

console.log(
	`Model ${model} · ${(result.elapsedMs / 1_000).toFixed(2)}s · ${result.usage.inputTokens ?? "?"} input · ${result.usage.outputTokens ?? "?"} output tokens`,
);
