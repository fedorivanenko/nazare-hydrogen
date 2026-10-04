# Intent-to-Impact Example

This report demonstrates the practical use of Behavioral Regions: map a product intent to changed region contracts, propagate impact, identify required edits, and prove which behavior should remain unaffected.

## Intent

> Add subscriber name alongside email and persist it in Resend.

## Assumptions

- one optional `name` field;
- no new name-validation policy;
- no personalized success message;
- existing result semantics remain unchanged.

Different meanings of “add name to emails” require clarification before analysis. Possible interpretations include subscriber name, sender display name, personalized email content, or UI-only display.

## Region impact

| Region | Impact | Reason |
|---|---|---|
| `br.email-subscription` | Changed | Journey accepts additional subscriber data. |
| `br.email-capture-interaction` | Changed | Form must collect `name`. |
| `br.subscription-submission` | Changed | Action must parse and forward `name`. |
| `br.collect-email-subscriber` | Changed | Capability input contract gains `name`. |
| `br.resend-contact-creation` | Changed | Provider request must persist `name`. |
| `br.subscription-outcome-presentation` | Unchanged | Result and displayed messages do not change. |
| `br.invalid-subscriber-rejection` | Unchanged | Email acceptance policy remains identical. |
| `br.request-execution-context` | Unchanged | No new request-scoped dependency. |
| `br.storefront-client-activation` | Unchanged | Hydration behavior remains identical. |

## Required source changes

### Must change

#### `Hero`

Add name input to email-capture form.

#### `action`

Read `name` from `FormData` and build structured subscriber input.

#### `collectEmailSubscriber`

Accept structured subscriber input and pass name to connector.

#### `createResendContact`

Accept name and map it to supported Resend contact field or fields.

## Recommended input contract

```ts
export type SubscriberInput = {
	email: string;
	name?: string;
};
```

Usage:

```ts
collectEmailSubscribers.execute(input, env);
createResendContact(input, env);
```

## Semantically affected, possibly without textual edit

`collectEmailSubscribers` may retain identical object-literal text, but its inferred `execute` contract changes because `collectEmailSubscriber` changes.

## Conditionally affected

| Symbol | Change condition |
|---|---|
| `HeroProps` | Name input requires configurable labels or visibility. |
| `App` | It must supply new name-capture configuration. |
| `validateSubscriberEmail` | Name becomes part of acceptance policy. |
| `createInvalidEmailResult` | Name validation adds distinct failure semantics. |
| `createSubscriberCollectedResult` | Success result includes or presents name. |

## Proven unaffected under assumptions

```text
server.ts::default
server.ts::fetch
Env
getLoadContext
ActionContext
app/routes.ts::default
handleRequest
entry.client module initialization
hydration callback
Layout
EMAIL_PATTERN
validateSubscriberEmail
createInvalidEmailResult
createSubscriberCollectedResult
ResendConnectorEnv
```

Unchanged behaviors:

- routing topology;
- deployment credentials;
- email-validity policy;
- failure semantics;
- client hydration;
- server rendering;
- response headers.

“Unchanged” means no changed contract or causal edge reaches these nodes under stated assumptions. Assumption changes require impact recalculation.

## Required regression tests

```text
name + valid email
→ connector receives email and name

missing optional name + valid email
→ existing successful behavior remains valid

name + invalid email
→ connector is not called

provider failure
→ existing safe public failure remains unchanged
```

## Automation model

Behavioral Regions should be stored as structured graph records, not only Markdown:

```json
{
  "region": "br.collect-email-subscriber",
  "inputs": ["SubscriberInput", "ContactCreator"],
  "outputs": ["SubscriptionResult"],
  "effects": ["contact.create"],
  "dependsOn": ["br.resend-contact-creation"],
  "invariants": [
    "invalid email causes no contact creation",
    "success follows completed contact creation"
  ]
}
```

Impact pipeline:

```text
intent
→ clarified semantic mutation
→ changed region contracts
→ forward/backward dependency propagation
→ required changes
→ conditionally affected nodes
→ proven-unaffected nodes
→ regression tests
```

## Practical value

The result is not merely a list of likely files. It explains:

- why each symbol must change;
- which contract carries the change;
- where propagation stops;
- which invariants must remain true;
- why unrelated behavior should remain unaffected.
