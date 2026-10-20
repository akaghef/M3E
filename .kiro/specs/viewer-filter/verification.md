# Phase 1–3 実装・検証記録

2026-10-20。作業先 `codex/viewer-filter`。Phase 4（dev-beta 統合、push、通常 Beta）は未実施、Director 担当。

## 判定

**完了ではない。条件10 / 14 の WebGL interaction outline に既知の未実装がある。**
`beta/src/rendering/webgl_projection.ts:623–626` は selection / hover / drag / drop の outline を固定 alpha で生成し、scene capture を通らない。ユーザーの KEEP「renderers unchanged」と design.md:119 の要求が衝突するため、この renderer は変更していない。最小修正への承認を会話で依頼済み、返答待ち。

必要な最小変更案は RenderNode に表示専用 opacity を渡し、snapshot 生成で scene の係数を設定し、上記4 outline の rgba alpha に乗算すること。位置、hit test、選択集合、renderer の方式は変更しない。これは提案であり実装済みではない。新規 WebGL spec は node 外側の outline 領域だけを比較し、この欠落を成功扱いしない。

ブラウザは sandbox の listen 制約で起動前に停止した。条件1 / 2 / 4〜12 / 14 / 19 の実画面・pixel・操作による受け入れは未確認。単体試験や build を browser 証拠として代用しない。

## 基準と変更

開始 commit `7c4a6504df62e359fa94d0bba6acfeef4a54d8f7` は Director 承認済みの仕様。開始時 clean。
`viewer.ts` は開始時・ad1f40b とも17,274行、実装後17,203行。ad1f40b 比は追加29 / 削除100、正味−71行。design.md 撤去表の旧参照位置を実装前に再確認した。旧 ImportanceViewMode と全参照を削除。無関係な移設は行っていない。

追加は4軸の定義と純粋判定、session controller、WorkbenchApp の独立した bar / count span、共通 scene の可逆な opacity、単体・visual specs、派生 fixture。既存 context menu の外側 click と dropdown helper を小さく共通化した。capture の tspan / marker alpha 合成のみ最小修正。renderer、layout / force、Inspector、TopBar の中身、保存 API / format は変更していない。

## 環境と baseline

指示の node_modules 導入済みという状態と異なり、実際には欠落していた。最初の build は `sh: tsc: command not found`。既存 `/Users/akaghef/dev/M3E/beta/package-lock.json` との byte 一致を確認して、同 checkout の node_modules を `cp -cR` で作業先へ複製した。network、依存の追加、lockfile 変更なし。

実装前の build:test / build:browser は exit 0。既存 unit は6 files / 39 tests pass、API suite 1 file fail / 15 tests skipped（`listen EPERM: operation not permitted 127.0.0.1`）。既存 visual は `listen EPERM: operation not permitted 127.0.0.1:14174` で開始不能。個人 workspace と4173を使用していない。

## 最終コマンド（要求順）

| コマンド | 結果 |
|---|---|
| `npm --prefix beta run build:test` | PASS、exit 0 |
| `npm --prefix beta run build:browser` | PASS、exit 0 |
| `npm --prefix beta run typecheck` | PASS、exit 0 |
| `npm --prefix beta run lint:deps` | PASS、203 modules / 363 dependencies、違反0 |
| `npm --prefix beta run lint:copy` | PASS、clone 0 |
| `(cd beta && npx vitest run tests/unit/view_filter.test.ts tests/unit/viewer_filter_controller.test.ts tests/unit/viewer_filter_scene.test.ts)` | PASS、3 files / 37 tests、fail 0 |
| `npm --prefix beta run build:browser` | PASS、新規 visual 直前 |
| `npm --prefix beta run test:visual -- tests/visual/viewer_filter.spec.js tests/visual/viewer_filter_renderers.spec.js` | 未実行（Director 依頼）。server 起動失敗、実行 test 0 |
| `npm --prefix beta run build:test` | PASS、既存回帰前 |
| `(cd beta && npx vitest run tests/unit/node_draw_contract.test.ts tests/unit/lane_view_projection.test.ts tests/unit/lane_scene.test.ts tests/unit/lane_view_controller.test.ts tests/unit/graph_link_attributes.test.ts tests/unit/graph_link_attributes_api.test.js tests/unit/webgl_scene_tiles.test.ts)` | 6 files / 39 tests PASS、API suite 1 file FAIL、15 skipped。baseline と同じ listen EPERM |
| `npm --prefix beta run build:browser` | PASS、既存 visual 直前 |
| `npm --prefix beta run test:visual -- tests/visual/workbench_ui.spec.js tests/visual/render_updates.spec.js tests/visual/viewer.visual.spec.js tests/visual/graph_link_attributes.spec.js tests/visual/lane_view.spec.js tests/visual/lane_graphlink_layers.spec.js tests/visual/webgl_projection.spec.js tests/visual/incremental_edit.spec.js tests/visual/viewer_surface_edge_paths.spec.js tests/visual/scatter_surface.spec.js tests/visual/workbench_progressive_nav.spec.js` | 未実行（Director 依頼）。server 起動失敗、実行 test 0 |

両 visual のエラーは `Error: listen EPERM: operation not permitted 127.0.0.1:14174`、`Process from config.webServer was not able to start. Exit code: 1`。
追加の `npm --prefix beta run build:browser` 後、`(cd beta && npx --no-install playwright test --list tests/visual/viewer_filter.spec.js tests/visual/viewer_filter_renderers.spec.js)` は14 tests / 2 files を収集。これは実行結果ではない。新規 JS 3 files の `node --check`、`git diff --check` も PASS。
ログは `/tmp/viewer-filter-*.log` に保存。

## 単体検証と fixture

score の既存表記・整数文字列・nullish 優先・空値、共通定義の node / GraphLink 評価、4軸のキー存在、所属の分割、B / P / L / M、孤立 node、端点 AND、代表端点、入力不変を検証。controller は map reset、古い通知の拒否、描画集合変更、disabled 期間の保持・再適用、0件、解除を検証。
scene は primitive / preview / badge / edge label / Axial stem、透明 hit 維持、非累積、selection patch、解除、tspan / arrow capture、cache / tile 更新を検証。DOM 試験は jsdom、SVG geometry / GPU stub を使う capture 試験は単体試験であってブラウザ pixel 証拠ではない。

`lane_asys_domains.json` は専用 script で生成した。HTML の原文宣言のみ解析し、実行していない。原 HTML と元 fixture の digest、抽出集合は `beta/tests/fixtures/lane_asys_domains.provenance.json` に記録。Gety は service 停止、`open -a Gety` もアプリ不在だったため、指定済み HTML パスを直接読んだ。
追加 domain を除去した deep equality、元 fixture 不変、独立した Research 固定集合から **12 nodes / 26 GraphLinks** と **CURRENT: Mac・Dell 2 nodes / 1 GraphLink** を検証した。既存 `lane_asys.json`、既存 tests、baseline は変更していない。

## 仕様の適用上の判断

`design.md:103–109`: node-hit / scatter body と実際の .graph-link から分母と描画代表端点を取得する。preview / Lane 見出しを数えない。Lane 見出しは自身の属性で濃淡評価し、親・root 救済をしない。元の描画選別は維持する。

`design.md:115–119`: RetainedSvgScene が無加工 markup を保持し、seam で各 primitive の inline opacity を合成する。WeakMap は元の inline opacity を保持して非累積にする。tspan は SVG 親 text との二重減衰を避け、capture 時に親 text alpha を合成。共有 marker は変更せず capture で所有 link alpha を合成する。

`design.md:125`: React menu の keyboard / focus は新 bar 内、外側 click と既存 dropdown は共通 helper。`design.md:129`: 一時 toast を消しても残る独立 count span を WorkbenchApp に置く。

## 残作業

WebGL outline の最小変更の承認・実装・検証。その後、listen 可能な隔離環境で上記新規14 visual tests と既存11 specs / API suite を実行し、失敗は条件を緩めず修正する。Tree / Disperse 以外の WebGL 拡張は対象外。ブラウザ結果が揃うまで Phase 3 完了にしない。Phase 4 と通常 Beta の確認は Director 担当。
