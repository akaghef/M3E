# Agent Roles

最終更新: 2026-06-14

## Operating Model

M3E の AI 運用は Director to Codex model に統一する。

| Role | Actor | Does | Must not do |
|---|---|---|---|
| Director | Claude | intent 分解、Codex handoff 作成、worktree 管理と反映の監督、レビュー、反復指示 | product code / spec / investigation の hands-on 作業 |
| Worker | Codex (`codex exec`) | 実装、仕様書き、調査、検索、リファクタ、テスト、本流統合、push、稼働反映・確認 | Director 判断の代行、scope 外変更、未承認の破壊的操作 |
| Owner | akaghef | 判断、優先順位、受け入れ、例外承認 | なし |

Canonical Claude-facing sources:

- `CLAUDE.md`
- `docs/06_Operations/Director_Playbook.md`

## Deprecated Model

旧モデルの Claude sub-agent (`manage` / `visual` / `data` / `team`) は廃止済み。
Claude は sub-agent worker を起動しない。
`dev-visual` / `dev-data` / `dev-team` の role branch 運用も新規作業には使わない。

## Execution Sequence

1. Claude Director が intent を確認し、必要なら要求を分割する。
2. Claude Director が `scripts/ops/worktree.sh new <task>` で task worktree を作る。
3. Claude Director が worktree 内で `scripts/codex.sh exec ... < /dev/null` を実行する。
4. Codex が調査・変更・検証・コミット・本流統合・push・稼働反映を行い、元の症状を確認を行う。
5. 担当 AI が diff / 検証結果をレビューし、Worktree_Separation_Rules.md の完了条件を満たす。Claude Director の別途マージ待ちは必須にしない。

## Scope Reference

旧 `visual` / `data` / `team` 定義に含まれていた有用な担当領域は、
実行ロールではなく handoff scope 設計用の参照として
`docs/06_Operations/Codex_Task_Scope_Reference.md` に保存する。
