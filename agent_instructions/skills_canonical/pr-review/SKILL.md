---
name: pr-review
description: M3E の明示された既存 Pull Request のレビューや統合依頼を扱う。通常の実装を PR 待ちにしない。
---

# pr-review

差分・要求・関連試験・最新本流との競合を確認する。レビューのみの依頼では結果を報告して停止する。
統合も承認されている場合は、checks と mergeability を別々に確認し、`docs/06_Operations/Worktree_Separation_Rules.md` の統合・通常 Beta 反映・元の操作確認まで担当する。PR の merge だけで完了にしない。
レビューコメントの外部投稿は明示依頼がある場合のみ。main/release、force-push、破壊的変更は別途承認が必要。
