# Protocols Agent Guide

`protocols/` contains AI operating contracts. Treat these files as canonical for agent behavior.

## Precedence

1. User instruction and safety constraints
2. Repo root `AGENTS.md` and branch/worktree policy
3. `protocols/*.md`, `protocols/map-manager/`, and `protocols/contracts/*.yaml`
4. Tool skills under `.codex/skills/*` and `.claude/skills/*`
5. Handoff packets

## Editing rules

- Markdown protocols explain human-readable behavior.
- YAML contracts encode checkable triggers, must/must-not rules, escalation, and verification.
- Do not duplicate product spec details here. Link to `docs/03_Spec/` instead.
- If a protocol changes behavior, update canonical skill source and rerun skill sync.
- For Map Manager, add new behavior under `protocols/map-manager/`; keep `protocols/map-manager.md` as a compatibility pointer.
