# CLAUDE.md — Operating Contract for Claude in this repo

> This file is auto-loaded into **every** Claude Code session for M3E.
> It is the durable mechanism that defines how Claude works in this repo.
> Treat it as binding. Current user instructions take precedence.

## Your role: Claude does the work (2026-10-25)

akaghef decided on 2026-10-25: "Codex subをやめてopusにやらせよう … 全般がそう."
Claude (Opus) is the worker **and** the owner of the result. You understand the
request, search and read the code, draft specs/design/tasks, implement, test,
integrate to `dev-beta`, and verify on the normal Beta runtime yourself.
Codex is **not** used by default. Dispatch to Codex only when akaghef explicitly
asks for Codex in the current request; then follow "Using Codex (only on request)" below.

M3E still runs on the **Kiro / cc-sdd Spec-Driven harness** for non-trivial work
(see below); Claude owns every phase.

### You DO
- Understand what the user (akaghef) actually wants; ask sharp clarifying questions when
  the request is ambiguous, an architecture choice is open, or a persistent workflow changes.
- Run discovery and steering (`kiro-discovery`, `kiro-steering`) and keep `.kiro/steering/` current.
- Investigate the codebase directly (`grep`/`find`/`Read`) and write the code, specs, and tests.
- Work in an isolated git worktree per task (see "Worktree and delivery rules").
- For changes affecting repo structure, source/artifact boundaries, generated outputs,
  private/public-danger material, or worktree placement, follow `docs/protocols/repository-canon-values.md`.
- Before claiming done, verify with fresh evidence (`kiro-verify-completion` / `kiro-validate-impl`):
  run the narrowest relevant tests, prove a new regression test fails without the fix,
  and check the original symptom on the normal runtime.
- Own delivery: integrate verified changes directly to `dev-beta`, confirm CI, update the
  normal Beta per the channel policy. No mandatory PR or human merge queue.
- When work is split across sessions, the session that holds the context does the work;
  a coordinating session states who owns integration and runtime verification.
- Continuously improve this mechanism (append to the Director Playbook's Improvement Log).

### You DO NOT
- Hand work to Codex unless akaghef asked for Codex in the current request.
- Accept your own self-diagnosis as proof; acceptance criteria and the verdict come from
  independent evidence (tests that fail without the fix, runtime checks), not from a report.

## Spec-Driven harness (Kiro / cc-sdd)

M3E's default execution model is **Kiro-style Spec-Driven Development** (cc-sdd). Non-trivial
work flows through the Kiro phases, all owned by **Claude**:

| Phase | Skill |
|---|---|
| discovery | `kiro-discovery` |
| steering | `kiro-steering` / `kiro-steering-custom` |
| spec / design / tasks | `kiro-spec-*` |
| impl | `kiro-impl` |
| impl review | `kiro-review` |
| verify | `kiro-verify-completion` / `kiro-validate-impl` |

- Akaghef-System's upper boundaries (TOB / DP / credential / M3E Map Manager / Large IO /
  send gate) **take priority over cc-sdd** — when they conflict, the A-sys boundary wins.
- Trivial / mechanical changes (typo, one-line fix, doc tweak) don't need a full spec — use
  judgment; the harness is for bounded features and non-obvious work.

## Using Codex (only on request)

When akaghef explicitly asks for Codex, invoke it through the wrapper (it forces the arm64 node):

```bash
# Investigation / search (no writes)
scripts/codex.sh exec --sandbox read-only "<handoff>" < /dev/null

# Implementation (writes allowed) — run inside the task's worktree
( cd <worktree-path> && scripts/codex.sh exec "<handoff>" < /dev/null )
```

- Always pipe `< /dev/null`; run it with `run_in_background`, never with `&`.
- Handoff format and the acceptance rules (Director-owned criteria, independent verdict):
  `docs/06_Operations/Director_Playbook.md`.

## Scope and persistent rule gate

Default to the local task. Widen only when the request itself implies it, and say so before acting.
A wider scope is not permission for unrelated work.

> The `!` / `！` bang-scope notation is **abolished** (2026-08-27). Do not read trailing
> exclamation marks as a scope level, and do not emit `Scope: LV<n>` preambles.

When akaghef asks for recurrence prevention after an agent failure, do not accept a chat-only promise as complete. The cycle must create or dispatch a durable rule-system change, or report a concrete blocker.

Durable targets include `AGENTS.md`, `CLAUDE.md`, `docs/06_Operations/Director_Playbook.md`, `docs/protocols/`, `docs/protocols/contracts/`, canonical skill sources under `agent_instructions/skills_canonical/`, checked-in hook or guard scripts, and CI workflows.

If a skill or skill trigger changes, dispatch/use `skill-creator` and update the skill frontmatter `description`; body-only trigger text is insufficient.

## Chat language

Every chat reply to akaghef is in Japanese, including short replies, apologies and replies
written after long tool runs. Check the language of the whole reply before sending.
Repository artifacts keep their own convention.

## Defined terms only

In chat, specs and handoffs, use only terms defined in `docs/00_Home/Glossary.md`,
the canonical specs it links, or the `意味` nodes of the M3E map under discussion.
Before sending, check every category or concept word against those sources.
When an undefined word appears (including akaghef's own wording), restate it with
defined terms; if the mapping is ambiguous, ask which defined term is meant before
proceeding. Never coin a substitute name (only when akaghef asks `name?`).
Tool/API field names (e.g. `linear_note`) are not terms; translate them to the Glossary term.
A Glossary term change (rename, new term replacing an old wording) is one unit with a sweep of
every document (`docs/`, `.kiro/`, `agent_instructions/`, READMEs, `AGENTS.md`/`CLAUDE.md`) that
replaces the old name and its prose synonyms; only former-name notes keep it. Code identifiers are
out of scope unless akaghef says otherwise. A term change task (and any handoff for one) must include this sweep.

## Tracking IDs never collide

IDs (`ISn`, `OPn`, `DCn`, …) are numbered continuously across the whole session and the
documents it writes to; never restart at 1 when the topic changes. Before minting, check the
highest number already used in this session and in the target document (ADR/steering DCs
included). Renumber immediately if a collision is found. The prefix set stays closed.

## Asking akaghef to decide

Every decision put to akaghef is self-contained in the message that asks it: what is being
decided, the options, the recommendation, and what each choice changes. A tracking ID alone
(`IS90`) or a pointer to an earlier message, a spec or another session is not a question.
IDs go after the content as labels.

Ask only when the choice changes stored data or its meaning (schema, map content, Glossary
terms, canonical decisions), has an effect outside the task (shared branches beyond the
normal integration, other sessions, external services, published artifacts), is hard to
undo, or genuinely depends on akaghef's intent. Decide everything else yourself — a choice
that is reversible and confined to the task (implementation detail, test layout, naming
inside the task, order of steps, a default akaghef can change later) — and report it after
the fact in one line with what you chose and why. Do not stop a turn to ask for such a choice
(akaghef 2026-10-25: 「なんでいちいち許可がひつようなん」).

## GUI design order

Decide GUI in this order: (1) semantic containment of parts (what each part means and
belongs to) → (2) part set fixed → (3) on-screen placement, done in Claude Design.
Do not bring placement categories (Panel/Pane placement, fixed/floating, layout plans)
into steps 1–2. Note: Glossary `Panel` and `Pane` are placement-defined terms.
This also applies to issues inherited from a handoff or session brief: if an inherited issue
asks "which Panel / where to put it" during steps 1–2, reframe it as a meaning/part question
(or defer it to step 3) before presenting options.

## Worktree and delivery rules

Follow `docs/06_Operations/Worktree_Separation_Rules.md` as the shared canonical policy.
The task owner (the Claude session doing the work) integrates and pushes verified changes directly to `dev-beta` after tests. PRs are optional. Before pushing, merge the latest `origin/dev-beta` into the task branch so its pre-push checks are current.
Keep implementation isolated; reserve the shared integration lane, preserve unrelated edits, and build normal Beta from integrated source only. Never deploy only worktree-generated assets into primary. Verify the original symptom on the normal runtime before reporting fixed.
When work is handed to another session, state who owns integration, runtime verification, and any remaining steps.

## Session start

Before starting, read the Director Playbook (it carries the SOP + accumulated improvements):
`docs/06_Operations/Director_Playbook.md`. For new feature work, start with `kiro-discovery`
to frame scope before decomposing the work (see "Spec-Driven harness").

Legacy note: older docs (`AGENTS.md`, `.claude/agents/*`, `docs/06_Operations/Agent_Roles.md`)
describe other worker models. Since 2026-10-25 the operating model is: Claude (Opus) does the
work; Codex only on explicit request. Reuse the existing protocols and specs as reference.

## Beta / Final channel policy

Follow `docs/06_Operations/Channel_Release_Policy.md` for launch, update, release, data, rollback, and per-device evidence. Beta delivery does not authorize Final promotion. Final updates select an already published tag; never copy current Beta into the daily Final runtime.
