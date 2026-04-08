# M3E Agent Execution Guide

## Objective

This repository is operated with agent-driven implementation cycles.
Agents should prioritize small validated changes over broad refactors.

## Environment Structure

| Environment | Directory | Status | Purpose |
|-------------|-----------|--------|---------|
| Alpha | `mvp/` | **Frozen — do not touch** | Completely ignored (no read/write) |
| Beta | `beta/` | **Active development** | Current dev & daily use |
| Final | `final/` | Stable release | Production use / distribution |

**Current active development target: `beta/`**

Alpha (`mvp/`) is permanently frozen. Do not read or write any files under `mvp/`. All development happens in `beta/` only.

### Launch scripts

| Script | Use |
|--------|-----|
| `scripts/beta/launch.bat` | Daily use — launch Beta (build required) |
| `scripts/beta/update-and-launch.bat` | Pull latest → install → build → launch |
| `scripts/final/migrate-from-beta.bat` | Sync Beta → Final, migrate data, launch |
| `scripts/alpha/launch.bat` | Launch Alpha (reference only) |

## Source of Truth

1. Strategy and MVP scope:
   - `dev-docs/02_Strategy/MVP_Definition.md`
2. Current priorities and progress:
   - `dev-docs/00_Home/Current_Status.md`
3. Daily execution log:
   - `dev-docs/daily/YYMMDD.md`
4. Operations rules:
   - `dev-docs/06_Operations/Documentation_Rules.md`

## Definition of Update-Complete

A task is update-complete only when all three are done:

1. Changes are committed.
2. Daily note is updated (`dev-docs/daily/YYMMDD.md`).
3. Current status is updated by manager (`dev-docs/00_Home/Current_Status.md`) when status has changed.

If any item is missing, task state is still in-progress.

## Session Start Gate (One-Time Enforcement)

At session start, run one bootstrap command, then proceed with normal work.
Do not repeatedly re-run full checks every step.

For agents that support slash prompts:

- `/setrole codex1`
- `/setrole codex2`
- `/setrole claude`

For normal Codex (non-Copilot):

```powershell
pwsh -File scripts/ops/setrole.ps1 codex1
# or codex2 / claude
```

Required checks performed by bootstrap:

1. Role confirmation.
2. Worktree/directory alignment.
3. Branch alignment.
4. For `codex1` / `codex2`: `fetch + reset --hard origin/dev-beta` before new implementation work.

If checks fail or hard reset is not possible, stop and escalate to `akaghef`.

## Agent Workflow

1. Read scope and current status.
2. Pick one smallest deliverable task.
3. Implement with minimal changes.
4. Run a local verification step.
5. Update docs using split ownership:
   - UpdateLog goes to `dev-docs/daily/YYMMDD.md`.
   - `Current_Status.md` keeps current snapshot only.
   - Subordinates treat `Current_Status.md` as read-only.
   - Manager updates `Current_Status.md` by referencing subordinate daily logs.
   - Rough TODOs go to `dev-docs/06_Operations/Todo_Pool.md`.
6. Commit with an imperative message.

## Branch Operation Policy

1. On branches starting with `dev-`, agents may perform branch operations autonomously.
2. Allowed without per-step confirmation: create/switch `dev-*` branches, stage changes, commit, and push.
3. Exceptions that still require explicit confirmation:
   - destructive history rewrite (force-push, arbitrary history rewrite)
   - `reset --hard` outside of the mandatory sync step (i.e. not `reset --hard origin/dev-beta` at session start)
   - operations on `main` or release branches
   - secret/credential related operations

## beta_update

A task is **beta_update-complete** when all three steps are done in order:

1. `git commit` — changes committed on the current role branch.
2. `git push origin <branch>` — branch pushed to remote.
3. PR created with base `dev-beta` — opened and ready for manager review.

Use this term to refer to the full handoff sequence. Subordinates run `beta_update` at the end of each task cycle; manager (`claude`) does not run `beta_update` (managers merge, not PR).

## Mandatory Integration Protocol (Subordinate -> PR -> Manager -> Resume)

1. Subordinate agents (`codex1`, `codex2`) implement and push only to assigned branches (`dev-beta-visual`, `dev-beta-data`).
2. Subordinates create a PR with base `dev-beta` from their assigned branch.
3. Manager (`claude`) reviews and merges the PR into `dev-beta`.
4. Before a subordinate starts the next task cycle, they MUST sync latest `dev-beta` by hard-resetting their branch to `origin/dev-beta`.
5. Subordinates must not resume implementation on stale history.

Recommended command sequence for subordinates:

```bash
git fetch origin
git checkout dev-beta-visual   # or dev-beta-data
git reset --hard origin/dev-beta
```

If hard reset fails or produces unexpected state, stop and escalate to `akaghef`.

## Development Phase Constraints

### Alpha (mvp/) — Frozen / Do Not Touch
1. **Do not read or write any files under `mvp/`.** Completely ignore this directory.
2. No new features, no bug fixes, no reference reads.
3. Agents must never open, diff, or analyze `mvp/` files for any purpose.

### Beta (beta/) — Active
1. Infrastructure and test environment are top priority.
2. AI proposal features are deferred.
3. Data-safe operations are top priority.
4. Prefer stable, operable UI over architecture expansion.

### Final (final/) — Stable
1. Only receives validated code from Beta via `migrate-from-beta.bat`.
2. No direct development in `final/`.
3. All data migrations must be scripted and reversible.

## Language Policy

1. Agent-user conversation should be in English by default.
2. Design and development documents under `dev-docs/` should be written in Japanese by default.
3. Code identifiers, file names, API names, and technical tokens may remain in English where appropriate.
4. If a document is a design/spec/architecture/ADR document, prefer Japanese prose even when the surrounding conversation is in English.

## Preferred Task Order (Beta Phase)

1. **P5 — Infrastructure & CI**: test environment, CI pipeline, deployment scripts.
2. **P4 — Demo quality**: visual polish, fit-to-content, focus-selected.
3. **P3 — MVP completeness**: metadata rendering, startup packaging.
4. **P2 — Dev infrastructure**: Stage A CI, hit-test coverage.
5. **P1 — Deferred**: reparent feedback UI, delete confirmation dialog.

## Handoff Format

When an agent finishes a cycle, report:

1. What changed (files and behavior).
2. What was verified.
3. What remains next (one concrete task).
