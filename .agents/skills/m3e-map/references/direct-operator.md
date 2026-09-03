<!-- generated from agent_instructions/skills_canonical/m3e-map/references/direct-operator.md; do not edit mirror directly -->

# Direct M3E Runtime Operator

Use this route for an explicitly targeted M3E runtime operation that does not
leave a structural or display-policy decision to the operator.

## Boundary

The operator is not an M3E product worker. Do not read project goals, roadmap,
Current Status, Glossary, Map Manager, facet contracts, or display-intent
guidance.

Escalate to the internal design route only if the target is ambiguous or the
request leaves a choice about scope boundary, tree ownership, alias/GraphLink,
facet, layout, ordering, anchoring, or color semantics.

## Procedure

1. Resolve the supplied map and scope or path. Reject ambiguity.
2. Read the affected state using [read.md](read.md).
3. Read [data-model.md](data-model.md) and [write.md](write.md) only when the
   requested operation writes state.
4. Apply exactly the supplied operation. Preserve unspecified fields.
5. Re-read the affected target and verify the requested invariant.

For an exact subtree copy, preserve the source subtree's node content,
hierarchy, order, and attributes while generating destination-local node IDs.
Copy only GraphLinks wholly inside that subtree; do not invent cross-boundary
relations. Do not run default recoloring, because it would change copied
content.

## Report

State the target, the exact operation completed, and the verification result.
Do not report M3E internal strategy or unrelated project context.
