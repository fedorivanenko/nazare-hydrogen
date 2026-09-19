import { generateText } from "ai";
import { z } from "zod";
import type { FileEvidence } from "../evidence/extract";

export const responsibilitySchema = z.object({
	function: z.string().min(1),
	primaryResponsibility: z.string().regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
	description: z.string().min(1),
	confidence: z.number().min(0).max(1),
	mixed: z.boolean(),
	evidence: z.array(z.string().min(1)).min(1),
});

export type Responsibility = z.infer<typeof responsibilitySchema>;

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
		new Set(
			functions.flatMap((item) =>
				item.owner ? [item.owner, item.qualifiedName] : [item.qualifiedName],
			),
		),
	);
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
	const candidates = functionCandidates(evidence);
	if (!candidates.includes(responsibility.function)) {
		throw new Error(
			`Model returned unsupported function "${responsibility.function}". Expected one of: ${candidates.join(", ")}`,
		);
	}

	return responsibility;
}

export async function inferResponsibility(
	evidence: FileEvidence,
	model = "openai/gpt-oss-120b",
): Promise<InferenceResult> {
	const apiKey =
		process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY;
	if (!apiKey) {
		throw new Error(
			"Set AI_GATEWAY_API_KEY (or VERCEL_AI_GATEWAY_API_KEY) before running Nazare responsibility inference.",
		);
	}
	process.env.AI_GATEWAY_API_KEY = apiKey;

	const candidates = functionCandidates(evidence);
	if (candidates.length === 0) {
		throw new Error("Evidence contains no callable function candidates.");
	}

	const startedAt = performance.now();
	const result = await generateText({
		model,
		system:
			"Analyze static code evidence. Return only one valid JSON object with no markdown or commentary. Never invent evidence.",
		prompt: `Infer the main business responsibility represented by this file.

The function field must exactly equal one of these candidates:
${candidates.map((candidate) => `- ${candidate}`).join("\n")}

For an exported object containing the main method, prefer the object owner over its qualified method name.
Helper functions are supporting evidence, not separate results.

Return exactly this shape:
{
  "function": "candidate from the list",
  "primaryResponsibility": "service.resource.action",
  "description": "short imperative description",
  "confidence": 0.0,
  "mixed": false,
  "evidence": ["facts grounded in the input"]
}

Input evidence:
${JSON.stringify(evidence, null, 2)}`,
	});
	const elapsedMs = performance.now() - startedAt;

	return {
		responsibility: parseResponsibility(result.text, evidence),
		elapsedMs,
		usage: {
			inputTokens: result.usage.inputTokens,
			outputTokens: result.usage.outputTokens,
			totalTokens: result.usage.totalTokens,
		},
	};
}
