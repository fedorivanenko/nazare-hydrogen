/// <reference types="node" />

import { extname, relative, resolve } from "node:path";
import { Project } from "ts-morph";
import { stampSourceFile } from "./stamp";

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
	console.error("Usage: pnpm nazare:stamp <path-to-ts-or-tsx-file> [...files]");
	process.exit(1);
}

const project = new Project({
	tsConfigFilePath: resolve(process.cwd(), "tsconfig.json"),
	skipAddingFilesFromTsConfig: true,
});

for (const input of inputs) {
	const path = resolve(process.cwd(), input);
	const extension = extname(path);
	if (extension !== ".ts" && extension !== ".tsx") {
		throw new Error(
			`Nazare identity stamping accepts only .ts and .tsx files: ${input}`,
		);
	}

	const sourceFile = project.addSourceFileAtPath(path);
	const stamped = stampSourceFile(sourceFile);
	await sourceFile.save();
	console.log(
		stamped.length === 0
			? `✓ ${relative(process.cwd(), path)} already stamped`
			: `✓ Stamped ${stamped.length} declarations in ${relative(process.cwd(), path)}`,
	);
	for (const declaration of stamped) {
		console.log(`  ${declaration.id} ${declaration.name}`);
	}
}
