import {
	type ArrowFunction,
	type FunctionDeclaration,
	type FunctionExpression,
	type MethodDeclaration,
	Node,
	Project,
	type SourceFile,
	SyntaxKind,
} from "ts-morph";

type FunctionLike =
	| FunctionDeclaration
	| MethodDeclaration
	| ArrowFunction
	| FunctionExpression;

type Location = {
	line: number;
	column: number;
};

type CallFact = {
	callee: string;
	location: Location;
};

type FunctionEvidence = {
	name: string;
	owner: string | null;
	qualifiedName: string;
	declarationId: string | null;
	declaredResponsibility: string | null;
	kind: "function" | "method" | "arrow" | "function-expression";
	exported: boolean;
	async: boolean;
	location: Location;
	parameters: Array<{
		name: string;
		type: string;
		optional: boolean;
	}>;
	returnType: string;
	calls: CallFact[];
	propertyAccesses: string[];
	stringLiterals: string[];
	throws: Array<{
		expression: string;
		location: Location;
	}>;
	returns: Array<{
		expression: string | null;
		location: Location;
	}>;
};

export type FileEvidence = {
	schemaVersion: 2;
	sourceFile: string;
	imports: Array<{
		module: string;
		defaultImport: string | null;
		namespaceImport: string | null;
		namedImports: string[];
	}>;
	reExports: Array<{
		module: string | null;
		exports: string[];
	}>;
	functions: FunctionEvidence[];
};

function location(sourceFile: SourceFile, node: Node): Location {
	return sourceFile.getLineAndColumnAtPos(node.getStart());
}

function functionName(node: FunctionLike): string {
	if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
		return node.getName() ?? "<anonymous>";
	}

	if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
		const parent = node.getParent();
		if (Node.isVariableDeclaration(parent)) return parent.getName();
		if (Node.isPropertyAssignment(parent)) return parent.getName();
		if (Node.isPropertyDeclaration(parent)) return parent.getName();
	}

	return "<anonymous>";
}

function functionOwner(node: FunctionLike): string | null {
	if (Node.isMethodDeclaration(node)) {
		const classDeclaration = node.getFirstAncestorByKind(
			SyntaxKind.ClassDeclaration,
		);
		if (classDeclaration) return classDeclaration.getName() ?? null;
	}

	const parent = node.getParent();
	if (
		Node.isMethodDeclaration(node) ||
		Node.isPropertyAssignment(parent) ||
		Node.isPropertyDeclaration(parent)
	) {
		return (
			node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getName() ??
			null
		);
	}

	return null;
}

function functionMetadata(node: FunctionLike) {
	const container =
		node.getFirstAncestorByKind(SyntaxKind.VariableStatement) ?? node;
	const text = container.getFullText();
	return {
		declarationId: text.match(/@nazare-id\s+([^\s*]+)/)?.[1] ?? null,
		declaredResponsibility:
			text.match(/@responsibility\s+([^\s*]+)/)?.[1] ?? null,
	};
}

function functionKind(node: FunctionLike): FunctionEvidence["kind"] {
	if (Node.isFunctionDeclaration(node)) return "function";
	if (Node.isMethodDeclaration(node)) return "method";
	if (Node.isArrowFunction(node)) return "arrow";
	return "function-expression";
}

function isExported(node: FunctionLike): boolean {
	if (Node.isFunctionDeclaration(node)) return node.isExported();

	const variableStatement = node.getFirstAncestorByKind(
		SyntaxKind.VariableStatement,
	);
	if (variableStatement) return variableStatement.isExported();

	return (
		node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)?.isExported() ??
		false
	);
}

function extractFunction(
	sourceFile: SourceFile,
	node: FunctionLike,
): FunctionEvidence {
	const calls = node
		.getDescendantsOfKind(SyntaxKind.CallExpression)
		.map((call) => ({
			callee: call.getExpression().getText(),
			location: location(sourceFile, call),
		}));

	const propertyAccesses = Array.from(
		new Set(
			node
				.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
				.map((access) => access.getText()),
		),
	).sort();

	const stringLiterals = Array.from(
		new Set(
			node
				.getDescendantsOfKind(SyntaxKind.StringLiteral)
				.map((literal) => literal.getLiteralValue()),
		),
	).sort();

	const throws = node
		.getDescendantsOfKind(SyntaxKind.ThrowStatement)
		.map((statement) => ({
			expression: statement.getExpression()?.getText() ?? "",
			location: location(sourceFile, statement),
		}));

	const returns = node
		.getDescendantsOfKind(SyntaxKind.ReturnStatement)
		.map((statement) => ({
			expression: statement.getExpression()?.getText() ?? null,
			location: location(sourceFile, statement),
		}));

	const name = functionName(node);
	const owner = functionOwner(node);
	const metadata = functionMetadata(node);

	return {
		name,
		owner,
		qualifiedName: owner ? `${owner}.${name}` : name,
		...metadata,
		kind: functionKind(node),
		exported: isExported(node),
		async: node.isAsync(),
		location: location(sourceFile, node),
		parameters: node.getParameters().map((parameter) => ({
			name: parameter.getName(),
			type: parameter.getType().getText(parameter),
			optional: parameter.isOptional(),
		})),
		returnType: node.getReturnType().getText(node),
		calls,
		propertyAccesses,
		stringLiterals,
		throws,
		returns,
	};
}

export function createProject(tsConfigFilePath = "tsconfig.json") {
	return new Project({
		tsConfigFilePath,
		skipAddingFilesFromTsConfig: false,
	});
}

export function extractFileEvidence(
	project: Project,
	filePath: string,
): FileEvidence {
	const sourceFile =
		project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);

	const functionLikes: FunctionLike[] = [
		...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
		...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
		...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
		...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
	].sort((a, b) => a.getStart() - b.getStart());

	return {
		schemaVersion: 2,
		sourceFile: sourceFile.getFilePath(),
		imports: sourceFile.getImportDeclarations().map((declaration) => ({
			module: declaration.getModuleSpecifierValue(),
			defaultImport: declaration.getDefaultImport()?.getText() ?? null,
			namespaceImport: declaration.getNamespaceImport()?.getText() ?? null,
			namedImports: declaration
				.getNamedImports()
				.map((namedImport) => namedImport.getText()),
		})),
		reExports: sourceFile.getExportDeclarations().map((declaration) => ({
			module: declaration.getModuleSpecifierValue() ?? null,
			exports: declaration
				.getNamedExports()
				.map((namedExport) => namedExport.getText()),
		})),
		functions: functionLikes.map((node) => extractFunction(sourceFile, node)),
	};
}
