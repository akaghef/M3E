# PJ08 resume cheatsheet

## 現在の入口（2026-10-03）

- **進め方**: UI 最終チェックは akaghef、契約・接続・実装・機械検証は Codex + Astra が並行。
- **対象**: OT NETWORK × 通常 Viewer。DECK は独立。
- **実装**: [PR #104](https://github.com/akaghef/M3E/pull/104) — runtime を保存正本から分離する観測統合。マージ状態は PR、稼働反映は統合記録で確認する。
- **読むもの**: [通常 Beta への統合記録](docs/2026-10-03_beta-integration.md)、[実行契約](docs/2026-09-22_integration-contract.md)、[検証結果と残条件](docs/2026-09-22_network-integration.md)、`tasks.yaml`。以下は以前の停止地点であり、現在の停止条件ではない。
- **運用依存**: A-sys 側で OT 2026.09.19 と Codex runtime 通知修正を統合。フック信頼の承認は human が `/hooks` で確認する。

- **明示保留**（2026-10-11）: OT 力学の通常 Disperse 採用。独立 Lab の回収は進める。

## 以前の停止地点（履歴）

- **Phase**: 1（GUI 収束）
- **次 task**: T-1-1（mock 改訂 / akaghef の差し戻し待ちで blocked）→ T-1-2, T-1-3
- **open reviews**: 3（Q1 色の所有権 / Q2 herdr 端末 lane 候補 / Q3 OT 公開ライセンス境界）
- **最新コミット**: `14d0cdc`（PJ08 はまだ未コミット）
- **Agent Status**: Claude = Director + Phase 1 の front 実装（akaghef 指示の例外） /
  Codex = 待機 / Fugu(Hermes) = backend・observation contract
- **前セッションの最後にやったこと**: 外部 doc「AM OT herdr比較検討」を upstream と canon に照合し、
  `analysis/260921_am_ot_herdr_layer_comparison.md` に stow。新規判断点を Q2 / Q3 として起票。

## 再開時に最初に読むもの

1. 本書の「現在の入口」と統合記録。`plan.md` の DC1–DC5 は静的 mock を対象とした当時の決定であり、実装全体の停止条件ではない。
2. `plan.md` の吸収表 — 未 commit 差分を持つ worktree が2本ある。強制削除しない
3. `reviews/Q1_color_ownership.md` / `Q2_herdr_terminal_lane_candidate.md` /
   `Q3_ot_license_public_boundary.md` — 未回答なら akaghef に問う

## 踏んではいけない地雷

- **GUI の受入契約に数量条件を使わない。**「N個ある」は契約にならない（2026-09-14 の失敗の直接原因）
- **失敗した agent の自己診断を、そのまま次の解として輸入しない。** 依頼の原文に戻ってから設計する
- **Phase 遷移判定を Claude が出さない。** akaghef のみ
- `git worktree remove --force` を未 commit 差分のある worktree に使わない
