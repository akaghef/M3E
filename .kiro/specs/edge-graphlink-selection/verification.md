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

## Editing task 6: shared intent implementation

Added `beta/src/shared/edge_graphlink_edit.ts` and its independent unit tests.
The module resolves current scene membership, refuses aggregate/stale/read-only
references and key repeats, emits typed label/port/style/direction/delete intents,
and blocks node-edit fallback. It reuses existing deletion guards and status
formatting. Port, style and direction full cycles and normalized label no-op vs
removal are tested. No mutation or new storage route is present in this module.

`edge_graphlink_edit.test.ts` (22 tests) plus existing selection tests (37):
59 PASS. `tsc --noEmit -p tsconfig.node.json`: PASS. Browser adapter still uses
the selection-only guard: this commit does not enable editing in the preview.
Task 7 (fixed-ref editor, existing history/save integration) is the next boundary.

## Browser editing connection (2026-10-21, in progress)

Connected the accepted shared intents to the existing textarea lifecycle,
parent-label/port/delete helpers, undo snapshots and document autosave.
The editor captures its original reference and document, uses the presentation's
screen anchor, and refuses completion after document replacement, lost rendered
membership or a read-only transition. Style/direction patch only their own field.
The existing selection-only test now checks node-operation refusal; accepted
line-edit keys are covered by the new edit suite. Aggregate refusal remains
unchanged. No screenshot baseline or acceptance threshold was changed.

The browser test found that ensureDocShape removed an unrelated GraphLink's
explicit empty relationType on load. Changed relationType/label defaulting from
truthiness to nullish fallback so unrelated fields survive a subsequent save.
The exact full-link comparison remains in the test.

Unit tests: 68 pass across selection, edit and browser adapter contracts.
build:node and build:browser pass. viewer.ts versus ad1f40b: +46/-36,
net +10, within the accepted added <=120 / net <=40 limit.

Editing run: eight surface/renderer cases passed label commit, no-op/cancel,
Undo/Redo, both port cycles, style/direction cycles, exact unchanged nodes and
other GraphLinks, and API readback/reload. Cases: Tree SVG/WebGL, Axial SVG,
Disperse SVG/WebGL, System SVG, Lane down/right SVG.
The run then failed its Alt-arrow diagnostic because the listener counted the
Alt modifier event as well as ArrowLeft. Restricted that diagnostic to ArrowLeft;
the expected defaultPrevented=false is unchanged. Guard/parent cases are being
rerun separately.

Earlier diagnostic failures retained: first direction expectation incorrectly
assumed none while the independent fixture starts forward (corrected expected
cycle to backward/both/none/forward); WebGL setup queried a hidden SVG element's
bounding box (now clicks the renderer's measured endpoint); unrelated empty
relationType loss (product fix above). These failures are not acceptance passes.
Final regression, integrated-source verification and review delivery remain open.

Guard/parent rerun: **7 PASS**. Includes GraphLink blur/IME/native Alt-arrow,
empty label, deletion returning to origin and Undo, read-only refusal with zero
map writes, and parent label commit/clear/cancel/Undo/Delete protection in Tree,
Axial, Disperse and both Lane directions.
Selection and regression run: **32 PASS** across edge_graphlink_selection,
keyboard_modes (Mac/Windows mapping, SVG/WebGL), lane_graphlink_layers and
lane_view. The aggregate case retains three unchanged stored GraphLinks and
rejects all edit keys and port controls.
Keybindings, Actions and the existing viewer shortcut sheet now describe the
accepted line selection/editing contexts, including the different Esc behavior
for node text versus line labels. No new help surface was created.

## Integrated development source verification (2026-10-21)

Merged dev-beta 645aad3 into the task branch, preserving the Disperse force
implementation, theme handling and line editing. Build and 68 unit tests pass.
The integrated browser run passes all 32 edit, selection and Lane tests.
This includes a singleton becoming a System aggregate after label editing:
port controls are filtered against final rendered membership.
viewer.ts versus integrated dev-beta is +50/-37 (net +13), within its budget.

The initial integrated run hit the existing 30-second whole-test timeout in a
sequential Disperse WebGL edit cycle. Poll intervals were reduced to 50ms;
test and assertion timeouts and expected states were not relaxed.
Dependency installation initially failed compiling better-sqlite3; the existing
primary dependency installation was reused after verifying identical lockfiles
and executing a real SQLite query. No dependency definition was changed by this
recovery. Normal Beta delivery verification remains to be recorded.
