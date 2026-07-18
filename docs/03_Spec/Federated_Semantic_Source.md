# Federated Semantic Source

最終更新: 2026-07-19

Status: Phase 1 portable specimen 実装済み（Neo4j 未着手）

Strategy: `S16`

## 1. 目的

この仕様は、Git repository、Obsidian vault、M3E local data、外部 provider がそれぞれ正本を持つ状態で、M3E が identity・typed relation・scope・authority・validation を一つの意味ネットワークとして扱うための最小契約を定義する。

ここで固定するのは **正本の割当と読み書きの意味**である。Neo4j の schema、repository-local source の serialization、deployment、edition は固定しない。Neo4j の record は owner concern により `source-materialized` または `M3E-owned accepted` の役割を持ち、database 単位で一律に正本性を決めない。

## 2. 適用範囲

対象:

- M3E-native Rapid document
- Git-backed source
- Obsidian-backed source
- M3E-local source
- external-provider-backed source
- cross-source relation assertion
- AI / bot の proposal と pending assertion
- 大域 graph への materialization

非対象:

- Neo4j server の構築
- Cypher schema
- `.m3e/` という配置名の確定
- source 固有の本文 format
- すべての Rapid node の Deep entity 化
- Neo4j の primary runtime 昇格

## 3. 正規概念

### 3.1 canonical source

durable concern の確定状態を所有する source。物理 storage 製品ではなく、履歴・revision・write route・復元責任を持つ論理単位を指す。

例:

- Git-backed source: repository の code、document、repository-owned semantic assertion
- Obsidian-backed source: Live Mode の Markdown 本文と native reference
- M3E-local source: Rapid document、map-local relation、operation state
- external-provider-backed source: provider が所有する task、event、workflow state

### 3.2 canonical owner

ある entity、assertion、または durable concern の確定権を持つ canonical source。owner は同じ concern について一つだけである。

### 3.3 write authority

canonical owner へ確定変更を適用する権限と route。UI 上の編集可能性や alias の表示権限とは別概念である。

### 3.4 materialization

canonical source から再生成できる read model。Neo4j materialization、search index、cache、context bundle、逆方向 relation を含む。materialization は canonical owner にならない。Deep → Rapid の `射影 (projection)` とは別概念である。

### 3.5 Rapid occurrence / Deep entity

- **Rapid occurrence**: 文書内の位置、表現、順序、局所文脈を持つ node occurrence。
- **Deep entity**: 文書横断の stable identity と typed semantics を持つ entity。
- **entity binding**: occurrence と entity を結ぶ relation。一対一を仮定しない。`scope bind` とは別概念である。

Rapid occurrence と Deep entity は同じ本文を二重所有しない。occurrence は局所表現を所有し、entity は大域 identity を所有する。

### 3.6 Neo4j record role

- **source-materialized**: Git、Obsidian、provider、Rapid local source が所有する record の再構築可能な copy。
- **M3E-owned accepted**: M3E が owner であり、proposal / validation / approval を通過した Deep entity または assertion。activation gate 通過後は Neo4j を canonical runtime にできる。

同じ database に両 role を置く場合も、`ownerSourceId`、role、owner revision、provenance を query result と write validation で区別する。role 未判定 record は canonical write 対象にしない。

## 4. Source descriptor 契約

各 source は registry から最低限次を解決できなければならない。物理 serialization は未確定でよい。

| 項目 | 必須 | 意味 |
|---|---:|---|
| `sourceId` | yes | path、display name、mount point から独立した stable ID |
| `sourceKind` | yes | Git-backed / Obsidian-backed / M3E-local / provider-backed の adapter 種別 |
| `schemaVersion` | yes | source package の読解 version |
| `currentRevision` | yes | Git commit、provider revision、M3E revision など source 固有の revision |
| `readRoute` | yes | source を現在取得する adapter route |
| `writeRoute` | yes | owner へ Command を届ける route。read-only source は明示的に拒否 route を持つ |
| `classificationPolicy` | yes | materialization を include / redact / exclude のいずれにするか判断する policy reference |
| `capabilities` | yes | read、proposal、direct write、history、transaction 等の実能力 |
| `lastIndexedRevision` | no | materialization が最後に受理した revision |

`sourceId` から実際の path や credential を直接推測しない。secret、token、private absolute path を repository-local package や Neo4j property へ複製しない。

## 5. Identity 契約

大域 entity identity は少なくとも `SourceId + LocalEntityId` の組で一意に解決する。URI 文字列表現は Phase 0 の別判断とし、この仕様では固定しない。

必須条件:

1. repository rename、file move、display label 変更で identity を失わない。
2. materialized record は source、revision、content hash、schema version、indexed time を追跡できる。
3. entity の canonical owner は一つである。
4. 他 source は同じ entity 本文を複製せず、identity または binding で参照する。
5. entity merge は既存 ID の全書換えを前提にせず、redirect / tombstone で追跡可能にする。

## 6. Assertion ownership

relation assertion 自体にも canonical owner を一つ決める。

| Assertion | 既定 owner |
|---|---|
| source A の entity が source B に依存する | source A |
| B が A から参照される逆方向 relation | materialization で導出し、canonical 保存しない |
| repository 群を束ねる architecture contract | contract を所有する governance source |
| AI / bot が推定した relation | M3E-local proposal journal。承認前は確定 source へ入れない |
| 承認済みで M3E が所有する Deep relation | M3E Semantic Source。activation 後は Neo4j canonical runtime record にできる |

同じ assertion を両 endpoint source が独立に canonical 保存してはならない。双方の合意が必要でも、合意結果を所有する contract source を一つ決める。

## 7. Proposal journal

AI / bot の proposal、pending assertion、approval state、棄却理由は、一つの論理的な **M3E-local proposal journal** を canonical source とする。実装上の table / file / event log は未確定でも、次を満たす。

- append または revision 追跡可能である。
- Neo4j 全削除後も判断待ち queue を復元できる。
- proposal と accepted assertion の provenance を連結できる。
- source classification を保持する。
- proposal の consumer は canonical source を直接更新しない。

Neo4j 上の proposal subgraph は proposal journal の materialized read model である。

## 8. Scope と authority

Scope は認知・表示・編集境界であり、canonical source や storage boundary ではない。

authority resolution は次を満たす。

1. 通常の scope move は owner を変更しない。
2. authority marker がある場合、子孫は最近傍の authority root から owner と write route を継承できる。
3. nested authority root は明示された場合だけ継承を上書きする。
4. alias 自体の配置 owner と target entity の owner を別に解決する。
5. GraphLink assertion の owner と両 endpoint の owner を別に解決する。
6. authority を跨ぐ reparent Command は通常 move として受理せず、`ownership-transfer-required` として拒否する。

仕様語は `authority root` とする。authority marker の物理 field 名と serialization は未確定とする。

## 9. Command envelope

M3E から canonical source へ確定変更を要求する Command は、最低限次の意味を持つ。

| 項目 | 意味 |
|---|---|
| `commandId` | retry と audit を一意に識別する ID |
| `actor` | human、agent、bot、system とその識別情報 |
| `targetRef` | source と local entity / assertion を解決できる参照 |
| `intent` | rename、reparent、assert、delete、transfer 等の要求 |
| `baseRevision` | caller が読んだ owner revision |
| `provenance` | proposal、source event、upstream command との因果参照 |
| `approvalState` | proposal / approved / rejected の状態 |

必須挙動:

- `baseRevision` が owner の current revision と一致しない write は silent overwrite せず conflict とする。
- 同じ provenance と同じ semantic result を持つ bot echo は二重適用しない。
- owner adapter が未接続、read-only、権限不足の場合は proposal を失わず保留する。
- source の native editor で行われた変更は M3E Command を通らなくてよい。indexer が新 revision として受け取り、既存 proposal と競合評価する。

## 10. Ownership transfer

cross-authority reparent は二つの source revision 系にまたがるため、通常 move ではない。最小状態機械は次とする。

```text
requested
→ source-pending
→ destination-accepted
→ source-redirected
→ completed
```

各中間状態は保存・再開・補償可能でなければならない。

- stable identity を維持する。
- source と destination の両 revision を記録する。
- destination 追加前に source を削除しない。
- destination 確定後、source は tombstone / redirect を残す。
- 失敗時に `source-pending` または `destination-accepted` から再開できる。
- journal が両側 commit の因果を連結する。

transaction API、timeout、compensation の具体値は Architecture / adapter spec で決める。

## 11. Global graph snapshot

大域 graph は、各 source の最後に受理された revision、owner が明示された cross-source assertion、M3E-owned accepted graph の合成である。

```text
GlobalGraphSnapshot
= accepted local graph at revision per source
+ owned cross-source assertions
+ M3E-owned accepted entities / assertions
+ derived reverse/index relations
```

query result は最低限、参照した source revision 集合または snapshot ID と indexed time を返せる。

referential state:

- `resolved`: source と entity を現在読める
- `indexed-only`: materialized read model はあるが source は手元にない
- `inaccessible`: source は存在するが権限がない
- `stale`: materialized read model の revision が source より古い
- `missing`: source または entity を現在解決できず、削除確認もない
- `tombstoned`: owner が削除または redirect を確定している
- `unresolved`: identity はあるが未解決

### 11.1 read-only query surface

大域 query surface は openCypher / ISO GQL 語彙の **read-only 部分集合**として定義し、M3E 独自 query 言語を作らない。少なくとも `CREATE`、`MERGE`、`SET`、`DELETE` を query surface で禁止する。変更要求は query text として実行せず、必ず graph operation から Semantic Command へ正規化し、owner routing を通す。

Cypher の `RETURN` 句で列や式を選ぶ操作は query 文脈で projection と呼ばれるが、M3E の `射影（Deep → Rapid）` および `materialization（再生成可能な read model）` とは別概念である。文書では原則として `query projection` と修飾する。

## 12. Materialization exposure policy

source adapter は record を Neo4j へ渡す前に classification policy を評価する。結果は `include`、`redact`、`exclude` のいずれかとする。

- policy が不明、取得不能、未登録なら fail closed で `exclude` とする。
- `redact` は secret や本文を除き、必要最小限の identity / relation metadata だけを許す。
- source の閲覧権限より広い graph consumer へ record を露出しない。
- Neo4j の role / privilege 機能だけを source classification の正本にしない。
- edition、deployment、database 分割、subgraph privilege の組合せは ADR の検証対象とする。

## 13. Fast lane と micro-edit lane

日常更新の既定 owner は、変更の頻度と復元責任で決める。

- 日次で変わる board status、局所配置、一時的な運用メモは M3E-local source を既定とする。
- repository が所有する設計定義、contract、code 対応 assertion は Git-backed source を既定とする。
- M3E-local occurrence から repository-owned entity / task へ `binds` で参照する。
- repository-owned concern の小変更は、proposal journal へ即時保存し、owner への PR / commit を batch 化できる。
- 同じ concern への routed write が 1 日 3 回を超える状態が継続する場合、操作を迂回させるのではなく owner 境界を再評価する。

`3 回` は Phase 0 の観測開始値であり、製品原則ではない。dogfooding の計測で変更できる。

## 14. Agent context bundle

agent へ渡す graph context は透過的な永続 cache にしない。Director が dispatch 時に task 固有の context bundle を生成する。

必須条件:

- source revision 集合を lockfile として固定する。
- deterministic serialization を使い、同じ入力から同じ byte 表現を生成する。
- consumer agent は bundle を read-only として扱う。
- stale read は許容するが、write-back は `baseRevision` で conflict を検出する。
- bundle lifecycle は task / handoff に束ね、task 完了後に canonical source へ昇格させない。

## 15. Requirements

- RQ1: durable concern ごとに canonical owner が一意でなければならない。
- RQ2: source-materialized record を削除しても canonical source から再構築でき、M3E-owned accepted record は **portable snapshot + journal replay のみ**で復旧できなければならない。backup / restore は補助経路として検証してよいが、Recovery Gate の通過根拠にしない。
- RQ3: UI、human、AI、bot、CI は同じ authority resolution を利用しなければならない。
- RQ4: Rapid occurrence と Deep entity は別 identity として表現でき、many-to-many entity binding を許さなければならない。
- RQ5: cross-authority reparent は通常 move として確定してはならない。
- RQ6: proposal と pending assertion は Neo4j 以外に canonical 保存されなければならない。
- RQ7: materialization は source classification を保持し、未判定情報を fail closed で除外しなければならない。
- RQ8: write-back は base revision を必要とし、stale write と echo を検出しなければならない。
- RQ9: global query は参照した source revision または snapshot ID を説明できなければならない。
- RQ10: Neo4j が不適合でも portable source と adapter contract を維持しなければならない。
- RQ11: global query は openCypher / ISO GQL 語彙の read-only 部分集合を使い、独自 query 言語を定義してはならない。`CREATE`、`MERGE`、`SET`、`DELETE` は禁止し、変更は Semantic Command へ正規化しなければならない。

## 16. テスト観点

### 正常系

- Git-backed source の commit を index し、同じ identity と revision でqueryできる。
- M3E-local occurrenceをGit-backed entityへentity bindingで接続し、本文を重複保存せず横断表示できる。
- proposalをjournalへ保存し、承認後にownerへrouteして再indexできる。
- context bundleを同じrevision集合から2回生成し、byte同値になる。

### 境界

- path rename、repository rename、display label変更後もstable identityを解決できる。
- nested authority root、alias、GraphLinkでowner resolutionを混同しない。
- source未mount、stale、inaccessible、missingを区別する。
- same assertionのreverse edgeをderivedとして扱い、二重canonical保存しない。

### 失敗系

- Neo4jを全削除し、source-materialized recordをowner source群から再構築し、M3E-owned accepted recordを独立recovery evidenceから復旧する。
- stale `baseRevision` のwriteを拒否し、proposalを失わない。
- cross-authority reparentを`ownership-transfer-required`で拒否する。
- transfer中のdestination失敗からsource-pendingを再開または補償する。
- classification不明recordをmaterializeしない。
- bot echoを二重commitせずaudit上で同一因果として扱う。
- query surface が `CREATE` / `MERGE` / `SET` / `DELETE` を拒否し、同じ変更意図を Semantic Command としてのみ受理する。

## 17. Phase 0 完了条件

1. 本仕様の RQ1〜RQ11 が acceptance criteria として合意される。
2. [../04_Architecture/Federated_Semantic_Graph.md](../04_Architecture/Federated_Semantic_Graph.md) のport境界とfailure handlingが矛盾しない。
3. [../09_Decisions/ADR_008_Federated_Canonical_Sources.md](../09_Decisions/ADR_008_Federated_Canonical_Sources.md) がADR 004との関係を記録する。
4. `Data_Model.md`、`Storage_And_Collab_Overview.md`、`Scope_and_Alias.md`、`Glossary.md` が本仕様を参照する。
5. Neo4j shadow実装前に、実需cross-source queryが3件記述される。
6. [../04_Architecture/LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conversation_Protocol.md) のcontext projectionとgraph operationがowner routingを迂回しない。

## 18. 未決事項

次は本仕様で捏造せず、ADRまたはadapter specimenで決める。

- repository-local source の配置名とserialization
- source registry自体のcanonical storageとdiscovery
- global identityの文字列表現
- authority markerのfield名とserialization
- binding assertionの既定ownerとmerge/split UI
- Neo4j edition、deployment、database分割、backup、authentication
- embedded graph database等の代替adapter比較
- SQLite cacheを残す範囲と削除条件

## 関連

- [../01_Vision/Strategy.md](../01_Vision/Strategy.md) — S16
- [Data_Model.md](./Data_Model.md)
- [Scope_and_Alias.md](./Scope_and_Alias.md)
- [Obsidian_Vault_Integration.md](./Obsidian_Vault_Integration.md)
- [../04_Architecture/Federated_Semantic_Graph.md](../04_Architecture/Federated_Semantic_Graph.md)
- [../09_Decisions/ADR_008_Federated_Canonical_Sources.md](../09_Decisions/ADR_008_Federated_Canonical_Sources.md)
- [../tasks/handoff_s16_neo4j_federation_define_260718.md](../tasks/handoff_s16_neo4j_federation_define_260718.md) — dogfooding scenario と 2026-07-19 承認追補の正本
- [../../protocols/repository-canon-values.md](../../protocols/repository-canon-values.md)
