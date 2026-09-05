export type RegistryEntityKind = "capability" | "carcass" | "provider";

export type RegistryEntityBase = {
	id: string;
	kind: RegistryEntityKind;
	intent: string;
	keywords?: readonly string[];
	sourceFiles: readonly string[];
};

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

export type CapabilityDefinition = RegistryEntityBase & {
	kind: "capability";
	surfaces: readonly CapabilitySurfaceRef[];
	providers: readonly CapabilityProviderRef[];
	policies: readonly CapabilityPolicy[];
	evidence: readonly CapabilityEvidence[];
};

export type CarcassDefinition = RegistryEntityBase & {
	kind: "carcass";
	carcassKind: "page" | "section" | "component";
	props?: readonly string[];
	constraints?: readonly string[];
};

export type ProviderAction = {
	id: string;
	intent: string;
};

export type ProviderDefinition = RegistryEntityBase & {
	kind: "provider";
	actions: readonly ProviderAction[];
};

export type RegistryEntity =
	| CapabilityDefinition
	| CarcassDefinition
	| ProviderDefinition;

export function defineCapability<const T extends CapabilityDefinition>(definition: T) {
	return definition;
}

export function defineCarcass<const T extends CarcassDefinition>(definition: T) {
	return definition;
}

export function defineProvider<const T extends ProviderDefinition>(definition: T) {
	return definition;
}
