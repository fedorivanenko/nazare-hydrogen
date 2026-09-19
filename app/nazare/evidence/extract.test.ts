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

test("evidence extracts code-authored responsibility metadata", () => {
	const evidence = extract(`
		/**
		 * @nazare-id fn_1234567890abcdef1234567890abcdef
		 * @responsibility email.address.validate
		 */
		function validateEmail(email: string) { return email.length > 0; }
	`);
	const [validateEmail] = evidence.functions;

	assert.equal(
		validateEmail?.declarationId,
		"fn_1234567890abcdef1234567890abcdef",
	);
	assert.equal(validateEmail?.declaredResponsibility, "email.address.validate");
});

test("evidence extracts stamped type and constant identities", () => {
	const evidence = extract(`
		/** @nazare-id type_1234567890abcdef1234567890abcdef */
		type Contact = { id: string };
		/** @nazare-id const_1234567890abcdef1234567890abcdef */
		const CONTACTS_URL = "https://example.com/contacts";
	`);

	assert.deepEqual(
		evidence.identities.map(({ declarationId, name, kind }) => ({
			declarationId,
			name,
			kind,
		})),
		[
			{
				declarationId: "type_1234567890abcdef1234567890abcdef",
				name: "Contact",
				kind: "type",
			},
			{
				declarationId: "const_1234567890abcdef1234567890abcdef",
				name: "CONTACTS_URL",
				kind: "constant",
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
