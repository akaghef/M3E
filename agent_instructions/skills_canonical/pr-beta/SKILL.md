---
name: pr-beta
description: M3E でユーザーが明示的に Pull Request 作成または /pr-beta を依頼した時だけ使う。通常の統合、beta_update、実装完了には使用しない。
---

# pr-beta

任意の PR 作成経路。通常の統合は `docs/06_Operations/Worktree_Separation_Rules.md` を使う。

- 対象枝・差分・検証を確認し、既存 PR があれば再利用する。
- 対象ファイルだけ commit し task branch を push、base dev-beta で PR を作る。本文は問題、変更後の挙動、検証、未確認事項を簡潔に記す。
- PR 作成を製品への反映完了とは呼ばない。レビュー専用依頼なら merge しない。
- daily 更新や別 AI の起動を前提にしない。旧 role branch は使わない。
