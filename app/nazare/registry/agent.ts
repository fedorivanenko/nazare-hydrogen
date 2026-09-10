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
	).sort();
	const mutationFiles = Array.from(new Set(capability.mutationFiles)).sort();
	const unknownMutationFiles = mutationFiles.filter(
		(file) => !sourceFiles.includes(file),
	);
	if (unknownMutationFiles.length) {
		return {
			ok: false as const,
			error: `Capability ${id} declares mutation files outside its readable source closure: ${unknownMutationFiles.join(", ")}`,
		};
	}

	const mutationTargets = (capability.mutationTargets ?? []).map((target) => ({
		file: target.file,
		symbols: Array.from(new Set(target.symbols)).sort(),
	}));
	const invalidMutationTargets = mutationTargets.filter(
		(target) =>
			!mutationFiles.includes(target.file) || target.symbols.length === 0,
	);
	if (invalidMutationTargets.length) {
		return {
			ok: false as const,
			error: `Capability ${id} declares invalid mutation targets: ${invalidMutationTargets.map((target) => target.file).join(", ")}`,
		};
	}

	const mutationSet = {
		files: mutationFiles,
		targets: mutationTargets,
		protectedFiles: [
			".wind-tunnel",
			"experiments",
			".github",
			"app/nazare/registry",
		] as const,
	};

	const verificationPlan = [
		{
			tier: "structural" as const,
			intent: "Preserve declared capability policies and evidence contracts.",
		},
		{
			tier: "focused" as const,
			intent: "Run Nazare registry and capability-specific tests.",
		},
		{
			tier: "behavioral" as const,
			intent: "Run the experiment behavioral oracle.",
		},
		{
			tier: "full" as const,
			intent: "Run typecheck and production build.",
		},
	];

	return {
		ok: true as const,
		task: requestedChange,
		target: {
			id: capability.id,
			intent: capability.intent,
		},
		readSet: { files: sourceFiles },
		sourceFiles,
		mutationSet,
		executableBindings: capability.bindings,
		constraints: {
			policies: capability.policies,
			requiredEvidence: capability.evidence,
			surfaces: surfaces.map((surface) => ({
				id: surface?.id,
				constraints:
					surface?.kind === "carcass" ? (surface.constraints ?? []) : [],
			})),
			providers: providers.map(({ ref, entity }) => ({
				id: ref.id,
				action: ref.action,
				intent: entity?.intent,
			})),
		},
		verificationPlan,
		verify: [
			"Preserve every declared capability policy.",
			"Preserve every required evidence contract.",
			"Keep provider-specific behavior out of Carcass components.",
			"Keep every executable binding consistent with the capability invocation.",
			"Run pnpm lint.",
			"Run pnpm test.",
			"Run pnpm typecheck.",
			"Run pnpm build.",
		],
	};
}

export function planCapabilityChange(id: string, requestedChange: string) {
	return compileCapabilityTask(id, requestedChange);
}
