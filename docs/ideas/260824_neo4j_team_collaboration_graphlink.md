# Neo4j-backed Team Collaboration と GraphLink 参照

最終更新: 2026-08-24  
status: idea / requirement harvest（S2 Team Collaboration と S16 Neo4j runtime の接続候補。Spec / ADR 採択前）

## Why

本メモの対象は一般的な「multi-user」ではなく、M3E の **Team Collaboration** である。多数の PC、人間、AI worker が同じ workspace を読み書きするとき、Neo4j を graph runtime として用いても、GraphLink の同一性、scope / alias、競合、権限、監査、復旧を壊さない設計要件を収穫する。

論点は DB 操作 UI や Cypher の書き方ではない。次を判定する。

> 多数 PC が中央の Neo4j-backed M3E runtime を共有する構成は成立するか。成立させるには、Neo4j の transaction 能力だけでは不足するどの M3E 契約が必要か。

## 結論

**Cloudflare 非 host・PC host 移動型の store-and-forward 構成を採用候補とする。** Cloudflare は M3E application や Neo4j graph runtime を実行せず、accepted journal、portable snapshot、asset、manifestを耐久保存し、host lease / epoch / fencing の最小限の調停だけを担う。

各 online PC はローカル Neo4j materializationを持てるが、Neo4j の物理 store は同期しない。online中は有効なleaseを持つ一台だけがactive hostとなり、Commandの順序付け・authority / baseRevision検証・Neo4j transactionを担う。host交代はcanonical ownershipの移動ではなく、temporary execution / write authorityの移動である。

```text
N = 0
  Cloudflare: latest committed manifest + snapshot + journal + assets
  active host / graph runtime: none

N = 1
  PC: lease取得 → snapshot + journal replay → local Neo4j materialize
      → higher epochでactive host開始

N > 1
  one PC: active host / command sequencer / validation authority
  others: clients or read replicas
  Cloudflare: durable journal / relay / snapshot / lease metadata
```

accepted writeはCloudflareへdurable appendされた後だけ`committed`とする。snapshot生成は定期でよいが、accepted journalを「定期snapshot時だけ」送る設計にはしない。Cloudflare到達不能時の変更は`tentative proposal`としてlocal queueへ保存し、再接続後にactive hostが再検証する。

したがって `Neo4j-backed sync` は次を意味する。

- Browser、AI、botはactive hostへSemantic Commandを送り、Neo4jへraw writeしない。
- active hostは`commandId`、membership、owner、baseRevision、epochを検証する。
- 各PCのNeo4jはportable snapshot + journalから再構築できるmaterializationである。
- Cloudflare上のaccepted journalが共有履歴canonであり、Cloudflare自体がsemantic ownerなのではない。
- event stream / direct P2Pは高速な通知・配送路として追加できるが、正本やcorrectnessを依存させない。

## 具体例: 販売と返品分析

### 共有する意味実体

```text
Customer: 田中
Product: カメラ
GraphLink: 購入 #1001
```

GraphLink を alias の target として参照し、関係自体を別 scope で詳細化する必要がある。このため、詳細化対象の GraphLink は Neo4j で **relationship reification（関係の実体化）**に相当する node として表す。

```text
(:GraphLink { id: "purchase-1001", relationType: "PURCHASED" })
  -[:SOURCE]->(:Entity { id: "customer-tanaka" })
  -[:TARGET]->(:Entity { id: "product-camera" })
```

内部 contract は `SOURCE` / `TARGET` に固定し、domain role を別に持つ。

```text
sourceRole = BUYER
targetRole = PRODUCT
```

販売 map と返品分析 map は購入を複製しない。

```text
販売 map occurrence      -[:REFERS_TO]-> GraphLink purchase-1001
返品分析 map occurrence  -[:REFERS_TO]-> GraphLink purchase-1001
```

返品分析 scope には、同じ購入関係への alias occurrence と、返品理由、レシート、対応履歴を置ける。親子 `edge` の alias / reification は本検討の対象外とする。

## Neo4j が提供するものと、提供しないもの

### 委譲できるもの

- graph record の atomic transaction
- Node / Relationship / Label / Property
- identity / uniqueness を補助する constraint と index
- 同時 transaction の lock / conflict behavior
- traversal と openCypher / GQL-shaped read
- server clusterを採る場合のserver-side availability / routing

### M3E が別途定義するもの

- actor / device / session / workspace membership
- scope と canonical owner の区別
- GraphLink canon と scope-local occurrence の区別
- `baseRevision` による optimistic concurrency
- stale write の reject / merge / human escalation
- idempotent `commandId`
- AI proposal と accepted write の区別
- classification と owner-routed authorization
- durable audit / conflict backup / portable recovery journal
- reconnect / offline queue / event replay
- alias target消失時の tombstone / broken reference

Neo4j transaction が成功しても、「その actor に変更権限がある」「stale state ではない」「AI提案が承認済み」「別PCへ通知済み」「別 failure domain から復旧できる」は自動的には保証されない。

## Candidate logical model

```text
(:Workspace { id })

(:Entity {
  id,
  workspaceId,
  ownerSourceId,
  recordRole,
  classification,
  revision,
  status
})

(:GraphLink {
  id,
  workspaceId,
  relationType,
  sourceRole,
  targetRole,
  ownerSourceId,
  recordRole,
  classification,
  revision,
  status
})

(:GraphLink)-[:SOURCE]->(:Entity)
(:GraphLink)-[:TARGET]->(:Entity)

(:Occurrence {
  id,
  workspaceId,
  mapId,
  scopeId,
  revision,
  visibility
})

(:Occurrence)-[:REFERS_TO]->(:Entity | :GraphLink)
```

### Stable identity

- M3E の永続 ID に Neo4j 内部 ID / `elementId` を使わない。
- export、restore、re-materialize 後も同じ M3E ID を維持する。
- 最低限 `(workspaceId, id)` の一意性を保証する。global UUID を使う場合も `workspaceId` は authorization / export / classification boundary として残す。

### GraphLink の representation

- GraphLink は生成時から stable identity を持つ。
- 「参照された瞬間に Relationship から Node へ型変換する」設計は採らない。多人数編集中の representation change は stale reference、権限分裂、二重canonを起こす。
- traversal高速化のため `(:Entity)-[:PURCHASED]->(:Entity)` を置く場合、それは `graphLinkId` を持つ再生成可能な shortcut とし、直接編集可能な第二正本にしない。

### Canon と occurrence

Canonical GraphLink が所有するもの:

- source / target
- relationType / domain role
- owner / classification / status
- shared semantic attributes
- canonical revision

Scope-local occurrence が所有するもの:

- map / scope membership
- placement / display state
- scope-local label / visibility
- occurrence revision

これにより、一人が購入関係の意味を編集し、別の人が返品分析 scope の配置を変更しても、不要な同一record競合を起こさない。

## Write and synchronization contract

### Single write authority

```text
Client intent
→ authenticated M3E Command
→ workspace membership / target owner / classification check
→ baseRevision check
→ Neo4j transaction
→ resultRevision
→ durable journal / committed event
→ client notification
```

- Browser、AI、bot、CI は同じ authority resolution を使う。
- client へ Neo4j credential や unrestricted Cypher write を配らない。
- 同じ `commandId` の retry は同じ結果を返し、二重適用しない。
- client の `baseRevision` が current revision と不一致なら silent overwrite しない。

### Atomic GraphLink creation

次を一つの transaction boundaryで成立させる。

- GraphLink identity
- SOURCE endpoint
- TARGET endpoint
- workspace / owner / classification
- initial revision

ownerなし、片端だけ、別workspace endpointという中間状態をcommitしない。

### Conflict granularity

`Team_Collaboration.md` の document-global `baseVersion` は graph record共有では偽競合を増やす。次のaggregate単位へ分ける候補とする。

- GraphLink core revision: endpoint、relationType、owner、status
- Entity revision: entity本文・共有属性
- Occurrence revision: scope-local placement / display
- Evidence / annotation revision:独立detail record

例:

- PC A が `purchase-1001` の `relationType` を変更し、PC B が同じ GraphLink の endpoint を変更する → conflict。
- PC A が canonical GraphLink を変更し、PC B が返品分析 occurrence の位置を変更する → 別aggregateなので両方commit可能。
- PC A とPC Bが独立した evidence を追加する → GraphLinkがactiveで権限があれば、通常は両方追加可能。

### Lock policy

- Neo4j の transaction lock は database整合性用であり、M3E の scope lockと同義ではない。
- scope lock は presence / coordination の advisory leaseとして残せる。
- correctness は lock保持だけに依存させず、`baseRevision` とtransaction validationで保証する。
- 現行の「priorityの高いactorが同じnode変更を自動的に勝ち取る」は、意味recordでは silent lossになりうる。GraphLink / Entityのcanonical writeでは reject + merge / human escalation を既定候補とする。

## Many-PC requirements

### Client / server topology

- PCはNeo4j file/storeを保持・同期しない。
- PCはprojection cacheとpending Command queueだけを保持できる。
- server endpointは一つのlogical write authorityとして見える。
- Neo4j clusterを採る場合もM3E APIがrouting / retry / bookmark相当のread-after-write要件を吸収し、clientへdatabase topologyを漏らさない。

### Event delivery

- SSE / WebSocketは通知経路であり、delivery欠落を許容する。
- eventは単調なcursorまたはresult revisionを持つ。
- reconnect時、clientは最後のcursor以降を再取得するか、current snapshotへ追いつく。
- UI stateをeventだけから再構築しない。

### Actor, device, session

- `actorId`: 人間 / AI / bot の責任主体
- `deviceId`: PC / browser profile
- `sessionId`: 一回の接続 / login
- `commandId`: retry可能な一つの意図

同一人物が複数PCから接続してもactorを重複登録しない。監査では actor と device / sessionを分離して保持する。

### Authorization and tenancy

- `workspaceId` をすべてのcanon / occurrenceへ必須化する。
- `scope` をtenant / security boundaryとして流用しない。scopeは認知・編集境界である。
- alias occurrenceの配置権限と、target GraphLinkの編集権限を別に判定する。
- GraphLink assertion ownerと両endpoint ownerを別々に解決する。
- Neo4j role / privilegeは防御層に使えるが、M3E record owner / source classificationの正本にしない。
- 通常GraphLinkのendpointは同一workspaceに限定する候補とし、cross-workspace relationは別のfederated reference contractに分ける。

### Delete and recovery

- 参照中GraphLinkを即hard deleteせず、tombstoneへ遷移させる。
- occurrenceはbroken referenceとしてlast-known label / endpointを保持できる。
- recoveryで同じstable IDが戻った場合、broken occurrenceを再解決できる。
- M3E-owned accepted GraphLinkはportable snapshot + journal replayで復旧できる。
- Neo4j backup / cluster replicaだけを意味的復旧根拠にしない。

## Write-ahead journal candidate

Neo4j commitと外部event / recovery evidenceのdual-write gapを隠さない。候補フロー:

```text
1. Commandを外部durable journalへ pending としてappend
2. Neo4j transactionを commandId 付きで冪等適用
3. resultRevisionをjournalへ committed としてappend
4. committed cursorをnotificationへpublish
```

中断時は `commandId` により pending / applied / notified を再開する。具体的なjournal製品・transaction coordinationはArchitecture / ADRで決める。

## 現行 Team Collaboration 仕様との差分

現行 [Team_Collaboration.md](../03_Spec/Team_Collaboration.md) は Rapid JSON document 同期としては有用だが、Neo4j-backed shared semantic graphへそのまま適用すると不足がある。

| 現行 | Neo4j-backed Team Collaboration候補 |
|---|---|
| document-global `version` | Entity / GraphLink / Occurrenceのaggregate revision |
| scope lockがcorrectnessを主導 | advisory scope lease + transaction / baseRevision |
| 同一node競合はpriority勝ち | canonical semantic recordはreject + merge / human escalation |
| `changes.nodes`中心 | typed CommandでEntity / GraphLink / Occurrenceを変更 |
| in-memory token / lock | 再起動・複数API instanceを考慮したdurable identity / lease store |
| SSE受信後に全state pull | cursor付きevent +差分またはsnapshot catch-up |
| audit / conflict backupは後続phase | team canon化前の必須要件 |

この差分は「Neo4jが弱い」のではなく、Rapid document merge と shared semantic graph transaction のaggregate境界が異なるために生じる。

## Project ownership and local binding

### 採用判断

map本体は **workspace-owned canon** とし、local projectへmaterialize / bindする。project repoをCloudflare accepted journalと並ぶ第二のwrite可能なcanonにはしない。

現行実装で可能なのは次までである。

- `M3E_DATA_DIR` / `M3E_DB_FILE`によりworkspace全体のSQLite保存先をproject配下へ変更できる。
- map-level source bindingは`MapSource = { kind: "obsidian"; path: string }`のみ。
- Local FS APIは任意projectを安全にlist / readできるが、browser localStorage上のroot選択であり、mapのdurable bindingではない。

したがって、**一般local projectへのmap-level Project Binding、PCごとのpath解決、team共有bindingは未実装**である。

### Logical model

```text
ProjectRef {
  projectId, workspaceId, label,
  sourceKind, sourceUri, sourceFingerprint,
  classification
}

ProjectBinding {
  bindingId, mapId, projectId,
  role: primary | reference,
  repoRelativePath, ownerSourceId, revision
}

DeviceMount {
  deviceId, projectId,
  localAbsolutePath, observedFingerprint,
  availability, lastVerifiedAt
}
```

- mapは複数`ProjectRef`を参照できるが、`primary`は最大一つ。
- project未所属mapを許す。一つのprojectに複数mapをbindできる。
- 共有canonは`projectId`、repository identity / source URI、repo-relative pathを持つ。
- `/Users/...`、`C:\\Users\\...`等の絶対pathは`DeviceMount`だけが持つ。
- projectの移動・renameではidentityを変えず`DeviceMount`を更新する。
- fingerprint不一致なら誤projectへ自動接続しない。
- unbind / unavailableでmap本体を削除しない。

project sidecarを置く場合も、`.m3e/project.json`等の発見・binding metadataとportable projectionに限定する。Neo4j physical store、SQLite / Neo4j lock、pending Command、host lease、credential、session、cacheはrepoやnaive file syncへ置かない。

## Supabase implementation and Cloudflare replacement boundary

現行Supabase利用は`@supabase/supabase-js`のDatabase clientでmap全体の`AppState` JSONを一行としてselect / upsertする`SupabaseTransport`である。コード上、Supabase Auth、Realtime channel、Presence、Storage、event orderingには依存していない。Presence、heartbeat、scope lock、SSE、auditはM3E Node server側の独自実装である。

したがってSupabase固有結合は浅いが、既存`CloudSyncTransport`はwhole-map mirror用である。

```text
push(mapId, SavedMap, baseSavedAt, force, baseMapVersion)
pull(mapId)
status(mapId)
```

これはCloudflare snapshot migrationの足場には使えるが、host移動型collaboration seamとしては不足する。必要な新seamは最低限次を持つ。

```text
acquireHostLease / renewHostLease / releaseHostLease
appendJournalSegment / fetchJournalSince
compareAndSwapManifest
uploadSnapshot / downloadSnapshot
acknowledgeFrontier
registerDevice / revokeDevice
```

再利用候補:

- viewer / local persistence / map editing
- actor role / capabilityの概念
- heartbeat / Presence / advisory scope lock
- SSE notification、retry、audit入口、conflict backup
- Supabase whole-map pullをmigration snapshotへ変換する経路

要改修・新規:

- durable Membership / Device identity
- Semantic Command、idempotency、aggregate revision
- accepted journal write-through
- lease / epoch / fencing
- portable snapshot + deterministic state hash + replay
- tentative / committed UI
- ProjectRef / ProjectBinding / DeviceMount
- Supabase snapshotからCloudflare manifestへの移行とrollback期

単純な`SupabaseTransport → CloudflareTransport`のadapter置換だけでは、whole-map blobの保存先が変わるだけであり、採用した同期contractにはならない。

## Host lease, handoff and commit contract

正常handoff:

```text
accept停止 → accepted journal flush → manifest / snapshot checkpoint
→ replica cursor確認 → lease release → 新host hydrate
→ higher epoch取得 → write再開
```

異常handoff:

```text
lease timeout → 新hostがlast durable cursorからhydrate
→ higher epoch取得 → 旧epochをfence
```

- leaseを更新できないhostはshared accepted writeを停止する。
- Cloudflareはjournal append / manifest CAS時にepoch / fencing tokenを検証する。
- clientはcommit ackまでPendingCommandを保持する。
- CF append後・ack前のretryは同じ`commandId`で一度だけ適用する。
- tentative UIは即時反映できる。初期値は1秒以内または50 operationsでflushし、正常退出時は即flushする。

## Failure cases that must pass

### Normal

- `N=0 → 1`でportable snapshot + journalをreplayし、同じstate hashのlocal Neo4j materializationを作る。
- `N>1`でも有効なlease / epochを持つhostは一台だけである。
- 3台のPCから同じworkspaceを開き、別GraphLink / occurrenceを同時更新して両方残る。
- 同じGraphLinkの同一revisionへ競合writeし、一方をsilent overwriteせず409相当 + conflict evidenceを返す。
- GraphLink aliasを別scopeへ追加してもcanonical GraphLinkを複製しない。
- AI proposalを人間が承認するまでaccepted graphへ反映しない。
- ProjectBindingが指すprojectのlocal pathが端末ごとに異なっても、同じ`projectId`へ解決する。

### Boundary

- 同一actorが2台のPCから同じcommandをretryしても一度だけ適用する。
- CF append後・client ack前にhostが停止しても、retryで二重適用しない。
- event受信前に再接続してもcursor / snapshotから追いつく。
- alias配置権限はあるがtarget GraphLink編集権限がないactorを正しく拒否する。
- GraphLink endpointが異なるowner sourceでも、assertion ownerを独立に解決する。
- projectが未clone / offlineでもmap canonを失わず、bindingを`unavailable`として保持する。
- projectのmove / renameでは`projectId`を維持して`DeviceMount`だけを更新する。
- journal compaction後も長期間offlineだったPCがsnapshot + retained journalから復帰する。

### Failure

- hostがlocal適用後・CF append前に停止しても、clientのPendingCommandを新hostへ再送できる。
- network partition中の旧hostが旧epochでappendしてもfencingで拒否する。
- Cloudflare到達不能中は`committed`を返さず、tentative proposalだけを保持する。
- journal segmentの重複、順序逆転、欠落、hash不一致を検出する。
- snapshot破損、schema不一致、journal gap時にsilent bootstrapしない。
- transaction commit後、notification送信前にserverが停止しても、再起動後に未送信eventを回収する。
- journal pending後、Neo4j commit前に停止しても安全にretryする。
- endpoint削除とGraphLink変更が競合したとき、dangling endpointをcommitしない。
- delete対update、GraphLink重複生成、失効deviceからの再送をconflict / rejectへ送る。
- Neo4j全削除後、source-materialized recordを再構築し、M3E-owned accepted GraphLinkをportable snapshot + journal replayから復旧する。
- 切断PCの古いCommandを再接続時に無条件適用しない。
- ProjectBindingのfingerprintが違うlocal directoryへ自動接続しない。
- classification不明recordを別team actorへ露出しない。

## Non-goals

- 親子 `edge` のalias / reification
- client PC間でNeo4j binary storeをfile syncすること
- offline multi-master graph mergeをNeo4j単体の責務とすること
- clientへraw Cypher writeを公開すること
- scopeをtenant / storage boundaryへ変えること
- proposal / pending assertionをNeo4jだけに保存すること

## Open Questions

1. occurrenceはteam共有か、user-private viewも同じmodelで扱うか。
2. cross-workspace GraphLinkを禁止するか、明示的federated referenceとして許すか。
3. GraphLinkに直接annotationを埋める範囲と、独立Evidence entityへ分ける境界。
4. host leaseのduration / heartbeat / takeover grace、journal segment上限、snapshot cadence / retentionの具体値。
5. delete対update、同時offline proposal、GraphLink重複候補、失効中device proposalのoperation別merge規則。
6. CloudflareのR2 / D1 / Durable Objects / Queuesへの責務配分。製品選定は本logical contractの後に行う。

## Next Action

- 本メモのlogical entity / command / failure casesを`Team_Collaboration.md`、`Data_Model.md`、`Scope_and_Alias.md`へ重複なく分配する前に、要件reviewを行う。
- `ProjectRef`, `ProjectBinding`, `DeviceMount`, `HostLease`, `WorkspaceManifest`, `JournalSegment`, `PortableSnapshot`のschema specimenを作る。
- 販売例を使い、`N=0 → 1 → 3 → 1 → 0`、正常handoff、host crash、network partitionのstate machine fixtureを作る。
- Cloudflare製品責務とSupabase migration / rollbackをArchitecture / ADRとして決める。
- Demand Gateが開くまでS16本実装へは進まず、Codex handoffは要件採択後に分割する。

## Sources and evidence

### Conversation evidence

- 2026-08-24 本対話: Neo4j化要件、標準化コスト、GraphLinkをnodeとして参照・詳細化する要求、親子edgeは対象外、multi-userはTeam Collaboration / 多数PC同期を意味するという訂正、Cloudflare非hostのstore-and-forward、`N=0 / 1 / >1`、PC host lease / epoch / fencing、local project binding、SupabaseからCloudflareへの移行要求。current conversation URIは利用できない。
- [Codex thread: Neo4j化計画の決定済み・保留・未着手](codex://threads/019fd325-36a0-7a51-afe2-5313cf6540bf) — owner concern、proposal journal、raw write /双方向同期禁止、Rapid lane維持。
- [Codex thread: Aura lifecycle operational signal](codex://threads/01a02167-937b-7390-8044-324e5aed3f7e) — managed runtimeのinactive deletion、export、rebuild運用。
- [2026年8月会話 Neo4j化要件 ledger](file:///Users/nisimoriyuuya/data/01_ai/chat-log/neo4j-requirements-2026-08.md) — Codex / Claude Code横断要件とsource coverage。ChatGPT exportはsource unavailable。

### Repository canon / source layer

- [Team Collaboration](../03_Spec/Team_Collaboration.md) — 現行のentity registration、scope lock、baseVersion、priority conflict、SSE。
- [Federated Semantic Source](../03_Spec/Federated_Semantic_Source.md) — assertion owner、Command envelope、baseRevision、proposal journal、read-only query、recovery要件。
- [Data Model](../03_Spec/Data_Model.md) — node / edge / GraphLink分離と現行alias target制約。
- [Scope and Alias](../03_Spec/Scope_and_Alias.md) — scopeは認知・編集境界、alias配置ownerとtarget authorityの分離。
- [ADR 008](../09_Decisions/ADR_008_Federated_Canonical_Sources.md) — collaboration state、local persistence、global graph materializationは別concern。Neo4j activationはgated。
- [S16 Neo4j差別化](./260809_s16_neo4j_differentiation.md) — Neo4jへgraph mechanicsを委譲し、M3Eはscope、approval、owner routing、projectionを所有する。

### Neo4j official references to verify in deployment ADR

- Transactions: <https://neo4j.com/docs/cypher-manual/current/transactions/>
- Concurrent data access: <https://neo4j.com/docs/operations-manual/current/database-internals/concurrent-data-access/>
- Constraints: <https://neo4j.com/docs/cypher-manual/current/constraints/>
- Drivers and connection management: <https://neo4j.com/docs/getting-started/languages-guides/>
- Clustering: <https://neo4j.com/docs/operations-manual/current/clustering/>
- Authentication / authorization privileges: <https://neo4j.com/docs/operations-manual/current/authentication-authorization/manage-privileges/>

外部web backend / Neo4j公式ページの直接取得は本セッション環境で403または未設定のため、edition別のcluster、CDC、細粒度authorization能力は本メモで確定していない。deployment ADR時に公式文書を再確認する。
