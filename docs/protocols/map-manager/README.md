# Map Manager Protocol Package

## Purpose

Map Manager prevents repeated AI confusion when reading, writing, laying out,
scoping, projecting, and delegating M3E maps.

This package is the operational SSOT for Map Manager behavior. Product meaning
stays in `docs/03_Spec/`; skill files only route and invoke.

## Package files

| File | Role |
|---|---|
| `README.md` | Decision order, ownership, worker boundary |
| `gates.md` | Mandatory gates before mutation or delegation |
| `projection-rule.md` | Projection / interchange / storage separation |
| `../contracts/map_manager_contract.yaml` | Checkable Map Manager contract |
| `../contracts/scope_contract.yaml` | Checkable scope contract |
| `../contracts/write_contract.yaml` | Checkable write contract |

Legacy readers may still enter through `docs/protocols/map-manager.md`, but new
rules belong here.

## Canonical references

- Product data model: `docs/03_Spec/Data_Model.md`
- Scope and alias model: `docs/03_Spec/Scope_and_Alias.md`
- Path notation: `docs/03_Spec/Node_Path_Notation.md`
- Layout modes: `docs/03_Spec/map_layout_modes.md`
- Write contract: `docs/protocols/map-write-protocol.md`
- Scope contract: `docs/protocols/scope-operation-protocol.md`

## Map Manager owns

- target map / path / scope resolution
- projection target and purpose
- scope purpose and scope granularity
- scopen / unscopen decisions
- facet detection and facet-local rules
- edge / GraphLink / alias / node-level link distinction
- layouting and display intent
- cross-scope and cross-facet alias/link operations
- worker handoff packet preparation
- post-write verification and ambiguity routing

## Worker must not own

- redefining scope boundaries
- deciding alias vs move vs GraphLink across facets
- changing layout/display intent
- restructuring outside assigned path
- deciding M3E storage shape
- writing M3E maps by direct API / SQLite / runtime-file mutation
- writing cross-facet relations without explicit Map Manager handoff

Workers return a handoff or ambiguity report when those decisions are needed.

## Decision order

Before any non-trivial map write:

1. Identify the map and target path using canonical display path notation.
2. Identify the requested projection or surface, if any.
3. Identify the scope purpose: cognition boundary, edit boundary, review batch,
   audit boundary, or product structure.
4. Decide whether the operation is local, scoped, cross-scope, or cross-facet.
5. Decide facet and facet-local meaning of parent-child.
6. Decide scope granularity.
7. Choose move vs alias vs GraphLink.
8. Decide display intent and layouting.
9. Produce worker handoff or execute through the authorized map-write path.
10. Verify structure, display intent, and invariants.

## Path notation

Use human-facing paths from `docs/03_Spec/Node_Path_Notation.md`.

Canonical display form:

```text
M:(<map label>)> A > B >> C
```

- `>` separates parent-child/display path segments inside the same scope.
- `>>` marks a scope boundary.
- `/` is legacy/API compatibility only.
- `\` is filesystem only.

When ambiguous, stop and resolve. Do not guess a target node.

## Required distinctions

- `edge`: parent-child tree ownership relation; participates in layout.
- `GraphLink`: non-tree relation; overlay only; does not participate in layout.
- node-level `link`: external URL or attached attribute; not a graph relation.
- `alias`: reference window to a canonical entity; not an ownership move.

## Scope purpose

A scope is not a storage boundary. It is a purpose-bearing cognition and editing
boundary.

Use scope when:

- the user needs a local world
- a subtree has coherent meaning
- the boundary clarifies view, edit, or audit responsibility
- editing outside that boundary would create noise
- a worker can safely own the bounded region

Do not scope merely because a node has many children. First check semantic
cohesion and boundary purpose.

## Scope granularity

Prefer a scope that is:

- meaningful as a local world
- small enough for a worker to inspect without global context
- large enough to avoid fragmenting every tiny group
- stable under expected edits
- clear about view / edit / audit boundary

Soft guide: semantic cohesion first; node count is only a smell, not a rule.

## scopen / unscopen

- `scopen`: make an existing node or node group a scope boundary.
- `unscopen`: remove the boundary while preserving content.
- Worker does not scopen/unscopen unless explicitly instructed by Map Manager.
- If scopen affects worker ownership, Map Manager must update the handoff.

## Layouting and display intent

`layouting` is product/view behavior. `display intent` is the write-time human
review contract.

Before inserting anchors or colors, decide:

- what should be noticed first
- what should be compared side-by-side
- what relation should stay primary
- whether anchors are semantic or display-synthetic
- what colors encode
- whether the result is scoped or unscoped

`GraphLink` must not influence subtree placement.

## Worker handoff packet

A worker handoff must include:

1. target map label/id if known
2. target canonical path/scope
3. task goal
4. allowed files/nodes
5. forbidden changes
6. relevant spec/protocol links
7. verification expected
8. escalation triggers
9. report format

## Ambiguity handling

If the operation requires a structural judgment not explicitly assigned, Map
Manager should create a review question or return a handoff clarification.
Worker should not decide silently.
