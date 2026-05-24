# Map Manager Gates

These gates apply before mutation, projection, or worker delegation.

## G0 Target Resolution

Required before every map operation.

- Resolve map label/id.
- Resolve canonical path, node id, or current scope.
- Reject ambiguous name matches unless the handoff explicitly permits a choice.

## G1 Product / Operation Split

Before editing, classify the rule being applied.

| Kind | Home |
|---|---|
| product meaning | `docs/03_Spec/` |
| agent behavior | `protocols/` |
| invocation trigger | `agent_instructions/skills_canonical/` |
| generated mirror | `.codex/skills/`, `.claude/skills/`, `.agents/skills/` |

Do not solve product ambiguity by adding more skill prose.

## G2 Scope Boundary

Required when scope, scopen, unscopen, worker ownership, or display boundary is
involved.

- Name the boundary purpose.
- Name whether the boundary is view, edit, audit, or product structure.
- Reject scope creation whose only reason is size.

## G3 Relation Type

Required when a relation is created or changed.

- Use `edge` for tree ownership.
- Use `GraphLink` for non-tree map relation.
- Use node-level `link` for an external URL/attribute.
- Use `alias` for cross-scope visibility without ownership move.

## G4 Projection

Required when the requested output is MF, WMF, Mermaid, outline, report, or any
other non-native representation.

- Treat the output as a projection, interchange format, render format, or
request format.
- Do not infer M3E storage shape from the projection syntax.
- Preserve canonical M3E identity/path separately from rendered labels.

## G5 Worker Boundary

Required before assigning to a worker.

- Worker gets a bounded target and explicit allowed changes.
- Worker does not decide storage, scope, layout, alias-vs-move, or cross-facet
  relations.
- Worker does not write M3E maps via direct API, SQLite, or runtime files unless
  the handoff explicitly delegates an authorized `m3e-map` execution path.

## G6 Verification

Required after mutation.

- Re-read target path/scope.
- Verify tree invariants and relation endpoints.
- Verify scope/display intent was preserved.
- Report unresolved ambiguity instead of silently normalizing it.
