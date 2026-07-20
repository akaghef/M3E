# Worktree Separation Rules

最終更新: 2026-06-14

## Purpose

Codex implementation tasks must be isolated so `dev-beta` remains the integration branch and unrelated work does not mix.
The old role worktree model (`dev-visual` / `dev-data` / `dev-team`) is superseded.

## Canonical Model

- Director: Claude.
- Worker: Codex (`codex exec`).
- Primary checkout: `$HOME/dev/M3E` on `dev-beta`; no product implementation directly here.
- Task worktree: `$HOME/dev/M3E-worktrees/<task>`.
- Task branch: `codex/<task>`.
- PR base: `dev-beta`.
- Helper: `scripts/ops/worktree.sh`.

## Worktree Lifecycle

```bash
scripts/ops/worktree.sh new <task>
scripts/ops/worktree.sh list
scripts/ops/worktree.sh clean
scripts/ops/worktree.sh rm <task>
```

Rules:

1. Branch each task from current `dev-beta`.
2. Run code-writing Codex tasks inside the task worktree only.
3. Run investigation-only Codex tasks with read-only sandbox when no writes are needed.
4. After PR merge, remove the task worktree with `scripts/ops/worktree.sh rm <task>`.
5. Never force-remove a worktree with uncommitted work; escalate to akaghef.

## Director Dispatch

```bash
# Investigation / search
scripts/codex.sh exec --sandbox read-only "<handoff>" < /dev/null

# Implementation
( cd "$HOME/dev/M3E-worktrees/<task>" && scripts/codex.sh exec "<handoff>" < /dev/null )
```

Always include `< /dev/null`; otherwise Codex can block on stdin.

## Required Checks

Before implementation dispatch:

```bash
git worktree list --porcelain
git branch --show-current
pwd
```

Acceptable implementation state:

- `pwd` is `$HOME/dev/M3E-worktrees/<task>`.
- branch is `codex/<task>`.
- worktree was created from `dev-beta`.

The primary checkout `$HOME/dev/M3E` is acceptable for Director coordination and operating-document maintenance only.

## Integration

1. Codex commits in `codex/<task>`.
2. Codex pushes `codex/<task>`.
3. Codex opens a PR targeting `dev-beta`.
4. Claude Director reviews and decides merge / iterate / escalate.
5. After merge, Claude Director removes the task worktree.
