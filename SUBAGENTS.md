# Sub Agents — Orchestrator Guide

This file is for the **orchestrator**: the AI agent that received a task from akaghef and runs one or more sub agents for parts of it. Root `AGENTS.md` stays the binding contract. This file adds the rules for running sub agents. Where the two disagree, `AGENTS.md` wins and this file is fixed.

A **sub agent** is a helper AI agent the orchestrator runs for a bounded part of its own task: an investigation, a second implementation or diagnosis pass, or a review. A separate session the user can open and steer is not a sub agent. Neither is a Codex worker that akaghef names; that is covered by the external Codex worker rule under "Integration, Worktrees, and beta_update" in `AGENTS.md`.

## 1. When to use one

- `AGENTS.md` still decides whether a sub agent may be used: the orchestrator does the work itself unless akaghef asks for delegation or orchestration in the current request. This file does not widen that.
- When sub agents are allowed, give one a piece only if all of these hold:
  - it is independent: it needs no other piece's result and touches no file another writer touches;
  - it can be checked from outside;
  - it is larger than the cost of writing its brief and checking its result.
- Do work that is a handful of tool calls yourself.
- Run at most three sub agents at once unless akaghef asks for more.

## 2. Runtime: Grok Build, fast, effort high

Every sub agent runs on Grok Build with model `grok-4.7-build-fast` and reasoning effort `high` (akaghef, 2026-11-18). Use the one entry point, which fixes the model and effort:

```bash
scripts/ops/grok-sub.sh run --prompt-file <brief>                                   # read-only: investigation, review
scripts/ops/grok-sub.sh run --write --cwd <task worktree> --prompt-file <brief>     # implementation
scripts/ops/grok-sub.sh run --background ...                                        # long work; then runs / show <run-id>
```

- Do not use built-in Claude subagents (Explore, general-purpose, and so on) as a sub agent.
- Do not use the `grok-build:grok-delegate` agent either: it runs a Sonnet wrapper, leaves the model unset, and writes in the session's own directory.
- Only a runtime akaghef names in the current request replaces Grok.
- If Grok cannot be invoked (`grok-sub.sh` or the bridge fails, or the account is logged out), report the exact failure. Do the piece yourself; do not switch to another model unasked.

## 3. What the orchestrator keeps

The orchestrator keeps everything below. A sub agent never does these:

- the acceptance criteria and the pass/fail verdict;
- merging into `dev-beta`, pushing, `watch-ci.sh`, and building or restarting the normal Beta runtime;
- questions to akaghef and decisions that `AGENTS.md` ("Asking akaghef to Decide") reserves for akaghef;
- writes to any M3E map through MCP, unless the brief names the map, the scope and the operation;
- the final report to akaghef.

A sub agent never touches any of these:

- the personal workspace (`~/Library/Application Support/M3E`);
- port 4173;
- the main checkout;
- another task's worktree;
- secrets.

Its tests run with `M3E_FORBID_LIVE_DATA=1` and temporary directories.

## 4. Isolation

- **Investigation and review** run read-only, with no `--write`. They may share the checkout.
- **Implementation** runs with `--write` in its own worktree:
  - create the worktree with `scripts/ops/worktree.sh new <task>-<piece>`, on branch `codex/<task>-<piece>`, from the orchestrator's branch;
  - `grok-sub.sh` refuses a `--write` run whose `--cwd` is not under `M3E-worktrees`;
  - the sub agent commits on its branch and never pushes;
  - the orchestrator reviews the branch and merges it into its own task branch.
- Two writers never touch the same files. If pieces turn out to overlap, stop one and finish it yourself.

## 5. Brief

Write the brief to a file and pass it with `--prompt-file`. Grok knows nothing of the conversation, so the brief carries everything it needs:

```
OBJECTIVE: <one sentence — what done looks like>
CONTEXT: <files, specs and Glossary terms it needs; point, don't paste>
ALREADY RULED OUT: <what the orchestrator checked, so it is not redone>
SCOPE: <files/dirs it may touch; anything else = stop and report>
FORBIDDEN: <the §3 list that applies, plus task-specific ones>
ACCEPTANCE: <checks the orchestrator will run; the sub agent runs them too>
OUTPUT: <report shape and length cap: findings with file:line, commands run with results, commit SHAs>
```

- Use only defined terms (`docs/00_Home/Glossary.md`).
- Do not put your own hypothesis in as the answer. Give it as one hypothesis to test, or the sub agent tends to return it confirmed.
- For a second-opinion review, give the code and the requirement, not your conclusion.

## 6. Accepting the result

A sub agent's report is a claim, not evidence. Before using it:

1. Read the diff, or the cited `file:line`, yourself.
2. Rerun the acceptance checks yourself. For a fix, a regression test must fail without the fix.
3. Reject scope creep, edits outside SCOPE, or changed tests and thresholds. Send the work back once with a corrected brief, or do the work yourself.
4. Never change acceptance criteria after a failure to make a sub agent's work pass (`AGENTS.md`, "Do not game the goal").

## 7. Failure and stalls

- A failed or stalled run: read its output (`grok-sub.sh show <run-id>`) before deciding anything.
  - If the cause is the brief, fix the brief and retry once.
  - Otherwise do the piece yourself.
- Never type into a sub agent's terminal, and never write your own polling loop. A background run is checked with `runs` and `show` when you need its result.
- When the real system cannot do something, that gap is the finding: report it, do not route around it.

## 8. Reporting to akaghef

- Report what was delivered and the evidence you checked yourself.
- Say which parts a sub agent did only when it matters for trust in the result, for example "drafted by a sub agent, rerun and checked by me".
- Do not show run IDs, session IDs or hashes in place of names (global rule "GUI shows no IDs").
- Unverified pieces stay marked unverified.
