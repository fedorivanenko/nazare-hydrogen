# Compressed Generic Infrastructure

Workflow step 3 applied to [`02-causal-cones.md`](./02-causal-cones.md).

Compression replaces generic implementation subgraphs with dependency capsules. Capsules remain graph dependencies with preserved inputs, outputs, effects, and framework-mediated edges; their internals cannot become Behavioral Region members.

## 1. Compression rule

A node is compressed when all conditions hold:

1. implementation is external or generic platform machinery;
2. behavior is reusable across unrelated application responsibilities;
3. application code depends on its contract rather than its internal decisions;
4. no project-specific policy is implemented inside it.

Project-owned adapters remain uncompressed when they encode application wiring, contracts, response policy, credentials, or domain effects.

## 2. Dependency capsules

### `INFRA-01` — Worker request dispatch

- **Contains:** Oxygen/Worker module discovery and `fetch` dispatch internals.
- **Contract:** default module export with `fetch(Request, Env) → Response`.
- **Preserved edge:** runtime → `server.ts::default.fetch`.
- **Effect:** starts and completes HTTP request lifecycle.

### `INFRA-02` — Hydrogen request-handler bridge

- **Contains:** `createRequestHandler` internals and virtual server-build interpretation.
- **Contract:** `{build, getLoadContext} → (Request → Response)`.
- **Preserved edges:** `server.ts::default.fetch` → route dispatch; `getLoadContext` → route context.

### `INFRA-03` — React Router runtime

- **Contains:** route matching, root-route conventions, `Form`, action invocation, action-result transport, `useActionData`, `ServerRouter`, `HydratedRouter`, `Meta`, `Links`, `ScrollRestoration`, and `Scripts` internals.
- **Preserved edges:**
  - route manifest → route topology;
  - form POST → `app/root.tsx::action`;
  - action result → `app/root.tsx::App`;
  - server/client router → `Layout` and `App`;
  - request handler → `handleRequest`.
- **Effects:** navigation, route execution, render orchestration, action-data delivery.

### `INFRA-04` — React server rendering

- **Contains:** `renderToReadableStream` and React reconciliation internals.
- **Contract:** React element + abort signal → readable HTML stream.
- **Preserved edge:** `handleRequest` → rendered `Layout`/`App`/`Hero` tree.
- **Effect:** streamed HTML generation.

### `INFRA-05` — React client scheduling and hydration

- **Contains:** `startTransition`, `hydrateRoot`, `StrictMode`, and reconciliation internals.
- **Contract:** existing document + React router element → hydrated UI.
- **Preserved edge:** client module initialization → hydrated `Layout`/`App`/`Hero` tree.
- **Effect:** browser interactivity and rerendering.

### `INFRA-06` — Web request and form primitives

- **Contains:** `Request.formData`, `FormData.get`, browser required/email checks, and form encoding internals.
- **Contract:** incoming POST body → named field values.
- **Preserved edge:** `Hero` email input → `action` email value.
- **Effect:** request-body parsing and browser-side constraint validation.

### `INFRA-07` — Web response primitives

- **Contains:** `Headers.set`, `Response` construction, and stream transport internals.
- **Contract:** body + status + headers → HTTP response.
- **Preserved edge:** `handleRequest` → Worker response.
- **Effect:** response-header mutation and response creation.

### `INFRA-08` — Generic HTTP client

- **Contains:** global `fetch`, request transmission, response transport, `response.text`, and `response.json` internals.
- **Contract:** URL + HTTP request options → response status/body.
- **Preserved edge:** `createResendContact` → Resend service boundary.
- **Effect:** external network I/O.

### `INFRA-09` — JSON serialization

- **Contains:** `JSON.stringify` and JSON parser internals used by response decoding.
- **Contract:** JavaScript value ↔ JSON representation.
- **Preserved edge:** connector request/response values ↔ HTTP body.

### `INFRA-10` — Scalar normalization and pattern matching

- **Contains:** `String`, `String.prototype.trim`, and `RegExp.prototype.test` internals.
- **Contract:** scalar input → normalized string or boolean match result.
- **Preserved edges:** form value → normalized email; `EMAIL_PATTERN` + email → validation decision.

### `INFRA-11` — Generic error and logging facilities

- **Contains:** `Error` construction and `console.error` internals.
- **Contract:** error information → thrown exception or server log entry.
- **Preserved edges:** connector failure → thrown error → action catch → log.
- **Effect:** control-flow termination and diagnostic output.

## 3. External domain boundary

### `EFFECT-01` — Resend contacts API

This is not generic infrastructure: it is a domain-specific external effect boundary.

- **Endpoint:** `POST https://api.resend.com/contacts`.
- **Input:** Bearer credential, normalized email, `unsubscribed:false`.
- **Output:** success payload expected as `{id:string}` or non-success status/details.
- **Caller:** `createResendContact` through `INFRA-08`.
- **Observable effect:** creates a Resend contact.

## 4. First-party nodes retained as region candidates

These nodes remain eligible because they encode project-specific behavior, policy, contracts, or boundary wiring:

1. `server.ts::default`
2. `server.ts::default.fetch`
3. `server.ts::default.fetch/createRequestHandler.getLoadContext`
4. `server.ts::Env`
5. `app/routes.ts::default`
6. `app/entry.server.tsx::handleRequest`
7. `app/entry.client.tsx::<module-init>`
8. `app/entry.client.tsx::<module-init>/startTransition.callback`
9. `app/root.tsx::Layout`
10. `app/root.tsx::ActionContext`
11. `app/root.tsx::action`
12. `app/root.tsx::App`
13. `app/carcass/sections/Hero.tsx::HeroProps`
14. `app/carcass/sections/Hero.tsx::Hero`
15. `app/capabilities/collect-email-subscribers.ts::EMAIL_PATTERN`
16. `app/capabilities/collect-email-subscribers.ts::validateSubscriberEmail`
17. `app/capabilities/collect-email-subscribers.ts::createInvalidEmailResult`
18. `app/capabilities/collect-email-subscribers.ts::createSubscriberCollectedResult`
19. `app/capabilities/collect-email-subscribers.ts::collectEmailSubscriber`
20. `app/capabilities/collect-email-subscribers.ts::collectEmailSubscribers`
21. `app/connectors/resend.server.ts::ResendConnectorEnv`
22. `app/connectors/resend.server.ts::createResendContact`

No selected root is removed. Compression changes generic descendants into capsules only.

## 5. Root-to-capsule mapping

| Root | Compressed dependencies |
|---|---|
| `server.ts::default` | `INFRA-01`, `INFRA-02`, `INFRA-03` |
| `server.ts::default.fetch` | `INFRA-01`, `INFRA-02`, `INFRA-03` |
| `getLoadContext` callback | `INFRA-02`, `INFRA-03` |
| `server.ts::Env` | `INFRA-01` |
| `app/routes.ts::default` | `INFRA-03` |
| `handleRequest` | `INFRA-03`, `INFRA-04`, `INFRA-07` |
| client module initialization | `INFRA-03`, `INFRA-05` |
| `startTransition` callback | `INFRA-03`, `INFRA-05` |
| `Layout` | `INFRA-03`, `INFRA-04`, `INFRA-05` |
| `ActionContext` | `INFRA-02`, `INFRA-03` |
| `action` | `INFRA-03`, `INFRA-06`, `INFRA-10`, `INFRA-11` |
| `App` | `INFRA-03`, `INFRA-04`, `INFRA-05` |
| `HeroProps` | none |
| `Hero` | `INFRA-03`, `INFRA-06` |
| `EMAIL_PATTERN` | `INFRA-10` |
| `validateSubscriberEmail` | `INFRA-10` |
| `createInvalidEmailResult` | none |
| `createSubscriberCollectedResult` | none |
| `collectEmailSubscriber` | none directly; connector carries HTTP dependencies |
| `collectEmailSubscribers` | none |
| `ResendConnectorEnv` | none |
| `createResendContact` | `INFRA-08`, `INFRA-09`, `INFRA-10`, `INFRA-11`, `EFFECT-01` |

## 6. Compressed causal graph

```text
INFRA-01 Worker dispatch
└─ server.ts::default.fetch
   ├─ getLoadContext ────────────────────────────────────────────┐
   └─ INFRA-02 Hydrogen bridge                                  │
      └─ INFRA-03 React Router                                  │
         ├─ document render                                     │
         │  └─ handleRequest                                    │
         │     ├─ INFRA-04 React SSR                            │
         │     ├─ INFRA-07 Web response                         │
         │     └─ Layout + App → Hero                           │
         │                                                       │
         └─ form POST                                            │
            └─ action ← ActionContext ←──────────────────────────┘
               ├─ INFRA-06 form primitives
               └─ collectEmailSubscribers.execute
                  └─ collectEmailSubscriber
                     ├─ validateSubscriberEmail
                     │  ├─ EMAIL_PATTERN
                     │  └─ INFRA-10 scalar/pattern primitives
                     ├─ createInvalidEmailResult
                     └─ createResendContact
                        ├─ INFRA-08 HTTP client
                        ├─ INFRA-09 JSON
                        ├─ INFRA-11 errors
                        └─ EFFECT-01 Resend contacts API
                           └─ createSubscriberCollectedResult

Browser entry
└─ entry.client module initialization
   └─ transition callback
      └─ INFRA-05 React hydration
         └─ INFRA-03 React Router
            └─ Layout + App → Hero

Hero Form ──INFRA-03/06──→ action
action result ──INFRA-03──→ App ─→ Hero.message
connector exception ──INFRA-11──→ action failure result
```

## 7. Compression result

- First-party meaningful roots retained: **22**
- Generic dependency capsules: **11**
- Domain-specific external effect boundaries: **1**
- Generic framework/platform internals eligible for Behavioral Region membership: **0**
- Unknown framework edges silently discarded: **0**
