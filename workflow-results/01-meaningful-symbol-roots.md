# Meaningful Symbol Roots

Scope: current `nazare-hydrogen` application runtime. Excludes `node_modules`, `dist`, generated `.react-router`, `artifacts`, scripts, and build configuration.

## Selection rule

A symbol is meaningful when it is an external/framework surface, produces or controls an observable effect, contributes data or control to such a surface/effect, or defines a behavioral contract.

Exact aliases, generated symbols, and generic infrastructure remain dependencies rather than roots.

## Selected meaningful roots

### External/framework surfaces

- `server.ts:8` — default Worker export
- `server.ts:9` — `fetch`
- `server.ts:12` — synthetic `getLoadContext` callback
- `app/routes.ts:3` — route-manifest default export
- `app/entry.server.tsx:4` — `handleRequest`
- `app/entry.client.tsx:5` — synthetic module-initialization root
- `app/entry.client.tsx:5` — synthetic `startTransition` callback
- `app/root.tsx:13` — `Layout`
- `app/root.tsx:33` — `action`
- `app/root.tsx:51` — `App`
- `app/carcass/sections/Hero.tsx:14` — `Hero`
- `app/capabilities/collect-email-subscribers.ts:36` — `collectEmailSubscribers`
- `app/connectors/resend.server.ts:5` — `createResendContact`

### Internal behavioral contributors

- `app/capabilities/collect-email-subscribers.ts:6` — `EMAIL_PATTERN`
- `app/capabilities/collect-email-subscribers.ts:8` — `validateSubscriberEmail`
- `app/capabilities/collect-email-subscribers.ts:12` — `createInvalidEmailResult`
- `app/capabilities/collect-email-subscribers.ts:16` — `createSubscriberCollectedResult`
- `app/capabilities/collect-email-subscribers.ts:27` — `collectEmailSubscriber`

These qualify because changing each can alter observable validation, API effects, HTTP responses, or rendered UI.

### Contract roots

- `server.ts:4` — `Env`
- `app/connectors/resend.server.ts:1` — `ResendConnectorEnv`
- `app/root.tsx:31` — `ActionContext`
- `app/carcass/sections/Hero.tsx:3` — `HeroProps`

These have no direct runtime effect but define behavioral boundaries and coordinated-change contracts.

## Main causal cones

```text
HTTP request
└─ server default export
   └─ fetch
      ├─ getLoadContext
      └─ React Router request handler
         ├─ handleRequest
         │  ├─ App
         │  │  └─ Hero
         │  └─ Layout
         └─ action
            ├─ request.formData
            └─ collectEmailSubscribers.execute
               └─ collectEmailSubscriber
                  ├─ validateSubscriberEmail
                  │  └─ EMAIL_PATTERN
                  ├─ createInvalidEmailResult
                  ├─ createResendContact
                  │  └─ Resend HTTP API
                  └─ createSubscriberCollectedResult
```

```text
Browser entry
└─ module initialization
   └─ startTransition callback
      └─ hydrateRoot
         └─ React Router
            ├─ Layout
            └─ App
               └─ Hero
```

Framework-mediated edges:

```text
Hero Form POST → action
action result → useActionData → App → Hero.message
React Router request handler → handleRequest
Worker runtime → default.fetch
```

## Excluded as non-root dependencies

- `fetch`, `JSON.stringify`, `Response`, and `console.error`
- React and React Router internals
- Hydrogen request-handler internals
- JSX host elements
- `collectEmailSubscribers.policy["valid-email"]` and `.execute`: exact aliases; parent capability object remains root
- Build configuration exports: infrastructure graph, not application behavior graph
- Generated and build artifacts

## Result

- Runtime roots: 18
- Contract roots: 4
- Total meaningful roots: 22
- Recursive strongly connected components: none detected
