import {
	getCapability,
	getEntity,
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
		return {
			entity,
			neighbors: [
				...entity.surfaces.map((ref) => getEntity(ref.id)).filter(Boolean),
				...entity.providers.map((ref) => getEntity(ref.id)).filter(Boolean),
			],
		};
	}

	const relatedCapabilities = searchRegistry(entity.id, "capability");
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
