# PJ08 resume cheatsheet

- **Phase**: 1（GUI 収束）
- **次 task**: T-1-1（mock 改訂 / akaghef の差し戻し待ちで blocked）→ T-1-2, T-1-3
- **open reviews**: 1（Q1 色の所有権）
- **最新コミット**: `14d0cdc`（PJ08 はまだ未コミット）
- **Agent Status**: Claude = Director + Phase 1 の front 実装（akaghef 指示の例外） /
  Codex = 待機 / Fugu(Hermes) = backend・observation contract
- **前セッションの最後にやったこと**: `mocks/screen01.html` 初稿を提出し
  akaghef から「第一案としては優秀だ」。器を stow。

## 再開時に最初に読むもの

1. `plan.md` の「確定した決定」DC1–DC5 — **特に DC1（DB / runtime を作らない）と DC2（安直な合成でよい）**
2. `plan.md` の吸収表 — 未 commit 差分を持つ worktree が2本ある。強制削除しない
3. `reviews/Q1_color_ownership.md` — 未回答なら akaghef に問う

## 踏んではいけない地雷

- **GUI の受入契約に数量条件を使わない。**「N個ある」は契約にならない（2026-09-14 の失敗の直接原因）
- **失敗した agent の自己診断を、そのまま次の解として輸入しない。** 依頼の原文に戻ってから設計する
- **Phase 遷移判定を Claude が出さない。** akaghef のみ
- `git worktree remove --force` を未 commit 差分のある worktree に使わない
