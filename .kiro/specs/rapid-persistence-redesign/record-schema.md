# レコードのスキーマ（第 2 段の設計）

2026-11-16。状態: 設計中、未承認。brief の決定（Neo4j を到達形とする、data migration は workspace ごとに一度だけ）の対象になる形を定める。

- 用語は [Glossary](../../../docs/00_Home/Glossary.md) に従う。
- [draft-record-model.md](./draft-record-model.md)（2026-10-25 の草案）を土台にし、2026-11-16 の決定で変わった点を本書が上書きする。草案の実測値（件数）は本書でも使う。食い違う場合は本書が優先する。
- 件数は、断りがなければ 2026-11-16 の退避コピー（3 workspace、69 map、50,706 node）を読み取り専用で数えた値。

## 1. 整理の軸

「migration が要る」と言われてきたものは三種類に分かれる。

| 種類 | 例 | 扱い |
|---|---|---|
| 形と識別を変える | レコードの種別、key、ID | 一度きりの migration に載せる |
| 値を書き換えるだけ | 旧い語彙の値、文字列に詰めた設定、役割の設定 | migration では一字も変えずに運び、後で Command で直す。journal に残る |
| コードの名前だけ | `RapidMvpModel`、`docId` | データに触れない。いつでもできる |

本書が決めるのは一つ目だけ。

## 2. 決定（2026-11-16、akaghef）

- **Connection と relationType**: 線の総称 Connection をレコードの種別にする。親子 edge と GraphLink はその部分集合。`relationType` は Connection に置き、親子 edge も持つ。表示する文字列は `label` で、`relationType` とは別の欄にする。
  - Glossary の改訂が要る: `Connection` の備考「保存実体ではなく、新しいデータ型は追加しない」（2026-10-24 の決定）、`relationType` の定義「tree edge の親子関係とは分ける」。スキーマの承認時に、文書の一斉置換と一緒に行う。
- **時刻を持たない**: node に作成時刻・更新時刻を持たせない。持つのは `rev`（最後に変えた確定の通し番号）だけ。時刻は「通し番号 → 確定時刻」の対応から引く。対応は 1 回の確定につき 1 行で、node の数に比例しない。journal を圧縮してもこの対応は残す。
  - 理由: 数学の map は 100 万 node 規模を見込む。全 node に時刻を持たせると、ほぼ誰も読まない値が node の数だけ増える。
  - 手放すもの: journal を圧縮した後は「いつ作ったか」が引けない。
- **既定値を保存しない**: 既定値と同じ欄は保存しない。欄が無ければ既定値として読む。「空の値を明示的に入れた」と「欄が無い」は区別しない。
  - 帰結: 既定値は凍結する。後で変えると、保存済みの全レコードの意味が変わる。
- **scope のレコード**: scope の境界は、scope のレコードがあることで表す。key は root になる node の ID。scopen は scope のレコードを作ること、unscopen は消すこと。node の種別は変わらない。`nodeType` から `folder` をなくし、scope の意味の「folder」を保存データ・コード・文書から払拭する（ファイルシステムのフォルダの意味は対象外）。
- **Surface View の旧い語彙**: Surface View の旧い語彙（`scatter`・`mindmap`・`logic-chart`・`timeline`）は、migration では書き換えずに運ぶ。対応が決まった時点で Command で直す。
- **正本の木と alias**: 正本の配置は木とする。どの node も親はちょうど一つ（root を除く）で、scope への所属、権限、削除の範囲、既定の並び順はこの木だけで決まる。別の場所から使うときは alias を置く。alias は参照先の所属を変えない。木以外のトポロジーは、この木に alias と、役割つきの GraphLink を重ねたものとして読む。
  - 帰結: 親子 edge も GraphLink も自分の ID を持つ（一つの node に線が複数入るため、子の ID を線の key にできない）。
  - 使い分け: その場所に子として並べたいなら alias、関係があることだけ示すなら GraphLink。
- **nodeType と details**: `nodeType` をスキーマの分岐にする。node のレコードは全種別で同じ最小の形にし、種別ごとの内容は details のレコードに置く。map の表示に要るのは node と Connection だけで、details は必要になったときに読む。種別を後から足すのは、details の形の定義を足すだけで、既存のデータを変換しない。

## 3. レコードの種別

エンジンに依らない論理の形。portable snapshot はこの単位で 1 行になる。全レコードは `rev` を持つ（attribute を除く。5 節）。

| 種別 | key | field | 現行での置き場 |
|---|---|---|---|
| map | `mapId` | `rootNodeId`、tag・archive・pin、Vault との結び付き、linear-text の表示設定 | `maps` の行と top-level |
| node | `nodeId` | `nodeType`（既定 `text`）、`text`（map に載るラベル）、`collapsed`（既定 false） | `nodes[*]` |
| details | `nodeId` | 種別ごとの形（4 節） | `nodes[*].details` ほか |
| Connection | `connectionId` | `kind`（edge / GraphLink）、`source`、`target`、`relationType`、`label`。edge は兄弟順キー。GraphLink は向き・線種・色・port | `parentId` と `children[]`、`m3e:edge-label`、`links[*]` |
| attribute | 持ち主の種別・持ち主の ID・key | `value`（型付きの JSON 値） | `attributes[*]` |
| scope | root の `nodeId` | `primarySurfaceId`。権限の置き場（将来） | `nodeType: "folder"` と `scopes[*]` |
| linear-text | scope の root の `nodeId` | `text` | `linearNotesByScope` |
| Surface View の保存設定 | `surfaceId` | 所属 scope、種別、Layout、向きと間隔 | `surfaces[*]` |
| 配置値 | `surfaceId`・`nodeId` | `x`、`y`、`flowCol`、`flowRow`、`shape` | `surfaces[*].nodeViews` の空でない値 |
| 注釈 | `annotationId` | 種別（pen / text）、scope、形状、色、太さ、作成時刻 | `annotations` |

### 親子の表し方

`children[]` は保存しない。親子は edge の Connection が持つ。

```
Connection  kind edge   親 root → 子 a   兄弟順キー "a0"
Connection  kind edge   親 root → 子 b   兄弟順キー "a1"
```

- ある node の子: `source` がその node の edge を集め、兄弟順キーで並べる。
- ある node の親: `target` がその node の edge（ちょうど 1 本）。
- 兄弟順キーは並べるためだけの値で、文字列として比べる。間に入れるときは前後のキーの間のキーを作り、他の兄弟のキーは変えない（fractional index。brief の兄弟順の決定）。
- `children[]` は読み込み時と旧形式への書き出し時に作る導出値。

### 保存しないもの

- 導出値: `children[]`、scope の範囲、`rootNodeIds`、`relationIds`
- 表示状態: 選択、camera、編集中の状態
- 既定値と同じ欄
- 作成時刻・更新時刻
- 空の配置値、root の無い scope とその Surface View

### 不変条件（確定時に検査する）

- root 以外の node は、入ってくる edge をちょうど 1 本持つ。root は持たない。edge は循環しない。
- 同じ親の下で（兄弟順キー, `connectionId`）が全順序になる。
- alias は実体の node だけを指す。alias は子を持たない。alias から alias は不可。
- GraphLink の端点は実在する。端点の node を消したら GraphLink も同じ確定で消す。
- scope の root は実在する node。alias は scope の root になれない。
- 検査は触った周辺だけで行う（親の付け替えなら、新しい親の祖先をたどって循環を見る）。map 全体は走査しない。

## 4. nodeType と details

種別を新しく立てる基準: **details の形か、構造上の拘束が他と違うときだけ**。分類の違いだけなら attribute にする。

| 種別 | details に載るもの | 状態 |
|---|---|---|
| `text` | Markdown の本文 | 基本形。47,429 件（旧 `folder` 2,066 件と `leaf` 216 件を含めると 49,711 件） |
| `alias` | 無し。参照先、`aliasLabel`、`access` を持つ | 994 件。子を持てず参照先が必須 |
| `agent` | agent の種類、icon、model、状態、伝言 | 現行は attribute `m3e:agent` に JSON を文字列で詰めている。11 件 |
| `image` | 画像への参照 | 仕様に定義があるが、データ 0 件、実装ほぼ無し。形は実装時に決める |

種別にしないもの:

- 補題・定義・定理など（attribute `kind` に 437 件）: 形は同じで分類だけが違う。Deep の entity の型になる。
- task・状態（`m3e:status` 713 件）: どの種別にも付く attribute。
- 表（tabular）: 子 node の見せ方であって内容ではない。

details の形には版の番号を持たせる。形を変えたときに旧い版をどう読むかは、種別ごとに定める。

現行の `details` は 6,696 件にあり、1 行の平文 5,268、複数行の平文 1,110、Markdown・数式の記法あり 276、JSON らしいもの 41、HTML らしいもの 1。長さの中央値は 59 字。`text` の details を Markdown の本文とすれば、そのまま収まる。

## 5. Neo4j 上の持ち方（提案）

3 節の論理の形を、Neo4j でどう持つか。portable snapshot の形は 3 節のままで、ここは差し替えられる側。

| 論理のレコード | Neo4j での持ち方 |
|---|---|
| map | node（ラベル `Map`）。確定の通し番号をここに持つ |
| node | node（ラベル `M3eNode`）。`id` に一意制約。`mapId` に索引 |
| details | 別の node（ラベル `Details`）。`M3eNode` から 1 本の線で結ぶ。本体の node を小さく保ち、details だけの読み書きを独立させる |
| Connection（edge） | relationship（型 `EDGE`、親 → 子）。property に `id`、兄弟順キー、`relationType`、`label`、`rev` |
| Connection（GraphLink） | relationship（型 `LINK`）。property に `id`、`relationType`、`label`、向き・線種・色・port、`rev` |
| alias の参照先 | relationship（型 `ALIAS_OF`、alias → 参照先）。参照先を消すとき、指している alias を線をたどって引ける |
| attribute | 持ち主の node または relationship の property。key に接頭辞を付ける |
| scope | 別の node（ラベル `Scope`）。root の `M3eNode` と 1 本の線で結ぶ |
| linear-text | 別の node（ラベル `LinearText`）。scope の root と結ぶ。所属が解決しないものは結ばずに残す |
| Surface View の保存設定 | 別の node（ラベル `Surface`）。scope の root と結ぶ |
| 配置値 | relationship（`Surface` → `M3eNode`）。property に座標 |
| 注釈 | 別の node（ラベル `Annotation`） |

設計上の選択:

- **親子と関係線を relationship の型で分ける。** `EDGE` だけをたどれば木になる。`relationType` は property にする。Neo4j は relationship の型を後から変えられないので、役割を型にすると、役割の変更が「消して作り直す」になるため。
- **attribute に `rev` を持たせない。** 競合は、Command が運ぶ変更前の値と現在の値を field 単位で比べて判定する（第 1 段の確定関数と同じ方式）。これで「agent の状態更新と human の本文編集が競合しない」（attribute を独立したレコードにした決定の目的）は満たせる。attribute を別の node にすると、100 万 node の map で数百万の小さな node が増える。論理のレコードとしては独立のまま（portable snapshot と Command では 1 件ずつ）。
- **attribute の値の型。** 実データには文字列以外がある（null 1,022、真偽 513、数値 136、配列 2。2026-10-25 の実測）。文字列・数値・真偽は Neo4j の値のまま、それ以外は JSON の文字列にして別の接頭辞の property に置く。
- **「node ごとに edge は 1 本」は制約として宣言できない。** 確定の transaction の中で検査する。
- **journal との順序。** journal が正本で、エンジンは導出物（ADR 014）。確定は、Neo4j の transaction の中で検査と適用を行い、journal へ追記してから transaction を確定する。追記の後・確定の前に落ちた場合は、再起動時に journal の方が進んでいるので、その分を再生する。journal の記録は結果のキーまで含むので、再生は決定的になる。この順序は、workspace ごとに書き手が一つであること（ADR 014 の 4）を前提にする。
- **Neo4j 内部の ID は外に出さない。** 参照は必ず自前の `id` で行う。

確かめる必要があるもの（未確認）:

- relationship の property への一意制約と索引が、使っている版・edition で使えるか。
- 100 万 node の一括取り込みの所要時間と、`EDGE` だけをたどる読み込みの速度。
- scope に属する node の集合を引く問い合わせの速度。遅ければ、所属を導出値として node に持たせる（portable snapshot には入れない）。

## 6. 現行からの移し方

| 現行 | 行き先 | 扱い |
|---|---|---|
| `nodes[*]` の `text`・`collapsed` | node | 移す |
| `nodes[*]` の `details` | details | 移す |
| `nodeType: "folder"` | 種別 `text` と scope のレコード | 移す |
| `parentId` と `children[]` | edge の Connection。ID を新しく振る | 移す |
| `attributes["m3e:edge-label"]`（15,971 件、32 種類の値） | Connection の `label`。`relationType` は未設定のまま | 移す。役割の設定は後で Command |
| その他の `attributes[*]` | attribute | 移す |
| alias の field | node と、参照先への線 | 移す |
| `links[*]` | GraphLink の Connection | 移す |
| `linearNotesByScope` | linear-text。所属が解決しないものも残す | 移す |
| `scopes[*].primarySurfaceId` | scope | 移す |
| `surfaces[*]`、`nodeViews` の空でない値、`annotations` | それぞれのレコード | 移す |
| 既定値と同じ欄 | — | 保存しない |
| `scopes[*].rootNodeIds`・`relationIds` | — | 導出 |
| 空の配置値、root の無い scope とその Surface View | — | 捨てる |
| Surface View の旧い語彙、scope の root に置かれた Layout の設定、装飾の旧 attribute、文字列に詰めた JSON | そのまま | 値は変えない（1 節） |

第 1 段の `command_log` は旧い形（`parentId`、`children` の位置）で書かれているので、新しいレコードには再生できない。migration の時点を通し番号 0 とし、そこから新しい journal を始める。旧い記録は保管に回す。

移行の合否は、旧い形 → 新しい形 → 旧い形への書き戻しが、上の表の「保存しない」「導出」「捨てる」を差し引いて元と一致することで判定する（草案 8.1 節）。問題が 0 件のときだけ切り替え、旧い DB は消さずに保管する。

## 7. 未決

形に入るので、migration の前に決めるもの。

- **note と link の置き場**: `note`（907 件）と `link`（355 件）を details に入れ、node のレコードを ID・種別・ラベル・`collapsed` だけにするか。現行のコードは details と note を連結して表示しており、二つの区別は実質ない。推奨は入れること。
- **HTML を載せる種別**: HTML を載せる種別の中身。データモデルの仕様は「raw HTML / raw CSS は node data に保存しない」「登録済みの種類だけを描画する」と定めている。推奨は、種別は立て、中身は登録済みの component の種類とその設定にすること。生の HTML を載せるなら、隔離して描画する仕組みと仕様の改訂が要る。
- **型定義にない field**: 型定義にない field の仕分け。推奨は、仕様が保存を禁じた `scopeId`、表示状態の混入（`selectedId`）、行の保存時刻の写し、参照先と全件同値の `aliasOf` を捨て、取り込み元の時刻・`notes`・`nodeType` と食い違う `type`・取り込みの由来を「型定義にない field を入れる欄」に残すこと。`nodeType: "leaf"`（216 件）は `text` に寄せる。
- **scope の label**: scope に保存された `label`（現在の本文と食い違うもの 408 件）。画面は読まないが、MCP が agent に返す内容に出ている。推奨は保存をやめ、root の node の本文から導出すること。
- **Surface View の ID**: Surface View の ID に種別の名前が埋まっている（`surface:<node>:<kind>`）。種別を後で書き換えると ID と中身が食い違う。推奨は、migration で種別を含まない ID に振り直すこと。
- **ID を振り直す範囲**: ID を全体一意にする決定の中身。推奨は、重複しているものと本文を含む ID だけを振り直し、旧 ID と新 ID の対応表を migration の成果物として残すこと。全部を振り直すと、map の外にある参照がすべて対応表頼みになる。
- **GraphLink の port の auto**: GraphLink の port の `auto`。サーバは保存し、画面は読込み時に捨てている。推奨は「値が無い＝自動」に統一すること。
- **Neo4j 上の持ち方**: 5 節の承認。特に attribute に `rev` を持たせない点。
- **migration の対象範囲**（brief の未決にある）: 一度きりの migration の対象範囲。推奨は、この Mac の 3 workspace を対象にし、Final と cloud 上の複製は対象外、Vault に結び付いた map は移行するが書き込みは当面従来の全体保存を使うこと。個人の workspace に残る試験用の map は、前もって保管に回す。

形に入らないので、migration の後でよいもの。

- **relationType の語彙**: `relationType` の語彙（`consist-of` と `detail` から始める案）と、32 種類のラベルの対応。許される値の一覧はスキーマに焼き込まず、データとして持つ。
- **混在を防ぐ規約**: 対象と説明の混在を防ぐ規約の強さ。新しい edge に役割を必須にするか、`detail` の下に `consist-of` を置けなくするか、scope ごとに強さを変えるか。必須にする場合、全ての書き込み経路が役割を選ぶので、既定の決め方（親の役割を引き継ぐ、取り込み元ごとに決める）を先に設計する。
- **detail と details**: Connection の役割 `detail`、node の details、attribute `kind` の `detail`（42 件）・`subdetail`（11 件）の使い分けと名前。説明の付け方が三通り混在している。
- **長いラベル**: 長いラベル（200 字超 1,729 件、複数行 371 件）を details へ移す整理。
- **同じ関係の重複**（brief の未決にある）: 同じ関係が Final の map、Beta の複写、`docs/semantic` の 3 か所にある件。この migration では扱わず、map 上のものは通常の node と GraphLink として運ぶ。

## 8. 残る問題

- **規模。** 保存は変更分だけになったが、画面は map 全体を読み込む。100 万 node には、scope 単位で読み込む作りが要る。スキーマはそれを可能にするが、画面の作り直しは別の仕事になる。
- **移行の照合。** 意図して変える点（6 節）が増えるほど、想定外の欠落を見逃す余地が増える。形の変換だけを載せる原則（1 節）を守る。
- **種別と版。** details の形を種別ごとに持つので、形の変更の規則が種別の数だけ要る。
- **scope の意味の「folder」の払拭。** 保存データは migration で、コードは第 2 段のモデルの書き直しで、文書は一斉置換で消す。戻らないように、push 前の検査に項目を入れる（現在の件数を上限にして増加を拒否し、完了時に 0 にする）。
