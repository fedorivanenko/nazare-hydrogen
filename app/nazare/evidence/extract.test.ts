/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { Project } from "ts-morph";
import { extractFileEvidence } from "./extract";

function extract(source: string) {
	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile("/capability.ts", source);
	return extractFileEvidence(project, sourceFile.getFilePath());
}

test("evidence qualifies methods owned by exported objects", () => {
	const evidence = extract(`
		export const collectEmailSubscribers = {
			async execute(email: string) {
				return email;
			},
		};
	`);

	assert.deepEqual(
		evidence.functions.map(({ name, owner, qualifiedName, exported }) => ({
			name,
			owner,
			qualifiedName,
			exported,
		})),
		[
			{
				name: "execute",
				owner: "collectEmailSubscribers",
				qualifiedName: "collectEmailSubscribers.execute",
				exported: true,
			},
		],
	);
});

test("evidence leaves standalone function names unqualified", () => {
	const evidence = extract("export function validateEmail() { return true; }");
	const [validateEmail] = evidence.functions;

	assert.equal(validateEmail?.owner, null);
	assert.equal(validateEmail?.qualifiedName, "validateEmail");
	assert.equal(validateEmail?.exported, true);
});
