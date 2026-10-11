---
name: daily-sync
description: M3E の日次同期を確認・実行する明示依頼に使う。clean な dev-beta の fast-forward 同期だけを既定とし、未完了作業の自動 commit や final 更新はしない。
---

<!-- generated from agent_instructions/skills_canonical/daily-sync/SKILL.md; do not edit mirror directly -->


# daily-sync

`scripts/ops/daily-sync.sh --dry-run` で計画を確認する。実行依頼がある場合だけ同スクリプトを実行する。
`docs/06_Operations/Worktree_Separation_Rules.md` の統合予約を取得する。dirty work、別 branch、未 push commit があれば所有者の作業として停止する。
Final 昇格は日次同期から分離されている。`--with-final` は廃止。公開済み Final の更新は `docs/06_Operations/Channel_Release_Policy.md` に従いタグを指定する。通常 Beta の配信確認は別工程であり、この同期スクリプトの成功から動作確認を推論しない。
