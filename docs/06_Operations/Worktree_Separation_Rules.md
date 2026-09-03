# Worktree Separation Rules

最終更新: 2026-08-06

## Purpose

Codex implementation tasks and conflict-prone writes must be isolated so `dev-beta` remains the integration branch and unrelated work does not mix. Worktree use is determined by write-conflict risk, not by the mere existence of a write.
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

## Direct Idea Stow Exception

新しいideaの採取だけを目的とする場合、次をすべて満たせばprimary checkoutへ直接stowしてよい。

1. `docs/ideas/`配下に一意な新規ファイルまたは新規subtreeを追加するappend-only変更である。
2. 既存idea本文を上書き、移動、改名、再編しない。
3. product code、test、spec、architecture、operations、ADR、`Current_Status.md`を変更しない。
4. adjacent writeは親idea READMEのリンク追加と生成`docs/index.md`更新だけである。
5. 内容がpublic-safeで、配置先・canonical owner・overwrite riskが明確である。
6. primary checkoutの既存変更と競合しないことを事前確認する。

一つでも満たさない場合はtask worktreeを使う。特に「実装を伴う」「既存ファイルを競合編集する」「採用済み仕様へ昇格する」変更は例外対象外。

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

The primary checkout `$HOME/dev/M3E` is acceptable for Director coordination, operating-document maintenance, and the bounded append-only idea stow exception above. Product implementation remains forbidden there.

## Integration

1. Codex commits in `codex/<task>`.
2. Codex pushes `codex/<task>`.
3. Codex opens a PR targeting `dev-beta`.
4. Claude Director reviews and decides merge / iterate / escalate.
5. After merge, Claude Director removes the task worktree.
