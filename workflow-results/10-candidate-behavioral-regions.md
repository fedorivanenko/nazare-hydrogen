# Candidate Behavioral Regions

Workflow step 10 applied to [`09-strongly-coupled-subsets.md`](./09-strongly-coupled-subsets.md).

These are candidate behavior/change units, not final boundaries. Overlap and nesting are allowed. Inputs, outputs, dependencies, effects, and formal parent/child relationships remain for workflow step 11.

## 1. Formation rules

Each candidate starts from a retained strongly coupled subset, then may add a causally indispensable first-party node when:

1. its semantic responsibility belongs to the same behavioral statement;
2. excluding it would remove a policy branch, result, or domain effect;
3. it is not generic infrastructure;
4. addition is supported by causal-cone evidence even when mutation coupling is lower.

Candidates are rejected when cohesion comes only from framework execution, lexical containment, or dependency plumbing.

Membership notation:

- **Core:** strongly coupled seed nodes.
- **Completion:** causally necessary nodes added to express complete behavior.
- **Shared:** plausible member of more than one candidate.

## 2. Candidate index

| ID | Candidate identity | Seed | Confidence |
|---|---|---|---|
| `CBR-01` | Subscribe visitor by email | `S09` | High |
| `CBR-02` | Present email-capture interaction | `S05` | High |
| `CBR-03` | Process subscription submission | `S07` | High |
| `CBR-04` | Collect email subscriber | `S06` | High |
| `CBR-05` | Present subscription outcome | `S08` | High |
| `CBR-06` | Create Resend contact | `S04` | High |
| `CBR-07` | Propagate request execution context | `S02` | Medium-high |
| `CBR-08` | Activate storefront client | `S01` | Medium-low |
| `CBR-09` | Reject invalid subscriber email | `S06` branch | Medium |

## 3. `CBR-01` — Subscribe visitor by email

**Behavioral statement:** Let a storefront visitor submit an email, reject invalid input without external write, create a provider contact for valid input, and show a stable outcome.

### Core members

```text
N11  action
N12  App
N13  HeroProps
N14  Hero
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
```

### Causal completion members

```text
N15  EMAIL_PATTERN
N18  createSubscriberCollectedResult
N22  createResendContact
```

### Why candidate

- `S09` captures most total coupling with conductance `0.321`.
- Includes complete input → policy → effect → outcome → presentation chain.
- Consent, structured outcomes, idempotency, localization, pending UI, and provider-failure mutations repeatedly cross this region.
- Does not match one file or function.

### Shared membership

- `N11–N14` participate in presentation/submission children.
- `N15–N20` participate in subscriber collection children.
- `N22` participates in Resend contact creation.

---

## 4. `CBR-02` — Present email-capture interaction

**Behavioral statement:** Render configurable landing content with an email form and interaction states suitable for starting subscription.

### Core members

```text
N12  App
N13  HeroProps
N14  Hero
```

### Why candidate

- Direct component and prop structure.
- Internal coupling `0.717`.
- Pending, completed, consent, privacy disclosure, and status-shape mutations change these nodes together.
- Presentation can evolve without changing validation/provider internals.

### Shared membership

All members also belong to `CBR-01`; outcome rendering overlaps `CBR-05`.

---

## 5. `CBR-03` — Process subscription submission

**Behavioral statement:** Translate a route POST into subscriber-collection behavior and translate capability results/errors back into stable action data.

### Core members

```text
N11  action
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
```

### Completion member

```text
N15  EMAIL_PATTERN
```

`N15` completes current validation behavior but remains independently mutable behind `N16`.

### Why candidate

- Seed `S07` internal coupling `0.608`.
- Owns transport-to-capability translation.
- Consent, structured validation, rate limiting, locale, command-shape, and normalization mutations cross this set.

### Shared membership

- `N11` overlaps outcome presentation.
- `N15–N20` overlap subscriber collection.

---

## 6. `CBR-04` — Collect email subscriber

**Behavioral statement:** Enforce subscriber acceptance policy, avoid external writes for rejected input, perform contact creation for accepted input, and report evidence-backed success.

### Core members

```text
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
```

### Causal completion members

```text
N15  EMAIL_PATTERN
N18  createSubscriberCollectedResult
N22  createResendContact
```

### Why candidate

- This is strongest domain-level causal cone identified earlier.
- Core seed `S06` has complete pair evidence and internal coupling `0.623`.
- `N15` supplies current policy, `N18` completes success branch, and `N22` owns required external write.
- Region remains meaningful without route, React, or Worker infrastructure.

### Membership variant

A narrower region may treat `N22` as dependency rather than member:

```text
CBR-04a policy-complete = N15 N16 N17 N18 N19 N20
CBR-04b effect-complete = CBR-04a + N22
```

`CBR-04b` is preferred candidate because current success means provider contact creation completed. Step 11 must record `N22` as shared with `CBR-06`.

---

## 7. `CBR-05` — Present subscription outcome

**Behavioral statement:** Carry subscription failure/success semantics from action result into an accessible user-visible state.

### Core members

```text
N11  action
N12  App
N13  HeroProps
N14  Hero
N17  createInvalidEmailResult
```

### Causal completion member

```text
N18  createSubscriberCollectedResult
```

### Why candidate

- Seed `S08` internal coupling `0.612`.
- Structured-result, severity, localization, duplicate-contact, pending, completed, and accessibility mutations cross producer and presentation nodes.
- Added `N18` supplies success semantics symmetric with invalid-result semantics.

### Structural concern

Current implementation has no named outcome contract. Capability/action result is inferred, then reduced to `message?: string`. Candidate therefore represents behavior more clearly than current structure.

---

## 8. `CBR-06` — Create Resend contact

**Behavioral statement:** Use deployment-provided Resend configuration to issue a valid contact-creation request, classify provider response, and expose success or explicit failure.

### Core members

```text
N04  Env
N21  ResendConnectorEnv
N22  createResendContact
```

### Why candidate

- Seed `S04` internal coupling `0.620` and external mean coupling `0.116`.
- Credential, audience, endpoint, duplicate, retry, and request-header mutations center here.
- Owns provider-specific behavior rather than generic HTTP transport.

### Structural concern

`N04` and `N21` duplicate configuration shape without shared declaration. Candidate includes both because behavioral coupling is strong despite fragmented structure.

### Shared membership

`N22` also completes `CBR-04`. Provider API `E01` remains an external effect, not a first-party member.

---

## 9. `CBR-07` — Propagate request execution context

**Behavioral statement:** Create request-scoped application context and make it available to route behavior with consistent contracts.

### Core members

```text
N02  server fetch adapter
N03  getLoadContext
N10  ActionContext
```

### Why candidate

- Seed `S02` internal coupling `0.758`.
- Correlation, locale, tenant, timeout, and dependency-injection mutations require coordinated changes.
- Exists across Worker and route files rather than one module.

### Structural concern

`N03` produces context independently typed by `N10`; no shared context declaration exists. Candidate may become shared application infrastructure rather than domain Behavioral Region after boundary assignment.

---

## 10. `CBR-08` — Activate storefront client

**Behavioral statement:** Start client hydration, recover/report activation failures, and attach router behavior to server-rendered document shell.

### Core members

```text
N07  entry.client module initialization
N08  hydration callback
N09  Layout
```

### Why candidate

- Seed `S01` has high separation quality `0.654` and low conductance `0.239`.
- Hydration delay, consent bootstrap, progressive enhancement, and recoverable-error mutations cluster here.

### Confidence concern

Only three shared mutation observations support cohesion. Most execution belongs to React/React Router dependency capsules. Keep as tentative low-domain-content region.

---

## 11. `CBR-09` — Reject invalid subscriber email

**Behavioral statement:** Decide whether subscriber email meets acceptance policy and return corrective failure without contacting provider.

### Core/branch members

```text
N15  EMAIL_PATTERN
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber — invalid branch only
```

### Why candidate

- Semantically stable policy branch within `CBR-04`.
- Distinct mutations change syntax policy, reason codes, disposable-domain checks, consent policy, and localized corrective guidance.
- Absence of provider effect is defining behavior.

### Confidence concern

Raw subset `{N15,N16,N17}` failed coupling threshold because `N15` changes independently and `N17` is reached through `N19`. Candidate is retained from causal semantics, not density alone.

### Non-symbol granularity

Only invalid branch of `N19` belongs specifically to this child behavior. Behavioral Regions are permitted to include control-flow fragments rather than whole functions.

## 12. Candidate nesting and overlap

Provisional only; formal relationships belong to step 11.

```text
CBR-01 Subscribe visitor by email
├─ CBR-02 Present email-capture interaction
├─ CBR-03 Process subscription submission
├─ CBR-04 Collect email subscriber
│  └─ CBR-09 Reject invalid subscriber email
└─ CBR-05 Present subscription outcome

CBR-04 ∩ CBR-06 = {N22 createResendContact}
CBR-03 ∩ CBR-05 = {N11 action, N17 invalid-result factory}
CBR-02 ∩ CBR-05 = {N12 App, N13 HeroProps, N14 Hero}
CBR-03 ∩ CBR-04 = {N15, N16, N17, N19, N20}

CBR-07 supplies context to CBR-01/CBR-03.
CBR-08 activates client execution of CBR-02/CBR-05.
```

## 13. Candidates not formed

### Serve storefront document

Not formed from `N01`, `N02`, `N05`, `N06`, `N09`, `N12`, and `N14`. Current cohesion is mostly Worker/React Router/React execution structure, with weak repeated behavioral co-change.

### Email-pattern region

Not formed around `N15` alone. It is policy data within validation behavior, not an independently complete behavior.

### Environment pass-through region

Not formed from `N03`, `N04`, `N10`, and `N21`. Raw environment propagation is structural plumbing. `CBR-07` captures request-context behavior; `CBR-06` captures provider configuration behavior.

### Generic framework regions

No regions formed from `D01–D11`. They remain dependencies by workflow step 3.

## 14. Result

- Candidate Behavioral Regions: **9**
- High-confidence candidates: **6**
- Medium/medium-high candidates: **2**
- Medium-low tentative candidates: **1**
- Parent candidate: `CBR-01`
- Domain core: `CBR-04` — **Collect email subscriber**
- Explicit control-flow-fragment candidate: `CBR-09`
- Overlap points retained rather than forced into one owner

Next workflow input: assign formal members, inputs/surfaces, outputs/effects, dependencies, parent/child links, and shared infrastructure for each candidate.
