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

The canonical workflow is [Worktree Separation Rules](docs/06_Operations/Worktree_Separation_Rules.md). Parallel work stays isolated. Do not start extra agents unless authorized.

The AI agent that receives a task does the work itself and owns the result: it understands the request, reads the code, writes specs and code, tests, integrates into `dev-beta` and verifies on the normal Beta runtime (akaghef, 2026-10-25). It hands work to another AI agent only when akaghef asks for that in the current request; the handoff format and acceptance rules are in the [Director Playbook](docs/06_Operations/Director_Playbook.md), which every session reads before starting. An agent that runs sub agents for parts of its task follows [SUBAGENTS.md](SUBAGENTS.md). An existing session works directly without launching a replacement worker.

Acceptance criteria and the verdict come from independent evidence (a regression test that fails without the fix, a check on the normal runtime), not from a report, including the agent's own.

## Instruction Files

This file is the single instruction source for every AI agent in this repository. `CLAUDE.md` contains only the line `@AGENTS.md`; it holds no rules of its own, and `scripts/ops/check-persistent-rule-gate.sh` rejects anything else in it. Put a new rule here, written runtime-neutrally, or in the document this file routes to.

Reference IDs follow the global rule: `<domain><series><number>` with the domain letter chosen by content (a decision is `DA1`, an issue `IA1`, a question `QA1`), valid inside the conversation that minted them. Working documents written in that conversation may carry them; material made for other people does not. No consistency across conversations or documents is required: do not scan the repository for a maximum, and do not extend the continuous tracking series (the two-letter prefixes followed by a running number) that older documents carry. Leave those older numbers where they are.

## Spec-Driven Harness

Non-trivial work follows Kiro-style Spec-Driven Development: discovery, steering, requirements / design / tasks, implementation, review, verification (`kiro-*` skills; specs under `.kiro/specs/`, steering under `.kiro/steering/`). New feature work starts with discovery to frame scope. Trivial or mechanical changes (a typo, a one-line fix, a doc tweak) need no spec. Akaghef-System's upper boundaries (TOB / DP / credential / M3E Map Manager / Large IO / send gate) take priority when they conflict with the harness.

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
| `scripts/final/update-and-launch.bat --release <tag>` | Install a selected published Final tag (update-and-launch --release) |

## Source of Truth

1. Strategy and current direction:
   - `docs/00_Home/Home.md`
2. Current priorities and progress:
   - `docs/00_Home/Current_Status.md`
3. Operating procedure:
   - this file
   - `docs/06_Operations/Director_Playbook.md`
4. Operations rules:
   - `docs/06_Operations/Documentation_Rules.md`
   - `docs/06_Operations/Worktree_Separation_Rules.md`
5. Repository canon values:
   - `docs/protocols/repository-canon-values.md`

## AI Instruction Routing

For M3E / Akaghef-System work, do not duplicate detailed rules in this file.

- Product meaning of map / node / scope / edge / parent edge / relation edge / alias / path / layout lives under `docs/03_Spec/`.
- Repository-level canon, source/artifact allocation, generated-output policy, worktree placement, and private/public-danger material routing live in `docs/protocols/repository-canon-values.md`.
- Agent operating behavior lives under `docs/protocols/`.
- Procedure detail (handoff template, review checklist, accumulated lessons) lives in `docs/06_Operations/Director_Playbook.md`.
- Map read/write execution uses the six MCP tools under `docs/protocols/mcp-map-operations.md`: `m3e_context`, `m3e_get`, `m3e_create`, `m3e_update`, `m3e_delete`, and `m3e_feedback`. No local map skill is required.
- Open structural map decisions use `docs/protocols/map-manager/` (with `docs/protocols/map-manager.md` as a compatibility pointer), exposed through MCP Resources / Prompts. The `map-manager` skill is an optional repository-local entry point for those decisions.
- Codex workers must follow `docs/protocols/worker-minimal-instruction.md` and must not redefine scope, layout, alias, storage, or cross-facet link policy.

Consult Map Manager guidance when a map task leaves scope purpose, layouting, path resolution, parent edge / relation edge / alias choice, or worker ownership undecided. A fully specified operation uses MCP directly, including an explicitly specified scopen / unscopen or cross-scope move. A guidance reference does not require a separate agent or skill invocation.

## Scope and Persistent Rule Gate

Default to the local task. Widen only when the request itself implies it, and say so before acting.
A wider scope is not permission for unrelated work.

> The `!` / `！` bang-scope notation is **abolished** (2026-08-27). Do not read trailing
> exclamation marks as a scope level, and do not emit `Scope: LV<n>` preambles.

### Persistent Rule Change Gate

When the user asks for recurrence prevention after an agent failure, the task is not complete until the agent has either made a durable rule-system change or explicitly reported why that is blocked.

Durable rule-system changes include one or more of:

- root `AGENTS.md` (never `CLAUDE.md`, which only imports this file)
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
or attribute update). Those operators follow `docs/protocols/mcp-map-operations.md`:
resolve the target, enter the MCP context, perform only the requested operation,
and verify its authoritative result. Reuse retained context and change results;
do not require a successful write to be followed by another GET. Retrieve state
when context is missing or invalidated. Do not load internal goals or route through
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
- Pushes to `dev-beta` pass `.githooks/pre-push`, which runs `scripts/ops/preflight.sh --commit <sha>` (the same checks as CI) on the pushed commit. Enable it once per checkout with `scripts/ops/install-git-hooks.sh`; never bypass it with `--no-verify`. Delivery is complete only after `scripts/ops/watch-ci.sh <integrated SHA>` succeeds; do not stack further pushes on red CI.
- Serialize integration/build/restart using the channel policy local lock; ORRERY reservations apply only while explicitly activated. Preserve unrelated dirty work.
- Build normal Beta only from integrated source. Never copy unmerged worktree bundles into the normal runtime.
- `beta_update` and update-complete require applicable runtime readback / original-symptom verification after delivery, not merely commit, push, or PR creation.
- Documentation-only changes need canonical/mirror/guard verification; a product restart is not required.
- Optional PRs remain available for explicit review requests. A review-only request does not authorize merge.
- Destructive history changes, main/release operations, and secret changes still require explicit authorization.
- When akaghef asks for an external Codex worker, use `scripts/codex.sh exec -m gpt-6-astra -c model_reasoning_effort=high ... < /dev/null` (read-only sandbox for investigation; `workspace-write` inside the task worktree for implementation), run it in the background, and do not redispatch the already active Codex session merely to satisfy this convention.
- A sub agent (a helper AI agent a session runs for part of its own task) runs on Grok Build, `grok-4.7-build-fast` at effort `high`, through `scripts/ops/grok-sub.sh` (akaghef, 2026-11-18). An orchestrator follows [SUBAGENTS.md](SUBAGENTS.md) for runtime, isolation, briefs and acceptance. It does not widen when a sub agent may be used.

## Development Phase Constraints

### Beta (`beta/`) — Active

1. Infrastructure and test environment are top priority.
2. AI proposal features are deferred.
3. Data-safe operations are top priority.
4. Prefer stable, operable UI over architecture expansion.

### Final (`final/`) — Stable

1. Only receives a selected, verified release; promotion requires explicit authorization.
2. No direct development in `final/`.
3. All data migrations must be scripted and reversible.

## Language Policy

1. Every chat reply to akaghef is in Japanese, including short replies, apologies and replies written after long tool runs.
2. Design and development documents under `docs/` should be written in Japanese by default.
3. Code identifiers, file names, API names, and technical tokens may remain in English where appropriate.
4. If a document is a design/spec/architecture/ADR document, prefer Japanese prose even when the surrounding conversation is in English.

## Defined Terms Only

In chat, specs and handoffs, use only terms defined in `docs/00_Home/Glossary.md`, the canonical specs it links, or the `意味` nodes of the M3E map under discussion. When an undefined word appears (including akaghef's own wording), restate it with defined terms; if the mapping is ambiguous, ask which defined term is meant. Do not coin a substitute name unless akaghef asks `name?`. Tool and API field names are not terms; translate them to the Glossary term.

A Glossary term change (a rename, or a new term replacing an old wording) is one unit with a sweep that replaces the old name and its prose synonyms everywhere agents read meaning from: every repository document (`docs/`, `.kiro/`, `agent_instructions/`, READMEs, this file), agent instructions and skills outside the repository, and agent memory. Code identifiers are out of scope unless akaghef says otherwise.

The swept text states only the current terms, as if they had always been the terms. It carries no change history: no former-name notes, no "renamed from", no "previously", no rename dates, and no warning not to use the old name. The history lives in git commit messages only. A worker's output that adds any of these is rejected.

A term change to a basic term (node, edge, scope and the like) is a large decision; do not start editing when a name is picked. First settle with akaghef the whole term set (including the names derived from it) and the range (documents, agent instructions and memory, records, MCP, code, stored data). Then classify every occurrence by meaning, because a term change can change the meaning of text it does not touch. A scripted replacement may only be a draft and is never the delivery. The classification and the rewrite go to an external Codex worker on `gpt-6.1-sol` at effort `high`, which edits the files itself in one pass and rewords nothing beyond the term occurrences and the sentences whose meaning they change; the session reviews the resulting diff and reverts every hunk that does not touch the terms.

## Asking akaghef to Decide

A decision put to akaghef is self-contained in the message that asks it: what is being decided, the options, the recommendation, and what each choice changes. An identifier alone, or a pointer to an earlier message, a spec or another session, is not a question.

Ask only when the choice changes stored data or its meaning (schema, map content, Glossary terms, canonical decisions), has an effect outside the task (shared branches beyond the normal integration, other sessions, external services, published artifacts), is hard to undo, or genuinely depends on akaghef's intent. Decide everything else yourself — a reversible choice confined to the task — and report it afterwards in one line with what you chose and why.

## GUI Design Order

Decide GUI in this order: (1) semantic containment of parts (what each part means and belongs to), (2) the part set, (3) on-screen placement, done in Claude Design. Do not bring placement categories (Panel / Pane placement, fixed / floating, layout plans) into steps 1–2; Glossary `Panel` and `Pane` are placement-defined terms. An inherited issue that asks where to put something during steps 1–2 is reframed as a meaning / part question or deferred to step 3.

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

## Agent node icon imports

Before adding or replacing Agent node icon assets, frame definitions, or playback logic, follow [the icon import protocol](docs/protocols/agent-node-icon-import.md). Run `npm --prefix beta run check:agent-icons`; image dimensions alone never certify frame layout.

## Beta / Final channel policy

Follow `docs/06_Operations/Channel_Release_Policy.md` for launch, update, release, data, rollback, and per-device evidence. Beta delivery does not authorize Final promotion. Final updates select an already published tag; never copy current Beta into the daily Final runtime.
