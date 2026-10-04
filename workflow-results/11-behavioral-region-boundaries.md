# Behavioral Region Boundaries and Relationships

Workflow step 11 applied to [`10-candidate-behavioral-regions.md`](./10-candidate-behavioral-regions.md).

Generic infrastructure capsules `D01–D11` remain dependencies, never region members. External provider `E01` remains an effect boundary. Shared first-party membership is intentional.

## 1. Boundary vocabulary

- **Member:** first-party symbol or control-flow fragment contributing region-owned decisions.
- **Surface:** callable/rendered/framework entry through which region is invoked or observed.
- **Input:** value or event entering region.
- **Output:** returned/rendered value leaving region.
- **Effect:** observable state change or I/O.
- **Dependency:** behavior used but not owned by region.
- **Shared member:** first-party node whose responsibility belongs to multiple overlapping regions.
- **Infrastructure:** compressed generic dependency capsule.

## 2. `CBR-01` — Subscribe visitor by email

### Members

```text
N11  action
N12  App
N13  HeroProps
N14  Hero
N15  EMAIL_PATTERN
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N18  createSubscriberCollectedResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
N22  createResendContact
```

### Surfaces

- `N14` email `Form` — user-facing submission surface.
- `N11 action` — React Router POST surface.
- `N20 collectEmailSubscribers.execute` — application capability surface.
- `N12 App`/`N14 Hero` — outcome presentation surface.

### Inputs

- visitor-supplied email form value;
- request action context containing connector environment;
- Resend credential/configuration;
- provider response.

### Outputs

- invalid-email result;
- successful collection result and connector evidence;
- safe unexpected-failure result;
- rendered success/failure status.

### Effects

- conditional Resend contact creation through `E01`;
- server diagnostic log on unexpected failure;
- visible UI state transition.

### Dependencies

- `CBR-07` for request/action context;
- `CBR-06` for provider-specific configuration and adapter behavior;
- `D03` React Router runtime;
- `D06` form/request primitives;
- `D08–D11` HTTP, JSON, normalization, and error/logging facilities.

### Relationships

- **Parent of:** `CBR-02`, `CBR-03`, `CBR-04`, `CBR-05`.
- **Activated client-side by:** `CBR-08`.
- **Overlaps:** `CBR-06` at `N22`.

## 3. `CBR-02` — Present email-capture interaction

### Members

```text
N12  App
N13  HeroProps
N14  Hero
```

### Surfaces

- `N12 App` root-route component.
- `N14 Hero` exported presentation component.
- email input and submit button rendered by `N14`.

### Inputs

- landing-page content;
- email-capture configuration;
- action-derived message/state.

### Outputs

- rendered hero content;
- named `email` form field;
- POST submission intent;
- accessible status content.

### Effects

- browser interaction and form submission only;
- no direct provider or persistence effect.

### Dependencies

- `D03` for `Form` and action-data transport;
- `D06` for browser form validation/encoding;
- `CBR-05` for outcome semantics;
- `CBR-08` for client activation.

### Relationships

- **Child of:** `CBR-01`.
- **Overlaps `CBR-05`:** `N12`, `N13`, `N14`.
- **Feeds:** `CBR-03` through router-mediated POST.

## 4. `CBR-03` — Process subscription submission

### Members

```text
N11  action
N15  EMAIL_PATTERN
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
```

### Surfaces

- `N11 action` — framework-invoked route surface.
- `N20 collectEmailSubscribers.execute` — capability invocation surface.

### Inputs

- POST `Request`;
- `ActionContext`;
- form field `email`;
- propagated capability/connector failure.

### Outputs

- capability success/validation result as action data;
- safe `{ok:false,error:"Could not subscribe right now."}` result for unexpected failure;
- server diagnostic log.

### Effects

- invokes subscriber collection;
- may indirectly create provider contact;
- logs unexpected errors.

### Dependencies

- `CBR-07` for `ActionContext` value;
- `CBR-04` for complete collection behavior;
- `D03` for action dispatch/result transport;
- `D06` for form parsing;
- `D10` for input normalization;
- `D11` for exception/logging behavior.

### Relationships

- **Child of:** `CBR-01`.
- **Contains secondary nesting of:** `CBR-09` invalid branch.
- **Overlaps `CBR-04`:** `N15`, `N16`, `N17`, `N19`, `N20`.
- **Overlaps `CBR-05`:** `N11`, `N17`.

## 5. `CBR-04` — Collect email subscriber

### Members

```text
N15  EMAIL_PATTERN
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N18  createSubscriberCollectedResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
N22  createResendContact
```

### Surfaces

- `N20 collectEmailSubscribers.policy["valid-email"]`.
- `N20 collectEmailSubscribers.execute`.

### Inputs

- normalized email string;
- `ResendConnectorEnv`;
- provider success/failure response.

### Outputs

- `{ok:false,error:"Enter a valid email address."}`;
- `{ok:true,evidence:{type,connector,result}}`;
- propagated connector exception.

### Effects

- zero external writes for policy-rejected input;
- exactly one attempted Resend contact creation for accepted input under current behavior;
- success emitted only after provider call resolves.

### Dependencies

- `CBR-06` for provider configuration and shared connector implementation;
- `D08` generic HTTP transport;
- `D09` JSON serialization;
- `D10` pattern matching/normalization;
- `D11` exception construction;
- `E01` Resend contact persistence.

### Relationships

- **Child of:** `CBR-01`.
- **Parent of:** `CBR-09`.
- **Overlaps `CBR-03`:** policy/orchestration members.
- **Overlaps `CBR-06`:** shared `N22` connector.
- **Produces inputs for:** `CBR-05`.

## 6. `CBR-05` — Present subscription outcome

### Members

```text
N11  action
N12  App
N13  HeroProps
N14  Hero
N17  createInvalidEmailResult
N18  createSubscriberCollectedResult
```

### Surfaces

- action-data result emitted by `N11`;
- `N12 useActionData<typeof action>()` consumption;
- `N14` status paragraph with `role="status"`.

### Inputs

- no action result;
- validation failure;
- successful collection evidence;
- unexpected system/provider failure.

### Outputs

- no status before submission;
- `Subscribed.` for successful result;
- returned validation/system failure text otherwise;
- accessible status rendering.

### Effects

- user-visible feedback only;
- no direct persistence or provider effect.

### Dependencies

- `CBR-04` for semantic outcomes;
- `D03` for action-result transport and rerendering;
- `CBR-08` for hydrated updates.

### Relationships

- **Child of:** `CBR-01`.
- **Overlaps `CBR-02`:** `N12`, `N13`, `N14`.
- **Overlaps `CBR-03`:** `N11`, `N17`.
- **Consumes results from:** `CBR-04`.

## 7. `CBR-06` — Create Resend contact

### Members

```text
N04  Env
N21  ResendConnectorEnv
N22  createResendContact
```

### Surfaces

- `N22 createResendContact(email, env)`.
- Worker deployment bindings represented by `N04`.

### Inputs

- email string;
- optional `RESEND_API_KEY` under current contract;
- provider HTTP status/body.

### Outputs

- parsed `{id:string}` provider result;
- missing-key exception;
- non-OK provider exception containing status/details.

### Effects

- authenticated `POST https://api.resend.com/contacts`;
- external contact creation in `E01`.

### Dependencies

- `D08` HTTP client;
- `D09` JSON serialization;
- `D10` email trimming;
- `D11` errors;
- `E01` provider contract.

### Relationships

- **Overlaps `CBR-04`:** shared `N22`.
- **Used by:** `CBR-01` and `CBR-04`.
- **Not child of `CBR-01`:** provider adapter can evolve independently and is reusable outside current UI journey.

## 8. `CBR-07` — Propagate request execution context

### Members

```text
N02  server fetch adapter
N03  getLoadContext
N10  ActionContext
```

### Surfaces

- `N02 fetch(request, env)`.
- `N03 getLoadContext` callback.
- `N10` route-action context contract.

### Inputs

- Worker `Request`;
- deployment `Env`;
- future request-scoped metadata such as locale/correlation/deadline.

### Outputs

- route context currently shaped as `{env}`;
- `ActionContext` value supplied to `N11`.

### Effects

- no domain write;
- controls which dependencies/configuration are available during route behavior.

### Dependencies

- `N04 Env` as input contract, not member;
- `D01` Worker dispatch;
- `D02` Hydrogen request bridge;
- `D03` React Router context transport.

### Relationships

- **Supplies:** `CBR-03` and `CBR-01`.
- **Shared application infrastructure:** not a child of email-subscription behavior.
- **Fragmented boundary:** `N03` producer and `N10` consumer lack shared declaration.

## 9. `CBR-08` — Activate storefront client

### Members

```text
N07  client module initialization
N08  hydration callback
N09  Layout
```

### Surfaces

- browser-loaded `app/entry.client.tsx` module;
- React Router document `Layout`.

### Inputs

- server-rendered `document`;
- serialized router state;
- rendered route children.

### Outputs

- hydrated router tree;
- active navigation/form behavior;
- document metadata/scripts/restoration integration.

### Effects

- attaches React event behavior to existing DOM;
- updates browser UI after navigation/actions.

### Dependencies

- `D03` React Router runtime;
- `D05` React scheduling/hydration;
- browser DOM.

### Relationships

- **Activates client execution of:** `CBR-02` and `CBR-05`.
- **Shared application infrastructure:** separate from domain behavior.
- **Tentative region:** low mutation sample support.

## 10. `CBR-09` — Reject invalid subscriber email

### Members

```text
N15  EMAIL_PATTERN
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19.invalid-branch  control-flow fragment
```

### Surfaces

- `N20.policy["valid-email"]` references validator but remains parent-region surface.
- invalid branch reached through `N20.execute`.

### Inputs

- normalized email string.

### Outputs

- boolean policy decision;
- stable invalid-email result.

### Effects

- explicit absence of `E01` contact creation;
- no provider/network call on rejected input.

### Dependencies

- `D10` regular-expression execution;
- parent orchestration in `CBR-04`.

### Relationships

- **Primary child of:** `CBR-04`.
- **Also nested within:** `CBR-03` submission processing.
- **Shares:** `N15`, `N16`, `N17`, and invalid fragment of `N19` with parents.

## 11. Shared-member matrix

| Node | Regions |
|---|---|
| `N02` | `CBR-07` |
| `N03` | `CBR-07` |
| `N04` | `CBR-06` |
| `N07` | `CBR-08` |
| `N08` | `CBR-08` |
| `N09` | `CBR-08` |
| `N10` | `CBR-07` |
| `N11` | `CBR-01`, `CBR-03`, `CBR-05` |
| `N12` | `CBR-01`, `CBR-02`, `CBR-05` |
| `N13` | `CBR-01`, `CBR-02`, `CBR-05` |
| `N14` | `CBR-01`, `CBR-02`, `CBR-05` |
| `N15` | `CBR-01`, `CBR-03`, `CBR-04`, `CBR-09` |
| `N16` | `CBR-01`, `CBR-03`, `CBR-04`, `CBR-09` |
| `N17` | `CBR-01`, `CBR-03`, `CBR-04`, `CBR-05`, `CBR-09` |
| `N18` | `CBR-01`, `CBR-04`, `CBR-05` |
| `N19` | `CBR-01`, `CBR-03`, `CBR-04`; invalid fragment in `CBR-09` |
| `N20` | `CBR-01`, `CBR-03`, `CBR-04` |
| `N21` | `CBR-06` |
| `N22` | `CBR-01`, `CBR-04`, `CBR-06` |

Unassigned first-party nodes:

- `N01` Worker default export — protocol shell;
- `N05` route manifest — route configuration surface;
- `N06` server document renderer — rendering adapter.

They remain graph surfaces/dependencies, not Behavioral Region members under current evidence.

## 12. Region relationship graph

```text
CBR-08 Activate storefront client
├─ activates → CBR-02 Present email-capture interaction
└─ activates → CBR-05 Present subscription outcome

CBR-07 Propagate request execution context
└─ supplies → CBR-03 Process subscription submission

CBR-01 Subscribe visitor by email
├─ child → CBR-02 Present email-capture interaction
├─ child → CBR-03 Process subscription submission
├─ child → CBR-04 Collect email subscriber
│  └─ child → CBR-09 Reject invalid subscriber email
└─ child → CBR-05 Present subscription outcome

CBR-02 ──POST──→ CBR-03
CBR-03 ──invoke──→ CBR-04
CBR-04 ──result──→ CBR-05
CBR-04 ∩ CBR-06 = N22
CBR-06 ──effect──→ E01 Resend contacts API
```

## 13. Shared infrastructure

| Capsule | Regions depending on it |
|---|---|
| `D01` Worker dispatch | `CBR-07` |
| `D02` Hydrogen request bridge | `CBR-07` |
| `D03` React Router | `CBR-01`, `CBR-02`, `CBR-03`, `CBR-05`, `CBR-07`, `CBR-08` |
| `D04` React server rendering | none directly; unassigned `N06` adapter |
| `D05` React hydration | `CBR-08` |
| `D06` form/request primitives | `CBR-01`, `CBR-02`, `CBR-03` |
| `D07` response primitives | none directly; unassigned `N06` adapter |
| `D08` HTTP client | `CBR-01`, `CBR-04`, `CBR-06` |
| `D09` JSON | `CBR-01`, `CBR-04`, `CBR-06` |
| `D10` normalization/pattern matching | `CBR-01`, `CBR-03`, `CBR-04`, `CBR-06`, `CBR-09` |
| `D11` errors/logging | `CBR-01`, `CBR-03`, `CBR-04`, `CBR-06` |

## Result

- Regions bounded: **9**
- Explicit parent/child links: **6**
- Explicit overlap relationships: **4 primary overlaps**
- Shared infrastructure capsules: **11**, all non-members
- External effects: **1**, `E01`
- Unassigned protocol/adapter nodes: **3**
