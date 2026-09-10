export type RegistryEntityKind = "capability" | "carcass" | "provider";
export type CapabilityId = `capability.${string}`;
export type CarcassId = `carcass.${"page" | "section" | "component"}.${string}`;
export type ProviderId = `provider.${string}`;

export type RegistryEntityBase<
	TKind extends RegistryEntityKind,
	TId extends string,
> = {
	id: TId;
	kind: TKind;
	intent: string;
	keywords?: readonly string[];
	/** Files useful for understanding this entity. Readable context, not write permission. */
	sourceFiles: readonly string[];
};

export type CapabilitySurfaceRef = {
	type: "surface";
	id: CarcassId;
};

export type CapabilityProviderRef = {
	type: "provider";
	id: ProviderId;
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

export type CapabilityBindingInput = {
	name: string;
	evidence: string;
};

export type CapabilityBinding = {
	id: `binding.${string}`;
	kind: "route-action" | "component" | "event-handler";
	sourceFile: string;
	surface: CarcassId;
	handler: string;
	invocation: string;
	inputs: readonly CapabilityBindingInput[];
};

export type CapabilityMutationTarget = {
	file: string;
	/** Top-level symbols that may be changed in this file. */
	symbols: readonly string[];
};

export type CapabilityDefinition = RegistryEntityBase<
	"capability",
	CapabilityId
> & {
	surfaces: readonly CapabilitySurfaceRef[];
	providers: readonly CapabilityProviderRef[];
	policies: readonly CapabilityPolicy[];
	evidence: readonly CapabilityEvidence[];
	bindings: readonly CapabilityBinding[];
	/** Explicit files the operator/agent may mutate for this capability. */
	mutationFiles: readonly string[];
	/** Optional symbol-level narrowing inside mutationFiles. */
	mutationTargets?: readonly CapabilityMutationTarget[];
};

export type CarcassDefinition = RegistryEntityBase<"carcass", CarcassId> & {
	carcassKind: "page" | "section" | "component";
	props?: readonly string[];
	constraints?: readonly string[];
};

export type ProviderAction = {
	id: string;
	intent: string;
};

export type ProviderDefinition = RegistryEntityBase<"provider", ProviderId> & {
	actions: readonly ProviderAction[];
};

export type RegistryEntity =
	| CapabilityDefinition
	| CarcassDefinition
	| ProviderDefinition;

export function defineCapability<const T extends CapabilityDefinition>(
	definition: T,
) {
	return definition;
}

export function defineCarcass<const T extends CarcassDefinition>(
	definition: T,
) {
	return definition;
}

export function defineProvider<const T extends ProviderDefinition>(
	definition: T,
) {
	return definition;
}
