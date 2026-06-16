# Codex / Claude Instruction Sync Protocol

## Goal

Codex and Claude must see compatible M3E rules while preserving their different roles:

- Claude = Director.
- Codex = worker.

## Canonical Operating Sources

Claude-facing Director contract:

```text
CLAUDE.md
docs/06_Operations/Director_Playbook.md
```

Shared operating protocols:

```text
AGENTS.md
protocols/
docs/06_Operations/AI_Instruction_Routing.md
docs/06_Operations/Worktree_Separation_Rules.md
```

Skill mirrors, when present, are compatibility surfaces:

```text
.codex/skills/
.claude/skills/
.agents/skills/
```

## Rules

- Do not reintroduce Claude implementation workers.
- Protocol changes that alter Codex behavior must update any relevant skill source or mirror in the same PR.
- Generated mirrors must contain a generated header when the sync tool manages them.
- If a mirror conflicts with `CLAUDE.md` or `Director_Playbook.md`, the canonical Director sources win for Claude behavior.
