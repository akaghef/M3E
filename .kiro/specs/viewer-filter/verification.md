# Phase 1–3 実装・検証記録

## 2026-10-20 追試（本セッションで実行）

作業枝 `codex/viewer-filter`、開始 `eda1f4c`。Phase 4 は対象外。
**Phase 3 全体は未完了。新規 visual 14/14 PASS だが、既存回帰に11失敗があり、指定 baseline checkout が filesystem sandbox に拒否されたため同一失敗の実測比較ができない。**

### 承認済み WebGL 修正

Director が本依頼で最小変更を承認。design.md の「opacity が全 primitive に届く」を満たすため、scene の表示係数を `RenderNode.opacity` と snapshot cache key に渡し、selection / hover / drag / drop outline の alpha に乗算した。位置、hit testing、選択集合、renderer 方式は変更していない。
`3612181` はこの outline 修正と4種類の buffer-contract 単体試験。`ecbdf6f` は新規 visual の操作・準備処理の修正。既存 spec、baseline、独立期待集合、timeout、閾値は変更していない。

### 失敗ごとの切り分け

| 追試前の失敗 | 原因と修正 | 最終結果 |
|---|---|---|
| Tree SVG | spec の `.node-hit` 中央は従来から可視 shape が上にある。可視 body を実 click し選択後の濃淡を検証 | PASS |
| Tree WebGL | headless の通常起動は WebGL2 unavailable。新規 spec の launchOptions で Chromium SwiftShader を使用。fallback を許さず active / pixel / outline 領域を検査。outline 自体は承認済み product 修正 | PASS |
| Disperse WebGL | reload 完了前の surface event の競合を readiness 待機で解消。このセッションの初回では scatter には切り替わったが WebGL2 unavailable で失敗。上記 software WebGL2 で actual canvas を検査 | PASS |
| same-map scope | folder の可視 `.folder-box` を click。透明 hit rect と shape の二重描画を selector で混同しない | PASS |
| GraphLink selection / edit / drag | 可視 body を click、選択を確認して既存 F2 で inline editor に入る。元の dblclick は pointer capture / selection patch 経路に依存し editor に入らなかった。編集・drag 後の濃淡条件はそのまま検証 | PASS |
| Lane down / right | 可視 body を click。解除後の root 選択復帰は既存 `k` を2回使用し selected class を確認。camera fit 完了後に baseline を採取 | 両方 PASS |
| 全6 View の render count（追試中に顕在化） | diagnostic stack で `saveDocToLocalDb → scheduleRender` を特定。先行する surface/direction 変更の autosave response 完了とその redraw を待ってから filter baseline を採取。filter 後の revision 完全一致を維持 | 全6 PASS |

未フィルタ状態の `elementFromPoint` 診断で shape が hit rect より上にあることを確認。追加の hit-routing assertion は node 中央と左右 margin の実際の target を filter 前後で比較し、全 View / Lane 両方向で一致した。camera の fit animation 中は Inspector 下に入る点が動くため、世界座標に加えて screen 座標の安定も準備完了条件にした。これらは新規 spec の準備修正であり、product の pointer-events / DOM 順序を変更していない。
診断用 spec と render stack logging は削除済み。診断 run は acceptance 件数に含めない。

### 追加レビューで発見した product gap

Disperse の visible circle は `.node-hit.scatter-node-circle` を併有し、透明 hit rect 用の除外 selector に巻き込まれていた。scene の除外を `.node-hit:not(.scatter-node-circle)` に限定した。透明 hit rect は従来通り未変更、visible circle は描画 alpha のみ変更。独立した low / mid の circle opacity 集合と、WebGL capture の low body path alpha を新規 spec に追加した。`ee06cbf` はこの circle 修正と直接検査を含む。既存の canvas pixel 比較だけでは label / 周辺 paint の変化でも通り得たため、14 pass のみでこの gap を見逃さず補強した。unit は geometry / pointer-events / 解除時の元 opacity を検証する。

### 実行コマンドと結果

```sh
npm --prefix beta run build:test
npm --prefix beta run build:browser
npm --prefix beta run lint:deps
npm --prefix beta run lint:copy
(cd beta && npx vitest run tests/unit/view_filter.test.ts tests/unit/viewer_filter_controller.test.ts tests/unit/viewer_filter_scene.test.ts tests/unit/node_draw_contract.test.ts tests/unit/lane_view_projection.test.ts tests/unit/lane_scene.test.ts tests/unit/lane_view_controller.test.ts tests/unit/graph_link_attributes.test.ts tests/unit/graph_link_attributes_api.test.js tests/unit/webgl_scene_tiles.test.ts)
(cd beta && npx vitest run tests/unit/viewer_filter_outline.test.ts)
(cd beta && npx playwright test tests/visual/viewer_filter.spec.js tests/visual/viewer_filter_renderers.spec.js)
```

build:test（typecheck 含む）/ build:browser PASS。lint:deps 違反0、lint:copy clone 0。既存+新規 unit 10 files / 91 tests PASS、outline unit 4 PASS。既存 unit exact list も別実行し7 files / 54 tests PASS。circle 修正後の最終新規 visual は **14 passed (30.1s)**、fail 0 / skip 0。初回の7 pass / 7 failを再現した上で修正後に実行した結果である。

circle 修正後の新規単体:
```sh
(cd beta && npx vitest run tests/unit/view_filter.test.ts tests/unit/viewer_filter_controller.test.ts tests/unit/viewer_filter_scene.test.ts tests/unit/viewer_filter_outline.test.ts)
```
**4 files / 42 tests PASS**。最終 build:browser も PASS。

`viewer.ts`: ad1f40b の17,274行 → 17,204行。追加31 / 削除101、**正味−70行**。`git diff --check` PASS。

### 既存回帰と残条件

既存 browser 11 specs:
```sh
(cd beta && npx playwright test tests/visual/workbench_ui.spec.js tests/visual/render_updates.spec.js tests/visual/viewer.visual.spec.js tests/visual/graph_link_attributes.spec.js tests/visual/lane_view.spec.js tests/visual/lane_graphlink_layers.spec.js tests/visual/webgl_projection.spec.js tests/visual/incremental_edit.spec.js tests/visual/viewer_surface_edge_paths.spec.js tests/visual/scatter_surface.spec.js tests/visual/workbench_progressive_nav.spec.js)
```
結果: **37 passed / 11 failed / 6 skipped (5.2m)**。この run は `ecbdf6f` の browser bundle（Disperse circle 追加修正前）。フィルタ未操作の既存試験で、残失敗を green と扱わない。結果 artifacts を `/tmp/viewer-filter-existing-regression-results` に保管。

失敗は全て既存 `viewer.visual.spec.js`:

| test | 実測された失敗 |
|---|---|
| default sample visual baseline | `#load-default` が hidden、click timeout |
| aircraft mm visual baseline | `#load-aircraft-mm` 待機 timeout |
| viewer keyboard undo redo | `#load-default` hidden |
| viewer drag reparent to root | `#load-default` hidden |
| viewer range select multi reparent | `#load-default` hidden |
| viewer multi drag reparent | `#load-default` hidden |
| viewer multi reparent ignores root in marked sources | `#load-default` hidden |
| viewer add graph link by toolbar flow | `#load-default` hidden |
| viewer renders persisted graph link | `#board` 中央 click を `textarea#linear-text` が intercept |
| viewer shift arrow expands selection | `#load-default` hidden |
| latex rendering visual baseline | 期待1252×692 / 実測1280×720、42327 pixels / 0.05差。baseline 未変更 |

6 skip は既存 WebGL spec の WebGL2 unavailable fallback gate。skip を pass に含めていない。

最終 circle 修正後、skip を埋める追加追試として既存 spec を変更せず SwiftShader launchOptions を設定した一時 config を使用:
```sh
(cd beta && npx playwright test --config /tmp/viewer-filter-webgl-regression.config.cjs tests/visual/webgl_projection.spec.js)
```
config は元 `beta/playwright.config.js` を spread し、testDir / outputDir を絶対 path にし、project.use.launchOptions.args に `--use-angle=swiftshader` / `--enable-unsafe-swiftshader` だけを追加。結果 **0 passed / 3 failed / 3 skipped**。

| test | 実測された失敗 |
|---|---|
| WebGL node editing uses one HTML overlay and the existing commit/cancel path | 既存1秒 activation probe が false を返した後、fallback assertion では既に SVG が hidden。editor 検査に到達せず |
| WebGL Disperse click selects without moving and drag commits through the existing path | legacy `#view-scatter` click を filter chip の `strong` が intercept |
| WebGL Disperse group boundaries remain outside node drag hit testing | 同じ legacy `#view-scatter` click timeout |

静的には legacy `.toolbar` の `opacity:0; pointer-events:none !important` が現在・ad1f40b の両 source に存在する。しかし静的比較は指定された clean baseline 実行の代替ではない。この3失敗も baseline 同一とは認定しない。残3件も activation probe により skip。成果物は `/tmp/viewer-filter-webgl-regression-results`。追加追試を14新規 visual の合格件数に混ぜない。


baseline 用の指定コマンド:
```sh
git worktree add --detach /Users/akaghef/dev/M3E-worktrees/viewer-filter-base ad1f40b
```
結果: `fatal: could not create leading directories of '/Users/akaghef/dev/M3E-worktrees/viewer-filter-base/.git': Operation not permitted`。
このセッションの write roots に指定 sibling directory が含まれず、作成不能。代替 checkout、stash、既存 worktree の書換えで迂回していない。worktree 登録が残っていないことを `git worktree list --porcelain` で確認した。symlink / baseline 実行 / remove は対象未作成につき未実施。baseline と同一失敗とは断定できない。

---

# 初回記録（以下は追試前の履歴）

2026-10-20。作業先 `codex/viewer-filter`。Phase 4（dev-beta 統合、push、通常 Beta）は未実施、Director 担当。

## 判定（初回時点、上記追試で更新済み）

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

## 2026-10-21 Claude takeover: executable browser verification

Basis: TOB-V. This section supersedes earlier environment-blocked execution status,
not the original acceptance criteria. Original specs and screenshot baselines are unchanged.

The existing filter suite initially passed 13/14: Disperse's pixel clip sampled an
old camera location. Hidden SVG hit rectangles did not describe WebGL screen motion.
Added a read-only `data-camera-moving` lifecycle attribute (start, finish, cancel),
waited for fonts/camera completion and actual WebGL camera stability, and captured
render revision before dispatching a surface change. No opacity/pixel threshold,
camera duration, rendering behavior, or expected result was relaxed.

Validated on the filter worktree: browser build PASS; filter unit tests 42 PASS;
new filter browser suite 14 PASS; Disperse targeted repetition 3 PASS;
`git diff --check` PASS. viewer.ts remains 67 lines smaller than the original base.
Intermediate failed camera-wait experiments are retained in the private evidence packet.

Original regression suite: 36 PASS / 12 FAIL / 6 SKIP. Eleven failures belong to
`viewer.visual.spec.js`; one is Lane readiness during setup. The original clean
base reproduces the same eleven Viewer failures (4 PASS / 11 FAIL). Lane isolated
repetitions passed, but do not erase the initial readiness failure.

### Supplemental user-operation comparison (not a replacement acceptance suite)

The user requested concrete checks of compatibility, without being asked to decide
internal test maintenance. Diagnostic copies first changed only sample import and
board focus: both versions produced 5 PASS / 7 FAIL. Adapting current Mac shortcuts
(Tab adds a child, Meta is primary, l / Shift+l create GraphLinks) exposed further
stale coordinate/immediate-render assumptions. All original assertions remained.

A separate six-operation check uses the existing `createAppServer` through
`laneServer`, disposable SQLite, and `shortcut_test.json` with domain metadata.
It checks creation/undo/redo counts; Shift-arrow selection growth; marked multi-move
with root preserved; grandchild drag to root; dragging two selected nodes; and
GraphLink creation with persistence and reload. The filter branch also executes
all six while non-root nodes are dimmed by a domain filter. Selection is through
real mouse coordinates checked against `elementFromPoint`, with no forced click,
DOM mutation, simulated backend, personal-map mutation, or screenshot replacement.

Diagnostic harness corrections are explicit: typing a name creates a separate
undo step, so the create/undo check does not add an unrelated text edit; front
node shapes can cover back hit rectangles, so mouse coordinates verify the node
identity rather than requiring the back rect itself to receive the event; redraw
can temporarily detach an element, so coordinate acquisition waits for its return.
These diagnostics do not turn the original failing regression suite into a pass.

Evidence: private `verification/261021-claude-takeover` packet contains scripts,
failed and successful logs, screenshot evidence and reproduction notes.
Normal Beta integration/push/restart remains unperformed. Original screenshot
compatibility and the intermittent Lane readiness failure remain open acceptance
items. The comparison base is the original pre-filter source, not latest dev-beta;
latest Disperse force changes are not covered by this comparison.

Final supplemental comparison: pre-filter base **6 PASS (11.9s)**; filter worktree
**12 PASS (23.0s)**, six unfiltered plus six with dimmed nodes. Before coordinate
waiting was corrected, the baseline had 5 PASS / 1 transient bounding-box failure;
the filter run had 12 PASS. Both runs are retained. This is Tree/SVG interaction
evidence, not coverage of every surface, WebGL interaction, or old screenshots.

## Legacy operation repair (2026-10-21)

Repaired the original Viewer test controls under the user's continuation
authorization: import the same sample through the existing file input, use
current Tab/mark/link keys, verify both Mac and Windows undo mappings, and
explicitly select SVG for SVG-coordinate tests. Selection redraw is awaited
before reading counts and drag hit regions. Original operation expectations
are preserved. The complete operation run passes 13 tests (15.2 seconds).
The preceding run retained a transient missing hit region (12 pass / 1 fail);
the final run includes the redraw wait. No product code was changed here.

The three original image tests remain failing with snapshot updates disabled:
default-sample lacks its Darwin reference; aircraft.mm returns 404; latex has
an expected 1252x692 image versus actual 1280x720, with 49,837 differing pixels
(6%). These are not accepted baseline changes or waived acceptance conditions.
Filter integration remains blocked on restoring these inputs/references or
an explicit review of the visual baseline. Latest dev-beta combination still
requires verification. Logs: takeover-filter-final-operations2.log and
takeover-filter-baseline-gaps.log in the takeover evidence packet.

## Latest development combination (2026-10-21, final run)

Combined with dev-beta through 185a77c (line editing, theme, Disperse shared
force and its performance repair). Conflict resolution retains both scene
selection finalization and filter application, and both module exclusions.
Full build, typecheck, dependency boundaries, copy drift and build:test pass.
The specified filter/regression unit files pass 92 tests; outline tests add
4 passes (96 total, including all 42 filter-specific tests).

The complete requested browser run, including the 14 new filter tests:
**60 PASS / 3 FAIL / 6 SKIP** (2.5 minutes). All three failures are image
references; all operation/filter tests pass. Existing WebGL projection skips
remain skips, not passes. The dedicated new filter WebGL cases ran and passed.

The first combined run failed two Disperse render-count checks. A trace showed
the final force-position autosave response scheduling one redraw. Test setup
now observes the real force completion and that existing save response before
sampling filter-only state. It does not pause the simulation or alter post-filter
geometry, paint, render-count expectations, global test timeouts or pixel limits.
Temporary tracing was removed before the final build and regression run.

Aircraft input was recovered byte-for-byte from 67b7cc9^:beta/data/aircraft.mm
into tests/fixtures/aircraft.mm; production data cleanup remains intact.
Final blockers: default-sample and aircraft macOS references do not exist;
latex expected 1252x692 versus actual 1280x720, 49,831 differing pixels (6%).
Snapshot update mode was none. No baseline was generated or replaced.
The branch remains isolated pending explicit visual-reference judgment;
successful additional tests do not waive these three failures.
