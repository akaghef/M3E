# Design Document

## Overview

既存の `AppState` と viewer に、GraphLink.attributes の保存と Lane の表示を追加する草案。実装承認ではない。Track A を先に統合し、Track B は B-7 の保存先を Director が選んでから進める。

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
| ADD | shared module `beta/src/shared/lane_layout.ts` の Lane layout strategy。既存依存 elkjs を呼ぶ。`viewer.ts` に算法を置かない |
| KEEP | `retainedSvgScene` / `RetainedSvgScene`、既存 node SVG、GraphLink の LinkStyle classes・矢印・label・LinkPort・Link Route、Surface Progressive Navigation、既存 model / persistence / autosave |
| EXTEND | Lane の列挙、保存設定、root 解決、レーン境界、表示対象、非同期結果の再描画、Lane だけの visible / hit 層分離 |
| FAIL | 自作 Lane / crossing minimisation algorithm、renderer のコピー・fork、新 server / 別 page、@xyflow/react 採用 |

`Pipeline_UI_Reference.md` は一般的な参考であり、このタスクの明示的な層所有を上書きしない。Lane は現在の SVG path を使う。現ソースの `webglSurfaceSupported()` は Tree / Disperse だけが対象なので、Lane を追加しても既存の SVG 選択へ進む。その判定を Lane 対応として WebGL に広げない。Tree / Disperse の現在の renderer 選択は保持する。

### Revalidation Triggers

`MapSurface` / `MapScope` / surface sanitizer、`GraphLink` の読込・書込、layout metric、`LayoutResult`、retained SVG parts、Surface / Node Progressive Navigation が変わった場合に関連試験を再実行する。別の作業との viewer.ts 衝突を避け、A の統合を B の実装開始前に確認する。

## Dependencies

```text
A-1 -> A-2 / A-3 -> A-4 -> Aの検証・Director統合
B-1 -> B-7の保存先決定・root解決 -> B-2 -> B-3 -> B-4 -> B-5
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

以下は実装時の配置先案であり、Phase 1 では作成しない。既存の同等 module があればそこへ追加する。

| 境界 | ファイル案 | 責任 |
|---|---|---|
| A の値検証 | `shared/graph_link_attributes.ts` | strict 書込検証と permissive 読込を区別し、string の保持処理を共用 |
| A の接続 | shared / viewer 型、`rapid_mvp.ts`、`start_viewer.ts`、viewer 読込 | 既存経路に attributes を渡すだけ |
| B の root / 可視入力 | `shared/lane_view.ts` | 選ばれた保存先から root を解決し、子 node / 孫 node、隠れた数、省略 link 数を導出 |
| B の非同期配置 | `shared/lane_layout.ts` | ELK graph 変換、elkjs 呼出、結果検証、LayoutResult 変換、cache / generation 管理。DOM・server・viewer を import しない |
| B の同期接続 | `layout_port.ts` / `layout_bridge.ts` | Lane の列挙と、キャッシュ済み結果を返す呼出。既存 Surface View の同期 contract は維持 |
| B の SVG 層順 | `browser/lane_scene.ts`、既存 GraphLink 生成箇所 | 既存 markup の visible / hit 分離と parts 配列の Lane 分岐。新 renderer を作らない |
| B の操作と保存 | 既存 viewer / workbench、必要なら `browser/lane_view_controller.ts` | 既存イベントを登録、root の指定、保存設定、完了時 scheduleRender。算法は持たない |

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

### IS46 — 非 scope root の保存先と指定操作（Director 決定待ち）

IS37 は閉じている。ここで審査するのは root が scope でよいかではなく、決定済みの非 scope root を既存のどこへ保存するかである。現行の MapSurface / scope.primarySurfaceId / node attributes を比較した。

**MapSurface に displayRootId を任意追加する案（推奨）。** 既存 MapSurface に `displayRootId?: string` を追加し、scopeId は実際の所属 scope のまま、scope.primarySurfaceId はその Lane surface を選ぶ。Node Progressive Navigation で選択 node に「Lane で表示」を実行し、所属 scope の Lane surface に root を記録する。表示設定を surface に集め、state.nodes / state.links 不変の条件7を維持でき、既存 displayRootId layout option と対応する。型・sanitizer・保存コピー・読込の保持が必要。最初は所属 scope ごとに1つの Lane root を保存し、別 node の指定でそれを更新する。

**node attributes を使う案。** node.attributes の既存表示用 namespace に `m3e:surface.lane` の JSON 文字列案 `{direction, space}` を保存する。Node Progressive Navigation から同じ操作を行い、所属 scope の既存 MapSurface を選択状態の保存に利用する。既存 string attributes と node の保存を利用できる一方、root ごとの設定と scope.primarySurfaceId の2箇所を解決し、再読込時の root 選択参照も surface 側に持つ必要がある。Lane 適用時に node.attributes が変わるため、そのままでは条件7と衝突する。新 key は未採択。

MapSurface を使う案を採る前提で以下を具体化した。Director が選ぶまでは draft contract であり、DC を新設して確定扱いしない。条件7を維持できるため MapSurface を使う案を推奨する。新しい top-level collection、nodeType、scope、保存 DB は必要ない。

### MapSurface を使う案の操作・解決順

通常の Surface Progressive Navigation → Lane は、現在 scope の既存 Lane surface に有効な displayRootId があれば復元し、初回は現在の scope root node を使う。Node Progressive Navigation →「Lane で表示」は、選択 node が属する現在の scope を owner にして、その node を displayRootId にする。scope の外へ暗黙移動しない。

`currentScopeRootId()` は編集・保存・scope navigation の境界として保つ。配置用 root は `surface.kind === lane ? surface.displayRootId ?? scopeRoot : scopeRoot` で解決し、非 scope node を currentScopeRootId に代入しない。選択 node の子 node をレーン、孫 node を配置対象とする。親子構造、nodeType、scope.rootNodeIds を変更しない。

MapSurface の `surfaceView` は既存の direction / space を使い、新しい field は displayRootId だけとする。Tree へ戻すと Tree の primarySurfaceId を選び、Lane surface の保存設定は残す。Lane に戻ると同じ root / direction / space を復元する。root の変更も既存 undo / autosave の表示設定更新として扱う。

読込・全 map 保存・scoped 保存・既存コピーで displayRootId を落とさない。clone の node ID remap がある経路では root 参照も既存 nodeViews 等と同時に remap する。MapSurface.scopeId と異なる scope への参照、欠損 root は有効な設定として採用せず、「Lane の root node が見つかりません」等の説明を出し、通常 scope 表示へ戻れるようにする。無効参照を勝手な別 node へ永続化しない。scope 内の新しい root を明示指定すれば復帰できる。

## Track B: Visible Input (B-3)

root は箱を描かず、現在の scope / map 名と同様の人に読める表示で対象を伝える。root 直下の子 node の children[] 順をレーン順にし、子 node 自体はレーンの境界と見出しとして既存の文字描画へ渡す。孫 node を既存の node SVG に渡す。必要な header metric も配置入力に含める。見出し・node の選択と表示条件8の読み方は requirements.md の変更提案を Director が判断する。

孫 node より深い node はその孫 node の下で表示上 collapse し、既存の collapse 数表示を再利用する。孫 node の元の collapsed 値は書き換えない。明示的に collapse された子 node はレーンを残して中身を畳み、元の Topology を保つ。

表示対象の孫 node の集合を作り、両端がこの集合に属する GraphLink を配置・描画へ渡す。root に触れる link、子 node に触れる link、範囲外 / 他 scope / 隠れた子孫へ触れる link は描かない。map.state.links のうち少なくとも片端が当該 root の部分木に入る link を検討対象とし、その中の非表示 link を link ごとに1回数える。別の無関係な部分木だけの link は本数に含めない。「表示しない GraphLink: N」および隠れた node 数は既存の表示部品に文字で載せ、ID を載せない。GraphLink の削除・集約・保存は行わない。

空の root、孫 node のないレーン、全 link 省略でも人に読める空表示を保つ。空ラベルの表示は「名称未設定」などの固定文言で補い、raw ID / hash / 生成 suffix を代用しない。図式に自動コードを付けない。

## Track B: elkjs Layout (B-2)

### ELK graph と変換

`lane_layout.ts` は flat な ELK graph に可視孫 node の実測 width / height を入れ、各 node に親である root 直下の子 node の index を `org.eclipse.elk.partitioning.partition` として割り当てる。GraphLink は layout-only edge とし、同じレーン内、逆向き、飛び越し、多重関係を含める。direction=none の場合も保存済み source / target を layout の入力にするだけで、矢印は保存 direction に従う。ELK 内部の cycle breaking は元の GraphLink を変更しない。

| ELK option | 設定 |
|---|---|
| `org.eclipse.elk.algorithm` | `layered` |
| `org.eclipse.elk.direction` | Lane right → `RIGHT`、down → `DOWN` |
| `org.eclipse.elk.partitioning.activate` | `true` |
| 各配置対象の `org.eclipse.elk.partitioning.partition` | `root.children[]` の0始まりの位置。全 node に設定 |
| `org.eclipse.elk.separateConnectedComponents` | `false`。別成分の packing がレーン順を変えないようにする |
| `org.eclipse.elk.randomSeed` | 固定値。座標の安定性に使い、兄弟順序の代用にしない |
| `org.eclipse.elk.spacing.nodeNode` | 同じレーン内の間隔 |
| `org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers` | partition をまたぐ間隔。境界余白を含む |

space の初期案は tight / normal / loose の順に、nodeNode を 12 / 24 / 40、nodeNodeBetweenLayers を 32 / 56 / 88（world 座標）とする。両方を必ず変える。既存 tuning に対応値があれば再利用し、数値の見た目調整は配置の正否・1秒の基準を変えずに行う。

空のレーンには layout-only の不可視 placeholder を1個入れ、同じ partition を割り当て、見出しの実寸と空の境界の大きさを確保する。これは ELK 入力だけの要素で、AppState.nodes / links と node hit target へ追加しない。孫 node のない root では空表示を返す。

結果の rectangle は ELK の x / y（左上）から既存 LayoutNodePosition の x（左端）/ y（中心）へ `y + height / 2` で変換する。配置座標と実寸から各 partition の帯の範囲を算出し、down では全帯で共通の横幅、right では共通の縦幅を使う。見出しは down では孫 node 領域の左、right では上に、測定済みの共通余白を確保する。行列の計算、node の並べ直し、個別の衝突解消算法は追加しない。境界・見出しの寸法算出と全体平行移動は描画用変換に限る。

ELK へ渡す前に header / boundary 用余白を spacing / padding に含める。出力では down の partition の y 範囲、right の x 範囲が兄弟順に互いに交差せず、孫 node の矩形が重ならないことを検証する。逆向き・循環・非連結を含む実 ELK 試験で成り立たなければ library 設定の不足として報告する。自作 grid、partition の手動並替え、link 削除で補修して受け入れ成功にしない。

ELK は座標を計算するライブラリであり描画層ではない。返された edge の bend points は今回の GraphLink 描画に採用しない。既存 Link Route が見える経路を決めるため、ELK が edge の重なりを減らしても、描画 path が node を横切らないとは主張しない。IS45 はこの場合も必要になる。

### 非同期結果と同期 layout/render

shared の配置処理は `computeLaneLayout(input): Promise<LayoutResult>` を持ち、cache を所有する controller は同期の `read(input)` から `pending / ready / failed` と、あれば最後に完了した結果を返す。これらは API 識別子の案であり製品用語を増やすものではない。layout_port の既存 `layout()` を async に変更しない。

cache key は map の実体と root、順序付き子・孫 node、実寸、可視 collapse 状態、配置対象 GraphLink の endpoint、direction、space、ELK 設定版を含める。savedAt だけを key にしない。色・選択・pan・zoom は再計算理由にしない。同じ入力の render は同じ promise を再利用し、成功結果を保持する。cache は viewer の寿命内だけで、map に保存しない。

pending 中は retainedSvgScene の更新自体を延期し、直前の完了済み scene に Lane の新しいフィルター・層順だけを先に適用しない。ready のときに root / 表示対象 / geometry / 層順を一度に切り替える。別 map の古い scene を再利用せず、その場合は既存の空表示にする。

| 状態 | 同期 render の動作 |
|---|---|
| ready | cached LayoutResult を既存 renderer に渡す |
| pending、同じ node 集合の完了済み表示あり | 完了済みの scene を保ち「Lane を配置中」と示す。現在の方向・順序への更新完了とは扱わない。古い位置で構造編集を確定しない |
| pending、初回または別の node 集合 | 直前の完了済み Surface View を一時表示、なければ既存の空表示と status。新しい仮 Lane 配置は生成しない |
| pending の計算が1秒を超過 | 既存 status に遅延を示し、同じ計算を継続する。100孫/200 link の受け入れ試行では条件13の失敗を記録し、後から描画できても成功へ変更しない |
| failed | 完了済み表示または空表示を保持し、既存 status に失敗を示す。明示再試行か入力変更で再計算 |

ELK が resolve したら cache key と generation、active map / surface / root を照合し、合致する結果だけ保存して既存 `scheduleRender()` を1回呼ぶ。古い promise が後から resolve / reject しても新しい表示に反映しない。unload、root 削除、View 切替で generation を失効させ、worker を所有していれば既存 lifecycle に合わせて終了する。pending 表示中は pan を維持し、selection は現在の map と有効な node 集合が一致する場合だけ許可する。古い図に対する drag / edit / reparent の開始は抑止し、完了後に既存の操作へ戻す。

browser の呼出は `elkjs/lib/elk-api` と既存 Vite の worker asset 配信を使い、`workerFactory` で同じ依存の worker を起動する案を第一候補とする。Node の純粋試験は同じ graph 変換を `elkjs/lib/elk.bundled.js` に渡す。worker の URL / import 互換性は実装の最初に build で検証し、不足があれば正確な extension / config の変更案を Director に返す。独自 server や別 renderer で代替しない。

1秒の計測は実寸入力を受けた配置要求の開始から graph 作成・ELK Promise 解決・検証・LayoutResult 変換まで。成功キャッシュ、mock、pending 表示の速さを計測対象の代用にしない。初回 import / worker 起動の時間は別に記録し、除外で実用上の遅延を隠さない。全計算が1秒を超えればその事実も報告する。実機・バージョン・試行条件を残す。

### 一次資料

2026-10-17 に確認した仕様から上記の設定と非同期接続を設計した。partition の全入力に対する順序保証は M3E 側の実 ELK 試験で検証する。以下の説明だけを合格証拠にしない。

- [ELK Layout Partitioning](https://eclipse.dev/elk/reference/options/org-eclipse-elk-partitioning-activate.html): partition を有効化し、全 node に割り当てる必要がある場合を明記。
- [ELK Layout Partition](https://eclipse.dev/elk/reference/options/org-eclipse-elk-partitioning-partition.html): partition index による方向上の順序。
- [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html): layered と対応する配置 option。
- [elkjs API](https://github.com/kieler/elkjs#api): layout の Promise と worker 接続。

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
| B-1 / B-7 | 種類、MapSurface、root、操作、復元 | 7 / 9–11 / 14、B-7 の追加検証は採択待ち |
| B-2 | shared の実 ELK、cache、同期 adapter | 6 / 7 / 13 / 14 |
| B-3 / B-4 | 既存 SVG と Progressive Navigation | 8–11 / 14 |
| B-6 | visible / hit parts | 16–18 |
| B-5 | unit / 実 server / browser / 通常 Beta | 1–18、特に12 / 15 |

## Risks and Mitigations

| リスク / 未決 | 対応と停止条件 |
|---|---|
| IS46 の保存先 | MapSurface を使う案を推奨。Director 決定まで B-7 の保存実装を始めない |
| ELK partition と逆向き / 循環 / 空レーン | 実ライブラリの試験を先に置く。不足は配置能力の gap として報告し、手作業の配置へ逃げない |
| stale promise / render loop | 完全な入力 key、世代照合、promise の共有、失敗の保持で試験する |
| worker 配信と1秒 | build と実 ELK 計測を独立に行い、どちらかの失敗を単体試験で代用しない |
| 条件7 / 8 / 10 の読み方 | requirements.md の提案を Director が判断。元の18条件は編集しない |
| 条件14と既存 viewer の大きさ | 新規の算法・controller は外に置く。80行目安は実 diff で確認し、行数だけを満たす移動を行わない |
| 正本文書の旧記述 | map_layout_modes の後続決定を優先。ADR_013 / Data_Model 等の広い改訂を無断で取り込まない |

## Director Review Gate

今回必要な判断は IS46 の2案、条件7の children[] の所有 node の明確化、条件8の表示対象の明確化、条件10への B-7 検証追加である。18条件の削除、閾値変更、fixture-only への格下げは提案しない。Director の審査と ORRERY Mail の実装 go-ahead を受けてから tasks.md を実行する。本流統合・push・通常 Beta 確認の所有者は今回の handoff に従い Director。
