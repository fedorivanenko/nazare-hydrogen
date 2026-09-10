import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
import { listCapabilities, listEntities } from "../app/nazare/registry/index";

const outputPath =
	process.env.WIND_TUNNEL_SUBJECT_OUTPUT ??
	"/workspace/.wind-tunnel-subject.json";
const entities = listEntities();
const capabilities = listCapabilities();

const sourceFiles = Array.from(
	new Set(entities.flatMap((entity) => entity.sourceFiles ?? [])),
).sort();

type IndexedSymbol = {
	name: string;
	kind: string;
	start: number;
	end: number;
};

function declarationName(node: ts.Node) {
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

function indexSource(source: ts.SourceFile) {
	const symbols: IndexedSymbol[] = [];
	for (const node of source.statements) {
		const name = declarationName(node);
		if (name) {
			symbols.push({
				name,
				kind: ts.SyntaxKind[node.kind],
				start: node.getStart(source),
				end: node.getEnd(),
			});
			continue;
		}
		if (!ts.isVariableStatement(node)) continue;
		for (const declaration of node.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name)) continue;
			symbols.push({
				name: declaration.name.text,
				kind: "VariableDeclaration",
				start: declaration.getStart(source),
				end: declaration.getEnd(),
			});
		}
	}
	return symbols;
}

const symbolIndex: Record<string, IndexedSymbol[]> = {};
for (const sourceFile of sourceFiles) {
	if (!/\.[cm]?[jt]sx?$/.test(sourceFile)) continue;
	try {
		const sourceText = await readFile(sourceFile, "utf8");
		const scriptKind = sourceFile.endsWith("x")
			? ts.ScriptKind.TSX
			: ts.ScriptKind.TS;
		const parsed = ts.createSourceFile(
			sourceFile,
			sourceText,
			ts.ScriptTarget.Latest,
			true,
			scriptKind,
		);
		symbolIndex[sourceFile] = indexSource(parsed);
	} catch {
		symbolIndex[sourceFile] = [];
	}
}

const compiled = {
	version: 1,
	generatedAt: new Date().toISOString(),
	capabilities,
	entities,
	sourceFiles,
	symbolIndex,
};

await writeFile(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, "utf8");
process.stdout.write(
	JSON.stringify({
		outputPath,
		capabilityCount: capabilities.length,
		entityCount: entities.length,
		sourceFileCount: sourceFiles.length,
		symbolCount: Object.values(symbolIndex).reduce(
			(total, symbols) => total + symbols.length,
			0,
		),
	}),
);
