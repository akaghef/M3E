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

## 4.5 Bang / persistent-rule review gate

When akaghef's latest instruction contains `!!!` / `！！！`, or asks for recurrence prevention after an agent failure, the Director must treat the cycle as an LV3 persistent-rule task.

Director obligations:

1. State `Scope: LV3. Target=<...>. Adjacent=<...>. Excluded=<...>.`
2. Identify the failed instruction or missing rule path when correcting an agent failure.
3. Ensure a durable rule-system target changes, such as `AGENTS.md`, `CLAUDE.md`, this playbook, `protocols/`, `protocols/contracts/`, canonical skills, checked-in hooks/guards, or CI workflows.
4. If any skill or skill trigger changes, route through `skill-creator` and update the skill frontmatter `description`.
5. Require Codex to run `scripts/ops/check-persistent-rule-gate.sh` when present.
6. Do not mark recurrence prevention complete if the result is only a chat promise.

Live beta data guard: do not allow Codex to create fixture, test, or temporary maps in the active beta personal workspace for verification. Use Playwright fixtures, isolated `testRun` state, a separate temporary workspace, or an explicit backup/restore cleanup flow.

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
- 2026-06-15 — Built the automation system: nightly auto-sync + real test CI. Lessons:
  (1) **`daily-sync` skill + script** (`scripts/ops/daily-sync.sh`, `.claude/skills/daily-sync/`):
  unattended commit→push dev-beta→sync beta/→final/→build/test gate→commit/push. Installed as a
  macOS LaunchAgent `~/Library/LaunchAgents/com.m3e.daily-sync.plist` (runs 03:00 nightly). The
  plist sets `PATH=/opt/homebrew/bin:...` so arm64 node is used; git push works unattended via the
  `osxkeychain` credential helper. Manage: `launchctl bootstrap/bootout gui/$(id -u) <plist>`.
  (2) **CI was red for months on `installer-lint.yml`** — the `^`-line-continuation check fired on
  install .bat files even though `.gitattributes` already forces `eol=crlf` (which GitHub ZIP
  honors), making the LF-breakage premise moot. Fix = make the lint CRLF-aware (only fail when
  `git check-attr eol` ≠ crlf), not edit the installer. GH stops at the first failing step, so
  always run ALL workflow steps locally to confirm the whole thing is green.
  (3) **New test CI (`test.yml`) caught a latent bug a clean runner exposes:** `npm test`
  (=`build:node && vitest`) does NOT build browser bundles, so `home_pure_fns`/`markdown_renderer`
  tests fail on a clean checkout (locally masked by stale `dist/browser/`). CI fix = `npm run build`
  (node+browser) before `npm test`. NOTE the latent issue: `npm test` is not self-sufficient on a
  clean checkout — consider making beta's `test:unit` build browser artifacts too.
  (4) **Codex `exec` stdout sometimes lands empty** in the captured file even when the commit/edit
  succeeded — verify by inspecting the worktree (git log / file contents), don't rely on its report.
- 2026-06-16 — Codified four recurring Director inefficiencies into helpers (built after a
  layout-refactor session repeated the same manual steps 3+ times):
  (1) **`scripts/beta/preview-worktree.sh <worktree>`** — a worktree has no `better-sqlite3`
  native binding, so `npm start` can't run there. To *see* a worktree's UI change you must build
  its browser bundle, copy dist into the main checkout, and serve from main. This script does all
  three in one call; then just RELOAD http://localhost:4173 (server serves dist/browser statically).
  (2) **`scripts/codex.sh exec --final "<handoff>"`** — plain `codex exec` dumps the whole run
  (often >1MB) to stdout; `--final` runs `--json` and prints ONLY Codex's last message. The live
  `--json` final event is `{"type":"item.completed","item":{"type":"agent_message","text":...}}`
  (NOT the rollout-log `output_text` shape). Use for handoffs where you only want the conclusion.
  (3) **`scripts/ops/codex-grep.sh <query> [context]`** — search past Codex session logs
  (`~/.codex/sessions/**/*.jsonl`) for the user's own messages. Unescape via `json.loads('"'+body+'"')`,
  not naive `.replace` (handles `\uXXXX` / Japanese correctly). Newest-first; optional 2nd keyword to narrow.
  (4) **Visual verification is impossible in this sandbox — do NOT retry it.** Playwright Chromium
  (SIGTRAP), system Chrome (Crashpad SIGABRT), the Chrome extension (disconnects), and computer-use
  (access denied) all fail here. Build + `preview-worktree.sh`, then DELEGATE the eyeball check to
  akaghef (or a Codex session that has working browser access). Don't burn turns on screenshots.
  Aside: `codex-session` `start.sh` hardcoded `MODEL=gpt-5.2` (rejected by ChatGPT-account Codex);
  patched to `${MODEL:-gpt-5.5}`, and its scripts needed `chmod +x`.
- 2026-06-16 — Added the LV3 persistent-rule gate for `!!!` / `！！！` and recurrence-prevention
  requests. Director must require a durable rule-system change instead of accepting chat-only
  promises. Skill trigger changes must go through `skill-creator` and update frontmatter
  `description`. Also codified the live beta data guard: no fixture/test/temp maps in the active
  beta personal workspace for verification.
