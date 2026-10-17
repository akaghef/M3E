# Requirements Document

## Project Description (Input)

**lane-view** — GraphLink.attributes の保存経路と Lane Surface View の最初の実装範囲。

**(a) 誰の課題か**
akaghef、Director、Codex worker。同じ map の root node、root 直下の子 node、孫 node、孫 node 間の GraphLink を、既存 viewer の Lane で読みたい。root node は scope でなくてもよい（DC30）。

**(b) 現状**
Lane と GraphLink.attributes は正本文書にあるが、対象ソースには未実装である。viewer の読込が GraphLink の既知フィールドだけを再構築するため attributes が消える。Surface View の保存と表示 root は scope 単位に結び付いており、非 scope node を Lane の root として指定・復元できない。

**(c) 変えたいこと**
Track A で任意の `Record<string, string>` を既存の GraphLink 保存経路に通す。Track B で elkjs の layered / partitioning を使う shared 側の配置処理を追加し、既存の SVG 描画、GraphLink 描画、Surface Progressive Navigation、保存経路を Lane の場合だけ拡張する。A を先に統合する。

> Status: 2026-10-17、Director が草案を審査済み。Phase 1 の文書を commit 済み。IS46 の MapSurface 案と条件7 / 8 / 10の明確化を採用。Track A は `4327ca0`（GraphLink.attributes の保持）として本流統合済み。Track B の task 7〜16の実装 go-ahead を受領し、worker の検証と Director の独立 browser 検証を進めている。commit / 統合 / push は Director が担当する。

## Boundary Context

| 区分 | 範囲 |
|---|---|
| Track A | A-1 型、A-2 viewer / JSON import 読込、A-3 サーバー検証、A-4 既存 link 作成 API |
| Track B | B-1 種類の列挙、B-2 elkjs 配置、B-3 表示条件、B-4 Surface Progressive Navigation、B-5 試験、B-6 GraphLink 層順、B-7 非 scope root の保存と指定操作 |
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

### Requirement 3: elkjs 配置と同期 render への接続（B-2）

**Objective:** 既存の配置ライブラリで、兄弟順序を保つレーンと重ならない孫 node を得る。

#### Acceptance Criteria

- shared module が既存依存 `elkjs` の layered algorithm と partitioning を呼ぶ。root.children[] の位置を全ての配置対象に割り当て、`right→RIGHT` / `down→DOWN` とする。
- down は帯を上から、right は列を左から並べる。順序を GraphLink の向き、文字列順、ID から決めない。空レーン、非連結、同じレーンの関係、飛び越す関係、逆向き・循環を試験する。
- space はレーン間と同じレーン内の孫 node 間の両方を変える（IS44）。実寸を入力し、孫 node の矩形を重ねない。
- 配置結果のキャッシュと既存の再描画で同期 layout/render に接続する。計算中・失敗を完了と扱わない。古い root / map / direction の非同期結果を適用しない。
- pending の代替表示として新しい配置算法を作らない。100 孫 node / 200 GraphLink の条件と1秒の閾値を変更しない。

### Requirement 4: 既存描画と Lane の表示条件（B-3 / B-6）

**Objective:** 親子線を増やさず GraphLink を読めて、線が上を通っても node を操作できるようにする。

#### Acceptance Criteria

- root を箱として描かない。root 直下の子 node の人に読めるラベルをレーン境界に示し、孫 node をレーン内で既存の node 描画に渡す。自動生成コードや ID を表示しない。空ラベルでも raw ID を代用しない。
- 孫 node より深い子孫は表示上 collapse し、隠れている node 数を示す（IS40=OP18）。保存済み collapsed / children[] を変更しない。
- 両端が表示対象の孫 node である GraphLink を全て描く。その他の GraphLink は保存したまま省き、省いた本数を一度だけ数えて示す（IS41）。親子 edge を描かず、親子関係を GraphLink に変換しない。
- GraphLink の既存 LinkStyle、色、direction の矢印、label、LinkPort と Link Route 設定を使う。ELK の edge 経路で既存の Link Route を置換しない。
- Lane の visible stroke / arrow / label は node より後の SVG 層に置き、pointer-events を持たせない。`graph-link-hit` は node より前の層に置く（IS45）。node のない所の link 選択、node の選択・drag・編集を既存経路で行う。
- Lane 以外の Surface View は現在の GraphLink / node 層順を保つ。

### Requirement 5: 既存の操作と検証（B-4 / B-5）

**Objective:** 別の page や server を作らず、既存の Surface Progressive Navigation と通常 Beta で使えるようにする。

#### Acceptance Criteria

- Surface Progressive Navigation へ Lane、right/down、既存 space 操作を加える。Node Progressive Navigation で選んだ非 scope node に Lane を適用する操作は IS46 の選択と一体で審査する。
- renderer の置換・コピー・fork、@xyflow/react 採用、新 server / 別 page、自作の Lane / crossing minimisation algorithm は失敗条件である。
- 各 Director 条件の試験ファイルとコマンドを tasks.md に対応付ける。fixture、実 server での保存、通常 Beta での確認を別の証拠として残す。fixture の成功を通常 Beta の成功と読み替えない。

## Director-owned acceptance criteria (verbatim)

出典: Director handoff `lane-view-first-slice.md`（2026-10-17）の「受け入れ条件」。以下は原文をそのまま保持する。Codex は変更提案のみ行い、Director が独立実行で合否を判定する。

### A 系
1. link 作成 API で attributes {"confidence":"declared"} 付きの GraphLink を作る → map を取得すると同じ attributes が返る。
2. その map を viewer で開き、無関係の node を編集して保存 → attributes が残る。
3. JSON export → import の往復で attributes が残る。
4. 値が文字列でない attributes はサーバーが 4xx で拒否する。viewer の読込は文字列値だけを残す。
5. persistence_db_behavior.test.js を含む既存の link テストが通る。
### B 系
6. fixture: root > 子 node 3 > 孫 node 各2〜3、隣のレーン間・レーンを飛ばす・同じレーン内の GraphLink を含む。direction down では子 node ごとの孫 node が一つの帯に入り、帯が children[] の順に上から並ぶ。right では左から列として並ぶ。孫 node の矩形は重ならない（配置関数の単体テスト）。
7. root node の children[]（root 直下の子 node の兄弟順序）を入れ替えるとレーンの順が変わる。Tree → Lane → Tree の切替で state.nodes と state.links が変わらず、変わるのは surface の設定だけ。
8. Lane では親子線を描かない。両端が表示中の孫 node である GraphLink はすべて描かれ、LinkStyle と direction の矢印が保存値どおり。
9. 表示ラベルに自動生成のコードや ID が出ない。
10. map を開き直すと、その scope の Lane 選択と direction が復元される。scope でない node を root に指定した場合も、同じ root が復元され、その node は scope にならない。
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

決定済み: DC30–DC34、IS37 閉、IS38=OP14、IS39=OP16、IS40=OP18、IS41/42/43 の既定案、IS44 の両間隔、IS45。既存の IS33/34 は今回の停止条件にしない。担当の割当範囲は IS30–IS49 / OP10–OP19 で、OP は使い切っている。新規 tracking ID は IS46 だけを追加し、2案には OP を付けない。RQ1–RQ6 は既存 steering の参照であり、新規採番ではない。
