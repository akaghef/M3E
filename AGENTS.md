# M3E Agent Execution Guide

## Objective

This repository is operated with agent-driven implementation cycles.
Agents should prioritize small validated changes over broad refactors.

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
   - `dev-docs/00_Home/Home.md`
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

## Agent Team

3体のエージェントを Agent Teams で並列実行する。
各エージェントは `.claude/agents/` に定義。Manager (manage) がチームリーダー。

### Agent Definitions

| Agent | File | Branch | Scope |
|-------|------|--------|-------|
| visual | `.claude/agents/visual.md` | dev-visual | UI, rendering, CSS, SVG |
| data | `.claude/agents/data.md` | dev-data | model, controller, API |
| team | `.claude/agents/team.md` | dev-team | collab, cloud sync |

### How to Launch

```
1. TeamCreate(team_name: "m3e-dev", description: "M3E development team")
2. TaskCreate で作業タスクを登録
3. Agent(team_name: "m3e-dev", name: "visual", subagent_type: "visual")
   Agent(team_name: "m3e-dev", name: "data",   subagent_type: "data")
   Agent(team_name: "m3e-dev", name: "team",   subagent_type: "team")
```

各エージェントは `isolation: worktree` で独立したコピーで作業する。
タスクは共有タスクリスト (`~/.claude/tasks/m3e-dev/`) で管理。
メンバーは `SendMessage` で互いに通信可能。

### Team Communication

| 方法 | 用途 |
|------|------|
| `SendMessage(to: "visual")` | 特定メンバーへ指示・質問 |
| `SendMessage(to: "*")` | 全員へブロードキャスト（コスト高、慎重に） |
| `TaskCreate` / `TaskUpdate` | タスクの作成・状態更新・アサイン |
| `TaskList` | 全タスクの状態確認 |

### Shared State (Mindmap)

揮発的な情報は M3E マップの `dev M3E/` 配下で共有する:

```
dev M3E/
├── tasks/          ← タスク状態 (doing/ready/done-today)
├── strategy/       ← ロール割り当て
├── design/         ← 設計判断 (ADR) — 判断が必要な場面でメンバーが書く
└── scratch/        ← 一時メモ
```

エージェントは REST API (`http://localhost:38482/api/docs/rapid-main`) 経由で読み書きする。
設計判断が必要な場合:
1. エージェントが `dev M3E/design/` に context + options を書く
2. `SendMessage` で manager に通知
3. Manager がマインドマップ上で verdict を書く
4. エージェントに続行を指示

### Integration Flow

```
1. Manager が TeamCreate → TaskCreate でタスク登録
2. Agent が共有タスクリストから claim → worktree で作業
3. Agent が dev-{role} ブランチにコミット・プッシュ → PR 作成
4. Agent が SendMessage で manager に完了通知
5. Manager が PR レビュー・マージ
6. Agent が次タスクを claim → rebase → 作業再開
```

### Shutdown

作業完了時:
```
SendMessage(to: "*", message: { type: "shutdown_request" })
TeamDelete()
```

## Session Start Gate (One-Time Enforcement)

At session start, run one bootstrap command, then proceed with normal work.
Do not repeatedly re-run full checks every step.

For agents that support slash prompts:

- `/setrole visual`
- `/setrole data`
- `/setrole team`
- `/setrole manage`

For normal Codex (non-Copilot):

```powershell
pwsh -File scripts/ops/setrole.ps1 visual
# or data / team / manage
```

Required checks performed by bootstrap:

1. Role confirmation.
2. Worktree/directory alignment.
3. Branch alignment.
4. For subordinates: `fetch + rebase origin/dev-beta` before new implementation work.

If checks fail or rebase is not possible, stop and escalate to `akaghef`.

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

1. Subordinate agents (visual, data, team) implement and push only to assigned branches (`dev-visual`, `dev-data`, `dev-team`).
2. Subordinates create a PR with base `dev-beta` from their assigned branch.
3. Manager reviews and merges the PR into `dev-beta`.
4. Before a subordinate starts the next task cycle, they MUST sync latest `dev-beta` by rebasing.
5. Subordinates must not resume implementation on stale history.

Recommended command sequence for subordinates:

```bash
git fetch origin
git checkout dev-visual   # or dev-data / dev-team
git rebase origin/dev-beta
```

If rebase fails or produces unexpected state, stop and escalate to `akaghef`.

## Development Phase Constraints

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
3. **P3 — Rapid baseline completeness**: metadata rendering, startup packaging.
4. **P2 — Dev infrastructure**: Stage A CI, hit-test coverage.
5. **P1 — Deferred**: reparent feedback UI, delete confirmation dialog.

## Handoff Format

When an agent finishes a cycle, report:

1. What changed (files and behavior).
2. What was verified.
3. What remains next (one concrete task).
