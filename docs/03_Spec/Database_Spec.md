# DB 仕様書

最終更新: 2026-11-19（freeze v1: on-disk format 2）

M3E の保存データ（DB）の仕様をまとめる。保存の形、識別、不変条件、書き込みと確定、journal と portable snapshot、Neo4j 上の持ち方、キャッシュ、拡張の仕組みを扱う。

## 0. この文書の位置付け

- 用語は [Glossary](../00_Home/Glossary.md) に従う。線は、総称を edge、親から子への線を parent edge、木の外の関係線を relation edge と呼ぶ。
- 決定の経緯と実測値は [record-schema.md](../../.kiro/specs/rapid-persistence-redesign/record-schema.md) にある。本書はその決定を、現在形の仕様としてまとめたものである。
- 基盤の決定は [ADR 014](../09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)。Neo4j は各端末の正本エンジン（semantic authority: invariant の検査と query）。durability authority（replication・backup・recovery の単位）は journal と portable snapshot。書き込みは Command だけ。
- 関連する文書
  - portable snapshot の行の形と、現行データからの変換規則: [snapshot-format.md](../../.kiro/specs/rapid-persistence-redesign/snapshot-format.md)
  - 移行後の規則の案: [post-migration-spec.md](../../.kiro/specs/rapid-persistence-redesign/post-migration-spec.md)
- 各節の状態を次の印で示す。

| 印 | 意味 |
|---|---|
| 【実装済み】 | `beta/src` に実装があり、試験か実データで確かめた |
| 【決定】 | 決まっているが、実装はまだ |
| 【仮決め】 | 二方向に戻せるので推奨で仮に決めたもの。実装ログに残す |
| 【提案】 | 未承認の案。承認されたら【決定】に改める |

### 現在の運用状態

- 通常の Beta は、まだ旧い保存（workspace ごとの SQLite に map 全体の JSON を置く形）で動いている。
- 本書の保存は【実装済み】だが、環境変数 `M3E_STORE_DIR` を設定したときだけ使う。個人の workspace の一度きりの移行と、通常の Beta の切り替えは、まだ行っていない。

## 1. 全体の構成

```
           書き込み（Command）
                 │
                 ▼
   ┌───────── 確定する側（workspace ごとに一つのサーバ）─────────┐
   │ 検査（不変条件・欄の競合） → journal へ追記・fsync ＝ 確定    │
   │ → メモリ上のレコードを更新 → 通知                            │
   └──────┬────────────────────────────────┬──────────────────┘
          │ 非同期に反映                    │ 圧縮のとき
          ▼                                 ▼
   Neo4j（各端末の正本エンジン）     snapshot.jsonl を書き直す
```

| 層 | 置き場 | 役割 | 状態 |
|---|---|---|---|
| portable snapshot | workspace のディレクトリの `snapshot.jsonl` | durability authority | 【実装済み】 |
| journal | 同じディレクトリの `journal.jsonl` | durability authority（redo log） | 【実装済み】 |
| 確定の索引 | 同じディレクトリの `commit-index.json` | 索引。圧縮のときに書き、journal と snapshot から作り直せる | 【実装済み】 |
| 実行時のレコード | 確定する側のサーバのメモリ | 実行時の状態。replay で作り直せる | 【実装済み】 |
| Neo4j | 端末ごとの Neo4j | 正本エンジン（semantic authority: invariant の検査と query）。同期しない。backup の対象にしない。base snapshot と log suffix の replay で再構築する | 【決定】。【実装済み】のものは確定後に反映する mirror で、invariant の検査はサーバのメモリで行っている |
| SQLite | 書き出しの形式 | 正本ではない | 【決定】 |

- Neo4j・索引・実行時のレコードが journal と portable snapshot と食い違ったら、replay で作り直す。journal と snapshot の側を直さない。
- 空のエンジンへ、最新の base snapshot と、それより後の journal（log suffix）の replay だけで復元できる（6 節）。

## 2. 階層と識別

```
workspace > map > scope > node
```

- workspace は、保存データの入れ物であり、書き込みを確定する単位である。
- 【決定】（akaghef、2026-11-18。[sync-principles](../../.kiro/specs/rapid-persistence-redesign/sync-principles.md)「remote と local」「データの形」）remote は workspace ごとにちょうど一つあり、確定の全順序はそこで付ける（single-leader）。確定の記録が journal で、workspace ごとに一本である。remote の sequencer が `seq` を振る。
- local の commit は確定ではない。端末は、未確定の Command を outbox に積む。
- 【実装済み】journal は workspace ごとに一つである。local outbox は無い。
- node・edge・scope・Surface View の保存設定・注釈の ID は、map と workspace をまたいで一意である。
- ID は作った後に変えない。消した ID は再利用しない。ただし Undo による復活の扱いは未決（12 節）。
- ID に意味を埋め込まない。種別の名前、本文、親の ID を含めない。
- 保存エンジンが内部で振る ID（Neo4j の内部 ID など）は、外に出さない。
- 【実装済み】移行で振り直す ID は、決定的に作る。形は「接頭辞 ＋ `sha256("<workspace>|<map>|<種別>|<種>")` の先頭 24 桁」。接頭辞は node が `n_`、edge が `c_`、scope が `s_`、Surface View が `v_`、注釈が `a_`。旧い ID との対応は `idMap` のレコードに残す（snapshot-format 3.1）。

## 3. レコード

保存の単位はレコードである。各レコードは種別と key で一意に決まる。portable snapshot では 1 レコードが 1 行になる。

### 3.1 一覧【実装済み】

| 種別（`kind`） | key | 主な欄 |
|---|---|---|
| `snapshot` | （1 行目） | `format`（schemaVersion）、`workspaceId`、`seq`（この snapshot が含む最後の通し番号） |
| `map` | `id` | `rootNodeId`、`tags`、`archived`、`pinned`、`source`、linear-text の表示設定、`extra`、`rev` |
| `node` | `id` | `mapId`、`nodeType`、`text`（ラベル）、`collapsed`、`attributes`、`alias`、`extra`、`rev` |
| `details` | `nodeId` | `mapId`、`v`（形の版）、`body`（Markdown の本文）、`note`、`link`、`rev` |
| `connection`（edge） | `id` | `mapId`、`type`、`source`、`target`、`label`、`rev`。種類ごとの欄は 3.4 |
| `scope` | `id` | `mapId`、`rootNodeId`、`label`、`primarySurfaceId`、`rev` |
| `linearText` | `scopeId`（または `mapId` ＋ `orphanKey`） | `text`、`anchorNodeId`、`rev` |
| `surface` | `id` | `mapId`、`scopeId`、`surfaceKind`、`layout`、`surfaceView`、`rev` |
| `nodeView` | `surfaceId` ＋ `nodeId` | `x`、`y`、`flowCol`、`flowRow`、`shape` |
| `annotation` | `id` | `mapId`、`scopeId`、`annotationKind`（pen / text）、形状・色・太さ、`extra`、`rev` |
| `relationTypeDef` | `name` | `label`、`description`、`reads`（`source-to-target` / `target-to-source`）、`rev` |
| `prefix` | `prefix` | `uri`、`rev` |
| `account` | `id` | `accountKind`（`ai-agent` / `human` / `system`）、`displayName`、`externalIds`、`roles`、`rev` |
| `commit` | `seq` | `committedAt`、`issuer`（アカウントの ID）、`sessionId` |
| `idMap` | `recordKind` ＋ `mapId` ＋ `oldId` | `newId` |
| `extensionDef` | `name` ＋ `version` | 【決定】`target`、`fields`、`render`、`label`、`description`、`rev`（10.2） |

- `rev` は、そのレコードを最後に変えた確定の通し番号である。`commit`・`idMap`・`nodeView`・1 行目は持たない。`nodeView` は、属する Surface View の `rev` に従う。
- `extra` は、型定義に無い欄をそのまま入れる組である。知らない欄を捨てないために使う。
- 【決定】（freeze v1、akaghef、2026-11-19）format 2 で足すもの: `extensionDef` のレコード、node と edge の `extensions`（10.4）、parent edge の `relationType` と `attributes`（3.4）。【実装済み】のものは format 1 である。

### 3.2 node

- node は、親・子・作成時刻・更新時刻・作成者を持たない。親子関係は parent edge が持つ。時刻と発行者は、`rev` から確定の表（`commit`）を引く。
- 決まった欄（`nodeType`、`collapsed`）は、既定値（`text`、false）と同じなら保存しない。既定値は変えない。
- `alias` は、参照先 `target`、表示名 `label`、`access`（read / write）、参照先のラベルの cache（`snapshotLabel`）、`broken` を持つ。
- 【決定】（同期の要件 R2.6）node と scope はロックを持つ。ロックが掛かっている間は、削除と移動の Command を確定しない。誤操作の防止のためで、権限の代わりではない。掛けた本人も外せる。状態を持つ欄と、ロックが及ぶ範囲は未決（12 節）。
- `nodeType` の値【実装済み】は `text`、`alias`、`image` と、移行で運んだそれ以外の値である。種別の扱いは 10 節で改める（【決定】）。【仮決め】format 2 では `nodeType` を残し、描画器の選択子として使う。`extensions` との統合は、次の format の bump で行う。

### 3.3 attribute

- 持ち主（node または edge）のレコードの一部であり、独立した `rev` を持たない。
- key は文字列で、接頭辞の付いた形を使う（例: `m3e:style`、`misc:mood`。規則は 3.8）。移行で運んだ接頭辞の無い key も、そのまま残す。
- 値は、文字列・数値・真偽・配列・入れ子のいずれかである。null は保存しない。空文字・false・0 は値として残す。
- portable snapshot と Command では、attribute を 1 件ずつ扱う。
- 欄が無いことは、未設定・未観測を表す。値の 0 と区別する。
- 【決定】（freeze v1、akaghef、2026-11-19）拡張の欄（10.3）だけは、確定のときに定義の型で検査する（schema-on-write）。それ以外の attribute は型を問わない（schema-on-read）。型の語彙は 10.7。

### 3.4 edge

| 欄 | parent edge（`type: "edge"`） | relation edge（`type: "graphlink"`） |
|---|---|---|
| `source` / `target` | 親 / 子。node に限る | 始点 / 終点。node か、他の edge |
| 兄弟順キー `ord` | 必須 | 持たない |
| `scopeId` | 必須。この parent edge が載る scope | 持たない（両端から導く） |
| `relationType` | 【決定】持つ（format 2）。【実装済み】の形には欄が無い | 持つ |
| `label` | 持つ | 持つ |
| 向き・線種・色・port | 持たない | 持つ。port は、値が無ければ自動 |
| `attributes` | 【決定】持つ（format 2）。【実装済み】の形には欄が無い | 持つ |
| `extensions` | 【決定】持つ（10.4） | 【決定】持つ（10.4） |

- `connectionId`（edge の `id`）は、parent edge と relation edge をまたいで一意である。
- ある node の子は、`source` がその node である parent edge を集め、`ord` で並べたものである。子の配列は保存しない。
- 【決定】（akaghef、2026-11-19、操作の代数の要件 8 節）兄弟順キー `ord` の規則:
  - `ord` は `fractional-indexing` ライブラリの base62 の key である（`0-9A-Za-z`。整数部の長さを表す頭文字に小数部が続き、末尾は `0` にならない）。文字列として code unit の順で比べる。
  - 間に入れるときは、前後の key の間の key を作る。複数選択のブロックは `generateNKeysBetween` で一括に作り、ブロックどうしを交互に混ぜない（non-interleaving）。
  - key を決めるのは確定する側で、決めるのは新規と移動の対象自身の key だけである。他の兄弟の key は変えない。順序の決着（tie-break）に ID を使わない。
  - 同じ親の下で `ord` は一意である（4 節の不変条件 9）。
  - 等しい `ord` は移行前のデータにだけ起こりうる。その間へ入れる Command は、等しい key を持つ兄弟の振り直しを同じ Command に含める。他の兄弟の key を変えない規則の、唯一の例外である。2026-11-19 に 3 workspace の最新の退避コピー（65 map、49,923 本の parent edge）を読み取り専用で変換して数えた結果、重複は 0 件、無効な key も 0 件だった（保存データは `ord` を持たず、変換で子の並びから作るため）。この例外は防御のためだけに残す。
  - 以前の base36 の key は有効な key ではない。読み込んだ時点で振り直す（一度だけの移行）。
  - 同じ node への同時の move は、`seq` の順で後に確定した有効なものを採る（LWW。5.2 規則 9）。cycle を作る move は拒否する。基準にした兄弟が消えていたら、右隣の直前 → 左隣の直後 → 末尾の順で位置を決める。
- 【決定】（同期の要件 R3.4、暫定）relation edge を可視化し配送するのは、両端が同じ scope にあるときだけである。履歴を格納する先は、source 側の scope である。
- 線の表示: `label` があればそれを、無ければ relationType の定義の表示ラベルを、それも無ければ何も表示しない。

### 3.5 scope

- scope は、map の対象を一枚の面で切り出したものである。scope の境界は、scope のレコードがあることで表す。node の型には現れない。
- scopen は scope のレコードを作る操作、unscopen は消す操作である。unscopen してからもう一度 scopen すると、別の ID の scope になる。
- 各 parent edge は、自分が載る scope の ID を持つ（【実装済み】）。node がふつうに属する scope は、親から来る parent edge の scope である。map の root は、root の scope に属する。
- scope の root の node は、自分の scope の頂点として現れ、ふつうに属する scope では入口として現れる。
- 一つの node が、複数の scope の root になってよい（【決定】。アプリは、まだ一つの node から一つの面だけを開ける）。
- scope の名前は `label`。無ければ root の node のラベルを名前とする。
- unscopen は、その scope に載る parent edge を、root の親から来る parent edge の scope に付け替える。その scope の linear-text と Surface View の保存設定は、同じ確定で消す。
- relation edge は scope の ID を持たない。両端が同じ面にあればその面に載り、違えば両端が見えている面でだけ描く。

### 3.6 relationType と接頭辞

- relationType の値は名前で、名前が識別子である。一度使った名前は変えない。
- 名前は接頭辞の付いた形（例 `rdfs:subClassOf`、`m3e:consist-of`、`misc:uses`）である。接頭辞の規則は 3.8。
- 表示ラベル・説明・読む向きは、定義のレコード（`relationTypeDef`）に置く。読む向きは、RDF へ書き出すときに主語と目的語を取り違えないために要る。
- 定義の無い名前も書ける。最初から入れる定義は `m3e:consist-of`、`m3e:detail`、`rdfs:subClassOf`、`rdf:type` の四つと、接頭辞 `rdf`・`rdfs` の対応である。

### 3.7 アカウントと確定の表

- アカウントは認証の単位であり、書き込みの発行者になる。AI agent では Actor Instance 一つ、human ではその人一人が、アカウント一つである。
- 権限はアカウントに直接与えず、Role に与える。アカウントは map の外のレコードで、map の node が無くても存在する。
- 確定の表（`commit`）は、確定 1 回につき 1 行で、確定時刻・発行者・session の ID（任意）を持つ。journal を圧縮しても残す。
- 移行のときに、発行者の記録が無い過去の分を表すアカウント「移行」（`acct_migration`）を一つ作る。

### 3.8 名前の接頭辞

relationType の名前、拡張の定義の名前（10 節）、attribute の key は、すべて接頭辞を付ける。

| 接頭辞 | 使う場面 |
|---|---|
| `m3e:` | M3E が組み込みで定義する名前 |
| 借りてきた語彙の接頭辞（`rdf:`、`rdfs:` など） | 外の語彙の名前。接頭辞の対応（`prefix`）に登録する |
| 利用者の接頭辞（`vault:` など） | 機能や利用者がまとまった語彙として定義する名前 |
| `misc:` | 定義を用意せずにその場で作る名前。必ずこれを付ける |

- 接頭辞の無い名前は新しく作らない。接頭辞の無い名前が乱雑に増えると、同じ意味の名前の重複や、どこから来た名前かの区別がつかなくなるためである。
- `misc:` の名前は、後でまとまった語彙に昇格させてよい。昇格は、名前を使っている edge や attribute の値を Command で書き換えて行う（journal に残る）。
- 移行で運んだ接頭辞の無い名前（attribute の key、relation edge の relationType の値）は、そのまま残す。新しく作ることだけを禁じる。整理は後で Command で行う。
- 【実装済み】MCP では、接頭辞の無い relationType と、node にまだ無い接頭辞の無い attribute の key を拒否する。既にある key の更新と削除は受け付ける。viewer での入力には、まだ掛けていない。

## 4. 不変条件【実装済み】（9・10 は【決定】）

確定のときに検査する。一つでも破る書き込みは、全体を拒否する。

1. root 以外の node は、入ってくる parent edge をちょうど 1 本持つ。map の root は持たない。
2. parent edge は循環しない。
3. alias は alias でない node を指す。alias は子を持たない。
4. edge の端点は実在する。端点を消す書き込みは、その edge も同じ確定で消す。
5. scope の root は実在する node である。alias は root になれない。
6. parent edge は実在する scope の ID を持つ。parent edge（親 a → 子 b、scope S）について、a が S の root であるか、a の親から来る parent edge の scope が S である。これで、一つの scope に載る parent edge は、その root を頂点とする 1 本の木になる。
7. `connectionId` は、parent edge と relation edge をまたいで一意である。
8. details、linear-text、Surface View の保存設定、配置値、注釈は、指している node または scope が実在する。
9. 【決定】（freeze v1、akaghef、2026-11-19）同じ親の下で、parent edge の `ord` は一意である。
10. 【決定】（freeze v1、akaghef、2026-11-19）`extensions` にある拡張は、定義の required の欄がそろい、欄の型が合う（10.4）。定義が無い拡張は検査しない。

- 【決定】検査は、触った周辺だけで行い、map 全体は走査しない。【実装済み】のものは、確定のたびに map 全体を検査している。
- 【決定】一つの Command の中に複数の付け替えがあるときは、全部を当てた後の状態で循環を検査する。

## 5. 書き込みと確定

### 5.1 Command【実装済み】

すべての書き込みは Command を通る。【決定】移行後は、map 全体を書き直す経路を残さない。

| 欄 | 内容 |
|---|---|
| Command の ID | 出した側が作る。再送の判定に使う |
| 基準 | 出した側が、どの時点の状態をもとに作ったか |
| 意図 | 何の操作か |
| 変更の一覧 | レコードごとの、変更前の値と変更後の値 |

- 発行者は Command に書かない。【決定】サーバが認証済みの接続から決める（【実装済み】のものは、まだ端末の申告を使っている）。

### 5.2 確定の規則【実装済み】

1. workspace ごとに、確定する側は一つである。
2. Command は 1 件ずつ順に、検査から確定までを通す。
3. 競合は欄の単位で判定する。変更前の値が現在の値と違う欄が一つでもあれば拒否する。同じ node でも、触った欄が重ならなければ両方通る。
4. 検査を通した Command は、変えた欄だけを現在のレコードに当てる。欄の削除は「変更前にあって変更後に無い」で表す。
5. 確定のたびに、workspace で一本の通し番号が 1 増える。触ったレコードの `rev` は、その番号になる。
6. journal への追記と fsync が成功した時点が確定である。その後に Neo4j への反映が失敗しても取り消さない。反映は再試行し、Neo4j の遅れが上限（既定 10,000 確定）を超えたら、次の確定を `ENGINE_BEHIND` で拒否する。
7. 【決定】（同期の要件 R5.3）fsync 済みで未適用の確定があるあいだは、古い Neo4j の状態で次の Command を検査しない。
8. 【決定】（同期の要件 R2.4）scope をまたぐ移動は、当面実装しない。remote は、未対応として拒否する。
9. 【決定】（freeze v1、akaghef、2026-11-19）同じ node への同時の move は、`seq` の順の LWW で決める（後に確定した有効な move が勝つ）。cycle を作る move は拒否する（不変条件 2）。基準にした兄弟が消えていたときの位置は 3.4。

- 確定点は、remote の journal への fsync である（同期の要件の Q1 は、二媒体なしの暫定）。媒体を失ったら、復旧した地点と、欠けたかもしれない範囲を示す（R5.1）。
- 復旧の正本から戻す対象には、権限、未解決の conflict、Command の結果、世代、端末の失効、消去の状態を含める（R5.5）。

拒否の種類: `NOT_FOUND`、`CONFLICT`（欄の競合）、`INVALID_STATE`（不変条件）、`INVALID_COMMAND`、`SAME_ID_DIFFERENT_CONTENT`、`ENGINE_BEHIND`。

### 5.3 再送【実装済み】

- 確定済みの ID と同じ ID の Command には、最初の結果を返す。
- 同じ ID で中身が違う Command は拒否する。中身は、変更の一覧の正規化した JSON の sha256 で比べる。
- 【決定】基準が journal の圧縮より古い Command は、状態を取り直させてから受ける。

Undo は、逆向きの Command を出すことで行う。

### 5.4 一部だけ読んだ状態からの書き込み【仮決め】

projection（10.6）で、node の attribute の一部だけを読んだ client が書き込むときの扱いである。読んでいない attribute は差分に現れないので、保存しても消えない（【実装済み】）。

- 読んでいない key と同じ key の作成は、CONFLICT のままにする。expected-absent の CAS が失敗しているので、意味として正しい。
  - そのうえで、projection の応答に、node ごとに省いた key の名前を返す。値は返さない（sparse fieldset の presence 情報）。
  - client は、それを見て、作成ではなく更新を送る。
- 読んでいない attribute を持つ node の削除は、attribute ごとの差分ではなく、record 単位の delete（tombstone）にする。
  - 前提として照合するのは、node の `rev` だけである。読んでいない attribute も一緒に消える。
  - Undo は、record の pre-image で戻す。

## 6. journal【実装済み】（format 2 の envelope と retention は【決定】）

- UTF-8 の JSON Lines。1 行が 1 回の確定である。
- 1 行の欄（envelope）。`touched` と `provenance` の形は【決定】（freeze v1、akaghef、2026-11-19）、それ以外は【実装済み】:

| 欄 | 型 | 内容 |
|---|---|---|
| `seq` | int | 通し番号。0 < seq ≤ 2^53−1。workspace で全順序 |
| `committedAt` | time | 確定時刻（10.7 の time の形） |
| `issuer` | string | 発行者のアカウント |
| `sessionId` | string | 任意 |
| `commandId` | string | Command の ID（idempotency key） |
| `mapId` | string | 対象の map |
| `intent` | string | 意図 |
| `actor` | object | 出した側の情報 |
| `changes` | array | 送られた変更の一覧（監査と Undo のため） |
| `changesHash` | string | `changes` の sha256（再送の比較） |
| `mapOp`、`newMapId` | string | map の削除・改名・一覧の欄だけの変更のとき |
| `ops` | array | レコードへの操作の列（`put` / `delete`、レコードの key、post-image）。redo log |
| `touched` | `[{rk, ev: string[]}]` | その確定で canonical な値に実差分が出たレコードと、event kind |
| `provenance` | `{items, truncated?}` | その確定が採用した出所 |

- journal の行は schemaVersion を持たない。版は、切り替えの時点（base snapshot の header の `format` と `seq`）だけで決まる。
- `seq`・`committedAt`・`issuer`・`touched` は envelope-stable な欄で、どの format でも意味を変えない。
- `touched` の規則:
  - 確定のときに、サーバが `ops` と pre-image の diff から決定的に作る。client の申告は受けない。
  - 正規化した後の比較で、`rev` だけの差分は入れない。計算で求まる値（有効な極性など）だけが変わった子孫も入れない。
  - rk の文字列順に並べ、重複させない。
  - event kind は接頭辞の付いた名前の開いた集合で、最初の値は `m3e:create`、`m3e:delete`、`m3e:content`（`text`・本文）、`m3e:attribute`、`m3e:structure`（parent edge・`ord`・scope の付け替え）、`m3e:extension`（拡張の付け外し）、`m3e:target`（目標の更新間隔の変更）。読み手は知らない kind を無視する。
- 【仮決め】`provenance.items` の要素は `{mode: "observed" | "declared", rk, rev}`。上限は 100 件で、超えたら `truncated: true` にする。長く残す来歴は record の側に持つ（下）。
- 【仮決め】`changes` と `ops` の二重持ちは、format 2 では解消しない。replay の決定性を確かめる試験ができてから扱う。
- 【実装済み】`touched` は、サーバが `ops` と pre-image から作り、rk の順に並べ、`rev` だけの差分を除く。決定との差が 3 点ある。
  - snapshot の `format` は、まだ 1 である。format 2 への bump は、ほかの format の変更と合わせて base snapshot で行う。
  - `provenance` は、まだ Command の値（`{contextId, tool}`）のままで、決めた形 `{items, truncated?}` ではない。
  - 位置の変更は、`touched` で `m3e:content` に数えている。

- 開くとき、末尾の書きかけの行は切り捨てる。途中の行が壊れていれば、開くのを止める。通し番号の飛びも止める。
- 【決定】（akaghef、2026-11-19）log compaction は何も消さない。封じた journal の segment は archive へ移す。
- 【実装済み】圧縮（`compact`）の手順（`beta/src/node/record_store/journal_archive.ts`、`store.ts`）:
  - 今の journal と、置き換える snapshot を `archive/` へ hard link する。link が使えない場所では copy する。名前は `journal.<from>-<to>.f<format>.jsonl` と `snapshot.<seq>.f<format>.jsonl`。`archive/index.json` に、各 file を archive した時刻を残す。
  - その時点の全レコードで `snapshot.jsonl` を書き直し、journal を空にする。
  - `commit-index.json` に、map ごとの最後の確定、確定済みの Command の ID（直近 100,000 件）、新しい snapshot の `{seq, sha256}`（`snapshot` の欄）を書く。
  - 圧縮した後、Neo4j の追いつきと、確定済みの Command の行の読み出し（`committedCommand`）は archive を読む。再送の判定は、archive ではなく `commit-index.json` の Command の ID と hash（直近 100,000 件）で行う。
- 【実装済み】契機: snapshot より後の journal が 50,000 行に達したとき（環境変数 `M3E_COMPACT_AFTER_LINES`、0 で止める）。確定の直後と、開いたときに判定する。圧縮と retention の失敗は確定を失敗にしない。
- 【決定】（freeze v1、akaghef、2026-11-19）schemaVersion を上げるたびに、移行した直後の portable snapshot を base snapshot として書く。replay を保証するのは、最新の base snapshot から後だけである。それより前の journal を新しい format へ書き換える upcasting はしない。compaction の契機は replay の長さで決める（値は未決、12 節）。
- 【決定】（akaghef、2026-11-19）【実装済み】archive の segment は、archive へ移してから 90 日で削除する（retention の操作。圧縮のあとと、開いたときに走る）。削除できるのは、次の二つを満たす segment だけである。
  - その範囲を覆う base snapshot か portable snapshot が fsync 済みで、checksum を検証済みである。
  - archive へ移してから 90 日を過ぎている。
  - 検証に失敗したら、消さずに止める。
- PITR の窓は、最新の snapshot と 90 日分の archive である。
- 書かれる頻度は、journal から作り直せない。そのため、減衰する量の累積は portable snapshot に状態として持つ（9 節）。envelope-stable な欄（`seq`・`committedAt`・`issuer`・確定ごとに触れたレコードと event kind）は、90 日の窓の中での集計に使う。
- copy の来歴と provenance は、journal ではなく record の側（attribute か専用の欄）に持つ。compaction と削除で失われないようにするためである。
- 複製は、三つのファイルを一度に写す。確定と圧縮は同期処理なので、複製の途中に確定が入らない。

## 7. portable snapshot【実装済み】

- workspace 一つにつき一つの、UTF-8 の JSON Lines。1 行が 1 レコード。
- 1 行目は `{"kind":"snapshot","format":1,"workspaceId":"…","seq":…}`。
- 【決定】（freeze v1、akaghef、2026-11-19）freeze v1 の形は `format: 2` である。`format` を上げた直後の snapshot が base snapshot で、header の `{format, seq}` が版の切り替え点の記録になる。
- 【決定】（freeze v1、akaghef、2026-11-19）減衰する量の累積 `{v[k], t}` は、portable snapshot に状態として持つ（9 節）。
- 値の無い欄と null は書かない。
- 並びは `kind`、次に key の文字列順。行の順序に意味は無いが、差分を安定させるために揃える。
- 現行データからの変換規則と、逆変換で許す差は snapshot-format 3〜4 節に従う。

## 8. Neo4j 上の持ち方【実装済み】

Neo4j は各端末の正本エンジン（semantic authority）であり、durability authority ではない。壊れたら、base snapshot と log suffix の replay で作り直す。ここでの持ち方は、保存の形（3 節）とは独立に変えてよい。

### 8.1 レコードを node にする

- すべてのレコードを、Neo4j の node 一つにする。ラベルは共通の `Rec` と、種別ごとのラベル（`Map`、`M3eNode`、`Details`、`Connection`、`Scope`、`LinearText`、`Surface`、`NodeView`、`Annotation`、`RelationTypeDef`、`Prefix`、`Account`、`Commit`、`IdMap`、`Snapshot`）。
- edge も node にする。edge が他の edge の端点になれるようにするためと、種別をまたいだ ID の一意を一つの制約で守るためである。線として持つ形に比べ、問い合わせは 1.1〜2 倍、大きさは 1.14 倍で、実用の範囲に収まる。

### 8.2 property

| property | 内容 |
|---|---|
| `rk` | `<kind>|<key>`。全レコードで一意（一意制約 `rec_rk`） |
| `kind`、`id` | 種別と ID（`id` に索引） |
| `o` | 元の行の欄の並び |
| `f_<欄>` | Neo4j がそのまま持てる値（文字列・真偽・数値・同じ型だけの配列） |
| `j_<欄>` | それ以外の値を JSON の文字列にしたもの |
| `a_<key>` / `aj_<key>`、`ao` | attribute の 1 件（そのまま / JSON）と、key の並び |
| `x_<key>` / `xj_<key>`、`xo` | `extra` の 1 件と、key の並び |
| `j` | レコード全体の JSON（欄の名前が Neo4j で使えない場合だけ） |

- 数値: 安全な範囲の整数は Integer、それ以外は Float にする。これで元の JSON の文字列に戻る。Neo4j の Integer は 64 bit なので、読み込みの境界で 2^53−1 以下であることを確かめて数値に変える。
- 【決定】（freeze v1、akaghef、2026-11-19）時刻は、canonical な形（ISO 8601 の文字列）に加えて、epoch ミリ秒の整数を持つ。
- 【決定】（freeze v1、akaghef、2026-11-19）`extensions` の名前は、node のラベルにも写す（10.4）。
- 索引: `rk` の一意制約、`id`、参照を引く欄（`f_source`、`f_target`、`f_rootNodeId`、`f_nodeId`、`f_scopeId`、`f_surfaceId`、`f_mapId`）。索引が無いと、どの問い合わせも 180〜610 ms かかる。
- 索引に載せる値の上限は UTF-8 で 8,164 バイト（範囲索引と一意制約）、文字列索引は 32,766 バイト。

### 8.3 relationship

relationship は property から作る索引で、読み戻しには使わない。問い合わせのためにある。

| 型 | 向き | 意味 |
|---|---|---|
| `SOURCE` | 始点 → edge | edge の始点 |
| `TARGET` | edge → 終点 | edge の終点 |
| `ROOT` | scope → node | scope の root |
| `OF` | details → node | どの node の details か |
| `IN` | Surface View → scope | 所属 scope |
| `ON` / `PLACES` | 配置値 → Surface View / node | どの表示で、どの node を置くか |
| `ALIAS_OF` | alias → 参照先 | 参照先から alias を逆にたどれる |
| `IN_MAP` | レコード → map | 所属 map |

- 反映した位置は、`RecordStoreMarker` の node の `appliedSeq` に持つ。
- 実データでの確かめ: 3 workspace（最大 100,268 レコード、28.1 MB）を取り込み、読み戻した結果がバイト単位で一致した。

## 9. キャッシュ（計算で求まる値）【提案】

思想は [Engine.md](../01_Vision/Engine.md) と [LLM_Workbench.md](../01_Vision/LLM_Workbench.md) にある。

- 正本から計算で求まる値は、正本に入れない。
- 確定のときに計算し、サーバの手元にキャッシュする。agent は読むだけで、計算を待つ必要も、計算方法を知る必要もない。Neo4j にも置く。
- 時間で減る値（活動など）は、最後に確定したときの値と時刻だけを持ち、読むときに掛け算 1 回で今の値を出す。
- 【決定】（freeze v1、akaghef、2026-11-19）減衰する量の累積 `{v[k], t}`（尺度 k ごとの累積と最終時刻）は、計算で求まる値ではなく、portable snapshot に持つ状態である。journal は 90 日で削除するので、作り直せないからである（6 節）。
- 計算し直すきっかけ（親の変更、edge の変更、部分木の移動など）は、値の定義に書く。

候補:

| 値 | 付く先 | 求め方 |
|---|---|---|
| 有効な極性 | node | root からの主木の経路上で、反転する parent edge の数の偶奇 |
| 活動 | node・scope | 確定が触るたびに、時間で減る累積に 1 を足す |
| 体積 | scope | その面に載る node の数 |
| 温度 | node・scope | 曖昧さ。式は未決 |

## 10. 拡張の仕組み【決定】（freeze v1、akaghef、2026-11-19）

task や極性のような意味を、保存の形を作り直さずに足すための土台である。

### 10.1 プレーンと拡張

- node はすべて、同じ芯を持つ（プレーン）。芯は ID、`text`（ラベル）、本文（Markdown）、attribute、`rev` である。
- 構造の拘束が違うものだけを、芯の種類として残す。芯の種類はプレーンと alias の二つである。alias は子を持てず、参照先が必須だからである。
- task や agent などは、プレーンに重ねる拡張である。拡張をいくつ付け外ししても、芯は変わらない。

### 10.2 拡張の定義

- 拡張は、定義のレコードで決める。定義の名前は「接頭辞:分類:名前」の三段である。分類は、何に付くかを表す。

| 分類 | 付く先 | 例 |
|---|---|---|
| `nodeType` | node | `m3e:nodeType:task`、`m3e:nodeType:agent`、`m3e:nodeType:image` |
| `parentEdge` | parent edge | `m3e:parentEdge:polarity` |
| `relationEdge` | relation edge | （まだ例が無い） |

- 定義はレコード `extensionDef` である:

```
{kind:"extensionDef", name:"m3e:nodeType:task", version:1,
 target:"node" | "parentEdge" | "relationEdge",
 label?, description?,
 fields:[{name, type, required?, default?, values?, ref?}],
 render?:{attributes:[...], size:"text" | "fixed" | "attribute"},
 rev}
```

- key は `name` と `version` の組である。同じ名前の複数の版が並んで存在できる。
- 同じ `name`・`version` で中身が違う定義は CONFLICT にする。`misc:` も例外にしない。
- 拡張は、agent を含む誰でも定義できる。権限の検査は後で足す。
- 意味上の分類（Principle、Vision、Strategy、Goal、Task など）も、`m3e:nodeType:<分類>` の拡張として持つ。
- 名前は Turtle の接頭辞付きの名前として読める（接頭辞 `m3e`、名前 `nodeType:task`）。
- relationType の名前は、外の語彙と合わせる識別子なので、三段にしない。
- `m3e:` は M3E の組み込み、それ以外の接頭辞は利用者（agent を含む）が定義した拡張である。定義を作らずにその場で使う名前は `misc:` にする（3.8）。

### 10.3 値の置き場

- 拡張の欄の値は、attribute に置く。key は定義の名前に `/` と欄の名前を足したもの（例 `m3e:nodeType:task/status`）。拡張は、attribute の名前空間に型を被せたものである。
- 新しい保存の仕組みは要らない。attribute の扱い（3.3）がそのまま使える。
- 値の検査は、定義を読む共通の検査器が確定のときに行う（不変条件 10）。
- 定義の無い拡張の値と、適用中の一覧は、捨てずに残す。
- key に版は入れない。版の移行は、値の書き換えを含む明示の Command で行う。定義の新しい版を足しても、古い版で適用した値を読み替えない。

### 10.4 種別の変更

- node・parent edge・relation edge が今どの拡張を持つかは、`extensions` の欄に持つ。要素は `name@version` で、文字列順の集合とし、同じ名前は一つまでにする。一つの node に複数の拡張を重ねてよい。
- 拡張は、required の欄がそろうまで有効にならない。そろわない付与の Command は拒否する。
- 種別の変更は、この集合への追加・削除として、一つの Command で行う。node の ID、edge、alias からの参照、attribute は保たれる。
- 拡張を外しても、その名前空間の値は残す。戻せば元どおりになる。
- 本文から新しい拡張の欄を読み取るのは agent の仕事で、アプリは形の検査だけを行う。読み取れない欄は空のままでよい。
- alias との間の変更はしない（芯の種類が違う）。
- Neo4j では、拡張の名前の集合を node のラベルに写す。複数のラベルを持てるので、そのまま表せる。

### 10.5 最初の拡張

- `m3e:nodeType:task`: 状態（`open`・`in_progress`・`blocked`・`done`・`dropped`）、担当（アカウントか agent の node）、期限、優先度、完了条件。待ち合わせは relationType `m3e:blocks` の relation edge で表す。
- `m3e:parentEdge:polarity`: 欄 `value` に `preserve`（既定）か `invert`（key は `m3e:parentEdge:polarity/value`）。node の有効な極性はキャッシュ（9 節）。alias の有効な極性は、alias が置かれた位置の経路で決める案を推す。

### 10.6 描画の宣言

node type ごとの描画を、定義済みの規約と実装に限る。node type に任せる範囲は広く取るが、触れてよい範囲は狭く決める。

- 拡張の定義は、描画の宣言を持つ:
  - 描画に読む attribute の key の一覧
  - intrinsic size の決め方（文字の行から計算する / 固定 / attribute の値から）
- 宣言は server も読む。scope の読み出しは、node ごとに、その node type の宣言にある attribute だけを返せる（projection）。projection した書き込みの扱いは 5.4。
- node type が決めてよいもの:
  - 読む attribute
  - node の矩形の内側の内容
  - 内容から決まる intrinsic size
- 共通の側が持ち、node type が触れないもの:
  - 選択の枠、畳んだ子の数、alias・lock の印、drop 先の強調、hit test、edge の接続位置
  - 位置（layout が決める）
- node type の実装は、pure function の measure と draw の二つである。
  - 入力は、芯（`text`・本文）、宣言した attribute、位置、共通の状態だけである。宣言外のデータ、他の node、DOM は渡さない。
  - measure は DOM を測らず、draw より前に答える。
- 宣言の無い node type と、定義の無い拡張は、プレーンとして描く。値は捨てない（10.3）。
- 【仮決め】一つの node に拡張が重なるとき、矩形の内側を描く node type は一つだけである。残りは、共通の側が印として並べる。
- 【仮決め】`m3e:` 以外の接頭辞の node type は、宣言だけで描画を決める（用意した部品の組み合わせ）。コードは持てない。

### 10.7 型の語彙

拡張の定義の `fields[].type` に書ける型である。JSON には整数と小数の区別が無いので、型は保存の形ではなく、確定のときの検査で保証する。

| 型 | JSON の表現 | 検査 |
|---|---|---|
| `string` | string | |
| `int` | number | 整数で、絶対値が 2^53−1 以下 |
| `float` | number | 有限の IEEE 754 double |
| `bool` | boolean | |
| `enum` | string | 定義の `values` に含まれる |
| `time` | string | ISO 8601 の UTC。ミリ秒まで書き、末尾は `Z`（`YYYY-MM-DDTHH:mm:ss.sssZ`） |
| `timeExp` | number | 整数 k。間隔 2^k 秒を表す |
| `nodeRef` | string | node の ID。参照先が無くても保存を許し、broken として扱う |
| `accountRef` | string | アカウントの ID |
| `list<T>` | array | 要素ごとに T の検査 |

- 時刻の canonical な形は `time` である。cache と Neo4j は、計算のために epoch ミリ秒の整数も持つ。
- `seq` と `rev` は int で、上限は 2^53−1 である。

## 11. 保存しないもの

- 計算で求まる値: 子の配列、node と relation edge の scope への所属、`label` が無い scope の名前、9 節の値（減衰する量の累積を除く）
- 表示状態: 選択、camera、編集中の状態、どの agent がどの scope に居るか
- 作成時刻・更新時刻・作成者
- 既定値と同じ決まった欄、null の attribute、空の配置値

## 12. 未決

保存の形に入るもの:

- scope の `retention.ms` の既定値（sync-principles の Rapid の目安は 30 日。archive の segment の 90 日とは別の値）
- node と scope のロックの欄（同期の要件 R2.6）。ロックが部分木に及ぶか、編集も止めるか
- scope の Rapid と Deep の区分（同期の要件 R8.6）。欄を置くかは、違いと昇格の意味が決まってから

- task の欄の正確な組と、担当の参照先
- 計算で求まる値の定義の名前の分類
- 接頭辞 `m3e:` と `misc:` が指す URI（Turtle へ書き出すときに要る）
- `note`・`link` を details に持つこと、`extra`、HTML を載せる種別などの担当の決め打ち（record-schema DA39〜DA53）の承認
- compaction の契機にする replay の長さの値

実装と運用に関わるもの:

- Undo による ID の復活と「消した ID は再利用しない」の衝突
- 確定済み・未反映の間に、読み込みと再送へ何を返すか
- 未確定の Command を、再読込や再起動の後まで保つ方法
- map の最終更新の出し方（確定の表は map を持たない）
- 大きな取り込み（100 万 node）を、見えない状態で分割して作る方法
- local outbox の形と、remote への送り方
- 欄ごとの CAS（5.2 規則 3）と、move の LWW（規則 9）の適用範囲の境界。outbox から届いた、基準が古い move をどちらで扱うか

## Related

- [Glossary](../00_Home/Glossary.md)
- [実装ログ](../../.kiro/specs/rapid-persistence-redesign/implementation-log.md)（実装の中で得た気づきと問題。未対応の項目を先に読む）
- [ADR 014](../09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)
- [Data_Model.md](./Data_Model.md)（現行の保存の仕様）
- [Engine.md](../01_Vision/Engine.md)、[LLM_Workbench.md](../01_Vision/LLM_Workbench.md)
- [record-schema.md](../../.kiro/specs/rapid-persistence-redesign/record-schema.md)、[snapshot-format.md](../../.kiro/specs/rapid-persistence-redesign/snapshot-format.md)、[post-migration-spec.md](../../.kiro/specs/rapid-persistence-redesign/post-migration-spec.md)
