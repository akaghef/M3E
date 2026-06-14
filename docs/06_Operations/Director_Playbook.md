# Director Playbook

The operating manual for Claude-as-Director driving Codex workers on M3E.
`CLAUDE.md` (repo root) is the binding contract; this file is the **how-to** and the
**memory of what works**. Keep it current — improvements compound here.

---

## 1. The loop

```
intent → clarify → decompose → handoff → dispatch (codex) → review → integrate / iterate → record
```

1. **Intent** — restate what akaghef wants in one sentence. If ambiguous, ask before dispatching.
2. **Decompose** — split into bounded tasks. Each task = one Codex dispatch with a single objective.
3. **Handoff** — write the packet (template below).
4. **Dispatch** — `scripts/codex.sh exec` (read-only for investigation, write in a worktree for implementation).
5. **Review** — judge Codex output against intent + acceptance criteria. Do not rubber-stamp; verify claims.
6. **Integrate / iterate** — PR to `dev-beta`, or send Codex a follow-up (`resume --last`).
7. **Record** — if you learned something reusable, append to the Improvement Log (§5).

## 2. Codex handoff template

Pass this as the prompt to `codex.sh exec`:

```
OBJECTIVE: <one sentence — what done looks like>
CONTEXT: <only what Codex needs; point to files/specs, don't paste everything>
SCOPE: <files/dirs Codex may touch. Out-of-scope = escalate, don't guess>
CONSTRAINTS: <conventions, things not to break, tests to keep green>
ACCEPTANCE: <checkable criteria — tests pass, behavior X, report Y>
OUTPUT: <what to report back, and how concise>
```

Rules:
- Investigation tasks → `--sandbox read-only`. Ask for a bounded report (line cap).
- Implementation tasks → run inside the task worktree; tell Codex to commit on `codex/<task>`.
- Keep CONTEXT tight; Codex can read the repo itself.

## 3. Worktree lifecycle

```bash
scripts/ops/worktree.sh new <task>     # create /…/M3E-<task> on branch codex/<task>
scripts/ops/worktree.sh list           # show worktrees + status
scripts/ops/worktree.sh clean          # prune stale/prunable entries
scripts/ops/worktree.sh rm <task>      # remove after PR merged (guards uncommitted work)
```

- One worktree per active Codex implementation task.
- Branch from `dev-beta` unless the task says otherwise.
- After the PR merges into `dev-beta`, remove the worktree to keep the tree clean.
- Never discard uncommitted work to remove a worktree — escalate to akaghef.

## 4. Review checklist

- Does the diff match the OBJECTIVE and stay within SCOPE?
- Did Codex actually run the tests it claims passed? (Have it paste the command + result.)
- Any scope creep, dead code, or broken conventions? Send back if so.
- Is `dev-beta` still the integration target and the PR base correct?

## 5. Improvement Log (append-only — newest last)

Each entry: `YYYY-MM-DD — what changed / what we learned / why`. This is how the
mechanism gets better across sessions. Future Directors: add here, don't rewrite history.

- 2026-06-14 — Mechanism created. Director→Codex model established; `CLAUDE.md` made the
  always-loaded contract. Worker switched from Claude-subagents (legacy) to Codex.
  Codex invocation requires `scripts/codex.sh` (arm64 node PATH fix) + `< /dev/null` (stdin).
- 2026-06-15 — Integrated diverged origin/dev-beta and pushed (commit 314734f). Three lessons:
  (1) **Phantom regression.** 10 beta API tests "failed" in the primary checkout but passed
  16/16 in a fresh worktree of the *same* HEAD — the primary checkout's accumulated local
  state (hung server holding the API port → multi-minute test timeouts) was the cause, not
  the code. Rule: before concluding a test regression, reproduce in a clean worktree
  (`git worktree add /tmp/check HEAD`, symlink node_modules, `npm run build:node`, run gate).
  (2) **arm64 node applies to npx/vitest too**, not just codex — a bare `npx vitest` picks the
  Rosetta x64 node v14 and dies on `??=` syntax. Prefix `export PATH="/opt/homebrew/bin:$PATH"`.
  (3) **GitHub 100MB blob limit + gitignore.** `install/mac/payload/` (bundled 136MB node
  binary) was committed before its ignore rule, so it stayed tracked and lived in history.
  Untracking (`git rm --cached`) + .gitignore only stops *future* tracking; the blob still
  blocks the push from history. Fix without disturbing the remote: rewrite ONLY the unpushed
  range — `git filter-branch -f --index-filter 'git rm -r --cached --ignore-unmatch <paths>'
  --prune-empty -- origin/dev-beta..HEAD`. Keeping origin/dev-beta as the base preserves the
  fast-forward. Verify with `git merge-base --is-ancestor origin/dev-beta HEAD` before pushing.
