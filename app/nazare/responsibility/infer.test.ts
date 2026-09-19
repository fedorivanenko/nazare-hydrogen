/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import type { FileEvidence } from "../evidence/extract";
import {
	buildEvidenceFacts,
	functionCandidates,
	parseResponsibility,
	primaryFunction,
	responsibilityCandidates,
} from "./infer";

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

test("function candidates resolve exported methods to their object owner", () => {
	assert.deepEqual(functionCandidates(evidence), ["collectEmailSubscribers"]);
	assert.equal(primaryFunction(evidence), "collectEmailSubscribers");
});

test("responsibility candidates combine symbol and explicit provider taxonomies", () => {
	const evidenceWithProvider = structuredClone(evidence);
	evidenceWithProvider.functions[1]?.stringLiterals.push(
		"provider.resend.contacts.create",
	);

	assert.deepEqual(responsibilityCandidates(evidenceWithProvider), [
		"email.subscribers.collect",
		"resend.contacts.create",
	]);
});

test("evidence facts use stable IDs and exact AST facts", () => {
	assert.deepEqual(buildEvidenceFacts(evidence), [
		{
			id: "F1",
			text: "source:capability.ts",
		},
		{
			id: "F2",
			text: "function:validateEmail; kind:function; exported:false; async:false",
		},
		{
			id: "F3",
			text: "function:collectEmailSubscribers.execute; kind:method; exported:true; async:true",
		},
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

test("responsibility rejects generic taxonomy placeholders", () => {
	assert.throws(
		() =>
			parseResponsibility(
				JSON.stringify({
					...response,
					primaryResponsibility: "service.resource.action",
				}),
				evidence,
			),
		/generic responsibility label/,
	);
});
