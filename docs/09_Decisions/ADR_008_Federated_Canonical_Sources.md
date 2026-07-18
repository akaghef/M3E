# ADR 008: Federated Canonical Sources and Rebuildable Semantic Graph

## Status

Accepted for Phase 0. Neo4j activation remains gated.

## Date

2026-07-18

## Context

M3Eの現行Rapid runtimeは、workspace内のSQLiteへmap state、backup、audit、cloud-syncを集約する。この構成はローカル編集には適する一方、repositoryのcode・design document、ObsidianのMarkdown、外部provider stateを同じSQLiteへ正本として取り込むと、各sourceのrevision・復元責任・bot可視性と衝突する。

repository情報をSQLiteへ複製し双方をwrite可能にするとdual-canonになる。逆にNeo4jを全内容の唯一の正本へ昇格すると、Git diff、offline operation、portable recovery、外部provider ownershipを失う。

必要なのはDB製品の単純置換ではなく、durable concernごとのcanonical ownerと、大域semantic query surfaceの分離である。

## Decision

### 1. Canonical sourceを連邦化する

Git、Obsidian、M3E-local、external providerは、それぞれが得意なdurable concernのcanonical sourceになりうる。同じentityまたはassertionについてcanonical ownerは一つにする。

### 2. M3E Semantic Coreをstorageから分離する

M3Eはidentity、Scope、typed relation、Authority、Command、validation、approval、conflict policyをDB製品から独立して定義する。

### 3. Neo4jのroleをowner concernで分ける

Neo4jを大域semantic graphの優先adapterとする。Git、Obsidian、provider、Rapid sourceが所有するrecordは`source-materialized`とし、owner sourceから再構築可能にする。M3Eが所有するaccepted Deep entity / assertionは、activation gate通過後に`M3E-owned accepted` canonical runtime recordとして保存できる。

proposal、pending assertion、pending transferはjournalをcanonical sourceとする。database内でowner source、record role、owner revision、provenanceを区別し、Neo4jを全contentの一律canonical storeにしない。

### 4. Neo4j導入はDemand Gateを通す

repository-local semantic sourceをagent・CIがfile readできることを最初のuse caseとする。Neo4j shadowは、日常dogfoodingから実需のcross-source queryを3件以上具体化できた後に開始する。M3E-owned accepted graphのcanonical runtime activationはshadow / recovery検証後に行う。

### 5. writeはownerへrouteする

UI、AI、bot、CIはrecord role未解決のraw writeを行わない。M3E Commandがownerとbase revisionを解決する。source-owned targetはnative ownerで確定後にmaterializationを更新し、M3E-owned accepted targetだけをcanonical graph adapterへrouteする。

### 6. SQLite判断を局所化する

ADR 004のSQLite採用はRapid local persistenceの範囲で継続する。将来server導入時の第一候補を一律PostgreSQLとする部分は本ADRがsupersedeする。collaboration state、local persistence、global graph materializationは別concernとして選定する。

### 7. graph exposureを独立gateにする

source classificationをmaterialization前に評価し、未判定情報はfail closedで除外する。Neo4jのrole / privilege機能だけをsource側権限の正本にしない。細粒度access controlはedition依存であるため、deployment ADRとsecurity testで検証する。

## Why this decision

- GitやObsidianが既に所有する履歴・本文をM3Eが再実装しない。
- botとCIが専用SQLite APIなしでrepository semanticsを読める。
- M3E固有のidentity、Scope、relation、Authorityを一つのcontractへ統合できる。
- Neo4jのtraversal能力を利用しながら、opaque store破損や製品撤退に耐えられる。
- Rapidのoffline operationを維持したままDeepのcross-document graphへ進める。
- backup / restoreのfailure domainをcanonical source単位へ縮小できる。

## Alternatives considered

### A. 単一SQLiteを全情報の正本として拡張

不採用。repository、provider、vaultのrevision系と一致せず、bot可視性と局所復元を損なう。

### B. repositoryごとにSQLiteを配置

不採用。Git diff / mergeに適さず、schema migrationとbinary conflictをsource数だけ増やす。

### C. Neo4jを全sourceの唯一のcanonical storeにする

不採用。offline-first、Git history、provider ownership、portable recoveryと衝突する。

### D. PostgreSQLを全concernの統合DBにする

不採用。relational collaboration stateには適合しうるが、すべてのcanonical ownerとgraph materializationを同じserverへ集約する理由にはならない。

### E. portable sourceだけを作り、graph databaseを導入しない

Phase 0 / 1では許容する。実需queryが不足する間はこの状態を維持する。Neo4j shadow導入はDemand Gate後とし、Phase 0の成功条件にしない。

### F. Neo4j以外のgraph adapter

source-materialized read adapterとしては継続比較する。M3Eのcontractはadapter-neutralに保ち、typed property graph、traversal、local operation、rebuild、security、運用費を同じfixtureで評価する。M3E-owned accepted graphのcanonical runtimeは既存判断どおりNeo4jとし、activation gateで可否を検証する。

## Consequences

### Positive

- concernごとのowner、revision、write route、recoveryが明示される。
- source-materialized graphを削除・再生成でき、M3E-owned canonical subgraphを独立recovery evidenceから復旧できる。
- repository semanticsをcode/specと同じcommitで変更できる。
- UI、AI、bot、CIの正本判断を共通化できる。
- database製品の変更がM3E semanticsの変更にならない。

### Negative

- source-materialized部分を含むglobal queryは常に強整合な単一snapshotではなく、revision set付きsnapshotになる。
- 同じdatabase内にcanonical recordとmaterialized recordが同居するため、owner / roleを欠くqueryとwriteを禁止する必要がある。
- source registry、adapter、proposal journal、transfer coordinatorが新しい責務になる。
- cross-authority writeはglobal transactionではなく、再開可能なworkflowになる。
- classificationとgraph閲覧権限の二層管理が必要になる。
- owner-routed writeの摩擦を放置すると、私的複製によるdual-canonが再発する。

## Constraints

- Neo4j binary store、transaction log、cache、secretをGit管理しない。
- repository本文が正本なら、repository-local semantic sourceへ本文を複製しない。
- proposalとpending assertionをNeo4jだけに保存しない。
- M3E-owned accepted recordはvalidated Commandだけで更新し、portable recovery evidenceを別failure domainに持つ。
- Scopeをstorage / Authority boundaryと同一化しない。
- migration中も同じconcernのwrite authorityは一箇所にする。
- graph materializationはsource classificationを通過したrecordだけにする。

## Activation gates

1. Canon Gate: ownerが一意
2. Identity Gate: rename後も追跡可能
3. Rebuild Gate:source-materialized recordをowner sourceから再構築可能
4. Exposure Gate:非許可情報がqueryへ出ない
5. Demand Gate:実需queryが3件以上
6. Fidelity Gate:旧系とCommand結果・invariantが同値
7. Recovery Gate:M3E-owned accepted recordをbackup、journal、portable snapshotから復旧可能

## Review triggers

- M3E-owned accepted graph以外へNeo4j canonical範囲を拡張する提案
- record role / owner discriminator変更
- new source kind追加
- source registryのcanonical storage決定
- graph edition / deployment変更
- ownership transfer contract変更
- Rapid occurrence / Deep entityのentity binding semantics変更
- PostgreSQL等をcollaboration stateへ導入する判断

## Supersedes

- [ADR_004_SQLite_For_Rapid_MVP.md](./ADR_004_SQLite_For_Rapid_MVP.md) の「将来server導入時の第一候補を一律PostgreSQLとする」部分だけをsupersedeする。
- ADR 004のRapid local persistenceとしてのSQLite採用は継続する。

## References

- [../01_Vision/Strategy.md](../01_Vision/Strategy.md) — S16
- [../03_Spec/Federated_Semantic_Source.md](../03_Spec/Federated_Semantic_Source.md)
- [../04_Architecture/Federated_Semantic_Graph.md](../04_Architecture/Federated_Semantic_Graph.md)
- [../04_Architecture/LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conversation_Protocol.md)
- [../../protocols/repository-canon-values.md](../../protocols/repository-canon-values.md)
- Neo4j role-based access control: <https://neo4j.com/docs/operations-manual/current/authentication-authorization/manage-privileges/>
- Neo4j fine-grained access control: <https://neo4j.com/docs/operations-manual/current/tutorial/access-control/>
