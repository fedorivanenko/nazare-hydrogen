/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import type { FileEvidence } from "../evidence/extract";
import {
	extractFunctionCalls,
	identifierResponsibility,
	responsibilityReportSchema,
} from "./infer";

const normalizeEmailAddress: FileEvidence["functions"][number] = {
	name: "normalizeEmailAddress",
	owner: null,
	qualifiedName: "normalizeEmailAddress",
	declarationId: "fn_normalize",
	declaredResponsibility: "email.address.transform",
	kind: "function",
	exported: false,
	async: false,
	location: { line: 11, column: 1 },
	parameters: [],
	returnType: "string",
	calls: [{ callee: "email.trim", location: { line: 12, column: 9 } }],
	propertyAccesses: ["email.trim"],
	stringLiterals: [],
	throws: [],
	returns: [],
};

const createResendContact: FileEvidence["functions"][number] = {
	name: "createResendContact",
	owner: null,
	qualifiedName: "createResendContact",
	declarationId: "fn_create_contact",
	declaredResponsibility: "resend.contact.create",
	kind: "function",
	exported: true,
	async: true,
	location: { line: 39, column: 1 },
	parameters: [],
	returnType: "Promise<ResendContact>",
	calls: [
		{
			callee: "normalizeEmailAddress",
			location: { line: 46, column: 26 },
		},
		{ callee: "fetch", location: { line: 49, column: 25 } },
	],
	propertyAccesses: [],
	stringLiterals: ["https://api.resend.com/contacts"],
	throws: [],
	returns: [],
};

const evidence: FileEvidence = {
	schemaVersion: 3,
	sourceFile:
		"/Users/fedori/Coding/personal/nazare-hydrogen/app/nazare/connectors/resend.server.ts",
	identities: [],
	imports: [],
	reExports: [],
	functions: [normalizeEmailAddress, createResendContact],
};

test("responsibility IDs derive from function declarations", () => {
	assert.equal(
		identifierResponsibility("normalizeEmailAddress"),
		"email.address.transform",
	);
	assert.equal(
		identifierResponsibility("createResendContact"),
		"resend.contact.create",
	);
});

test("calls reference inferred local declaration responsibilities", () => {
	const responsibilities = new Map([
		["normalizeEmailAddress", "email.address.transform"],
		["createResendContact", "resend.contact.create"],
	]);
	assert.deepEqual(
		extractFunctionCalls(evidence, createResendContact, responsibilities),
		[
			{
				callee: "normalizeEmailAddress",
				line: 46,
				column: 26,
				targetFunctionId: "fn_normalize",
				responsibility: "email.address.transform",
			},
			{
				callee: "fetch",
				line: 49,
				column: 25,
				targetFunctionId: null,
				responsibility: "http.request.execute",
			},
		],
	);
});

test("responsibility report separates declaration and call identities", () => {
	const report = {
		schemaVersion: 3,
		sourceFile: "app/nazare/connectors/resend.server.ts",
		functions: [
			{
				functionId:
					"app/nazare/connectors/resend.server.ts#normalizeEmailAddress",
				function: "normalizeEmailAddress",
				responsibility: "email.address.transform",
				description: "Normalize an email address.",
				declaration: {
					kind: "function",
					exported: false,
					async: false,
					line: 11,
					column: 1,
				},
				calls: [
					{
						callee: "email.trim",
						line: 12,
						column: 9,
						targetFunctionId: null,
						responsibility: "email.address.transform",
					},
				],
			},
		],
	};

	assert.deepEqual(responsibilityReportSchema.parse(report), report);
});
