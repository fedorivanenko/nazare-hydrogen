import { randomUUID } from "node:crypto";
import {
	Node,
	type SourceFile,
	SyntaxKind,
	type VariableDeclaration,
} from "ts-morph";

export type IdentityPrefix = "fn" | "type" | "const";

export type StampedDeclaration = {
	id: string;
	name: string;
	prefix: IdentityPrefix;
};

type StampTarget = {
	container: Node;
	name: string;
	prefix: IdentityPrefix;
};

function variableTarget(declaration: VariableDeclaration): StampTarget | null {
	const statement = declaration.getFirstAncestorByKind(
		SyntaxKind.VariableStatement,
	);
	if (!statement || statement.getDeclarations().length !== 1) return null;

	const initializer = declaration.getInitializer();
	if (
		initializer &&
		(Node.isArrowFunction(initializer) ||
			Node.isFunctionExpression(initializer))
	) {
		return { container: statement, name: declaration.getName(), prefix: "fn" };
	}

	if (
		/^[A-Z][A-Z0-9_]*$/.test(declaration.getName()) ||
		statement.isExported()
	) {
		return {
			container: statement,
			name: declaration.getName(),
			prefix: "const",
		};
	}

	return null;
}

function stampTargets(sourceFile: SourceFile) {
	const targets: StampTarget[] = [];
	const seen = new Set<Node>();
	const add = (target: StampTarget | null) => {
		if (!target || seen.has(target.container)) return;
		seen.add(target.container);
		targets.push(target);
	};

	for (const declaration of sourceFile.getDescendantsOfKind(
		SyntaxKind.FunctionDeclaration,
	)) {
		add({
			container: declaration,
			name: declaration.getName() ?? "anonymous",
			prefix: "fn",
		});
	}
	for (const declaration of sourceFile.getDescendantsOfKind(
		SyntaxKind.MethodDeclaration,
	)) {
		add({ container: declaration, name: declaration.getName(), prefix: "fn" });
	}
	for (const declaration of sourceFile.getDescendantsOfKind(
		SyntaxKind.VariableDeclaration,
	)) {
		add(variableTarget(declaration));
	}
	for (const declaration of [
		...sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration),
		...sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration),
		...sourceFile.getDescendantsOfKind(SyntaxKind.TypeAliasDeclaration),
		...sourceFile.getDescendantsOfKind(SyntaxKind.EnumDeclaration),
	]) {
		add({
			container: declaration,
			name: declaration.getName() ?? "anonymous",
			prefix: "type",
		});
	}

	return targets;
}

function declaredIdentity(node: Node) {
	if (!Node.isJSDocable(node)) return null;
	for (const doc of node.getJsDocs()) {
		const tag = doc.getTags().find((item) => item.getTagName() === "nazare-id");
		const identity = tag?.getCommentText()?.trim();
		if (identity) return identity;
	}
	return null;
}

export function stampSourceFile(
	sourceFile: SourceFile,
	createId = (prefix: IdentityPrefix) =>
		`${prefix}_${randomUUID().replaceAll("-", "")}`,
) {
	const stamped: StampedDeclaration[] = [];

	for (const target of stampTargets(sourceFile)) {
		if (declaredIdentity(target.container)) continue;
		if (!Node.isJSDocable(target.container)) continue;
		const id = createId(target.prefix);
		target.container.addJsDoc({
			tags: [{ tagName: "nazare-id", text: id }],
		});
		stamped.push({ id, name: target.name, prefix: target.prefix });
	}

	return stamped;
}
