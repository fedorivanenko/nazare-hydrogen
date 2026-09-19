import { relative } from "node:path";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { FileEvidence } from "../evidence/extract";

type FunctionEvidence = FileEvidence["functions"][number];

const responsibilityOperations = [
	"create",
	"read",
	"update",
	"delete",
	"validate",
	"transform",
	"execute",
] as const;

const responsibilityOperationSchema = z.enum(responsibilityOperations);

export const responsibilityIdSchema = z
	.string()
	.regex(
		/^[a-z0-9-]+\.[a-z0-9-]+\.(?:create|read|update|delete|validate|transform|execute)$/,
	);

export const functionCallSchema = z.object({
	callee: z.string().min(1),
	line: z.number().int().positive(),
	column: z.number().int().positive(),
	targetFunctionId: z.string().min(1).nullable(),
	responsibility: responsibilityIdSchema,
});

export const functionResponsibilitySchema = z.object({
	functionId: z.string().min(1),
	function: z.string().min(1),
	responsibility: responsibilityIdSchema,
	description: z.string().min(1),
	declaration: z.object({
		kind: z.enum(["function", "method", "arrow", "function-expression"]),
		exported: z.boolean(),
		async: z.boolean(),
		line: z.number().int().positive(),
		column: z.number().int().positive(),
	}),
	calls: z.array(functionCallSchema),
});

export const responsibilityReportSchema = z.object({
	schemaVersion: z.literal(3),
	sourceFile: z.string().min(1),
	functions: z.array(functionResponsibilitySchema),
});

export type ResponsibilityReport = z.infer<typeof responsibilityReportSchema>;

export type InferenceResult = {
	responsibility: ResponsibilityReport;
	elapsedMs: number;
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
};

const actionOperations = new Map<
	string,
	(typeof responsibilityOperations)[number]
>([
	["build", "create"],
	["collect", "execute"],
	["create", "create"],
	["decode", "transform"],
	["delete", "delete"],
	["encode", "transform"],
	["fetch", "read"],
	["format", "transform"],
	["get", "read"],
	["invoke", "execute"],
	["list", "read"],
	["normalize", "transform"],
	["parse", "transform"],
	["read", "read"],
	["register", "create"],
	["remove", "delete"],
	["send", "execute"],
	["serialize", "transform"],
	["subscribe", "create"],
	["test", "validate"],
	["trim", "transform"],
	["update", "update"],
	["validate", "validate"],
]);

const knownCallResponsibilities = new Map<string, string>([
	["EMAIL_PATTERN.test", "email.address.validate"],
	['policyImplementations["valid-email"]', "email.address.validate"],
	["fetch", "http.request.execute"],
	["JSON.stringify", "json.value.transform"],
	["response.json", "http.response.transform"],
	["response.text", "http.response.read"],
	["email.trim", "email.address.transform"],
]);

function identifierWords(identifier: string) {
	return identifier
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[^A-Za-z0-9]+/)
		.map((word) => word.toLowerCase())
		.filter(Boolean);
}

function singularize(word: string) {
	if (word.endsWith("ies") && word.length > 3) return `${word.slice(0, -3)}y`;
	if (word.endsWith("sses")) return word.slice(0, -2);
	if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
		return word.slice(0, -1);
	}
	return word;
}

const semanticStopWords = new Set([
	...actionOperations.keys(),
	...responsibilityOperations,
	"api",
	"as",
	"async",
	"await",
	"boolean",
	"const",
	"false",
	"function",
	"id",
	"new",
	"null",
	"number",
	"object",
	"promise",
	"provider",
	"string",
	"true",
	"type",
	"undefined",
	"void",
]);

function semanticWords(value: string) {
	return identifierWords(value)
		.map(singularize)
		.filter((word) => !semanticStopWords.has(word) && !/^\d+$/.test(word));
}

export function semanticCandidates(functionEvidence: FunctionEvidence) {
	const sources = [
		functionEvidence.name,
		functionEvidence.owner ?? "",
		functionEvidence.returnType,
		...functionEvidence.parameters.flatMap((parameter) => [
			parameter.name,
			parameter.type,
		]),
		...functionEvidence.calls.flatMap((call) => {
			const known = knownCallResponsibilities.get(call.callee);
			return known ? [call.callee, known] : [call.callee];
		}),
		...functionEvidence.stringLiterals,
		...functionEvidence.throws.map((statement) => statement.expression),
		...functionEvidence.returns.map((statement) => statement.expression ?? ""),
	];
	const candidates = new Set<string>();

	for (const source of sources) {
		for (const word of semanticWords(source)) candidates.add(word);
	}

	return Array.from(candidates).filter((candidate) =>
		/^[a-z][a-z0-9-]*$/.test(candidate),
	);
}

export function identifierResponsibility(identifier: string) {
	const words = identifierWords(identifier);
	if (words.length < 3) return null;

	const first = words[0];
	const firstOperation = first ? actionOperations.get(first) : null;
	if (firstOperation) {
		return `${words[1]}.${words.slice(2).join("-")}.${firstOperation}`;
	}

	const last = words.at(-1);
	const lastOperation = last ? actionOperations.get(last) : null;
	if (lastOperation) {
		return `${words[0]}.${words.slice(1, -1).join("-")}.${lastOperation}`;
	}

	return null;
}

function fallbackResponsibility(identifier: string) {
	const words = identifierWords(identifier);
	const resource = words.at(-1) ?? "function";
	return `software.${resource}.execute`;
}

function sourceFilePath(evidence: FileEvidence) {
	const path = relative(process.cwd(), evidence.sourceFile).replaceAll(
		"\\",
		"/",
	);
	return path.startsWith("../") ? evidence.sourceFile : path;
}

function functionId(sourceFile: string, functionEvidence: FunctionEvidence) {
	return (
		functionEvidence.declarationId ??
		`${sourceFile}#${functionEvidence.qualifiedName}`
	);
}

function inferredCallResponsibility(callee: string) {
	return (
		knownCallResponsibilities.get(callee) ??
		identifierResponsibility(callee) ??
		fallbackResponsibility(callee)
	);
}

function localFunctionTarget(
	callee: string,
	functions: FunctionEvidence[],
): FunctionEvidence | null {
	const qualifiedMatches = functions.filter(
		(item) => item.qualifiedName === callee,
	);
	if (qualifiedMatches.length === 1) return qualifiedMatches[0] ?? null;

	const nameMatches = functions.filter((item) => item.name === callee);
	return nameMatches.length === 1 ? (nameMatches[0] ?? null) : null;
}

export function extractFunctionCalls(
	evidence: FileEvidence,
	functionEvidence: FunctionEvidence,
	declarationResponsibilities: ReadonlyMap<string, string>,
) {
	const sourceFile = sourceFilePath(evidence);
	return functionEvidence.calls.map((call) => {
		const target = localFunctionTarget(call.callee, evidence.functions);
		const targetResponsibility = target
			? declarationResponsibilities.get(target.qualifiedName)
			: null;
		if (target && !targetResponsibility) {
			throw new Error(
				`Missing inferred responsibility for ${target.qualifiedName}.`,
			);
		}
		return {
			callee: call.callee,
			line: call.location.line,
			column: call.location.column,
			targetFunctionId: target ? functionId(sourceFile, target) : null,
			responsibility:
				targetResponsibility ?? inferredCallResponsibility(call.callee),
		};
	});
}

function normalizeDescription(description: string) {
	const trimmed = description.trim();
	if (!trimmed || trimmed.length > 240 || trimmed.includes("','")) {
		throw new Error("Description is malformed or too long.");
	}
	const capitalized = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
	return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function functionFacts(
	evidence: FileEvidence,
	functionEvidence: FunctionEvidence,
) {
	return [
		`source:${sourceFilePath(evidence)}`,
		`function:${functionEvidence.qualifiedName}`,
		`kind:${functionEvidence.kind}`,
		`exported:${functionEvidence.exported}`,
		`async:${functionEvidence.async}`,
		`returns:${functionEvidence.returnType}`,
		...functionEvidence.calls.map((call) => `call:${call.callee}`),
		...functionEvidence.stringLiterals.map(
			(literal) => `string:${JSON.stringify(literal)}`,
		),
		...functionEvidence.throws.map(
			(statement) => `throw:${statement.expression}`,
		),
		...functionEvidence.returns.map(
			(statement) => `return:${statement.expression ?? "void"}`,
		),
	];
}

function validateInferredResponsibility(responsibility: string) {
	const generic = new Set([
		"action",
		"communication",
		"domain",
		"function",
		"general",
		"handler",
		"integration",
		"resource",
		"service",
		"software",
		"unknown",
		"user-account",
	]);
	const segments = responsibility.split(".");
	if (segments.some((segment) => generic.has(segment))) {
		throw new Error(
			`Model returned generic responsibility ID "${responsibility}".`,
		);
	}
	if (
		!responsibilityOperations.includes(
			segments[2] as (typeof responsibilityOperations)[number],
		)
	) {
		throw new Error(
			`Responsibility "${responsibility}" must end with one operation: ${responsibilityOperations.join(", ")}.`,
		);
	}
}

async function inferFunctionDeclaration(
	evidence: FileEvidence,
	functionEvidence: FunctionEvidence,
	model: string,
) {
	const facts = functionFacts(evidence, functionEvidence).map(
		(text, index) => ({
			id: `F${index + 1}`,
			text,
		}),
	);
	const behaviorFactIds = facts
		.filter((fact) => /^(call|string|throw|return):/.test(fact.text))
		.map((fact) => fact.id) as [string, ...string[]];
	if (behaviorFactIds.length === 0) {
		throw new Error(
			`Cannot infer ${functionEvidence.qualifiedName} without implementation behavior facts.`,
		);
	}
	if (functionEvidence.declaredResponsibility) {
		const responsibility = responsibilityIdSchema.parse(
			functionEvidence.declaredResponsibility,
		);
		const result = await generateText({
			model,
			abortSignal: AbortSignal.timeout(30_000),
			temperature: 0,
			output: Output.object({
				schema: z.strictObject({
					description: z.string().min(1),
					evidence: z.array(z.enum(behaviorFactIds)).min(1).max(5),
				}),
			}),
			system:
				"Describe one software function from AST-derived implementation facts. The responsibility ID is code-authored and immutable.",
			prompt: `Write one concise imperative sentence describing ${functionEvidence.qualifiedName}.
Responsibility ID: ${responsibility}
Facts:
${facts.map((fact) => `${fact.id} ${fact.text}`).join("\n")}`,
		});
		return {
			responsibility,
			description: normalizeDescription(result.output.description),
			usage: {
				inputTokens: result.usage.inputTokens ?? 0,
				outputTokens: result.usage.outputTokens ?? 0,
				totalTokens: result.usage.totalTokens ?? 0,
			},
		};
	}
	const nounCandidates = semanticCandidates(functionEvidence);
	if (nounCandidates.length === 0) {
		throw new Error(
			`Cannot infer ${functionEvidence.qualifiedName} without semantic noun candidates.`,
		);
	}
	const nounSchema = z.enum(nounCandidates as [string, ...string[]]);
	const output = Output.object({
		schema: z.strictObject({
			subject: nounSchema,
			object: nounSchema,
			operation: responsibilityOperationSchema,
			description: z.string().min(1),
			evidence: z.array(z.enum(behaviorFactIds)).min(1).max(5),
		}),
	});
	const basePrompt = `Infer what ${functionEvidence.qualifiedName} actually does.

Allowed subject/object terms (select exactly; do not invent):
${nounCandidates.map((candidate) => `- ${candidate}`).join("\n")}

Rules:
- Derive behavior from implementation facts, not naming alone.
- Choose the function's successful-path software outcome, not a guard, validation step, serializer, or parser it merely calls.
- Calls retain their own responsibilities separately; declaration responsibility must summarize what the whole function delivers.
- Return values and externally observable side effects outweigh early guards.
- Choose one subject and one object exactly from the allowed terms, plus exactly one operation.
- subject is the broader system/domain/value family; object is the specific entity/value/result acted upon.
- Do not select the same term for both subject and object.
- Prefer email/address for email validation or normalization, email/subscriber for subscriber collection, resend/contact for direct Resend contact operations, and email/result or subscriber/result for returned result objects when those terms are available.
- operation must be one of: create, read, update, delete, validate, transform, execute.
- create produces a new entity/value/result; read retrieves or observes existing data; update mutates existing state; delete removes state; validate checks an invariant; transform changes representation; execute coordinates or performs a process.
- Use a vendor subject only when implementation directly invokes or decodes that vendor's API; never inherit a vendor from file path or function name alone.
- For generic transformations or validation, use the transformed technical value as subject/object (for example email/address/transform).
- Otherwise prefer the concrete API/system proven by calls, URLs, literals, or response types over categories such as communication or integration.
- Never use generic subjects or objects such as software, service, handler, function, or resource.
- description must be one concise imperative sentence.
- evidence must select 1–5 implementation facts directly supporting both fields.

Facts:
${facts.map((fact) => `${fact.id} ${fact.text}`).join("\n")}`;
	const factsById = new Map(facts.map((fact) => [fact.id, fact.text]));
	let previousError = "";

	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const result = await generateText({
				model,
				abortSignal: AbortSignal.timeout(30_000),
				temperature: 0,
				output,
				system:
					"Infer one function's software responsibility from AST-derived implementation facts. Function names are weak hints; calls, literals, returns, throws, and types are stronger evidence.",
				prompt: `${basePrompt}${previousError ? `\n\nPrevious output was rejected: ${previousError}\nCorrect that error.` : ""}`,
			});
			if (result.output.subject === result.output.object) {
				throw new Error("Subject and object must differ.");
			}
			const responsibility = `${result.output.subject}.${result.output.object}.${result.output.operation}`;
			validateInferredResponsibility(responsibility);
			const description = normalizeDescription(result.output.description);
			const hasBehaviorEvidence = result.output.evidence.some((id) =>
				/^(call|string|throw|return):/.test(factsById.get(id) ?? ""),
			);
			if (!hasBehaviorEvidence) {
				throw new Error("No implementation behavior fact was selected.");
			}

			return {
				responsibility,
				description,
				usage: {
					inputTokens: result.usage.inputTokens ?? 0,
					outputTokens: result.usage.outputTokens ?? 0,
					totalTokens: result.usage.totalTokens ?? 0,
				},
			};
		} catch (error) {
			previousError = error instanceof Error ? error.message : String(error);
			if (attempt === 3) {
				throw new Error(
					`Failed to infer ${functionEvidence.qualifiedName} after ${attempt} attempts: ${previousError}`,
				);
			}
		}
	}

	throw new Error(`Failed to infer ${functionEvidence.qualifiedName}.`);
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

	const startedAt = performance.now();
	const sourceFile = sourceFilePath(evidence);
	const inferredDeclarations = [];
	const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

	for (const functionEvidence of evidence.functions) {
		const inferred = await inferFunctionDeclaration(
			evidence,
			functionEvidence,
			model,
		);
		inferredDeclarations.push({ functionEvidence, inferred });
		usage.inputTokens += inferred.usage.inputTokens;
		usage.outputTokens += inferred.usage.outputTokens;
		usage.totalTokens += inferred.usage.totalTokens;
	}

	const declarationResponsibilities = new Map(
		inferredDeclarations.map(({ functionEvidence, inferred }) => [
			functionEvidence.qualifiedName,
			inferred.responsibility,
		]),
	);
	const functions = inferredDeclarations.map(
		({ functionEvidence, inferred }) => ({
			functionId: functionId(sourceFile, functionEvidence),
			function: functionEvidence.qualifiedName,
			responsibility: inferred.responsibility,
			description: inferred.description,
			declaration: {
				kind: functionEvidence.kind,
				exported: functionEvidence.exported,
				async: functionEvidence.async,
				line: functionEvidence.location.line,
				column: functionEvidence.location.column,
			},
			calls: extractFunctionCalls(
				evidence,
				functionEvidence,
				declarationResponsibilities,
			),
		}),
	);

	return {
		responsibility: responsibilityReportSchema.parse({
			schemaVersion: 3,
			sourceFile,
			functions,
		}),
		elapsedMs: performance.now() - startedAt,
		usage,
	};
}
