import {
	collectEmailSubscribersDefinition,
	heroDefinition,
	resendDefinition,
} from "./definitions";
import type {
	CapabilityDefinition,
	RegistryEntity,
	RegistryEntityKind,
} from "./schema";

const entities = [
	collectEmailSubscribersDefinition,
	heroDefinition,
	resendDefinition,
] as const satisfies readonly RegistryEntity[];

type RegisteredEntity = (typeof entities)[number];

export const registry: ReadonlyMap<string, RegisteredEntity> = new Map(
	entities.map((entity) => [entity.id, entity]),
);

export function listEntities(kind?: RegistryEntityKind) {
	return kind
		? entities.filter((entity) => entity.kind === kind)
		: [...entities];
}

export function getEntity(id: string) {
	return registry.get(id) ?? null;
}

export function searchRegistry(query: string, kind?: RegistryEntityKind) {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.map((term) => term.trim())
		.filter(Boolean);

	const candidates = kind
		? entities.filter((entity) => entity.kind === kind)
		: entities;

	if (terms.length === 0) return [...candidates];

	return candidates
		.map((entity) => {
			const extras =
				entity.kind === "capability"
					? [
							...entity.surfaces.map((surface) => surface.id),
							...entity.providers.flatMap((provider) => [
								provider.id,
								provider.action ?? "",
							]),
						]
					: entity.kind === "provider"
						? entity.actions.flatMap((action) => [action.id, action.intent])
						: [entity.carcassKind, ...(entity.props ?? [])];

			const haystack = [
				entity.id,
				entity.kind,
				entity.intent,
				...(entity.keywords ?? []),
				...extras,
			]
				.join(" ")
				.toLowerCase();

			const score = terms.reduce(
				(total, term) => total + (haystack.includes(term) ? 1 : 0),
				0,
			);

			return { entity, score };
		})
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.map(({ entity }) => entity);
}

export function getCapability(id: string) {
	const entity = getEntity(id);
	return entity?.kind === "capability"
		? (entity as CapabilityDefinition)
		: null;
}
