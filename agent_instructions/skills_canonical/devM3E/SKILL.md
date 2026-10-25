---
name: devM3E
description: M3E の実装・修正・仕様変更を、独立作業から dev-beta への直接統合、CI 成功確認、通常 Beta の確認まで進める。開発依頼で使用する。指定済みのMap操作はMCPへ直接渡し、この開発SkillやPR作成を必須にしない。
---

# devM3E

## DP Router

- DP0: 目的・仕様・変更範囲を整理する。
- DP1: 初期導入時は環境と最小の受入を確認する。
- DP2: 既存環境で修正・検証・本流反映を進める。

1. AGENTS.md と必須コンテキストを読む。ユーザーの目的・症状・期待結果と変更範囲を決める。
2. `docs/06_Operations/Worktree_Separation_Rules.md` に従い作業ツリーを選び、既存差分を保持してファイル予約を取る。並行 AI の起動は明示承認がある場合のみ。
3. 必要な仕様整理、実装、最小の関連試験を行う。map 操作は `docs/protocols/mcp-map-operations.md` の六つのMCP Toolsを使い、未決の構造判断だけMap Manager規約を参照する。
4. 担当 AI が差分をレビューし commit、直列化した本流統合、push、必要な通常 Beta の再生成・再起動・元の操作確認まで行う。既存 Codex セッションを再起動しない。push は `.githooks/pre-push`（`scripts/ops/preflight.sh --commit <sha>`、初回は `scripts/ops/install-git-hooks.sh`）を通し、`--no-verify` は使わない。`scripts/ops/watch-ci.sh <統合 SHA>` の成功を完了条件とし、CI が赤のまま次の push を重ねない。
5. 意図、commit、試験、稼働反映、未確認事項を報告する。文書だけなら稼働反映は対象外。必要な task 状態だけ更新する。

機能判断を勝手に広げない。draft-only / review-only の依頼はその範囲で止める。新しい日記、map 更新、別 AI や PR を形式的に追加しない。PR はユーザーが求めた場合の任意経路。

## Beta / Final channel policy

Follow `docs/06_Operations/Channel_Release_Policy.md` for launch, update, release, data, rollback, and per-device evidence. Beta delivery does not authorize Final promotion. Final updates select an already published tag; never copy current Beta into the daily Final runtime.
