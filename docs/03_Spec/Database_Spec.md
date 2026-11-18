# DB 仕様書

最終更新: 2026-11-18

M3E の保存データ（DB）の仕様をまとめる。保存の形、識別、不変条件、書き込みと確定、journal と portable snapshot、Neo4j 上の持ち方、キャッシュ、拡張の仕組みを扱う。

## 0. この文書の位置付け

- 用語は [Glossary](../00_Home/Glossary.md) に従う。線は、総称を edge、親から子への線を parent edge、木の外の関係線を relation edge と呼ぶ。
- 決定の経緯と実測値は [record-schema.md](../../.kiro/specs/rapid-persistence-redesign/record-schema.md) にある。本書はその決定を、現在形の仕様としてまとめたものである。
- 基盤の決定は [ADR 014](../09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)（正本は journal と portable snapshot、Neo4j は導出物、書き込みは Command だけ）。
- 関連する文書
  - portable snapshot の行の形と、現行データからの変換規則: [snapshot-format.md](../../.kiro/specs/rapid-persistence-redesign/snapshot-format.md)
  - 移行後の規則の案: [post-migration-spec.md](../../.kiro/specs/rapid-persistence-redesign/post-migration-spec.md)
- 各節の状態を次の印で示す。

| 印 | 意味 |
|---|---|
| 【実装済み】 | `beta/src` に実装があり、試験か実データで確かめた |
| 【決定】 | 決まっているが、実装はまだ |
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
   Neo4j（導出物。作り直せる）       snapshot.jsonl を書き直す
```

| 層 | 置き場 | 正本か | 状態 |
|---|---|---|---|
| portable snapshot | workspace のディレクトリの `snapshot.jsonl` | 正本 | 【実装済み】 |
| journal | 同じディレクトリの `journal.jsonl` | 正本 | 【実装済み】 |
| 確定の索引 | 同じディレクトリの `commit-index.json` | 導出物（圧縮のときに書く） | 【実装済み】 |
| 実行時のレコード | 確定する側のサーバのメモリ | 導出物 | 【実装済み】 |
| Neo4j | 端末ごとの Neo4j | 導出物。同期しない。backup の対象にしない | 【実装済み】（鏡として） |
| SQLite | 書き出しの形式 | 正本ではない | 【決定】 |

- 正本から作り直せるものは、正本と食い違ったら作り直す。正本の側を直さない。
- 空のエンジンへ、portable snapshot と journal だけから復元できる。

## 2. 階層と識別

```
workspace > map > scope > node
```

- workspace は、保存データの入れ物であり、書き込みを確定する単位である。
- 【決定】journal は、workspace × 書き手の端末ごとの追記専用の列とし、書くのはその端末だけにする。【実装済み】のものは、workspace ごとに一つの journal である。
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
| `snapshot` | （1 行目） | `format`（1）、`workspaceId`、`seq`（この snapshot が含む最後の通し番号） |
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

- `rev` は、そのレコードを最後に変えた確定の通し番号である。`commit`・`idMap`・`nodeView`・1 行目は持たない。`nodeView` は、属する Surface View の `rev` に従う。
- `extra` は、型定義に無い欄をそのまま入れる組である。知らない欄を捨てないために使う。

### 3.2 node

- node は、親・子・作成時刻・更新時刻・作成者を持たない。親子関係は parent edge が持つ。時刻と発行者は、`rev` から確定の表（`commit`）を引く。
- 決まった欄（`nodeType`、`collapsed`）は、既定値（`text`、false）と同じなら保存しない。既定値は変えない。
- `alias` は、参照先 `target`、表示名 `label`、`access`（read / write）、参照先のラベルの写し、`broken` を持つ。
- `nodeType` の値【実装済み】は `text`、`alias`、`image` と、移行で運んだそれ以外の値である。種別の扱いは 10 節で改める【提案】。

### 3.3 attribute

- 持ち主（node または edge）のレコードの一部であり、独立した `rev` を持たない。
- key は文字列で、接頭辞の付いた形を使う（例: `m3e:style`、`misc:mood`。規則は 3.8）。移行で運んだ接頭辞の無い key も、そのまま残す。
- 値は、文字列・数値・真偽・配列・入れ子のいずれかである。null は保存しない。空文字・false・0 は値として残す。
- portable snapshot と Command では、attribute を 1 件ずつ扱う。

### 3.4 edge

| 欄 | parent edge（`type: "edge"`） | relation edge（`type: "graphlink"`） |
|---|---|---|
| `source` / `target` | 親 / 子。node に限る | 始点 / 終点。node か、他の edge |
| 兄弟順キー `ord` | 必須 | 持たない |
| `scopeId` | 必須。この parent edge が載る scope | 持たない（両端から導く） |
| `relationType` | 【決定】持つ。【実装済み】の形には欄が無い | 持つ |
| `label` | 持つ | 持つ |
| 向き・線種・色・port | 持たない | 持つ。port は、値が無ければ自動 |
| `attributes` | 【決定】持つ。【実装済み】の形には欄が無い | 持つ |

- `connectionId`（edge の `id`）は、parent edge と relation edge をまたいで一意である。
- ある node の子は、`source` がその node である parent edge を集め、`ord` で並べたものである。子の配列は保存しない。
- `ord` は並べるためだけの文字列で、文字列として比べる。間に入れるときは前後の間のキーを作り、他の兄弟のキーは変えない。手元の端末が作ってよい。同じキーが二つあれば `connectionId` の順にする。
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

## 4. 不変条件【実装済み】

確定のときに検査する。一つでも破る書き込みは、全体を拒否する。

1. root 以外の node は、入ってくる parent edge をちょうど 1 本持つ。map の root は持たない。
2. parent edge は循環しない。
3. alias は alias でない node を指す。alias は子を持たない。
4. edge の端点は実在する。端点を消す書き込みは、その edge も同じ確定で消す。
5. scope の root は実在する node である。alias は root になれない。
6. parent edge は実在する scope の ID を持つ。parent edge（親 a → 子 b、scope S）について、a が S の root であるか、a の親から来る parent edge の scope が S である。これで、一つの scope に載る parent edge は、その root を頂点とする 1 本の木になる。
7. `connectionId` は、parent edge と relation edge をまたいで一意である。
8. details、linear-text、Surface View の保存設定、配置値、注釈は、指している node または scope が実在する。

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

拒否の種類: `NOT_FOUND`、`CONFLICT`（欄の競合）、`INVALID_STATE`（不変条件）、`INVALID_COMMAND`、`SAME_ID_DIFFERENT_CONTENT`、`ENGINE_BEHIND`。

### 5.3 再送【実装済み】

- 確定済みの ID と同じ ID の Command には、最初の結果を返す。
- 同じ ID で中身が違う Command は拒否する。中身は、変更の一覧の正規化した JSON の sha256 で比べる。
- 【決定】基準が journal の圧縮より古い Command は、状態を取り直させてから受ける。

Undo は、逆向きの Command を出すことで行う。

## 6. journal【実装済み】

- UTF-8 の JSON Lines。1 行が 1 回の確定である。
- 1 行の欄:

| 欄 | 内容 |
|---|---|
| `seq` | 通し番号 |
| `commandId` | Command の ID |
| `issuer` | 発行者のアカウント |
| `committedAt` | 確定時刻（ISO 8601） |
| `mapId` | 対象の map |
| `intent` | 意図 |
| `actor`、`provenance` | 出した側の情報と由来 |
| `changes` | 送られた変更の一覧（監査と Undo のため） |
| `changesHash` | `changes` の sha256（再送の比較） |
| `mapOp` | map の削除・改名・一覧の欄だけの変更のとき |
| `ops` | レコードへの操作の列（`put` / `delete`、レコードの key、レコード） |

- 開くとき、末尾の書きかけの行は切り捨てる。途中の行が壊れていれば、開くのを止める。通し番号の飛びも止める。
- 圧縮（`compact`）は、その時点の全レコードで `snapshot.jsonl` を書き直し、journal を空にする。あわせて `commit-index.json` に、map ごとの最後の確定と、確定済みの Command の ID（直近 100,000 件）を書く。
- 複製は、三つのファイルを一度に写す。確定と圧縮は同期処理なので、写しの途中に確定が入らない。

## 7. portable snapshot【実装済み】

- workspace 一つにつき一つの、UTF-8 の JSON Lines。1 行が 1 レコード。
- 1 行目は `{"kind":"snapshot","format":1,"workspaceId":"…","seq":…}`。
- 値の無い欄と null は書かない。
- 並びは `kind`、次に key の文字列順。行の順序に意味は無いが、差分を安定させるために揃える。
- 現行データからの変換規則と、逆変換で許す差は snapshot-format 3〜4 節に従う。

## 8. Neo4j 上の持ち方【実装済み】

Neo4j は導出物であり、誤っていれば journal から作り直す。ここでの選択は、保存の形（3 節）とは独立に変えてよい。

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

- 数値: 安全な範囲の整数は Integer、それ以外は Float にする。これで元の JSON の文字列に戻る。
- 索引: `rk` の一意制約、`id`、参照を引く欄（`f_source`、`f_target`、`f_rootNodeId`、`f_nodeId`、`f_scopeId`、`f_surfaceId`、`f_mapId`）。索引が無いと、どの問い合わせも 180〜610 ms かかる。
- 索引に載せる値の上限は UTF-8 で 8,164 バイト（範囲索引と一意制約）、文字列索引は 32,766 バイト。

### 8.3 relationship

relationship は property から作る導出物で、読み戻しには使わない。問い合わせのためにある。

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
- 確定のときに計算し、サーバの手元にキャッシュする。agent は読むだけで、計算を待つ必要も、計算方法を知る必要もない。Neo4j と portable snapshot にはその写しを置く。
- 時間で減る値（活動など）は、最後に確定したときの値と時刻だけを持ち、読むときに掛け算 1 回で今の値を出す。
- 計算し直すきっかけ（親の変更、edge の変更、部分木の移動など）は、値の定義に書く。

候補:

| 値 | 付く先 | 求め方 |
|---|---|---|
| 有効な極性 | node | root からの主木の経路上で、反転する parent edge の数の偶奇 |
| 活動 | node・scope | 確定が触るたびに、時間で減る累積に 1 を足す |
| 体積 | scope | その面に載る node の数 |
| 温度 | node・scope | 曖昧さ。式は未決 |

## 10. 拡張の仕組み【提案】

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

- 定義の欄: 名前、付く先、欄の一覧（型、値の範囲、必須か、参照先）、版の番号、表示ラベル、説明。
- 名前は Turtle の接頭辞付きの名前として読める（接頭辞 `m3e`、名前 `nodeType:task`）。
- relationType の名前は、外の語彙と合わせる識別子なので、三段にしない。
- `m3e:` は M3E の組み込み、それ以外の接頭辞は利用者（agent を含む）が定義した拡張である。定義を作らずにその場で使う名前は `misc:` にする（3.8）。

### 10.3 値の置き場

- 拡張の欄の値は、attribute に置く。key は定義の名前に `/` と欄の名前を足したもの（例 `m3e:nodeType:task/status`）。拡張は、attribute の名前空間に型を被せたものである。
- 新しい保存の仕組みは要らない。attribute の扱い（3.3）がそのまま使える。
- 値の検査は、定義を読む共通の検査器が確定のときに行う。
- 定義の無い拡張の値は、捨てずに残す。

### 10.4 種別の変更

- node が今どの拡張を持つかは、名前の集合で持つ。一つの node に複数の拡張を重ねてよい。
- 種別の変更は、この集合への追加・削除として、一つの Command で行う。node の ID、edge、alias からの参照、attribute は保たれる。
- 拡張を外しても、その名前空間の値は残す。戻せば元どおりになる。
- 本文から新しい拡張の欄を読み取るのは agent の仕事で、アプリは形の検査だけを行う。読み取れない欄は空のままでよい。
- alias との間の変更はしない（芯の種類が違う）。
- Neo4j では、拡張の名前の集合を node のラベルに写す。複数のラベルを持てるので、そのまま表せる。

### 10.5 最初の拡張

- `m3e:nodeType:task`: 状態（`open`・`in_progress`・`blocked`・`done`・`dropped`）、担当（アカウントか agent の node）、期限、優先度、完了条件。待ち合わせは relationType `m3e:blocks` の relation edge で表す。
- `m3e:parentEdge:polarity`: `preserve`（既定）か `invert`。node の有効な極性はキャッシュ（9 節）。alias の有効な極性は、alias が置かれた位置の経路で決める案を推す。

## 11. 保存しないもの

- 計算で求まる値: 子の配列、node と relation edge の scope への所属、`label` が無い scope の名前、9 節の値（写しを除く）
- 表示状態: 選択、camera、編集中の状態、どの agent がどの scope に居るか
- 作成時刻・更新時刻・作成者
- 既定値と同じ決まった欄、null の attribute、空の配置値

## 12. 未決

保存の形に入るもの:

- 拡張の仕組み（10 節）の承認。一つの node に拡張を重ねるか、外したときの値を残すか、誰が定義できるか
- task の欄の正確な組と、担当の参照先
- 計算で求まる値の定義の名前の分類
- 接頭辞 `m3e:` と `misc:` が指す URI（Turtle へ書き出すときに要る）
- `note`・`link` を details に持つこと、`extra`、HTML を載せる種別などの担当の決め打ち（record-schema DA39〜DA53）の承認
- parent edge の `relationType` と `attributes` の欄を、snapshot の形に足す時期

実装と運用に関わるもの:

- Undo による ID の復活と「消した ID は再利用しない」の衝突
- 確定済み・未反映の間に、読み込みと再送へ何を返すか
- 未確定の Command を、再読込や再起動の後まで保つ方法
- map の最終更新の出し方（確定の表は map を持たない）
- 大きな取り込み（100 万 node）を、見えない状態で分割して作る方法
- 書き手の端末ごとの journal と、Mac mini での集約

## Related

- [Glossary](../00_Home/Glossary.md)
- [ADR 014](../09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)
- [Data_Model.md](./Data_Model.md)（現行の保存の仕様）
- [Engine.md](../01_Vision/Engine.md)、[LLM_Workbench.md](../01_Vision/LLM_Workbench.md)
- [record-schema.md](../../.kiro/specs/rapid-persistence-redesign/record-schema.md)、[snapshot-format.md](../../.kiro/specs/rapid-persistence-redesign/snapshot-format.md)、[post-migration-spec.md](../../.kiro/specs/rapid-persistence-redesign/post-migration-spec.md)
