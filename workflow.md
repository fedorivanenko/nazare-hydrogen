source code
  ↓
1. Build real dependency graph
  symbols, calls, control flow, data flow,
  reads/writes, types/contracts, effects, surfaces
  ↓
2. Generate causal cone for every meaningful symbol
  root → everything causally downstream/upstream
  needed to explain its behavior
  ↓
3. Compress generic infrastructure
  framework internals, logger, JSON helpers,
  generic HTTP/DB clients, etc.
  remain dependencies, not region members
  ↓
4. Infer semantic responsibility
  for every node/edge:
  "what does this contribute to the behavior?"
  ↓
5. Generate plausible behavioral mutations
  counterfactual changes to the meaning/requirements
  of each causal cone
  ↓
6. Predict required change sets
  for each mutation:
  which symbols/contracts/effects would need
  coordinated modification?
  ↓
7. Estimate behavioral change coupling
  A ↔ B is strong when plausible changes repeatedly
  require A and B to change together
  ↓
8. Compare semantics with real structure
  high structural + high semantic/change coupling
      → coherent unit
  high structural + low semantic coupling
      → accidental/infrastructure coupling
  low structural + high semantic coupling
      → fragmented behavior
  ↓
9. Find strongly coupled subsets
  maximize internal behavioral change coupling
  minimize coupling outside the subset
  ↓
10. Form candidate Behavioral Regions
  regions may overlap and nest;
  they are not required to match files/functions
  ↓
11. Assign boundaries and relationships
  members
  inputs/surfaces
  outputs/effects
  dependencies
  child/parent BRs
  shared infrastructure
  ↓
12. Infer semantic identity
  concise stable description of the behavior/change unit
  ↓
13. Reconcile with previous graph
  preserve BR identity across renames, moves and refactors;
  distinguish implementation change from behavioral change
  ↓
14. Store evidence + confidence
  every membership/boundary decision must be explainable
  from structural evidence, semantics and mutation tests
