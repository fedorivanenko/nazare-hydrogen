# Plausible Behavioral Mutations

Workflow step 5 applied to causal cones defined in [`02-causal-cones.md`](./02-causal-cones.md), after infrastructure compression and semantic responsibility inference.

Each mutation is a counterfactual requirement change, not an implementation edit. IDs remain stable inputs for predicted change sets and coupling analysis.

## `N01` — Worker application surface

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N01-01` | Worker must expose a health-check request independently of storefront routing. | Health path returns service status without rendering React application. |
| `M-N01-02` | Worker must reject all requests when required deployment configuration is invalid. | Misconfigured deployment fails at request boundary instead of only during subscription. |

## `N02` — Worker request adapter

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N02-01` | Every request must receive a stable correlation ID in route context and response headers. | Logs, actions, connector calls, and response expose same request identity. |
| `M-N02-02` | Subscription POST requests must use a stricter execution timeout than document requests. | Slow provider calls terminate with controlled failure while page rendering remains unaffected. |
| `M-N02-03` | Requests must select tenant-specific environment values from hostname. | Same deployment routes subscriptions to tenant-specific provider configuration. |

## `N03` — Route-context environment injection

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N03-01` | Route context must expose a correlation ID alongside environment. | Action and connector diagnostics become traceable per request. |
| `M-N03-02` | Route context must expose a tenant-specific connector configuration rather than raw Worker environment. | Actions cannot access unrelated deployment bindings; provider selection varies by tenant. |
| `M-N03-03` | Route context must expose request locale for localized validation and failure messages. | Same validation outcome may produce locale-specific user text. |

## `N04` — Worker environment contract

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N04-01` | `RESEND_API_KEY` must be required at deployment boundary. | Missing credential becomes startup/request-boundary configuration failure. |
| `M-N04-02` | Deployment must configure both Resend API key and audience/list ID. | New contacts are assigned to configured audience rather than global contacts collection. |

## `N05` — Route topology

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N05-01` | Email subscription must use dedicated `/subscribe` action route. | Root page POST target and route dispatch topology change. |
| `M-N05-02` | Successful subscription must navigate to `/thanks`. | Success becomes route transition rather than inline status only. |
| `M-N05-03` | Storefront must expose a privacy route linked from subscription UI. | New navigable document surface accompanies data collection. |

## `N06` — Server document response

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N06-01` | Every HTML response must include a per-request Content Security Policy nonce. | Inline/client scripts work only with generated nonce; response headers and render context coordinate. |
| `M-N06-02` | Rendering aborted by client disconnect must not be reported as server failure. | Cancelled requests stop work without noisy error response/logging. |
| `M-N06-03` | HTML responses must include a correlation ID header. | Browser and operations can associate rendered response with server/connector diagnostics. |

## `N07` — Client-entry initialization

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N07-01` | Client hydration must wait until consent state has loaded. | Server HTML remains static briefly; interactive form activates only after consent initialization. |
| `M-N07-02` | Hydration bootstrap failures must render a recoverable user notice. | Broken client activation yields visible fallback instead of silent non-interactivity. |

## `N08` — Hydration callback

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N08-01` | Hydration must report recoverable React errors with request correlation ID. | Client rendering failures become traceable diagnostics. |
| `M-N08-02` | Email form must remain usable without JavaScript and enhance only after hydration. | Submission semantics stay server-compatible before and after client activation. |

## `N09` — Document layout

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N09-01` | Document language must follow request locale. | `<html lang>` and localized subscription messaging vary per request. |
| `M-N09-02` | Analytics scripts may load only after user consent. | Script placement and client initialization become consent-dependent. |
| `M-N09-03` | All pages must publish default title and description metadata. | Browser/search metadata exists even when route supplies none. |

## `N10` — Action-context contract

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N10-01` | Action context must provide a subscription capability instead of raw connector environment. | Route action invokes an injected behavior and no longer handles provider credentials. |
| `M-N10-02` | Action context must carry locale and correlation ID. | Action results localize messages and connector/log operations share trace identity. |

## `N11` — Subscription action

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N11-01` | Submission must include explicit marketing consent. | Missing consent returns validation failure and never calls provider. |
| `M-N11-02` | Repeated submissions from same client must be rate-limited. | Excess attempts return controlled failure without provider call. |
| `M-N11-03` | Unexpected failures must return a machine-readable error code while preserving safe public text. | UI and telemetry distinguish validation, throttling, configuration, and provider failure. |
| `M-N11-04` | Email normalization must include lowercase canonicalization before capability invocation. | Case variants produce same downstream subscriber identity. |

## `N12` — Root application composition

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N12-01` | UI must distinguish invalid input, duplicate contact, rate limit, and provider outage. | Different action result codes produce different messages. |
| `M-N12-02` | Successful submission must replace form with confirmation state. | Email input disappears after successful action result. |
| `M-N12-03` | Submission must show pending state before action completes. | Button disables and progress feedback appears during navigation. |

## `N13` — Hero presentation contract

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N13-01` | Email capture configuration must include marketing-consent label and privacy URL. | Callers must provide disclosure content required by form. |
| `M-N13-02` | Status must be structured by severity rather than plain string. | Hero can render success, validation, and system failures differently. |
| `M-N13-03` | Email capture must support pending and completed states. | Contract can disable submission and replace form after success. |

## `N14` — Hero UI

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N14-01` | User must check marketing-consent box before submission. | Form includes required consent field and disclosure link. |
| `M-N14-02` | Submit button must disable and announce progress while request is pending. | Duplicate clicks are reduced and assistive technology receives progress state. |
| `M-N14-03` | Successful subscription must hide form and show confirmation. | UI transitions from collection state to completed state. |
| `M-N14-04` | Status messages must use assertive announcement only for system failures. | Accessibility semantics vary with structured result severity. |

## `N15` — Email acceptance pattern

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N15-01` | Email policy must reject addresses lacking a two-character top-level domain. | Some currently accepted addresses fail before provider call. |
| `M-N15-02` | Email policy must accept valid internationalized addresses. | Some currently rejected Unicode addresses proceed to provider. |
| `M-N15-03` | Syntax pattern must remain permissive because provider owns full deliverability validation. | Only obviously malformed input is blocked locally. |

## `N16` — Email validation policy

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N16-01` | Validation must return a reason code instead of boolean. | Capability can distinguish missing, malformed, and disallowed input. |
| `M-N16-02` | Validation must reject disposable-email domains. | Syntactically valid disposable addresses no longer reach provider. |
| `M-N16-03` | Validation must require marketing consent in addition to valid email. | Policy input expands and consent failure prevents external write. |

## `N17` — Invalid-submission result

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N17-01` | Invalid result must include stable machine-readable reason code. | Presentation can choose specific localized guidance. |
| `M-N17-02` | Validation text must be localized outside capability. | Capability returns semantic reason, not fixed English sentence. |
| `M-N17-03` | Consent failure must be represented separately from invalid email. | User receives correct corrective action for each policy failure. |

## `N18` — Successful-collection result

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N18-01` | Success result must include provider contact ID. | Callers can correlate local success with Resend record. |
| `M-N18-02` | Existing contact must be reported as successful idempotent outcome distinct from creation. | Repeated signup does not appear as system failure. |
| `M-N18-03` | Double-opt-in mode must report `confirmation-pending` instead of `contact-created`. | UI tells user to check email rather than claiming completed subscription. |

## `N19` — Collect-email-subscriber orchestration

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N19-01` | Collection requires valid email plus explicit marketing consent. | Connector is never invoked without both policy conditions. |
| `M-N19-02` | Collection must be idempotent for already-existing contacts. | Provider duplicate response becomes successful existing-contact result. |
| `M-N19-03` | Collection must initiate double opt-in rather than immediately confirm subscription. | Success semantics become confirmation pending. |
| `M-N19-04` | Transient provider failures must be retried asynchronously rather than shown as immediate final failure. | Initial response reports queued state; provider effect may complete later. |

## `N20` — Capability boundary

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N20-01` | Capability must expose structured validation returning reason codes. | Consumers can inspect policy failures without executing collection. |
| `M-N20-02` | Capability execution must accept a structured command containing email, consent, locale, and correlation ID. | Behavior gains explicit input contract instead of positional parameters. |
| `M-N20-03` | Capability must expose idempotent `collect` semantics rather than provider-oriented execution naming. | Consumers depend on business operation while provider details remain hidden. |

## `N21` — Connector environment contract

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N21-01` | Connector requires audience/list ID in addition to API key. | Created contact is assigned to configured audience. |
| `M-N21-02` | Connector API base URL must be configurable for regional/test endpoints. | Same behavior can target different Resend-compatible environments. |
| `M-N21-03` | Connector credential must be mandatory rather than optional. | Missing key becomes contract/configuration error before connector execution. |

## `N22` — Resend connector

| Mutation | Counterfactual requirement | Observable consequence |
|---|---|---|
| `M-N22-01` | Contact creation must assign configured audience/list ID. | Provider request path or payload includes audience selection. |
| `M-N22-02` | Provider duplicate-contact response must become successful idempotent result. | Repeat subscription reports existing contact rather than generic outage. |
| `M-N22-03` | Connector must retry `429` and transient `5xx` responses with bounded backoff. | Temporary provider failures may succeed later; response latency/failure semantics change. |
| `M-N22-04` | Connector must send idempotency and correlation headers. | Provider writes deduplicate retries and diagnostics trace across boundary. |

## Mutation families crossing cones

These repeated requirement themes are intentional probes for later change-coupling estimation:

| Family | Mutations |
|---|---|
| Consent/privacy | `M-N07-01`, `M-N09-02`, `M-N11-01`, `M-N13-01`, `M-N14-01`, `M-N16-03`, `M-N17-03`, `M-N19-01`, `M-N20-02` |
| Correlation/diagnostics | `M-N02-01`, `M-N03-01`, `M-N06-03`, `M-N08-01`, `M-N10-02`, `M-N20-02`, `M-N22-04` |
| Localization | `M-N03-03`, `M-N09-01`, `M-N10-02`, `M-N17-02`, `M-N20-02` |
| Audience configuration | `M-N04-02`, `M-N21-01`, `M-N22-01` |
| Idempotency/duplicates | `M-N12-01`, `M-N18-02`, `M-N19-02`, `M-N20-03`, `M-N22-02`, `M-N22-04` |
| Double opt in | `M-N18-03`, `M-N19-03` |
| Structured outcomes | `M-N11-03`, `M-N12-01`, `M-N13-02`, `M-N14-04`, `M-N16-01`, `M-N17-01`, `M-N18-02`, `M-N20-01` |
| Pending/completed UI | `M-N12-02`, `M-N12-03`, `M-N13-03`, `M-N14-02`, `M-N14-03` |
| Dedicated subscription route | `M-N05-01`, with consequences for `N14`, `N11`, and `D03` |
| Provider resilience | `M-N02-02`, `M-N11-03`, `M-N19-04`, `M-N22-03` |

## Result

- Causal cones mutated: **22 of 22**
- Plausible behavioral mutations: **65**
- Cross-cone mutation families: **10**
- Generic infrastructure implementation mutations: **0**

Next workflow input: predict coordinated first-party symbol, contract, effect, and surface changes for each mutation.
