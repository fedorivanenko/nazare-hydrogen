/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { expandEntity } from "./agent";
import { listEntities, searchRegistry } from "./index";

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

test("entity expansion follows exact graph references", () => {
	const surface = expandEntity("carcass.section.hero");
	const provider = expandEntity("provider.resend");

	assert.deepEqual(
		surface?.neighbors.map((entity) => entity.id),
		["capability.collect-email-subscribers"],
	);
	assert.deepEqual(
		provider?.neighbors.map((entity) => entity.id),
		["capability.collect-email-subscribers"],
	);
	assert.equal(expandEntity("provider.missing"), null);
});
