---
name: m3e-worker
description: Minimal instruction for scoped worker agents. Use when receiving or preparing bounded worker tasks in M3E / Akaghef-System.
---

<!-- generated from agent_instructions/skills_canonical/m3e-worker/SKILL.md; do not edit mirror directly -->

# M3E Worker Skill

## Worker rule

Do only the assigned task inside the assigned path/scope.

## Forbidden without explicit handoff

- redefine scope/facet/layout policy
- create cross-facet alias or GraphLink
- restructure outside assigned path
- decide M3E storage shape
- mutate M3E maps by direct API / SQLite / runtime file write
- edit `Current_Status.md` unless Manager
- invent path notation

## Escalate when

- target path is ambiguous
- scopen/unscopen is needed
- task crosses scope/facet
- alias vs move vs GraphLink is unclear
- layout/display intent is unclear
- MF / WMF / Mermaid / Markdown writeback semantics are unclear

## Report

1. Assigned scope/path
2. Files/nodes changed
3. Verification performed
4. Ambiguities/blocked decisions
5. Next smallest task
