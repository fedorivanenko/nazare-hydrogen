# Behavioral Region Semantic Identities

Workflow step 12 applied to boundaries in [`11-behavioral-region-boundaries.md`](./11-behavioral-region-boundaries.md).

Semantic identities describe stable behavior/change units. Names avoid current file layout and generic framework mechanics. Provider names appear only where provider-specific behavior defines identity.

## 1. Identity rules

A stable identity states:

1. actor or trigger;
2. behavioral decision/transformation;
3. observable outcome/effect;
4. invariant distinguishing it from neighboring regions.

Stable IDs use semantic slugs and should survive symbol renames, file moves, and equivalent refactors.

## 2. Identity registry

| Candidate | Stable ID | Canonical name | Concise identity |
|---|---|---|---|
| `CBR-01` | `br.email-subscription` | Email subscription journey | Accept visitor subscription intent, enforce acceptance policy, create subscriber contact, and present outcome. |
| `CBR-02` | `br.email-capture-interaction` | Email capture interaction | Present email-subscription controls and emit a valid submission intent from storefront UI. |
| `CBR-03` | `br.subscription-submission` | Subscription submission processing | Translate route submission into subscriber collection and return safe action outcomes. |
| `CBR-04` | `br.collect-email-subscriber` | Collect email subscriber | Reject unacceptable email without external write; otherwise create subscriber contact and report evidence-backed success. |
| `CBR-05` | `br.subscription-outcome-presentation` | Subscription outcome presentation | Convert subscription result semantics into accessible user-visible status. |
| `CBR-06` | `br.resend-contact-creation` | Resend contact creation | Use Resend configuration to create contact and classify provider success or failure. |
| `CBR-07` | `br.request-execution-context` | Request execution context | Propagate request-scoped dependencies and metadata from server boundary to route behavior. |
| `CBR-08` | `br.storefront-client-activation` | Storefront client activation | Hydrate server-rendered storefront and activate client router interactions. |
| `CBR-09` | `br.invalid-subscriber-rejection` | Invalid subscriber rejection | Reject email that fails subscriber policy, return corrective result, and guarantee no provider write. |

## 3. `br.email-subscription`

**Canonical description:**

> Accept visitor subscription intent, enforce acceptance policy, create subscriber contact, and present outcome.

**Identity anchors:**

- starts with visitor email-subscription intent;
- includes validation gate;
- includes external contact-creation effect for accepted input;
- ends with user-visible outcome.

**Stable across:**

- moving form/action/capability between files;
- replacing React Router transport;
- replacing Resend while preserving subscription semantics;
- changing validation implementation.

**Identity-changing mutations:**

- removing contact creation entirely;
- changing from subscription to unrelated lead capture;
- no longer reporting outcome to initiating visitor.

## 4. `br.email-capture-interaction`

**Canonical description:**

> Present email-subscription controls and emit a valid submission intent from storefront UI.

**Identity anchors:**

- visible email collection control;
- explicit user submission;
- presentation and interaction states, not server-side acceptance policy.

**Stable across:**

- component renames or layout redesign;
- client-side versus native form enhancement;
- changes to button text or visual structure.

**Excludes:**

- deciding business validity;
- provider contact creation;
- connector credentials.

## 5. `br.subscription-submission`

**Canonical description:**

> Translate route submission into subscriber collection and return safe action outcomes.

**Identity anchors:**

- receives transport-level submission;
- extracts/normalizes command input;
- invokes collection capability;
- protects public result from unexpected internal errors.

**Stable across:**

- route path changes;
- framework action API changes;
- capability relocation;
- result serialization format changes preserving semantics.

**Excludes:**

- rendering form controls;
- provider-specific HTTP construction.

## 6. `br.collect-email-subscriber`

**Canonical description:**

> Reject unacceptable email without external write; otherwise create subscriber contact and report evidence-backed success.

**Identity anchors:**

- policy gate precedes effect;
- rejected input produces corrective result;
- accepted input attempts subscriber contact creation;
- success occurs only after effect succeeds;
- result retains evidence of performed operation.

**Stable across:**

- regex replacement with richer validation;
- provider replacement;
- function/object/file renames;
- synchronous versus equivalent reliable execution, if success semantics remain accurate.

**Identity-changing mutations:**

- accepting all input without policy;
- reporting success before durable effect/accepted deferred responsibility;
- changing operation from subscriber collection to unrelated contact use.

## 7. `br.subscription-outcome-presentation`

**Canonical description:**

> Convert subscription result semantics into accessible user-visible status.

**Identity anchors:**

- consumes semantic subscription result;
- distinguishes absence, success, and failure;
- presents outcome to initiating user;
- maintains accessible announcement semantics.

**Stable across:**

- message wording/localization;
- inline status versus confirmation panel;
- visual component refactors.

**Excludes:**

- deciding whether input is valid;
- performing provider write.

## 8. `br.resend-contact-creation`

**Canonical description:**

> Use Resend configuration to create contact and classify provider success or failure.

**Identity anchors:**

- Resend-specific credential/configuration;
- Resend contacts API contract;
- authenticated contact-creation request;
- explicit non-success classification.

**Stable across:**

- connector file/function rename;
- generic HTTP client replacement;
- request serialization refactor.

**Identity-changing mutations:**

- replacing Resend with another provider;
- changing operation from contact creation to email delivery;
- removing provider-response classification.

## 9. `br.request-execution-context`

**Canonical description:**

> Propagate request-scoped dependencies and metadata from server boundary to route behavior.

**Identity anchors:**

- begins at server request boundary;
- produces per-request execution context;
- route behavior consumes same contract.

**Stable across:**

- adding locale, correlation ID, tenant, or deadline;
- framework callback rename;
- moving context type to shared module.

**Excludes:**

- using dependencies to perform subscriber collection;
- rendering or provider effects.

## 10. `br.storefront-client-activation`

**Canonical description:**

> Hydrate server-rendered storefront and activate client router interactions.

**Identity anchors:**

- browser entry execution;
- hydration of existing server document;
- activation of route interactions.

**Stable across:**

- scheduling API changes;
- entry-file relocation;
- recoverable-error instrumentation.

**Excludes:**

- server document generation;
- email-subscription policy/effects.

## 11. `br.invalid-subscriber-rejection`

**Canonical description:**

> Reject email that fails subscriber policy, return corrective result, and guarantee no provider write.

**Identity anchors:**

- negative policy decision;
- corrective semantic result;
- absence of external contact creation.

**Stable across:**

- regex/policy implementation changes;
- reason-code or localization changes;
- addition of disposable-domain or consent checks when treated as subscriber acceptance policy.

**Identity-changing mutations:**

- allowing rejected input to reach provider;
- silently dropping rejected input without corrective result;
- moving rejection entirely to provider while removing local policy gate.

## 12. Distinguishing neighboring identities

| Region pair | Distinction |
|---|---|
| `br.email-subscription` vs. `br.collect-email-subscriber` | Journey includes UI submission and presentation; collection is domain policy/effect core. |
| `br.email-capture-interaction` vs. `br.subscription-submission` | Capture owns user controls/intent; submission owns transport translation and safe action result. |
| `br.subscription-submission` vs. `br.collect-email-subscriber` | Submission adapts route request; collection owns business policy/effect sequencing. |
| `br.collect-email-subscriber` vs. `br.resend-contact-creation` | Collection is provider-independent business meaning; Resend region owns provider protocol. |
| `br.collect-email-subscriber` vs. `br.invalid-subscriber-rejection` | Collection includes valid and invalid branches; rejection is negative-policy child behavior. |
| `br.subscription-outcome-presentation` vs. `br.email-capture-interaction` | Outcome maps semantic results; capture presents controls and emits intent. |
| `br.request-execution-context` vs. `br.subscription-submission` | Context supplies dependencies; submission consumes them for behavior. |
| `br.storefront-client-activation` vs. UI regions | Activation enables browser runtime; UI regions own user-facing subscription meaning. |

## 13. Identity hierarchy

```text
br.email-subscription
├─ br.email-capture-interaction
├─ br.subscription-submission
├─ br.collect-email-subscriber
│  └─ br.invalid-subscriber-rejection
└─ br.subscription-outcome-presentation

br.collect-email-subscriber
└─ overlaps br.resend-contact-creation at connector implementation

br.request-execution-context
└─ supplies br.subscription-submission

br.storefront-client-activation
└─ activates client-side UI regions
```

## 14. Result

- Semantic identities assigned: **9 of 9**
- Stable semantic IDs assigned: **9**
- Provider-independent domain core: `br.collect-email-subscriber`
- Provider-specific adapter identity: `br.resend-contact-creation`
- Parent journey identity: `br.email-subscription`
- Identity distinctions documented for all neighboring/overlapping regions

Next workflow input: reconcile these stable IDs and identities with any previous Behavioral Region graph.
