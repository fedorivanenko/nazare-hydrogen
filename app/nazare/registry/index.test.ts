/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { getCapability, listEntities, searchRegistry } from "./index";

test("registry entity IDs are unique", () => {
	const ids = listEntities().map((entity) => entity.id);
	assert.equal(new Set(ids).size, ids.length);
});

test("registry filters entities by kind", () => {
	assert.deepEqual(
		listEntities("provider").map((entity) => entity.id),
		["provider.resend"],
	);
});

test("registry searches entity metadata", () => {
	assert.deepEqual(
		searchRegistry("newsletter", "capability").map((entity) => entity.id),
		["capability.collect-email-subscribers"],
	);
});

test("capability declares the executable route binding", () => {
	const capability = getCapability("capability.collect-email-subscribers");
	assert.equal(capability?.bindings?.[0]?.sourceFile, "app/root.tsx");
	assert.ok(
		capability?.bindings?.[0]?.inputs.some((input) => input.name === "email"),
	);
});
