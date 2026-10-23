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

Normal Beta delivery: integrated and pushed as 7171d4a, then built from clean
tracked Beta inputs with the channel lock. Served viewer.js matches the recorded
build hash. Headless checks on localhost:4173 pass in SVG and active WebGL:
select an existing parent-child line, open F2, cancel edited text, and return to
the node. Non-GET requests: zero. The initial check attempted keyboard selection
before the live scene was ready; the corrected check waits for the scene and
clicks its actual rendered child before selecting the incoming edge.
All six isolated preview URLs also load current selection scenes.

Push CI exposed a pre-existing retired personal path in agent-orrery-map source
citations. Replaced only the machine-specific project directory with a documented
placeholder, retaining session filenames. No CI rule was changed.

CI also reproduced a 2,000-node force-step budget failure: p95 57.3ms versus
the unchanged 50ms limit (local reproduction 63.1ms). CPU profiling identified
quadtree traversal as the largest individual cost. Exact leaf forces now skip
internal-cell approximation calculations; internal far bounds are computed
only when the approximation could apply. The existing D3 implementation,
cutoff, approximation threshold and force law remain unchanged.
Before/after vectors match exactly for 2/400/2000 bodies, coincident points,
and theta 0/0.6. Independent force tests: 20 pass, including the same performance
budgets. Full build and all four Disperse browser acceptance tests pass;
400-node browser p95 frame 13.1ms, zero final overlap violations.

Final source 185a77c: remote SHA equals local dev-beta; Build & Test and
Personal Path Check CI both succeed. Normal Beta was rebuilt and the SVG/WebGL
selection/editor-cancel checks repeated successfully with zero write requests
and a matching served bundle hash. Task checkboxes reflect implementation
evidence; human review tasks remain distinct from these automated results.

## 2026-10-24 DC39 / DC40 反映

DC39 の Connection（線要素）を Glossary に登録し、IS110 を解決済みにした。
DC40 は shared `selectionHighlight.guide` と既存 adapter で実装。既存の
`disperseGuideEndpoints` を再利用し、選択中の親子 edge 一組だけを描く。
group-frame の選択 identity と左右巡回候補は維持する。adapter の描画後に
既存 WebGL snapshot が同じ SVG guide を読み取る。GraphLink の除外・集約、
Lane 描画、layout engine、保存形式は変更していない。

タスク5・8は **2026-10-24 akaghef 受け入れ** として記録した。
これはユーザーから与えられた受け入れ記録であり、今回の DC40 ブラウザ試験の成功とは区別する。

| 今回実行した検証 | 結果 |
|---|---|
| `cd beta && npm run build:node && npm run build:browser` | PASS |
| `cd beta && npx vitest run tests/unit/{edge_graphlink_selection,edge_graphlink_selection_adapter,edge_graphlink_edit,disperse_frame}.test.ts` | 4 files / 74 tests PASS |
| `node --check beta/tests/visual/edge_graphlink_selection.spec.js` / `node --check beta/tests/visual/scatter_surface.spec.js` | PASS |
| `git diff --check` | PASS |
| Playwright | 未実行（Director 依頼）。sandbox が port を開けないため |

Director 実行対象は `edge_graphlink_selection.spec.js` と `scatter_surface.spec.js`。
前者の Disperse SVG / WebGL ケースに、未選択時0本、Alt+↓後1本、選択した親子の
identity と実 node 円境界への両端一致、Esc後0本、子からAlt+↑で親への1本、
Alt+→でGraphLinkへ切替後0本を追加した。WebGL は既存 debug snapshot の edgeCount も確認する。
後者の常時ガイド1本という旧 assertion を未選択時0本へ更新した。

viewer.ts の機能分のみの累積: **added 47 / deleted 52 / net −5**。
`git show --numstat e8bf4be 1e37ee9 -- beta/src/browser/viewer.ts` で既存機能分を
25/22 + 21/14 = 46/36 と確認。今回の `git diff --numstat -- beta/src/browser/viewer.ts`
は1/16。基準 `ad1f40b` 以後の無関係な force / cache / Concreteness Axis 等の変更は合算しない。
上限 added ≤120 / net ≤40 を満たす。viewer.ts に選択分岐の追加はない。

### DC39 文書 sweep

`docs/`、`.kiro/`、`agent_instructions/`、全 README、`AGENTS.md`、`CLAUDE.md` を対象に、
日本語・英語の edge / GraphLink 併記、線要素、選択・表示文脈を検索・確認した。
種別の対比、別々の型・保存 field の列挙、歴史的判断の引用は維持。
agent_instructions と AGENTS.md / CLAUDE.md は置換対象なし。Improvement Log は未変更。
以下は新規定義・解決済み記載も含む全置換位置（変更後の行番号）。

| 文書 | 行 |
|---|---|
| `.kiro/specs/edge-graphlink-selection/design.md` | 5, 15, 48, 189, 222, 223, 224, 225, 226, 228, 236 |
| `.kiro/specs/edge-graphlink-selection/requirements.md` | 5, 11, 38, 60, 62, 64, 65, 67, 83, 87, 88, 102, 111, 121, 137, 148 |
| `.kiro/specs/edge-graphlink-selection/research.md` | 31, 37, 59, 102, 168 |
| `.kiro/specs/edge-port-seam/tasks.md` | 7 |
| `.kiro/specs/node-draw-seam/design.md` | 29 |
| `.kiro/specs/node-draw-seam/requirements.md` | 19, 60 |
| `.kiro/specs/progressive-nav-seam/tasks.md` | 80 |
| `.kiro/specs/source-restructure/design.md` | 28 |
| `.kiro/specs/source-restructure/tasks.md` | 207 |
| `docs/00_Home/Glossary.md` | 31 |
| `docs/03_Spec/Command_Language.md` | 20, 119, 124 |
| `docs/03_Spec/UI_Seam_Integration_Contract.md` | 150 |
| `docs/03_Spec/home_scope_navigator.md` | 328 |
| `docs/04_Architecture/Pipeline_UI_Reference.md` | 74 |
| `docs/06_Operations/Actions_Beta.md` | 97, 99, 105 |
| `docs/06_Operations/Keybindings_Beta.md` | 159, 174, 179, 183, 184, 185, 196 |
| `projects/PJ02_MathOntoBridge/README.md` | 39 |
