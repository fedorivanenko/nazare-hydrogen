/// <reference types="node" />

import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getEntity, listEntities } from "../registry/index";
import type { RegistryEntity } from "../registry/schema";

type Diagnostic = {
	level: "error" | "warning";
	entity: string;
	message: string;
};

async function lintRegistry() {
	const diagnostics: Diagnostic[] = [];
	const entities: readonly RegistryEntity[] = listEntities();
	const seen = new Set<string>();
	const seenBindings = new Set<string>();
	const sourceCache = new Map<string, string>();

	async function source(path: string) {
		const cached = sourceCache.get(path);
		if (cached !== undefined) return cached;
		const contents = await readFile(resolve(process.cwd(), path), "utf8");
		sourceCache.set(path, contents);
		return contents;
	}

	for (const entity of entities) {
		if (seen.has(entity.id)) {
			diagnostics.push({ level: "error", entity: entity.id, message: "Duplicate registry entity id" });
		}
		seen.add(entity.id);

		for (const sourceFile of entity.sourceFiles) {
			try {
				await access(resolve(process.cwd(), sourceFile));
			} catch {
				diagnostics.push({ level: "error", entity: entity.id, message: `Missing source file: ${sourceFile}` });
			}
		}

		if (entity.kind !== "capability") continue;

		for (const surfaceRef of entity.surfaces) {
			const surface = getEntity(surfaceRef.id);
			if (surface?.kind !== "carcass") {
				diagnostics.push({ level: "error", entity: entity.id, message: `Unknown Carcass surface: ${surfaceRef.id}` });
			}
		}

		for (const providerRef of entity.providers) {
			const provider = getEntity(providerRef.id);
			if (provider?.kind !== "provider") {
				diagnostics.push({ level: "error", entity: entity.id, message: `Unknown provider: ${providerRef.id}` });
				continue;
			}
			if (providerRef.action && !provider.actions.some((action) => action.id === providerRef.action)) {
				diagnostics.push({ level: "error", entity: entity.id, message: `Unknown provider action: ${providerRef.id}.${providerRef.action}` });
			}
		}

		for (const binding of entity.bindings) {
			const diagnosticEntity = `${entity.id}:${binding.id}`;
			if (seenBindings.has(binding.id)) {
				diagnostics.push({ level: "error", entity: diagnosticEntity, message: "Duplicate executable binding id" });
			}
			seenBindings.add(binding.id);

			if (!entity.surfaces.some((surface) => surface.id === binding.surface)) {
				diagnostics.push({ level: "error", entity: diagnosticEntity, message: `Binding uses undeclared surface: ${binding.surface}` });
			}
			if (!entity.sourceFiles.includes(binding.sourceFile)) {
				diagnostics.push({ level: "error", entity: diagnosticEntity, message: `Binding source is not projected by capability: ${binding.sourceFile}` });
			}

			try {
				const contents = await source(binding.sourceFile);
				const markers = [
					["handler", binding.handler],
					["invocation", binding.invocation],
					...binding.inputs.map((input) => [`input ${input.name}`, input.evidence] as const),
				] as const;
				for (const [label, marker] of markers) {
					if (!contents.includes(marker)) {
						diagnostics.push({ level: "error", entity: diagnosticEntity, message: `Binding ${label} marker not found in ${binding.sourceFile}: ${marker}` });
					}
				}
			} catch {
				diagnostics.push({ level: "error", entity: diagnosticEntity, message: `Cannot inspect binding source: ${binding.sourceFile}` });
			}
		}

		if (entity.evidence.length === 0) {
			diagnostics.push({ level: "warning", entity: entity.id, message: "Capability has no declared evidence" });
		}
	}

	return diagnostics;
}

const diagnostics = await lintRegistry();
for (const diagnostic of diagnostics) {
	const marker = diagnostic.level === "error" ? "✗" : "⚠";
	console.error(`${marker} ${diagnostic.entity}: ${diagnostic.message}`);
}
const errors = diagnostics.filter((diagnostic) => diagnostic.level === "error");
if (errors.length > 0) {
	console.error(`\nNazare lint failed with ${errors.length} error(s).`);
	process.exit(1);
}
console.log(
	diagnostics.length === 0
		? "✓ Nazare registry and executable bindings are consistent."
		: `✓ Nazare registry passed with ${diagnostics.length} warning(s).`,
);
