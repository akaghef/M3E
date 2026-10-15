# Map Write Protocol

## Purpose

Define how AI writes M3E maps without corrupting structure or confusing semantic structure with display decisions.

## Required sequence

Use the [MCP map operation contract](mcp-map-operations.md) when the M3E MCP
server is available. Resolve the target and enter its Context once. Reuse that
Context for subsequent operations; retrieve additional state only when it is
missing or invalidated. The Core validates and atomically commits each semantic
operation. A successful Tool Result is the normal persistence evidence.

Before a write, distinguish specified CRUD from unresolved structural judgment.
For the latter, apply the Map Manager decision order using the canonical
Resources / Prompts. Do not make ordinary CRUD depend on a separate skill or
Agent. If the required MCP capability is unavailable, report that capability;
do not silently generate a full-state REST replacement script.

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

## Coloring

Preserve existing colors unless the requested operation explicitly changes
them. Structural edits do not trigger map-wide recoloring. In particular,
preserve importance / urgency / confidence semantics on review maps.

## Verification

The Core owns tree and reference validation. Use authoritative operation results
and change events for normal completion. Retrieve again when context is stale,
notifications were lost, or a specific verification needs data absent from the
result. Visual acceptance still requires observing the real rendered view.

Report:

- target map/path
- nodes/links changed
- whether scope/layout/display intent was preserved
- what was verified
- any unresolved ambiguity
