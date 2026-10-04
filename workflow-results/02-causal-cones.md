# Causal Cones

Generated from roots in [`01-meaningful-symbol-roots.md`](./01-meaningful-symbol-roots.md).

Scope: first-party application runtime. Each cone records upstream triggers and inputs, downstream control/data flow, observable outcomes, and unresolved framework-mediated edges. Cones intentionally overlap.

## Runtime roots

### `server.ts::default`

- **Upstream:** Oxygen/Worker runtime module loading and request dispatch.
- **Inputs:** `Request`, `Env`.
- **Downstream:** `default.fetch` → Hydrogen `createRequestHandler` → React Router server build → route action or document rendering.
- **Observable output:** HTTP `Response` returned to Worker runtime.
- **Dynamic edge:** Worker runtime discovers the default object and its `fetch` method by convention.

### `server.ts::default.fetch`

- **Upstream:** Worker runtime invokes `fetch(request, env)` through `server.ts::default`.
- **Inputs:** incoming `Request`; `Env.RESEND_API_KEY`; imported virtual React Router `build`.
- **Control/data flow:** creates `handleRequest` with `build` and `getLoadContext`; invokes it with the original request.
- **Downstream:**
  - document request → React Router → `app/entry.server.tsx::handleRequest`;
  - form POST → React Router → `app/root.tsx::action`;
  - `env` → `getLoadContext` → action context → email capability → Resend connector.
- **Observable output:** route-generated HTTP `Response`.

### `server.ts::default.fetch/createRequestHandler.getLoadContext`

- **Upstream:** closure created by `default.fetch`; invoked by Hydrogen/React Router.
- **Inputs:** captured `env`.
- **Downstream:** returns `{env}` → route `context` → `action` → `collectEmailSubscribers.execute` → `createResendContact`.
- **Observable influence:** determines credentials available to the subscription request.
- **Dynamic edge:** framework controls callback invocation and context propagation.

### `app/routes.ts::default`

- **Upstream:** React Router build scans `app/routes.ts`.
- **Value:** empty `RouteConfig` array.
- **Downstream:** creates no child routes; framework still installs `app/root.tsx` as root route.
- **Observable influence:** all current page rendering and POST handling resolve through root route; adding entries would change route matching and reachable behavior.
- **Dynamic edge:** build-time route-manifest discovery.

### `app/entry.server.tsx::handleRequest`

- **Upstream:** React Router server handler supplies `request`, `status`, `headers`, and `EntryContext` for a document response.
- **Inputs:** `request.url`, `request.signal`, route context, response status and headers.
- **Control/data flow:** constructs `ServerRouter` → calls `renderToReadableStream` → mutates `headers` with `Content-Type: text/html` → constructs `Response`.
- **Downstream first-party rendering:** React Router root route → `Layout` + `App` → `Hero`.
- **Observable output:** streamed HTML response with supplied status and headers.
- **Dynamic edge:** React Router invokes default export by convention.

### `app/entry.client.tsx::<module-init>`

- **Upstream:** browser loads generated client entry bundle after receiving HTML.
- **Inputs:** global `document`; server-rendered React Router state.
- **Downstream:** calls `startTransition` with synthetic transition callback.
- **Observable output:** begins client hydration.
- **Dynamic edge:** bundler/framework selects this module as client entry.

### `app/entry.client.tsx::<module-init>/startTransition.callback`

- **Upstream:** React executes callback scheduled by `startTransition`.
- **Inputs:** global `document`.
- **Control/data flow:** `hydrateRoot(document, <StrictMode><HydratedRouter /></StrictMode>)`.
- **Downstream first-party rendering:** `HydratedRouter` → root route → `Layout` + `App` → `Hero`.
- **Observable output:** interactive hydrated document; subsequent form navigation/action-data updates.
- **Dynamic edge:** React and React Router own callback execution and route reconstruction.

### `app/root.tsx::Layout`

- **Upstream:** React Router renders root document layout during SSR and hydration.
- **Inputs:** `children`, normally rendered `App` route content.
- **Control/data flow:** wraps children in HTML structure; emits metadata/link integration; installs scroll restoration and client scripts.
- **Downstream:** `Meta`, `Links`, `ScrollRestoration`, `Scripts`, and child render tree.
- **Observable output:** document language, charset, viewport, body styling, content placement, restoration behavior, and script tags.

### `app/root.tsx::action`

- **Upstream:** POST from `Hero`'s React Router `Form`; React Router injects `request` and context.
- **Inputs:** form field `email`; `ActionContext.env`.
- **Control/data flow:**
  1. `request.formData()`;
  2. reads `email`, coerces to string, trims whitespace;
  3. calls `collectEmailSubscribers.execute(email, context.env)`;
  4. catches connector/capability exceptions and logs them.
- **Downstream success/validation:** capability result → React Router action data → `App` → `Hero.message`.
- **Downstream exception:** `console.error` + `{ok:false,error:"Could not subscribe right now."}`.
- **Observable outputs:** action response data; user-facing status message; server log; possible Resend API write.
- **Dynamic edge:** React Router maps root-route POST to exported `action`.

### `app/root.tsx::App`

- **Upstream:** React Router renders root route during SSR/hydration and rerenders it after action completion.
- **Inputs:** `useActionData<typeof action>()` result.
- **Control/data flow:** selects message:
  - successful action → `"Subscribed."`;
  - failed action → returned error;
  - no action result → `undefined`.
- **Downstream:** calls `Hero` with static content, enabled email capture, and selected message.
- **Observable output:** landing-page content, subscription form, and action status.

### `app/carcass/sections/Hero.tsx::Hero`

- **Upstream:** `App` supplies `HeroProps`.
- **Inputs:** `eyebrow`, required `heading`, `body`, optional `emailCapture`, optional `message`.
- **Control/data flow:** conditionally renders eyebrow, body, form, and status; selects default placeholder/button labels.
- **Downstream:** React Router `Form(method="post")`; required email input named `email`; submit button; status paragraph.
- **Observable outputs:** rendered hero content and browser-side required/email validation.
- **Framework edge:** form submission → root-route `action`; returned action data → `App` → `message`.

### `app/capabilities/collect-email-subscribers.ts::EMAIL_PATTERN`

- **Upstream:** literal regular-expression definition.
- **Downstream:** `validateSubscriberEmail` calls `.test(email)` → `collectEmailSubscriber` branch.
- **Observable influence:** determines whether input produces validation error or reaches Resend API.

### `app/capabilities/collect-email-subscribers.ts::validateSubscriberEmail`

- **Upstream:** exposed through `collectEmailSubscribers.policy["valid-email"]`; called by `collectEmailSubscriber`.
- **Inputs:** normalized email string from `action`.
- **Control/data flow:** tests input against `EMAIL_PATTERN`.
- **Downstream:** boolean controls invalid-result return versus connector call.
- **Observable output:** validation decision.

### `app/capabilities/collect-email-subscribers.ts::createInvalidEmailResult`

- **Upstream:** `collectEmailSubscriber` invokes it when validation fails.
- **Downstream:** returns `{ok:false,error:"Enter a valid email address."}` → `action` → action data → `App` → `Hero.message`.
- **Observable output:** invalid-email user message; prevents Resend API call.

### `app/capabilities/collect-email-subscribers.ts::createSubscriberCollectedResult`

- **Upstream:** `collectEmailSubscriber` invokes it after successful connector completion.
- **Downstream:** returns success plus connector evidence → `action`; `ok` reaches `App`; evidence remains in action data but is not currently rendered.
- **Observable output:** causes `"Subscribed."` UI state.
- **Stored evidence:** connector `provider.resend.contacts.create`, result `contact-created`.

### `app/capabilities/collect-email-subscribers.ts::collectEmailSubscriber`

- **Upstream:** exported as `collectEmailSubscribers.execute`; called by root `action`.
- **Inputs:** trimmed email string; `ResendConnectorEnv`.
- **Control/data flow:**
  - invalid email → `createInvalidEmailResult`;
  - valid email → await `createResendContact` → `createSubscriberCollectedResult`;
  - connector exception propagates to `action` catch.
- **Downstream effects:** optional Resend contact creation; validation/success/failure result.
- **Observable outputs:** action data and resulting UI status.

### `app/capabilities/collect-email-subscribers.ts::collectEmailSubscribers`

- **Upstream:** imported by `app/root.tsx`.
- **Contract assembly:**
  - `policy["valid-email"]` aliases `validateSubscriberEmail`;
  - `execute` aliases `collectEmailSubscriber`.
- **Downstream:** `action` invokes `.execute`; potential policy consumers may invoke validator directly.
- **Observable influence:** stable capability API joining policy and execution behavior.

### `app/connectors/resend.server.ts::createResendContact`

- **Upstream:** valid branch of `collectEmailSubscriber`.
- **Inputs:** email; `ResendConnectorEnv.RESEND_API_KEY`.
- **Control/data flow:**
  1. missing key → throws `"RESEND_API_KEY is not configured"`;
  2. otherwise POSTs to `https://api.resend.com/contacts` with Bearer authorization and JSON body;
  3. body uses `email.trim()` and `unsubscribed:false`;
  4. non-OK response → reads text and throws status/details error;
  5. OK response → parses JSON as `{id:string}`.
- **Downstream:** success returns to `collectEmailSubscriber`; errors propagate to `action` catch.
- **Observable effects:** external Resend contact write, network traffic, user success/failure message, server error log.

## Contract roots

### `server.ts::Env`

- **Upstream:** Oxygen runtime environment binding configuration.
- **Shape:** optional `RESEND_API_KEY`.
- **Downstream:** types `default.fetch` environment → captured by `getLoadContext` → structurally supplies `ActionContext.env` → `createResendContact` authorization.
- **Coordinated-change boundary:** Worker bindings, route context, connector environment, deployment secrets.

### `app/connectors/resend.server.ts::ResendConnectorEnv`

- **Upstream:** connector credential requirements.
- **Shape:** optional `RESEND_API_KEY`.
- **Downstream:** types `createResendContact`, `collectEmailSubscriber`, and `ActionContext.env`.
- **Coordinated-change boundary:** changing credential requirements affects Worker `Env`, context propagation, capability execution, and connector implementation.

### `app/root.tsx::ActionContext`

- **Upstream:** object returned by `getLoadContext`.
- **Shape:** `{env: ResendConnectorEnv}`.
- **Downstream:** types `action.context`; action passes `context.env` into `collectEmailSubscribers.execute`.
- **Coordinated-change boundary:** server adapter and route action must agree on context structure.

### `app/carcass/sections/Hero.tsx::HeroProps`

- **Upstream:** values assembled by `App`.
- **Shape:** content fields, optional email-capture configuration, optional status message.
- **Downstream:** controls all conditional rendering and form labels in `Hero`.
- **Coordinated-change boundary:** changes require matching updates to `App` call sites and `Hero` rendering behavior.

## Cross-cone graph

```text
Oxygen request
└─ server.ts::default
   └─ default.fetch
      ├─ getLoadContext ─────────────────────────────────────────┐
      │                                                          │
      └─ Hydrogen/React Router                                  │
         ├─ document request                                    │
         │  └─ handleRequest                                    │
         │     └─ Layout + App → Hero                            │
         │                                                       │
         └─ form POST                                            │
            └─ action ← ActionContext ←──────────────────────────┘
               └─ collectEmailSubscribers.execute
                  └─ collectEmailSubscriber
                     ├─ validateSubscriberEmail
                     │  └─ EMAIL_PATTERN
                     ├─ createInvalidEmailResult
                     └─ createResendContact
                        └─ Resend API
                           └─ createSubscriberCollectedResult

Browser module load
└─ entry.client module init
   └─ startTransition callback
      └─ hydrateRoot
         └─ Layout + App → Hero

Hero Form POST ──framework──→ action
action data ──framework──→ App ─→ Hero.message
```

## Unresolved dynamic edges

These edges are explicit rather than silently omitted:

- Oxygen runtime → `server.ts::default.fetch`.
- Hydrogen/React Router handler → root action or document renderer.
- React Router document renderer → `app/entry.server.tsx::handleRequest`.
- Browser entry discovery → `app/entry.client.tsx::<module-init>`.
- `HydratedRouter`/`ServerRouter` → `Layout`, `App`, and `Hero` render calls.
- `Hero` form submission → `app/root.tsx::action`.
- Action result transport → `useActionData` in `App`.

No recursive first-party SCCs detected.
