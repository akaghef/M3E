# ADR 014: Neo4j による永続と journal による端末間の交換

## Status

Accepted（2026-11-19 改訂: freeze v1）

2026-11-19 に akaghef が freeze v1 の決定（on-disk format 2）を確定し、本 ADR の Decision 1・2・4・5 をそれに合わせて改めた。改訂の中身は [DB 仕様書](../03_Spec/Database_Spec.md) の 1・2・6 節にある。

2026-11-16 の akaghef の決定（[rapid-persistence-redesign の brief](../../.kiro/specs/rapid-persistence-redesign/brief.md) の「決定済み」と「物理配置の原則」）を ADR として定式化する。承認されたら、ADR 004 と ADR 008 の該当箇所に supersede の注記を入れる。

## Date

2026-11-16

## Context

- 研究 map が 20,150 node に達し、map 全体の JSON を置換する保存が通らなくなった（受信上限超過）。1 回の編集の費用が map の総 node 数に比例する方式は、規模とともに必ず悪化する。
- 2026-08 以降 Neo4j 化が繰り返し提案されたが採用されず、全体 JSON 方式が残った。遅さの主因は database ではなく書込みアルゴリズムだったことが、同一 Command 列の比較計測で確認された（brief の計測記録）。
- Mac と Windows の `data.sqlite` を Syncthing で丸ごと同期する運用は、同期停止とデータ分岐を招いた。1 ファイルに全端末の書込みが混ざる形は、同期機構に解けない競合を作る。
- ADR 004 は「論理正本は JSON document、SQLite は local persistence」とし、ADR 008 は Neo4j の正本化を activation gate の内側に限定していた。本決定はその両方を更新する。

## Decision

### 1. 永続・検査・問い合わせは Neo4j

- durability authority（永続する現在状態）と semantic authority（invariant の検査と query）は、各端末と remote の Neo4j である。map の表示も Neo4j の問い合わせから出す。
- journal は端末と remote の間で確定した変更を確定順に push / pull するための記録で、Neo4j の `Commit` node に置く。状態の保存先にはしない。
- snapshot は、ある `seq` の時点の状態という役割であり、Neo4j の状態である。別の snapshot ファイルや JSON の database は置かない。JSON は push / pull / clone の wire format と export に用いる。record のファイルは一度きりの移行入力、export、clone payload に限る。
- 端末の Neo4j は remote から clone して復旧し、remote の Neo4j は database 全体の定期 export で保全する。

### 2. Rapid の database は Neo4j

- 各端末と remote に Neo4j を置く。SQLite は並走する database ではなく export format の一つになる。
- Final を製品として配布する場合の同梱方式（JVM 同梱、組込み系への切替、export された SQLite を読む閲覧専用 mode）は製品化時に別途決定する。

### 3. 書込みは Command のみ

- すべての書き手は Command（intent・対象・base revision・commandId・provenance）→ Neo4j の状態で検証 → 1 回の Neo4j の write transaction で record・`Commit`・`Head.seq` を確定する経路を通る。map 全体を置換する経路は移行後に残さない。
- 冪等性の鍵は commandId に置く。

### 4. workspace ごとの single-leader

- remote は workspace ごとにちょうど一つあり、その sequencer が `seq` を振って確定の全順序を付ける（[sync-principles](../../.kiro/specs/rapid-persistence-redesign/sync-principles.md)、2026-11-18）。remote の置き場所は選べ、特定の端末に固定しない。
- local の commit は確定ではない。端末は未確定の Command を outbox に積み、local には楽観適用する。再接続したら remote で検証する。leader の移譲は明示操作のみとし、自動 failover は作らない。

### 5. 配置

- server・database・viewer は同じ端末に同居させ、編集の確定 loop に network を挟まない。遠い server への接続は閲覧に限る。
- 常時稼働の端末（Mac mini など）は remote の置き場所の候補である。
- server を立てられない端末（iPad など）は mini の server に接続する閲覧専用 client とする。
- stream の輸送は、remote の server への HTTP の push / pull の一本で行う（[sync-principles](../../.kiro/specs/rapid-persistence-redesign/sync-principles.md)「remote と local」）。push は outbox の Command を送り、`commandId` ごとの結果（確定・no-op・拒否・競合）を受け取る。pull は指定した `seq` より後の journal（log suffix）を受け取る。保持期間より遅れた端末は snapshot から clone し直す。
- Syncthing と `data.sqlite` 丸ごとの同期は廃止する。Syncthing は ack も拒否も返さず、ファイルを丸ごと渡すので、確定の応答、Decision 6 の提供側での ACL、remote を作り直したときの世代の fencing のどれも成り立たない。
- remote には、編集する各端末から LAN か VPN で届く必要がある。届く経路と認証の方式は、remote を置くときに決める。

### 6. access control は scope、複製は workspace

- 権限の判定単位は scope、複製の単位は workspace。stream は workspace 粒度で運び、提供側の server が読み出し時に scope の ACL を適用する（認可は保存層でなく提供層）。

### 7. ID は全体一意

- node・map・relation edge の ID は map と workspace をまたいで一意とする。既存の重複 ID は一度きりの data migration で振り直す。

## Consequences

### Positive

- 1 回の編集の費用が変更の大きさに比例し、map の規模に比例しない。
- 端末の Neo4j の破損から remote の clone で復旧でき、remote は定期 export で保全できる。
- 同期は、remote の一本の journal と端末の outbox の間の送受信になり、ファイル競合が構造上起きない。
- offline 編集・複数 PC・閲覧専用端末が同じ仕組みの上に載る。

### Negative

- Neo4j の常駐（JVM）が各編集端末に要る。製品配布の形は未決のまま残る。
- remote の定期 export・journal の保持・古い版の締め出しなど、運用部品が要る。
- 一度きりの data migration（workspace ごと 1 回）に先立ち、分岐した系列の統合と ID の振り直しが要る。

## Supersedes / Amends

- ADR 004 の「論理正本は JSON document」「SQLite を local persistence とする」を supersede する（`.mm` などの互換 format の扱いは変えない）。
- ADR 008 Decision 3（Neo4j の role を owner concern で分ける）と Decision 6（SQLite 判断の局所化）を、本 ADR の Decision 1・2 で更新する。federation の原則（canonical owner は concern ごとに一意、write は owner へ route、graph exposure の gate）は維持する。
- ADR 008 Constraints の「Scope を storage / Authority boundary と同一化しない」を「Scope は access control の判定単位とするが、storage と複製の boundary にはしない」に改める。

## References

- [rapid-persistence-redesign brief](../../.kiro/specs/rapid-persistence-redesign/brief.md)
- [Command_Language.md](../03_Spec/Command_Language.md)
- [ADR 004](./ADR_004_SQLite_For_Rapid_MVP.md) / [ADR 008](./ADR_008_Federated_Canonical_Sources.md)
