/// <reference types="node" />

import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { listCapabilities } from "../registry/index";
import { getProvider } from "../registry/providers";
import type { CapabilityDefinition } from "../registry/schema";
import { getSurface } from "../registry/surfaces";

type Diagnostic = {
	level: "error" | "warning";
	capability: string;
	message: string;
};

async function lintCapabilityRegistry() {
	const diagnostics: Diagnostic[] = [];
	const capabilities: readonly CapabilityDefinition[] = listCapabilities();
	const seen = new Set<string>();

	for (const capability of capabilities) {
		if (seen.has(capability.id)) {
			diagnostics.push({
				level: "error",
				capability: capability.id,
				message: "Duplicate capability id",
			});
		}
		seen.add(capability.id);

		for (const surfaceRef of capability.surfaces) {
			if (!getSurface(surfaceRef.id)) {
				diagnostics.push({
					level: "error",
					capability: capability.id,
					message: `Unknown Carcass surface: ${surfaceRef.id}`,
				});
			}
		}

		for (const providerRef of capability.providers) {
			const provider = getProvider(providerRef.id);
			if (!provider) {
				diagnostics.push({
					level: "error",
					capability: capability.id,
					message: `Unknown provider: ${providerRef.id}`,
				});
				continue;
			}

			if (
				providerRef.action &&
				!provider.actions.includes(
					providerRef.action as (typeof provider.actions)[number],
				)
			) {
				diagnostics.push({
					level: "error",
					capability: capability.id,
					message: `Unknown provider action: ${providerRef.id}.${providerRef.action}`,
				});
			}
		}

		if (capability.evidence.length === 0) {
			diagnostics.push({
				level: "warning",
				capability: capability.id,
				message: "Capability has no declared evidence",
			});
		}

		for (const sourceFile of capability.sourceFiles) {
			try {
				await access(resolve(process.cwd(), sourceFile));
			} catch {
				diagnostics.push({
					level: "error",
					capability: capability.id,
					message: `Missing source file: ${sourceFile}`,
				});
			}
		}
	}

	return diagnostics;
}

const diagnostics = await lintCapabilityRegistry();

for (const diagnostic of diagnostics) {
	const marker = diagnostic.level === "error" ? "✗" : "⚠";
	console.error(`${marker} ${diagnostic.capability}: ${diagnostic.message}`);
}

const errors = diagnostics.filter((diagnostic) => diagnostic.level === "error");

if (errors.length > 0) {
	console.error(`\nNazare lint failed with ${errors.length} error(s).`);
	process.exit(1);
}

console.log(
	diagnostics.length === 0
		? "✓ Nazare capability registry is consistent."
		: `✓ Nazare capability registry passed with ${diagnostics.length} warning(s).`,
);
