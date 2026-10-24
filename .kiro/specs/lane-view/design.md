> 2026-10-25 変更（akaghef）: B-7 と IS46（scope でない node を Lane の root にする操作、`MapSurface.displayRootId`）は取り消し。Lane の root は scope の root node。以下の B-7 の記述は経緯として残す。

# Design Document

## Overview

既存の `AppState` と viewer に、GraphLink.attributes の保存と Lane の表示を追加する草案。2026-10-17 に Director 審査済み。Track A は `4327ca0`（GraphLink.attributes の保持）として本流統合済みで、その commit を基準に Track B の実装を承認された。B-7 の保存先は MapSurface 案を採用した。

### Goals

- GraphLink の Content を viewer 読込・既存 API・保存の全経路で保持する。
- 同じ tree と GraphLink を、root 直下の子 node の兄弟順序に沿って配置する。
- 既存の renderer、Progressive Navigation、保存経路を再利用する。
- 最遠の目標の RQ1 / RQ5 / RQ6 に沿って既存 map 上で関係を読めるようにし、別の面への往復を減らす。RQ2 / RQ3 / RQ4 の意味を変えない。

### Non-Goals

対象外は requirements.md の Boundary Context に従う。layout-lab や専用 renderer / page を新設しない。導出値、Inspector、MCP、同期、reification、System subtype は追加しない。

## Boundary Commitments

### Layer ownership

| 操作 | 所有する層と変更 |
|---|---|
| REPLACE | なし。既存 renderer の置換は行わない |
| ADD | shared module `beta/src/shared/lane_layout.ts` の Lane layout strategy。同期の格子並べを行う。`viewer.ts` に算法を置かない |
| KEEP | `retainedSvgScene` / `RetainedSvgScene`、既存 node SVG、GraphLink の LinkStyle classes・矢印・label・LinkPort・Link Route、Surface Progressive Navigation、既存 model / persistence / autosave |
| EXTEND | Lane の列挙、保存設定、root 解決、レーン境界、表示対象、同期の配置結果への接続、Lane だけの visible / hit 層分離 |
| FAIL | GraphLink による段の振分け / 自作の crossing minimisation algorithm、renderer のコピー・fork、新 server / 別 page、@xyflow/react 採用 |

`Pipeline_UI_Reference.md` は一般的な参考であり、このタスクの明示的な層所有を上書きしない。Lane は現在の SVG path を使う。現ソースの `webglSurfaceSupported()` は Tree / Disperse だけが対象なので、Lane を追加しても既存の SVG 選択へ進む。その判定を Lane 対応として WebGL に広げない。Tree / Disperse の現在の renderer 選択は保持する。

### Revalidation Triggers

`MapSurface` / `MapScope` / surface sanitizer、`GraphLink` の読込・書込、layout metric、`LayoutResult`、retained SVG parts、Surface / Node Progressive Navigation が変わった場合に関連試験を再実行する。別の作業との viewer.ts 衝突を避け、A の統合を B の実装開始前に確認する。

## Dependencies

```text
A-1 -> A-2 / A-3 -> A-4 -> Aの検証・Director統合
B-1 -> B-7のroot解決（保存先は採用済み） -> B-2 -> B-3 -> B-4 -> B-5
B-1 -> B-6 -> B-5                  （B-6はB-2から独立）
IS38/40/41/44 -> B-3、IS39 -> B-2   （いずれも決定済み）
```

A と B の意味上の依存はないが、viewer.ts の変更と保存試験を直列化する。B-6 単体の層順試験は配置方式から独立させ、B の実運用確認は全経路の結合後に行う。

## Existing Architecture Analysis

作業開始点は `codex/lane-view`、`4203e85`（Lane 正本を含む dev-beta から作成した作業枝）。以下はこの checkout のソース調査結果であり、稼働測定ではない。

| 境界 | 現在の実装と不足 |
|---|---|
| A-1 | `shared/types.ts:GraphLink`、`browser/viewer.globals.d.ts:GraphLink`、`layout_port.ts:GraphLinkLike` に attributes が無い |
| A-2 | `viewer.ts` の SavedMap 読込で既知フィールドだけを再構築。`normalizeGraphLink()` は spread するが、読込で落ちた値は戻らない |
| A-3 / A-4 | `rapid_mvp.ts` の `_normalizeLink` は spread し、validate は attributes を検証しない。`addLink` と `start_viewer.ts:handleLinkApi` は attributes を渡さない |
| B-1 | 保存値は `tree/system/scatter/logic-chart/timeline`、layout の正規名は Tree/Axial/Disperse/System。Lane だけを加える |
| B-2 | `viewer.ts:buildLayout` と `shared/layout_port.ts:layout` は同期。elkjs 0.11.1 は lockfile にあるが現行配置は使っていない |
| B-3 / B-6 | 現行 GraphLink は visible / hit / label が同じ buffer。`retainedSvgScene.update` は links → overlays → node parts の順 |
| B-7 | `currentScopeRootId()` が表示 root。`MapSurface.scopeId` と `scope.primarySurfaceId` は scope の保存に使う。surface sanitizer は既知フィールドを再構築し、新しい root field は追加だけでは残らない |
| 型の差 | browser の MapSurface は `surfaceView?: {direction, space}` を持つが shared/types.ts には無い。実装時に既存設定の shared 型も揃える必要がある |

正本文書の `Data_Model.md` には初期 Beta の GraphLink layout 非参加が残る。Lane / force の配置入力については新しい Surface View 正本と今回の決定に従う。親子関係・所有権・兄弟順序へ GraphLink を参加させる意味にはしない。文書全体の改訂は今回の範囲外。

## Architecture

### Module Plan

以下は審査時の配置先案。Track B はこの責任分担で実装し、既存 renderer へ接続する。

| 境界 | ファイル案 | 責任 |
|---|---|---|
| A の値検証 | `shared/graph_link_attributes.ts` | strict 書込検証と permissive 読込を区別し、string の保持処理を共用 |
| A の接続 | shared / viewer 型、`rapid_mvp.ts`、`start_viewer.ts`、viewer 読込 | 既存経路に attributes を渡すだけ |
| B の root / 可視入力 | `shared/lane_view.ts` | 選ばれた保存先から root を解決し、子 node / 孫 node、隠れた数、省略 link 数を導出 |
| B の同期配置 | `shared/lane_layout.ts` | 兄弟順序・実寸・direction / space から1行または1列へ格子並べし、LayoutResult を返す。DOM・server・viewer を import しない |
| B の同期接続 | `layout_port.ts` / `layout_bridge.ts` | Lane の列挙と、同期の配置結果を返す呼出。既存 Surface View の同期 contract は維持 |
| B の SVG 層順 | `browser/lane_scene.ts`、既存 GraphLink 生成箇所 | 既存 markup の visible / hit 分離と parts 配列の Lane 分岐。新 renderer を作らない |
| B の操作と保存 | 既存 viewer / workbench、必要なら `browser/lane_view_controller.ts` | 既存イベントを登録、root の指定、保存設定、既存の同期 render / fit。算法は持たない |

viewer.ts の追加は列挙と呼出に限定し、条件14の目安80行をレビューする。計測のためだけに無関係のコードを移動して行数を減らさない。GraphLink markup は同じ生成処理から visible / hit の出力先を分け、複製した生成処理を Lane 用に置かない。

## Track A: GraphLink.attributes

### Contract

既存 `GraphLink` / addLink options に `attributes?: Record<string, string>` を追加する。任意 property のままにし、旧 map の欠如をエラーにしない。`GraphLinkLike` は型の受渡しを揃えるが、属性の値を配置や Style に解釈しない。

| 入力 | サーバー書込 | viewer / JSON 読込 |
|---|---|---|
| 省略 | そのまま受理 | 省略を保持 |
| `{}` / string 値だけの object | defensive copy して保持 | 同じ key / value を保持 |
| mixed object | 4xx、全体を書き込まない | string 値の entry のみ copy |
| null / 配列 / scalar | 4xx、全体を書き込まない | property を除外 |

own enumerable entries を扱い、prototype 由来の値は取り込まない。string を trim / stringify / Style 変換しない。viewer の寛容な sanitizer を model の strict validation より先にサーバー書込へ適用してはならない。

### Flow and Failure

既存 link API → body の attributes 検証 → `RapidMvpModel.addLink` → model validate → 既存 SQLite 保存 → 既存の map 取得、という経路を使う。map 全体の書込も同じ検証を通し、エラー時は永続値と history を変更しない。viewer → sanitizer → AppState.links → node の編集 → autosave → 再読込、および JSON export/import の両方で属性を追跡する。新 DB schema / table / transport を作らない。

## Track B: Root and Persistence (B-7)

### IS46 — 非 scope root の保存先と指定操作（2026-10-17、Director 採用済み）

IS37 は閉じている。ここで審査するのは root が scope でよいかではなく、決定済みの非 scope root を既存のどこへ保存するかである。現行の MapSurface / scope.primarySurfaceId / node attributes を比較した。

**MapSurface に displayRootId を任意追加する案（推奨）。** 既存 MapSurface に `displayRootId?: string` を追加し、scopeId は実際の所属 scope のまま、scope.primarySurfaceId はその Lane surface を選ぶ。Node Progressive Navigation で選択 node に「Lane で表示」を実行し、所属 scope の Lane surface に root を記録する。表示設定を surface に集め、state.nodes / state.links 不変の条件7を維持でき、既存 displayRootId layout option と対応する。型・sanitizer・保存コピー・読込の保持が必要。最初は所属 scope ごとに1つの Lane root を保存し、別 node の指定でそれを更新する。

**node attributes を使う案（不採用）。** node.attributes の既存表示用 namespace に `m3e:surface.lane` の JSON 文字列案 `{direction, space}` を保存する。Node Progressive Navigation から同じ操作を行い、所属 scope の既存 MapSurface を選択状態の保存に利用する。既存 string attributes と node の保存を利用できる一方、root ごとの設定と scope.primarySurfaceId の2箇所を解決し、再読込時の root 選択参照も surface 側に持つ必要がある。Lane 適用時に node.attributes が変わるため、そのままでは条件7と衝突する。新 key は未採択。

Director が MapSurface を使う案を採用したため、以下をその設計として扱う。node attributes 案は採用しない。新たな DC は割り当てない。新しい top-level collection、nodeType、scope、保存 DB は必要ない。

### MapSurface を使う案の操作・解決順

通常の Surface Progressive Navigation → Lane は、現在 scope の既存 Lane surface に有効な displayRootId があれば復元し、初回は現在の scope root node を使う。Node Progressive Navigation →「Lane で表示」は、選択 node が属する現在の scope を owner にして、その node を displayRootId にする。scope の外へ暗黙移動しない。

`currentScopeRootId()` は編集・保存・scope navigation の境界として保つ。配置用 root は `surface.kind === lane ? surface.displayRootId ?? scopeRoot : scopeRoot` で解決し、非 scope node を currentScopeRootId に代入しない。選択 node の子 node をレーン、孫 node を配置対象とする。親子構造、nodeType、scope.rootNodeIds を変更しない。

MapSurface の `surfaceView` は既存の direction / space を使い、新しい field は displayRootId だけとする。Tree へ戻すと Tree の primarySurfaceId を選び、Lane surface の保存設定は残す。Lane に戻ると同じ root / direction / space を復元する。root の変更も既存 undo / autosave の表示設定更新として扱う。

読込・全 map 保存・scoped 保存・既存コピーで displayRootId を落とさない。既存の scoped 保存には、範囲内に完全に入る scope のうち Lane 設定を持つ scope と、その scope の surface 設定を通す。Tree に戻した primarySurfaceId も保持し、他の scope の設定へ書き込まない。不正な Lane root の scoped 書込は保存前に拒否する。clone の node ID remap がある経路では root 参照も既存 nodeViews 等と同時に remap する。MapSurface.scopeId と異なる scope への参照、欠損 root は有効な設定として採用せず、「Lane の root node が見つかりません」等の説明を出し、通常 scope 表示へ戻れるようにする。無効参照を勝手な別 node へ永続化しない。scope 内の新しい root を明示指定すれば復帰できる。

## Track B: Visible Input (B-3)

root は箱を描かず、現在の scope / map 名と同様の人に読める表示で対象を伝える。root 直下の子 node の children[] 順をレーン順にし、子 node 自体はレーンの境界と見出しとして既存の文字描画へ渡す。孫 node を既存の node SVG に渡す。必要な header metric も配置入力に含める。見出し・node の選択と表示条件8の読み方は requirements.md の条件8の明確化は Director が採択済み。

孫 node より深い node はその孫 node の下で表示上 collapse し、既存の collapse 数表示を再利用する。孫 node の元の collapsed 値は書き換えない。明示的に collapse された子 node はレーンを残して中身を畳み、元の Topology を保つ。

表示対象の孫 node の集合を作り、両端がこの集合に属する GraphLink を配置・描画へ渡す。root に触れる link、子 node に触れる link、範囲外 / 他 scope / 隠れた子孫へ触れる link は描かない。map.state.links のうち少なくとも片端が当該 root の部分木に入る link を検討対象とし、その中の非表示 link を link ごとに1回数える。別の無関係な部分木だけの link は本数に含めない。「表示しない GraphLink: N」および隠れた node 数は既存の表示部品に文字で載せ、ID を載せない。GraphLink の削除・集約・保存は行わない。

空の root、孫 node のないレーン、全 link 省略でも人に読める空表示を保つ。空ラベルの表示は「名称未設定」などの固定文言で補い、raw ID / hash / 生成 suffix を代用しない。図式に自動コードを付けない。

## Track B: 格子並べ（B-2）

### IS39 — Lane と System の区別（2026-10-18、Director 差し替え）

2026-10-17に採用した OP16 の elkjs layered + partitioning は撤回する。layered は GraphLink の向きから段を決める System 側の方式であり、partition が別々の帯に入るだけでは Lane にならない。旧条件6は帯の分離だけを検査し、各帯での1行 / 1列と GraphLink 除去後の座標不変を欠いていた。このため承認済みの旧実装が試験を通っても、Lane の意味を満たさなかった。旧 Track B は `91541a1` で取り消され、正本更新 `ce015e6` と steering 3a に従って本節と条件6を差し替える。新しい tracking ID は割り当てない。

### 同期入力と1行 / 1列（2026-10-19 mock の構造）

`shared/lane_layout.ts:computeLaneLayout(input): LayoutResult` の配置入力はroot、root.children[]順のレーン、各レーンの孫 node の兄弟配列、既存の文字計測による寸法、right/down、spaceだけとする。GraphLink は配置入力型に入れず、位置に関与しない。隠れた数と省略 link 数は配置後に表示 metadata として付加する。

Directorの訂正により、受け入れ条件はmockの構造に限る。カード寸法、色、角丸、弧の膨らみをgen.pyの数値と合わせる契約は取り消す。共通rendererと文字計測の既定を使い、孫 node ごとの実寸を保持する。

- downは全帯を同じ高さで上から並べ、各帯の中心yに孫 node を1行で置く。見出し列の右の共通領域を孫数で等分し、区画の中央に孫 node の中心を合わせる。
- rightは全帯を同じ幅で左から並べ、各帯の中心xに孫 node を1列で置く。見出しの下の共通領域を孫数で等分し、区画の中央に合わせる。
- 共通領域は最大孫数と最大実寸から、全区画で文字と矩形が重ならない長さを確保する。各々のw/hを固定寸法に上書きしない。帯の太さも最大実寸と余白から求める。空レーンは帯を残し、AppStateへplaceholderを追加しない。
- tight / normal / looseで区画と帯の余白を変える。レーン順・孫の順は兄弟配列だけから取り、GraphLinkの全除去で全座標不変を検査する。段の振分け、交差最小化、後処理の衝突解決は行わない。

### 共通描画の既定を使う（2026-10-19、Director 訂正）

`lane_scene.ts:laneNodeInput` は既存NodeDrawInputへ枠を描くための通常styleと中央揃えを渡すだけで、node SVGを生成しない。既存の明示style / SurfaceNodeView.shapeは尊重する。NodeDrawStyleの角丸半径追加とshapeRxの変更は撤回し、node_draw_svg.tsを変更前と完全一致に戻す。選択やdragの強調も既存の共通CSSを使う。孫 node が帯と見分けられ、ラベルが重ならなければよく、枠の幅や角丸の数値は検査しない。

`lane_scene.ts:laneFrames` は帯・root見出し・レーン名と孫数をsceneのframesへ渡す。rootの箱と親子edgeは描かない。色は見分けやすくするための表示上の選択であり、mockと一致させる条件ではない。

接続辺は共通 `edge_port.ts:selectPorts` の Lane ケースで相手レーンに向ける。downで上 / 下、rightで左 / 右。同じ帯ならdownは両端bottom、rightは両端right。sourceSide / targetSide入力で保存済みLinkPortを片端ずつ優先し、autoは自動選択とする。`lane_layout.ts:laneLinkGeometry` はEdgePortsだけを返し、パスやhandleを計算しない。targetの3pxの余白も除去し、両端を辺の中央に置く。

任意handle長と `shared/graph_link_geometry.ts` の新設は撤回する。edgePortNormal、graphLinkControlPoints、graphLinkPathWithPorts、graphLinkLabelPointWithPorts、cubicPointAtHalfはviewer.tsの元の場所と実装へ戻す。共通GraphLinkのSVG path / marker / LinkStyle class / labelと、straight / orthogonal / simple-bezierのroute選択も既存のまま。同じ帯の弧はsimple-bezierの既存の計算が描き、mockの膨らみ量を入力しない。Laneのvisibleはnode後・pointer-eventsなし、hitはnode前という層分離を維持する。

### 既存の同期 render への接続

controller の `prepare()` は表示rootを検証し、表示対象と実寸を求め、その場で格子並べを呼ぶ。結果を `layout_port.layout(..., "Lane", {laneResult})` から既存SVGへ渡す。通常のSurface切替・root変更・direction変更は同じ同期render / fit / 保存を使う。worker、Promise、非同期cache、世代照合、pending表示は不要なので除去する。保存先MapSurfaceとSurface / Node Progressive Navigationは維持する。

root欠損や不正寸法は既存statusへ説明し、failedとして旧sceneの編集を抑止する。Treeへ戻す操作は保持し、不正参照を別のrootへ永続化しない。非Laneの描画経路・同期layout contractを変更しない。

### 検証

`lane_layout.test.ts` はfirst-sliceとA-sysをright/downで配置し、各帯の中心線一致、兄弟順序、帯順序、最大実寸に基づく帯の太さ、全矩形非重複、GraphLink全除去前後の全座標一致、入力不変を独立計算で検査する。旧ELK実装に先に当てたところ、この4ケースは失敗した。A-sysは6レーン、孫node数3/3/5/6/5/3、25孫・82link。`lane_layout_performance.test.ts` はA-sysと100孫/200linkの両directionで、表示対象生成と実配置の開始から同期結果まで1秒を検査する。mockや成功cacheを計測しない。

同期controllerの試験はroot / map / directionの即時反映、不正rootで古い結果を使用しないこと、Node Progressive Navigationの既存root操作を検査する。視覚試験は既存の選択・F2編集・drag / GraphLink描画・保存の条件7〜18を維持し、A-sysの実viewer中心線検査を追加する。workerのPlaywright実行はsandbox制約により `--list` まで、Directorがheadlessと通常Betaで受け入れを確認する。

## Track B: Existing SVG Rendering (B-3 / B-6)

既存の GraphLink path / marker / label の1回の生成から visible と hit の2つの buffer を返す。LinkStyle classes、色、保存 direction に応じた marker、label text、既存 LinkPort / Link Route の計算を共用する。Lane の親子 edge adapter は呼ばない。B-1 の union 拡張に伴う EdgePort / node drawing の exhaustive case は Lane の「親子 edge を出さない」case として扱い、偽の EdgeDirection を作らない。

```text
Lane:   defs -> frames / lane boundaries -> edgesなし -> guides
        -> graph-link-hit -> overlays / drag overlays -> node parts
        -> GraphLink visible stroke / markers / label -> annotations
Others: 現行 parts 順（links = visible + hit + label -> overlays -> node parts）
```

Lane の visible wrapper と内部の stroke / label background / text を pointer-events=none とし、既存 CSS の子要素 rule による上書きも試験する。hit path は既存の選択処理と stroke hit area を保持する。既存の選択時 port controls は操作用 overlay として維持し、visible link の非操作層には移さない。

`RetainedSvgScene` 自体を fork せず、既存 update に渡す parts の組立だけを Lane で変える。Lane→Tree では Lane 専用 parts が除去され、Tree の元の link buffer 順に戻る。層順はスクリーンショットだけでなく DOM の前後、computed pointer-events と実 pointer 操作で検証する。線が途中 node の上を通るケースは既存の straight Link Route と実 fixture で作り、layout 座標や solver を差し替えない。

## Requirements Traceability

| 契約 | 実装境界 | Director 条件 |
|---|---|---|
| A-1–A-4 | 型、読込、model、既存 API、保存 | 1–5 |
| B-1 / B-7 | 種類、MapSurface、root、操作、復元 | 7 / 9–11 / 14、B-7 の追加検証は条件10として採択済み |
| B-2 | shared の同期格子並べ、同期 adapter | 6 / 7 / 13 / 14 |
| B-3 / B-4 | 既存 SVG と Progressive Navigation | 8–11 / 14 |
| B-6 | visible / hit parts | 16–18 |
| B-5 | unit / 実 server / browser / 通常 Beta | 1–18、特に12 / 15 |

## Risks and Mitigations

| リスク / 未決 | 対応と停止条件 |
|---|---|
| IS46 の保存先 | MapSurface を使う案を採用済み。Track B の go-ahead まで B-7 の保存実装を始めない |
| LaneとSystemの混同 | 中心線1列とGraphLink全除去後の全座標一致をfirst-slice/A-sysの両directionで検査する |
| root / map / directionの切替 | 同期controllerでその場の入力だけを使い、不正rootでは結果を渡さない |
| 実測と1秒 | A-sysと100/200の両fixture・両directionで同期計算を計測する。閾値を変更しない |
| 条件7 / 8 / 10 の読み方 | Director 採択済み。共有ノートの更新済み原文を保持する |
| 条件14と既存 viewer の大きさ | 新規の算法・controller は外に置く。80行目安は実 diff で確認し、行数だけを満たす移動を行わない |
| 正本文書の旧記述 | map_layout_modes の後続決定を優先。ADR_013 / Data_Model 等の広い改訂を無断で取り込まない |

## Director Review Gate

2026-10-17、Director が IS46 の MapSurface 案、条件7の children[] の所有 node の明確化、条件8の表示対象の明確化、条件10への B-7 検証追加を採択した。18条件の削除、閾値変更、fixture-only への格下げは提案しない。Track A は ORRERY Mail の go-ahead を受領済み。Track B は A の統合後の別指示まで開始しない。本流統合・push・通常 Beta 確認の所有者は今回の handoff に従い Director。

## Implementation Verification Notes — 2026-10-18

基準は `4327ca0`（GraphLink.attributes の保持）。Directorが `ce015e6` 上で `git revert --no-commit 91541a1` を実行し、旧Track Bを未commitで復元した。その上で配置だけを本書の格子並べへ差し替える。elkjsの呼出・worker宣言・async cache専用試験と、elkjs外部型用のskipLibCheck追加を除去した。package.json / lockfile /依存のインストール状態は変えない。実装・検証結果と未確認事項はtasks.mdに記録する。

2026-10-19: mockの提示後、Directorは角丸とhandleを含む細部の一致も一度承認したが、akaghefの指摘で構造だけを条件にするよう訂正した。共通拡張と固定寸法の検査を撤回し、等分区画・接続辺・弧・見出しと孫数を維持する。旧合格や今回の単体試験を、Directorの画像による構造照合の代わりに扱わない。
