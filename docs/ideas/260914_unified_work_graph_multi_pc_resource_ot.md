# 一枚絵としてのM3E — 個人multi-PC、常駐host、Resource、OT統合

> Status: idea / vision memo。決定・仕様ではない。
> Date: 2026-09-14
> Source: Akaghefとの2026-09-14の対話、および外部OT [`gyroid-eth/orrery-telemetry`](https://github.com/gyroid-eth/orrery-telemetry)。[最遠の目標](../../.kiro/steering/farthest_goal.md)と[ADR_011](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md)はM3E側の受入境界として参照する。

## Target identity

本memoで `OT` と呼ぶ対象は、**gyroidが配布する外部repository [`gyroid-eth/orrery-telemetry`](https://github.com/gyroid-eth/orrery-telemetry)** に限る。Akaghef自作の `playground/agent-orrery` prototypeは別物であり、吸収対象でも実装品質の基準でもない。両者のsource、schema、runtime、UIを混同しない。

## Why

M3Eの最遠目標は、agentを監視するdashboardを作ることではない。
**作業が、それ自身を記述する単一のgraphの中で行われる状態**を作り、Akaghefの注意1単位あたりに成立する仕事量を最大化することである。

Team Collaborationを語る以前に、現実にはAkaghef自身が所有する複数PC間でさえ、作業・agent・状態・知識を満足に共有できていない。この個人multi-PC環境を一つの内部協働圏として成立させることが、最初の実戦になる。

一方でmac mini serverが追加されたことにより、常時稼働するmachineの存在を前提にできるようになった。これは、全端末が対等に偶発接続する構成だけでなく、常駐hostを中心としたauthority、relay、観測、event catch-upを設計可能にした変化である。

## Vision

### VA1. 最初のTeam Collaborationは「一人・複数PC」である

最初に解くべきteamは、複数人の組織ではなく、**一人のAkaghefが所有する複数PCと、そこで動くhuman / AI agent群**である。

各PCで別々にsession、task、knowledge、runtimeが生まれても、それらを別世界として扱わない。同一のPJ、Role、Task、Goal、Resourceへ結び直し、どのmachineからでも現在の仕事と判断frontierを辿れる状態を作る。

これは将来の複数人Team Collaborationの縮小版ではなく、その前提検証である。identity、authority、同期、offline queue、conflict、observability、recoveryを、自分の管理下にある環境で先に成立させる。

### VA2. mac mini serverは「常駐するactive host」という新しい前提である

mac mini serverの追加により、少なくとも通常運転では常駐machineの存在を仮定できる。

このhostは、次の責任を担う候補になる。

- 複数PCから到来するCommand / eventの受け口
- agent identity、session、communicationの継続観測
- active workspaceのauthorityまたはauthorityへのroute
- 切断端末のevent catch-upと競合検出
- background agentやscheduled workの常駐実行

ただし、常駐hostの存在は「そのmachineの物理DBだけを唯一の復旧根拠にする」ことを意味しない。M3Eのoffline-first、portable snapshot、journal、recoveryの要件は残る。**常駐性は運転上の中心を与えるが、復旧不能な単一障害点を正当化しない。**

### VA3. 一枚絵にはAgentだけでなくResourceも載る

完成形の主語はAgentではなくPJである。

`Why → What → Who → Now → With-what`

OTが強く扱うのは主に `Who / Now`、すなわちagent、lineage、communication、runtime stateである。しかしM3Eが目指す一枚絵では、Goal、Task、Knowledgeに加えて、**Resource（With-what）**も同じgraph上で辿れる必要がある。

例えば `お金` nodeを置き、agentやTask、Goalとtyped edgeで結ぶ。

- agentがどのbudgetを消費・管理しているか
- Taskがどの費用制約を受けるか
- Goalにどれだけの資金を割り当てたか
- tool、API、compute、machine、時間、人間の注意がどこへ投入されているか
- 支出・契約・収益が、どの判断と成果へ結びつくか

ここで `お金` nodeは単なる残高表示ではない。**仕事の意味構造とResourceの関係を見る入口**である。銀行・会計・spreadsheet等が数値のcanonical ownerである場合、その明細をM3Eへ複製せず、M3Eはowner、参照、配分、制約、provenance、現在値のmaterializationを区別して保持する。

将来的なResourceの候補は、お金、machine、compute、API quota、storage、時間、人間の注意、権限、契約、施設、実験装置である。

### VA4. OTは「Agent管理面として切り出されたA-sysの一部」である

外部OTが優れているのは、配布可能なsourceとbackendを持ち、ORRERY Mail、launcher、hooks、provider integration、dashboard APIを一つの運用系として実装していることである。単なるUI参考ではなく、観測・通信・実行管理systemとして教師にできる。

同時に、開発者自身が「タスク管理ツールの一部を切り出した」と説明しているなら、OTが公開しているのは全体systemではなく、**A-sys相当のうちAgent管理面を切り出したslice**だと理解できる。

OTの範囲は強いが狭い。Agent、Task、communication、runtimeを中心にしており、Akaghefが求める全体像そのものではない。

- intent / Goal
- knowledge / evidence / canon
- Task / execution
- human / AI agent / Role
- communication / Telemetry
- Resource
- decision / approval / attention
- artifact / result

Akaghefの目標は、この全体を一枚絵として管理することにある。したがってOTを別dashboardとして併用するだけでは、指示、観測、知識、Resource、判断が別の面に残り、最遠目標のRQ5に届かない。

### VA5. 「M3Eへ取り込む」とはOTを複製することではない

OT統合の目的は、OTの画面をM3E内に再現することでも、OT backendを無条件にM3Eの正本へすることでもない。

取り込む対象を分解する。

1. **外部OTのbackend / observation contract** — ORRERY Mail、runtime event、session、lineage、state、history、replay等の実データ経路。外部repositoryのversioned schemaとAPIから抽出し、自作prototypeから推測しない。
2. **interaction grammar** — node hover、edgeからmail履歴を開く、Deck / Network、time replay、detail card等。
3. **node typeごとの解釈** — Agent Card、Task、Role、Resource等が、それぞれschema、見た目、色、操作を所有する。
4. **M3E semantic graphへのbinding** — OT由来のAgent / Runtimeを、Goal、Task、Knowledge、Resource、human attentionへtyped edgeで接続する。

OTはAgent管理sliceの参照実装であり、M3Eはそれを包含する上位の意味空間になる。OTの完成部分は再発明せず利用・抽出する一方、M3Eのcanon、scope、Role / Actor Instance / Telemetry分離、field ownership、projection、attention routingをOT側の都合へ縮退させない。

## Governing distinction

```text
OT
└─ Agent management slice
   ├─ runtime observation
   ├─ lineage
   ├─ communication
   ├─ history / replay
   └─ agent operations

M3E / A-sys direction
└─ whole work graph
   ├─ Why: intent / Goal
   ├─ What: Task / artifact / knowledge
   ├─ Who: human / AI agent / Role
   ├─ Now: runtime / Telemetry / attention
   └─ With-what: money / machine / time / authority / other Resource
```

**OTは欠けたものではなく、完成度の高い部分系である。M3Eの仕事は、それを薄めずに全体系へ接続することである。**

## Current reality and direction

| Layer | 現在地 | 次に証明すべきこと |
|---|---|---|
| 個人multi-PC | 満足な共有に未到達 | 複数PCが同一PJ / Task / agent stateを矛盾なく共有できる |
| 常駐host | mac mini serverが追加された | active host、authority、relay、recoveryの責任境界を決める |
| Agent観測 | OTという稼働中のOSS参照実装がある | OT contractをM3E connector seamへ通し、実データで運転する |
| M3E semantic graph | Goal / Task / Role / attention等の設計がある | Agent sliceをKnowledge / Resource / decisionへtyped edgeで接続する |
| Resource | 一枚絵への必要性が見えた段階 | 最初の `お金` nodeで、canonical ownerとsemantic relationを混同せず俯瞰できる |

## Open Questions

### Q1. 常駐hostのauthority

mac mini serverは、canonical ownerそのものになるのか、Command relay / active runtimeに留まるのか。workspace、concern、fieldごとにauthorityを分ける必要があるか。

### Q2. 切断時のwrite contract

各PCはoffline時にもCommandを積めるのか。再接続時に、順序・base revision・conflictをどう解決するか。

### Q3. Resourceの最小schema

最初の `お金` nodeは、単一node、Resource scope、または外部canonical sourceへのbindingのどれとして始めるか。最低限必要なedge typeは `funds / allocates / consumes / earns / constrains` のどれか。

### Q4. OT backendの境界

OTをupstream dependencyとして使い続ける部分と、M3E connector側でcanonicalに持つ部分をどこで分けるか。外部OSSのstate語彙をM3Eの意味語彙へ直接流し込まないadapter境界が必要である。

### Q5. 一枚絵の有限slice

全てを同じgraphへ載せても、常時全てを表示してはattentionを浪費する。Intent / Execution / Organization / Runtime / Resource等のprojectionをどう切り替え、現在の判断frontierだけを前景化するか。

## Next Action

最初の実証単位は、複数人teamではなく**Akaghef所有の2台以上のPC + 常駐mac mini server**とする。

その上で、Agent管理sliceだけを先に閉じず、最低限次の三者を同一PJ graphで結ぶthin sliceを設計する。

```text
Goal / Task ── assignment ── Agent
     │                         │
     └──── resource-use ── お金 / machine
```

実装前に、authority、Command、event catch-up、Resource canonical ownerの4契約を確定する。

## Related

- [最遠の目標](../../.kiro/steering/farthest_goal.md) — RQ1 / RQ3 / RQ4 / RQ5 / RQ6
- [gyroid-eth/orrery-telemetry](https://github.com/gyroid-eth/orrery-telemetry) — 合併吸収対象となる外部OTの正本
- [ADR_011: Agent OrreryをM3Eのmapとして実装する](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md) — 外部OTの説明ではなく、M3E側の受入境界
- [Agent Mapping Pluginの境界](./260808_agent_mapping_plugin_boundary.md)
- [Neo4j-backed Team CollaborationとGraphLink](./260824_neo4j_team_collaboration_graphlink.md)
- [P2P Cloudflare snapshot sync](./260730_p2p_cloudflare_snapshot_sync.md)
- `V2` 人間とAIが構造的に対話できる作業場
- `V3` 世界モデルから成果物へ射影するcycle
- `V5` Map-Driven Development
- `S17` OT合併吸収を主戦場にする
- `S2` Team Collaborationの一般解は保留
- `S3` 保存・同期・復元の信頼性
