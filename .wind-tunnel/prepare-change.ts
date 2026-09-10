import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import {
	compileCapabilityTask,
	findEntities,
} from "../app/nazare/registry/agent";

const input = JSON.parse(
	await new Promise<string>((resolve, reject) => {
		let value = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			value += chunk;
		});
		process.stdin.on("end", () => resolve(value));
		process.stdin.on("error", reject);
	}),
) as { task?: unknown };

const task = typeof input.task === "string" ? input.task.trim() : "";
if (!task) throw new Error("Bootstrap input.task must be a non-empty string");
const capability = findEntities(task, "capability")[0];
if (!capability || capability.kind !== "capability")
	throw new Error("No Nazare capability matched requested change");
const compiled = compileCapabilityTask(capability.id, task);
if (!compiled.ok) throw new Error(compiled.error);

function topLevelSymbolName(node: ts.Statement) {
	if (
		ts.isFunctionDeclaration(node) ||
		ts.isClassDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isEnumDeclaration(node)
	)
		return node.name?.text ?? null;
	return null;
}

async function resolveMutationRanges() {
	const ranges: Array<{
		file: string;
		symbol: string;
		startLine: number;
		endLine: number;
	}> = [];
	for (const target of compiled.mutationSet.targets) {
		const content = await readFile(target.file, "utf8");
		const source = ts.createSourceFile(
			target.file,
			content,
			ts.ScriptTarget.Latest,
			true,
			target.file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const wanted = new Set(target.symbols);
		for (const statement of source.statements) {
			const directName = topLevelSymbolName(statement);
			if (directName && wanted.has(directName)) {
				const start = source.getLineAndCharacterOfPosition(statement.getStart(source));
				const end = source.getLineAndCharacterOfPosition(statement.getEnd());
				ranges.push({
					file: target.file,
					symbol: directName,
					startLine: start.line + 1,
					endLine: end.line + 1,
				});
				wanted.delete(directName);
				continue;
			}
			if (!ts.isVariableStatement(statement)) continue;
			for (const declaration of statement.declarationList.declarations) {
				if (!ts.isIdentifier(declaration.name)) continue;
				if (!wanted.has(declaration.name.text)) continue;
				const start = source.getLineAndCharacterOfPosition(statement.getStart(source));
				const end = source.getLineAndCharacterOfPosition(statement.getEnd());
				ranges.push({
					file: target.file,
					symbol: declaration.name.text,
					startLine: start.line + 1,
					endLine: end.line + 1,
				});
				wanted.delete(declaration.name.text);
			}
		}
		if (wanted.size)
			throw new Error(
				`Could not resolve mutation symbols in ${target.file}: ${[...wanted].join(", ")}`,
			);
	}
	return ranges;
}

const mutationRanges = await resolveMutationRanges();
const relatedTestFiles = ["app/nazare/registry/index.test.ts"];
const contextFiles = Array.from(
	new Set([...compiled.sourceFiles, ...relatedTestFiles]),
);
let remainingExcerptBytes = 18_000;
const sourceExcerpts = [];
for (const sourceFile of contextFiles) {
	if (remainingExcerptBytes <= 0) break;
	const absolutePath = path.resolve(process.cwd(), sourceFile);
	if (!absolutePath.startsWith(`${path.resolve(process.cwd())}${path.sep}`))
		continue;
	try {
		const content = await readFile(absolutePath, "utf8");
		const excerpt = content.slice(0, Math.min(6_000, remainingExcerptBytes));
		remainingExcerptBytes -= Buffer.byteLength(excerpt);
		sourceExcerpts.push({
			path: sourceFile,
			content: excerpt,
			truncated: excerpt.length < content.length,
		});
	} catch {}
}

process.stdout.write(
	JSON.stringify({
		selectedCapability: { id: capability.id, intent: capability.intent },
		mutationSet: { ...compiled.mutationSet, ranges: mutationRanges },
		verificationPlan: compiled.verificationPlan,
		compiledContext: compiled,
		sourceExcerpts,
		relatedTestFiles,
		evaluatorVerification: [
			"pnpm lint",
			"pnpm test",
			"pnpm typecheck",
			"pnpm build",
		],
	}),
);
