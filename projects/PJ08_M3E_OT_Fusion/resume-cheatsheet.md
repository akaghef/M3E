# PJ08 resume cheatsheet

## 現在の入口（2026-09-22）

- **進め方**: UI 最終チェックは akaghef、契約・接続・実装・機械検証は Codex + Astra が並行。
- **対象**: OT NETWORK × 通常 Viewer。DECK は独立。
- **作業先**: `codex/pj08-network-integration` — runtime を保存正本から分離する統合。
- **読むもの**: [実行契約](docs/2026-09-22_integration-contract.md)、[検証結果と残条件](docs/2026-09-22_network-integration.md)、`tasks.yaml`。以下は以前の停止地点であり、現在の停止条件ではない。
- **運用依存**: A-sys 側で OT 2026.09.19 と Codex runtime 通知修正を統合。フック信頼の承認は human が `/hooks` で確認する。

## 以前の停止地点（履歴）

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
