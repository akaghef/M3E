# Protocols Agent Guide

`docs/protocols/` contains AI operating contracts. Treat these files as canonical for agent behavior.

## Precedence

1. User instruction and safety constraints
2. `CLAUDE.md` and `docs/06_Operations/Director_Playbook.md` for Claude Director behavior
3. Repo root `AGENTS.md` and branch/worktree policy
4. `docs/protocols/*.md`, `docs/protocols/map-manager/`, and `docs/protocols/contracts/*.yaml`
5. Tool skills under `.codex/skills/*` and `.claude/skills/*`
6. Handoff packets

## Editing rules

- Markdown protocols explain human-readable behavior.
- YAML contracts encode checkable triggers, must/must-not rules, escalation, and verification.
- Repository canon, source/artifact allocation, generated-output policy, worktree layout, and private/public-danger material routing must follow `docs/protocols/repository-canon-values.md`.
- Do not duplicate product spec details here. Link to `docs/03_Spec/` instead.
- Do not reintroduce Claude sub-agent workers; Claude is Director and Codex is the worker.
- If a protocol changes behavior, update canonical skill source and rerun skill sync.
- For Map Manager, add new behavior under `docs/protocols/map-manager/`; keep `docs/protocols/map-manager.md` as a compatibility pointer.
