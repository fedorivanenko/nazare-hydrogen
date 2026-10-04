# Semantic vs. Structural Coupling

Workflow step 8 applied to [`07-behavioral-change-coupling.md`](./07-behavioral-change-coupling.md) and current first-party source structure.

## 1. Structural evidence model

Structural level uses current code, not file proximity alone.

### High structural coupling

At least one explicit source relationship:

- direct call or value reference;
- direct type reference;
- alias/export relationship;
- lexical containment;
- direct component construction with checked props.

### Moderate structural coupling

No direct symbol reference, but behavior is connected through:

- one explicit intermediate first-party symbol;
- a framework protocol edge identified in causal cones;
- direct producer/consumer data flow across React Router.

### Low structural coupling

Only one or more of:

- inferred structural compatibility without shared type;
- framework convention without source-level reference;
- two or more intermediate first-party symbols;
- same-file proximity without data/control dependency;
- no current path except shared external effect.

Semantic coupling is **high** when step 7 classified pair as strong, **low** when weak/trace/unobserved, and **middle** otherwise.

## 2. Actual structural relationships

### Explicit first-party relationships

| Pair | Structural evidence | Level |
|---|---|---|
| `N01 default export ↔ N02 fetch` | Method is lexically contained in exported object. | High |
| `N02 fetch ↔ N03 getLoadContext` | Callback is lexically created and captures `env`. | High |
| `N02 fetch ↔ N04 Env` | `fetch` parameter directly references `Env`. | High |
| `N03 getLoadContext ↔ N04 Env` | Callback captures `env` value typed by `Env`. | High |
| `N07 client init ↔ N08 hydration callback` | Callback is lexically passed to `startTransition`. | High |
| `N10 ActionContext ↔ N11 action` | Action parameter directly references `ActionContext`. | High |
| `N10 ActionContext ↔ N21 ResendConnectorEnv` | Context alias directly references connector environment type. | High |
| `N11 action ↔ N12 App` | `App` directly uses `typeof action`; router transports result. | High |
| `N11 action ↔ N20 capability` | Action directly calls `collectEmailSubscribers.execute`. | High |
| `N12 App ↔ N13 HeroProps` | JSX arguments are checked against Hero props contract. | High |
| `N12 App ↔ N14 Hero` | `App` directly renders imported `Hero`. | High |
| `N13 HeroProps ↔ N14 Hero` | `Hero` parameter directly uses `HeroProps`. | High |
| `N15 EMAIL_PATTERN ↔ N16 validator` | Validator directly calls `EMAIL_PATTERN.test`. | High |
| `N16 validator ↔ N19 orchestration` | Orchestrator directly calls validator. | High |
| `N16 validator ↔ N20 capability` | Capability directly aliases validator as policy. | High |
| `N17 invalid result ↔ N19 orchestration` | Orchestrator directly calls invalid-result factory. | High |
| `N18 success result ↔ N19 orchestration` | Orchestrator directly calls success-result factory. | High |
| `N19 orchestration ↔ N20 capability` | Capability directly aliases orchestrator as `execute`. | High |
| `N19 orchestration ↔ N21 connector environment` | Orchestrator parameter directly references environment type. | High |
| `N19 orchestration ↔ N22 connector` | Orchestrator directly calls connector. | High |
| `N21 connector environment ↔ N22 connector` | Connector parameter directly references environment type. | High |

### Framework-mediated relationships

| Pair | Structural evidence | Level |
|---|---|---|
| `N05 routes ↔ N11 action` | Root-route convention exposes action. | Moderate |
| `N05 routes ↔ N12 App` | Root-route convention exposes component. | Moderate |
| `N06 server entry ↔ N09 Layout` | `ServerRouter` renders root document shell. | Moderate |
| `N06 server entry ↔ N12 App` | `ServerRouter` renders matched root component. | Moderate |
| `N08 hydration callback ↔ N09 Layout` | `HydratedRouter` hydrates shell. | Moderate |
| `N08 hydration callback ↔ N12 App` | `HydratedRouter` hydrates root component. | Moderate |
| `N09 Layout ↔ N12 App` | Framework injects rendered route as `children`. | Moderate |
| `N03 getLoadContext ↔ N11 action` | Router transports callback result as action context. | Moderate |
| `N11 action ↔ N14 Hero` | Router transports Hero form POST to action. | Moderate |
| `N14 Hero ↔ N12 App` | Direct render is high; action-data feedback adds framework path. | High |

### Implicit structural contracts

| Pair | Current implicit relationship | Level |
|---|---|---|
| `N03 getLoadContext ↔ N10 ActionContext` | `{env: Env}` is expected to satisfy independently declared `{env: ResendConnectorEnv}`. No shared context type. | Low |
| `N04 Env ↔ N21 ResendConnectorEnv` | Duplicate optional `RESEND_API_KEY` shapes. No `extends`, alias, or shared declaration. | Low |
| `N17 invalid result ↔ N12 App` | Inferred action return union crosses framework; no named result contract. | Low |
| `N18 success result ↔ N12 App` | Inferred action return union crosses framework; no named result contract. | Low |
| `N17 invalid result ↔ N13 HeroProps` | Error string is converted implicitly into optional plain `message`. | Low |
| `N17 invalid result ↔ N14 Hero` | Failure semantics arrive only as undifferentiated string. | Low |
| `N02 fetch ↔ N10 ActionContext` | Runtime context originates in fetch but no shared source type links them. | Low |
| `N04 Env ↔ N22 connector` | Credential reaches connector through structurally compatible intermediate types. | Low |
| `N10 ActionContext ↔ N20 capability` | Action mediates dependency; context names raw environment rather than capability contract. | Low |

## 3. High structural + high semantic coupling

These are coherent implementation/change units.

| Pair | Semantic coupling | Structural reason | Interpretation |
|---|---:|---|---|
| `N13 HeroProps ↔ N14 Hero` | 0.93 | Direct props contract | Coherent presentation component. |
| `N19 orchestration ↔ N20 capability` | 0.78 | Direct exported alias | Coherent capability boundary and implementation. |
| `N02 fetch ↔ N03 getLoadContext` | 0.75 | Lexical callback containment | Coherent server-context adapter. |
| `N11 action ↔ N19 orchestration` | 0.68 | Statically resolved `.execute` target | Coherent transport-to-capability invocation seam. |
| `N11 action ↔ N20 capability` | 0.66 | Direct call through exported object | Coherent capability consumer seam. |
| `N19 orchestration ↔ N22 connector` | 0.63 | Direct awaited call | Coherent capability/effect seam. |
| `N12 App ↔ N13 HeroProps` | 0.61 | Checked JSX inputs | Coherent presentation composition. |
| `N12 App ↔ N14 Hero` | 0.61 | Direct JSX render | Coherent page/section composition. |
| `N10 ActionContext ↔ N11 action` | 0.60 | Direct parameter type | Coherent action boundary. |
| `N16 validator ↔ N20 capability` | 0.60 | Direct policy alias | Coherent public policy surface. |
| `N16 validator ↔ N19 orchestration` | 0.58 | Direct branch dependency | Coherent validation/orchestration behavior. |
| `N11 action ↔ N12 App` | 0.57 | `typeof action` plus action-data protocol | Coherent server-result/UI consumption seam. |
| `N17 invalid result ↔ N19 orchestration` | 0.57 | Direct result-factory call | Coherent invalid branch. |
| `N18 success result ↔ N19 orchestration` | 0.52 | Direct result-factory call | Coherent successful branch. |

## 4. High structural + low semantic coupling

These relationships are mostly containment, pass-through, or stable infrastructure contracts rather than shared behavior.

| Pair | Semantic evidence | Why structural coupling is not behavioral unity |
|---|---:|---|
| `N01 default export ↔ N02 fetch` | No observed co-change | Export object is Worker protocol shell; behavior lives in method. |
| `N03 getLoadContext ↔ N04 Env` | Trace: 1 co-change, score 0.08 | Callback generally passes environment unchanged; most context changes do not alter deployment type. |
| `N10 ActionContext ↔ N21 ResendConnectorEnv` | Weak: 3 co-changes, score 0.26 | Action context currently carries connector type as infrastructure payload. |
| `N15 EMAIL_PATTERN ↔ N16 validator` | Trace: 1 co-change, score 0.17 | Pattern can evolve behind stable boolean validator contract. |
| `N19 orchestration ↔ N21 ResendConnectorEnv` | No observed co-change | Environment parameter is pass-through dependency; orchestration requirements usually concern policy/outcomes. |

Interpretation: do not form regions solely from lexical nesting, type references, or parameter plumbing.

## 5. Low structural + high semantic coupling

These pairs indicate behavior that changes together despite weak or implicit source linkage.

| Pair | Semantic coupling | Missing/weak structure | Assessment |
|---|---:|---|---|
| `N03 getLoadContext ↔ N10 ActionContext` | 0.90 | No shared context declaration | **Fragmented contract:** producer and consumer independently describe same runtime value. |
| `N04 Env ↔ N21 ResendConnectorEnv` | 0.84 | Duplicate structural types | **Fragmented contract:** provider configuration duplicated across boundaries. |
| `N02 fetch ↔ N10 ActionContext` | 0.62 | Only framework/context propagation | **Fragmented request context:** origin and contract are not explicitly linked. |
| `N13 HeroProps ↔ N17 invalid result` | 0.61 | Plain string translation; no result/presentation contract | **Fragmented outcome semantics.** |
| `N12 App ↔ N18 success result` | 0.58 | Inferred framework result union | **Implicit result contract:** changes propagate through inference only. |
| `N14 Hero ↔ N17 invalid result` | 0.57 | Error semantics collapse to `message?: string` | **Fragmented presentation semantics.** |
| `N12 App ↔ N17 invalid result` | 0.57 | Inferred framework result union | **Implicit result contract.** |
| `N04 Env ↔ N22 connector` | 0.56 | Multiple structurally compatible hops | **Fragmented configuration path.** |
| `N03 getLoadContext ↔ N11 action` | 0.54 | Framework-mediated context with independent type | **Implicit framework seam.** |
| `N10 ActionContext ↔ N20 capability` | 0.51 | Action mediates raw environment | **Potential abstraction mismatch:** action depends on connector configuration instead of behavior. |

### Intentionally mediated high coupling

Not every low-direct/high-semantic pair is harmful. These pairs are separated through a clear owner:

- `N18 success result ↔ N22 connector` is mediated by `N19 orchestration`.
- `N12 App ↔ N18 success result` is mediated by `N11 action` and router action-data transport.
- `N14 Hero ↔ N17 invalid result` is mediated by `N12 App`.

They become fragmentation risks because current intermediate contracts are inferred or reduced to strings, not because layers exist.

## 6. Low structural + low semantic coupling

Most pairs fit here: unrelated behavior remains separate in code and predicted changes.

Representative examples:

- client hydration (`N07`, `N08`) vs. Resend connector (`N21`, `N22`);
- server rendering (`N06`) vs. email syntax policy (`N15`, `N16`);
- route topology (`N05`) vs. provider success evidence (`N18`);
- document layout (`N09`) vs. contact creation (`N22`).

Step 7 found 106 pairs with no observed co-change. No structural consolidation is justified for these pairs.

## 7. Structural findings

### Coherent units supported by both evidence types

1. `HeroProps + Hero`
2. `collectEmailSubscribers + collectEmailSubscriber`
3. `validateSubscriberEmail + collectEmailSubscriber + result factories`
4. `collectEmailSubscriber + createResendContact`
5. `ActionContext + action`
6. `App + Hero`
7. `fetch + getLoadContext`

### Accidental/infrastructure coupling

1. Worker default object contains `fetch` but contributes no separate behavior.
2. Raw `ResendConnectorEnv` crosses capability and action layers as dependency plumbing.
3. `EMAIL_PATTERN` is lexically bound to validator but can change independently behind stable policy contract.
4. Layout/render/hydration connections are mostly framework composition, not email-subscription responsibility.

### Fragmented behavior candidates

1. **Request context contract:** `getLoadContext` produces value described separately by `ActionContext`.
2. **Provider configuration contract:** `Env` and `ResendConnectorEnv` duplicate shape without declared relation.
3. **Action result contract:** validation/success/error results are inferred rather than named.
4. **Presentation outcome contract:** capability semantics collapse into `message?: string` before reaching `Hero`.
5. **Dependency direction:** action receives raw provider environment instead of subscription capability.

## 8. Result

| Classification | Clear pairs/findings |
|---|---:|
| High structural + high semantic | 14 pairs |
| High structural + low semantic | 5 pairs |
| Low structural + high semantic | 10 pairs |
| Low structural + low semantic | dominant remainder |

The strongest coherent behavior is **collect email subscriber**, spanning policy, orchestration, result creation, and provider connector seam. Main fragmentation occurs in context/configuration and result/presentation contracts.

Next workflow input: find subsets maximizing internal behavioral coupling while minimizing coupling to nodes outside each subset.
