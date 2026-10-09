---
name: nightly-autopilot
description: 明示依頼された M3E の夜間データ snapshot・clean な本流同期・CI 状態確認に使う。PR 自動統合と未完了作業の自動 commit は行わない。
---

<!-- generated from agent_instructions/skills_canonical/nightly-autopilot/SKILL.md; do not edit mirror directly -->


# nightly-autopilot

`scripts/ops/nightly-autopilot.sh --dry-run` で対象を確認してから、依頼範囲に合わせて実行する。`docs/06_Operations/Worktree_Separation_Rules.md` の統合予約を取得する。
PR は通常の依存工程ではない。既存 PR の一括統合を起動しない。dirty work / branch mismatch / 未 push commit は停止理由として報告する。
CI 修正は別の isolated task で検証・本流統合・稼働確認まで担当する。このスクリプトは自動実装を dispatch しない。CI 修正は明示的に依頼された作業として別に進める。予約を解放し、実施・未実施・失敗を分けて報告する。
