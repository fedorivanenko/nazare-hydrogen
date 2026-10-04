# Behavioral Change Coupling

Workflow step 7 applied to 65 predicted change sets in [`06-predicted-change-sets.md`](./06-predicted-change-sets.md).

## 1. Method

For first-party nodes `A` and `B`:

```text
f(A)     = number of mutations requiring A
c(A,B)   = number of mutations requiring both A and B
coupling = c(A,B) / sqrt(f(A) × f(B))
```

The coupling score is Ochiai co-occurrence in `[0,1]`. It avoids making frequently changed hubs automatically strong with everything.

Jaccard overlap is retained as secondary evidence:

```text
jaccard = c(A,B) / (f(A) + f(B) - c(A,B))
```

Deterministic bands:

- **Strong:** `c ≥ 5` and coupling `≥ 0.50`
- **Moderate:** (`c ≥ 4` and coupling `≥ 0.30`) or (`c ≥ 3` and coupling `≥ 0.50`)
- **Weak:** `c ≥ 2`, not above
- **Trace:** `c = 1`
- **None observed:** `c = 0`

All 65 mutations receive equal weight. Generic dependency capsules remain excluded from first-party membership coupling; their implementation is not expected to change. `E01` is analyzed separately as an external effect boundary.

## 2. Node mutation frequency

| Rank | Node | Mutations requiring change | Weighted coupling degree |
|---:|---|---:|---:|
| 1 | `N11 action` | 31 | 7.21 |
| 2 | `N12 App` | 25 | 5.44 |
| 3 | `N19 collectEmailSubscriber` | 25 | 6.55 |
| 4 | `N22 createResendContact` | 23 | 5.19 |
| 5 | `N14 Hero` | 21 | 4.93 |
| 6 | `N20 collectEmailSubscribers` | 19 | 6.26 |
| 7 | `N13 HeroProps` | 18 | 4.74 |
| 8 | `N17 createInvalidEmailResult` | 18 | 5.43 |
| 9 | `N02 default.fetch` | 16 | 4.58 |
| 10 | `N03 getLoadContext` | 16 | 5.11 |
| 11 | `N10 ActionContext` | 13 | 4.84 |
| 12 | `N16 validateSubscriberEmail` | 12 | 3.83 |
| 13 | `N18 createSubscriberCollectedResult` | 12 | 3.42 |
| 14 | `N21 ResendConnectorEnv` | 10 | 2.54 |
| 15 | `N04 Env` | 9 | 2.61 |
| 16 | `N09 Layout` | 6 | 2.13 |
| 17 | `N08 hydration callback` | 5 | 1.72 |
| 18 | `N05 route manifest` | 4 | 1.72 |
| 19 | `N06 handleRequest` | 4 | 1.50 |
| 20 | `N07 client module initialization` | 3 | 1.48 |
| 21 | `N15 EMAIL_PATTERN` | 3 | 0.17 |
| 22 | `N01 Worker default export` | 1 | 1.64 |

Frequency means likely participation in requirement changes, not architectural importance. Weighted degree is sum of pairwise coupling scores.

## 3. Strong coupling

| Pair | Co-changes | Coupling | Jaccard | Main shared reason |
|---|---:|---:|---:|---|
| `N13 ↔ N14` | 18 | 0.93 | 0.86 | Hero contract and implementation evolve together. |
| `N03 ↔ N10` | 13 | 0.90 | 0.81 | Produced route context and consumed action-context contract must agree. |
| `N04 ↔ N21` | 8 | 0.84 | 0.73 | Deployment and connector environment contracts mirror provider configuration. |
| `N19 ↔ N20` | 17 | 0.78 | 0.63 | Capability implementation and exported capability boundary evolve together. |
| `N02 ↔ N03` | 12 | 0.75 | 0.60 | Request adapter owns values injected by context factory. |
| `N11 ↔ N19` | 19 | 0.68 | 0.51 | Action delegates subscription behavior and translates its outcomes. |
| `N16 ↔ N17` | 10 | 0.68 | 0.50 | Validation decision and invalid-result semantics change together. |
| `N11 ↔ N20` | 16 | 0.66 | 0.47 | Action consumes public capability contract. |
| `N11 ↔ N17` | 15 | 0.64 | 0.44 | Validation failures cross action transport boundary. |
| `N19 ↔ N22` | 15 | 0.63 | 0.45 | Orchestration outcome depends on connector semantics. |
| `N02 ↔ N10` | 9 | 0.62 | 0.45 | Request-bound values propagate to action contract. |
| `N12 ↔ N13` | 13 | 0.61 | 0.43 | App constructs Hero's evolving presentation contract. |
| `N13 ↔ N17` | 11 | 0.61 | 0.44 | Invalid-result structure influences Hero status contract. |
| `N12 ↔ N14` | 14 | 0.61 | 0.44 | App composition and Hero behavior change together. |
| `N10 ↔ N11` | 12 | 0.60 | 0.38 | Action implementation consumes action-context contract. |
| `N16 ↔ N20` | 9 | 0.60 | 0.41 | Public policy surface exposes validator behavior. |
| `N12 ↔ N18` | 10 | 0.58 | 0.37 | Success-result semantics drive App state. |
| `N16 ↔ N19` | 10 | 0.58 | 0.37 | Orchestrator branches on validation policy. |
| `N11 ↔ N12` | 16 | 0.57 | 0.40 | Action result schema and App interpretation must agree. |
| `N14 ↔ N17` | 11 | 0.57 | 0.39 | Hero displays invalid-result semantics. |
| `N12 ↔ N17` | 12 | 0.57 | 0.39 | App maps invalid results to presentation. |
| `N17 ↔ N19` | 12 | 0.57 | 0.39 | Orchestrator creates policy-failure result. |
| `N04 ↔ N22` | 8 | 0.56 | 0.33 | Deployment configuration reaches connector behavior. |
| `N11 ↔ N14` | 14 | 0.55 | 0.37 | Form inputs and action parsing/results form one interaction contract. |
| `N18 ↔ N22` | 9 | 0.54 | 0.35 | Provider outcome determines capability success evidence. |
| `N17 ↔ N20` | 10 | 0.54 | 0.37 | Public capability policy/result contract carries validation failure. |
| `N03 ↔ N11` | 12 | 0.54 | 0.34 | Context injection supplies action dependencies and request metadata. |
| `N18 ↔ N19` | 9 | 0.52 | 0.32 | Orchestrator creates success only after effect completion. |
| `N10 ↔ N20` | 8 | 0.51 | 0.33 | Action dependency contract frequently changes with capability API. |

Strong pairs have at least eight supporting mutations in this sample.

## 4. Moderate coupling

| Pair | Co-changes | Coupling | Jaccard |
|---|---:|---:|---:|
| `N07 ↔ N08` | 3 | 0.77 | 0.60 |
| `N07 ↔ N09` | 3 | 0.71 | 0.50 |
| `N08 ↔ N09` | 3 | 0.55 | 0.38 |
| `N12 ↔ N19` | 12 | 0.48 | 0.32 |
| `N13 ↔ N16` | 7 | 0.48 | 0.30 |
| `N02 ↔ N21` | 6 | 0.47 | 0.30 |
| `N02 ↔ N22` | 9 | 0.47 | 0.30 |
| `N11 ↔ N18` | 9 | 0.47 | 0.26 |
| `N11 ↔ N13` | 11 | 0.47 | 0.29 |
| `N21 ↔ N22` | 7 | 0.46 | 0.27 |
| `N02 ↔ N20` | 8 | 0.46 | 0.30 |
| `N03 ↔ N20` | 8 | 0.46 | 0.30 |
| `N11 ↔ N22` | 12 | 0.45 | 0.29 |
| `N14 ↔ N16` | 7 | 0.44 | 0.27 |
| `N05 ↔ N14` | 4 | 0.44 | 0.19 |
| `N13 ↔ N20` | 8 | 0.43 | 0.28 |
| `N13 ↔ N19` | 9 | 0.42 | 0.26 |
| `N10 ↔ N22` | 7 | 0.40 | 0.24 |
| `N14 ↔ N20` | 8 | 0.40 | 0.25 |
| `N14 ↔ N19` | 9 | 0.39 | 0.24 |
| `N10 ↔ N19` | 7 | 0.39 | 0.23 |
| `N20 ↔ N22` | 8 | 0.38 | 0.24 |
| `N03 ↔ N22` | 7 | 0.36 | 0.22 |
| `N11 ↔ N16` | 7 | 0.36 | 0.19 |
| `N02 ↔ N11` | 8 | 0.36 | 0.21 |
| `N03 ↔ N19` | 7 | 0.35 | 0.21 |
| `N12 ↔ N22` | 8 | 0.33 | 0.20 |
| `N02 ↔ N04` | 4 | 0.33 | 0.19 |
| `N10 ↔ N17` | 5 | 0.33 | 0.19 |
| `N02 ↔ N19` | 6 | 0.30 | 0.17 |

`N07–N09` scores are high but evidence support is only three mutations, so classification remains moderate.

## 5. Weak coupling

| Pair | Co-changes | Coupling |
|---|---:|---:|
| `N02 ↔ N06` | 3 | 0.38 |
| `N03 ↔ N06` | 3 | 0.38 |
| `N05 ↔ N12` | 3 | 0.30 |
| `N03 ↔ N17` | 5 | 0.29 |
| `N10 ↔ N12` | 5 | 0.28 |
| `N13 ↔ N18` | 4 | 0.27 |
| `N17 ↔ N18` | 4 | 0.27 |
| `N05 ↔ N11` | 3 | 0.27 |
| `N10 ↔ N21` | 3 | 0.26 |
| `N14 ↔ N18` | 4 | 0.25 |
| `N03 ↔ N12` | 5 | 0.25 |
| `N03 ↔ N21` | 3 | 0.24 |
| `N05 ↔ N13` | 2 | 0.24 |
| `N12 ↔ N16` | 4 | 0.23 |
| `N12 ↔ N20` | 5 | 0.23 |
| `N03 ↔ N09` | 2 | 0.20 |
| `N20 ↔ N21` | 2 | 0.15 |
| `N18 ↔ N20` | 2 | 0.13 |
| `N11 ↔ N21` | 2 | 0.11 |
| `N13 ↔ N22` | 2 | 0.10 |
| `N17 ↔ N22` | 2 | 0.10 |
| `N14 ↔ N22` | 2 | 0.09 |

Additionally:

- Trace pairs (`c = 1`): **44**
- No observed co-change (`c = 0`): **106** of 231 total node pairs

Trace pairs are retained in source mutation/change-set evidence but are insufficient for a behavioral-coupling claim.

## 6. External-effect coupling

`E01` changes in 13 mutations. Coupling uses the same formula against first-party mutation frequencies.

| Pair | Co-changes | Coupling | Interpretation |
|---|---:|---:|---|
| `N22 ↔ E01` | 13 | 0.75 | Connector is direct owner of provider contract. |
| `N18 ↔ E01` | 9 | 0.72 | Success evidence changes with provider outcome semantics. |
| `N19 ↔ E01` | 9 | 0.50 | Orchestration meaning changes when external operation changes. |
| `N04 ↔ E01` | 5 | 0.46 | Deployment configuration often determines provider behavior. |
| `N21 ↔ E01` | 4 | 0.35 | Connector environment carries provider-specific configuration. |
| `N12 ↔ E01` | 7 | 0.39 | User-visible success semantics often change with provider outcome. |
| `N11 ↔ E01` | 6 | 0.30 | Action transports provider-derived outcomes but does not own effect. |

Other `E01` pairings have one or two supporting mutations and remain weak/trace.

## 7. Coupling observations

- Strongest pair: `HeroProps ↔ Hero` (`0.93`). Presentation contract and implementation are effectively inseparable under sampled changes.
- Strongest boundary-contract pair: `getLoadContext ↔ ActionContext` (`0.90`). Producer/consumer shape forms one context seam.
- Strongest configuration pair: `Env ↔ ResendConnectorEnv` (`0.84`). They currently duplicate same provider configuration responsibility.
- Strongest capability pair: `collectEmailSubscriber ↔ collectEmailSubscribers` (`0.78`). Public capability and orchestration repeatedly move together.
- Main change hubs: `action`, `collectEmailSubscriber`, and `collectEmailSubscribers` by weighted coupling degree.
- `EMAIL_PATTERN` remains intentionally isolated: three direct policy mutations change it alone; only one sampled mutation also requires `validateSubscriberEmail`.
- Presentation and capability are substantially coupled through result/input contracts, but direct provider-to-Hero coupling is weak. Intermediate action/capability contracts absorb provider details.

## 8. Evidence limits

- Scores estimate plausible requirement coupling, not historical co-change.
- Mutations are designed probes and are not statistically independent.
- New symbols are omitted from pair scoring because they do not exist in current graph.
- Generic dependency internals are omitted by workflow step 3.
- Low-frequency nodes can show high normalized scores; support thresholds prevent overclassification.

## Result

- First-party nodes scored: **22**
- Possible first-party pairs: **231**
- Strong pairs: **29**
- Moderate pairs: **30**
- Weak pairs: **22**
- Trace pairs: **44**
- No observed co-change: **106**
- External-effect boundary analyzed separately: **`E01`**

Next workflow input: compare these semantic/change-coupling estimates with actual structural edges and proximity.
