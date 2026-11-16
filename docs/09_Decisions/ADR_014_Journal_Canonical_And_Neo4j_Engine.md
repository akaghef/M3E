# ADR 014: Journal Canonical Sources and Neo4j Engine for Rapid

## Status

Proposed

2026-11-16 の akaghef の決定（[rapid-persistence-redesign の brief](../../.kiro/specs/rapid-persistence-redesign/brief.md) の「決定済み」と「物理配置の原則」）を ADR として定式化する。承認されたら、ADR 004 と ADR 008 の該当箇所に supersede の注記を入れる。

## Date

2026-11-16

## Context

- 研究 map が 20,150 node に達し、map 全体の JSON を置換する保存が通らなくなった（受信上限超過）。1 回の編集の費用が map の総 node 数に比例する方式は、規模とともに必ず悪化する。
- 2026-08 以降 Neo4j 化が繰り返し提案されたが採用されず、全体 JSON 方式が残った。遅さの主因は物理エンジンではなく書込みアルゴリズムだったことが、同一 Command 列の比較計測で確認された（brief の計測記録）。
- Mac と Windows の `data.sqlite` を Syncthing で丸ごと同期する運用は、同期停止とデータ分岐を招いた。1 ファイルに全端末の書込みが混ざる形は、同期機構に解けない競合を作る。
- ADR 004 は「論理正本は JSON document、SQLite は local persistence」とし、ADR 008 は Neo4j の正本化を activation gate の内側に限定していた。本決定はその両方を更新する。

## Decision

### 1. 正本は journal と portable snapshot

- 操作の正本は Command の列を記録した journal。workspace × 書き手端末ごとの append-only stream とし、書くのはその端末自身だけにする。復旧の正本は engine 非依存の portable snapshot ＋ journal replay（ADR 008 Recovery Gate と同一基準）。
- engine store（SQLite file、Neo4j store）は journal から再生できる導出物であり、端末 local に置き、同期せず、backup の対象にしない。

### 2. Rapid の正本エンジンは Neo4j を到達形とする

- 全面の書き換えを到達形とし、SQLite は正本の並走先ではなく export format の一つになる。
- Final を製品として配布する場合の同梱方式（JVM 同梱、組込み系への切替、export された SQLite を読む閲覧専用 mode）は製品化時に別途決定する。

### 3. 書込みは Command のみ

- すべての書き手は Command（intent・対象・base revision・commandId・provenance）→ 検証 → 1 transaction 確定の経路を通る。map 全体を置換する経路は移行後に残さない。
- 冪等性の鍵は commandId に置く。

### 4. workspace ごとの単一 writer

- 一貫性は workspace ごとに確定者（writer）を一つに固定して得る。個人 workspace の確定者は Mac、team workspace は Beta の server process。
- 他端末は Command を確定者へ送り、local には楽観適用する。offline 中の Command は local に保持し、再接続時に確定者で検証する。writer の移譲は明示操作のみとし、自動 failover は作らない。

### 5. 配置

- server・engine・viewer は同じ端末に同居させ、編集の確定 loop に network を挟まない。遠い server への接続は閲覧に限る。
- Mac mini は常時稼働の集約点（全 stream の mirror、portable snapshot の置き場、store-and-forward、workspace 横断の materialization）。
- server を立てられない端末（iPad など）は mini の server に接続する閲覧専用 client とする。
- stream の輸送は Syncthing で行う。`data.sqlite` 丸ごとの同期は廃止する。

### 6. access control は scope、複製は workspace

- 権限の判定単位は scope、複製の単位は workspace。stream は workspace 粒度で運び、提供側の server が読み出し時に scope の ACL を適用する（認可は保存層でなく提供層）。

### 7. ID は全体一意

- node・map・GraphLink の ID は map と workspace をまたいで一意とする。既存の重複 ID は一度きりの data migration で振り直す。

## Consequences

### Positive

- 1 回の編集の費用が変更の大きさに比例し、map の規模に比例しない。
- エンジンの切替・追加・破損が migration でなく replay で済む。
- 同期は append-only stream の mirror になり、ファイル競合が構造上起きない。
- offline 編集・複数 PC・閲覧専用端末が同じ仕組みの上に載る。

### Negative

- Neo4j の常駐（JVM）が各編集端末に要る。製品配布の形は未決のまま残る。
- journal の圧縮・snapshot 頻度・古い版の締め出しなど、運用部品が新たに要る。
- 一度きりの data migration（workspace ごと 1 回）に先立ち、分岐した系列の統合と ID の振り直しが要る。

## Supersedes / Amends

- ADR 004 の「論理正本は JSON document」「SQLite を local persistence とする」を supersede する（`.mm` などの互換 format の扱いは変えない）。
- ADR 008 Decision 3（Neo4j の role を owner concern で分ける）と Decision 6（SQLite 判断の局所化）を、本 ADR の Decision 1・2 で更新する。federation の原則（canonical owner は concern ごとに一意、write は owner へ route、graph exposure の gate）は維持する。
- ADR 008 Constraints の「Scope を storage / Authority boundary と同一化しない」を「Scope は access control の判定単位とするが、storage と複製の boundary にはしない」に改める。

## References

- [rapid-persistence-redesign brief](../../.kiro/specs/rapid-persistence-redesign/brief.md)
- [Command_Language.md](../03_Spec/Command_Language.md)
- [ADR 004](./ADR_004_SQLite_For_Rapid_MVP.md) / [ADR 008](./ADR_008_Federated_Canonical_Sources.md)
