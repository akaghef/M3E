---
name: map-manager
description: Resolve open M3E structural decisions about scope purpose, layout, display intent, facet or relation choice, path ambiguity, or worker ownership. Fully specified map operations use MCP directly without this skill.
---
# Map Manager Skill

## DP Router

- DP0: clarify unresolved structure and explicit constraints before implementation.
- DP1: apply the same canonical guidance during initial MCP adoption.
- DP2: use MCP directly for specified operations; consult this guidance only for an open structural decision.

Canonical guidance is also available through MCP Resources / Prompts. This skill
is a repository-local entry point, not a prerequisite for map operations or a
requirement to launch a separate agent.

## Decision order

1. Target map/path/scope and Content / explicit constraints / proposals
2. Scope purpose
3. Local vs scoped vs cross-scope vs cross-facet
4. Facet and parent-child meaning
5. Scope granularity
6. Move vs alias vs GraphLink
7. Remaining Layout / Style decisions under display intent and explicit constraints
8. Bounded worker handoff or direct MCP execution under `docs/protocols/mcp-map-operations.md`
9. Verification against received Content / provenance and explicit constraints

## Must preserve distinctions

- `edge`: parent-child tree relation; participates in layout
- `GraphLink`: non-tree relation; excluded from Tree subtree placement, but may
  contribute to force placement under the existing Surface View specification
- node-level `link`: external URL/attribute
- `alias`: reference window; not ownership move

Use the four-category input/output contract in the protocol README. Preserve
explicit Topology / Layout / Style requirements; treat worker suggestions as
proposals. Collapse changes visibility, not persistent Topology. Product
definitions live in the Data Model; do not redefine them in this skill.

## Canonical references

- `docs/00_Home/Glossary.md`
- `docs/03_Spec/Data_Model.md#content--topology--layout--style`
- `docs/protocols/map-manager/README.md`
- `docs/protocols/map-manager/gates.md`
- `docs/protocols/map-manager/projection-rule.md`
- `docs/protocols/mcp-map-operations.md`
- `docs/protocols/contracts/map_manager_contract.yaml`
- `docs/protocols/contracts/scope_contract.yaml`
- `docs/protocols/contracts/write_contract.yaml`
