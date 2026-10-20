# Implementation Plan

> 2026-10-20、仕様草案のみ。今回の worker は本ディレクトリの文書と提供済み mock を commit する。以下の製品実装は未着手。Director が Phase 0 の承認と akaghef の回答を記録するまで開始しない。本流統合・push・通常 Beta 検証は Director が担当する。

## Phase 0: Baseline and Review Gate

- [ ] Director が requirements / design / tasks と mock の構造を審査する。
  - **Boundary:** 文書レビュー。条件1〜14は確定事項として維持する。
  - 条件15〜19、Glossary 登録、重要度のラベルと score 2、scope の所有・切替時の非適用、代表端点・件数・Lane 見出し・preview・NETWORK・alias を確認する。
  - **Acceptance:** akaghef の回答、Director の選択、実装 go-ahead を本仕様へ記録する。未回答や文書 commit を実装承認とみなさない。

- [ ] 実装担当が基準ソースと検証環境を記録する。
  - **Boundary:** isolated worktree / test state。個人 workspace を使用しない。
  - 実装前 commit、viewer.ts の行数、旧重要度への全参照、SVG / WebGL 対応を再確認する。design.md の参照行を更新する。
  - 下記の既存回帰コマンドを実装前に実行する。失敗・環境制約は元からのものと新規のものを区別する。
  - **Acceptance:** 実装前の結果が保存され、失敗を理由に受け入れ条件を緩めない。

## Phase 1: Pure Predicates and Session State

- [ ] 純粋 module と単体試験を追加する。
  - **Boundary:** `beta/src/shared/view_filter.ts`、新規 `beta/tests/unit/view_filter.test.ts`。
  - 確度の2値、declared、欠落、未知文字列、重要度の属性優先順・空文字・数値・文字レベル・閾値前後、scope の先祖・境界自身・root・複数選択・空集合、軸間 AND を検証する。
  - node 自身だけの score、CURRENT の孤立 node、重要度で不一致になった相手の存在が隣接 node に連鎖しないこと、GraphLink の両端 AND、親子 edge、全軸絞らない場合を含める。
  - 判定入力と geometry が変更されないことを deep equality で確認する。集約端点等は Phase 0 の回答どおり試験を固定する。
  - **Acceptance:** 条件2 / 15〜18を independent expected values で検証し、製品の判定関数を期待値計算にも使わない。

- [ ] session 状態と件数購読を実装する。
  - **Boundary:** 新規 `viewer-filter-controller.ts`、`beta/tests/unit/viewer_filter_controller.test.ts`。
  - map 変更 / reload reset、同一 map 内の View / scope 変更、候補2未満、0件、全解除、古い map の通知の扱いを検証する。保存 API / localStorage / URL を変更しない。
  - **Acceptance:** 条件11 / 19と承認された切替仕様に一致する。

## Phase 2: Bar and Shared Scene

- [ ] 案F2の bar とメニューを mount する。
  - **Boundary:** `viewer-filter-bar.tsx`、WorkbenchApp の mount、既存 CSS の必要箇所。
  - 条件4〜9 / 12の構造、radio の意味と「含む」、checkbox / すべて / 閉じる、active、disabled 理由、keyboard focus を実装する。
  - `showContextMenu` / `toggleDropdown` の適合する挙動を再利用する。新 npm 依存は追加しない。
  - **Acceptance:** Inspector や TopBar を作り直さず、mock にある対象外の軸追加・EDGE AUDIT を混入させない。

- [ ] 共通 scene と選択差分へ濃淡を接続する。
  - **Boundary:** `viewer-filter-scene.ts`、retained scene 接続、WebGL capture / tile 更新、`beta/tests/unit/viewer_filter_scene.test.ts`。
  - 無加工の scene に各 primitive の opacity を合成し、解除で元に戻す。arrow / label / badge / tspan、hit target、複数回適用の非累積を試験する。
  - filter-only 更新で Layout / metric / force を呼ばない。全 View の scene と selection patch に同じ処理を使用する。
  - capture cache の stale paint と tile invalidation、WebGL 選択 overlay の濃淡保持を検証する。
  - **Acceptance:** 条件1 / 2 / 10 / 14。座標・経路・描画数は不変、濃淡だけが変わる。

- [ ] 旧重要度の到達不能な処理を撤去し、status bar の件数を接続する。
  - **Boundary:** design.md の撤去表と viewer の呼出、WorkbenchApp の独立した件数欄。
  - scope / 存在の guard は残す。linear 出力、通常選択、GraphLink の元の描画選別は、旧重要度以外を変更しない。
  - `setStatus` の一時メッセージと独立させる。viewer.ts の正味行数を実装前と比較する。
  - **Acceptance:** 条件11 / 13 / 16。全軸絞らない場合は現在の到達可能な挙動と一致する。

## Phase 3: Browser and Regression Verification

- [ ] Lane / A-sys の受け入れ試験を追加・実行する。
  - **Boundary:** 新規 `beta/tests/visual/viewer_filter.spec.js`。既存 `beta/tests/fixtures/lane_asys.json` を使用し、元 fixture を都合よく変更しない。
  - 既存 Lane spec と同じ import / isolated test server 経路を使う。down / right でフィルタ前の全 node 座標、GraphLink の path、件数を採取する。
  - CURRENT は fixture の `system-evidenced` 以外の GraphLink をちょうど薄くし、該当 GraphLink の端点を持たない孫 node をちょうど薄くする。期待集合は fixture の属性・端点から試験側で独立算出する。
  - 解除前後で node / GraphLink の数、全座標、全 path が完全一致し、TO-BE で opacity が復元する。Lane 見出しは承認済みの境界案どおり検査する。
  - **Acceptance:** 条件1 / 10 / 15 / 18。SVG の属性だけでなく実際の computed opacity を確認する。

- [ ] Tree の SVG / WebGL と全 View の不変条件を検証する。
  - **Boundary:** 新規 `beta/tests/visual/viewer_filter_renderers.spec.js`、専用の isolated fixture。
  - Tree を SVG と `renderer=webgl` で開き、renderer が実際に選択されていることを確認する。WebGL fallback を成功と数えない。
  - 重要度で非一致 node / incident GraphLink / edge の opacity が下がり、全座標・path が変わらないことを確認する。WebGL canvas の同じ対象領域で pixel が変わり、解除で戻ることを測る。HTML chip の pixel 変化を WebGL 描画の証拠にしない。
  - Axial、Logic Chart、System、Disperse、Lane も SVG で全座標・全 GraphLink / edge path の前後一致を検証し、Disperse は WebGL も実行する。元から edge を描かない View に線を追加しない。
  - force の安定配置を比較し、操作に起因する Layout / force 呼出が増えないことを併せて検査する。
  - **Acceptance:** 条件1 / 2 / 14。未対応 View の WebGL は対象外理由を記録し、検証済みとは書かない。

- [ ] メニュー・status bar・選択・状態寿命を検証する。
  - **Boundary:** `viewer_filter.spec.js` / `viewer_filter_renderers.spec.js`。
  - chip 直下・再 click・単独 open・Escape、単一選択の閉鎖、複数選択の即時反映と open 維持、すべて、閉じる、解除を click と keyboard で検査する。「含む」と ARIA checked / expanded、focus 復帰、scope disabled 理由も検査する。
  - status bar は一致 / 描画の両件数が独立期待値と一致すること、0件、2.5秒を超えて残ること、一時 status の表示と消去で変わらないこと、解除で件数欄だけ消えることを確認する。
  - 薄い node を選択し、SVG patch と WebGL の選択更新後も濃淡が保持されることを確認する。GraphLink 選択、drag / 編集後の再描画も含む。
  - map 切替と reload は reset。同一 map の View / scope 切替は承認された仕様どおり。保存内容に状態が追加されないことも検査する。
  - **Acceptance:** 条件5〜12 / 14 / 19。個人 workspace に test map を作らない。

- [ ] 既存回帰・型・依存・差分を検証して Director へ渡す。
  - **Boundary:** 下記の exact commands。既存 spec の期待値や screenshot baseline をこの作業の都合で書き換えない。
  - **Acceptance:** 既存試験が green、viewer.ts の行数が増えていない、実行結果と未実行理由が明示される。失敗は先に報告し、合格扱いで統合へ送らない。

## Phase 4: Director Integration and Normal Beta

- [ ] Director が差分・独立検証・未決解消を確認して本流統合・push を行う。
  - **Boundary:** `dev-beta`。作業枝 commit だけで統合済みとはしない。
  - **Acceptance:** 承認済み条件、実装・回帰結果、source commit、remote readback を記録する。

- [ ] Director が統合済み source から build し通常 Beta を検証する。
  - **Boundary:** 通常 Beta、既存の試験用タブ。worktree bundle を通常 runtime へコピーしない。個人 workspace に fixture を作成しない。
  - 左右 top bar 間の配置、CURRENT / 重要度 / scope / 解除、座標不変、status bar、keyboard、選択後の濃淡、SVG / WebGL の実経路を確認する。build 元、配信 bundle、起動先を記録する。
  - **Acceptance:** mock の構造比較と実画面の操作結果がある。fixture 成功を通常 Beta の証拠に代用せず、未確認ならその条件を残す。Final は更新しない。

## Verification Commands

すべて repository root から実行する。以下は承認後の実装用計画であり、この文書作業では実行していない。`npm run build:browser` は Playwright の前に必ず実行する。既存 `beta/playwright.config.js` は専用 port と `test_server.js` を用いる。通常 Beta の4173や personal workspace に接続しない。環境変数で通常環境を指していないことを先に確認する。

### Build and Structure

```bash
npm --prefix beta run build:test
npm --prefix beta run build:browser
npm --prefix beta run typecheck
npm --prefix beta run lint:deps
npm --prefix beta run lint:copy
# VIEWER_FILTER_BASE は実装開始直前の commit を指定する
git show "${VIEWER_FILTER_BASE:?実装開始時の commit を設定}:beta/src/browser/viewer.ts" | wc -l
wc -l beta/src/browser/viewer.ts
git diff --numstat "$VIEWER_FILTER_BASE" -- beta/src/browser/viewer.ts
git diff --check
```

### New Tests（上記計画のファイル作成後）

```bash
(cd beta && npx vitest run tests/unit/view_filter.test.ts tests/unit/viewer_filter_controller.test.ts tests/unit/viewer_filter_scene.test.ts)
npm --prefix beta run build:browser
npm --prefix beta run test:visual -- tests/visual/viewer_filter.spec.js tests/visual/viewer_filter_renderers.spec.js
```

### Existing Regression（調査 Q7 の全対象）

重要度の既存単体試験は style 正規化であり、新しい predicate 試験の代わりにはならない。Lane の既存 opacity > 0 の検査も濃淡の合格根拠にしない。

```bash
npm --prefix beta run build:test
(cd beta && npx vitest run tests/unit/node_draw_contract.test.ts tests/unit/lane_view_projection.test.ts tests/unit/lane_scene.test.ts tests/unit/lane_view_controller.test.ts tests/unit/graph_link_attributes.test.ts tests/unit/graph_link_attributes_api.test.js tests/unit/webgl_scene_tiles.test.ts)
npm --prefix beta run build:browser
npm --prefix beta run test:visual -- tests/visual/workbench_ui.spec.js tests/visual/render_updates.spec.js tests/visual/viewer.visual.spec.js tests/visual/graph_link_attributes.spec.js tests/visual/lane_view.spec.js tests/visual/lane_graphlink_layers.spec.js tests/visual/webgl_projection.spec.js tests/visual/incremental_edit.spec.js tests/visual/viewer_surface_edge_paths.spec.js tests/visual/scatter_surface.spec.js tests/visual/workbench_progressive_nav.spec.js
```

## Verification Limits and Handoff

本草案の検証は参照ソース・コマンド中の既存ファイル・条件網羅・連番・用語・変更範囲・差分の確認。製品 unit / build / Playwright は文書のみのため未実行。実装時に sandbox で Playwright が起動できなければ、結果欄を `未実行（Director 依頼）` とし、該当する上記 spec とエラーを渡す。source inspection や他者の過去の結果を自分の browser 実測として記録しない。

今回の引渡しは3文書と提供済み mock 2ファイルの commit、未決の一覧、検査結果。次の作業は Director による Phase 0 の回答・承認記録であり、実装や通常 Beta への反映ではない。
