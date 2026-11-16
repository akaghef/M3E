# レコードのスキーマ（第 2 段の設計）

2026-11-17 更新（初版 2026-11-16）。状態: 設計中、未承認。brief の決定（Neo4j を到達形とする、data migration は workspace ごとに一度だけ）の対象になる形を定める。

- 用語は [Glossary](../../../docs/00_Home/Glossary.md) に従う。
- 本書の ID（DA は決定、IB は未決の論点、FA は確かめた事実）は、本書を書いた会話の中の住所である。他の文書の番号とは連番にしていない。初版の IA・PA の番号は、この版で DA・IB に置き換えた。
- [draft-record-model.md](./draft-record-model.md)（2026-10-25 の草案）と [brief.md](./brief.md) を土台にし、食い違う場合は本書が優先する（兄弟順キーを作る側、通し番号の範囲、確定の境界）。
- 件数は、断りがなければ 2026-11-16 の退避コピー（3 workspace、69 map、2,126 scope、50,706 node）を読み取り専用で数えた値。
- 2026-11-17 に、外部の model（GPT-6 Pro）へ設計の批判的なレビューを依頼した。その指摘のうち採ったものは本文に入れ、根拠を「レビュー」と記した。

## 1. 整理の軸

「migration が要る」と言われてきたものは三種類に分かれる。

| 種類 | 例 | 扱い |
|---|---|---|
| 形と識別を変える | レコードの種別、key、ID | 一度きりの migration に載せる |
| 値を書き換えるだけ | 旧い語彙の値、文字列に詰めた設定、役割の設定 | migration では一字も変えずに運び、後で Command で直す。journal に残る |
| コードの名前だけ | `RapidMvpModel`、`docId` | データに触れない。いつでもできる |

本書が決めるのは一つ目だけ。保存エンジン上の持ち方（6 節）は journal から作り直せるので、誤っても直せる。直せないのは、レコードの形と識別である。

## 2. 決定（akaghef）

### 形

- **DA1 Connection と relationType**: 線の総称 Connection をレコードの種別にする。親子 edge と GraphLink はその部分集合。`relationType` は Connection に置き、親子 edge も持つ。表示する文字列は `label` で、`relationType` とは別の欄にする。
  - Glossary の改訂が要る: `Connection` の備考「保存実体ではなく、新しいデータ型は追加しない」、`relationType` の定義「tree edge の親子関係とは分ける」。スキーマの承認時に、文書の一斉置換と一緒に行う。
- **DA6 正本の木と alias**: 正本の配置は木とする。どの node も親はちょうど一つ（root を除く）で、scope への所属、権限、削除の範囲、既定の並び順はこの木だけで決まる。別の場所から使うときは alias を置く。alias は参照先の所属を変えない。木以外のトポロジーは、この木に alias と、役割つきの GraphLink を重ねたものとして読む。
  - 帰結: 親子 edge も GraphLink も自分の ID を持つ。
  - 使い分け: その場所に子として並べたいなら alias、関係があることだけ示すなら GraphLink。
- **DA21 Connection は端点になれる**: Connection は、他の Connection の端点になれる（線そのものについて述べる要件）。
- **DA7 nodeType と details**: `nodeType` をスキーマの分岐にする。node のレコードは全種別で同じ最小の形にし、種別ごとの内容は details のレコードに置く。map の表示に要るのは node と Connection だけで、details は必要になったときに読む。種別を後から足すのは、details の形の定義を足すだけで、既存のデータを変換しない。
- **DA5 Surface View の旧い語彙**: 旧い語彙（`scatter`・`mindmap`・`logic-chart`・`timeline`）は、migration では書き換えずに運ぶ。対応が決まった時点で Command で直す。

### scope

- **DA4 scope のレコード**: scope の境界は、scope のレコードがあることで表す。scopen は scope のレコードを作ること、unscopen は消すこと。node の種別は変わらない。`nodeType` から `folder` をなくし、scope の意味の「folder」を保存データ・コード・文書から払拭する（ファイルシステムのフォルダの意味は対象外）。
- **DA16 scope は自分の ID を持つ**: scope の key は root の node の ID ではなく、scope 自身の ID とする。root は scope のレコードの欄になる。権限・linear-text・Surface View の保存設定は、scope の寿命に従う。unscopen してからもう一度 scopen すると、別の scope になる（レビュー）。
- **DA17 root の所属**: scope の root の node は、自分の scope に属する。親の scope には入口として現れる。
- **DA26 scope 独自のラベルを持たない**: scope の名前は、常に root の node のラベルである。保存されている scope の `label` は運ばない。
- **DA8 scope の大きさの目安**: 30 node 以下を基本とし、それが多数つながって全体を成す形を目指す。画面に収まって効率がよいのは 200 node まで。1,000 node を超えると可視性がほぼ無い。超えた scope は通知するだけで、書き込みは拒まない。

### rev と時刻と発行者

- **DA2 時刻を持たない**: node に作成時刻・更新時刻を持たせない。持つのは `rev`（そのレコードを最後に変えた確定の通し番号）だけ。時刻と発行者は「確定の表」（通し番号 → 確定時刻・発行者。確定 1 回につき 1 行）から引く。journal を圧縮してもこの表は残す。
  - 理由: 数学の map は 100 万 node 規模を見込む。全 node に時刻を持たせると、ほぼ誰も読まない値が node の数だけ増える。
  - 手放すもの: 「いつ作ったか」は、journal を圧縮した後は引けない（DA13）。
- **DA29 rev の粒度**: node のラベルと attribute は、node 単位の一つの `rev` で管理する。attribute ごとには分けない。Connection と details は独立したレコードで、それぞれ `rev` を持つ。
- **DA13 作成者を別に持たない**: 「誰が作ったか」を node に持たせない。最後に変えた確定の発行者だけが引ける。
- **DA14 発行者は必須**: 確定には必ず発行者を記録する。発行者は、サーバが認証済みの接続から決める。画面や AI agent の自己申告は使わない。
- **DA25 アカウント**: 認証の単位を アカウント と呼ぶ（アカウントに当たる）。発行者は アカウント である。
- **DA15 既にある ID を使う**: アカウント の識別には、既にある外部の ID（Discord の ID など）を使う。発行者の識別に node の ID は使わない（DA14 の初版の後半を改めた）。
- **DA33 アカウント と Actor Instance**: AI agent では Actor Instance 一つが アカウント 一つ、human ではその人一人が アカウント 一つである。Actor Instance は登録のときに鍵を受け取り、それで認証する。session の ID は、確定の表に任意で残す。
- **DA34 権限は Role に与える**: 権限は アカウント に直接与えず、Role に与える。Actor Instance が生まれる前に設定できる。Team は M3E の語にしない。
- **DA36 agent の node の実体は一つ**: agent の一覧の map がある場合、agent の node の実体はそこに一つだけ置く。ほかの scope に現れる姿は、その実体を指す alias とする（DA6 を agent にも当てる）。初版の「互いに独立した実体」（DA35）を改めた。
- **DA37 アカウントは map の外で管理する**: アカウントにかかわること（認証の鍵、外部の ID、担う Role）は、map ではなく専用の画面と機構で管理する。map の node が無くてもアカウントは存在する。map 上の Role への alias は表示である。
- **DA38 語は「アカウント」**: 認証の単位を「アカウント」と呼ぶ。「アカウント」は使わない。
  - Glossary への追加が要る: アカウント。Role と Actor Instance は用語の文書（`.kiro/steering/agent_orrery_terminology.md`）から Glossary へ上げる。

### 欄の省略

- **DA3 既定値を保存しない**: node の決まった欄（`nodeType`、`collapsed`）は、既定値と同じなら保存しない。欄が無ければ既定値として読む。既定値は凍結する。
- **DA12 null は保存しない**: 値が null の attribute は、欄が無いものとして扱う（1,022 件）。Neo4j は null を property として持てない。
- **DA19 空文字の attribute は残す**: 値が空文字の attribute（327 件。`modifier` 119 件など）は、値として残す。省略は、その欄で意味が永久に同じと決めた値だけに限る（レビュー）。
- **DA18 collapsed**: 当面 node に保存する。agent ごとの表示状態へ移すのは、後からできる。

### relationType

- **DA22 名前が識別子**: `relationType` の値は `x:y` の形の名前とする（例: `rdfs:subClassOf`）。この名前が識別子で、変えない。
- **DA28 接頭辞の無い名前**: 接頭辞の無い名前（`consist-of`）も保存してよい。接頭辞なしは M3E 独自の語彙、接頭辞ありは借りてきた語彙と読む。
- **DA23 表示ラベルは定義に置く**: 表示ラベルと説明は、relationType の定義のレコードに置く。表示を変えるときは、定義の 1 件だけを書き換える。
- **DA24 線の表示**: Connection の `label` が無いときは、relationType の定義の表示ラベルを表示する。それも無ければ、何も表示しない。

### 実行時

- **DA30 正本と実用の構造を分ける**: 親子関係と兄弟順は Connection と兄弟順キーで保存する。利用のたびに走査・取得・整列することはせず、scope ごとの整列済みの木をキャッシュする。
- **DA31 scope に居る間は一つの木だけを編集する**: agent が scope に居る間（その scope を見ている間）、その木をメモリ上で直接編集する。編集中の木とは別にキャッシュを持って二重に更新することはしない。
- **DA32 再訪時はキャッシュを使う**: 有効なキャッシュがある scope へ戻ったときは、その木を再利用する。正本への保存は、scope の退出を待たずに行う。
- **DA9 変更の通知は軽くする**: 通常は「どの scope か、通し番号、変わった node の ID の一覧」だけを、その scope に居る agent に送る。受けた側が、自分が編集している node やその祖先に関係するかを判定し、関係するときだけ詳細を取る（例: 編集中の node の親が消された）。
- **DA20 alias の参照先の変更**: alias の参照先のラベルが変わったら、alias がある scope にも通知する。
- **DA10 居ることは保存しない**: 「どの agent がどの scope に居るか」は、サーバのメモリだけに持つ。map 上の agent の node は、通常の node として保存する。
- **DA11 複数の scope に居てよい**: 一つの agent が、同時に複数の scope に居てよい。
- **DA27 兄弟順キーを作る側**: 兄弟順キーは、手元の端末も作ってよい。二つの端末が同じ隙間に入れたときは、キーと `connectionId` の組で順を決める。二人が入れた列が交互に混ざることがある。brief の「確定する側だけが作る」を上書きする。

「居る」は agent（AI agent と human）が scope を見ていることを指す。node は scope に「属する」。

## 3. 確定の仕組み（担当の判断。レビューを受けて初版を直した）

akaghef の個別の承認はまだ受けていない。

- **確定の境界**: journal への追記が成功した時点を確定とする。その後で保存エンジンへの反映が失敗しても、取り消さない。「確定済み・未反映」として扱い、追いつくまでその workspace の次の確定を止める。初版の「追記してからエンジンを確定する」は、追記の後にエンジンが失敗すると、利用者には失敗と返したのに再起動後に変更が現れる。
- **直列化**: workspace ごとに、検査の開始から確定までを 1 件ずつ順に処理する。同時に処理すると、「A を B の子に」と「B を A の子に」がどちらも変更前の木で検査を通り、循環ができる。
- **通し番号は workspace で一本**: 初版は map ごとだった。node を別の map へ移すと、その `rev` が別の map の別の確定を指してしまう。確定する側は workspace ごとに一つなので、一本にできる。
- **再送**: 同じ ID の再送には最初の結果を返す。同じ ID で中身が違う依頼は拒否する。依頼には「どの通し番号を基準にしたか」を載せ、journal の圧縮より古い基準の依頼は、取り直しをさせてから受ける（消した node が再送で復活するのを防ぐ）。
- **適用した番号と受け取った番号を分ける**: 通知を受けただけで中身を取っていない部分は、「古い」と印を付けて持つ。キャッシュの番号を進めるのは、実際に適用したところまで。
- **大きな操作**: 100 万 node の取り込みや巨大な部分木の削除は、論理の上では 1 回の確定だが、エンジンの 1 回の transaction にはしない。見えない状態で分割して作り、検査の後で公開する（方法は IB40）。
- **変えた欄だけを当てる**: 検査を通した後、依頼の変更後のレコードを丸ごと書かず、変えた欄だけを現在のレコードに当てる（第 1 段で実装済み）。欄の削除は「変更前にあって変更後に無い」で表す（同）。

## 4. レコードの種別

エンジンに依らない論理の形。portable snapshot はこの単位で 1 行になる。

| 種別 | key | field | 現行での置き場 |
|---|---|---|---|
| map | `mapId` | `rootNodeId`、tag・archive・pin、Vault との結び付き、linear-text の表示設定 | `maps` の行と top-level |
| node | `nodeId` | `nodeType`（既定 `text`）、`text`（map に載るラベル）、`collapsed`（既定 false）、attribute、`rev` | `nodes[*]` |
| details | `nodeId` | 種別ごとの形（5 節）、形の版の番号、`rev` | `nodes[*].details` ほか |
| Connection | `connectionId` | `kind`（edge / GraphLink）、`source`、`target`、`relationType`、`label`、attribute、`rev`。edge は兄弟順キー。GraphLink は向き・線種・色・port | `parentId` と `children[]`、`m3e:edge-label`、`links[*]` |
| scope | `scopeId` | `rootNodeId`、`primarySurfaceId`、`rev`。権限の置き場（将来） | `nodeType: "folder"` と `scopes[*]` |
| linear-text | `scopeId` | `text`、`rev` | `linearNotesByScope` |
| Surface View の保存設定 | `surfaceId` | 所属 scope、種別、Layout、向きと間隔、`rev` | `surfaces[*]` |
| 配置値 | `surfaceId`・`nodeId` | `x`、`y`、`flowCol`、`flowRow`、`shape` | `surfaces[*].nodeViews` の空でない値 |
| 注釈 | `annotationId` | 種別（pen / text）、scope、形状、色、太さ | `annotations` |
| relationType の定義 | 名前（DA22） | 表示ラベル、説明、読む向き（親 → 子か、子 → 親か） | 無し（新設） |
| 接頭辞の対応 | 接頭辞 | 指す URI | 無し（新設） |
| アカウント | アカウント の ID | 外部の ID、表示名ほか（IB44） | 無し（新設） |
| 確定の表 | 通し番号 | 確定時刻、発行者（アカウント）、session の ID（任意） | 第 1 段の `command_log` の一部 |

- attribute は、持ち主（node または Connection）のレコードの一部で、独立した `rev` を持たない（DA29）。portable snapshot と Command では 1 件ずつ扱う。
- relationType の定義に「読む向き」が要る理由: 親子 edge は親から子へ向くが、`rdfs:subClassOf` は子から親へ読み、`consist-of` は親から子へ読む。この欄が無いと、RDF へ書き出すときに主語と目的語が逆になる。
- 接頭辞の対応があれば、portable snapshot を Turtle として書き出せる。

### 親子の表し方

`children[]` は保存しない。親子は edge の Connection が持つ。

```
Connection  kind edge   親 root → 子 a   兄弟順キー "a0"
Connection  kind edge   親 root → 子 b   兄弟順キー "a1"
```

- ある node の子: `source` がその node の edge を集め、兄弟順キーで並べる。
- ある node の親: `target` がその node の edge（ちょうど 1 本）。
- 兄弟順キーは並べるためだけの値で、文字列として比べる。間に入れるときは前後のキーの間のキーを作り、他の兄弟のキーは変えない（fractional index）。
- メモリ上の木は、子の並び（配列）を持ってよい。正本はキー、実行時は配列、という分担になる。

### 保存しないもの

- 導出値: `children[]`、scope への所属、`rootNodeIds`、`relationIds`、scope の名前（DA26）
- 表示状態: 選択、camera、編集中の状態、どの agent がどの scope に居るか（DA10）
- 既定値と同じ決まった欄（DA3）、null の attribute（DA12）
- 作成時刻・更新時刻・作成者（DA2、DA13）
- 空の配置値、root の無い scope とその Surface View

### 不変条件（確定時に検査する）

- root 以外の node は、入ってくる edge をちょうど 1 本持つ。root は持たない。edge は循環しない。
- 同じ親の下で（兄弟順キー, `connectionId`）が全順序になる。
- alias は実体の node だけを指す。alias は子を持たない。alias から alias は不可。
- Connection の端点は実在する。端点を消したら、その Connection も同じ確定で消す。
- scope の root は実在する node。alias は scope の root になれない。一つの node が root になる scope は一つまで。
- `connectionId` は edge と GraphLink をまたいで一意。エンジンの制約では保証できないので、確定する側で検査する（レビュー）。
- 検査は触った周辺だけで行う（親の付け替えなら、新しい親の祖先をたどって循環を見る）。map 全体は走査しない。

## 5. nodeType と details

種別を新しく立てる基準: **details の形か、構造上の拘束が他と違うときだけ**。分類の違いだけなら attribute にする。

| 種別 | details に載るもの | 状態 |
|---|---|---|
| `text` | Markdown の本文 | 基本形。47,429 件（旧 `folder` 2,066 件と `leaf` 216 件を含めると 49,711 件） |
| `alias` | 無し。参照先、`aliasLabel`、`access` を持つ | 994 件。子を持てず参照先が必須。`aliasLabel` があるのは 39 件 |
| `agent` | agent の種類、icon、model、役割。指す アカウント | 現行は attribute `m3e:agent` に JSON を文字列で詰めている。11 件 |
| `image` | 画像への参照 | 仕様に定義があるが、データ 0 件、実装ほぼ無し。形は実装時に決める |

種別にしないもの:

- 補題・定義・定理など（attribute `kind` に 437 件）: 形は同じで分類だけが違う。Deep の entity の型になる。
- task・状態（`m3e:status` 713 件）: どの種別にも付く attribute。
- 表（tabular）: 子 node の見せ方であって内容ではない。

現行の `details` は 6,696 件にあり、1 行の平文 5,268、複数行の平文 1,110、Markdown・数式の記法あり 276、JSON らしいもの 41、HTML らしいもの 1。長さの中央値は 59 字。`text` の details を Markdown の本文とすれば、そのまま収まる。

## 6. Neo4j 上の持ち方（提案。誤っても journal から作り直せる）

| 論理のレコード | Neo4j での持ち方 |
|---|---|
| map | node（ラベル `Map`） |
| node | node（ラベル `M3eNode`）。`id` に一意制約。`mapId` に索引 |
| details | 別の node（ラベル `Details`）。`M3eNode` から 1 本の線で結ぶ |
| Connection（edge） | relationship（型 `EDGE`、親 → 子）。property に `id`、兄弟順キー、`relationType`、`label`、`rev` |
| Connection（GraphLink） | relationship（型 `LINK`）。property に `id`、`relationType`、`label`、向き・線種・色・port、`rev` |
| alias の参照先 | relationship（型 `ALIAS_OF`、alias → 参照先）。参照先から alias を逆にたどれる（DA20 の通知先） |
| attribute | 持ち主の node または relationship の property。key に接頭辞を付ける |
| scope | 別の node（ラベル `Scope`）。root の `M3eNode` と 1 本の線で結ぶ |
| linear-text、Surface View の保存設定、注釈 | 別の node。scope と結ぶ |
| 配置値 | relationship（`Surface` → `M3eNode`）。property に座標 |
| 確定の表、適用済みの位置、依頼の ID の記録 | 別の node。反映と同じ transaction で書く（レビュー） |

設計上の選択:

- **親子と関係線を relationship の型で分ける。** `EDGE` だけをたどれば木になる。`relationType` は property にする。Neo4j は relationship の型を後から変えられないため。
- **attribute を別の node にしない。** 100 万 node の map で数百万の小さな node が増えるため。同じ node への同時の書き込みは、Command が運ぶ変更前の値と現在の値を field 単位で比べ、触った field が重なるときだけ拒否する（第 1 段の確定関数と同じ方式）。
- **attribute の値の型。** 文字列・数値・真偽は Neo4j の値のまま、それ以外は JSON の文字列にして別の接頭辞の property に置く。実データに 2 の 53 乗を超える整数は無い。
- **Neo4j 内部の ID は外に出さない。** 参照は必ず自前の `id` で行う。

未確認（実機 2026.10.2 で確かめる）:

- **FA51** レビューの記述: relationship の property への索引は 4.3 以降、一意制約は 5.7 以降で Community でも使える。property の存在・型の制約は Enterprise だけ。Community は利用者用の database が一つ。
- DA21 のために Connection を node として持つ必要があるか（relationship は他の線の端点になれない）。全部を node にするか、端点にされたものだけにするか。
- 100 万 node の取り込みの所要時間と、`EDGE` だけをたどる読み込みの速度。
- 索引に載せる値の長さの上限（レビューの記述では範囲索引が約 8 KB、文字列索引が約 32 KB）。
- scope に属する node の集合を引く問い合わせの速度。遅ければ、所属を導出値として node に持たせる（portable snapshot には入れない）。

## 7. 現行からの移し方

| 現行 | 行き先 | 扱い |
|---|---|---|
| `nodes[*]` の `text`・`collapsed` | node | 移す |
| `nodes[*]` の `details` | details | 移す |
| `nodeType: "folder"` | 種別 `text` と scope のレコード。`scopeId` を新しく振る | 移す（DA4、DA16） |
| `parentId` と `children[]` | edge の Connection。ID を新しく振る | 移す |
| `attributes["m3e:edge-label"]`（15,971 件、32 種類の値） | Connection の `label`。`relationType` は未設定のまま | 移す。役割の設定は後で Command |
| その他の `attributes[*]` | attribute。null は落とす（DA12）。空文字は残す（DA19） | 移す |
| alias の field | node と、参照先への線 | 移す |
| `links[*]` | GraphLink の Connection | 移す |
| `linearNotesByScope` | linear-text。所属が解決しないものも残す | 移す |
| `scopes[*].primarySurfaceId` | scope | 移す |
| `surfaces[*]`、`nodeViews` の空でない値、`annotations` | それぞれのレコード | 移す |
| node ごとの「誰が作ったか」の attribute（会話の ID、model、生成時刻など） | そのまま attribute | 値は変えない。整理は後で Command |
| 既定値と同じ決まった欄、`scopes[*].label` | — | 保存しない（DA3、DA26） |
| `scopes[*].rootNodeIds`・`relationIds` | — | 導出 |
| 空の配置値、root の無い scope とその Surface View | — | 捨てる |
| Surface View の旧い語彙、scope の root に置かれた Layout の設定、装飾の旧 attribute、文字列に詰めた JSON | そのまま | 値は変えない（DA5 と 1 節） |

第 1 段の `command_log` は旧い形で書かれているので、新しいレコードには再生できない。migration の時点を通し番号 0 とし、そこから新しい journal を始める。旧い記録は保管に回す。

移行の合否:

- 旧い形 → 新しい形 → 旧い形への書き戻しが、上の表の「保存しない」「導出」「捨てる」を差し引いて元と一致する。
- 往復とは独立に、元データを別の方法で走査して対応を確かめる。往路と復路が同じ誤解をしていると、往復は一致してしまう（レビュー）。
- 空のエンジンへ、portable snapshot と journal だけから復元する試験を通す。
- 切替の時点で旧い側の書き込みを止める手順を定める。
- 問題が 0 件のときだけ切り替え、旧い DB は消さずに保管する。

## 8. 実データで確かめたこと

scope の大きさ（2,126 scope）:

| 指標 | node 数 |
|---|---|
| 中央値 | 11 |
| 90 パーセンタイル | 30 |
| 99 パーセンタイル | 219 |
| 最大 | 1,141 |

- 30 node 以下の scope は、scope の 90.1%、node の 49.5%。201〜1,000 node の scope が 27、1,000 超が 1。
- 一つの親の子の数の最大は 646。木の深さの最大は 18。
- alias の 52%（994 件中 514 件）と GraphLink の 26%（985 件中 257 件）が、別の scope を指している。
- 一つの参照先を指す alias は最大 5 件（上限ではなく実測）。
- 例（map「codex-pn-verify-5」の scope「test1」、26 node）:
  - root のラベルは「test1」だが、scope のレコードは別のラベルを持っている（DA26 で運ばない）。
  - AI agent が作った 4 node が、それぞれ 9 個の attribute で会話の ID・model・生成時刻を持っている。新しい形では、確定の表の 1 行になる。
  - 親子（動物 → 哺乳類 → ヒト）は全部 `rdfs:subClassOf` に当たり、`consist-of` でも `detail` でもない。個体を置く場合は `rdf:type` になる。

## 9. 未決

形に入るので、migration の前に決めるもの。

- **IB1 note と link の置き場**: `note`（907 件）と `link`（355 件）を details に入れ、node のレコードを ID・種別・ラベル・`collapsed` だけにするか。推奨は入れること。
- **IB2 型定義にない field**: 推奨は、仕様が保存を禁じた `scopeId`、表示状態の混入（`selectedId`）、行の保存時刻の写し、参照先と全件同値の `aliasOf` を捨て、取り込み元の時刻・`notes`・取り込みの由来を「型定義にない field を入れる欄」に残すこと。`nodeType: "leaf"`（216 件）は `text` に寄せる。
- **IB3 HTML を載せる種別**: 仕様は「raw HTML / raw CSS は node data に保存しない」と定めている。推奨は、種別は立て、中身は登録済みの component の種類とその設定にすること。
- **IB4 agent の details に載せる実行時の値**: 状態や伝言のように頻繁に変わる値を、details に保存するか。
- **IB8 Surface View の ID**: ID に種別の名前が埋まっている（`surface:<node>:<kind>`）。推奨は、migration で種別を含まない ID に振り直すこと。
- **IB9 GraphLink の port の auto**: 推奨は「値が無い＝自動」に統一すること。
- **IB10 ID を振り直す範囲**: 推奨は、重複しているものと本文を含む ID だけを振り直し、旧 ID と新 ID の対応表を migration の成果物として残すこと。
- **IB11 migration の対象範囲**: 推奨は、この Mac の 3 workspace を対象にし、Final と cloud 上の複製は対象外とすること。個人の workspace に残る試験用の map は、前もって保管に回す。
- **IB19 scope の構造を変える操作**: unscopen したとき、その scope の linear-text と Surface View の保存設定を消すか、親の scope へ移すか。scopen・unscopen・scope をまたぐ移動は、変わっていない多数の node の所属を変えるので、旧い scope と新しい scope の両方のキャッシュを無効にする。scope どうしを「scope という役割の線」でつながったグラフと読む案（担当の読み。未確認）。
- **IB44 アカウントの中身**: アカウントが持つ欄。一つのアカウントに外部の ID を複数結び付けられるか。
- **IB48 map をまたぐ alias**: agent の一覧が別の map にあると、alias が map をまたいで実体を指す。参照先の map を消すときの扱いと、参照先を読む権限の扱い。
- **IB36 代理**: AI agent が human の依頼で書いたとき、依頼した側を記録するか。
- **IB37 権限の持ち方**: scope に置く権限の形。Role を単位にする（DA34）。
- **IB47 語彙に無い relationType**: 定義のレコードが無い名前を Connection に書けるか（拒否するか、書かせて後で定義を足すか）。

形に入らないので、migration の後でよいもの。

- **IB24 relationType の語彙**: 最初に定義する名前と、32 種類のラベルとの対応。
- **IB25 混在を防ぐ規約**: 対象と説明の混在を防ぐ規約の強さ。新しい edge に役割を必須にするか。
- **IB26 detail と details**: Connection の役割 `detail`、node の details、attribute `kind` の `detail`（42 件）・`subdetail`（11 件）の使い分けと名前。
- **IB28 長いラベル**: 長いラベル（200 字超 1,729 件、複数行 371 件）を details へ移す整理。
- **IB29 同じ関係の重複**: 同じ関係が Final の map、Beta の複写、`docs/semantic` の 3 か所にある件。この migration では扱わない。
- **IB35 node ごとの「誰が」の attribute の整理**: 7 節でそのまま運んだものを、確定の表へ寄せて消すか。

実行時の構造にかかわるもの。

- **IB15 キャッシュの有効性の判定**: scope ごとに「その scope に影響した最後の確定の通し番号」を持つ。journal を scope で引ける索引が要る。
- **IB16 scope をまたぐ参照**: scope の木だけを読み込むと、参照先のラベルが手元に無い。参照先の最小限の情報を一緒に取る形。通知は DA20 で決めた。
- **IB17 scope のつながりの索引**: どの scope がどの scope の中にあるかを、木を走査せずに引く。
- **IB18 編集を Command として直接出す**: 第 1 段の画面は、基準の状態の写しと現在の状態の差分から Command を作っている。これは木を二つ持つ形で、DA31 と合わない。Undo も逆向きの Command にする。
- **IB20 scope をまたぐ機能**: 検索、map 全体の node 数、linear-text の書き出し、Deep の問い合わせは、サーバへの問い合わせにする。
- **IB21 「編集中」の範囲**: DA9 で詳細を取りに行く条件（編集中の node、その祖先、ほかに何を含めるか）。
- **IB23 キャッシュの置き場と上限**: 画面のメモリだけか、端末に残すか。保持する量の上限と捨てる順序。
- **IB31 全体保存の経路**: 全体保存を使う書き込みの経路が約 60 残っている。Command の経路へ移す。
- **IB40 大きな取り込みを隠す方法**: Community は database が一つなので、別の database で作って切り替える方法が使えない。実機で測って決める。

## 10. 残る問題

- **規模。** 保存は変更分だけになったが、画面は map 全体を読み込む。scope 単位の木とキャッシュに変えるのは、画面の作り直しを伴う別の仕事になる（IB18）。
- **移行の照合。** 意図して変える点（7 節）が増えるほど、想定外の欠落を見逃す余地が増える。形の変換だけを載せる原則（1 節）を守る。
- **種別と版。** details の形を種別ごとに持つので、形の変更の規則が種別の数だけ要る。
- **識別の寿命。** アカウント を消したとき、確定の表の発行者をどう表示するか。名前を変えたとき、過去の履歴の表示も変わる（レビュー）。
- **scope の意味の「folder」の払拭。** 保存データは migration で、コードは第 2 段のモデルの書き直しで、文書は一斉置換で消す。戻らないように、push 前の検査に項目を入れる。
