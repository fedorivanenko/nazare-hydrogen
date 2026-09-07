/// <reference types="node" />

import { access } from "node:fs/promises";
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

	for (const entity of entities) {
		if (seen.has(entity.id)) {
			diagnostics.push({
				level: "error",
				entity: entity.id,
				message: "Duplicate registry entity id",
			});
		}
		seen.add(entity.id);

		for (const sourceFile of entity.sourceFiles) {
			try {
				await access(resolve(process.cwd(), sourceFile));
			} catch {
				diagnostics.push({
					level: "error",
					entity: entity.id,
					message: `Missing source file: ${sourceFile}`,
				});
			}
		}

		if (entity.kind !== "capability") continue;

		for (const surfaceRef of entity.surfaces) {
			const surface = getEntity(surfaceRef.id);
			if (surface?.kind !== "carcass") {
				diagnostics.push({
					level: "error",
					entity: entity.id,
					message: `Unknown Carcass surface: ${surfaceRef.id}`,
				});
			}
		}

		for (const providerRef of entity.providers) {
			const provider = getEntity(providerRef.id);
			if (provider?.kind !== "provider") {
				diagnostics.push({
					level: "error",
					entity: entity.id,
					message: `Unknown provider: ${providerRef.id}`,
				});
				continue;
			}

			if (
				providerRef.action &&
				!provider.actions.some((action) => action.id === providerRef.action)
			) {
				diagnostics.push({
					level: "error",
					entity: entity.id,
					message: `Unknown provider action: ${providerRef.id}.${providerRef.action}`,
				});
			}
		}

		if (entity.evidence.length === 0) {
			diagnostics.push({
				level: "warning",
				entity: entity.id,
				message: "Capability has no declared evidence",
			});
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
		? "✓ Nazare registry is consistent."
		: `✓ Nazare registry passed with ${diagnostics.length} warning(s).`,
);
