# M3E Agent Execution Guide

## 高優先度のサブプロジェクト入口

2026-09-17 のユーザー指定: **PJ08 — M3E × OT 合併吸収を高優先度で扱う。**
Orrery Telemetry と M3E の統合、PJ08 の着手・再開については、まず
[再開ガイド](projects/PJ08_M3E_OT_Fusion/resume-cheatsheet.md)、
[概要](projects/PJ08_M3E_OT_Fusion/README.md)、
[計画](projects/PJ08_M3E_OT_Fusion/plan.md) を読む。
対象はこのリポジトリの `projects/PJ08_M3E_OT_Fusion/`。
保存済み Codex プロジェクト名、neoM3E、runtime map から対象を推測し直さない。
別のサブプロジェクトを探す場合も、まず `projects/` と
[サブプロジェクト一覧](backlog/meta-subpj-candidates.md) を確認する。
この優先指定は、既存の必須コンテキスト確認・設計・Phase 移行条件を変更しない。


## Objective

This repository uses isolated work and direct, verified delivery to dev-beta.
Prefer small validated changes over broad refactors.

## Operating Model

The assigned AI owns delivery of the authorized task through verification, direct integration into `dev-beta`, push, and applicable normal-Beta verification. Pull Requests and a separate Director's merge are not required.

The canonical workflow is [Worktree Separation Rules](docs/06_Operations/Worktree_Separation_Rules.md). Claude may coordinate Codex workers using `CLAUDE.md` and the Director Playbook; an existing Codex session works directly without launching a replacement worker. Parallel work stays isolated. Do not start extra agents unless authorized.

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

## Scope and Persistent Rule Gate

Default to the local task. Widen only when the request itself implies it, and say so before acting.
A wider scope is not permission for unrelated work.

> The `!` / `！` bang-scope notation is **abolished** (2026-08-27). Do not read trailing
> exclamation marks as a scope level, and do not emit `Scope: LV<n>` preambles.

### Persistent Rule Change Gate

When the user asks for recurrence prevention after an agent failure, the task is not complete until the agent has either made a durable rule-system change or explicitly reported why that is blocked.

Durable rule-system changes include one or more of:

- root `AGENTS.md`
- `docs/protocols/` or `docs/protocols/contracts/`
- canonical skill sources under `agent_instructions/skills_canonical/`
- checked-in hook or guard scripts under `scripts/hooks/` or `scripts/ops/`
- CI workflows that verify agent instruction consistency
- project docs only when they are the canonical location for the changed behavior

If creating or updating a skill, a skill trigger, or skill routing behavior, use the `skill-creator` skill in the same turn. Skill trigger changes must update the skill frontmatter `description`, because that is the trigger surface.

The final report for an persistent-rule task must list:

1. durable files changed,
2. checks run,
3. whether skill mirrors were synced,
4. any remaining non-durable or uncommitted state.

Do not describe recurrence prevention as done if it exists only as a chat promise.

## Mandatory Session Context

This gate applies only to **M3E internal work**: product code, product/spec/
operations documentation, roadmap or priority assessment, architecture, or
unbounded structural design.

It does **not** apply to an explicitly-targeted, direct M3E runtime operation
(for example, a supplied map/scope URL with an unambiguous copy, read, rename,
or attribute update). Those operators follow the direct-operator route in the
`m3e-map` skill: resolve the target, read the relevant state, perform only the
requested operation, and verify it. Do not load internal goals or route through
Map Manager unless the requested operation requires a structural decision not
already specified by the user.

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

## Integration, Worktrees, and beta_update

Follow [Worktree Separation Rules](docs/06_Operations/Worktree_Separation_Rules.md), the canonical policy for all agents.

- Use isolated `codex/<task>` worktrees for implementation and conflicting writes.
- The task owner reviews, tests, commits, integrates into `dev-beta`, and pushes directly. No mandatory PR or human merge queue.
- Serialize integration/build/restart with the shared `M3E/dev-beta-integration` reservation. Preserve unrelated dirty work.
- Build normal Beta only from integrated source. Never copy unmerged worktree bundles into the normal runtime.
- `beta_update` and update-complete require applicable runtime readback / original-symptom verification after delivery, not merely commit, push, or PR creation.
- Documentation-only changes need canonical/mirror/guard verification; a product restart is not required.
- Optional PRs remain available for explicit review requests. A review-only request does not authorize merge.
- Destructive history changes, main/release operations, and secret changes still require explicit authorization.
- When dispatching an external Codex worker, use `scripts/codex.sh exec ... < /dev/null`. Do not redispatch the already active Codex session merely to satisfy this convention.

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

## C8: Browser Verification Evidence

Do not report Playwright, browser, screenshot, or GUI results as measurements unless this worker executed and observed them in the current turn. When the sandbox cannot run Playwright, write exactly `未実行（Director 依頼）` in the Playwright result field and list the specific spec(s) for the Director. Existing logs, source inspection, and another operator's report may explain a diagnosis, but are not this worker's measurement.
