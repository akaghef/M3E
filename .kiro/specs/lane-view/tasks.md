# Implementation Plan

> 2026-10-17、Director が保存先と条件7 / 8 / 10の明確化を採択し、Track A の task 2〜5とtask 6の検証を指示済み。Track B は未着手。A を先に検証・統合してから B を進める。本流統合・push は Director が所有する。

## Phase 0: Baseline and Review Gate

- [x] 1. Director が草案と IS46 を審査する
  - **Boundary:** `.kiro/specs/lane-view/{requirements,design,tasks}.md` のレビューのみ。
  - MapSurface に displayRootId を任意追加する案（推奨）/ node attributes を使う案を判断する。後者と条件7の衝突を隠さない。
  - requirements.md の条件7 / 8 / 10への提案を判断し、原文18条件の所有を維持する。
  - **Acceptance:** Director の選択と実装 go-ahead が記録されている。無応答を承認にしない。

- [x] 2. 実装開始時の baseline と既存経路を確認する
  - **Boundary:** read-only、現在の source と実行環境。
  - A-1..A-4 / B-1..B-7 のファイル、renderer 選択、保存入口、起動先、依存 / lockfile を再確認する。
  - 下記の既存 unit / visual 回帰コマンドを実行し、既存失敗を実装後の結果と区別する。
  - **Acceptance:** baseline の結果と未実行理由がある。既存失敗で条件12を緩めない。

## Phase 1: Track A — GraphLink.attributes

- [x] 3. A の経路を実試験で固定する（A-1..A-4）
  - **Boundary:** `beta/tests/unit/graph_link_attributes.test.ts`、`graph_link_attributes_api.test.js`、`beta/tests/visual/graph_link_attributes.spec.js`。
  - 保存値は `{"confidence":"declared"}`。省略 / 空 object / mixed 値 / null / 配列 / scalar を含める。
  - API 試験は既存 app server を一時 DB と `127.0.0.1:0` で起動し、link POST→map GET、無効値の4xx、拒否前後で永続値が不変であることを確認する。
  - browser は既存読込・node 編集・保存・JSON export/import を操作し、API / reload の readback で保持を確認する。mock server だけで条件1/2の成功としない。
  - **Acceptance:** 条件1–4の失敗が再現でき、試験は実経路の欠落を検出する。個人 workspace を使わない。

- [ ] 4. 型と viewer 読込を延長する（A-1 / A-2）
  - **Boundary:** `shared/types.ts`、`browser/viewer.globals.d.ts`、`shared/layout_port.ts:GraphLinkLike`、`shared/graph_link_attributes.ts`、既存 viewer 読込呼出。
  - optional string map を通し、viewer の permissive sanitizer で string entry だけ保持する。LinkStyle は変えない。
  - **Acceptance:** 条件2 / 3と条件4の viewer 読込側が通る。省略した旧データも通る。
  - **現状（2026-10-17）:** 型と viewer 読込の実装、値検証の単体試験は完了。条件2 / 3 / 4の実 browser 検証は Chromium の sandbox 起動制約により Director の独立実行待ち。

- [x] 5. サーバーの検証と link 作成 API を延長する（A-3 / A-4）
  - **Boundary:** `rapid_mvp.ts` の既存 model / 書込検証、`start_viewer.ts:handleLinkApi`、A の値検証 module。
  - link POST と全 map 書込を strict validation に通してから mutation / SQLite 保存を行う。
  - **Acceptance:** 条件1 / 4、無効書込の非破壊、既存 link / DB 試験が通る。新 DB table / API / MCP tool は無い。

- [ ] 6. A を独立検証し Director が先に統合する
  - **Boundary:** A の変更と検証だけ。
  - A の unit / 実 server / browser、下記Rの既存 link / DB 試験、typecheck を実行。
  - **Acceptance:** 条件1–5の証拠を渡し、Director が A の統合結果を返してから B の共有箇所を変更する。B の完成を待って A を埋もれさせない。

## Phase 2: Track B — Vocabulary, Root, and ELK Input

- [ ] 7. Lane の列挙・読込・設定を延長する（B-1）
  - **Boundary:** `types.ts`、`viewer.globals.d.ts`、workbench の型、`layout_port.ts`、`layout_bridge.ts`、node / edge adapter の exhaustive cases、既存 viewer / html の列挙。
  - Lane の追加だけを行い、他の保存値を改名しない。right/down、既存 space、Lane に edge option が無いことを型と読込で確認する。
  - **Acceptance:** `lane_view_state.test.ts` と既存 `surface_view_migration.test.ts`、typecheck が通る。Lane が Tree fallback に落ちない。

- [ ] 8. 選ばれた B-7 の保存先と root 操作を実装する
  - **Boundary:** `shared/lane_view.ts`、既存 surface 型 / sanitizer / 保存コピー、既存 Progressive Navigation のイベント接続。
  - MapSurface を使う案の採択時は MapSurface の displayRootId を保存し、currentScopeRootId は境界として維持する。Node Progressive Navigation の選択 node → Lane、scope の Surface Progressive Navigation → Lane の両方を接続。
  - reload、Tree→Lane→Tree→Lane、root 欠損、異なる scope の不正参照、既存 clone / remap で参照を検証する。
  - **Acceptance:** `lane_view_state.test.ts`、実保存の `lane_view_persistence.test.js`、browser の非 scope root ケースが通る。state.nodes / links / scope 境界は不変。条件7 / 10 / 11と提案された追加検証を別々に報告。

- [ ] 9. fixture と表示対象の試験を作る（B-3 / B-5）
  - **Boundary:** `beta/tests/fixtures/lane_view.json`、`lane_view_large.json`、`tests/unit/lane_view_projection.test.ts`。
  - scope_param の root→子→孫構造を出発点にし、3つの子 node、それぞれ2〜3の孫 node、隣・飛び越し・同じレーン内の GraphLink を含める。表示名は人に読める語としコードを付けない。
  - 別ケースに空レーン、空 root、長いラベル、100孫/200 link、逆向き・循環、子 node / root / 深い子孫 / 範囲外 endpoint、明示 collapse を含める。
  - **Acceptance:** fixture の Topology / 寸法 / 本数 / 期待兄弟順を人が確認できる。期待値を同じ layout 出力から生成しない。単体の内訳数と省略本数は保存されない。

- [ ] 10. shared の ELK graph 変換と実配置を実装する（B-2）
  - **Boundary:** `shared/lane_layout.ts`、`tests/unit/lane_layout.test.ts`、既存 build/import 設定の最小変更。
  - 実 elkjs layered、全配置 node の partition、direction mapping、space の2つの間隔、空レーン placeholder、実寸→LayoutResult を接続する。
  - partition の区間順と全矩形の非重複を独立計算で検査する。逆向き・循環・非連結でも行う。
  - **Acceptance:** 条件6 / 7 / 13の配置側が通る。自作 solver / 手動の並替え / link の削除による補修はない。100/200・1秒に失敗すればそのまま報告する。

- [ ] 11. 非同期 cache と既存の再描画を接続する（B-2）
  - **Boundary:** `shared/lane_layout.ts`、必要な `browser/lane_view_controller.ts`、同期 layout 呼出、worker の既存 build 配信。
  - cache key、同じ promise の共有、generation、pending / failed の表示、古い結果破棄、既存 scheduleRender を接続する。
  - `lane_layout_async.test.ts` は遅延を制御するテストで race を検査し、`lane_layout.test.ts` と性能試験は mock を使わない。
  - **Acceptance:** root / direction / map / View の切替・unload 後に stale result が適用されない。初回 pending を完成 Lane と見せず、自作の仮配置がない。worker build が通る。

## Phase 3: Track B — Existing Renderer and Navigation

- [ ] 12. Lane の境界・node・GraphLink を既存 SVG へ渡す（B-3）
  - **Boundary:** `lane_view.ts` の表示対象、既存 node SVG の呼出、既存 GraphLink の1つの生成経路、必要な既存 style。
  - 親子 edge を省き、root を箱にせず、子 node の見出し、孫 node、collapse 数、省略 GraphLink 数を表示。
  - LinkStyle / arrows / labels / LinkPort / Link Route を保持する。属性の解釈による装飾を足さない。
  - **Acceptance:** 条件8 / 9が実 viewer の DOM と見た目で通る。未知 ID の代用表示がない。

- [ ] 13. Lane だけ visible と hit の層を分ける（B-6）
  - **Boundary:** 既存 GraphLink buffer の分離、`browser/lane_scene.ts`、既存 retainedSvgScene parts の呼出、`lane_scene.test.ts`。
  - visible stroke / marker / label を nodes の後、pointer-events=none。hit を nodes の前へ置く。非 Lane の parts は元の順。
  - **Acceptance:** 条件16–18の DOM / 実クリック / drag / edit が通る。B-1から実施できるが、最終受け入れは実 ELK 配置との結合後。renderer の fork は無い。

- [ ] 14. Surface Progressive Navigation と復元を結合する（B-4）
  - **Boundary:** 既存 workbench / PN、既存 surface 保存イベント、viewer の呼出。
  - Lane の direction 選択は right/down だけ、space は既存3値。非 scope root の操作は task 8 と同じ経路を使う。
  - **Acceptance:** 条件7 / 10 / 11、Lane→Tree の元の表示への復帰、map の開き直しが実操作で通る。UI に tracking ID / raw ID がない。

## Phase 4: Verification and Director Delivery

- [ ] 15. 下記の18条件の対応を全て実行・記録する（B-5）
  - **Boundary:** unit、実 server、一時 workspace、既存 fixture browser path。
  - `lane_view.spec.js`、`lane_graphlink_layers.spec.js`、既存 visual 回帰を headless で実行する。待機は ready 条件を観測し、固定 sleep の延長で性能失敗を隠さない。
  - **Acceptance:** 観測結果、未実行と理由、失敗条件を区別した報告がある。Director が同じ試験を独立に実行できる。

- [ ] 16. shared 所有と差分をレビューする
  - **Boundary:** diff / import 検査、typecheck、既存 lint:deps / lint:copy。
  - viewer.ts の新規追加行を確認し条件14を報告。elkjs は shared strategy 経由だけ、既存 renderer を使い、新 page / server / @xyflow/react が無いことを確認。
  - **Acceptance:** 条件14の行数目安と意味上の境界を両方満たす。テスト側の solver 差替えで受け入れ成功としていない。

- [ ] 17. Director が統合と通常 Beta 確認を行う
  - **Boundary:** Director 所有の dev-beta 統合・push・通常 Beta の build / readback。
  - 通常 Beta の統合済み bundle と起動元を確認し、既存 browser の試験用タブを使う。既存 `testRun` の隔離経路へ file input で fixture を開き、個人 map に試験 map を保存しない。
  - 6 / 8 / 10 / 16を目視し、Lane の root / direction 保存と再読込を確かめる。保存の確認は実 server の一時 workspace 試験とも突き合わせ、通常 runtime の実保存が未確認なら残条件として明記する。
  - **Acceptance:** 条件15の独立した実施証拠がある。fixture server の結果だけを通常 Beta 確認にしない。

## Director-owned Acceptance Verification Matrix

以下のファイルは既存回帰を除き実装 phase に追加する予定。Phase 1 では存在・成功を主張しない。条件番号は requirements.md の原文番号を参照し、新規 tracking ID ではない。

コマンドは repository root から実行する。`U` / `V` / `R` / `L` はこの表のコマンド略記であり、tracking ID ではない。

```bash
# U: unit / 実 app server。dist が必要な既存方式に合わせて build:test を先に行う
npm --prefix beta run build:test
(cd beta && npx vitest run tests/unit/graph_link_attributes.test.ts tests/unit/graph_link_attributes_api.test.js tests/unit/lane_view_state.test.ts tests/unit/lane_view_projection.test.ts tests/unit/lane_view_persistence.test.js tests/unit/lane_layout.test.ts tests/unit/lane_layout_async.test.ts tests/unit/lane_scene.test.ts tests/unit/lane_layout_performance.test.ts)

# V: browser は独立 test port / temp data、headless
npm --prefix beta run build:browser
npm --prefix beta run test:visual -- tests/visual/graph_link_attributes.spec.js tests/visual/lane_view.spec.js tests/visual/lane_graphlink_layers.spec.js

# R: 既存回帰。unit の実行 cwd は beta
(cd beta && npx vitest run tests/unit/persistence_db_behavior.test.js tests/unit/scope_param.test.js tests/unit/rapid_mvp.test.js tests/unit/data_model_integrity.test.js tests/unit/blueprint_importer.test.js tests/unit/blueprint_import_api_integration.test.js tests/unit/mcp_service.test.ts tests/unit/surface_view_migration.test.ts tests/unit/layout_port_contract.test.ts tests/unit/layout_axis_direction.test.ts tests/unit/disperse_layout.test.ts tests/unit/viewer_surface_edge_path.test.ts)
npm --prefix beta run test:visual -- tests/visual/viewer.visual.spec.js tests/visual/viewer_surface_edge_paths.spec.js

# L: 構造・型
npm --prefix beta run typecheck
npm --prefix beta run lint:deps
npm --prefix beta run lint:copy
# LANE_IMPLEMENTATION_BASE は task 6 後・B 実装開始前に記録した commit を設定する
git diff --numstat "${LANE_IMPLEMENTATION_BASE:?B 実装開始時の commit を設定}" -- beta/src/browser/viewer.ts
```

| 原条件 | 主な試験ファイル / コマンド | 独立に観測するもの |
|---|---|---|
| 1 | `graph_link_attributes_api.test.js` / U | 既存 link POST→既存 map GET の属性一致 |
| 2 | `graph_link_attributes.spec.js` / V、API試験 / U | 実 viewer で無関係 node を編集・保存し、実 server 再読込で保持 |
| 3 | `graph_link_attributes.spec.js` / V、`graph_link_attributes.test.ts` / U | 実 JSON export→import→export と属性保持 |
| 4 | A の unit / API / visual 3ファイル / U・V | strict 4xx、永続値不変、viewer の string entry のみ保持 |
| 5 | R の `persistence_db_behavior` / `scope_param` / `rapid_mvp` / `data_model_integrity` / `blueprint_importer` / `blueprint_import_api_integration` / `mcp_service` | 既存 link を含む7ファイルの保存・削除・import・scope 境界の回帰。MCP機能の追加はしない |
| 6 | `lane_layout.test.ts` / U、`lane_view.spec.js` / V | 実 ELK、down/right の partition 区間順、矩形の独立な交差判定 |
| 7 | `lane_layout.test.ts`、`lane_view_state.test.ts` / U、`lane_view.spec.js` / V | root.children[] と子 node 自身の children[] を各々入替。前者でレーン順が変わり後者では変わらない事実と採択済みの条件7を検証。切替前後の nodes / links は全体の deep equality |
| 8 | `lane_view.spec.js` / V、`lane_view_projection.test.ts` / U | 親子線ゼロ、可視孫間の全 link、4 LinkStyle / 4 direction / label、既存 Link Route |
| 9 | `lane_view.spec.js` / V | node・境界・status・title・accessible text に raw ID / 自動コードが無い。data-* の内部参照は可 |
| 10 | `lane_view_persistence.test.js` / U、`lane_view.spec.js` / V | scope の保存→再読込、direction / space / root。非 scope root の追加検収は採択済み |
| 11 | `lane_view.spec.js` / V、`lane_view_state.test.ts` / U | 実 Surface Progressive Navigation の Lane、right/down のみ、保存結果 |
| 12 | 既存4 unit / 2 visual / R | 原文の全6ファイルを変更せず実行する |
| 13 | `lane_layout_performance.test.ts` / U | 100孫/200 link、実 ELK の cache miss 計算終了まで1秒以内、全矩形非重複。初回起動も別記録 |
| 14 | `lane_layout.test.ts` / U、L と diff レビュー | shared import、viewer 呼出だけ、追加80行目安。行移動で算法の複製を隠さない |
| 15 | task 17、`lane_view.spec.js` の同じ fixture、通常 Beta の既存試験用タブ | 統合・build元の証拠と6/8/10/16の目視。自動試験の代替にはしない |
| 16 | `lane_scene.test.ts` / U、`lane_graphlink_layers.spec.js` / V | 実 geometry で横切る link の visible が node より後の DOM で、実表示でも上 |
| 17 | `lane_graphlink_layers.spec.js` / V | 横切られる孫 node の実 click / drag / double click 編集、空白上の hit による link 選択 |
| 18 | `lane_scene.test.ts` / U、`lane_graphlink_layers.spec.js` / V、既存 visual / R | 全既存種類で元の parts 順。Lane→Tree の後も元に戻る |

## Verification Limits and Handoff

Phase 1 の検証は原文18件の完全一致、docs index、差分・境界・リンク・採番・用語の点検。product unit / Playwright は未実行（spec-only phase のため）。実装 phase で sandbox が Playwright を実行できない場合は結果を `未実行（Director 依頼）` とし、上記 V / R の該当 spec と具体的な理由を渡す。

Phase 1 の完了報告には草案3ファイル・正本修正、1 commit の意図と SHA、IS46 の2案と推奨、未決、受け入れ条件の変更提案を含め、ORRERY Mail で WhitePauling に送る。push はしない。実装指示を受けるまで製品コードに着手しない。

## Track A Verification Record — 2026-10-17

Director は仕様草案を `7021405`（Lane の最初の仕様と edge option 正本修正）として commit し、Track A の実装を指示した。以下はこの worker が現在の turn で実行した結果。製品コードと本節は Director に未 commit のまま提出し、Track B は変更していない。

| コマンド / 範囲 | 変更前 | Track A 実装後 |
|---|---|---|
| `npm --prefix beta ci` | Node 26 に対応する better-sqlite3 binary がなく、source build は `No Xcode or CLT version detected!` で失敗 | Director が同じ依存版の native build を用意。worker も実 SQLite の memory 接続を確認。package / lockfile は不変、以後 ci は再実行していない |
| `npm --prefix beta run build:test`（node build / 全 typecheck） | 合格 | 合格 |
| `npm --prefix beta run build:browser` | 合格 | 合格 |
| R の既存 unit 12ファイル | 142試験合格、既存の試験失敗なし | 全て合格 |
| A の新規2 unitファイル | 製品変更前に32試験が失敗。属性欠落と不正値の200受理を検出 | 32試験合格。Rと合わせて14ファイル / 174試験合格 |
| `npm --prefix beta run lint:deps` | 合格（191 modules / 341 dependencies） | 合格（192 modules / 343 dependencies） |
| `npm --prefix beta run lint:copy` | 合格、0 clones | 合格、0 clones |
| Playwright | 未実行（Director 依頼） | 未実行（Director 依頼） |
| `git diff --check` / docs index `--check` | 合格 | 合格 |

unit の実行は上の U のうち Track A の `graph_link_attributes.test.ts` / `graph_link_attributes_api.test.js` と、R の全12ファイルを指定した。Track B の予定ファイルは今回の実行対象にしない。API 試験は既存 createAppServer を一時 DB / ephemeral localhost port で起動し、実 link POST→map GET、全 map POST、拒否前後の SQLite 値不変まで観測した。

Playwright は変更前に `viewer.visual.spec.js` / `viewer_surface_edge_paths.spec.js` を実行しようとしたが、Chromium の `bootstrap_check_in … Permission denied (1100)` / SIGTRAP で全16件が browser 起動前に失敗した。新規 `graph_link_attributes.spec.js --max-failures=1` も同じ理由で最初の1件が起動失敗、残り2件は未実行だった。画面・保存操作・JSON import/export の合格測定は得られていない。Director はこの3 spec を独立実行する。単体試験の成功を browser 条件2 / 3 / 4の合格と扱わない。

共有ノートの採択済み受け入れ条件18件と requirements.md の完全一致も確認した。新しい docs 配下のファイルを追加していないため index の再生成は不要だった。通常 Beta の build / restart / 個人 map の変更は行っていない。
