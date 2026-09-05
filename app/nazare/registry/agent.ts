import { getCapability, searchCapabilities } from "./index";

export function inspectCapability(id: string) {
	return getCapability(id);
}

export function findCapabilities(query: string) {
	return searchCapabilities(query);
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
