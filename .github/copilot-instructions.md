# Copilot Agent Instructions — M3E

## Project Overview

M3E is a local-first research thinking support tool built with React + TypeScript (browser) and Node.js (server).
Two environments exist: `beta/` (active development) and `final/` (stable release).
Active development happens in `beta/`. Do not modify `final/` unless explicitly instructed.

Full project specs are in `docs/`. Read relevant specs before starting implementation.

---

## Agent Roles and Branch Assignment

| Role | Branch | Scope |
|------|--------|-------|
| `visual` | `dev-visual` | Rendering layer, SVG/canvas, visual styles, CSS, layout |
| `data` | `dev-data` | Model layer, Controller, ViewState, SQLite, Command pattern |
| `data2` | `dev-data2` | Parallel worker for the data role |
| `team` | `dev-team` | Collaboration / Cloud Sync |
| `manage` | `dev-beta` | Merge, specs, task management, Final migration |
| `akaghef` | — | Review and direction |

**Each agent must only commit to its assigned branch.**
When in doubt about scope boundary, stop and ask `akaghef`.

### Mandatory Integration Cycle

1. Subordinate roles (`visual` / `data` / `data2` / `team`) push their work to their role branch (`dev-visual` / `dev-data` / `dev-data2` / `dev-team`).
2. `manage` merges those changes into `dev-beta`.
3. Before starting the next task, subordinate roles must rebase onto latest `origin/dev-beta`.
4. Do not continue implementation if your branch is not rebased to current `dev-beta`.

---

## Permitted Operations (No Confirmation Needed)

All operations are permitted autonomously **except those listed below**.
Proceed without asking for confirmation unless the operation falls into the restricted list.

---

## Session Start Protocol

Enforce this protocol once at session start, then continue normally without re-reading full instructions each step.

0. Run `/setrole <role>` first (one of `visual` / `data` / `data2` / `team` / `manage`).
1. Confirm role and assigned branch.
2. Run `git branch --show-current` and verify branch alignment.
3. Confirm worktree/directory alignment.
4. Confirm writable ownership for docs in this cycle.
5. For subordinate roles, before new implementation work, run sync check and rebase against latest `origin/dev-beta`.

During execution, keep only lightweight checks (branch + changed file scope).

---

## Operations Requiring Confirmation

Always pause and request review from `akaghef` before:

- **Deleting files** (`rm`, `git rm`, `unlink`, or equivalent)
- `git reset --hard`, `git rebase`, force-push (`git push --force`)
- Any operation directly on `main` branch
- Changing `package.json` dependencies (add/remove packages)

---

## Coding Standards

- Language: TypeScript for all new code in `beta/src/`
- All model changes go through the Command pattern (`MVC_and_Command.md`)
- `PersistedDocument` and `ViewState` must remain separated (`Model_State_And_Schema_V2.md`)
- Do not let ViewState bleed into SQLite saves
- Tests: add or update unit tests for any model-layer change
- Commit messages: imperative English, reference the spec doc if applicable

---

## Key Spec Documents

Before implementing, read the relevant spec:

| Topic | Document |
|-------|----------|
| Data model, node types | `docs/03_Spec/Data_Model.md` |
| Scope and alias rules | `docs/03_Spec/Scope_and_Alias.md` |
| Scope transition UI | `docs/03_Spec/Scope_Transition.md` |
| ViewState / schema v2 | `docs/03_Spec/Model_State_And_Schema_V2.md` |
| MVC and Command pattern | `docs/04_Architecture/MVC_and_Command.md` |
| Editing operations | `docs/04_Architecture/Editing_Design.md` |
| AI integration | `docs/03_Spec/AI_Integration.md` |
| Current tasks | `docs/00_Home/Current_Status.md` |

---

## Current Priority Tasks

### data (dev-data)

1. Implement `currentScopeId` and `scopeHistory` in ViewState
   - Spec: `docs/03_Spec/Scope_Transition.md`
   - Do not persist in SQLite; session-save only
2. Implement `EnterScopeCommand` and `ExitScopeCommand`
   - ViewState mutation only; not Undo/Redo targets
3. Add scope filtering to the model query layer
   - Nodes outside `currentScopeId` subtree must not be returned to the renderer

### visual (dev-visual)

1. Breadcrumb component (scope path display, clickable ancestors)
   - Spec: `docs/03_Spec/Scope_Transition.md` — Breadcrumb section
2. Differentiate folder node double-click (EnterScope) from text node double-click (EditText)
3. "← Back" button in toolbar (calls ExitScope)
4. Visual distinction for alias nodes (icon or style)

---

## Definition of Done

A task is complete only when ALL of the following are true:

1. Code compiles without errors (`npm run build`)
2. Unit tests pass (`npm run test:ci`)
3. Committed and pushed to the assigned branch
4. `docs/daily/YYMMDD.md` updated with what was done

## Documentation Ownership Split

- UpdateLog entries are appended to `docs/daily/YYMMDD.md`.
- `docs/00_Home/Current_Status.md` keeps current state only (no long history accumulation).
- Subordinate roles (`visual` / `data` / `data2` / `team`) treat `Current_Status.md` as read-only.
- Manager role (`manage`) updates `Current_Status.md` by referencing subordinate daily entries.
- Rough, unrefined tasks are pooled in `docs/06_Operations/Todo_Pool.md`.
- Manager role updates `Current_Status.md` status items.
- Subordinate role records completion details in daily notes.
