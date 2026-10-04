# Semantic Responsibilities

Workflow step 4 applied to [`03-compressed-infrastructure.md`](./03-compressed-infrastructure.md).

Question answered for every retained graph node and edge: **What does this contribute to observable behavior?**

## 1. First-party node responsibilities

| ID | Symbol | Semantic responsibility |
|---|---|---|
| `N01` | `server.ts::default` | Publishes application as Worker-compatible request target. |
| `N02` | `server.ts::default.fetch` | Adapts each Worker request and environment to Hydrogen/React Router request handling and returns resulting response. |
| `N03` | `server.ts::default.fetch/createRequestHandler.getLoadContext` | Injects request-scoped deployment environment into route execution context. |
| `N04` | `server.ts::Env` | Declares deployment credential contract accepted at Worker boundary. |
| `N05` | `app/routes.ts::default` | Declares no child routes, leaving all current document and action behavior on root route. |
| `N06` | `app/entry.server.tsx::handleRequest` | Turns matched React Router state into streamed HTML response with correct content type, status, headers, URL, and cancellation signal. |
| `N07` | `app/entry.client.tsx::<module-init>` | Starts browser-side activation of server-rendered application. |
| `N08` | `app/entry.client.tsx::<module-init>/startTransition.callback` | Hydrates document through React Router without replacing server-rendered markup. |
| `N09` | `app/root.tsx::Layout` | Defines persistent HTML shell, metadata/link insertion points, body defaults, scroll restoration, and client-script placement. |
| `N10` | `app/root.tsx::ActionContext` | Declares route action's dependency on connector environment supplied by server adapter. |
| `N11` | `app/root.tsx::action` | Translates form submission into capability invocation and translates unexpected capability/connector failure into stable user-facing failure data. |
| `N12` | `app/root.tsx::App` | Composes landing-page content and maps action outcome to user-visible subscription status. |
| `N13` | `app/carcass/sections/Hero.tsx::HeroProps` | Defines configurable content, optional email-capture behavior, and optional status contract for hero UI. |
| `N14` | `app/carcass/sections/Hero.tsx::Hero` | Renders landing content, conditionally exposes email subscription input, initiates POST, and presents status accessibly. |
| `N15` | `app/capabilities/collect-email-subscribers.ts::EMAIL_PATTERN` | Encodes minimum accepted email shape. |
| `N16` | `app/capabilities/collect-email-subscribers.ts::validateSubscriberEmail` | Applies email-shape policy and produces capability branch decision. |
| `N17` | `app/capabilities/collect-email-subscribers.ts::createInvalidEmailResult` | Defines stable validation-failure result and user-facing guidance without external write. |
| `N18` | `app/capabilities/collect-email-subscribers.ts::createSubscriberCollectedResult` | Defines successful capability result and provenance evidence after external write succeeds. |
| `N19` | `app/capabilities/collect-email-subscribers.ts::collectEmailSubscriber` | Orchestrates validation, prevents invalid external writes, waits for contact creation, and reports success only afterward. |
| `N20` | `app/capabilities/collect-email-subscribers.ts::collectEmailSubscribers` | Publishes stable capability boundary combining explicit policy and executable operation. |
| `N21` | `app/connectors/resend.server.ts::ResendConnectorEnv` | Declares credential required by Resend adapter and propagated through capability/action boundaries. |
| `N22` | `app/connectors/resend.server.ts::createResendContact` | Converts valid email and credential into Resend contact-creation request, rejects missing credentials/non-success responses, and decodes successful provider result. |

## 2. Generic dependency responsibilities

| ID | Capsule | Semantic responsibility |
|---|---|---|
| `D01` | Worker request dispatch | Discovers Worker export, invokes request handler, and transports final response. |
| `D02` | Hydrogen request-handler bridge | Connects Worker request handling, generated React Router build, and route context creation. |
| `D03` | React Router runtime | Matches routes, invokes root action/render surfaces, transports action data, and connects form/navigation behavior. |
| `D04` | React server rendering | Converts React route tree into cancellable HTML stream. |
| `D05` | React client scheduling and hydration | Schedules hydration and binds React behavior to existing document. |
| `D06` | Web request and form primitives | Encodes/submits form values, performs browser constraints, and parses POST body into fields. |
| `D07` | Web response primitives | Applies response headers/status and packages HTML stream as HTTP response. |
| `D08` | Generic HTTP client | Transports connector request to provider and returns status/body. |
| `D09` | JSON serialization | Encodes connector request body and decodes successful provider payload. |
| `D10` | Scalar normalization and pattern matching | Coerces/trims email input and executes validation pattern. |
| `D11` | Generic error and logging facilities | Carries exceptional control flow and records server diagnostics. |

## 3. External effect responsibility

| ID | Boundary | Semantic responsibility |
|---|---|---|
| `E01` | Resend contacts API | Persists subscription contact in external provider and reports provider success/failure. |

## 4. Edge responsibilities

### Worker and server adapter

| ID | Edge | Semantic contribution |
|---|---|---|
| `E001` | `D01 → N01` | Makes default export externally reachable as application request target. |
| `E002` | `N01 → N02` | Exposes `fetch` as target's request operation. |
| `E003` | `N04 → N02` | Constrains environment accepted by request operation to declared binding shape. |
| `E004` | `N02 → D02` | Delegates request routing/rendering while supplying application build and context factory. |
| `E005` | `N02 → N03` | Captures current request's environment for later framework callback. |
| `E006` | `N03 → D02` | Supplies `{env}` as route load/action context. |
| `E007` | `D02 → D03` | Transfers Worker request and context into route matching and execution. |
| `E008` | `D03 → N02` | Returns route-generated response through request adapter. |
| `E009` | `N02 → D01` | Returns completed response to Worker transport. |

### Route topology and document rendering

| ID | Edge | Semantic contribution |
|---|---|---|
| `E010` | `N05 → D03` | Configures route topology with no child routes, making root route sole current behavior surface. |
| `E011` | `D03 → N06` | Invokes server entry for matched document request with route context/status/headers. |
| `E012` | `N06 → D04` | Requests streamed rendering using current router state, URL, and abort signal. |
| `E013` | `D04 → N09` | Renders persistent document shell. |
| `E014` | `D04 → N12` | Renders current root-route application content. |
| `E015` | `N09 → N12` | Places route application output inside document body. |
| `E016` | `N09 → D03` | Installs framework metadata, links, scroll restoration, and scripts in shell. |
| `E017` | `N06 → D07` | Sets HTML content type and packages rendered stream with route status/headers. |
| `E018` | `D07 → D03` | Returns document response to router request lifecycle. |

### Client hydration

| ID | Edge | Semantic contribution |
|---|---|---|
| `E019` | browser bundle load `→ N07` | Starts first-party client execution after document load. |
| `E020` | `N07 → D05` | Requests transitional execution of hydration callback. |
| `E021` | `D05 → N08` | Executes scheduled application hydration work. |
| `E022` | `N08 → D05` | Supplies document and hydrated-router element to hydration engine. |
| `E023` | `D05 → D03` | Activates client router against server-rendered route state. |
| `E024` | `D03 → N09` | Reconstructs/hydrates document shell behavior. |
| `E025` | `D03 → N12` | Reconstructs/hydrates root application behavior. |

### UI composition and form flow

| ID | Edge | Semantic contribution |
|---|---|---|
| `E026` | `N13 → N14` | Defines values and optional features `Hero` may consume. |
| `E027` | `N12 → N14` | Supplies landing content, enables email capture, and supplies derived status. |
| `E028` | `N14 → D06` | Declares required email field and emits user submission payload. |
| `E029` | `N14 → D03` | Binds form submission to current root route through router `Form`. |
| `E030` | `D06 → D03` | Delivers encoded POST request containing `email`. |
| `E031` | `D03 → N11` | Dispatches root-route POST to exported action with request/context. |
| `E032` | `N10 → N11` | Defines action context shape and environment availability. |
| `E033` | `N03 → N10` | Provides runtime value expected by action context contract. |
| `E034` | `N11 → D06` | Parses form body and retrieves submitted `email` field. |
| `E035` | `N11 → D10` | Coerces missing/arbitrary form value and trims outer whitespace. |
| `E036` | `N11 → D03` | Returns typed success/failure action data to router transport. |
| `E037` | `D03 → N12` | Makes latest action result available through `useActionData`. |
| `E038` | `N12 → N14` | Maps result to `Subscribed.`, returned error, or absent status. |

### Capability policy and execution

| ID | Edge | Semantic contribution |
|---|---|---|
| `E039` | `N20 → N16` | Exposes email validation as named capability policy. |
| `E040` | `N20 → N19` | Exposes subscriber collection as capability execution operation. |
| `E041` | `N11 → N20` | Invokes capability through stable exported boundary rather than implementation helper. |
| `E042` | `N15 → N16` | Supplies exact accepted-email pattern. |
| `E043` | `N16 → D10` | Executes pattern against normalized email. |
| `E044` | `N16 → N19` | Determines invalid-result versus external-write branch. |
| `E045` | `N19 → N17` | Produces stable validation failure when policy rejects input. |
| `E046` | `N17 → N11` | Returns validation result without connector invocation. |
| `E047` | `N19 → N22` | Requests provider contact creation only for policy-accepted email. |
| `E048` | `N22 → N19` | Signals successful completion or propagates connector exception. |
| `E049` | `N19 → N18` | Produces capability success only after connector resolves. |
| `E050` | `N18 → N11` | Returns success/evidence through action boundary. |

### Connector and external effect

| ID | Edge | Semantic contribution |
|---|---|---|
| `E051` | `N21 → N22` | Defines connector credential input. |
| `E052` | `N21 → N19` | Requires capability execution to accept environment sufficient for connector. |
| `E053` | `N21 → N10` | Aligns action context environment with connector requirement. |
| `E054` | `N04 → N21` | Structurally satisfies connector credential contract from deployment binding. |
| `E055` | `N22 → D10` | Trims email again at provider boundary. |
| `E056` | `N22 → D09` | Encodes contact payload and decodes success payload. |
| `E057` | `N22 → D08` | Sends authenticated POST and receives provider response. |
| `E058` | `D08 → E01` | Carries contact-creation request to Resend. |
| `E059` | `E01 → D08` | Returns provider status and response body. |
| `E060` | `N22 → D11` | Throws explicit errors for absent credentials and non-OK provider responses. |
| `E061` | `D11 → N11` | Propagates connector failure to action catch. |
| `E062` | `N11 → D11` | Logs original error before replacing it with stable public failure result. |
| `E063` | `N11 → D03` | Returns `Could not subscribe right now.` after unexpected failure. |

## 5. Semantic summary

Graph expresses three top-level responsibilities:

1. **Serve and hydrate storefront:** `N01–N09`, `N12`, `N14`.
2. **Collect valid email subscribers:** `N11`, `N15–N20`.
3. **Create provider contact safely:** `N03`, `N04`, `N10`, `N21`, `N22`, `E01`.

Generic dependencies transport requests, renders, data, and effects; they do not own application policy. All **22 first-party roots**, **11 dependency capsules**, **1 external effect**, and **63 semantic edges** now have explicit responsibilities.
