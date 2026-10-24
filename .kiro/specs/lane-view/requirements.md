# Requirements Document

## Project Description (Input)

**lane-view** — GraphLink.attributes の保存経路と Lane Surface View の最初の実装範囲。

**(a) 誰の課題か**
akaghef、Director、Codex worker。同じ map の root node、root 直下の子 node、孫 node、孫 node 間の GraphLink を、既存 viewer の Lane で読みたい。root node は scope でなくてもよい（DC30）。

**(b) 現状**
Lane と GraphLink.attributes は正本文書にあるが、対象ソースには未実装である。viewer の読込が GraphLink の既知フィールドだけを再構築するため attributes が消える。Surface View の保存と表示 root は scope 単位に結び付いており、非 scope node を Lane の root として指定・復元できない。

**(c) 変えたいこと**
Track A で任意の `Record<string, string>` を既存の GraphLink 保存経路に通す。Track B で shared 側の同期の格子並べを追加し、既存の SVG 描画、GraphLink 描画、Surface Progressive Navigation、保存経路を Lane の場合だけ拡張する。A を先に統合する。

> 2026-10-25 変更（akaghef）: Lane は scope の Surface View とし、root はその scope の root node にする。B-7（scope でない node を root にする操作と `MapSurface.displayRootId`）と IS46 の採用は取り消し、条件10の「scope でない node を root に指定した場合も…」を削除した。
>
> Status: 2026-10-18、Director が条件6とIS39を格子並べへ差し替え。旧 Track B `d42244f`（elkjs layered による Lane）は `91541a1` で revert 済み、正本更新 `ce015e6` に従って再実装する。2026-10-17、Director が草案を審査済み。Phase 1 の文書を commit 済み。IS46 の MapSurface 案と条件7 / 8 / 10の明確化を採用。Track A は `4327ca0`（GraphLink.attributes の保持）として本流統合済み。Track B の task 7〜16の実装 go-ahead を受領し、worker の検証と Director の独立 browser 検証を進めている。commit / 統合 / push は Director が担当する。

## Boundary Context

| 区分 | 範囲 |
|---|---|
| Track A | A-1 型、A-2 viewer / JSON import 読込、A-3 サーバー検証、A-4 既存 link 作成 API |
| Track B | B-1 種類の列挙、B-2 同期の格子並べ、B-3 表示条件、B-4 Surface Progressive Navigation、B-5 試験、B-6 GraphLink 層順、B-7 非 scope root の保存と指定操作 |
| 今回の正本修正 | `docs/03_Spec/map_layout_modes.md` の Lane の edge option を除去。Glossary の EdgeStyle 説明を整合させる |
| 対象外 | 他端末・同期、M3E MCP GraphLink 操作、attributes→LinkStyle 写像、Inspector の GraphLink 一覧、導出値の表示、selected-path focus、Radial、他の Surface View 保存値の改名、System subtype、GraphLink の実体化、.mm / Markdown GraphLink 出力、Final |

Binding sources は `docs/03_Spec/map_layout_modes.md`、`Data_Model.md`、`docs/00_Home/Glossary.md`、`docs/09_Decisions/ADR_013_Lane_Surface_View.md`、`docs/04_Architecture/Pipeline_UI_Reference.md`、`.kiro/steering/*` と、Director handoff の `lane-view-first-slice.md` / `lane-view-decisions.md`（2026-10-17）である。hand-off の末尾「確定」を未決欄より優先する。

`Pipeline_UI_Reference.md` の一般案にある @xyflow/react / 新規 preview route は今回に適用しない。既存 viewer をそのまま成果物の表示面に使う。ADR_013 の当初の edge option 記述には、2026-10-17 の後続決定を map_layout_modes.md に反映する。許可外の文書や他機能 spec は変更しない。

## Product and Operations Context

現在の主戦場は S17、保存の信頼性は S3。Lane は同じ map で知識・作業間の関係を読み、別の面へ移る注意を減らすための Surface View である。最遠の目標の RQ1 / RQ5 / RQ6 に寄与し、RQ2 の human / AI agent 対称性を崩さず、RQ3 / RQ4 の観測値と正本の境界を変更しない。Telemetry の保存や接続は実装しない。`.kiro/steering/product.md` に残る以前の重点より `Current_Status.md` を優先する。Lane の今回の投資は akaghef の明示指示によるもので、他の凍結 Surface View は回帰確認だけ行う。

Surface View は `Tree / Axial / Radial / Disperse / System / Lane`。`edge` は親子関係、`EdgeStyle` は親子 edge の描画指定、`GraphLink` は非木の関係、`LinkStyle` はその線種として区別する。root 直下の子 node / 孫 node 以外の呼称を新設しない。View 切替は node・GraphLink・兄弟順序・scope 境界を変更しない。

## Requirements

以下は実装契約の分解であり、後掲の Director 所有の受け入れ条件を置換しない。

### Requirement 1: GraphLink.attributes の型と保存（Track A）

**Objective:** 関係に付随する Content を、既存の編集・保存・JSON 往復で失わずに保持する。

#### Acceptance Criteria

- A-1: shared / viewer の GraphLink と `GraphLinkLike` に `attributes?: Record<string, string>` を通す。省略した旧データを受け付け、値を LinkStyle に写像しない。
- A-2: viewer の map 読込と JSON import は string 値だけを残す。無関係の node 編集、autosave、JSON export/import、サーバー再読込で保持する。通常の node attributes と混同しない。
- A-3: 書込のサーバー境界では、省略または string 値だけを持つ object を受け付ける。null、配列、scalar、非 string 値を含む object を 4xx で拒否し、書込や部分保存をしない。viewer の寛容な読込による値の除外と、サーバーの厳格な書込検証は別経路とする。
- A-4: 既存 `POST /api/maps/:mapId/links` が attributes を既存 model と保存経路へ渡す。新しい API / サーバー / MCP tool は作らない。attributes の無い link の既存挙動を保つ。

### Requirement 2: Lane の保存と root（Track B: B-1 / B-7）

**Objective:** 図式の root を scope に限定せず、既存の表示設定として Lane を指定・復元できるようにする。

#### Acceptance Criteria

- `lane` を既存の保存値・読込・列挙へ追加し、未知値を Tree へ落とす既存分岐で Lane が消えないようにする。他の種類の保存値は改名しない。
- Lane の direction は `right / down`、space は `tight / normal / loose`。初期値は既存の既定と同じ `right / normal`。Lane には edge option を提示しない。
- root は図式の root node。scope である必要はない。scope の所有・保存・編集境界と、配置入力の root を分ける。暗黙の scopen や node の複製を行わない。
- 非 scope root の保存先と指定操作は design.md の IS46 の MapSurface に displayRootId を任意追加する案を Director が採用した。node attributes 案は不採用。Track B の go-ahead まで保存形を実装しない。
- 再読込で scope の Lane / direction / space と選択した非 scope root を復元する。root が失われた場合は人に読める説明を出し、他の node を root に書き換えない。

### Requirement 3: 同期の格子並べ（B-2）

**Objective:** 孫 node の兄弟順序とラベルの実測寸法だけで、各レーンの中心線上の等分区画へ配置する。

#### Acceptance Criteria

- shared module の格子並べは同期で LayoutResult を返す。配置入力は root / 順序付きレーンと孫 node / 実寸 / direction / space。GraphLink を配置入力にしない。
- down は root.children[] の順に帯を上から並べ、各帯の全孫 node を同じ中心 y の1行に孫の兄弟順で並べる。right は帯を左から並べ、同じ中心 x の1列に兄弟順で並べる。
- 2026-10-19 の訂正に従い、mock は構造の決まりだけを条件とする。孫 node のラベルは既存の文字計測・折返し・寸法を用い、等分区画に収まる共通の領域と帯幅を確保する。space は帯の中心線間と同じ帯の孫 node 間隔の両方を変える（IS44）。矩形を重ねない。
- 孫 node 間の全 GraphLink を除去する前後で、全ての孫 node の座標が完全一致することを独立試験で検査する。逆向き・循環・飛び越しの関係も位置を決めない。
- elkjs layered / flow、worker、非同期 cache、pending の仮表示を使わない。GraphLink の向きに基づく段の振分けや交差最小化を追加しない。
- 100 孫 node / 200 GraphLink と A-sys（6レーン・25孫・82 GraphLink）の両fixtureで、right/downの同期配置を1秒以内に終える。閾値は維持する。

### Requirement 4: 既存描画と Lane の表示条件（B-3 / B-6）

**Objective:** 親子線を増やさず GraphLink を読めて、線が上を通っても node を操作できるようにする。

#### Acceptance Criteria

- root を箱として描かない。root 直下の子 node の人に読めるラベルをレーン境界に示し、孫 node をレーン内で既存の node 描画に渡す。自動生成コードや ID を表示しない。空ラベルでも raw ID を代用しない。
- 孫 node より深い子孫は表示上 collapse し、隠れている node 数を示す（IS40=OP18）。保存済み collapsed / children[] を変更しない。
- 両端が表示対象の孫 node である GraphLink を全て描く。その他の GraphLink は保存したまま省き、省いた本数を一度だけ数えて示す（IS41）。親子 edge を描かず、親子関係を GraphLink に変換しない。
- GraphLink の既存 LinkStyle、色、direction の矢印、label、LinkPort と Link Route 設定を使う。格子並べで既存の Link Route を置換しない。
- Lane の visible stroke / arrow / label は node より後の SVG 層に置き、pointer-events を持たせない。`graph-link-hit` は node より前の層に置く（IS45）。node のない所の link 選択、node の選択・drag・編集を既存経路で行う。
- Lane 以外の Surface View は現在の GraphLink / node 層順を保つ。

### Requirement 5: 既存の操作と検証（B-4 / B-5）

**Objective:** 別の page や server を作らず、既存の Surface Progressive Navigation と通常 Beta で使えるようにする。

#### Acceptance Criteria

- Surface Progressive Navigation へ Lane、right/down、既存 space 操作を加える。Node Progressive Navigation で選んだ非 scope node に Lane を適用する操作は IS46 の選択と一体で審査する。
- renderer の置換・コピー・fork、@xyflow/react 採用、新 server / 別 page、GraphLink による段の振分け / 自作の crossing minimisation algorithm は失敗条件である。
- 各 Director 条件の試験ファイルとコマンドを tasks.md に対応付ける。fixture、実 server での保存、通常 Beta での確認を別の証拠として残す。fixture の成功を通常 Beta の成功と読み替えない。

## Director-owned acceptance criteria (verbatim)

出典: Director handoff `lane-view-first-slice.md`（2026-10-17）の「受け入れ条件」。以下は原文をそのまま保持する。Codex は変更提案のみ行い、Director が独立実行で合否を判定する。条件6は2026-10-18のDirector指示による更新済み原文。条件1〜5 / 7〜18は変更しない。

### A 系
1. link 作成 API で attributes {"confidence":"declared"} 付きの GraphLink を作る → map を取得すると同じ attributes が返る。
2. その map を viewer で開き、無関係の node を編集して保存 → attributes が残る。
3. JSON export → import の往復で attributes が残る。
4. 値が文字列でない attributes はサーバーが 4xx で拒否する。viewer の読込は文字列値だけを残す。
5. persistence_db_behavior.test.js を含む既存の link テストが通る。
### B 系
6. fixture: root > 子 node 3 > 孫 node 各2〜3、隣のレーン間・レーンを飛ばす・同じレーン内の GraphLink を含む。direction down では、同じ子 node の孫 node が全て同じ中心 y の1行に兄弟順に並び、行が children[] の順に上から並ぶ。right では、同じ子 node の孫 node が全て同じ中心 x の1列に兄弟順に並び、列が左から並ぶ。孫 node の矩形は重ならない。孫 node 間の GraphLink を全て取り除いて配置し直しても、全ての孫 node の座標が変わらない（配置関数の単体テスト）。
7. root node の children[]（root 直下の子 node の兄弟順序）を入れ替えるとレーンの順が変わる。Tree → Lane → Tree の切替で state.nodes と state.links が変わらず、変わるのは surface の設定だけ。
8. Lane では親子線を描かない。両端が表示中の孫 node である GraphLink はすべて描かれ、LinkStyle と direction の矢印が保存値どおり。
9. 表示ラベルに自動生成のコードや ID が出ない。
10. map を開き直すと、その scope の Lane 選択と direction が復元される。
11. Surface PN に Lane があり、direction の選択肢は right/down だけ。
12. 既存の種類が変わらない: layout_port_contract / layout_axis_direction / disperse_layout / viewer_surface_edge_path の単体テストと、viewer.visual / viewer_surface_edge_paths の可視テストが通る。
13. 孫 node 100 / GraphLink 200 の fixture で、矩形が重ならず、配置が 1 秒以内に終わる。
14. Lane の配置処理は shared 側の module に置き、viewer.ts の追加は種類の列挙と呼び出しだけ（目安: 追加 80 行以下）。
15. 統合後、通常の Beta で fixture の map を開いて 6・8・10・16 を目視確認する。
16. Lane では、レーンを飛ばす GraphLink が途中の孫 node の上に見える（DOM 上で見える線が node より後ろの要素である）。
17. Lane で、GraphLink が上を通る孫 node をクリックすると、その孫 node が選ばれる（GraphLink は選ばれない）。node の無い所で GraphLink をクリックすると、その GraphLink が選ばれる。孫 node のドラッグと編集の開始も、上を通る線に妨げられない。
18. Lane 以外の Surface View では、GraphLink と node の層順が現行と同じ。


## Proposed changes to acceptance criteria — 採用済み（2026-10-17）

Director が以下の3件を採択した。上の Director 条件は、共有ノートの更新済み原文と一致させた。Codex による独断の基準変更ではない。

| 対象 | 提案 | 理由 |
|---|---|---|
| 条件7の children[] の所有 node | 冒頭の「子 node の children[]」を「root node の children[]」と明記する | レーン順の正本は root 直下の子 node の兄弟順序であり、その配列は root node が持つ。子 node 自身の children[] は孫 node の順序であり、その入替だけではレーン順は変わらない |
| 条件8の表示対象 | 「両端が表示中の GraphLink」を「両端が表示中の孫 node である GraphLink」と明記する | IS41 は root / 子 node / 他 scope 等を端点とする link を省く。子 node の見出し表示を「表示中」に含める読み方と衝突し得る |
| 条件10の検証追加 | scope の復元を保持した上で「非 scope root の指定・保存・再読込でも同じ root を復元し、scopen しない」を追加する | DC30 / B-7 が既存の18条件では明示的に検収されていない |

node attributes を使う案を採る場合は node attributes が変わるため条件7とも衝突する。MapSurface を使う案の推奨は条件7の nodes / links 不変を維持するためでもある。nodes / links 不変の緩和は提案しない。条件7前半は root.children[] を指すことが採択済み。子 node 自身の children[] の入替ではレーン順が変わらないことも試験する。

## Requirements Traceability Notes

決定済み: DC30–DC34、IS37 閉、IS38=OP14、IS39（2026-10-18に OP16 を撤回し格子並べへ変更）、IS40=OP18、IS41/42/43 の既定案、IS44 の両間隔、IS45。既存の IS33/34 は今回の停止条件にしない。担当の割当範囲は IS30–IS49 / OP10–OP19 で、OP は使い切っている。新規 tracking ID は IS46 だけを追加し、2案には OP を付けない。RQ1–RQ6 は既存 steering の参照であり、新規採番ではない。

## Director-owned Mock Acceptance Criteria（2026-10-19、構造のみへ訂正）

出典: Director の `lane-mock/MOCK_RULES.md` と LaneDown / LaneRight。Director が受け入れ範囲を以下のとおり訂正した。M1〜M12の本文中の数値・色・寸法は説明用の例であり、数値一致を要求しない。前掲の元の18条件は変えない。LaneFocus / LaneMatrix は今回の範囲外。

mock の目的は、システムを構成する要素をレーンごとに一覧し、どれがどれとつながっているかを一目で読めることである（2026-10-19、akaghef 指摘により明記）。受け入れ条件として守るのは、その目的に効く**構造の決まり**（M1・M4・M6〜M9・M11・M12 と、M10 の「同じレーンの線は弧で結ぶ」こと）だけである。

色、角の丸み、カードの寸法、弧の膨らみの量などの**見た目の細部**は mock の描き方の都合であり、受け入れ条件ではない。既存の共通描画の既定値を使い、細部を合わせるために共通描画を拡張しない。M2・M3 は「孫 node とレーンが見分けられ、ラベルが重ならない」ことだけを求める。

## 共通
- M1 root は箱として描かない。root のラベルは描画面の上部に見出しとして出す（mock: 左上「Akaghef-System 構成」）。
- M2 孫 node は枠のあるカードで描く: 白地、1px の枠、角丸 8、ラベルは中央揃え。寸法は全孫 node で同じ（mock: down 156×44、right 168×40）。長いラベルは折り返し、カード同士が重ならない。
- M3 レーンは背景の帯で示す。隣り合う帯は交互に塗り分ける（mock: #ffffff / #f8f9fb、枠 #e3e5ea）。
- M4 レーン名と孫 node の個数を帯の先頭に出す（mock: 「AI」「3 個」）。
- M5 GraphLink は孫 node の後ろの帯の上に描き、保存された LinkStyle（default / emphasis 等）と direction の矢印に従う。IS45 により Lane では見える線を node の前に出す（クリック判定は後ろ）。

## direction down（LaneDown）
- M6 レーンは children[] の順に上から行として並び、全レーン同じ高さ（mock: 132）。
- M7 レーン名の列を左に確保する（mock: x=64〜184）。孫 node の領域はその右（mock: x=200〜1376）。
- M8 孫 node はレーンの中心線（帯の高さの中央より 6 上。下に同じレーンの弧の余白を残す）に1行で並び、**領域の幅を孫 node の数で等分した区画の中央**に置く（mock: 中心 x = 200 + (1176/n)(j+0.5)）。左に詰めない。
- M9 レーンをまたぐ GraphLink は、**出る側の孫 node の、相手レーンに向いた辺の中央**から、**入る側の孫 node の、元レーンに向いた辺の中央**へつなぐ（上のレーンへは上辺→下辺、下のレーンへは下辺→上辺）。左右の辺にはつながない。縦向きの滑らかな曲線（3次ベジェ、制御点は縦方向）。
- M10 同じレーンの GraphLink は、両端の孫 node の下辺の中央から下に膨らむ弧で結ぶ。

## direction right（LaneRight）
- M11 レーンは children[] の順に左から列として並び、全レーン同じ幅（mock: 216）。レーン名は列の上部。孫 node は列の中心線（幅の中央）に縦1列で、列の高さを等分した区画の中央に置く。
- M12 レーンをまたぐ GraphLink は、相手レーンに向いた左右の辺の中央どうしを横向きの曲線で結ぶ。同じレーンの GraphLink は右辺の中央から右に膨らむ弧。

## 判定
- A-sys fixture（`lane_asys.json`）を down / right で開いたスクリーンショットを、`LaneDown` / `LaneRight` と同じ縮尺で横に並べ、M1〜M12 を一つずつ照合する。単体試験では M8・M9・M11・M12 の座標（区画中央、接続辺）を検査する。

角丸半径と任意handle長の共通拡張は取り消す。既存の共通描画と曲線の計算を使用し、同じ帯の線も既存の計算のまま弧にする。接続辺の自動選択と保存LinkPort優先、元の条件16〜18の層順と操作は維持する。
