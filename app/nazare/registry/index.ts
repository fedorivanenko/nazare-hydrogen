import { collectEmailSubscribers } from "../capabilities/collect-email-subscribers";
import type { CapabilityDefinition } from "./schema";

const capabilities = [collectEmailSubscribers] as const satisfies readonly CapabilityDefinition[];

export const capabilityRegistry = new Map(
	capabilities.map((capability) => [capability.id, capability]),
);

export function listCapabilities() {
	return capabilities;
}

export function getCapability(id: string) {
	return capabilityRegistry.get(id) ?? null;
}

export function searchCapabilities(query: string) {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.map((term) => term.trim())
		.filter(Boolean);

	if (terms.length === 0) return [...capabilities];

	return capabilities
		.map((capability) => {
			const haystack = [
				capability.id,
				capability.intent,
				...(capability.keywords ?? []),
				...capability.surfaces.map((surface) => surface.id),
				...capability.providers.flatMap((provider) => [provider.id, provider.action ?? ""]),
			]
				.join(" ")
				.toLowerCase();

			const score = terms.reduce(
				(total, term) => total + (haystack.includes(term) ? 1 : 0),
				0,
			);

			return { capability, score };
		})
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.map(({ capability }) => capability);
}
