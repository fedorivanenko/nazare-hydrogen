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

		return { entity, neighbors, bindings: entity.bindings };
	}

	const relatedCapabilities = listCapabilities().filter((capability) =>
		entity.kind === "carcass"
			? capability.surfaces.some((ref) => ref.id === entity.id)
			: capability.providers.some((ref) => ref.id === entity.id),
	);

	return { entity, neighbors: relatedCapabilities };
}

export function compileCapabilityTask(id: string, requestedChange: string) {
	const capability = getCapability(id);

	if (!capability) {
		return {
			ok: false as const,
			error: `Unknown capability: ${id}`,
		};
	}

	const surfaces = capability.surfaces
		.map((ref) => getEntity(ref.id))
		.filter((entity) => entity?.kind === "carcass");
	const providers = capability.providers.map((ref) => ({
		ref,
		entity: getEntity(ref.id),
	}));
	const sourceFiles = Array.from(
		new Set([
			...capability.sourceFiles,
			...surfaces.flatMap((surface) => surface?.sourceFiles ?? []),
			...providers.flatMap(({ entity }) => entity?.sourceFiles ?? []),
			...capability.bindings.map((binding) => binding.sourceFile),
		]),
	);

	return {
		ok: true as const,
		task: requestedChange,
		target: {
			id: capability.id,
			intent: capability.intent,
		},
		sourceFiles,
		executableBindings: capability.bindings,
		constraints: {
			policies: capability.policies,
			requiredEvidence: capability.evidence,
			surfaces: surfaces.map((surface) => ({
				id: surface?.id,
				constraints: surface?.kind === "carcass" ? surface.constraints ?? [] : [],
			})),
			providers: providers.map(({ ref, entity }) => ({
				id: ref.id,
				action: ref.action,
				intent: entity?.intent,
			})),
		},
		verify: [
			"Preserve every declared capability policy.",
			"Preserve every required evidence contract.",
			"Keep provider-specific behavior out of Carcass components.",
			"Keep every executable binding consistent with the capability invocation.",
			"Run npm run lint.",
			"Run npm test.",
			"Run npm run typecheck.",
			"Run npm run build.",
		],
	};
}

export function planCapabilityChange(id: string, requestedChange: string) {
	return compileCapabilityTask(id, requestedChange);
}
