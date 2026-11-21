# 実装ログ（保存・DB）

保存と DB の作業をする agent が、作業の中で得た気づきと見つけた問題を書き込む場所。言われたことをこなすだけでなく、作業で分かったことを仕様と次の作業に活かすために使う。

対象は [DB 仕様書](../../../docs/03_Spec/Database_Spec.md)と、この spec の文書（[record-schema](record-schema.md)、[snapshot-format](snapshot-format.md)、[post-migration-spec](post-migration-spec.md) など）、`beta/src/shared/record_model/`、`beta/src/node/record_store/`、`beta/src/node/neo4j_store/` である。

## 使い方

### いつ書くか

作業の中で、指示の外にあることに気づいたら書く。例を挙げる。

- 仕様と実装の食い違い
- 仕様の穴（決まっていないのに、実装が何かを前提にしている）
- 実データで分かった事実（件数、形の不揃い、大きさ）
- 性能の事実（どこが遅いか、何に比例するか）
- 危険（データが消える、戻せない、黙って壊れる）
- 次の作業を楽にする気づき（再利用できる関数、試験の作り方）

### どこに書くか

- **確かめた事実で、仕様の記述を正す・補うもの**: その仕様に直接書く。たとえば【実装済み】の状態、数値、ファイルの位置がこれに当たる。このログには 1 件立て、扱いを「仕様へ反映」として行き先を書く。
- **決定が要るもの、その作業では直さないもの**: このログにだけ書く。仕様の【決定】の中身を、実装者の判断で書き換えない。決定は akaghef が行う。
- **M3E の map の操作で得た教訓**: `m3e_feedback` に送る（AGENTS.md の規則）。このログには書かない。

### 書き方

- 新しいものを上に足す。1 件は次の形にする。

```
### YYYY-MM-DD 一行の題（何が起きているか）

- 種類: 問題 / 気づき
- 書いた agent: 役割や session の名前（ID は書かない）
- 対象: 仕様の節、file:line
- 中身: 何が分かったか。読んだ人が元を辿らずに分かるように書く
- 根拠: どう確かめたか（実行したコマンド、読んだコード、計測）。確かめていなければ「未確認」と書く
- 扱い: 未対応 / akaghef の判断待ち / 仕様へ反映（行き先） / 実装で解消（commit と、その意図） / 不要（理由）
```

- 解消しても消さない。扱いを書き換える。
- 定義語だけを使う（[Glossary](../../../docs/00_Home/Glossary.md)）。用語の変更の経緯や旧い呼び名は書かない。
- 会話の中の番号（DA1、IB3 など）は、そのまま書かない。中身を文で書く。

### 読む側

- 保存と DB の作業を始める agent は、扱いが「未対応」と「akaghef の判断待ち」の項目を先に読む。
- 自分の作業で解消した項目は、その場で扱いを更新する。

## 記録

### 2026-11-22 journal の provenance を決めた形にし、observed を MCP の読み取り集合から作った。仮決めが 6 件ある

- 種類: 気づき
- 書いた agent: journal envelope 実装 session
- 対象: DB 仕様書 6 節（`provenance`）、`beta/src/node/record_store/provenance.ts`、`beta/src/node/record_store/store.ts`（`shownRecords`・`revsOf`・確定時の検査）、`beta/src/node/mcp_service.ts`（読み取り集合と `provenanceOf`）、`beta/src/browser/save_command.ts`
- 中身:
  - journal の行の `provenance` は `{items: [{mode, rk, rev}], truncated?}` になった。store は確定のときに形を検査する。形の合わない item を持つ Command は `INVALID_COMMAND` で断る。rk の重複は最初の 1 件だけを残す。100 件を超えた分は切り、`truncated: true` を付ける。
  - これまでの値（MCP の `{contextId, tool}`、viewer の `{tabId}`）は journal に残さない。どちらも `actor.id` と同じ値である。viewer はもう送らない。
  - 【仮決め】observed は、MCP の参加（participation）が見せられた record の読み取り集合（read set）から作る。OCC の read set と同じ考え方で、rk ごとに読んだ時点の `rev` を持つ。参加ごとに新しい順に 10,000 件まで残す。
  - 【仮決め】「見せられた」の範囲は次の二つである。
    - `m3e_get`（state）が返したページの node（その details record を含む）と relation edge。
    - 変更の event が本文を見せた node（先頭 30 件）。
    - 検索の結果と、文脈の要約に出る子の名前は含めない。
  - 【仮決め】確定のときに、読んだ後で他の発行者が書き換えた record（今の `rev` が読んだ `rev` と違い、自分の確定の seq でもないもの）は外す。読んだものが、もう今の値ではないためである。自分で書き換えた record は、読んだ時点の `rev` のまま残す。消えた record も外す。
  - 【仮決め】declared は copy の出所の subtree だけである。agent が出所を明示する引数は、まだ作っていない。
  - 【仮決め】並びは、declared を先に、次に observed を読んだのが新しい順に置く。上限の 100 件はこの順で埋める。
  - 【仮決め】SQLite の上で動くときは record key が無いので、`items` は空になる。道具の名前（`tool`）は残らない（`intent` が残る）。
- 根拠: `beta/tests/unit/journal_provenance.test.ts` の 4 件。修正を外すと 4 件とも失敗する。他者の書き換えを外す条件を抜くと 1 件、自分の書き換えを残す条件を抜くと 1 件失敗することも確かめた。MCP・確定・record store・server の既存試験（151 件）は通る。
- 扱い: 実装で解消（commit「Journal provenance takes the frozen shape」。provenance を決めた形にし、読み取り集合から observed を作った）。仕様へ反映（DB 仕様書 6 節。決定との差 3 点のうち provenance の 1 点が解消する。文面は DB スキーマ設計 session へ送る）。仮決めの 6 件は akaghef の判断待ち。

### 2026-11-21 「消す」の意味を、出現・関係・実体に分ける案を、DB 仕様書 12.7 節に【提案】として書いた

- 種類: 仕様の穴
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 12.3・12.4・12.6・12.7 節
- 中身: akaghef が 2026-11-21 に、正本の面（例: 組織図）で実体を消すことの意味は状況によって違い、それを厳密に分けたい、と述べた。今の delete は、面から外すこと、親子の関係を解くこと、実体を終えること（退職）、実体を取り消すこと（誤り）を区別せず、node を消して alias を `broken` にする。案は、操作を五つ（面から外す、関係を解く、実体を終える、実体を取り消す、正本の面を移す）に分け、Command の種類が意味を運ぶ形にすることである。面から外すことと関係を解くことは、面に残る状態が同じなので、解いた関係を scope の `projection` に記録する欄を足した（名前は仮）。あわせて、射影の範囲に alias が入っているときは参照先の実体を指す alias を作る（alias を指す alias は作らない）と書いた。
- 根拠: DB 仕様書 12.2 節の「参照先を消したとき、alias は `broken` になる」と、12.4 節の書き戻しの表を読んだ。実装の delete の経路は、この件では読み直していない。
- 扱い: akaghef の判断待ち。決めること: 実体が終わった状態を node のどの欄で持つか（保存の形の変更）、実体を取り消すときに他の面の alias を `broken` で残すか拒否するか、正本の面を移す操作のために scope をまたぐ move の保留を見直すか、射影した面で関係を解いた実体を正本の面のどこへ置くか

### 2026-11-21 alias は子を持てる、と決まった。実装と、いくつかの文書は「持てない」のままである

- 種類: 仕様と実装のずれ
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 3.2 節、4 節の不変条件 3、12.2 節。`beta/src/shared/record_model/invariants.ts:108-111`、`beta/src/node/rapid_mvp.ts:425`、`beta/src/node/mcp_service.ts:434`・`524`、`beta/src/node/flash_jobs.ts:121`
- 中身: akaghef が 2026-11-21 に「alias は子を持たない」を廃止した。面をまたいで同じ実体をつなぐために、正本の面に実体を置き、他の面には alias を置いて、その下に子を並べる（例: 組織図の人を正本にし、タスクの割り当ての面に alias を置く）。DB 仕様書、record-schema、post-migration-spec、Glossary は改めた。実装は、上の 4 か所で alias の子を拒否している。次の文書は、今の実装の説明か、他の session の文書なので、まだ「持てない」と書いている: `docs/03_Spec/Data_Model.md` 87 行目、`docs/protocols/map-write-protocol.md` 27 行目、`operation-algebra-requirements.md` 96 行目（alias が子を持てないことを前提に、子孫の共有を論じている）、`draft-record-model.md` 172 行目。
- 根拠: `git grep` で「子を持たない」「cannot own children」を探して読んだ。
- 扱い: 仕様へ反映（DB 仕様書 3.2・4・12.2 節）。実装は未対応。viewer が alias の子をどう描くか、alias を畳んだときの表示、MCP の応答の形は決まっていない

### 2026-11-21 射影・書き戻し・エンジンの分担を、DB 仕様書 12 節に【提案】として書いた

- 種類: 気づき
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 12.3〜12.6 節、1 節、8 節、[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)
- 中身: akaghef の読み（体系から一側面を面として切り出し、整理して書き戻す。Rapid は木、Deep は graph で、保存エンジンの層で扱いを分けたい）を受けて、射影の入力と出力、scope の `projection` 欄、書き戻しの対応表、エンジンの分担を案として書いた。エンジンの分担を採ると、「Neo4j は各端末の正本エンジン」（ADR 014、DB 仕様書 1・8 節）を「面の中は木のエンジン、面をまたぐものは Neo4j」に改めることになる。
- 根拠: 2026-11-21 の akaghef との対話。workload の表の数値（面は通常 10 node、最大約 1,100）は、同期の要件 R10.1 の値である。処理の速さは測っていない。
- 扱い: akaghef の判断待ち（12.3〜12.5 の採否と、12.6 の五点）

### 2026-11-19 journal の畳み込みを、archive への移動と 90 日後の検証つき削除として実装した。仮決めが 5 件ある

- 種類: 気づき
- 書いた agent: Neo4j 化の実装の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts`（`compact()`、`append()`、`commitsAfter()`、`committedCommand()`）、`beta/src/node/record_store/journal_archive.ts`
- 中身: 畳み込みは journal を捨てず、journal と置き換わる snapshot を `archive/` へ hard link（できない環境では複製）で移す。名前は `journal.<最初の通し番号>-<最後の通し番号>.f<snapshot の format>.jsonl` と `snapshot.<通し番号>.f<format>.jsonl`、移した時刻は `archive/index.json`。新しい snapshot の sha256 は `commit-index.json` の `snapshot` に記録する。archive の削除は移してから 90 日後で、今の snapshot を fsync して checksum を読み直し、記録と一致し、削除する範囲を覆っているときだけ行う。問題が 1 件でもあれば何も消さない。journal の各行には、確定で canonical な値に差分が出たレコードの一覧 `touched`（`rk` と出来事の種類 `ev`）を store が作って書く。Neo4j の追いつきと、確定済みの Command の読み出しは、畳み込み後も archive から行う（以前は Neo4j を全件作り直し、Command は読めなかった）。次の 5 点は二方向に戻せるので仮決めにした。
  - 畳み込みの契機は replay の長さだけ: snapshot より後の journal の行が 50,000 行（`M3E_COMPACT_AFTER_LINES`、0 で無効）に達した確定の直後と、開いたときの replay がその長さだったとき。時刻では起動しない。
  - 削除の判定は、開いたときと畳み込みの後に自動で行う。止まった理由は `maintenanceStatus()` と警告の log に出す。
  - `ev` の割り当ては、`attributes` → `m3e:attribute`、`extensions` → `m3e:extension`、parent edge の `source`・`target`・`ord`・`scopeId`・`type` と scope の `rootNodeId` → `m3e:structure`、新規 → `m3e:create`、削除 → `m3e:delete`、それ以外（text、本文、surface と nodeView の位置を含む）→ `m3e:content`。位置の変更に別の種類を作るかは未決。`m3e:target` は対象の欄が決まるまで出さない。
  - snapshot の `format` は 1 のまま。format 2 への切り替え（base snapshot の作成）は、parent edge の欄や extension 定義など他の format の変更と一緒に行う。archive の名前の `f1` はその前の区間を示す。
  - journal の `provenance` は、今までどおり Command の provenance をそのまま書く（MCP からは `{contextId, tool}`）。DB 仕様書 6 節の【決定】の形 `{items, truncated?}` とは違う。確定済みの Command を読む既存の経路がこの値を返しているため変えていない。Command の provenance を `items` へどう写すかは未決。
- 根拠: `beta/tests/unit/record_store_compaction.test.ts` の 9 件が通り、変更前の `store.ts` では 9 件とも落ちることを確かめた。最初の snapshot と全 journal の行から作り直したレコード、途中の snapshot とその後の行から作り直したレコード、store 自身の snapshot と後続の行から開いたレコードが、元のレコードと一字一句一致する。既存の record store の試験も実行した。
- 扱い: 実装で解消（journal を消さない畳み込みの commit）。仮決めの 5 点は、変えるなら akaghef の判断で直す。DB 仕様書 6 節の「圧縮は journal を空にする」「journal を空にしている」「手放す操作は v1 では実装しない」の 3 文は、この実装と 90 日の決定に合わなくなったので、DB 仕様書の担当へ直しを依頼した


### 2026-11-19 実データの兄弟順キーに同じ値は無く、兄弟順キーを fractional-indexing に移した

- 種類: 気づき
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 3.4 節・4 節、`beta/src/shared/record_model/order_key.ts`
- 中身: 三つの workspace の最新 backup の read-only の写し（41・12・12 map、parent edge 49,923 本）を `toSnapshot` で変換して数えた。同じ map・同じ親の下で同じ `ord`：0 件。有効でない `ord`：0 件。`children[]` に同じ子が二度：0 件。並べた親と子の `parentId` の食い違い：0 件。保存データはまだ `ord` を持たず、変換のときに `children[]` の順から作るので、「移行前の等しい key」の例外は現在の実データでは起きない（守りとしてだけ残す）。兄弟順キーは `fractional-indexing` の base62 の key に移した。以前の base36 の key は無効として、読み込み時に振り直す。
- 根拠: scratchpad の集計スクリプトで、`node:sqlite` の readOnly で写しを読んで計測。単体試験 `record_model_order_key`・`record_model_steady`・`record_model_to_snapshot`。
- 扱い: 仕様へ反映（兄弟順の文面を DB 仕様書の担当 session へ送付済み。[操作の代数の要件](operation-algebra-requirements.md) 8 節）

### 2026-11-19 操作の代数の要件のうち、保存形式に効かない六点を推奨どおりに仮決めした

- 種類: 気づき
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: [操作の代数の要件](operation-algebra-requirements.md) 9・11・12 節
- 中身: 実装に早く移るため、保存形式に効かない次の六点を推奨どおりに【仮決め】として要件に書いた。(1) scope の移動だけでは relationType を変えず推論もしない。(2) unscopen で処分の方針が決まっていない所有データ（linear-text・注釈・Surface View の設定）があれば拒否する。(3) shallow copy は選んだ node だけ、scope copy は deep で同じ root の別の方向の scope を含めない。(4) deep copy の外側を指す参照は共有し、境界をまたぐ relation edge は既定では複製しない。(5) dissolve で条件・根拠を持つ中間 node、join で attribute を本文だけに落とすものは拒否し、中身のない中間 node 自身の色と配置の削除は明示して許す。(6) copy の来歴は journal を圧縮しても失わない形で残す。
- 根拠: GPT Pro との二回の要件レビューで推奨とされたもの。実装・実データでは未確認。
- 扱い: akaghef の判断待ち（仮決めの承認）

### 2026-11-19 ADR 014 の「stream の輸送は Syncthing」が、remote と outbox の形と合わない

- 種類: 問題
- 書いた agent: DB スキーマ設計の session（DB 仕様書の書き手）
- 対象: [ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md) の Decision 5、DB 仕様書 2 節
- 中身: freeze v1 で、journal は remote 上で workspace に一本、端末は outbox に未確定の Command を積む形になった。Syncthing は file 単位の複製で、ack も reject も返さない。そのため、outbox から remote への push（確定の要求と、その結果の受け取り）には使えない。使えるとしても、remote が単一の writer になる pull の log shipping だけである。ADR 014 の Decision 5 は「stream の輸送は Syncthing で行う」のままである。
- 根拠: ADR 014 の Decision 5 と、DB 仕様書 2 節・sync-principles の「remote と local」を読んで比べた。
- 扱い: 仕様へ反映（2026-11-21 akaghef の判断。ADR 014 Decision 5 を、remote の server への HTTP の push / pull に直した。Syncthing は廃止。sync-principles 16 行目の 2026-11-18 の決定に揃える整合の修正）

### 2026-11-19 拒否した Command の結果を覚えていないため、前提が変わった後の再送が通る

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 5.3 節、`beta/src/node/record_store/store.ts:616`（再送の判定）、`store.ts:1231`（確定した Command だけを登録）
- 中身: 再送で「最初の結果」を返すのは、確定した Command だけである。拒否した Command は ID を覚えないので、拒否の後に状態が変わってから同じ ID を再送すると、今度は確定する。依頼した側から見ると、一度は拒否と返った依頼が、応答を受け取れなかった再送で黙って通る。確定的な拒否（`CONFLICT`、`INVALID_STATE`、`INVALID_COMMAND`）も最初の結果として持ち、同じ ID には同じ拒否を返すことを提案する。一時的な拒否（`ENGINE_BEHIND`）は除く。
- 根拠: `store.ts:612-627` と、`this.commands.set` の 3 か所（`store.ts:438`、`1223`、`1231`）を読んだ。登録は確定の経路と読み込みの経路だけで、拒否の経路には無い。実行はしていない。
- 扱い: 未対応

### 2026-11-19 再送の判定は map ごとで、通し番号は workspace で一本

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 5.2 節・5.3 節、`beta/src/node/record_store/store.ts:272`（`commandKey(mapId, commandId)`）
- 中身: Command の ID は map ごとに一意とみなされる。一方、通し番号は workspace で一本で、node を別の map へ移すことも想定している。複数の map に触る Command がどの map の ID として登録されるか、同じ ID が別の map で使われたときに別の Command とみなしてよいか、が決まっていない。再送の判定のキーを workspace 単位にし、触った map は Command の中に集合として持つことを提案する。
- 根拠: `store.ts:272`、`617` を読んだ。仕様書 5.3 節は単位を書いていない。
- 扱い: 未対応

### 2026-11-19 兄弟順キーが同じ値の兄弟の間には、node を入れられない

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 3.4 節（兄弟順キー `ord`）、4 節
- 中身: 不変条件は、同じ親の下で兄弟順キーが一意であることを求めていない（並びは、キーと `connectionId` の組で決まる）。キー k の兄弟 a と b の間へ x を入れたいとき、x のキーだけを変えても入らない（k より小さければ a の前、k 以上なら b の後になる）。「他の兄弟のキーを変えずに、どこへでも入れられる」という前提が成り立たない。案は二つある。確定した状態でキーを一意にする（必要なら振り直しを同じ Command に含める）。または、その位置の指定を拒否する。
- 根拠: 仕様書 3.4 節と 4 節の文から導いた。実データに同じ値のキーがあるかは未確認。
- 扱い: 仕様へ反映（DB 仕様書 3.4 節と 4 節の不変条件 9。同じ親の下で `ord` は一意で、等しい key の間への挿入は振り直しを同じ Command に含める。実データの重複は 0 件で、この例外は防御のためだけに残る）。base62 の key への実装は、操作の代数の session が進めている

### 2026-11-19 relation edge の重複を禁じる不変条件が無い

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 4 節
- 中身: 操作の設計では「同じ端点・同じ relationType の relation edge は、link で作らない」としている。しかし不変条件には入っていないので、端点の付け替え（relink）や relationType の書き換えで重複を作れる。重複の禁止を不変条件にするか、link の便宜の挙動にとどめるかを決める必要がある。
- 根拠: 仕様書 4 節の一覧を読んだ。実装の検査は未確認。
- 扱い: akaghef の判断待ち

### 2026-11-19 scope をまたぐ付け替えでは、子孫側の parent edge の scope も書き換える必要があるが、誰が作るか決まっていない

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 4 節の 6 番
- 中身: node a を scope S から別の scope T の node の下へ移し、a の子への parent edge が S のままだと、不変条件 6 を破る（a は S の root ではなく、a に入る parent edge の scope は T）。付け替えの Command は、同じ面に載る子孫側の parent edge の scope も、次の scope の境界まで T へ書き換えて含める必要がある。この書き換えを出す側が作るのか、確定する側が補うのかが決まっていない。scopen・unscopen の逆も、実際に書き換えた parent edge の集合と元の scope を持つ必要がある。
- 根拠: 仕様書 4 節の 6 番の文から導いた。実装の挙動（拒否になるか）は未確認。
- 扱い: 未対応

### 2026-11-19 journal の 1 行が、送られた変更と変更後のレコードの両方を持っている

- 種類: 気づき
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:131`（`changes`）と `:137`（`ops`）
- 中身: journal の 1 行は、送られた変更（変更前と変更後の値）と、レコードへの操作（変更後のレコード全体）の両方を書いている。中身がほぼ二重で、1 行の大きさが増える。変更の側だけを残し、レコードへの操作は確定の処理を再生して作り直す形にすれば、およそ半分になる。ただし、再生が決定的であることを確かめる試験が前提になる。
- 根拠: `JournalLine` の型と、確定の処理で両方を書いている箇所を読んだ。実データでの 1 行の大きさは測っていない（未確認）。
- 扱い: 未対応（畳み込みの契機と、古い journal の保管期間と合わせて決める）

### 2026-11-19 確定のたびに map 全体の不変条件を検査している

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 4 節、`beta/src/node/record_store/store.ts:1114`
- 中身: 仕様は「検査は触った周辺だけで行い、map 全体は走査しない」とする。実装は確定のたびに、その map の全レコードで不変条件を検査している。今の規模（最大の map で約 2 万 node）では動くが、費用が map の大きさに比例するので、100 万 node の map では確定が遅くなる。
- 根拠: 確定の処理が `checkInvariants` に map の全レコードを渡している箇所を読んだ。時間は測っていない（未確認）。
- 扱い: 仕様へ反映（DB 仕様書 4 節に、実装との差を書いた）。実装は未対応

### 2026-11-19 parent edge のレコードに、relationType と attribute の欄が無い

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）、物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.4 節、`beta/src/shared/record_model/types.ts`（`EdgeConnectionRecord`）、snapshot-format 2 節
- 中身: 仕様では parent edge も relationType と attribute を持つ。実装の parent edge のレコードには、どちらの欄も無い。今の移行では parent edge の relationType を設定しないので問題は出ていないが、parent edge に役割（たとえば `rdfs:subClassOf`）を付ける操作を作るときに欄が要る。極性（parent edge の「保つ / 反転する」）を attribute に置く案も、この欄を前提にしている。
- 根拠: 型定義と snapshot-format の表を読んで比べた。
- 扱い: 仕様へ反映（DB 仕様書 3.4 節に、実装との差を書いた）。実装は未対応

### 2026-11-19 確定の発行者を、まだ端末の申告で決めている

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 5.1 節、record-schema 10 節
- 中身: 仕様では、発行者はサーバが認証済みの接続から決め、画面や AI agent の自己申告は使わない。実装は、Command と一緒に送られた申告をそのまま確定の表に書いている。アカウントと認証の仕組みができるまで、確定の表の発行者は検証されていない値である。
- 根拠: record-schema の監査の記録と、確定の処理を読んだ。
- 扱い: 仕様へ反映（DB 仕様書 5.1 節に、実装との差を書いた）。実装は未対応（アカウントの仕組みが前提）

### 2026-11-19 journal が端末ごとではなく、workspace ごとに一つになっている

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 2 節、ADR 014 の Decision 1
- 中身: ADR 014 では、journal は workspace × 書き手の端末ごとの追記専用の列で、書くのはその端末だけとする。実装は workspace ごとに journal が一つで、一つのサーバだけが書く。端末をまたぐ同期（Mac mini での集約、他の端末の journal の取り込み）を作るときに、ファイルの単位と通し番号の振り方を変える必要がある。
- 根拠: `beta/src/node/record_store/store.ts` の冒頭の説明と、ファイルの置き方を読んだ。
- 扱い: 仕様へ反映（DB 仕様書 2 節を、2026-11-18 の akaghef の決定に合わせた。確定済みの journal は remote 上で workspace ごとに一本であり、今の実装はこれに合っている。欠けているのは local outbox である）。local outbox の実装は未対応

### 2026-11-19 圧縮すると、どの確定がどの node に触れたかが失われ、書かれる頻度を作り直せない

- 種類: 問題
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:121`（`JournalLine`）、`store.ts:752`（`compact()`）
- 中身: 圧縮は journal を空にし、`commit-index.json` には map ごとの最後の確定と、確定済みの Command の ID（直近 100,000 件）だけを残す。確定ごとに差分が出たレコードの一覧は残らないので、圧縮より前の書かれる頻度（DB 仕様書 9 節の提案）は作り直せない。記録を始める前の確定は、後から分類できない。akaghef は 2026-11-19 に次の方向を示した。保存期限と復元期限を分ける。journal も出来事の記録も消さず、古い journal は保管へ移す。再生を保証するのは、最後のスキーマ変更の直後に書く snapshot から後だけにする。版は journal の各行に持たせず、切り替えの時点だけを記録する（snapshot の頭の `format` と `seq` で足りる）。出来事の記録は、通し番号・時刻・触れたレコードの ID・出来事の種類だけの、スキーマに依らない形にし、再生できない区間でも数えられるようにする。
- 根拠: DB 仕様書 6 節の圧縮の記述と、`JournalLine` と `SnapshotHeader`（`beta/src/shared/record_model/types.ts:10`）の型を読んだ。
- 扱い: 仕様へ反映（freeze v1。DB 仕様書 6 節の envelope の `touched`、archive の 90 日での削除、9 節の減衰する量の累積を snapshot に持つこと）。実装は未対応

### 2026-11-19 名前の接頭辞の規則は MCP でしか検査しておらず、アプリの中から接頭辞の無い名前が書かれている

- 種類: 問題
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.8 節、`beta/src/node/layout_capture.ts:50`
- 中身: 新しい attribute 名と relationType に接頭辞を求める検査は、MCP の入口（`beta/src/node/mcp_service.ts`）にしか無い。`layout_capture.ts` は relationType `reference` を接頭辞なしで書く。viewer など他の書き手も検査を通らない。
- 根拠: `git grep '"reference"'` で書き手を探した。他の書き手は網羅していない。
- 扱い: 未対応（既存の名前の対応規則と、確定の側で検査するかを決めてから直す）

### 2026-11-19 attribute の値には型の取り決めが無く、整数と小数を区別できない

- 種類: 気づき
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.3 節、10 節、`beta/src/shared/record_model/types.ts`（`JsonValue`）
- 中身: attribute の値は任意の JSON 値で、JSON には整数と小数の区別が無い。拡張の欄（task の status、目標の更新間隔など）の型は、保存の形ではなく、拡張の定義に欄の型を書かせて確定のときに検査するしかない。時刻は今 `committedAt` が文字列で持っている。型の語彙（文字列・整数・小数・真偽・列挙・時刻・期間・node の参照・列）と、時刻・期間の表し方は未決。
- 根拠: `JsonValue`、`NodeRecord`、`JournalLine` の型を読んだ。
- 扱い: 仕様へ反映（freeze v1。DB 仕様書 3.3 節と 10.7 節の型の語彙。拡張の欄だけを確定時に検査する）。実装は未対応

### 2026-11-19 同期の要件に、確定の保証範囲と復旧の対象が決まっていない

- 種類: 問題
- 書いた agent: 同期の思想と要件の session
- 対象: [sync-principles](sync-principles.md) 全体、DB 仕様書 6 節・8.3 節
- 中身: 同期の要件を GPT-6 Pro と詰めた第 1 往復で、次の穴が出た。いずれも決めないと実装者が勝手に決めてしまい、後から変えにくい。
  - remote が確定して fsync した直後に保存媒体が壊れ、どの local もまだ pull していなければ、その確定は local を集めても戻らない。媒体 1 つの喪失で確定を失ってよいかが決まっていない。
  - 複製の単位が scope なので、どの local も持たない scope がありうる。local を集めた remote の作り直しが完全かどうかを検査する規則が無い。
  - push の一部を確定した後で abort の条件（世代・履歴 ID・hash 鎖の不一致）が分かると、確定済みの分は取り消せない。abort の条件は確定を始める前に検査し終える必要がある。
  - 削除と、削除した側が見ていなかった子の追加・移動の競合、scope をまたぐ移動で所属・共有範囲・保持の方針が変わるか、権限を外した後の offline clone、conflict を誰が解けるか、Rapid から Deep への昇格が同じ ID の移動か新しい ID の複製か、が決まっていない。
- 根拠: GPT-6 Pro の回答（第 1 往復）を読んだ。実装との照合はしていない（未確認）。
- 扱い: 仕様へ反映（[同期の要件](sync-requirements.md) と [sync-principles](sync-principles.md)）。2026-11-19 に akaghef が問いに答えた。媒体の喪失は許して復旧地点を示す（暫定）、削除は見ていた集合を基準に競合、scope をまたぐ移動は当面実装しない、競合は権限のある編集者が解く、ロックを付ける。Rapid と Deep の違い・昇格、入れ子の scope の権限は追加の協議として保留。未決の事項は同書の K1〜K15

### 2026-11-19 復旧の経路で戻すべき状態と、適用待ちの確定の扱いが仕様に無い

- 種類: 問題
- 書いた agent: 同期の思想と要件の session
- 対象: DB 仕様書 6 節・8.3 節、`beta/src/node/neo4j_store/apply.ts:192`（`appliedSeq` の書き込み）
- 中身: 復旧の正本が snapshot と journal なら、グラフの中身だけでなく、権限、未解決の conflict、Command の結果（重複排除の記録）、世代、端末の失効も、そこから戻せなければならない。Neo4j にだけ置いた状態は、指定された復旧の経路で失われる。また、journal に fsync した後、Neo4j に適用する前に止まった確定は、適用の失敗を理由に未確定へ戻せない。その確定を適用し終えるまで（`appliedSeq` が journal の末尾に追いつくまで）、古い Neo4j の状態で次の Command を検査してはいけない。どちらも今の DB 仕様書には書かれていない。
- 根拠: GPT-6 Pro の回答（第 1 往復）の指摘を、DB 仕様書 8.3 節の「反映した位置は `appliedSeq` に持つ」と照らした。確定の処理が、検査の前に `appliedSeq` の遅れを解消しているかどうかは確かめていない（未確認）。
- 扱い: 未対応

### 2026-11-19 journal の畳み込みがどこからも呼ばれていない

- 種類: 問題
- 書いた agent: Neo4j 化の本線の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:752`（`compact()`）
- 中身: 正本は「ある時点の snapshot と、それより後の journal」で、journal は定期的に snapshot へ畳み込む前提である。畳み込みの処理 `compact()` は実装されているが、試験の外からは呼ばれていない。今のままでは journal が増え続け、起動時の再生も長くなる。いつ畳むか（件数、大きさ、時刻、起動時）が仕様で決まっていない。
- 根拠: `git grep` で `compact()` の呼び出しを探し、`beta/src` の試験以外に無いことを確かめた。
- 扱い: 仕様へ反映（freeze v1。契機は replay の長さ。DB 仕様書 6 節）。実装で解消（journal の行数を契機に畳み込み、journal は archive へ移す。上の「journal の畳み込みを、archive への移動と 90 日後の検証つき削除として実装した」）

### 2026-11-18 何を正本とするかの記述が、二つの文書で食い違っている

- 種類: 問題
- 書いた agent: Neo4j 化の本線の session
- 対象: DB 仕様書 1 節、[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)、[sync-principles](sync-principles.md)（dev-beta に統合済み。2026-11-19 に同期の思想の session が確かめた）
- 中身: DB 仕様書と ADR 014 は「正本は journal と snapshot、Neo4j は端末ごとの導出物で、同期も backup もしない」とする。今の実装もこの形である。一方 `sync-principles.md` は「Neo4j は正本エンジンで、他の何かの写しではない」とする。どちらも 2026-11-16 の akaghef の決定（brief の「正本エンジンは Neo4j」）を根拠にしており、「正本エンジン」の読み方が分かれている。このままでは同期・復旧・backup の設計が二通りになる。
- 根拠: 両方の文書の該当行を読んで比べた。
- 扱い: 仕様へ反映（freeze v1。Neo4j は各端末の正本エンジンで semantic authority、journal と snapshot は durability authority。DB 仕様書 0・1 節と ADR 014 を改めた）

### 2026-11-18 一部の attribute だけを読んだ状態からの保存は、読んでいない attribute を消さない。ただし 2 つの操作が衝突として拒否される

- 種類: 問題
- 書いた agent: 描画バグの session（表示の速さの作業）
- 対象: DB 仕様書 3.3 節、5 節、`beta/src/shared/map_changes.ts`（`diffAttributes`、`applyChanges`）、`beta/src/browser/scope_view_client.ts`（`save`）
- 中身: 当初は「attribute はまとめて 1 つの値として書かれるので、一部だけ読んで保存すると読んでいない attribute が消える」と報告したが、これは誤りだった。scope だけを読む経路の保存は、読んだ時点の状態と今の状態の差を attribute 1 項目ずつの変更として送る。読んでいない attribute は差に現れないので、保存しても残る。残る問題は次の 2 つで、どちらもデータは消えず、保存が衝突として拒否される。(1) 読んでいない attribute と同じ名前の attribute を書くと、作成として送られ、すでに値があるので拒否される。(2) 読んでいない attribute を持つ node を消すと、その attribute を消す変更が送られないので拒否される。描画に要る項目だけを読む形にするなら、この 2 つの扱い（読んでいない attribute の有無を読み手に伝える、node の削除は attribute ごと消す、など）を仕様で決める必要がある。map 全体を 1 つの値として保存する経路は、scope だけを読む経路では使えないようにしてあるが、この経路に一部だけ読んだ状態を渡せば消える。
- 根拠: 2026-11-19 に `diffState` と `applyChanges` を直接呼んで確かめた。サーバー側の node が attribute を 2 つ持ち、読み手がその 1 つを持たない状態で、本文と残りの attribute を変えて適用すると、読んでいない attribute は残った。同じ形で、読んでいない名前の attribute を書いた場合と、node を消した場合は、どちらも `ok: false` でその attribute の衝突が返った。保存の経路は `scope_view_client.ts` の `save` を読み、差を送ることと、map 全体の保存を拒否することを確かめた。
- 扱い: 仕様へ反映（DB 仕様書 5.4 節に【仮決め】として書いた。同じ key の作成は CONFLICT のままにし、projection の応答で省いた key の名前を返す。node の削除は record 単位の tombstone にし、前提は `rev` だけにする）。実装は未対応

### 2026-11-18 scope の読み出しの大半が、描画に使わない attribute だった

- 種類: 気づき
- 書いた agent: 描画バグの session（表示の速さの作業）
- 対象: DB 仕様書 9 節、10 節
- 中身: scope だけを読む経路で、応答（約 2.1 MB）のほぼ全部が描画に使わない attribute だった。描画に要る項目は node の種別によって違う（たとえば `source-mermaid` を描画に使う種別がある）。そこで、描画に要る項目は node type の定義が宣言する、という要件が出ている。拡張の仕組み（10 節）の定義に、この宣言を持たせる案がある。
- 根拠: その session の計測による。
- 扱い: 仕様へ反映（DB 仕様書 10.6 節に【提案】として、拡張の定義が持つ描画の宣言と、それを使う projection を書いた）。実装は未対応
