/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { Project } from "ts-morph";
import { stampSourceFile } from "./stamp";

test("stamps tracked declarations once with typed identities", () => {
	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile(
		"/example.ts",
		`type Contact = { id: string };
const API_URL = "https://example.com";
export const connector = { name: "example" };
const local = 1;
function createContact() { return local; }
`,
	);
	let sequence = 0;
	const createId = (prefix: "fn" | "type" | "const") =>
		`${prefix}_${String(++sequence).padStart(32, "0")}`;

	assert.deepEqual(stampSourceFile(sourceFile, createId), [
		{
			id: "fn_00000000000000000000000000000001",
			name: "createContact",
			prefix: "fn",
		},
		{
			id: "const_00000000000000000000000000000002",
			name: "API_URL",
			prefix: "const",
		},
		{
			id: "const_00000000000000000000000000000003",
			name: "connector",
			prefix: "const",
		},
		{
			id: "type_00000000000000000000000000000004",
			name: "Contact",
			prefix: "type",
		},
	]);
	assert.equal(stampSourceFile(sourceFile, createId).length, 0);
	assert.match(
		sourceFile.getFullText(),
		/@nazare-id fn_00000000000000000000000000000001/,
	);
	assert.equal(sourceFile.getFullText().match(/@nazare-id/g)?.length, 4);
});
