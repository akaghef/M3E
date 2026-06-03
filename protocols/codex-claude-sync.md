# Codex / Claude Skill Sync Protocol

## Goal

Codex and Claude should obey the same M3E rules without hand-maintaining two divergent skill trees.

## Source and mirrors

Canonical source:

```text
agent_instructions/skills_canonical/
```

Mirrors:

```text
.codex/skills/
.claude/skills/
.agents/skills/   # migration compatibility if still needed
```

## Required commands

```bash
node tools/sync_agent_instructions.mjs --write
node tools/sync_agent_instructions.mjs --check
```

## Rules

- edit canonical source only
- generated mirrors must contain a generated header
- CI fails if mirrors differ from canonical output
- protocol changes that alter behavior must update skills in the same PR
