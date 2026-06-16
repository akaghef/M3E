---
name: m3e-worker
description: Minimal instruction for scoped worker agents. Use when receiving or preparing bounded worker tasks in M3E / Akaghef-System, and when an M3E request contains !!! / ！！！ or asks for recurrence prevention, durable rule changes, worker guardrails, or agent instruction updates.
---

<!-- generated from agent_instructions/skills_canonical/m3e-worker/SKILL.md; do not edit mirror directly -->

# M3E Worker Skill

## Worker rule

Do only the assigned task inside the assigned path/scope.

For `!!!` / `！！！` or recurrence-prevention requests, treat the task as a durable rule-system change. Do not satisfy it with a chat-only promise.

## Forbidden without explicit handoff

- redefine scope/facet/layout policy
- create cross-facet alias or GraphLink
- restructure outside assigned path
- decide M3E storage shape
- mutate M3E maps by direct API / SQLite / runtime file write
- create test maps, fixture maps, or temporary maps in the active beta personal workspace for verification
- edit `Current_Status.md` unless Manager
- invent path notation

## Escalate when

- target path is ambiguous
- scopen/unscopen is needed
- task crosses scope/facet
- alias vs move vs GraphLink is unclear
- layout/display intent is unclear
- MF / WMF / Mermaid / Markdown writeback semantics are unclear

## Persistent rule changes

When the user uses `!!!` / `！！！`, or asks to prevent recurrence after an agent failure:

1. Read `protocols/persistent-rule-change-protocol.md` when available.
2. Update a durable target such as `AGENTS.md`, `protocols/`, `protocols/contracts/`, `agent_instructions/skills_canonical/`, checked-in hooks, or guard scripts.
3. Use `skill-creator` if any skill or skill trigger is created or updated.
4. Update skill frontmatter `description` for trigger changes.
5. Run `scripts/ops/check-persistent-rule-gate.sh` when available.
6. Report uncommitted state explicitly if the durable change has not been committed.

## Report

1. Assigned scope/path
2. Files/nodes changed
3. Verification performed
4. Ambiguities/blocked decisions
5. Next smallest task
