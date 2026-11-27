# DB 仕様書

最終更新: 2026-11-21（帯域と alias の同一性を追加。on-disk format は freeze v1 の format 2）

M3E の保存データ（DB）の仕様をまとめる。保存の形、識別、不変条件、書き込みと確定、journal と snapshot、Neo4j 上の持ち方、キャッシュ、拡張の仕組み、帯域（Rapid と Deep）を扱う。

## 0. この文書の位置付け

- 用語は [Glossary](../00_Home/Glossary.md) に従う。線は、総称を edge、親から子への線を parent edge、木の外の関係線を relation edge と呼ぶ。
- 決定の経緯と実測値は [record-schema.md](../../.kiro/specs/rapid-persistence-redesign/record-schema.md) にある。本書はその決定を、現在形の仕様としてまとめたものである。
- 基盤の決定は [ADR 014](../09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)。Neo4j は各端末の正本エンジン（semantic authority: invariant の検査と query）。durability authority（replication・backup・recovery の単位）は journal と snapshot。書き込みは Command だけ。
- 関連する文書
  - snapshot の行の形と、現行データからの変換規則: [snapshot-format.md](../../.kiro/specs/rapid-persistence-redesign/snapshot-format.md)
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
- 本書の保存は【実装済み】である。server は、環境変数 `M3E_STORE_DIR` を設定したとき、または workspace のデータの置き場（`M3E_DATA_DIR`）に移行済みの保存（`store/snapshot.jsonl`）があるときに、本書の保存を使う。どちらも無いときは SQLite を使う（`beta/src/node/record_store/active.ts` の `recordStoreDir()`）。
  - 通常の Beta の workspace は、2026-11-22 に SQLite の file から format 2 へ移行し、本書の保存で動いている。元の SQLite の file はそのまま残し、書き込まない。
  - Final の workspace（Personal）と Swingby の workspace は、SQLite のままである。

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
| snapshot | workspace のディレクトリの `snapshot.jsonl` | durability authority | 【実装済み】 |
| journal | 同じディレクトリの `journal.jsonl` | durability authority（redo log） | 【実装済み】 |
| 確定の索引 | 同じディレクトリの `commit-index.json` | 索引。圧縮のときに書き、journal と snapshot から作り直せる | 【実装済み】 |
| 実行時のレコード | 確定する側のサーバのメモリ | 実行時の状態。replay で作り直せる | 【実装済み】 |
| Neo4j | 端末ごとの Neo4j | 正本エンジン（semantic authority: invariant の検査と query）。同期しない。backup の対象にしない。base snapshot と log suffix の replay で再構築する | 【決定】。【実装済み】のものは確定後に反映する mirror で、invariant の検査はサーバのメモリで行っている |
| SQLite | 書き出しの形式 | 正本ではない | 【決定】 |

- Neo4j・索引・実行時のレコードが journal と snapshot と食い違ったら、replay で作り直す。journal と snapshot の側を直さない。
- 空のエンジンへ、最新の base snapshot と、それより後の journal（log suffix）の replay だけで復元できる（6 節）。

## 2. 階層と識別

```
workspace > map > scope > node
```

- workspace は、保存データの入れ物であり、書き込みを確定する単位である。
- 【決定】（akaghef、2026-11-18。[sync-principles](../../.kiro/specs/rapid-persistence-redesign/sync-principles.md)「remote と local」「データの形」）remote は workspace ごとにちょうど一つあり、確定の全順序はそこで付ける（single-leader）。確定の記録が journal で、workspace ごとに一本である。remote の sequencer が `seq` を振る。
- local の commit は確定ではない。端末は、未確定の Command を outbox に積む。
- 【実装済み】journal は workspace ごとに一つである。local outbox は無い。
- 【決定】local outbox は、端末の永続の記憶に置く。Command は、端末の状態へ当てる前に outbox へ追記する。再読込や再起動の後も、outbox に残った Command を、同じ commandId で送り直す。
  - outbox の 1 件は `{commandId, baseSeq, command, createdAt}` である。`baseSeq` は、その Command を作った時点で端末が知っていた最後の通し番号。
  - 送り方は、HTTP の push と pull（ADR 014）。push の結果は commandId ごとの確定の通し番号か、拒否の理由である。確定した Command と、拒否された Command は、outbox から外す。拒否された Command は、端末の状態から戻す。
- node・edge・scope・Surface View の保存設定・注釈の ID は、map と workspace をまたいで一意である。
- ID は作った後に変えない。消した ID は再利用しない。消した Command の Undo だけが、消した node を同じ ID で戻せる。新しく作る node は、消した ID を使わない。
- ID に意味を埋め込まない。種別の名前、本文、親の ID を含めない。
- 保存エンジンが内部で振る ID（Neo4j の内部 ID など）は、外に出さない。
- 【実装済み】移行で振り直す ID は、決定的に作る。形は「接頭辞 ＋ `sha256("<workspace>|<map>|<種別>|<種>")` の先頭 24 桁」。接頭辞は node が `n_`、edge が `c_`、scope が `s_`、Surface View が `v_`、注釈が `a_`。旧い ID との対応は `idMap` のレコードに残す（snapshot-format 3.1）。

## 3. レコード

保存の単位はレコードである。各レコードは種別と key で一意に決まる。snapshot では 1 レコードが 1 行になる。

### 3.1 一覧【実装済み】

| 種別（`kind`） | key | 主な欄 |
|---|---|---|
| `snapshot` | （1 行目） | `format`（schemaVersion）、`workspaceId`、`seq`（この snapshot が含む最後の通し番号） |
| `map` | `id` | `rootNodeId`、`tags`、`archived`、`pinned`、`source`、linear-text の表示設定、`extra`、`rev` |
| `node` | `id` | `mapId`、`nodeType`、`text`（ラベル）、`collapsed`、`attributes`、`alias`、`valid`（任意。`from`・`to`。12.7）、`certainty`（必須。3.2）、`extra`、`rev` |
| `details` | `nodeId` | `mapId`、`v`（形の版）、`body`（Markdown の本文）、`note`、`link`、`rev` |
| `connection`（edge） | `id` | `mapId`、`type`、`source`、`target`、`label`、`rev`。種類ごとの欄は 3.4 |
| `scope` | `id` | `mapId`、`rootNodeId`、`label`、`primarySurfaceId`、`band`（`rapid` / `deep`。12.6）、`projection`（射影で作った面だけが持つ。`mode`・`from`・`range`・`baseSeq`・`dissolved`。12.3）、`retention`（任意。下）、`rev` |
| `linearText` | `scopeId`（または `mapId` ＋ `orphanKey`） | `text`、`anchorNodeId`、`rev` |
| `surface` | `id` | `mapId`、`scopeId`、`surfaceKind`、`layout`、`surfaceView`、`rev` |
| `nodeView` | `surfaceId` ＋ `nodeId` | `x`、`y`、`flowCol`、`flowRow`、`shape` |
| `annotation` | `id` | `mapId`、`scopeId`、`annotationKind`（pen / text）、形状・色・太さ、`extra`、`rev` |
| `relationTypeDef` | `name` | `label`、`description`、`reads`（`source-to-target` / `target-to-source`）、`rev` |
| `prefix` | `prefix` | `uri`、`rev` |
| `lock` | `target`（対象の rk） | `rev`。掛けている間だけ在る（3 節） |
| `namedSnapshot` | `id` | `name`、`seq`、`scopeId`、`reason`、`rev`（12.4） |
| `grant` | `id` | `scopeId`、`principal`、`capability`、`grantedBy`、`expiresAt`、`rev`（3 節） |
| `account` | `id` | `accountKind`（`ai-agent` / `human` / `system`）、`displayName`、`externalIds`、`roles`、`rev` |
| `commit` | `seq` | `committedAt`、`issuer`（アカウントの ID）、`sessionId` |
| `idMap` | `recordKind` ＋ `mapId` ＋ `oldId` | `newId` |
| `extensionDef` | `name` ＋ `version` | 【実装済み】`target`、`fields`、`render`、`label`、`description`、`rev`（10.2） |

- `rev` は、そのレコードを最後に変えた確定の通し番号である。`commit`・`idMap`・`nodeView`・1 行目は持たない。`nodeView` は、属する Surface View の `rev` に従う。
- `extra` は、型定義に無い欄をそのまま入れる組である。知らない欄を捨てないために使う。
- 【決定】（freeze v1、akaghef、2026-11-19）format 2 で足すもの: `extensionDef` のレコード、node と edge の `extensions`（10.4）、parent edge の `relationType` と `attributes`（3.4）。【実装済み】

### 3.2 node

- node は、親・子・作成時刻・更新時刻・作成者を持たない。親子関係は parent edge が持つ。時刻と発行者は、`rev` から確定の表（`commit`）を引く。
- 決まった欄（`nodeType`、`collapsed`）は、既定値（`text`、false）と同じなら保存しない。既定値は変えない。
- `alias` は、参照先 `target`、表示名 `label`、`access`（read / write）、参照先のラベルの cache（`snapshotLabel`）、`broken` を持つ。
- 【決定】（akaghef、2026-11-21）alias は子を持てる。alias は、参照先の実体が、ある面に現れる一回の出現である。alias の子は、その面での子であり、参照先の実体の子にはならない。同一性と、子の意味は 12.2。【実装済み】のものは、alias の子を拒否する。
- 【決定】（akaghef、2026-11-22。同期の要件 R2.6）node と scope はロックを持つ。誤操作の防止のためで、権限の代わりではない。
  - ロックは掛けた node（出現）だけに効き、子孫には継承しない。alias では、出現ごとにロックが付く。
  - 止めるのは構造の変更だけである: 対象の削除、移動、parent edge の付け替え。対象を巻き込んで消す Command（祖先の部分木の削除、それを含む scope の dissolve など）も止める。内容の編集は止めない。祖先を別の親へ移すことは止めない（対象の parent edge は変わらず、消えもしない）。
  - 12.7 の消す操作（出現・関係・実体）への効き方は、12.7 の表と QG1 に従う。
  - 判定は確定する時点の状態で行う。Undo の Command も同じ判定を受ける。ロックを理由に確定しなかった Command は、理由がロックであることを示して返す。
- ロックの保存の形（【決定】の判定は `touched` で行うこと。ほかは保存の形の側の判断）:
  - 新しいレコードの種類 `lock` に持つ。key は対象の rk、欄は `target`、`rev`。掛けるとレコードを作り、外すとレコードを消す。node や scope の欄にしないのは、掛けるたびに対象の `rev` が進んで内容の CAS が衝突し、`touched` で内容の変更として数えられるのを避けるためである。
  - 及ぶ範囲を表す欄は置かない。欄が無いことを「対象のみ」と読む。部分木へ広げるときは任意の欄を足す。追加なので format は上がらない。
  - 【決定】（akaghef、2026-11-22）判定は、確定のときに server が作る `touched` で行い、Command の種類では行わない。ロック中の対象が `m3e:delete` で現れるか、対象の parent edge が変わる確定を拒否する。どの Command（dissolve、join、一括の変更、取り込み、Undo）から来ても同じ規則で止まる。
  - parent edge の付け替えと兄弟順の変更は、別の event kind（`m3e:reparent` と `m3e:order`、6 節）にする。兄弟順の変更を止めないためである。
  - 実体を終える操作（12.7 の OC3）は、node を消さず parent edge も変えないので、今の event kind では `touched` の判定に掛からない。止めるなら、終えることを表す event kind（例 `m3e:end`）が要る。event kind は開いた集合なので、足しても format は上がらない。
  - 実体を取り消す操作（OC4）は、参照する alias の `broken` を同じ Command の中で書き換え、その alias を `touched` に出す。こうすると、alias に掛けたロックも同じ規則で判定できる。
  - 拒否の理由のコードとして `LOCKED` を足す。push の結果で commandId ごとに返す（6 節）。
- 【決定】（akaghef、2026-11-22。同期の要件 R2.6）ロックを扱える主体:
  - 掛ける・外すのは、その scope を編集できる human である。外すときは確認を一回挟むだけで、承認は要らない。特定の人しか外せないロックは作らない。
  - AI agent は掛けられる。外せるのは、human が明示して任せたときだけである。
  - 掛ける Command と外す Command は、どちらも journal に確定し、Undo できる。ロックは対象に付き、掛けた人が権限を失っても残る。
  - 効くかどうかは、remote が確定のときに判定する。
  - 保存の形: 所有者の欄は置かない。誰が掛けたかは、掛けた Command の `issuer` と `actor` で分かる。
- 【決定】（akaghef、2026-11-22。同期の要件 R2.7）AI agent にロックを外すことを任せる許可（grant）は、scope の権限と同じ場所に置く。
  - principal はアカウントである。capability は接頭辞付きの名前の開いた集合で、ロックを外す許可は `m3e:unlock`。
  - 許可は、その scope だけに効き、入れ子の scope へは継承しない。
  - 許可の付与と取り消しは、どちらも Command である。取り消しは、レコードの削除で行う。
  - 許可した human がその scope を編集できなくなったら、許可は効かない。確定のときに判定する。
  - unlock の Command の `actor` が AI agent のとき、remote は、その scope の有効な許可を確かめる。`issuer` が `grantedBy` と一致することは求めない。
- 保存の形: レコードの種類 `grant`。key は `id`、欄は `scopeId`、`principal`（`{account: accountRef}`。種類を足せる形）、`capability`（string）、`grantedBy`（accountRef）、`expiresAt?`（time。期限は確定の `committedAt` で判定する）、`rev`。scope の権限の仕組み（同期の要件 Q7）が決まったら、同じ種類のレコードに権限を足す。
- 【決定】（akaghef、2026-11-23）node は確度 `certainty` を必ず持つ。命題や事象が成り立つ確からしさで、数学の命題にも日常の事象にも同じ規則で使う。
  - 値は整数。`0`〜`100` は百分率で、確率は値 ÷ 100 である。`-1` は未設定である。範囲は int8 に収まる。
  - 既定値と同じでも省かずに保存する（上の「既定値と同じなら保存しない」の例外）。欄が無い node、範囲の外の値、整数でない値を書く確定は拒否する（不変条件 11）。
  - 値を指定せずに node を作る Command では、server が `-1` を書く。
  - 証明の有無や検証の方法（AI の証明、人の証明、Lean など）に、固定の値や専用の区分を割り当てない。それらは確度を決める材料である。`100` は確率 1 を表し、証明があることを表さない。
  - 【未実装】
- `nodeType` の値【実装済み】は `text`、`alias`、`image` と、移行で運んだそれ以外の値である。種別の扱いは 10 節で改める（【決定】）。【決定】format 2 では `nodeType` を残し、描画器の選択子として使う。`extensions` との統合は、次の format の bump で行う。

### 3.3 attribute

- 持ち主（node または edge）のレコードの一部であり、独立した `rev` を持たない。
- key は文字列で、接頭辞の付いた形を使う（例: `m3e:style`、`misc:mood`。規則は 3.8）。移行で運んだ接頭辞の無い key も、そのまま残す。
- 値は、文字列・数値・真偽・配列・入れ子のいずれかである。null は保存しない。空文字・false・0 は値として残す。
- snapshot と Command では、attribute を 1 件ずつ扱う。
- 欄が無いことは、未設定・未観測を表す。値の 0 と区別する。
- 【決定】（freeze v1、akaghef、2026-11-19）拡張の欄（10.3）だけは、確定のときに定義の型で検査する（schema-on-write）。それ以外の attribute は型を問わない（schema-on-read）。型の語彙は 10.7。

### 3.4 edge

| 欄 | parent edge（`type: "edge"`） | relation edge（`type: "graphlink"`） |
|---|---|---|
| `source` / `target` | 親 / 子。node に限る | 始点 / 終点。node か、他の edge |
| 兄弟順キー `ord` | 必須 | 持たない |
| `scopeId` | 必須。この parent edge が載る scope | 持たない（両端から導く） |
| `relationType` | 【実装済み】持つ（format 2） | 持つ |
| `label` | 持つ | 持つ |
| 向き・線種・色・port | 持たない | 持つ。port は、値が無ければ自動 |
| `attributes` | 【実装済み】持つ（format 2） | 持つ |
| `extensions` | 【実装済み】持つ（10.4） | 【実装済み】持つ（10.4） |

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
- 【実装済み】Command の parent edge は、子の ID を `key` に持ち、`before` / `after` に `{parentId, ord}` を持つ。作成は `after`、削除は `before` だけを持つ。移動・挿入・並べ替えの対象の parent edge だけを送る。兄弟の配列位置の変化は、兄弟自身の変更ではない。
  - viewer / MCP の `diffState` は、読み出した `edgeOrder`（入ってくる parent edge の `ord`）と前後の兄弟の key から `fractional-indexing` で候補を作る。確定側は key の妥当性と不変条件を検査して保存する。viewer は保存の応答を受けたとき、確定した Command の key を次の保存の基点にも反映する。
  - viewer が書込み位置を渡す場合は、移動した node とその隣接 node のキーだけから差分を作り、全 node と全兄弟を列挙しない。scopen／unscopen と scope をまたぐ部分木移動の確定は、所属が変わる parent edge と関連 record だけを射影する。子孫の所属も変わる場合の手間は、その部分木に比例する。
  - 通常の parent edge の移動・兄弟順は `seq` 順の LWW とし、古い `before` であっても後に確定した有効な位置を採用する。循環を作る変更は拒否する。他の field は CAS、12.4 節の射影の書き戻しは位置も CAS とする。明示された map revision の前提条件は維持する。
  - `index` を持つ既存の journal / outbox / Command も読み取れる。同じ Command 内の index は同時に適用する。新しく書く journal / outbox は `ord` を持ち、受信した形の hash と書き込む形の hash を保持して、再起動・compaction 後も同じ Command の再送を判定する。
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

## 4. 不変条件【実装済み】

確定のときに検査する。一つでも破る書き込みは、全体を拒否する。

1. root 以外の node は、入ってくる parent edge をちょうど 1 本持つ。map の root は持たない。
2. parent edge は循環しない。
3. alias は alias でない node を指す。【決定】（akaghef、2026-11-21）alias は子を持てる（3.2、12.2）。
4. edge の端点は実在する。端点を消す書き込みは、その edge も同じ確定で消す。
5. scope の root は実在する node である。alias は root になれない。
6. parent edge は実在する scope の ID を持つ。parent edge（親 a → 子 b、scope S）について、a が S の root であるか、a の親から来る parent edge の scope が S である。これで、一つの scope に載る parent edge は、その root を頂点とする 1 本の木になる。
7. `connectionId` は、parent edge と relation edge をまたいで一意である。
8. details、linear-text、Surface View の保存設定、配置値、注釈は、指している node または scope が実在する。
9. 同じ親の下で、parent edge の `ord` は一意である。
10. `extensions` にある拡張は、定義の required の欄がそろい、欄の型が合う（10.4）。定義が無い拡張は検査しない。検査器は `beta/src/shared/record_model/extensions.ts`。
11. 【決定】【未実装】node は `certainty` を持ち、その値は `-1` から `100` までの整数である（3.2）。

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

### 5.4 一部だけ読んだ状態からの書き込み【決定】

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
  - event kind は接頭辞の付いた名前の開いた集合で、最初の値は `m3e:create`、`m3e:delete`、`m3e:content`（`text`・本文）、`m3e:attribute`、`m3e:reparent`（parent edge・scope の付け替え）、`m3e:order`（`ord`）、`m3e:extension`（拡張の付け外し）、`m3e:target`（目標の更新間隔の変更）。読み手は知らない kind を無視する。
- 【決定】`provenance.items` の要素は `{mode: "observed" | "declared", rk, rev}`。上限は 100 件で、超えたら `truncated: true` にする。長く残す来歴は record の側に持つ（下）。
- 【実装済み】`provenance`（`beta/src/node/record_store/provenance.ts`、`beta/src/node/mcp_service.ts`）:
  - store は確定のときに形を検査する。形の合わない item は `INVALID_COMMAND` で断る。同じ rk は最初の 1 件を残す。100 件を超えた分は切り、`truncated: true` を付ける。これまでの値（`{contextId, tool}`、`{tabId}`）は `actor.id` と同じ情報なので、journal に残さない。
  - 【決定】observed: MCP の参加が見せられた record の read set（rk と、読んだ時点の `rev`）。見せられたものは、`m3e_get`（state）が返したページの node（details record を含む）と relation edge、変更の event が本文を見せた node である。参加ごとに 10,000 件まで持つ。確定のときに、読んだ後で他の発行者が書き換えた record と、消えた record は外す。自分で書き換えた record は、読んだ時点の `rev` で残す。
  - 【決定】declared: copy の出所の subtree。出所を明示する引数はまだ無い。
  - 【決定】並び: declared が先、次に observed を新しく読んだ順。SQLite の上では `items` は空になる。
- 【決定】`changes` と `ops` の二重持ちは、format 2 では解消しない。replay の決定性を確かめる試験ができてから扱う。
- 【実装済み】`touched` は、サーバが `ops` と pre-image から作り、rk の順に並べ、`rev` だけの差分を除く。決定との差が 2 点ある。
  - 位置の変更は、`touched` で `m3e:content` に数えている。
  - parent edge の付け替えと兄弟順の変更を、まだ一つの `m3e:structure` として出している（`beta/src/node/record_store/journal_archive.ts`）。

- 開くとき、末尾の書きかけの行は切り捨てる。途中の行が壊れていれば、開くのを止める。通し番号の飛びも止める。
- 【決定】（akaghef、2026-11-19）log compaction は何も消さない。封じた journal の segment は archive へ移す。
- 【実装済み】圧縮（`compact`）の手順（`beta/src/node/record_store/journal_archive.ts`、`store.ts`）:
  - 今の journal と、置き換える snapshot を `archive/` へ hard link する。link が使えない場所では copy する。名前は `journal.<from>-<to>.f<format>.jsonl` と `snapshot.<seq>.f<format>.jsonl`。`archive/index.json` に、各 file を archive した時刻を残す。
  - その時点の全レコードで `snapshot.jsonl` を書き直し、journal を空にする。
  - `commit-index.json` に、map ごとの最後の確定、確定済みの Command の ID（直近 100,000 件）、新しい snapshot の `{seq, sha256}`（`snapshot` の欄）を書く。
  - 圧縮した後、Neo4j の追いつきと、確定済みの Command の行の読み出し（`committedCommand`）は archive を読む。再送の判定は、archive ではなく `commit-index.json` の Command の ID と hash（直近 100,000 件）で行う。
- 【実装済み】契機: snapshot より後の journal が 50,000 行に達したとき（環境変数 `M3E_COMPACT_AFTER_LINES`、0 で止める）。確定の直後と、開いたときに判定する。圧縮と retention の失敗は確定を失敗にしない。
- 【決定】（freeze v1、akaghef、2026-11-19）schemaVersion を上げるたびに、移行した直後の snapshot を base snapshot として書く。replay を保証するのは、最新の base snapshot から後だけである。それより前の journal を新しい format へ書き換える upcasting はしない。compaction の契機は replay の長さで決める。値は、snapshot より後の journal が 50,000 行に達したとき（上の【実装済み】の値）である。
- 【決定】（akaghef、2026-11-19）【実装済み】archive の segment は、archive へ移してから 90 日で削除する（retention の操作。圧縮のあとと、開いたときに走る）。削除できるのは、次の二つを満たす segment だけである。
  - その範囲を覆う base snapshot か snapshot が fsync 済みで、checksum を検証済みである。
  - archive へ移してから 90 日を過ぎている。
  - 検証に失敗したら、消さずに止める。
  - `archive/index.json` で削減の対象から外す印の付いた file（名前付きの snapshot。12.4）は、消さない。
- PITR の窓は、最新の snapshot と 90 日分の archive である。
- 【決定】scope の `retention`（`{ms?, bytes?}`）は、その scope の journal の保持の上限である。欄が無いときの `ms` の既定値は 30 日（2,592,000,000）。archive の segment の 90 日とは別の値である。
- 書かれる頻度は、journal から作り直せない。そのため、減衰する量の累積は snapshot に状態として持つ（9 節）。envelope-stable な欄（`seq`・`committedAt`・`issuer`・確定ごとに触れたレコードと event kind）は、90 日の窓の中での集計に使う。
- copy の来歴と provenance は、journal ではなく record の側（attribute か専用の欄）に持つ。compaction と削除で失われないようにするためである。
- 複製は、三つのファイルを一度に写す。確定と圧縮は同期処理なので、複製の途中に確定が入らない。

## 7. snapshot【実装済み】

- workspace 一つにつき一つの、UTF-8 の JSON Lines。1 行が 1 レコード。
- 1 行目は `{"kind":"snapshot","format":2,"workspaceId":"…","seq":…}`。
- 【実装済み】freeze v1 の形は `format: 2` である。`format` を上げた直後の snapshot が base snapshot で、header の `{format, seq}` が版の切り替え点の記録になる。
  - format 1 の workspace を開くと、一度だけ移行する（`beta/src/node/record_store/store.ts` の `migrateToFormat2`）。format 1 の portable snapshot と journal を、`f1` の名前で `archive/` へ移し、今の通し番号で format 2 の base snapshot を書く。以後の確定は format 2 で書く。
  - format が 3 以上の snapshot は、開かずに拒否する。
- 【決定】（freeze v1、akaghef、2026-11-19）減衰する量の累積 `{v[k], t}` は、snapshot に状態として持つ（9 節）。
- 【決定】【未実装】（akaghef、2026-11-23）node に必須の欄 `certainty`（3.2）を足すので、format を 3 に上げる。format 2 の workspace を開くと一度だけ移行し、すべての node に `certainty: -1` を書いて、format 3 の base snapshot を書く。format 2 の portable snapshot と journal は `f2` の名前で `archive/` へ移す。
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
- 【実装済み】時刻は、canonical な形（ISO 8601 の文字列）に加えて、epoch ミリ秒の整数を持つ。property の名前は、最上位の欄が `ms_<欄>`、attribute が `am_<key>`、`extra` が `xm_<key>` である（`beta/src/node/neo4j_store/encoding.ts`）。
- 【実装済み】`extensions` の名前は、node のラベルにも写す（10.4）。ラベルは `Ext_` に、`name@version` の英数字以外を `_` に置き換えたものを足した名前である（例 `m3e:nodeType:task@1` → `Ext_m3e_nodeType_task_1`）。
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
- 【決定】（freeze v1、akaghef、2026-11-19）減衰する量の累積 `{v[k], t}`（尺度 k ごとの累積と最終時刻）は、計算で求まる値ではなく、snapshot に持つ状態である。journal は 90 日で削除するので、作り直せないからである（6 節）。
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
- 【実装済み】同じ `name`・`version` で中身が違う定義は CONFLICT にする。`misc:` も例外にしない。
- 【決定】`fields[].default`: 拡張を付ける Command の中で、required の欄の値が無ければ、server が `default` の値で埋めてから検査する。埋めた値は、その Command の ops に入る。
- 【決定】`fields[].ref`（型が `nodeRef` の欄）: 参照先の node が、`ref` に書いた拡張を `extensions` に持つことを求める。参照先が無いときは broken として扱い、保存は許す。
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

- `m3e:nodeType:task`: 欄は `status`（enum: `open`・`in_progress`・`blocked`・`done`・`dropped`、required、default `open`）、`assignee`（`list<nodeRef>`。人か agent の node を指す。アカウントは、その node から引く）、`due`（time）、`priority`（int。小さいほど高い）、`doneCondition`（string）。待ち合わせは relationType `m3e:blocks` の relation edge で表す。
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
- 【決定】一つの node に拡張が重なるとき、矩形の内側を描く node type は一つだけである。残りは、共通の側が印として並べる。
- 【決定】`m3e:` 以外の接頭辞の node type は、宣言だけで描画を決める（用意した部品の組み合わせ）。コードは持てない。

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

## 12. 帯域（Rapid と Deep）

帯域の定義は [Axes.md](../01_Vision/Axes.md) と [Glossary](../00_Home/Glossary.md) にある。この節は、帯域を保存の形へどう落とすかを書く。

### 12.1 読み【決定】（akaghef、2026-11-21）

- 保存される帯域は Rapid と Deep である。Flash は取り込みの入口で、Flash のまま保存される段階は持たない。取り込んだものは Rapid になる。
- Deep は体系である。体系は、複数の facet が重なった graph である。一つの facet は、ある関心の領域の taxonomy で、木として読める。全部を重ねたものは、そのままでは可視化も編集も難しい。
- Rapid は、体系の一側面を一枚の面（scope）として切り出したものである。構造は木である。
- Rapid と Deep は、別々のデータの写しではない。同じ実体に対する、一面と全体である。
- 帯域は Flash、Rapid、Deep の順に並ぶ。Deep の向きへ進める操作が昇格である。
- 【決定】（akaghef、2026-11-22。[同期の要件](../../.kiro/specs/rapid-persistence-redesign/sync-requirements.md) R8.5、R8.6）
  - Rapid と Deep の違いは、保持の方針ではなく、構造である。射影で作った面は Rapid である。
    - 射影で作られていない Rapid もある（Flash で取り込んだもの、手で作ったもの）。そのため、帯域は `projection` の有無からは導けない。scope は、帯域の欄 `band` を持つ（12.6 の KB1）。
  - Deep も、版をすべては残さない。journal の保持は、Rapid と同じ仕組み（時間と容量の上限）に従う。昇格のときに、その時点の snapshot に名前を付けて残す（Git の tag に当たる）。名前付きの snapshot は、保持期間では手放さない。
  - as-is と to-be、退職の前と後のような、意味のある状態の違いは、版の履歴に頼らず、データとして明示的に置く（別の面にするか、有効期間を持たせる）。
  - 昇格では、同じ実体を指す node を二つ作らない。昇格する node ごとに、新しい Deep entity を作るか、すでにある Deep entity に entity binding で結ぶかの、どちらかを行う。同じ実体かどうかは、人か AI agent が状況を総合して判断する。system は候補を示してよいが、規則で自動的には結ばない。判断は Command として記録し、誤りは、結び付けを外す Command で直す。
  - 射影には、観測用のフィルタと、作業の面の、二つのモードがある（12.3）。
- 作業の流れは次のとおりである。
  1. 体系から、関心のある領域の taxonomy を面として切り出す（射影）。
  2. その面の上で整理し、考察する（Rapid での作業）。
  3. 結果を体系へ書き戻す（昇格。Git の commit に当たる）。
- Rapid と Deep は構造が違う（木と graph）ので、適した処理方式も違う。保存エンジンの層で扱いを分ける（12.5）。

### 12.2 同一性【決定】（akaghef、2026-11-21）

面をまたいで「同じもの」をつなぐのは、実体の同一性である。ラベルが同じであることではない。

- 実体は、一つの面に一つだけ置く。その面を、その実体の正本の面と呼ぶ。
- 他の面にその実体を現すときは、alias を置く。alias は実体を複製しない。alias の `target` が、同一性の記録である。
- alias は子を持てる（4 節の不変条件 3）。alias の子は、その alias が載る面での子である。参照先の実体が正本の面で持つ子とは、別の集まりである。
- alias から alias への参照は、引き続き禁止する。alias の `target` は、必ず alias でない node である。
- 一つの実体を指す alias は、いくつあってもよい。面ごとに一つとは限らない。

例: 組織図の面に、人の node「A さん」を正本として置く。タスクの割り当ての面には、「A さん」の alias を置き、その子に A さんのタスクを並べる。

```
組織図の面（正本）            タスクの割り当ての面
  開発部                        リリース 2.0
   └ A さん  ◀── target ──────   └ A さん（alias）
                                      ├ 設計レビュー
                                      └ 移行の試験
```

- 「A さんに関わるもの」は、実体「A さん」と、それを指すすべての alias、およびそれぞれの子をたどって得る。この問い合わせは面をまたぐので、体系（Deep）の側の問い合わせである。
- 参照先を消したとき、alias は `broken` になる。alias の子は消さない。
- alias を消すときの子の扱いは、alias でない node を消すときと同じである。
- alias は scope の root になれない（不変条件 5）。この制約は変えていない。

alias の持ち方は、意味と、保存の形と、エンジンの中の形を分けて決める。

- 意味の上では、alias は「正本の実体から出る 1 本の edge を持つ node」と読める。その edge が同一性を表す。
- 保存の形（レコード）では、その edge を独立したレコードにせず、alias の node の欄 `target` として持つ（3.2）。理由は三つある。
  - alias 一つにつき参照先がちょうど一つ、という制約が、欄であることで自動的に守られる。
  - 面を読むときに、alias のレコードだけで参照先が分かる。別の面にまたがる edge を、追加で読む必要が無い。面ごとの配送（3.4 の relation edge の規則）とも衝突しない。
  - 参照先を消しても、alias を `broken` として残せる。edge のレコードにすると、端点が消えたときに edge も消える（不変条件 4）。
- エンジンの中では、問い合わせに合う形に展開する。
  - Neo4j では relationship `ALIAS_OF`（alias → 参照先）にする（8.3。【実装済み】）。参照先から alias を逆にたどるのは、この relationship の逆向きの traversal である。
  - 【提案】面の中を扱う木のエンジン（12.5）は、参照先の ID から alias の ID の集まりを引く索引を持ち、確定のたびに差分で更新する。
- どの形が速いかは、測ってから決める。測るのは、面の読み出しにかかる時間、「同じ実体の出現をすべて集める」問い合わせの時間、索引の大きさである。保存の形は、エンジンの中の形を変えても変わらない（8 節）。

【決定】（akaghef、2026-11-22）alias の子に関して、次を定める。

- parent edge の循環の検査（不変条件 2）は、alias を別の node として数える。実体の子孫の下に、その実体の alias を置くことは禁止しない。面を描くときに alias の参照先の子を展開しないので、描画は循環しない。
- alias の `access` が read のとき、止めるのは参照先の実体の内容の編集である。alias の下に子を足すことは止めない。

### 12.3 射影【決定】（akaghef、2026-11-22）

射影は、体系から一つの側面を選び、新しい面として切り出す操作である。

- 入力は、切り出す範囲（起点の実体と、たどる深さ、または実体の集まり）と、木として読む関係の指定である。関係の指定は、次のどちらかである。
  - ある面（正本の面）の parent edge。
  - ある `relationType` の relation edge。向きは、relationType の定義の `reads` に従う。
- 出力は、新しい scope である。範囲に入った実体ごとに alias を 1 つ作り、指定した関係に沿って、alias の間に parent edge を張る。兄弟の順は、元が parent edge なら元の `ord` の順、relation edge なら実体の ID の順とする。
- 関係が木にならない実体（指定した関係で親を 2 つ以上持つ実体）は、親ごとに alias を作る。同じ実体を指す alias が、面の中に複数できる。
- scope は、射影の元を持つ。

| 欄 | 型 | 意味 |
|---|---|---|
| `projection.from` | `{scopeId}` または `{relationType}` | 木として読んだ関係 |
| `projection.range` | `{root, depth?}` または `{entities}` | 切り出す範囲。起点の実体の ID とたどる深さ、または実体の ID の配列。観測用のフィルタは、これをもとに、読むたびに木を求める |
| `projection.mode` | `observe` または `work` | 射影のモード。射影を作る Command で指定する |
| `projection.baseSeq` | int | 射影した時点の通し番号。`work` のときだけ持つ |
| `projection.dissolved` | `{parent, child}` の配列 | この面で解いた関係（12.7 の OC2）。`parent` と `child` は実体の ID。書き戻しが確定したら空にする |

- 切り出す範囲に alias が入っているときは、新しい alias の `target` を、その alias の `target`（実体）にする。alias を指す alias は作らない（12.2）。したがって、射影した面をさらに射影しても、参照は 1 段のままである。
- 【決定】（akaghef、2026-11-22。同期の要件 R8.6）射影のモードは二つである。どちらで作ったかは、射影を作る Command で指定し、面に記録する。
  - 観測用のフィルタ（`observe`）: 読むための面である。構造は、体系を即時に映す。体系の側で関係が変われば、面の木も変わる。
  - 作業の面（`work`）: 組み替えるための面である。構造の変更は下書きであり、書き戻し（12.4）で確定する。
- 観測用のフィルタの面は、alias と parent edge のレコードを保存しない。保存するのは、scope と `projection`（範囲と、木として読む関係）だけで、木は読むたびに体系から求める。エンジンは、求めた結果を materialized view として持ってよい。レコードとして保存すると、体系の変更のたびに、面の数だけ追随の書き込みが要るからである。この面の中では、構造の編集（move、追加、削除）を受けない。畳んだ状態などの表示の設定は、node のレコードが無いので、scope の側（Surface View の保存設定）に、実体の ID を鍵として持つ。
- 射影は一つの Command で確定する。面の作成、alias の作成、parent edge の作成を含む（作業の面の場合）。
- 作業の面に、alias でない node を足してよい。その node は、昇格するまでは、その面だけにある Rapid の node である。昇格のときに、新しい Deep entity にするか、すでにある Deep entity に結ぶかを決める（12.1、12.4）。

### 12.4 書き戻し【決定】（akaghef、2026-11-22）

書き戻しは、切り出した面で行った整理を、体系の側の関係に反映する操作である。Rapid から Deep への昇格に当たる。

- 対象は、作業の面（`projection.mode` が `work` の scope）である。観測用のフィルタは、書き戻すものを持たない。
- 書き戻すのは、alias の間の parent edge の差分と、解いた関係（`projection.dissolved`）である。差分は、`projection.baseSeq` の時点の面と、現在の面を比べて求める。面から外すこと（OC1）と関係を解くこと（OC2）は、面に残る状態が同じ（alias が無い）なので、差分からは区別できない。そのため、解いた関係は面に記録する。

| 面での変更 | 体系の側で行う変更 |
|---|---|
| alias X′ を alias Y′ の下へ付け替えた | 元が面の parent edge なら、実体 X を実体 Y の下へ move する。元が relation edge なら、古い親との relation edge を消し、Y との relation edge を作る |
| alias の間に parent edge を足した（新しく alias を置いた） | 対応する実体の間に、同じ関係を作る |
| alias を面から外した（12.7 の OC1） | 何もしない。面から外しただけで、関係の削除とはみなさない |
| 関係を解いた（12.7 の OC2） | `projection.dissolved` に載った親子について、対応する関係を消す。元が面の parent edge なら、実体を、それが属する面の root の直下へ move する（12.7 の QB5）。元が relation edge なら、その relation edge を消す |
| 兄弟の並べ替え | 元が面の parent edge のときだけ、`ord` を書き戻す。relation edge は順序を持たないので、書き戻さない |
| alias でない node を足した | 書き戻しの Command が、node ごとに指定する。新しい Deep entity にするか、すでにある Deep entity に結ぶか、まだ昇格しないか、のどれかである。指定の無い結び付けは行わない（12.1） |
| alias の下に、alias でない子を足した | 何もしない。その子は、この面での子である |

- 書き戻しは一つの Command で確定する。理由（なぜこの整理にしたか）を Command に持たせる。
- 競合は、5.2 の規則で判定する。`projection.baseSeq` より後に、体系の側の同じ関係が変わっていたら、その項目を `CONFLICT` で拒否する。位置の変更は LWW ではなく CAS で扱う。書き戻しは、古い基準に基づく変更だからである。
- 書き戻しが確定したら、`projection.baseSeq` を、その確定の通し番号に進める。
- 【決定】（akaghef、2026-11-22。同期の要件 R8.5）書き戻しが確定したら、確定後の状態を指す名前付きの snapshot を作る。この snapshot は、保持期間の上限による削減の対象にしない。削除は、確認つきの明示の操作でだけ起きる。
- 「すでにある Deep entity に結ぶ」は、保存の形では、その node を、その Deep entity を `target` とする alias に変えることで表す。node の ID、面の中の位置、子は変わらない。alias は子を持てる（12.2）ので、子はそのまま残る。結び付けを外すときは、alias を、alias でない node に戻す。entity binding のための別のレコードは置かない。一つの node を結べる Deep entity は、一つである。
- 名前付きの snapshot は、レコードの種類 `namedSnapshot` と、archive の file で持つ。

| 欄 | 型 | 意味 |
|---|---|---|
| `id` | string | key |
| `name` | string | 人が付ける名前 |
| `seq` | int | 指している通し番号（書き戻しの確定の通し番号） |
| `scopeId` | string | 書き戻した作業の面 |
| `reason` | string | 書き戻しの Command の理由 |
| `rev` | int | 版 |

  - 書き戻しの確定のときに、その通し番号の snapshot を `archive/` に書き、`archive/index.json` に、削減の対象から外す印を付ける（6 節の retention は、この印のある file を消さない）。
  - `namedSnapshot` のレコードを消す操作が、名前付きの snapshot の削除である。確認つきの明示の操作でだけ起きる。消したときに、印を外す。
- 作業の面は、書き戻した後も残す。`projection.baseSeq` が進むので、続けて作業できる。要らなくなった面は、人が消す。
- 面と実体の対応は alias の `target` だけで決まるので、書き戻しのために新しい ID や、別の対応表は要らない。

### 12.5 エンジンの分担【提案】

採否は、計測してから決める（akaghef、2026-11-22）。

Rapid と Deep は workload が違う。

| | Rapid（一枚の面） | Deep（体系の全体） |
|---|---|---|
| 構造 | 木。parent edge と `ord` | graph。すべての面の parent edge、relation edge、alias の `target` |
| 主な読み出し | 面を丸ごと読む（通常 10 node、最大約 1,100）。兄弟を `ord` の順に並べる | 型付きの関係を何段もたどる。alias をたどって、同じ実体の出現を集める。経路と到達可能性を調べる |
| 主な書き込み | 小さな編集を高い頻度で行う。応答の速さを優先する | 書き戻しと射影。まとまった変更を低い頻度で行う |
| 不変条件 | 親が一つ、`ord` が一意、循環しない。祖先の列をたどれば検査できる | relationType の制約、関係の重複、依存の循環。graph を見る必要がある |
| 適したデータ構造 | (scope, 親, `ord`) の順序付き index と、子から親への参照 | property graph（index-free adjacency、label と relationType の index） |

- durability authority は、帯域で分けない。journal と snapshot は workspace に一本で、通し番号の全順序も共通である（1 節、2 節）。
- 分けるのは semantic authority（不変条件の検査と問い合わせ）である。
  - 面の中の検査と読み書きは、確定する側のサーバが持つ、木に特化したエンジンが担う。
  - 面をまたぐ検査と問い合わせは、Neo4j が担う。
- 二つのエンジンは、同じ journal を順に適用する state machine である。両方に関わる Command（射影、書き戻し）も、journal の上では一つの確定なので、エンジンの間の two-phase commit は要らない。食い違ったら、replay で直す。
- この案を採ると、1 節と 8 節、ADR 014 の「Neo4j は各端末の正本エンジン」を、「面の中は木のエンジン、面をまたぐものは Neo4j」に改めることになる。採るまでは、1 節と 8 節が有効である。

### 12.6 この節の項目の扱い

2026-11-22 に、akaghef が、未決の項目をすべて案のとおりに決めた。案が無かった項目は、この節の書き手が一つ選んだ。その項目には「選択はこの節の書き手」と書く。

- **KB1**【決定】（akaghef、2026-11-22。選択はこの節の書き手）scope は、帯域の欄 `band`（`rapid` または `deep`）を持つ。射影で作った面（`projection` を持つ scope）の `band` は、必ず `rapid` である。射影で作られていない scope は、作るときに `band` を指定する。Flash で取り込んだものと、手で作ったものは `rapid`、昇格で体系に入ったものは `deep` である。保持の方針は、`band` に従わない。Rapid と Deep の意味の側（同期の要件 R8.6）が改まったときは、この欄を見直す。
- **KB2**【決定】（akaghef、2026-11-22）Deep も、版をすべては残さない。全版のためのレコードは置かない。昇格のときに、名前付きの snapshot を残す（12.1、12.4）。
- **KB3**【決定】消す操作を、対象ごとに分ける（12.7）。
- **KB4**【決定】作業の面は、書き戻した後も残す（12.4）。観測用のフィルタも残る。
- **KB5**【保留】facet（Glossary の定義では、PJ 直下の第一階層の scope）と、12.1 の「一つの側面」を、同じ語で呼んでよいか。語の組は、Glossary の側で決める。保存の形には影響しない。
- **KB6**【決定】コピーの意味を、軸の組み合わせで定義する（12.8）。
- **KB7**【決定】観測用のフィルタの面は、レコードとして保存しない。表示の設定は scope の側に持つ（12.3）。
- **KB8**【決定】「すでにある Deep entity に結ぶ」は、node を alias に変えることで表す（12.4）。
- **KB9**【決定】名前付きの snapshot は、レコードの種類 `namedSnapshot` と、削減の対象から外した archive の file で持つ（12.4）。

### 12.7 消す操作の意味【決定】（akaghef、2026-11-22）

「消す」は、何を消すかで意味が違う。消す対象は、次の三つである。

| 対象 | 意味 | 例（組織図の「A さん」） |
|---|---|---|
| 出現 | 実体が、ある面に現れていること | この図には A さんを載せない |
| 関係 | ある親子の関係が成り立つこと | A さんは、もう開発部の所属ではない |
| 実体 | そのものが在ること | A さんが退職した。または、A さんは誤って作った node だった |

今の実装の delete は、この三つを区別しない。node を消し、それを指す alias を `broken` にする（12.2）。組織図で退職した人を消すと、タスクの割り当ての面の「A さん」は、壊れた参照になる。過去に誰が担当したかは、読めなくなる。

操作を、対象ごとに分ける。一つの操作が、状況によって別の意味になることを無くす。

| 番号 | 操作 | 対象 | 面に残る状態 | 体系の側 | 他の面の alias |
|---|---|---|---|---|---|
| **OC1** | 面から外す | 出現 | alias を消す | 変えない | 変えない |
| **OC2** | 関係を解く | 関係 | 射影した面では、alias を消し、解いた親子を `projection.dissolved` に載せる。正本の面では、別の親への move である | 書き戻しで、その関係を消す（12.4） | 変えない |
| **OC3** | 実体を終える | 実体 | node は残る。終わったことを示す状態を持つ | 実体も関係も残る | 生きたまま。参照先が終わっていることを表示できる |
| **OC4** | 実体を取り消す | 実体 | node を消す | 実体と、それを端点とする関係を消す | `broken` になる |
| **OC5**（今は置かない。QB3） | 正本の面を移す | 正本の位置 | 実体を、alias のあった位置へ移し、元の位置に alias を置く | 同一性は変わらない（実体の ID は同じ） | `target` は変わらない |

規則:

- どの操作かは、操作を出した時点で決まる。Command の種類が意味を運ぶ。面の状態や、alias の有無から、後で推し量らない。
- 当てはまらない操作は拒否し、理由と、当てはまる操作を返す。別の操作に読み替えない。
  - OC1 を、alias でない node に出したとき: 拒否する。実体は正本の面に必ず居るので、面から外すだけ、はできない。実体をやめるなら、OC3 か OC4 を使う。
  - OC2 を、正本の面で出したとき: 親を持たない node は置けない（面は木である）ので、行き先を指定した move として受ける。
  - OC3・OC4 を alias から出したとき: 対象は参照先の実体である。alias の `access` が write のときだけ受ける。
- OC3 と OC4 の違いは、他の面から見えるかどうかである。OC3 は「在ったが、終わった」で、履歴として読める。OC4 は「無かった」で、参照は壊れる。`broken` は、OC4 の結果（と、同期や取り込みで参照先が届いていない場合）だけを表す。
- 今の delete は、OC4 に当たる。alias に対する今の delete は、OC1 に当たる。
- 子の扱いは、どの操作でも今と同じである（node を消すときは、その面での子孫も消す。alias の子は、参照先を消しても消さない）。

例: 組織図（正本の面）と、タスクの割り当ての面（alias）で、A さんを扱う。

| したいこと | 操作 | 組織図 | タスクの割り当ての面 |
|---|---|---|---|
| A さんが営業部へ異動した | OC2（move） | A さんが営業部の下へ移る | 変わらない |
| A さんが退職した | OC3 | A さんは残り、終わった状態になる | alias と、その下のタスクは残る。終わっていることを表示する |
| A さんは、誤って作った node だった | OC4 | 消える | alias は `broken` になる。下のタスクは残る |
| リリース 2.0 から A さんを外す | OC1（alias に対して） | 変わらない | alias と、その下のタスクが消える |
| 組織図をやめ、A さんの正本をタスクの割り当ての面に置く | OC5 | A さんの位置に alias が残る | alias が実体に替わる |

ロックとの関係【決定】（akaghef、2026-11-22）:

ロックは、対象の構造の変更（削除、移動、parent edge の付け替え）を止める。label と attribute の編集は止めない。子孫には及ばない。ただし、ロックした対象を巻き込んで消す Command は確定しない（akaghef、2026-11-22。同期の要件 R2.6）。これを、五つの操作に当てはめる。

| ロックの対象 | 止める操作 | 止めない操作 |
|---|---|---|
| alias（ある面での出現） | その alias を面から外す（OC1）。その alias の関係を解く、別の親へ移す（OC2） | 参照先の実体を別の親へ移すこと。他の面にある、同じ実体の alias に対する操作 |
| alias でない node（実体） | 別の親へ移す（OC2）。面を移す（OC5） | その実体を指す alias を、他の面から外すこと。label と attribute の編集 |

- **QG1**【決定】（akaghef、2026-11-22。同期の要件 R2.6）ロックは出現ごとに付く。実体を終える操作（OC3）と、取り消す操作（OC4）は、その実体の出現（実体の node と、それを指すすべての alias）のどれかがロック中なら、確定しない。ロックされていない出現を面から外す操作（OC1）は、他の出現がロック中でも確定する。
- 出現を面から外す、関係を解く、別の親へ移す、という操作については、ロックは、掛けた出現だけに効く。実体の node のロックは、それを指す alias を面から外すことを止めない。
- 祖先を消す操作が、ロックした node（alias を含む）を子孫として巻き込むときは、その操作を確定しない。
- 作業の面での組み替えは下書きなので、参照先の実体がロックされていても、alias の move は受ける。書き戻し（12.4）のときに、ロックされた実体を動かす項目を、ロックを理由として拒否する。他の項目は確定する。
- 判定の仕組みへの帰結（3 節）: ロックの判定は、確定のときの `touched` で行う。OC3 は node を消さず、parent edge も変えないので、終えることを表す event kind が要る。OC4 は、参照していた alias の `broken` を同じ Command の中で書き換え、その alias が `touched` に現れるようにする。

個別の決定（akaghef、2026-11-22）:

- **QB1**【決定】（選択はこの節の書き手）OC3 の「終わった」状態は、node の有効期間で持つ。意味のある状態の違いは、データとして明示的に置く、という決定（12.1）に従う。

| 欄 | 型 | 意味 |
|---|---|---|
| `valid.from` | time、任意 | 実体が在り始めた時 |
| `valid.to` | time、任意 | 実体が終わった時。OC3 は、この欄を埋める |

  - 欄が無いことは、「期間の指定が無い（今も在る）」と読む。任意の欄の追加なので、format は上がらない。
  - 終えた実体を元に戻すのは、`valid.to` を消す Command である。
  - 確定のときの変更の一覧（`touched`）では、`valid.to` を埋める変更を、終えることを表す event kind として出す（3 節）。
- **QB2**【決定】OC4 で、他の面の alias は `broken` で残す。alias の下の子（その面の実体）は、巻き込まない。OC4 は、`broken` の書き換えを、同じ Command の中で行う。
- **QB3**【決定】OC5（正本の面を移す）は、今は置かない。scope をまたぐ move の保留（同期の要件 R2.4）に従う。保留が解けたときに、この節へ足す。
- **QB4**【保留】操作の入口（鍵、メニュー）に、どの操作を割り当てるかは、配置を決める段階で決める。保存の形には影響しない。
- **QB5**【決定】作業の面で、元が面の parent edge である関係を解いたとき、書き戻しは、実体を、それが属する面の root の直下へ move する。専用の置き場は作らない。

### 12.8 コピーする操作の意味【決定】（akaghef、2026-11-22）

「コピーする」も、「消す」（12.7）と同じく、対象によって意味が違う。組織図の「A さん」をコピーする、と言ったとき、次のどれもがあり得る。

| 番号 | したいこと | 増えるもの | 同じ A さんか |
|---|---|---|---|
| **OD1** | A さんを「リリース 3.0」にも割り当てる | alias が 1 つ | 同じ実体 |
| **OD2** | A さんをひな形にして、新人 B さんの node を作る | 新しい ID の node | 別の実体。来歴だけが残る |
| **OD3** | 来期の組織図の案を作る。人は同じで、配置だけを変える | 範囲の実体をすべて alias にした面 | 同じ実体 |
| **OD4** | 11 月末の時点の A さんの担当を残す | 名前付きの snapshot への参照 | 同じ実体の、その時点の姿 |

既存の枠組み（[operation-algebra-requirements](../../.kiro/specs/rapid-persistence-redesign/operation-algebra-requirements.md) 11 節）は、「hard copy は新しい実体、alias は copy ではなく参照」である。この節は、その枠組みを、正本の面と alias の読み（12.2）の上に置き直す。copy の種類（deep copy、shallow copy、scope copy）と、範囲内の参照の付け替えの規則は、11 節のものをそのまま使う。

#### 軸

コピーの種類を並べて増やすのではなく、互いに独立な軸の組み合わせとして定義する。

| 番号 | 軸 | 選択肢 | 決まり方 |
|---|---|---|---|
| **JA1** | 同一性 | 出現を増やす（同じ実体） / 実体を複製する（新しい ID） | Command の種類で決まる |
| **JA2** | 範囲 | node 一つ / 部分木 / scope | Command の引数で決まる |
| **JA3** | 範囲の中の alias | alias のまま写す（同じ実体を指す） / 写さない / 参照先の実体も複製する | Command の引数で決まる。省いたときは、alias のまま写す（QD2） |
| **JA4** | 範囲の外への参照 | 範囲の中どうしは、写した先へ付け替える。外を指す alias の `target` は共有する。境界をまたぐ relation edge は写さない | 固定（11 節） |
| **JA5** | 範囲の中の scope | 中まで写す | 固定（11 節） |
| **JA6** | 置き先 | 同じ面 / 別の面 / 別の workspace | Command の引数で決まる |
| **JA7** | 時間 | 独立（写した後は別々に変わる） / 時点の写し（OD4） | Command の種類で決まる |

次の二つは、意味の軸に入れない。

- attribute と `collapsed` は、常に写す（11 節）。選択肢を置かない。
- データを物理的に共有するかどうか（copy-on-write）は、エンジンの実装の選択である。意味は変わらない。

「写した後も、元の変更に追従する」という選択肢は置かない。追従させたいなら、それは同じ実体であり、出現を増やす（JA1）を使う。

#### 同一性と範囲の組み合わせ

JA1 と JA2 の組み合わせが、操作の集まりになる。

| | node 一つ | 部分木 | scope |
|---|---|---|---|
| 出現を増やす | alias の作成（OD1） | 部分木の射影。範囲の実体ごとに alias を作り、親子を alias の間に張る | 射影（12.3、OD3） |
| 実体を複製する | shallow copy（OD2） | deep copy | scope copy |

- 上の段は、三つとも同じ操作の、範囲の違いである。OD3 は、OD1 を範囲に広げたものである。
- 【決定】（akaghef、2026-11-22）書き戻し（12.4）の対象になるのは、射影で作った新しい面だけである。部分木の射影も、新しい面を作る。すでにある面の中へ alias を置くこと（1 つずつ、または部分木ごと）は alias の作成であり、書き戻しの対象にしない。`projection` は scope の欄のままで、alias のレコードに基準の欄は足さない。
- 上の段で、範囲に alias が入っているときは、その `target`（実体）を指す alias を作る。alias を指す alias は作らない（12.2、12.3）。
- 下の段で、範囲に alias が入っているときは、alias を写す（JA3）。参照先の実体は増えない。参照先の実体も複製したいときは、その実体に対して、別に下の段の操作を出す。

#### 規則

- どの操作かは、Command の種類で決まる（12.7 と同じ）。選んだものが alias か実体か、置き先が同じ面か別の面かで、意味を切り替えない。
- 当てはまらない操作は拒否し、理由と、当てはまる操作を返す。
  - 出現を増やす操作で、置き先が別の workspace のとき: 拒否する。同一性は workspace をまたがない。実体を複製する操作を使う。来歴に、元の workspace と実体を残す。
  - 実体を複製する操作を、alias に対して出したとき: JA3 の引数に従う。引数を省いたときは alias を写す。入口の側で、黙って別の操作に読み替えない。
- 実体を複製したときは、来歴（元、基準の通し番号、方式、ID の対応）を残す（11 節）。出現を増やしたときは、alias の `target` が記録なので、来歴を別に持たない。
- 実体を複製しても、他の面にある alias は付いてこない。alias は、それが載る面のものであり、参照先の実体の一部ではない。

#### 例

組織図（正本の面）と、タスクの割り当ての面（A さんの alias の下に、タスクが並ぶ）で考える。

| 番号 | 操作 | 結果 | 注意 |
|---|---|---|---|
| **FE1** | 組織図を、実体を複製する操作（scope copy）で写す | 全員が新しい ID になる。写した先の「A さん」は別の実体で、タスクの割り当ての面とつながらない | 来期の案を作りたいなら、出現を増やす操作（射影）を使う |
| **FE2** | 組織図の A さんを、実体を複製する操作（deep copy）で写す | A さんの下の子（連絡先など）も写る。写した先の実体は、タスクの割り当ての面に alias を持たない | 担当のタスクは 0 件になる |
| **FE3** | タスクの割り当ての面で、alias の A さんを、部分木ごと実体を複製する操作で写す | alias が 1 つ増える（同じ A さんを指す）。その下のタスクは、その面の実体なので、新しい ID で写る | A さんは増えない |
| **FE4** | 「リリース 2.0」の部分木を deep copy して、「リリース 3.0」を作る | 中の alias は、同じ A さんを指す。A さんの出現が 1 つ増える | 担当者を引き継ぎたくないときは、写した後に、面から外す（12.7 の OC1） |
| **FE5** | A さんを、別の workspace へ写す | 新しい ID の実体になる。来歴だけが残る | 出現を増やす操作は拒否される |
| **FE6** | 組織図の A さんを、タスクの割り当ての面へ置く | 出現を増やす操作なら alias。実体を複製する操作なら、同じ名前の別の実体 | copy する時点で、入口を分けて選ぶ（下の「操作の入口」） |

#### 操作の入口【決定】（akaghef、2026-11-22）

- コピーの意味は、copy する時点で、入口を分けて選ぶ。出現を増やす copy と、実体を複製する copy は、別の入口である。貼り付けは、copy した時点で選んだ意味をそのまま行う。置き先が同じ面か別の面かで、意味を変えない。
  - 入口の例: Cmd+C、Cmd+Alt+C、Cmd+Shift+C を、意味ごとに割り当てる。どの鍵をどの意味に当てるかは、配置を決める段階で決める。
  - 保存の側の帰結: clipboard の内容は、選んだ意味（JA1）を持つ。貼り付けの Command は、その意味を種類として持つ。
- 操作の選択肢（JA1〜JA7 の組み合わせ）は、分岐の型として、すべて Command の引数に持たせる。人が、そのすべてを手で打つことは想定しない。
  - 人の入口は、少数の直感的な概念（同じ実体か別の実体か、どの範囲か）を選ぶものに絞る。それ以外の引数は、省いたときの値を使う。
  - 細かい選択肢は、AI agent が、人の指示と規則に基づいて選び、Command として出す。MCP と CLI は、すべての引数を受ける。
  - この節の「固定」は、「人の入口では選ばせず、省いたときの値を使う」と読む。引数としては存在する。
- 実体を複製する copy は、その時点の値を固定した写しであり、同じ実体の写しを生む。使うのは、別のものの雛形と、外への持ち出しに限る（akaghef、2026-11-22。同期の思想「過去の情報の残し方」）。出現を増やす copy は、常に今の値を映す。
- 時点の写し（OD4）は、実体の複製では表さない。意味のある状態として明示的に置くか、名前付きの snapshot を参照する（12.1）。参照は、`namedSnapshot` の `id` で行う（12.4）。

#### 入口を二層にすることで要るもの【決定】（akaghef、2026-11-22）

- 引数を省いたときの値は、仕様で一つに決める。入口（GUI、MCP、CLI）ごとに違う値を持たない。
- AI agent が選んだ引数は、結果から読めるようにする。実体を複製したときの来歴の「方式」に、選んだ引数の値を残す。人が、後から「何が行われたか」を確かめられる。
- 引数の組み合わせのうち、禁止するもの（例: 出現を増やす × 別の workspace）は、どの入口から来ても、同じ理由で拒否する。
- 同じ考えは、消す操作（12.7）にも当てはまる。12.7 の操作も、人の入口では絞り、AI agent にはすべて開く。

#### 個別の決定（akaghef、2026-11-22）

- **QD2**【決定】範囲の中の alias を写すときに、JA3 の引数を省いたら、alias のまま写す。写した先の alias も、同じ実体を指す。alias を写さない扱いと、参照先の実体も複製する扱いは、引数で選べる。
- **QD5**【決定】【実装済み】貼り付けでは、alias と relation edge の付随情報、`collapsed` を写す。範囲の中の alias は alias のまま写し、参照先の実体が同じ範囲で写されたときは写した先の実体を指す（JA4）。参照先が範囲の外にあるときは元の実体を指したままにする。範囲の中で両端が閉じた relation edge は、label、relationType、向き、線種、attributes ごと写す。実装は `beta/src/shared/clipboard_subtree.ts`。[Multi_Select.md](../04_Architecture/Multi_Select.md) はこの規則に揃えてある。

## 13. 未決

- 面の中を扱う木のエンジンを置くか（12.5）。計測してから決める。
- facet と 12.1 の「一つの側面」の語の組（12.6 の KB5）。Glossary の側で決める。
- alias の確度（3.2）: alias が出現ごとに自分の値を持つか、常に `-1` を持ち読むときに参照先の値を返すか。
- Flash ingest が attribute `m3e:confidence` に書いている 0〜1 の値を、format 3 への移行で `certainty` に移すか。relation edge の attribute `confidence`（実現段階）は意味が違うので対象にしない。
- 「確度」を Glossary に足す。

## 14. 決めた値と規則

- 計算で求まる値の定義の名前は、`m3e:derived:<名前>` とする。計算で求まる値は、レコードに保存しない（9 節）。
- 接頭辞 `m3e:` は `urn:m3e:`、`misc:` は `urn:m3e:misc:` を指す。Turtle へ書き出すときに使う。
- record-schema の担当の決め打ち（`note`・`link` を details に持つこと、`extra`、HTML を載せる種別など）は、record-schema に書いたとおりとする。
- 確定済みで、端末の状態へまだ反映していない間: push の結果は確定の通し番号を返す。読み込みは `minSeq` を受け、remote がその通し番号まで反映してから返す。再送には、確定済みの結果（5.3）を返す。
- map の最終更新は、確定ごとに触れたレコード（`touched`）の `mapId` から、キャッシュとして求める。レコードには持たない。
- 大きな取り込み（100 万 node）は、どの scope からもたどれない部分木として、複数の Command に分けて確定する。最後の Command が、その部分木の root を親へつなぐ。つなぐまでは、読み込みに現れない。
- 位置（move と `ord`）は LWW（5.2 規則 9）、それ以外の欄は CAS（5.2 規則 3）で判定する。outbox から届いた、基準が古い move は LWW で受ける。ロックの判定（3 節）は、別に行う。

## Related

- [Glossary](../00_Home/Glossary.md)
- [実装ログ](../../.kiro/specs/rapid-persistence-redesign/implementation-log.md)（実装の中で得た気づきと問題。未対応の項目を先に読む）
- [ADR 014](../09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)
- [Data_Model.md](./Data_Model.md)（現行の保存の仕様）
- [Engine.md](../01_Vision/Engine.md)、[LLM_Workbench.md](../01_Vision/LLM_Workbench.md)
- [record-schema.md](../../.kiro/specs/rapid-persistence-redesign/record-schema.md)、[snapshot-format.md](../../.kiro/specs/rapid-persistence-redesign/snapshot-format.md)、[post-migration-spec.md](../../.kiro/specs/rapid-persistence-redesign/post-migration-spec.md)
