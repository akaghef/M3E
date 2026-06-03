# Projection Rule

M3E storage is not MF, WMF, Mermaid, Markdown, or any other exchange syntax.

## Canonical rule

M3E storage is the map model: workspace, map, scope, node, edge, GraphLink,
alias, and node attributes. External formats are projections or requests.

## Format roles

| Format family | Role |
|---|---|
| MF / WMF | compact human/request/interchange notation |
| Mermaid | render or communication format |
| Markdown / outline | linear projection or documentation surface |
| JSON / YAML handoff | task contract or machine-readable request |

None of these decide ownership, scope boundary, relation kind, or layouting by
themselves.

## Projection pipeline

1. Resolve canonical M3E target path or node id.
2. Decide projection purpose: view, edit, audit, render, request, or handoff.
3. Decide whether the projection may write back.
4. If writeback is allowed, map projected edits back through Map Manager gates.
5. Verify M3E invariants after writeback.

## Consequences

- `MF-L p="M:(開発)> A > B"` points to M3E path; it is not storage.
- Mermaid arrows do not imply `edge`; they may represent `GraphLink`, flow, or
  narrative relation depending on the projection contract.
- A Markdown heading tree may be a linear projection of a scope, not the
  canonical ownership tree.
- Render-only diagrams must not create new scopes or links without an explicit
  writeback contract.
