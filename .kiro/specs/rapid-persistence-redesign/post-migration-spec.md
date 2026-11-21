# 移行後のデータモデル仕様（案）

2026-11-17。状態: 案、未承認。一度きりの data migration を終えた後の、保存データの形と規則を書く。

- 本書は「移行後にこうなっている」を現在形で書く。決定の経緯、実測値、Neo4j 上の持ち方は [record-schema.md](./record-schema.md) にある。
- 承認されたら、[Data_Model.md](../../../docs/03_Spec/Data_Model.md) と [Model_State_And_Schema_V2.md](../../../docs/03_Spec/Model_State_And_Schema_V2.md) の該当部分を本書の内容で置き換える。それまでは現行の仕様が正本である。
- 用語は [Glossary](../../../docs/00_Home/Glossary.md) に従う。本書が Glossary に足す・改める語は 14 節にまとめた。
- 担当が決め打ちした箇所は 15 節にまとめた。akaghef の個別の承認は受けていない。

## 1. 範囲

本書が定めるのは、保存されるレコードの形、識別、不変条件、書き込みと読み込みの規則である。画面の表示、Layout の計算、Deep の問い合わせは範囲外とする。

## 2. 階層と識別

```
workspace > map > scope > node
```

- workspace は、保存データの入れ物であり、書き込みを確定する単位である。
- map は、一つの知識マップである。root の node を一つ持つ。
- scope は、map の中の構造の境界である。見える範囲、編集範囲、権限、読み込みの単位になる。
- node は、思考要素の最小単位である。

識別の規則:

- node、edge、scope、Surface View の保存設定、注釈の ID は、map と workspace をまたいで一意である。
- ID は作られた後に変わらない。消した ID は再利用しない。
- ID に意味を埋め込まない（種別の名前、本文、親の ID を含めない）。
- 保存エンジンが内部で振る ID は、外に出さない。

## 3. レコード

保存の単位はレコードである。各レコードは種別と key で一意に決まる。表の「省略」は、欄が無いときの読み方を示す。

### 3.1 map

key: `mapId`

| 欄 | 内容 | 省略 |
|---|---|---|
| `rootNodeId` | root の node | 必須 |
| tag・archive・pin | 一覧での分類と表示 | 無し |
| Vault との結び付き | 外部の Vault と同期する map の設定 | 結び付き無し |
| linear-text の表示設定 | 表示の有無と位置 | 既定 |

### 3.2 node

key: `nodeId`

| 欄 | 内容 | 省略 |
|---|---|---|
| `nodeType` | node の型。details の形を決める | `text` |
| `text` | map に載るラベル | 空 |
| `collapsed` | 子をたたんでいるか | false |
| attribute | key と値の組（3.5） | 無し |
| `rev` | このレコードを最後に変えた確定の通し番号 | 必須 |

- node は親・子・時刻・作成者を持たない。親子関係は parent edge が持つ。時刻と発行者は、`rev` から確定の表（3.13）を引く。
- `note` と `link` は details に持つ。
- 型定義に無い欄は、レコードの `extra` にそのまま持つ。

`nodeType` の一覧:

| 型 | 拘束 | details |
|---|---|---|
| `text` | 無し | Markdown の本文 |
| `alias` | 子を持てない。参照先が必須 | 無し。参照先、`aliasLabel`、`access` を持つ |
| `agent` | 無し | agent の種類、icon、model、役割、指すアカウント |
| `image` | 無し | 画像への参照（形は実装時に決める） |

- 型を新しく立てるのは、details の形か構造上の拘束が他と違うときだけである。分類の違いだけなら attribute にする。
- 型を足しても、既存のレコードは変換しない。
- HTML を載せる型は、登録済みの component の種類と設定だけを持つ。生の HTML は持たない。

### 3.3 details

key: `nodeId`

| 欄 | 内容 | 省略 |
|---|---|---|
| 形の版の番号 | この details がどの版の形か | 必須 |
| 内容 | `nodeType` ごとの形 | — |
| `rev` | 最後に変えた確定の通し番号 | 必須 |

- details は node とは別のレコードである。details を変えても、node の `rev` は変わらない。
- map の表示に要るのは node と edge だけで、details は必要になったときに読む。
- 内容が無い node は、details のレコードを持たない。

### 3.4 edge

key: `connectionId`

| 欄 | 内容 | 省略 |
|---|---|---|
| `kind` | `edge`（parent edge）か `GraphLink`（relation edge） | 必須 |
| `source` | 始点。parent edge では親 | 必須 |
| `target` | 終点。parent edge では子 | 必須 |
| `relationType` | 線の役割（7 節） | 役割無し |
| `label` | 線に表示する文字列 | 6 節の規則で表示 |
| 兄弟順キー | parent edge だけ。同じ親の下での並び順 | parent edge では必須 |
| 向き・線種・色・port | relation edge だけ。表示の設定 | 既定。port は値が無ければ自動 |
| attribute | key と値の組（3.5） | 無し |
| `rev` | 最後に変えた確定の通し番号 | 必須 |

- 端点は node か、他の edge である。
- parent edge も relation edge も、自分の ID と `relationType` を持つ。

### 3.5 attribute

持ち主（node または edge）のレコードの一部である。

- key は文字列で、`x:y` の形を使う（例: `m3e:style`）。
- 値は、文字列・数値・真偽・配列・入れ子のいずれかである。
- 独立した `rev` を持たない。持ち主の `rev` に従う。
- 値が null の attribute は存在しない。空文字は値である。
- snapshot と Command では、attribute を 1 件ずつ扱う。

### 3.6 scope

key: `scopeId`

| 欄 | 内容 | 省略 |
|---|---|---|
| `rootNodeId` | この scope の root の node | 必須 |
| `primarySurfaceId` | 既定の Surface View の保存設定 | 無し |
| `rev` | 最後に変えた確定の通し番号 | 必須 |

- scope は名前を持たない。scope の名前は、root の node のラベルである。

### 3.7 linear-text

key: `scopeId`

| 欄 | 内容 |
|---|---|
| `text` | その scope の長文 |
| `rev` | 最後に変えた確定の通し番号 |

### 3.8 Surface View の保存設定

key: `surfaceId`

| 欄 | 内容 |
|---|---|
| 所属 scope | `scopeId` |
| 種別 | Surface View の種別 |
| Layout、向き、間隔 | 表示の設定 |
| `rev` | 最後に変えた確定の通し番号 |

- 種別の値には、旧い語彙（`scatter`・`mindmap`・`logic-chart`・`timeline`）が残っている場合がある。対応が決まった時点で、通常の書き込みで直す。
- `surfaceId` は種別を含まない。

### 3.9 配置値

key: `surfaceId` と `nodeId` の組

| 欄 | 内容 |
|---|---|
| `x`、`y`、`flowCol`、`flowRow`、`shape` | その Surface View での node の配置 |

- 値が一つも無い配置値は、レコードを持たない。

### 3.10 注釈

key: `annotationId`

| 欄 | 内容 |
|---|---|
| 種別 | pen か text |
| 所属 scope | `scopeId` |
| 形状、色、太さ | 表示の設定 |

### 3.11 relationType の定義

key: relationType の名前

| 欄 | 内容 |
|---|---|
| 表示ラベル | 人に見せる名前 |
| 説明 | 役割の意味 |
| 読む向き | 始点から終点へ読むか、終点から始点へ読むか |

### 3.12 接頭辞の対応

key: 接頭辞（例: `rdfs`）

| 欄 | 内容 |
|---|---|
| 指す URI | その接頭辞が表す名前空間 |

### 3.13 アカウントと確定の表

用語は `.kiro/steering/agent_orrery_terminology.md` の Role・Actor Instance・session に従う。

アカウント（key: アカウントの ID）:

- 認証の単位である。書き込みの発行者になる。
- AI agent では、Actor Instance 一つがアカウント一つである。human では、その人一人がアカウント一つである。
- 登録のときに鍵を発行し、サーバはその鍵で接続を認証する。
- 識別には、既にある外部の ID を使う。
- 権限はアカウントに直接与えない。Role に与える。アカウントがどの Role を担うかは、アカウントの側で管理する。map 上の Role への alias は、それを見せるための表示である。アカウントは、ID、種別（AI agent / human）、表示名、外部の ID の一覧、担う Role の一覧を持つ。
- Team は M3E の語にしない。まとめて権限を与えたいときは Role を使う。

agent の node:

- アカウントは map の外にあるレコードで、専用の画面と機構で管理する。map の node が無くても、アカウントは存在する。
- `nodeType` が `agent` の node は、アカウントを map に表したものである。details に、指すアカウントを持つ。
- agent の一覧の map がある場合、agent の node の実体はそこに一つだけ置く。ほかの scope に現れる姿は、その実体を指す alias である。
- 発行者の識別に node の ID は使わない。node を消しても、名前を変えても、過去の確定の発行者は変わらない。
- alias は、別の map の node を指してよい。

確定の表（key: 通し番号）:

| 欄 | 内容 | 省略 |
|---|---|---|
| 確定時刻 | その確定が行われた時刻 | 必須 |
| 発行者 | アカウント | 必須 |
| session の ID | 観測の証拠として残す場合の値 | 無し |

- 確定 1 回につき 1 行である。node の数に比例しない。
- journal を圧縮しても、この表は残す。

## 4. 木と alias と relation edge

- 正本の配置は木である。root 以外の node は、親をちょうど一つ持つ。
- scope への所属、権限、削除の範囲、既定の並び順は、この木だけで決まる。
- node を別の場所から使うときは、alias を置く。alias は参照先の所属を変えない。
- 木以外の関係は relation edge で表す。relation edge は所属にも Layout にも影響しない。
- その場所に子として並べたいなら alias、関係があることだけを示すなら relation edge を使う。

親子の読み方:

- ある node の子は、`source` がその node である parent edge を集め、兄弟順キーで並べたものである。
- ある node の親は、`target` がその node である parent edge の `source` である。
- 子の配列は保存しない。

兄弟順キー:

- 並べるためだけの文字列で、文字列として比べる。
- 間に入れるときは、前後のキーの間のキーを作る。他の兄弟のキーは変えない。
- 書き込みを出す端末が作ってよい。
- 同じキーが二つあるときは、`connectionId` の順で並べる。

## 5. scope

- scope の境界は、scope のレコードがあることで表す。node の型には現れない。
- scopen は、scope のレコードを作る操作である。unscopen は、消す操作である。どちらも node の型を変えない。
- unscopen した後に同じ node をもう一度 scopen すると、別の `scopeId` の scope になる。前の scope の権限・linear-text・Surface View の保存設定は引き継がれない。
- node の所属は、「自分自身を含む祖先のうち、最も近い scope の root」が属する scope である。所属は保存しない。
- scope の root の node は、自分の scope に属する。親の scope には、入口として現れる。
- map の root の node は、その map の最上位の scope の root である。
- unscopen は、scope のレコードと一緒に、その linear-text と Surface View の保存設定を同じ確定で消す。

大きさの目安:

| node 数 | 扱い |
|---|---|
| 30 以下 | 基本の大きさ |
| 200 まで | 画面に収まる範囲 |
| 1,000 超 | 可視性がほぼ無い。通知するが、書き込みは拒まない |

## 6. 線の表示

1. edge に `label` があれば、それを表示する。
2. 無ければ、`relationType` の定義の表示ラベルを表示する。
3. それも無ければ、何も表示しない。

## 7. relationType

- 値は名前であり、名前が識別子である。一度使った名前は変えない。
- 名前には必ず接頭辞を付ける（例: `rdfs:subClassOf`、`m3e:consist-of`）。M3E の組み込みは `m3e:`、定義を用意せずにその場で作る名前は `misc:` である。移行で運んだ接頭辞の無い名前はそのまま残すが、新しくは作らない（record-schema DA28）。
- 許される名前の一覧は、スキーマに固定しない。定義のレコード（3.11）として持つ。
- 表示を変えるときは、定義の表示ラベルを書き換える。edge は書き換えない。
- 定義の無い名前も edge に書ける。最初に定義されているのは `m3e:consist-of`、`m3e:detail`、`rdfs:subClassOf`、`rdf:type` である。

## 8. 欄の省略

- node の `nodeType` と `collapsed` は、既定値と同じなら保存しない。この二つの既定値は変えない。
- それ以外の欄は、値があるときだけ保存する。
- attribute は、null を保存しない。空文字、false、0 は値として保存する。
- 欄を消す書き込みは、「変更前にあり、変更後に無い」で表す。

## 9. 不変条件

書き込みの確定時に検査する。一つでも破れる書き込みは、全体を拒否する。

1. root 以外の node は、入ってくる parent edge をちょうど 1 本持つ。map の root は持たない。
2. parent edge は循環しない。
3. alias は alias でない node を指す。alias は子を持たない。
4. edge の端点は実在する。端点を消す書き込みは、その edge も同じ確定で消す。
5. scope の root は実在する node である。alias は root になれない。一つの node が複数の scope の root になってよい。
5a. parent edge は実在する scope の ID を持つ。parent edge（親 a → 子 b、scope S）について、a が S の root であるか、a の親から来る parent edge の scope が S である（record-schema DA59）。
6. `connectionId` は、parent edge と relation edge をまたいで一意である。
7. details、linear-text、Surface View の保存設定、配置値、注釈は、指している node または scope が実在する。

検査は、触った周辺だけで行う。親の付け替えなら、新しい親の祖先をたどって循環を見る。

## 10. 書き込み

すべての書き込みは Command を通る。map 全体を書き直す経路は無い。

Command が運ぶもの:

| 欄 | 内容 |
|---|---|
| Command の ID | 出した側が作る。再送の判定に使う |
| 基準の通し番号 | 出した側が、どの時点の状態をもとに作ったか |
| 意図 | 何の操作か（例: node の追加） |
| 変更の一覧 | レコードごとの、変更前の値と変更後の値 |

- 発行者は Command に書かない。サーバが、認証済みの接続から決める。

確定の規則:

1. workspace ごとに、確定する側は一つである。
2. Command は 1 件ずつ順に、検査から確定までを通す。
3. 競合の判定は欄の単位で行う。変更前の値が現在の値と違う欄が一つでもあれば、拒否する。同じ node でも、触った欄が重ならなければ両方通る。
4. 検査を通した Command は、変えた欄だけを現在のレコードに当てる。
5. 確定のたびに、workspace で一本の通し番号が 1 増える。触ったレコードの `rev` は、その番号になる。
6. journal への追記が成功した時点が確定である。その後に保存エンジンへの反映が失敗しても、取り消さない。反映が追いつくまで、その workspace の次の確定を止める。

再送の規則:

- 確定済みの ID と同じ ID の Command には、最初の結果を返す。
- 同じ ID で中身が違う Command は、拒否する。
- 基準の通し番号が journal の圧縮より古い Command は、状態を取り直させてから受ける。

Undo は、逆向きの Command を出すことで行う。

## 11. 読み込みと通知

- 読み込みの単位は scope である。
- scope ごとに、整列済みの木をキャッシュしてよい。キャッシュは導出物であり、正本ではない。
- agent が scope に居る間（その scope を見ている間）は、その木を一つだけ持ち、直接編集する。
- 正本への保存は、scope を離れるのを待たずに行う。
- キャッシュは、実際に適用した通し番号を持つ。通知を受けただけで中身を取っていない部分には、古いという印を付ける。

通知:

- 確定のたびに、その scope に居る agent へ「scope、通し番号、変わった node の ID の一覧」を送る。本文は送らない。
- 受けた側は、自分が編集している node やその祖先に関係するときだけ、詳細を取る。
- alias の参照先のラベルが変わったときは、その alias がある scope にも通知する。
- 正しさは通知に頼らない。確定時の検査で守る。

居ること:

- どの agent がどの scope に居るかは、保存しない。サーバのメモリだけに持つ。
- 一つの agent が、同時に複数の scope に居てよい。

## 12. 正本と保存エンジン

- 正本は、journal（Command の追記専用の列）と snapshot（レコードを 1 行ずつ並べた、エンジンに依らない直列化）である。
- 保存エンジン（Neo4j）は、journal から作り直せる導出物である。
- 空のエンジンへ、snapshot と journal だけから復元できる。
- SQLite は、書き出しの形式として残る。

## 13. 保存しないもの

- 導出値: 子の配列、scope への所属、scope の名前
- 表示状態: 選択、camera、編集中の状態、どの agent がどの scope に居るか
- 作成時刻、更新時刻、作成者
- 既定値と同じ `nodeType`・`collapsed`、null の attribute
- 空の配置値

## 14. Glossary の改訂

承認時に、文書の一斉置換と一緒に行う。

| 語 | 改訂 |
|---|---|
| edge | 線の総称であり、レコードの種別とする |
| relationType | parent edge と relation edge の双方が持つ関係種別 |
| nodeType | 例から `folder` を除く |
| scope | 別表記の「folder」を廃止する |
| アカウント | 追加。認証の単位 |
| Role、Actor Instance | 用語の文書から Glossary へ上げる |
| rev、確定の表、兄弟順キー | 追加 |

## 15. 未承認の決め打ち

次の箇所は、担当が決め打ちした（record-schema.md の DA39〜DA53）。akaghef の個別の承認は受けていない。migration を実行する前に確認する。

- 3.2: `note`・`link` を details に持つこと、`extra`、HTML を載せる型
- 3.4: port の自動
- 3.6: 権限の欄を持たないこと
- 3.8: `surfaceId` の形
- 3.13: アカウントの欄、map をまたぐ alias
- 5 節: unscopen で消すもの
- 7 節: 定義の無い名前を書けること、最初の定義
