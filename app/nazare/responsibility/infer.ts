import { generateText, Output } from "ai";
import { z } from "zod";
import type { FileEvidence } from "../evidence/extract";

export const responsibilitySchema = z.object({
	function: z.string().min(1),
	primaryResponsibility: z
		.string()
		.regex(/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/),
	description: z.string().min(1),
	mixed: z.boolean(),
	evidence: z.array(z.string().min(1)).min(1),
});

export type Responsibility = z.infer<typeof responsibilitySchema>;

type EvidenceFact = {
	id: string;
	text: string;
};

export type InferenceResult = {
	responsibility: Responsibility;
	elapsedMs: number;
	usage: {
		inputTokens: number | undefined;
		outputTokens: number | undefined;
		totalTokens: number | undefined;
	};
};

export function functionCandidates(evidence: FileEvidence) {
	const exported = evidence.functions.filter((item) => item.exported);
	const functions = exported.length > 0 ? exported : evidence.functions;

	return Array.from(
		new Set(functions.map((item) => item.owner ?? item.qualifiedName)),
	);
}

export function primaryFunction(evidence: FileEvidence) {
	const candidates = functionCandidates(evidence);
	if (candidates.length === 0) {
		throw new Error("Evidence contains no callable function candidates.");
	}
	if (candidates.length > 1) {
		throw new Error(
			`Evidence has multiple public function candidates: ${candidates.join(", ")}. Split the file or select one explicitly.`,
		);
	}
	return candidates[0];
}

function identifierWords(identifier: string) {
	return identifier
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[^A-Za-z0-9]+/)
		.map((word) => word.toLowerCase())
		.filter(Boolean);
}

export function responsibilityCandidates(
	evidence: FileEvidence,
	functionName = primaryFunction(evidence),
) {
	const candidates: string[] = [];
	const words = identifierWords(functionName);
	const actions = new Set([
		"collect",
		"create",
		"delete",
		"fetch",
		"get",
		"list",
		"register",
		"remove",
		"send",
		"subscribe",
		"update",
		"validate",
	]);
	const [action, domain, ...resource] = words;
	if (action && domain && resource.length > 0 && actions.has(action)) {
		candidates.push(`${domain}.${resource.join("-")}.${action}`);
	}

	for (const item of evidence.functions) {
		for (const literal of item.stringLiterals) {
			const match = literal.match(
				/^provider\.([a-z0-9-]+)\.([a-z0-9-]+)\.([a-z0-9-]+)$/,
			);
			if (match) candidates.push(`${match[1]}.${match[2]}.${match[3]}`);
		}
	}

	return Array.from(new Set(candidates));
}

export function buildEvidenceFacts(evidence: FileEvidence): EvidenceFact[] {
	const facts: string[] = [
		`source:${evidence.sourceFile.split("/").at(-1) ?? evidence.sourceFile}`,
	];

	for (const item of evidence.imports) {
		const bindings = [
			item.defaultImport,
			item.namespaceImport,
			...item.namedImports,
		].filter((binding): binding is string => Boolean(binding));
		facts.push(`import:${bindings.join(",")} from ${item.module}`);
	}

	for (const item of evidence.reExports) {
		facts.push(
			`re-export:${item.exports.join(",")} from ${item.module ?? "self"}`,
		);
	}

	for (const item of evidence.functions) {
		facts.push(
			`function:${item.qualifiedName}; kind:${item.kind}; exported:${item.exported}; async:${item.async}`,
		);
		for (const call of item.calls) {
			facts.push(`call:${item.qualifiedName} -> ${call.callee}`);
		}
		for (const literal of item.stringLiterals) {
			facts.push(`string:${item.qualifiedName} -> ${JSON.stringify(literal)}`);
		}
	}

	return facts.map((text, index) => ({ id: `F${index + 1}`, text }));
}

function normalizeDescription(description: string) {
	const trimmed = description.trim();
	const capitalized = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
	return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function validateResponsibilityLabel(label: string) {
	const genericSegments = new Set([
		"action",
		"domain",
		"general",
		"resource",
		"service",
		"unknown",
	]);
	const segments = label.split(".");
	if (segments.some((segment) => genericSegments.has(segment))) {
		throw new Error(`Model returned generic responsibility label "${label}".`);
	}
}

function unwrapJson(text: string) {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	return fenced?.[1] ?? trimmed;
}

export function parseResponsibility(
	text: string,
	evidence: FileEvidence,
): Responsibility {
	let value: unknown;
	try {
		value = JSON.parse(unwrapJson(text));
	} catch (error) {
		throw new Error(
			`Model returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const responsibility = responsibilitySchema.parse(value);
	const expectedFunction = primaryFunction(evidence);
	if (responsibility.function !== expectedFunction) {
		throw new Error(
			`Model returned unsupported function "${responsibility.function}". Expected: ${expectedFunction}`,
		);
	}
	validateResponsibilityLabel(responsibility.primaryResponsibility);

	return responsibility;
}

export async function inferResponsibility(
	evidence: FileEvidence,
	model = "alibaba/qwen3-coder-30b-a3b",
): Promise<InferenceResult> {
	const apiKey =
		process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY;
	if (!apiKey) {
		throw new Error(
			"Set AI_GATEWAY_API_KEY (or VERCEL_AI_GATEWAY_API_KEY) before running Nazare responsibility inference.",
		);
	}
	process.env.AI_GATEWAY_API_KEY = apiKey;

	const functionName = primaryFunction(evidence);
	const responsibilityLabels = responsibilityCandidates(evidence, functionName);
	const facts = buildEvidenceFacts(evidence);
	const factIds = facts.map((fact) => fact.id) as [string, ...string[]];
	const responsibilityLabelSchema =
		responsibilityLabels.length > 0
			? z.enum(responsibilityLabels as [string, ...string[]])
			: z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/);
	const outputSchema = z.strictObject({
		primaryResponsibility: responsibilityLabelSchema,
		description: z.string().min(1),
		mixed: z.boolean(),
		evidence: z.array(z.enum(factIds)).min(2).max(5),
	});

	const startedAt = performance.now();
	const result = await generateText({
		model,
		temperature: 0,
		output: Output.object({ schema: outputSchema }),
		system:
			"Classify one code symbol from supplied static facts. Use only supplied facts. Do not infer unsupported implementation details.",
		prompt: `Classify the primary business responsibility of ${functionName}.

Allowed responsibility labels:
${responsibilityLabels.length > 0 ? responsibilityLabels.map((label) => `- ${label}`).join("\n") : "- Infer one exact domain.resource.action label from the facts."}

Rules:
- Select the label describing the symbol's own business outcome, not a lower-level dependency it calls.
- Use exactly three lowercase segments: domain.resource.action.
- Prefer an explicitly named vendor or service over generic domains such as communication.
- Never copy generic placeholders such as service.resource.action or domain.resource.action.
- description must be one short imperative sentence.
- mixed is true only when the symbol performs multiple unrelated business outcomes. Validation, error handling, and support work do not make it mixed.
- evidence must contain the 2–5 strongest fact IDs that directly support the classification.

Facts:
${facts.map((fact) => `${fact.id} ${fact.text}`).join("\n")}`,
	});
	const elapsedMs = performance.now() - startedAt;
	const output = result.output;
	validateResponsibilityLabel(output.primaryResponsibility);
	const factsById = new Map(facts.map((fact) => [fact.id, fact.text]));

	return {
		responsibility: responsibilitySchema.parse({
			function: functionName,
			primaryResponsibility: output.primaryResponsibility,
			description: normalizeDescription(output.description),
			mixed: output.mixed,
			evidence: output.evidence.map((id) => factsById.get(id)),
		}),
		elapsedMs,
		usage: {
			inputTokens: result.usage.inputTokens,
			outputTokens: result.usage.outputTokens,
			totalTokens: result.usage.totalTokens,
		},
	};
}
