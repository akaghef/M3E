# Director Playbook

The operating manual for Claude-as-Director driving Codex workers on M3E.
`CLAUDE.md` (repo root) is the binding contract; this file is the **how-to** and the
**memory of what works**. Keep it current — improvements compound here.

---

## 1. The loop

```
intent → discovery/steering (Claude) → spec/design/tasks (Codex draft → Claude review)
       → impl handoff → dispatch (codex) → impl review + verify (Claude)
       → integrate / iterate → record
```

1. **Intent** — restate what akaghef wants in one sentence. If ambiguous, ask before dispatching.
2. **Discovery / steering** (Claude) — for new or non-trivial work, run `kiro-discovery` to frame
   scope; update `.kiro/steering/` (`kiro-steering`) if project knowledge changed. Skip for trivial fixes.
3. **Spec / design / tasks** — dispatch drafts to Codex (`kiro-spec-*`), then review and approve
   (`kiro-review`). Codex authors; you judge. Skip the spec phases for trivial / mechanical changes.
4. **Decompose & handoff** — turn approved tasks into bounded Codex impl handoffs (template below).
5. **Dispatch** — `scripts/codex.sh exec` (read-only for investigation, write in a worktree for implementation).
6. **Review & verify** — judge Codex output against intent + acceptance criteria + the approved spec;
   verify with fresh evidence (`kiro-verify-completion`). Do not rubber-stamp; verify claims.
7. **Integrate / iterate** — PR to `dev-beta`, or send Codex a follow-up (`resume --last`).
8. **Record** — if you learned something reusable, append to the Improvement Log (§5).

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
- If the handoff affects repo hygiene, source/artifact boundaries, generated outputs, private/public-danger material, or worktree placement, include `protocols/repository-canon-values.md` in CONTEXT.

## 3. Worktree lifecycle

```bash
scripts/ops/worktree.sh new <task>     # create /…/M3E-worktrees/<task> on branch codex/<task>
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
- 2026-06-16 — Built isolated app `apps/test-case-board/` (Vite + React + @dnd-kit kanban) from a
  screenshot spec. Since Codex is blind to images, the Director's value-add was transcribing the
  full visual + data spec into the handoff (source of truth). Three Codex/sandbox lessons:
  (1) **Codex `exec` sandbox has no network** — `npm install` dies with ENOTFOUND registry.npmjs.org,
  so build/typecheck/dev-run acceptance can't run inside Codex. The Director must run install+build
  for verification (`export PATH="/opt/homebrew/bin:$PATH"` for arm64 node), then re-dispatch only the
  no-network finishing work.
  (2) **`--final` is an `exec`-only flag** in `codex.sh`; `codex exec resume --last --final …` errors
  with `unexpected argument '--final'`. Drop `--final` on the resume path.
  (3) **Codex `resume` sometimes can't write `.git/worktrees/<wt>/index.lock`** (`Operation not
  permitted`) → its `git add`/commit fails even though the file edits land on disk. Don't retry inside
  Codex; the Director commits from its own Bash (git/PR flow is the Director's domain anyway). Note the
  error is "cannot *create*" the lock, i.e. no stale lock to clean up.
- 2026-06-16 — Built a second artifact (`artifacts/keyboard-shortcuts/`: interactive hover map of the
  viewer hotkeys on a Magic Keyboard photo). The reusable breakthrough is a way to close the
  visual-verification gap the playbook calls impossible (entry 2026-06-16 #4): **for image/geometry work,
  the Director CAN verify by rendering an annotated image and Read-ing it back.** Concretely: pip-install
  numpy+PIL into a throwaway venv (`python3 -m venv /tmp/v && /tmp/v/bin/pip install pillow numpy`), detect
  the structure (here: key grid via row/column brightness-gap profiles on the JPEG), draw the result onto
  the source image, save a PNG, and `Read` that PNG to confirm alignment — iterate until correct, THEN bake
  the measured coordinates. This beat two rounds of blind parametric-model guessing + a user-driven
  calibration UI: the model numbers were wrong and un-tunable blind; measured boxes (80 keys, % of image)
  fixed it in one pass. Lesson: when output is visual but *deterministically measurable*, measure+render+Read
  instead of guessing or offloading the eyeball to akaghef. (Also reconfirmed: background Bash starts at an
  unspecified cwd — always `cd /Users/nisimoriyuuya/dev/M3E && scripts/codex.sh …` or it 127s on the
  relative path; and `--final` is exec-only, not valid on `resume`.)
- 2026-06-16 — **Adopted Kiro / cc-sdd as M3E's default execution harness** (akaghef decision,
  relayed from a codex DACP-rollout notice). Phase ownership is **hybrid**: Claude owns
  discovery / steering / impl-review / verify; Codex drafts spec/design/tasks and implements.
  Updated `CLAUDE.md` (role intro, DO / DO-NOT, new "Spec-Driven harness" section, session-start)
  and §1 loop above. Guardrails: A-sys upper boundaries (TOB / DP / credential / Map Manager /
  Large IO / send gate) outrank cc-sdd; trivial changes skip the spec phases; Codex-owned phases
  still use the dispatch + worktree mechanics. DACP's `dacp_*` MCP bridge lives in Akaghef-System
  and is **not** wired into this M3E repo — continue driving Codex via `scripts/codex.sh exec` here.
- 2026-06-16 — Added the LV3 persistent-rule gate for `!!!` / `！！！` and recurrence-prevention
  requests. Director must require a durable rule-system change instead of accepting chat-only
  promises. Skill trigger changes must go through `skill-creator` and update frontmatter
  `description`. Also codified the live beta data guard: no fixture/test/temp maps in the active
  beta personal workspace for verification.
- 2026-07-05 — Added `protocols/repository-canon-values.md` as the canonical routing point for
  Akaghef's repo-level values: 弱いから利用して強くなる, one canonical owner per concern,
  source-only Git, generated outputs as projections/artifacts, worktrees outside the primary
  checkout, and private/public-danger material outside the public repo. Rule: when a Codex handoff
  touches repo hygiene, source/artifact boundaries, generated outputs, private/public-danger
  material, or worktree placement, include that protocol in CONTEXT instead of restating the whole
  doctrine in `AGENTS.md`.
