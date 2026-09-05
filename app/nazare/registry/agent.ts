import {
	getCapability,
	getEntity,
	listCapabilities,
	searchCapabilities,
	searchRegistry,
} from "./index";
import type { RegistryEntityKind } from "./schema";

export function inspectEntity(id: string) {
	return getEntity(id);
}

export function findEntities(query: string, kind?: RegistryEntityKind) {
	return searchRegistry(query, kind);
}

export function inspectCapability(id: string) {
	return getCapability(id);
}

export function findCapabilities(query: string) {
	return searchCapabilities(query);
}

export function expandEntity(id: string) {
	const entity = getEntity(id);
	if (!entity) return null;

	if (entity.kind === "capability") {
		const neighbors = [...entity.surfaces, ...entity.providers]
			.map((ref) => getEntity(ref.id))
			.filter(
				(neighbor): neighbor is NonNullable<typeof neighbor> =>
					neighbor !== null,
			);

		return { entity, neighbors };
	}

	const relatedCapabilities = listCapabilities().filter((capability) =>
		entity.kind === "carcass"
			? capability.surfaces.some((ref) => ref.id === entity.id)
			: capability.providers.some((ref) => ref.id === entity.id),
	);

	return { entity, neighbors: relatedCapabilities };
}

export function planCapabilityChange(id: string, requestedChange: string) {
	const capability = getCapability(id);

	if (!capability) {
		return {
			ok: false as const,
			error: `Unknown capability: ${id}`,
		};
	}

	return {
		ok: true as const,
		capability: {
			id: capability.id,
			intent: capability.intent,
		},
		requestedChange,
		affectedSurfaces: capability.surfaces,
		affectedProviders: capability.providers,
		policiesToPreserve: capability.policies,
		requiredEvidence: capability.evidence,
		sourceFiles: capability.sourceFiles,
	};
}
