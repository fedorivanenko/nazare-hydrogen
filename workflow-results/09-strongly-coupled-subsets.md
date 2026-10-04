# Strongly Coupled Subsets

Workflow step 9 applied to first-party behavioral coupling from [`07-behavioral-change-coupling.md`](./07-behavioral-change-coupling.md), informed by structural findings in [`08-semantic-structural-comparison.md`](./08-semantic-structural-comparison.md).

## 1. Optimization method

All first-party subsets of sizes 2–10 were evaluated.

For subset `S`:

```text
I(S) = mean behavioral coupling of pairs inside S
X(S) = mean behavioral coupling from S to nodes outside S
C(S) = fraction of internal pairs with nonzero co-change evidence
Q(S) = (I(S) - X(S)) × C(S)
```

Higher `Q` means denser internal change coupling with lower average outside coupling. Also recorded:

```text
conductance(S) = outside coupling weight /
                 (2 × internal coupling weight + outside coupling weight)
```

Lower conductance means subset captures more of its members' total coupling. Small subsets naturally score high on internal density, so nested broader subsets remain when they materially reduce boundary conductance.

Retention rules:

1. `Q ≥ 0.40`;
2. complete internal evidence coverage (`C = 1.00`);
3. subset is a size-local optimum or meaningful nested expansion;
4. generic dependency capsules are excluded;
5. structural evidence affects confidence, not semantic score.

## 2. Retained subsets

### `S01` — Client activation shell

```text
N07  entry.client module initialization
N08  hydration callback
N09  Layout
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.676 |
| External coupling `X` | 0.022 |
| Separation quality `Q` | 0.654 |
| Conductance | 0.239 |
| Evidence coverage | 1.00 |
| Confidence | Medium-low |

**Why retained:** highly isolated and internally cohesive under hydration/consent/bootstrap mutations.

**Confidence limit:** only three shared mutation observations support strongest edges. Framework mediation, not direct business behavior, connects hydration to layout.

**Main outside boundary:** `N12 App` through React Router hydration.

---

### `S02` — Request-context propagation

```text
N02  server fetch adapter
N03  getLoadContext
N10  ActionContext
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.758 |
| External coupling `X` | 0.175 |
| Separation quality `Q` | 0.583 |
| Conductance | 0.687 |
| Evidence coverage | 1.00 |
| Confidence | High semantic; medium structural |

**Why retained:** request metadata, locale, timeout, tenant, and dependency-injection changes repeatedly require all three.

**Structural warning:** `N03 ↔ N10` is currently implicit. High semantic cohesion exposes a fragmented context contract rather than an already encapsulated implementation.

**Main outside boundaries:** `N11 action`, `N20 capability`, `N22 connector`.

---

### `S03` — Provider configuration contract

```text
N04  Env
N21  ResendConnectorEnv
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.843 |
| External coupling `X` | 0.086 |
| Separation quality `Q` | 0.757 |
| Conductance | 0.672 |
| Evidence coverage | 1.00 |
| Confidence | High semantic; low structural |

**Why retained:** audience, endpoint, and credential requirement changes force both contracts to move together.

**Structural warning:** types duplicate shape without a declared relationship. This is a strongly coupled fragmented contract.

**Main outside boundary:** `N22 createResendContact`.

---

### `S04` — Provider configuration and adapter

```text
N04  Env
N21  ResendConnectorEnv
N22  createResendContact
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.620 |
| External coupling `X` | 0.116 |
| Separation quality `Q` | 0.504 |
| Conductance | 0.640 |
| Evidence coverage | 1.00 |
| Confidence | High |

**Why retained:** expands `S03` to include behavior consuming configuration and owning provider request semantics.

**Main outside boundary:** `N19 collectEmailSubscriber`; `N22` also couples directly to external effect `E01`.

**Nested subset:** `S03 ⊂ S04`.

---

### `S05` — Email-capture presentation

```text
N12  App
N13  HeroProps
N14  Hero
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.717 |
| External coupling `X` | 0.190 |
| Separation quality `Q` | 0.527 |
| Conductance | 0.715 |
| Evidence coverage | 1.00 |
| Confidence | High |

**Why retained:** pending, completed, consent, status severity, and disclosure changes repeatedly modify page composition, props contract, and section rendering together.

**Main outside boundaries:** `N11 action` and result factories `N17`/`N18`.

---

### `S06` — Subscriber policy and capability core

```text
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.623 |
| External coupling `X` | 0.203 |
| Separation quality `Q` | 0.421 |
| Conductance | 0.661 |
| Evidence coverage | 1.00 |
| Confidence | High |

**Why retained:** validation shape, consent policy, reason codes, public policy surface, and orchestration branch semantics repeatedly co-change.

**Why `N15 EMAIL_PATTERN` is excluded:** pattern mutations usually stay behind stable validator contract; coupling to `N16` is only 0.17.

**Why `N18` is excluded from core:** success-result changes often follow provider outcomes independently of validation-policy changes.

**Main outside boundaries:** `N11 action`, `N18 success result`, `N22 connector`.

---

### `S07` — Subscription action and capability

```text
N11  action
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.608 |
| External coupling `X` | 0.201 |
| Separation quality `Q` | 0.407 |
| Conductance | 0.585 |
| Evidence coverage | 1.00 |
| Confidence | High |

**Why retained:** expands `S06` with transport translation. Consent, structured validation, rate limiting, localization, and command-shape changes repeatedly cross action/capability seam.

**Main outside boundaries:** presentation `N12–N14`, request context `N10`, success result `N18`, connector `N22`.

**Nested subset:** `S06 ⊂ S07`.

---

### `S08` — Subscription outcome presentation

```text
N11  action
N12  App
N13  HeroProps
N14  Hero
N17  createInvalidEmailResult
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.612 |
| External coupling `X` | 0.183 |
| Separation quality `Q` | 0.429 |
| Conductance | 0.559 |
| Evidence coverage | 1.00 |
| Confidence | High |

**Why retained:** action result schema, validation reasons, status severity, consent failure, pending/completed states, and accessibility semantics require coordinated server-result/UI changes.

**Structural warning:** current result contract is inferred and reduced to `message?: string`; high coupling is only partly represented in source structure.

**Main outside boundaries:** capability orchestration `N19/N20`, success result `N18`, request context `N10`.

**Contains:** presentation subset `S05`, plus action and invalid-result producer.

---

### `S09` — End-to-end email subscription behavior

```text
N11  action
N12  App
N13  HeroProps
N14  Hero
N16  validateSubscriberEmail
N17  createInvalidEmailResult
N19  collectEmailSubscriber
N20  collectEmailSubscribers
```

| Metric | Value |
|---|---:|
| Internal coupling `I` | 0.538 |
| External coupling `X` | 0.127 |
| Separation quality `Q` | 0.411 |
| Conductance | 0.321 |
| Evidence coverage | 1.00 |
| Confidence | High |

**Why retained:** lower internal density than child subsets, but much lower conductance. It captures most change coupling spanning user input, action transport, policy, invalid outcome, and presentation.

**Main outside boundaries:**

- `N10 ActionContext` for request-scoped dependencies;
- `N18 createSubscriberCollectedResult` for successful provider outcome;
- `N22 createResendContact` for external write;
- `N05` for route topology.

**Nested/overlapping children:** `S05`, `S06`, `S07`, and `S08`.

## 3. High-scoring pairs represented by subsets

| Pair | Pair quality | Retained within |
|---|---:|---|
| `N04 ↔ N21` | 0.757 | `S03`, `S04` |
| `N07 ↔ N08` | 0.733 | `S01` |
| `N13 ↔ N14` | 0.730 | `S05`, `S08`, `S09` |
| `N03 ↔ N10` | 0.698 | `S02` |
| `N07 ↔ N09` | 0.652 | `S01` |
| `N02 ↔ N03` | 0.545 | `S02` |
| `N19 ↔ N20` | 0.499 | `S06`, `S07`, `S09` |
| `N16 ↔ N17` | 0.483 | `S06`, `S07`, `S09` |

Pair quality uses same `Q` formula at size two, not raw coupling alone.

## 4. Rejected subset candidates

### `N19 + N20 + N22` — orchestration/capability/connector

- `I = 0.596`
- `X = 0.253`
- `Q = 0.343`
- conductance `= 0.801`

Rejected as standalone strongly separated subset. `N22` has substantial coupling to configuration, success outcomes, action, and external effect. Better treated as boundary member or overlapping provider region later.

### `N15 + N16 + N17` — syntax validation

- `I = 0.282`
- `X = 0.136`
- `Q = 0.147`
- internal evidence coverage `= 0.67`

Rejected. `EMAIL_PATTERN` is independently mutable implementation policy, while `N17` couples through orchestration rather than directly to pattern.

### Server rendering subset

`N05`, `N06`, `N09`, and `N12` do not form a behaviorally dense change unit. Their main cohesion is framework execution structure, already classified as infrastructure/composition coupling.

## 5. Overlap and nesting map

```text
S01 Client activation shell

S02 Request-context propagation

S03 Provider configuration contract
└─ S04 Provider configuration and adapter

S09 End-to-end email subscription behavior
├─ S05 Email-capture presentation
├─ S06 Subscriber policy and capability core
│  └─ S07 Subscription action and capability
└─ S08 Subscription outcome presentation

S07 ∩ S08 = {N11 action, N17 invalid-result factory}
S04 ↔ S09 boundary = N22 connector ↔ N19 orchestration
S02 ↔ S09 boundary = N10 ActionContext ↔ N11 action/N20 capability
```

## 6. Unassigned or boundary-oriented nodes

| Node | Reason not selected into a dense standalone subset |
|---|---|
| `N01` Worker default export | Protocol shell; no independent change cohesion. |
| `N05` route manifest | Changes only for route-topology mutations. |
| `N06` server entry | Rendering adapter; mostly framework coupling. |
| `N15` email pattern | Independently mutable detail behind validator. |
| `N18` success-result factory | Boundary between provider outcome and presentation; couples across multiple subsets. |
| `N22` connector | Boundary between capability, provider configuration, and external effect. Included in `S04`, but not in `S09`. |

Boundary-oriented nodes can participate in overlapping Behavioral Regions during workflow step 10; exclusion here does not mean behavioral irrelevance.

## 7. Result

- Candidate subsets evaluated: every first-party subset of sizes **2–10**
- Retained strongly coupled subsets: **9**
- Nested subset relationships: **6**
- Explicit overlap: `S07 ∩ S08`
- Strong fragmented-contract subsets: `S02`, `S03`
- Broadest low-conductance behavior: `S09` — end-to-end email subscription

Next workflow input: form candidate Behavioral Regions from these subsets, allowing overlap, nesting, boundary members, and shared infrastructure.
