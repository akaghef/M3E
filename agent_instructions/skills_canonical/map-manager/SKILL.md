---
name: map-manager
description: Decide M3E map structure before writing or delegating. Use when a task involves scope, scopen/unscopen, layouting, display intent, facet choice, edge/link/alias choice, cross-facet relations, path ambiguity, or worker handoff.
---
# Map Manager Skill

## Decision order

1. Target map/path/scope
2. Scope purpose
3. Local vs scoped vs cross-scope vs cross-facet
4. Facet and parent-child meaning
5. Scope granularity
6. Move vs alias vs GraphLink
7. Display intent / layouting
8. Worker handoff or direct m3e-map execution
9. Verification

## Must preserve distinctions

- `edge`: parent-child tree relation; participates in layout
- `GraphLink`: non-tree relation; overlay only
- node-level `link`: external URL/attribute
- `alias`: reference window; not ownership move

## Canonical references

- `protocols/map-manager/README.md`
- `protocols/map-manager/gates.md`
- `protocols/map-manager/projection-rule.md`
- `protocols/contracts/map_manager_contract.yaml`
- `protocols/contracts/scope_contract.yaml`
- `protocols/contracts/write_contract.yaml`
