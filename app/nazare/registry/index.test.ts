/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { compileCapabilityTask, expandEntity } from "./agent";
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

test("entity expansion follows exact graph references", () => {
	const surface = expandEntity("carcass.section.hero");
	const provider = expandEntity("provider.resend");
	const capability = expandEntity("capability.collect-email-subscribers");

	assert.deepEqual(
		surface?.neighbors.map((entity) => entity.id),
		["capability.collect-email-subscribers"],
	);
	assert.deepEqual(
		provider?.neighbors.map((entity) => entity.id),
		["capability.collect-email-subscribers"],
	);
	assert.deepEqual(
		capability && "bindings" in capability
			? capability.bindings.map((binding) => binding.id)
			: [],
		["binding.route.root.hero-email-signup"],
	);
	assert.equal(expandEntity("provider.missing"), null);
});

test("capability declares the executable route binding", () => {
	const capability = getCapability("capability.collect-email-subscribers");
	assert.equal(capability?.bindings[0]?.sourceFile, "app/root.tsx");
	assert.deepEqual(
		capability?.bindings[0]?.inputs.map((input) => input.name),
		["email"],
	);
});

test("task compiler projects the executable neighborhood and invariants", () => {
	const compiled = compileCapabilityTask(
		"capability.collect-email-subscribers",
		"Require explicit marketing consent before newsletter signup",
	);
	assert.equal(compiled.ok, true);
	if (!compiled.ok) return;

	assert.ok(compiled.sourceFiles.includes("app/root.tsx"));
	assert.deepEqual(
		compiled.executableBindings.map((binding) => binding.id),
		["binding.route.root.hero-email-signup"],
	);
	assert.deepEqual(
		compiled.constraints.policies.map((policy) => policy.id),
		["valid-email"],
	);
	assert.deepEqual(
		compiled.constraints.requiredEvidence.map((evidence) => evidence.id),
		["contact-created"],
	);
});
