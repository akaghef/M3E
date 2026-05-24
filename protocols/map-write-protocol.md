# Map Write Protocol

## Purpose

Define how AI writes M3E maps without corrupting structure or confusing semantic structure with display decisions.

## Required sequence

1. Identify map.
2. Resolve target path/scope.
3. Read current state.
4. Determine whether this is trivial CRUD or display-governed structural write.
5. For display-governed write, consult Map Manager decision order.
6. Mutate in memory.
7. Validate invariants.
8. Write.
9. Re-read / verify.

## Invariants

- root exists and has `parentId: null`
- every child has matching `parentId`
- no orphan nodes
- no cycles
- alias has no children
- alias target is not another alias
- GraphLink endpoints exist and are non-alias unless explicitly revised by product spec

## Display-governed writes

If the user cares about reviewability, layout, color, grouping, scope, or worker handoff, do not treat the write as plain CRUD.

Decide before mutation:

- facet
- display intent
- anchoring
- color semantics
- scoped vs unscoped result

## Default coloring

Use default difficulty coloring only when no stronger display-intent color semantics are active.

If a review map encodes importance / urgency / confidence, do not overwrite it with generic difficulty coloring.

## Verification

Report:

- target map/path
- nodes/links changed
- whether scope/layout/display intent was preserved
- what was verified
- any unresolved ambiguity
