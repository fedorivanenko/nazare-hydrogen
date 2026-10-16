import assert from "node:assert/strict";
import { test } from "node:test";
import { newsletterEmail, earlyAccessEmail } from "./email-eligibility.ts";

for (const [name, validator] of [
  ["newsletter", newsletterEmail],
  ["early access", earlyAccessEmail],
] as const) {
  test(`${name}: accepts and normalizes emails`, () => {
    assert.equal(validator("  USER@Example.COM  "), "user@example.com");
  });
  test(`${name}: rejects malformed emails`, () => {
    assert.equal(validator("hello"), null);
    assert.equal(validator("a@@example.com"), null);
  });
}
