# Task 01 — optional first name capture

Change the existing Hero email signup so a visitor may optionally submit their first name together with their email address.

Requirements:

- The Hero signup UI must include an optional first-name input.
- Email remains required and must keep the existing validation behavior.
- The business capability must accept the optional first name without weakening its existing email policy.
- The Resend contact request must send `first_name` when a non-empty first name is provided, and omit it when it is not provided.
- Existing behavior for email-only submissions must continue to work.
- Keep provider-specific behavior out of the Carcass component.
- Preserve the existing successful connector-result evidence semantics.
- Do not bypass or remove Nazare lint rules, tests, or architectural constraints to make the task pass.

Finish by running the repository's full verification gate and repair any failures.
