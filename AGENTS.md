# M3E Agent Execution Guide

## Objective

This repository is operated with a Director to Codex model.
Prefer small validated changes over broad refactors.

## Operating Model

Canonical Claude-facing sources:

1. `CLAUDE.md`
2. `docs/06_Operations/Director_Playbook.md`

Current model:

- Claude = Director only. Claude routes, decomposes intent, writes Codex handoffs, dispatches Codex, reviews results, and manages worktrees / PRs.
- Codex (`codex exec`) = sole worker for implementation, spec writing, refactoring, investigation, tests, commits, and PR creation.
- The old Claude sub-agent worker model (`manage` / `visual` / `data` / `team`) is superseded. Do not launch Claude Agent Teams for implementation.

## Environment Structure

| Environment | Directory | Status | Purpose |
|-------------|-----------|--------|---------|
| Beta | `beta/` | **Active development** | Current dev & daily use |
| Final | `final/` | Stable release | Production use / distribution |

**Current active development target: `beta/`**

### Launch scripts

| Script | Use |
|--------|-----|
| `scripts/beta/launch.bat` | Daily use — launch Beta (build required) |
| `scripts/beta/update-and-launch.bat` | Pull latest → install → build → launch |
| `scripts/final/migrate-from-beta.bat` | Sync Beta → Final, migrate data, launch |

## Source of Truth

1. Strategy and current direction:
   - `docs/00_Home/Home.md`
2. Current priorities and progress:
   - `docs/00_Home/Current_Status.md`
3. Director procedure:
   - `CLAUDE.md`
   - `docs/06_Operations/Director_Playbook.md`
4. Operations rules:
   - `docs/06_Operations/Documentation_Rules.md`
   - `docs/06_Operations/Worktree_Separation_Rules.md`
5. Repository canon values:
   - `docs/protocols/repository-canon-values.md`

## AI Instruction Routing

For M3E / Akaghef-System work, do not duplicate detailed rules in this file.

- Product meaning of map / node / scope / edge / GraphLink / alias / path / layout lives under `docs/03_Spec/`.
- Repository-level canon, source/artifact allocation, generated-output policy, worktree placement, and private/public-danger material routing live in `docs/protocols/repository-canon-values.md`.
- Agent operating behavior lives under `docs/protocols/`.
- Claude Director behavior lives in `CLAUDE.md` and `docs/06_Operations/Director_Playbook.md`.
- Map read/write execution uses the `m3e-map` skill.
- Structural map decisions use `docs/protocols/map-manager/` (with `docs/protocols/map-manager.md` as a compatibility pointer) and the `map-manager` skill.
- Codex workers must follow `docs/protocols/worker-minimal-instruction.md` and must not redefine scope, layout, alias, storage, or cross-facet link policy.

When a map task involves scope, scopen / unscopen, layouting, path ambiguity, edge / GraphLink / alias choice, or worker handoff, route it through Map Manager before mutation.

## Bang Scope and Persistent Rule Gate

Count the maximum trailing run of `!` or `！` in the user's latest instruction.

- `0` or `1`: local task only.
- `2` / `!!` / `！！`: target plus obvious adjacent effects in the same turn.
- `3` / `!!!` / `！！！`: broad sync. Inspect directly related rules, protocols, docs, skills, hooks, and handoff consistency.

For `!!` or `!!!`, first state:

```text
Scope: LV<n>. Target=<...>. Adjacent=<...>. Excluded=<...>.
```

### LV3 Persistent Rule Change Gate

When `!!!` is present, or when the user asks for recurrence prevention after an agent failure, the task is not complete until the agent has either made a durable rule-system change or explicitly reported why that is blocked.

Durable rule-system changes include one or more of:

- root `AGENTS.md`
- `docs/protocols/` or `docs/protocols/contracts/`
- canonical skill sources under `agent_instructions/skills_canonical/`
- checked-in hook or guard scripts under `scripts/hooks/` or `scripts/ops/`
- CI workflows that verify agent instruction consistency
- project docs only when they are the canonical location for the changed behavior

If creating or updating a skill, a skill trigger, or skill routing behavior, use the `skill-creator` skill in the same turn. Skill trigger changes must update the skill frontmatter `description`, because that is the trigger surface.

The final report for an LV3 persistent-rule task must list:

1. durable files changed,
2. checks run,
3. whether skill mirrors were synced,
4. any remaining non-durable or uncommitted state.

Do not describe LV3 recurrence prevention as done if it exists only as a chat promise.

## Mandatory Session Context

Before any analysis, planning, or implementation, the agent must load the current project context from:

1. `docs/00_Home/Agent_Brief.md`
2. `docs/00_Home/Current_Status.md`
3. `docs/00_Home/Glossary.md`

`Home.md` remains the long-form source of truth. `Agent_Brief.md` is the mandatory short-form bootstrap summary for session start and re-orientation.

The agent must not begin work until it can state, in its own words:

1. the current product vision relevant to the task,
2. the current active development focus,
3. the glossary terms that matter for the task,
4. how the requested work fits current status and priorities.

If this context check is missing, the task is considered not started.

## Director to Codex Workflow

1. Claude Director reads scope and current status.
2. Claude Director defines one smallest deliverable task.
3. Claude Director creates a task worktree when writes are needed:
   ```bash
   scripts/ops/worktree.sh new <task>
   ```
4. Claude Director dispatches Codex:
   ```bash
   # Investigation / search
   scripts/codex.sh exec --sandbox read-only "<handoff>" < /dev/null

   # Implementation
   ( cd "$HOME/dev/M3E-worktrees/<task>" && scripts/codex.sh exec "<handoff>" < /dev/null )
   ```
5. Codex implements with minimal changes, verifies, commits, pushes `codex/<task>`, and opens a PR to `dev-beta`.
6. Claude Director reviews and decides merge / iterate / escalate.
7. Claude Director removes the task worktree after merge.

Always invoke Codex via `scripts/codex.sh exec ... < /dev/null`.

## Worktree Rules

- Primary checkout: `$HOME/dev/M3E` on `dev-beta`; no product implementation directly here.
- Each code-writing Codex task runs at `$HOME/dev/M3E-worktrees/<task>`.
- Each task branch is `codex/<task>`, branched from `dev-beta`.
- PR target is `dev-beta`.
- Use `scripts/ops/worktree.sh new/list/clean/rm`.
- Do not use obsolete role branches (`dev-visual`, `dev-data`, `dev-team`) for new work.

Required check before implementation dispatch:

```bash
git worktree list --porcelain
git branch --show-current
pwd
```

After creating or selecting a worktree, every subsequent write command must
either run with that worktree as its explicit working directory or use
`git -C <worktree-path>`. Do not assume that `git worktree add` changes the
current shell directory. Before the first write, verify both `pwd` and
`git branch --show-current` from the target worktree.

## Definition of Update-Complete

A task is update-complete only when all required state sync is done:

1. Changes are committed.
2. PR to `dev-beta` is created for code-writing Codex tasks.
3. Shared map state / task state is updated when the task affects ongoing coordination.
4. `docs/00_Home/Current_Status.md` is updated by Director only when active strategy status has changed.

If any item is missing, task state is still in-progress.

## Branch Operation Policy

Codex task branches use `codex/<task>`.

Allowed without per-step confirmation on `codex/*` branches:

- create task branch/worktree via `scripts/ops/worktree.sh`
- stage changes
- commit
- push
- create PR to `dev-beta`

Still require explicit confirmation:

- destructive history rewrite or force-push
- `reset --hard`
- operations on `main` or release branches
- secret/credential related operations

## beta_update

A task is **beta_update-complete** when all three steps are done in order:

1. `git commit` — changes committed on `codex/<task>`.
2. `git push origin codex/<task>` — branch pushed to remote.
3. PR created with base `dev-beta` — opened and ready for Director review.

Claude Director reviews and merges; Codex does not merge its own PR.

## Development Phase Constraints

### Beta (`beta/`) — Active

1. Infrastructure and test environment are top priority.
2. AI proposal features are deferred.
3. Data-safe operations are top priority.
4. Prefer stable, operable UI over architecture expansion.

### Final (`final/`) — Stable

1. Only receives validated code from Beta via `migrate-from-beta.bat`.
2. No direct development in `final/`.
3. All data migrations must be scripted and reversible.

## Language Policy

1. Agent-user conversation should be in English by default.
2. Design and development documents under `docs/` should be written in Japanese by default.
3. Code identifiers, file names, API names, and technical tokens may remain in English where appropriate.
4. If a document is a design/spec/architecture/ADR document, prefer Japanese prose even when the surrounding conversation is in English.

## Preferred Task Order (Beta Phase)

1. **P5 — Infrastructure & CI**: test environment, CI pipeline, deployment scripts.
2. **P4 — Demo quality**: visual polish, fit-to-content, focus-selected.
3. **P3 — Rapid baseline completeness**: metadata rendering, startup packaging.
4. **P2 — Dev infrastructure**: Stage A CI, hit-test coverage.
5. **P1 — Deferred**: reparent feedback UI, delete confirmation dialog.

## Handoff Format

When an agent finishes a cycle, report:

1. What changed (files and behavior).
2. What was verified.
3. What remains next (one concrete task).

When mentioning a commit ID, branch, or PR, state its change intent in one plain-language line immediately beside it. Never present an identifier alone or require Akaghef to inspect Git history to understand why it matters.
