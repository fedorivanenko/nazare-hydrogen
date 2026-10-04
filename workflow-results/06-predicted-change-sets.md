# Predicted Required Change Sets

Workflow step 6 applied to all mutations in [`05-behavioral-mutations.md`](./05-behavioral-mutations.md).

## Prediction rules

For deterministic comparison, each prediction uses the smallest coherent change set that:

1. keeps current responsibility ownership;
2. propagates changed inputs/results through every current first-party caller;
3. changes external contracts/effects only when required;
4. introduces a new symbol only when no current symbol owns the responsibility.

Notation:

- `Nxx`: existing first-party node from [`04-semantic-responsibilities.md`](./04-semantic-responsibilities.md)
- `Dxx`: generic dependency contract whose usage changes; dependency internals do not change
- `E01`: Resend external-effect contract
- `+Name`: required new first-party symbol/surface

## `N01` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N01-01` | `N02`, `+HealthResponse` | `D01` routing usage | `fetch` must intercept health path before Hydrogen routing and produce response. |
| `M-N01-02` | `N02`, `N04`, `N21` | Worker environment contract | Request boundary must validate same credential contract later consumed by connector. |

## `N02` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N02-01` | `N02`, `N03`, `N06`, `N10`, `N11`, `N19`, `N20`, `N22` | `D07` response header; `D11` logging; `D08` request headers | Generate ID once, propagate through context/capability/connector, emit in response and diagnostics. |
| `M-N02-02` | `N02`, `N03`, `N10`, `N11`, `N19`, `N20`, `N22` | `D02` lifecycle; `D08` abort signal | POST-specific deadline must propagate to provider request to stop actual work. |
| `M-N02-03` | `N02`, `N03`, `N04`, `N10`, `N21`, `N22`, `+TenantResolver` | `D02` context contract; `E01` target credentials/config | Hostname selection must produce connector configuration consumed by action path. |

## `N03` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N03-01` | `N02`, `N03`, `N10`, `N11`, `N19`, `N20`, `N22` | `D11` log metadata; `D08` headers | Producer, context contract, consumers, and external request must share correlation ID. |
| `M-N03-02` | `N02`, `N03`, `N10`, `N11`, `N20`, `N21`, `+SubscriptionServiceFactory` | `D02` context shape | Server adapter constructs narrowed capability/config; action stops receiving raw environment. |
| `M-N03-03` | `N03`, `N10`, `N11`, `N12`, `N17`, `+LocaleResolver`, `+MessageCatalog` | `D02` context shape | Locale enters context and must reach owner of user-facing validation/failure text. |

## `N04` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N04-01` | `N02`, `N04`, `N21`, `N22` | Worker binding contract | Deployment type, boundary validation, connector type, and missing-key behavior must agree. |
| `M-N04-02` | `N04`, `N21`, `N22` | `E01` audience assignment | New binding propagates through connector contract into provider request. |

## `N05` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N05-01` | `N05`, `N11`, `N14`, `+SubscribeRoute` | `D03` route/action mapping | New route owns action; form target and route manifest must point to it. |
| `M-N05-02` | `N05`, `N11`, `N12`, `N14`, `+ThanksRoute` | `D03` redirect/navigation result | Action success changes from inline data to navigation; old presentation path must adapt. |
| `M-N05-03` | `N05`, `N12`, `N13`, `N14`, `+PrivacyRoute` | `D03` route/link mapping | Route must exist and email-capture contract/UI must expose its link. |

## `N06` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N06-01` | `N02`, `N03`, `N06`, `N09`, `+NonceFactory` | `D03` script nonce usage; `D07` CSP header | Same nonce must reach header and every generated script-bearing render surface. |
| `M-N06-02` | `N06` | `D04` abort/error handling | Server entry must classify abort separately while retaining current rendering contract. |
| `M-N06-03` | `N02`, `N03`, `N06` | `D07` correlation header | Request adapter creates identity; render response receives and emits it. |

## `N07` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N07-01` | `N07`, `N08`, `N09`, `+ConsentStateLoader` | `D05` hydration scheduling | Consent state must resolve before callback hydrates document; shell supplies initial state if SSR-backed. |
| `M-N07-02` | `N07`, `N08`, `N09`, `+HydrationFallback` | `D05` error callback | Bootstrap catches/reporting and visible fallback placement must coordinate. |

## `N08` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N08-01` | `N02`, `N03`, `N08`, `+ClientDiagnostics` | `D05` recoverable-error callback; `D11` logging | Server-generated identity must be available to client hydration error reporter. |
| `M-N08-02` | `N08`, `N11`, `N14` | `D03` progressive form/action contract; `D06` native form submission | UI and server action must preserve equivalent semantics before and after hydration. |

## `N09` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N09-01` | `N03`, `N09`, `N10`, `N11`, `N12`, `N17`, `+LocaleResolver`, `+MessageCatalog` | `D03` render context | Request locale must control document language and subscription messages consistently. |
| `M-N09-02` | `N07`, `N08`, `N09`, `+ConsentState`, `+ConsentControl` | `D03`/`D05` script activation | Consent owner, client bootstrap, and script placement must use same state. |
| `M-N09-03` | `N09`, `+DefaultMetadata` | `D03` metadata contract | Layout must supply default title/description through router metadata surface. |

## `N10` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N10-01` | `N02`, `N03`, `N10`, `N11`, `N20`, `N21`, `+SubscriptionServiceFactory` | `D02` context shape | Server constructs capability; context and action switch from raw credentials to behavior dependency. |
| `M-N10-02` | `N02`, `N03`, `N10`, `N11`, `N12`, `N17`, `N19`, `N20`, `N22` | `D11` metadata; `D08` headers | Locale and correlation ID must propagate through all consumers that render or diagnose behavior. |

## `N11` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N11-01` | `N11`, `N13`, `N14`, `N16`, `N17`, `N19`, `N20` | `D06` form payload | UI collects consent; action parses it; capability policy enforces it; result explains failure. |
| `M-N11-02` | `N03`, `N10`, `N11`, `N12`, `N17`, `+RateLimiter`, `+RateLimitResult` | `D02` context dependency; `D03` action result | Limiter must be injected/invoked and throttling must become distinguishable presentation data. |
| `M-N11-03` | `N11`, `N12`, `N13`, `N14`, `N17`, `N18` | `D03` action-result schema | Producer and every presentation consumer must adopt structured result code/severity. |
| `M-N11-04` | `N11` | `D10` normalization usage | Action canonicalizes value before existing capability boundary; downstream signatures stay stable. |

## `N12` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N12-01` | `N11`, `N12`, `N13`, `N14`, `N17`, `N18`, `N19`, `N22` | `D03` action-result union; `E01` duplicate/failure distinctions | Result producers must preserve distinctions that App/Hero render. |
| `M-N12-02` | `N12`, `N13`, `N14` | `D03` action-data consumption | App derives completed state; Hero contract and rendering replace form. |
| `M-N12-03` | `N12`, `N13`, `N14` | `D03` navigation-state consumption | App reads pending state and Hero contract/rendering expose it. |

## `N13` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N13-01` | `N05`, `N11`, `N12`, `N13`, `N14`, `N16`, `N17`, `N19`, `N20`, `+PrivacyRoute` | `D06` consent field | Caller supplies disclosure; Hero collects consent; server policy enforces it; privacy target exists. |
| `M-N13-02` | `N11`, `N12`, `N13`, `N14`, `N17`, `N18` | `D03` structured action result | Result producers, composition mapping, prop contract, and accessible rendering must agree on severity. |
| `M-N13-03` | `N12`, `N13`, `N14` | `D03` action/navigation state | Caller derives pending/completed state; contract carries it; Hero changes interaction/rendering. |

## `N14` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N14-01` | `N11`, `N13`, `N14`, `N16`, `N17`, `N19`, `N20` | `D06` consent field | Rendering a checkbox is insufficient unless parsing and capability policy enforce it. |
| `M-N14-02` | `N12`, `N13`, `N14` | `D03` navigation state | Router pending state must flow through App/props into button and live feedback. |
| `M-N14-03` | `N12`, `N13`, `N14` | `D03` action data | Successful result must become completed prop state that controls form visibility. |
| `M-N14-04` | `N11`, `N12`, `N13`, `N14`, `N17`, `N18` | `D03` result severity | Hero needs structured severity propagated from result producers to choose live-region semantics. |

## `N15` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N15-01` | `N15` | `D10` pattern execution unchanged | Acceptance policy changes entirely in pattern; validator contract remains boolean. |
| `M-N15-02` | `N15`, `N16` | `D10` Unicode normalization/pattern usage | International support changes pattern and may require canonicalized validation semantics. |
| `M-N15-03` | `N15` | `D10` pattern execution unchanged | Pattern alone changes local strictness while provider keeps final validation. |

## `N16` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N16-01` | `N16`, `N17`, `N19`, `N20` | Capability policy/result contract | Validator output changes from boolean to reason; orchestrator, public policy, and invalid result consume it. |
| `M-N16-02` | `N16`, `+DisposableDomainPolicy` | Optional domain-list dependency | Validator gains domain policy while boolean caller contract can remain stable. |
| `M-N16-03` | `N11`, `N13`, `N14`, `N16`, `N17`, `N19`, `N20` | `D06` consent payload | Policy input, command shape, orchestrator branch, result, action, and UI must expand together. |

## `N17` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N17-01` | `N12`, `N13`, `N14`, `N16`, `N17`, `N19`, `N20` | `D03` action-result union | Reason originates in policy/result and must remain available through presentation boundary. |
| `M-N17-02` | `N03`, `N10`, `N11`, `N12`, `N16`, `N17`, `N19`, `+MessageCatalog` | `D02` locale context; `D03` result schema | Capability returns semantic reason; locale-aware presentation converts it to text. |
| `M-N17-03` | `N11`, `N12`, `N13`, `N14`, `N16`, `N17`, `N19`, `N20` | `D06` consent field; `D03` result union | Separate policy branch must survive action transport and render distinct correction. |

## `N18` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N18-01` | `N18`, `N19`, `N22` | `E01` success payload | Connector ID must be captured, passed into result factory, and exposed as evidence. |
| `M-N18-02` | `N11`, `N12`, `N18`, `N19`, `N22` | `E01` duplicate response semantics; `D03` result union | Connector classifies duplicate, orchestrator/result preserve it, UI reports idempotent success. |
| `M-N18-03` | `N12`, `N18`, `N19`, `N22` | `E01` confirmation behavior | Connector triggers opt-in mode; success result and UI describe pending confirmation. |

## `N19` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N19-01` | `N11`, `N13`, `N14`, `N16`, `N17`, `N19`, `N20` | `D06` consent payload | Consent must travel from UI to policy and gate connector invocation. |
| `M-N19-02` | `N11`, `N12`, `N18`, `N19`, `N22` | `E01` duplicate semantics; `D03` result union | Provider duplicate must become explicit successful business outcome end to end. |
| `M-N19-03` | `N12`, `N18`, `N19`, `N22` | `E01` double-opt-in operation | External operation and success meaning change together, then UI reflects pending confirmation. |
| `M-N19-04` | `N01`, `N04`, `N11`, `N12`, `N18`, `N19`, `N20`, `N22`, `+SubscriptionQueue`, `+QueueConsumer` | New queue binding/effect; `D01` queue dispatch; deferred `E01` | Capability queues work, action reports queued state, Worker consumes later, connector effect moves to consumer. |

## `N20` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N20-01` | `N16`, `N17`, `N19`, `N20` | Public capability policy contract | Public validator changes shape; internal branch/result logic must consume reason codes. |
| `M-N20-02` | `N02`, `N03`, `N10`, `N11`, `N13`, `N14`, `N19`, `N20`, `N22` | `D02` context; `D06` form payload; `D08` headers | Command fields originate from form/context and terminate in policy, localization, diagnostics, and connector. |
| `M-N20-03` | `N11`, `N18`, `N19`, `N20`, `N22` | Capability API; `E01` duplicate semantics | Renamed business operation must also guarantee idempotent result across provider boundary. |

## `N21` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N21-01` | `N04`, `N21`, `N22` | `E01` audience assignment | Deployment value, connector contract, and provider request must agree. |
| `M-N21-02` | `N04`, `N21`, `N22` | `D08` target URL | Configurable base URL propagates from binding to connector HTTP target. |
| `M-N21-03` | `N02`, `N04`, `N21`, `N22` | Worker binding contract | Required type needs boundary validation and makes connector's runtime missing-key branch redundant/unreachable. |

## `N22` mutations

| Mutation | Required first-party changes | Contract/effect changes | Why coordinated |
|---|---|---|---|
| `M-N22-01` | `N04`, `N21`, `N22` | `E01` audience assignment | Connector needs configured audience and changes provider request. |
| `M-N22-02` | `N11`, `N12`, `N18`, `N19`, `N22` | `E01` duplicate response semantics; `D03` result union | Provider classification must survive capability and action layers to user-visible outcome. |
| `M-N22-03` | `N22` | `D08` retry/backoff usage; `D11` terminal errors | Connector owns provider retry policy; existing callers still await one semantic operation. |
| `M-N22-04` | `N02`, `N03`, `N10`, `N11`, `N19`, `N20`, `N22` | `D08` idempotency/correlation headers | Request identity originates at boundary and must propagate to connector; capability defines retry identity. |

## Change-set summary

### Most repeatedly changed current nodes

Qualitative pre-coupling signal only; exact weighted coupling belongs to workflow step 7.

| Node | Repeated reason |
|---|---|
| `N11 action` | Translates transport inputs/results for nearly every subscription requirement. |
| `N19 collectEmailSubscriber` | Owns policy/effect sequencing and business outcome semantics. |
| `N22 createResendContact` | Owns provider contract and external write behavior. |
| `N12 App` | Maps changed action outcomes into presentation state. |
| `N14 Hero` | Collects changed inputs and renders changed interaction/outcomes. |
| `N17 createInvalidEmailResult` | Carries evolving policy-failure semantics. |
| `N20 collectEmailSubscribers` | Stabilizes changing capability input/policy/execution contract. |

### Recurrent coordinated sets

```text
Consent:
N11 N13 N14 N16 N17 N19 N20

Structured outcomes:
N11 N12 N13 N14 N17 N18

Provider idempotency:
N11 N12 N18 N19 N22 E01

Request metadata:
N02 N03 N10 N11 N19 N20 N22

Provider configuration:
N04 N21 N22 E01

Pending/completed presentation:
N12 N13 N14 D03
```

## Result

- Mutations assigned change sets: **65 of 65**
- Existing first-party nodes considered: **22 of 22**
- Generic dependencies treated as contracts, not implementation members
- External effect changes explicitly identified
- New symbols named where current responsibility graph has no owner

Next workflow input: count repeated co-change across these sets to estimate behavioral change coupling.
