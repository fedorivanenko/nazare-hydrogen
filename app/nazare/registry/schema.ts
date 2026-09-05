export type CapabilitySurfaceRef = {
	type: "surface";
	id: string;
};

export type CapabilityProviderRef = {
	type: "provider";
	id: string;
	action?: string;
};

export type CapabilityPolicy = {
	id: string;
	description: string;
};

export type CapabilityEvidence = {
	id: string;
	type: "test" | "metric" | "runtime" | "experiment" | "observation";
	description: string;
};

export type CapabilityDefinition = {
	id: string;
	intent: string;
	keywords?: readonly string[];
	surfaces: readonly CapabilitySurfaceRef[];
	providers: readonly CapabilityProviderRef[];
	policies: readonly CapabilityPolicy[];
	evidence: readonly CapabilityEvidence[];
	sourceFiles: readonly string[];
};

export function defineCapability<const T extends CapabilityDefinition>(
	definition: T,
) {
	return definition;
}
