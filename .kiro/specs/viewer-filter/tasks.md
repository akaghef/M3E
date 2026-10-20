# Implementation Plan

> 2026-10-20、akaghef / Director 決定を反映した仕様改訂。今回の変更は3仕様文書と Glossary の2行だけを codex/viewer-filter に commit する。以下の製品実装・fixture 生成は未着手で、別途実装開始の指示が必要。

## Phase 0: Baseline and Review Gate

- [x] requirements / design / tasks に IS90〜IS97、IS99 の決定を記録する。
  - **Boundary:** 文書のみ。旧「Facet は scope で絞る」を「所属 attributes で絞る」に改訂し、条件1〜19を基準にする。
  - 緊急度は既存設計 `docs/ideas/30_ux/map_views/01_2d_matrices.md:18` の `attributes.urgency` を再利用。IS98 の新規提案は不要。
  - **Acceptance:** Glossary の指定2行、全 map 共通の4軸、件数・session・disabled 規則を記録。未決なし。文書 commit を製品実装の承認とみなさない。

- [x] Director が改訂を審査し、実装の go-ahead を出す（2026-10-20）。
  - 条件18 の CURRENT の端点条件を「node 軸に一致した両端を持つ GraphLink から求める」に Director が訂正した（IS93）。CURRENT AND 所属=Research の期待値は node 2 / GraphLink 1 で、A-sys と一致する。
  - 実装は Phase 1〜3 を Codex が担当し、Phase 4（dev-beta 統合・通常 Beta 検証）は Director が担当する。

- [ ] 実装担当が基準ソースと検証環境を記録する。
  - **Boundary:** isolated worktree / test state。個人 workspace を使用しない。
  - 実装前 commit、viewer.ts の行数、旧重要度への全参照、SVG / WebGL 対応を再確認する。design.md の参照行を更新する。
  - 下記の既存回帰コマンドを実装前に実行する。失敗・環境制約は元からのものと新規のものを区別する。
  - **Acceptance:** 実装前の結果が保存され、失敗を理由に受け入れ条件を緩めない。

## Phase 1: Pure Predicates and Session State

- [ ] 純粋 module と単体試験を追加する。
  - **Boundary:** `beta/src/shared/view_filter_axes.ts` と `beta/src/shared/view_filter.ts`、新規 `beta/tests/unit/view_filter.test.ts`。
  - 定義表を入力として target / keys / 順序 / 複数選択 / 絞らない値を共通評価する単体試験。重要度だけを特別扱いする分岐に依存しないことを、node / GraphLink の各定義で検査する。
  - 実現段階の2値、declared、欠落、未知文字列、重要度のキー優先順・空文字・整数文字列・文字レベル・閾値前後、緊急度の同じ尺度を検証する。
  - 所属のカンマ分割、前後空白、空要素、重複、複数名の OR、候補の distinct、選択なし、属性欠落を検証する。登録済み全 chip は存在し、描画対象にキーがなければ disabled。空文字・未知値のキー存在と欠落を区別し、候補1つは有効とする。
  - node 自身だけの score、CURRENT の孤立 node、所属一致の孤立 node、選択外の相手だけに CURRENT link がある node、軸間 AND、GraphLink の両端 AND、親子 edge、全解除を含める。最終 link 集合から node を再帰評価しない。
  - 入力と geometry の非変更を deep equality で確認し、集約端点・件数は IS96 どおり検査する。
  - **Acceptance:** 条件2 / 15〜18 / IS99。期待値計算は製品の定義表・判定関数を呼ばず、テスト側の明示した入力と期待集合で検証する。

- [ ] session 状態と件数購読を実装する。
  - **Boundary:** 新規 `viewer-filter-controller.ts`、`beta/tests/unit/viewer_filter_controller.test.ts`。
  - map 変更 / reload reset、同一 map 内の View / scope 変更、描画対象に軸のキーがない期間と再出現、0件、全解除、古い map の通知の扱いを検証する。保存 API / localStorage / URL を変更しない。
  - **Acceptance:** 条件11 / 19に一致する。

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
  - **Boundary:** 新規 `beta/tests/visual/viewer_filter.spec.js`。新規 `beta/tests/fixtures/lane_asys_domains.json` を追加する。既存 `lane_asys.json` は一切変更しない。生成手順と独立期待値は下記。
  - 既存 Lane spec と同じ import / isolated test server 経路を使う。down / right でフィルタ前の全 node 座標、GraphLink の path、件数を採取する。
  - 所属=Research と CURRENT AND 所属=Research の正確な一致/薄くする集合を下記手順で検査する。
  - 他の軸がすべて絞らない状態で、CURRENT は fixture の `system-evidenced` 以外の GraphLink をちょうど薄くし、該当 GraphLink の端点を持たない孫 node をちょうど薄くする。期待集合は fixture の属性・端点から試験側で独立算出する。
  - 解除前後で node / GraphLink の数、全座標、全 path が完全一致し、全軸を絞らない値へ戻すと opacity が復元する。Lane 見出しは IS96 の境界どおり検査する。
  - **Acceptance:** 条件1 / 10 / 15 / 18。SVG の属性だけでなく実際の computed opacity を確認する。

- [ ] Tree の SVG / WebGL と全 View の不変条件を検証する。
  - **Boundary:** 新規 `beta/tests/visual/viewer_filter_renderers.spec.js`、専用の isolated fixture。
  - Tree を SVG と `renderer=webgl` で開き、renderer が実際に選択されていることを確認する。WebGL fallback を成功と数えない。
  - 重要度と、既存設計キー `urgency` を持つ緊急度の各選択で非一致 node / incident GraphLink / edge の opacity が下がり、全座標・path が変わらないことを確認する。WebGL canvas の同じ対象領域で pixel が変わり、解除で戻ることを測る。HTML chip の pixel 変化を WebGL 描画の証拠にしない。
  - Axial、Logic Chart、System、Disperse、Lane も SVG で全座標・全 GraphLink / edge path の前後一致を検証し、Disperse は WebGL も実行する。元から edge を描かない View に線を追加しない。
  - force の安定配置を比較し、操作に起因する Layout / force 呼出が増えないことを併せて検査する。
  - **Acceptance:** 条件1 / 2 / 14。未対応 View の WebGL は対象外理由を記録し、検証済みとは書かない。

- [ ] メニュー・status bar・選択・状態寿命を検証する。
  - **Boundary:** `viewer_filter.spec.js` / `viewer_filter_renderers.spec.js`。
  - chip 直下・再 click・単独 open・Escape、単一選択の閉鎖、複数選択の即時反映と open 維持、すべて、閉じる、解除を click と keyboard で検査する。「含む」と ARIA checked / expanded、focus 復帰、全4軸の常設と IS99 の disabled 理由も検査する。
  - status bar は一致 / 描画の両件数が独立期待値と一致すること、0件、2.5秒を超えて残ること、一時 status の表示と消去で変わらないこと、解除で件数欄だけ消えることを確認する。
  - 薄い node を選択し、SVG patch と WebGL の選択更新後も濃淡が保持されることを確認する。GraphLink 選択、drag / 編集後の再描画も含む。
  - map 切替と reload は reset。同一 map の View / scope 切替は条件19どおり。保存内容に状態が追加されないことも検査する。
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
  - 左右 top bar 間の配置、CURRENT / 重要度 / 緊急度 / 所属 / 解除、座標不変、status bar、keyboard、選択後の濃淡、SVG / WebGL の実経路を確認する。build 元、配信 bundle、起動先を記録する。
  - **Acceptance:** mock の構造比較と実画面の操作結果がある。fixture 成功を通常 Beta の証拠に代用せず、未確認ならその条件を残す。Final は更新しない。

## Lane fixture の生成と独立した期待値

生成は実装時に専用 script（例 `beta/tests/fixtures/generate_lane_asys_domains.mjs`）で行う。入力は元 `lane_asys.json` と `/Users/akaghef/dev/Akaghef-System/diagrams/akaghef-system-architecture.html`。外部 HTML を実行せず、147〜152行の `m3eNodes` / `systemNodes` / `researchNodes` / `familyNodes` / `engineeringNodes` / `businessNodes` の宣言を読み、M3E / System / Research / Family / Engineering / Business へ対応づける。入力の版・digest と抽出集合を生成 script の検証資料に記録する。CI は生成済み fixture を使用し個人パスへ依存しない。

元 fixture を複製し、`item_` に続く名前と HTML の node id を対応させ、所属する全 Domain 名を上記順のカンマ区切り `attributes.domain` に追加する。DOMAIN レーンの item は自身の名前も必ず含める。参照先不明は生成失敗とし、勝手に名前を推測しない。元 fixture の既存 attributes・node・GraphLink・親子構造・配置を保持する。新 fixture から追加した domain だけを除去すると元 fixture と deep equality になること、元ファイルの digest が変わらないことを検査する。

試験の期待値は、製品の軸定義表・判定関数・生成 script・新 fixture の domain を読んで計算しない。HTML の原文 `researchNodes`（149行）を別途レビューし、試験内の期待集合として固定する：`res, obsidian, chrome, miro, mac, dell, ipad, gd, chats, codex, ha, akos`。fixture との対応には `item_` を付ける。生成物の domain がこの集合と一致することも別に検査する。

フィルタなしで描画される25 item を N、元 fixture の82 GraphLink を G、上記の Research 集合を R とする。期待値はテスト側で元 fixture の端点と confidence から集合演算だけで計算する。

| 操作 | 一致 node | 一致 GraphLink | 薄くする対象 |
|---|---|---|---|
| TO-BE AND 所属=Research | R | G のうち両端が R | node は N\R、link は G\一致集合 |
| CURRENT AND 所属=Research | R ∩ endpoints(L)（L は confidence=`system-evidenced` かつ両端が R の GraphLink） | L | node は N\一致集合、link は G\L |

2026-10-20 に元 fixture と上記集合から静的に計算した期待値は、Research が一致 node 12 / GraphLink 26（薄くする node 13 / GraphLink 56）、CURRENT AND Research が一致 node 2（Mac、Dell）/ GraphLink 1（Mac–Dell）（薄くする node 23 / GraphLink 81）。後者は A-sys の CURRENT × Research と同じ結果である。これは browser 実測ではなく期待値の確認であり、実装担当は試験側の独立計算で再確認する。

比較は computed opacity と件数で行う。元 fixture の confidence / 端点から直接算出し、描画後の active / dim class を期待値には使わない。別の単体入力で「CURRENT 無効時に所属一致の孤立 node が一致する」と「CURRENT 有効時に選択外への確認済み GraphLink しかない node が薄くなる」を検査し、元 fixture を差が出るように変更しない。

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

### Existing Regression

重要度の既存単体試験は style 正規化であり、新しい predicate 試験の代わりにはならない。Lane の既存 opacity > 0 の検査も濃淡の合格根拠にしない。

```bash
npm --prefix beta run build:test
(cd beta && npx vitest run tests/unit/node_draw_contract.test.ts tests/unit/lane_view_projection.test.ts tests/unit/lane_scene.test.ts tests/unit/lane_view_controller.test.ts tests/unit/graph_link_attributes.test.ts tests/unit/graph_link_attributes_api.test.js tests/unit/webgl_scene_tiles.test.ts)
npm --prefix beta run build:browser
npm --prefix beta run test:visual -- tests/visual/workbench_ui.spec.js tests/visual/render_updates.spec.js tests/visual/viewer.visual.spec.js tests/visual/graph_link_attributes.spec.js tests/visual/lane_view.spec.js tests/visual/lane_graphlink_layers.spec.js tests/visual/webgl_projection.spec.js tests/visual/incremental_edit.spec.js tests/visual/viewer_surface_edge_paths.spec.js tests/visual/scatter_surface.spec.js tests/visual/workbench_progressive_nav.spec.js
```

## Verification Limits and Handoff

本草案の検証は参照ソース・コマンド中の既存ファイル・条件網羅・連番・用語・変更範囲・差分の確認。製品 unit / build / Playwright は文書のみのため未実行。実装時に sandbox で Playwright が起動できなければ、結果欄を `未実行（Director 依頼）` とし、該当する上記 spec とエラーを渡す。source inspection や他者の過去の結果を自分の browser 実測として記録しない。

今回の引渡しは3仕様文書と Glossary 2行の commit、緊急度の根拠、未決と検査結果。次は別途指示後の製品実装であり、この文書改訂では fixture・source・mock・通常 Beta を変更しない。
