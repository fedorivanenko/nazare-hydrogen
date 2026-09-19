/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import type { FileEvidence } from "../evidence/extract";
import { functionCandidates, parseResponsibility } from "./infer";

const evidence = {
	schemaVersion: 2,
	sourceFile: "/capability.ts",
	imports: [],
	reExports: [],
	functions: [
		{
			name: "validateEmail",
			owner: null,
			qualifiedName: "validateEmail",
			kind: "function",
			exported: false,
			async: false,
			location: { line: 1, column: 1 },
			parameters: [],
			returnType: "boolean",
			calls: [],
			propertyAccesses: [],
			stringLiterals: [],
			throws: [],
			returns: [],
		},
		{
			name: "execute",
			owner: "collectEmailSubscribers",
			qualifiedName: "collectEmailSubscribers.execute",
			kind: "method",
			exported: true,
			async: true,
			location: { line: 2, column: 1 },
			parameters: [],
			returnType: "Promise<void>",
			calls: [],
			propertyAccesses: [],
			stringLiterals: [],
			throws: [],
			returns: [],
		},
	],
} as FileEvidence;

const response = {
	function: "collectEmailSubscribers",
	primaryResponsibility: "resend.contacts.create",
	description: "Create a contact in Resend",
	mixed: false,
	evidence: ["createResendContact"],
};

test("function candidates include exported object owners", () => {
	assert.deepEqual(functionCandidates(evidence), [
		"collectEmailSubscribers",
		"collectEmailSubscribers.execute",
	]);
});

test("responsibility accepts an evidenced exported object owner", () => {
	assert.deepEqual(
		parseResponsibility(JSON.stringify(response), evidence),
		response,
	);
});

test("responsibility rejects unsupported function names", () => {
	assert.throws(
		() =>
			parseResponsibility(
				JSON.stringify({ ...response, function: "inventedFunction" }),
				evidence,
			),
		/unsupported function "inventedFunction"/,
	);
});
