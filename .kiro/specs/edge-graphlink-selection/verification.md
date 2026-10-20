# Claude 作業引継ぎ・検証

2026-10-21 / Basis: TOB-V

## 対象

既存 `codex/edge-graphlink-selection` の選択・移動段階を引き継いだ。
Lane の非描画端点の理由表示、ブラウザ試験の Alt キー計数・実描画方式・
hit padding・System 初期選択の修正をレビューし、コミットした。
編集機能（tasks 6–8）は未実装で、選択・移動段階の成功と混同しない。

## この引継ぎで実行した検証

| 検証 | 結果 |
|---|---|
| `npm --prefix beta run build:node` | PASS |
| `npm --prefix beta run build:browser` | PASS |
| selection / adapter の Vitest | 44 PASS |
| `edge_graphlink_selection.spec.js` | 10 PASS、skip なし。Tree / Disperse の WebGL を含む |
| `lane_view.spec.js`, `lane_graphlink_layers.spec.js`, `keyboard_modes.spec.js` | 21 PASS / 1 FAIL |
| 上記失敗を含む `lane_graphlink_layers.spec.js` 単独2回 | 4 PASS |
| 同じ Lane spec を実装前 `ad1f40b` で実行 | 2 PASS |

回帰の初回失敗は `applyRoot` 後の `data-lane-state=ready` 待機。
変更前・変更後の単独実行では再現しなかったため、今回の製品回帰とも既存不具合とも
断定しない。成功するまでの再実行で初回失敗を取り消していない。
既存試験・期待値・baseline・timeout は変更していない。

## レビュー用プレビュー

同 checkout の実製品 `createAppServer` を既存 `isolatedProductServer` helper で
起動し、独立した一時 workspace に人工 fixture のみを配置した。
通常 Beta・個人 workspace は変更していない。A-sys の live map コピーはまだ未準備。

| 表示 | URL |
|---|---|
| Tree | http://127.0.0.1:4188/viewer.html?map=selection-tree-right&renderer=svg |
| Axial | http://127.0.0.1:4188/viewer.html?map=selection-timeline-right&renderer=svg |
| System | http://127.0.0.1:4188/viewer.html?map=selection-system-right&renderer=svg |
| Disperse | http://127.0.0.1:4188/viewer.html?map=selection-scatter-right&renderer=svg |
| Lane down | http://127.0.0.1:4188/viewer.html?map=selection-lane-down&renderer=svg |
| Lane right | http://127.0.0.1:4188/viewer.html?map=selection-lane-right&renderer=svg |

プレビューは一時サーバーの稼働中のみ有効。ユーザーのレビュー承認は未取得。
本流統合・push・通常 Beta 更新は未実施。最新本流の Disperse force 変更との組合せも
未検証。次は初回回帰失敗の切り分けと、選択・移動レビュー後の編集段階。

Headless browser readback confirmed all six preview URLs use the requested surface
and the selection adapter. A Lane screenshot was inspected. This confirms the
artificial preview works, not acceptance of editing or an A-sys map migration.

## 2026-10-21 full-session takeover audit follow-up

Completed the missing A-sys review copy. `selection_review_server.js` now exports
only the named map through the existing source API (default 4187/asys-lane), instead
of opening source SQLite directly. Missing/unavailable export fails with an explicit
error; no alternate source is silently substituted. Temporary target still uses
the unchanged real product server and disposable database.

Started the script on 4188; headless Chromium confirmed ready map/view for Tree,
Axial, System, Disperse and A-sys Lane down/right. The canonical task URLs are now
live: selection-tree, selection-axial, selection-system, selection-disperse,
selection-asys-down, selection-asys-right. Earlier artificial-only URLs in this
record describe the prior preview, which is no longer running.

Source API readback before/after: identical state. Both A-sys copies: 33 nodes,
original node text/attributes/children and GraphLinks retained, except the specified
review root display name and Surface selection. `node --check` and diff check pass.
No live/personal map write. This is a selection review build; L3 editing remains
unimplemented. Human acceptance is not inferred from successful URL readback.
