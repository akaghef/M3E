---
name: beta-converse
description: M3E の既存作業枝・作業ツリーを整理または統合する明示依頼に使う。未統合成果を保存し、PR の開閉を削除根拠にしない。
---

<!-- generated from agent_instructions/skills_canonical/beta-converse/SKILL.md; do not edit mirror directly -->


# beta-converse

`docs/06_Operations/Worktree_Separation_Rules.md` を読む。各枝の目的、差分、依存、本流への取り込み、dirty/untracked/ignored 成果物を確認して一覧化する。
承認された対象だけを検証して統合する。規則変更や掃除の依頼から全 PR の merge を推論しない。
削除は取り込みを確認し不要になった clean な作業ツリーだけ。競合・古さ・close 済 PR は破棄の根拠にならない。force remove、reset、commit の捨て直しは禁止。
