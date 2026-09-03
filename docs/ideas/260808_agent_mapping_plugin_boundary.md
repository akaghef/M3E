# Agent Mapping Plugin の境界 — 設計会話ログ (2026-08-08)

[ADR_011](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md) の思想の出典。**会話ログであって決定ではない。** 決定は ADR_011 と [Decision_Pool 2026-08-27-001](../06_Operations/Decision_Pool.md) にある。要点は `scope owns binding, plugin owns realization`、Role / Actor Instance / Telemetry の3分割、plugin kernel の AC1〜AC5、attention routing、Why-What-Who-Now の typed edge 射影。

- 原題: M3E Agent Mapping Plugin
- **User:** Anonymous  
- **Created:** 8/8/2026 9:07:07  
**Updated:** 8/8/2026 9:13:16  
**Exported:** 8/27/2026 9:25:26  
**Link:** [https://chatgpt.com/g/g-p-69f33f7f8ed88191a18c8a3ef1d1f12c/c/6a7672e3-7314-83ee-942c-1e3c9e952b36?src=history_search&messageId=5156c73b-06b7-45b7-bc62-d9775863f049&historySearchQuery=orrery](https://chatgpt.com/g/g-p-69f33f7f8ed88191a18c8a3ef1d1f12c/c/6a7672e3-7314-83ee-942c-1e3c9e952b36?src=history_search&messageId=5156c73b-06b7-45b7-bc62-d9775863f049&historySearchQuery=orrery)  

## Prompt:
2026/8/8 9:07:00

もう少しこのへんを議論する。M3E pluginとして agent mappingを作る構成になりそう。

**English:** “Where should the unified interface for CRUD operations on running agents live in M3E? For now, I’m thinking each scope owns an executable file.”

あかげふ、**scopeに実行可能性を持たせる方向はかなり自然。ただし「実行ファイルそのもの」を持たせない方がよい**。

### RT: 配置案

**RT1. Scope = 永続的な役職・サービス境界**
scope 内に `Role / Contract / Skill / Capability / mailbox` を記述する。つまりここが **desired state**。M3E既存の `Contract Tree` も `input/output/reads/writes/failure/callable-ref` を持つ設計なので、そのまま使える。

**RT2. executable は** **`callable-ref`** **としてbindする**
例えば、

```
Literature Research
├─ Role
├─ Mailbox
├─ Capabilities
├─ MCP
└─ Runtime
    └─ callable-ref → hermes://profile/literature

```

あるいは `exec://...`, `codex://...`。つまり

[
\text{Scope}\not\supset\text{Executable},\qquad
\text{Scope}\xrightarrow{\text{bind}}\text{Executable Resource}
]

とする。実装ファイルをscopeに埋めると、HA/Codex/別runtimeへの差し替えが意味構造の変更になってしまう。

**RT3. 稼働agent CRUDのUIは Runtime Board**
`Create = instantiate`, `Read = inspect`, `Update = steer/rebind/restart`, `Delete = terminate`。これらは正本mapを書き換える操作ではなく、**現在のruntime instanceへの操作**だから、Authoring Mapではなく同一scopeの `Runtime Board surface` に出すのが既存設計と一致する。Runtime Boardはもともと current node / trace / error / resume 等の運用面として定義済み。

したがって構造は、

```
Scope / Role              ← 長寿命・正本
     │ callable-ref
     ▼
Runtime Adapter           ← HA / Codex / Claude ...
     │ instantiate
     ▼
Actor Instance            ← 短寿命
     │
     ├─ session
     ├─ mailbox state
     └─ trace

```

になる。

特に重要なのは、**Role CRUD と Actor CRUDを分けること**。`Delete Role` は組織再編だが、`Delete Actor` は退職・プロセス終了にすぎない。前者はAuthoring Map、後者はRuntime Board。

なので今の案を一段抽象化すると、

[
\boxed{\text{scope owns runtime contract, not runtime process}}
]

が一番綺麗だと思う。これならAgent Mapping Toolも「scope graphにruntime overlayを重ねるM3E Surface」としてそのまま吸収できる。

## Response:
2026/8/8 9:07:07

**English:** “I want to discuss this area a bit more. It looks like the agent-mapping feature will probably be implemented as an M3E plugin.”

> **設計境界を整理中**
>
> 「agent mapping」はM3Eのプラグインとして作る構成が自然です。ただし、地図そのものを独自ランタイムにせず、M3EのScope、Role、Capability、Contractを投影するSurfaceとして分離するのが重要です。
> 
> {AP: プラグイン境界}
> - AP1: AgentNodeから、不変メタデータと実行時状態を分離する
> - AP2: ランタイム状態は各アダプターから取得する
> - AP3: 地図は監視、操作、関係表示を担う
> - AP4: プラグインはSurface、Projection、Commandを提供する
> - AP5: M3E上の契約を、表示と操作の共通インターフェースにする
>
> **設計境界を整理した**
>
> 
>
> **M3EプラグインのAgent Mapping設計とMDD要件を確認**
>
> 
>
> 32s考えました

かなり筋が良い。むしろ **Agent Mapping を M3E 本体機能に昇格させるより、「M3E の構造・scope・surface・command を使って成立する plugin」にする方が、M3E の基盤性を証明できる**と思う。

### AP: Agent Mapping Plugin の境界

**AP1. plugin が所有するのは「agent domain の意味」と「runtime projection」**で、M3E core が所有するのは `scope / node / relation / surface / command / permission / plugin lifecycle` に留めるべき。

```text
M3E Core
├─ Scope / Node / Relation
├─ Surface
├─ Command
├─ Event / Subscription
└─ Plugin Host
       │
       ▼
Agent Mapping Plugin
├─ Role / Capability schema
├─ Actor projection
├─ Agent relation vocabulary
├─ Runtime adapters
└─ Agent Network Surface
```

既存設計でも Runtime Board は「runtime state を正本に混ぜない別 surface / overlay」と定義されているので、Agent Mapping はかなり素直にその特殊化になる。`TheDesign.md`

**AP2. 現在の Agent Orrery のデータモデルは、plugin 化すると分解した方がよい。** 今の `AgentNode` は `role`, `state`, `task`, `contextUsedRatio`, `heldLocks`, `canExit` 等を全部一体化している。これは standalone dashboard ならよいが、M3E 統合後は、

$$
\text{AgentNode}
\rightarrow
\underbrace{\text{Role/Contract}}_{\text{persistent}}
+
\underbrace{\text{Actor Instance}}_{\text{runtime}}
+
\underbrace{\text{Telemetry}}_{\text{ephemeral}}
$$

と割るべき。Agent Network Dashboard 自体も本来「静的組織図ではなく lifecycle operator UI」として設計されている。`TheDesign.md`

**AP3. scope が持つべきなのは plugin instance の binding。** 例えば概念的には、

```text
Literature Research [scope]
├─ Role
├─ Contract
├─ Capabilities
└─ plugin: agent-mapping
   └─ runtime-binding
      ├─ hermes://literature
      └─ codex://reviewer
```

ここで重要なのは、

$$
\boxed{\text{scope owns binding, plugin owns realization}}
$$

という境界。`scope` 自体に Hermes/Codex の実装知識を入れない。

### AR: Surface の構成

**AR1. Agent Mapping は単一画面ではなく、同じ対象に対する projection 群になる。**

```text
Agent Mapping Plugin
├─ Structure
│   Role / capability / responsibility
├─ Network
│   conversation / handoff / dependency
├─ Runtime
│   running / waiting / error / context
├─ Resource
│   file lock / browser / Zotero / DB
└─ Lifecycle
    spawn / resume / exit / replay
```

既存 Orrery の `network / lifecycle / resource / conflict / voice` という ViewMode は、そのままこの考え方に近い。`TheDesign.md`

ただし、**これらを別 map にしない**方がいい。同じ Actor/Role/Resource を違う関係集合・属性集合で見る projection とする。これは最近議論していた facet 的思想とも整合する。

### AC: M3E Core に必要になるもの

ここが実は重要で、Agent Mapping plugin を作ると **M3E の plugin kernel に何が不足しているかが露出する**。

**AC1. Surface registration** - plugin が独自 surface を追加できる。  
**AC2. Schema registration** - `Role`, `Actor`, `RuntimeBinding` 等を登録できる。  
**AC3. Command registration** - `spawn / steer / terminate / resume` を追加できる。  
**AC4. Event subscription** - runtime event を購読して overlay を更新できる。  
**AC5. Adapter registration** - Hermes / Codex / Claude 等を同一契約へ正規化する。

つまり Agent Mapping Tool を「M3Eに移植する」のではなく、

$$
\boxed{
\text{Agent Mapping}
=
\text{first serious consumer of M3E Plugin API}
}
$$

として作るのがよい。

これが成功すると、M3E は単なる mindmap application ではなく、**semantic application host** に一段上がる。Agent Mapping はその最初の「積まれるアプリ」になる、という整理が一番強いと思う。

## Prompt:
2026/8/8 9:10:28

[https://zenn.dev/mkj/articles/geminitask\_20260325](https://zenn.dev/mkj/articles/geminitask_20260325)
この思想がある。GUIアプリとして実現できたら勝ちよな

## Response:
2026/8/8 9:10:30

> **ウェブを検索中**
>
> [AI時代におけるタスク管理を考える](https://zenn.dev/mkj/articles/geminitask_20260325)
>
> **1件のウェブサイトを検索しました**
>
> 
>
> 10s考えました

**English:** “There’s this line of thought. If we can realize it as a GUI application, that would be a winning approach, right?”

うん。かなり核心を突いている。この記事の重要点は、**AI時代のタスク管理が「人間のToDo管理」から「agent群のcontrol plane」に変わる**というところにある。著者自身も、人間は実装詳細ではなく「各タスクの現在地と次に必要な判断」という**中間状態**を保持し、実行はAIへ委任する、と整理している。([Zenn](https://zenn.dev/mkj/articles/geminitask_20260325))

### AG: M3E Agent Mappingとの接続

**AG1. GUI化すべき本体はagentではなく「中間状態」**。今は上澄みの人間なら、

```text
Claude 1 → 調査中
Claude 2 → 出力済・レビュー待ち
Codex 3  → 修正中
Hermes   → 次指示待ち
```

を頭＋terminal tabsで保持できる。記事でもまさにこの状態管理を人間の仕事としている。([Zenn](https://zenn.dev/mkj/articles/geminitask_20260325)) しかしこれが Working Memory を食う。だからM3Eが

$$
\text{Human Working Memory}
\longrightarrow
\text{Persistent Spatial State}
$$

へ外在化すればいい。

**AG2. したがってAgent Mappingは「監視dashboard」では弱い。** 本当に欲しいのは、

$$
\boxed{\text{Agent Mapping}
=\text{Externalized Executive Function}}
$$

だと思う。つまり「誰が動いているか」だけではなく、`何を委任した / 今どこ / 人間判断が必要か / 次に誰へ渡すか` が空間的に保持され、そのnodeを触ること自体が `steer / approve / stop / delegate` になる。

**AG3. 記事の限界をGUIで破れる可能性がある。** 著者は、複数agentを監督していると「あっちは今どうなってたっけ」が発生し、監督自体が認知負荷になると書いている。([Zenn](https://zenn.dev/mkj/articles/geminitask_20260325)) これはagent数そのものの限界というより、

$$
\text{CW load}
\approx
\sum_i
\text{state}_i
+
\sum_{i,j}\text{dependency}_{ij}
+
\text{switching cost}
$$

を人間の頭で保持している限界と見る方がよい。**stateとdependencyをM3E graphが保持すれば、人間は「今判断すべきfrontier」だけ見ればよくなる。** ここは記事から一段先のM3E的帰結。

**AG4. だからAgent Mapping pluginのUX中心は「agent一覧」ではなく Attention Routing にすべき。**

```text
               M3E Agent Map
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
   running        waiting        NEED YOU
   自走中          外部待ち        判断必要
                                      │
                                      ▼
                                  Akaghef
                                      │
                           approve / steer / kill
```

通常は自走agentを薄くする。**人間へのattention edgeが立ったものだけ前景化する。** これなら以前話した「俺と全agentを常時edge接続すると煩わしいので、今会話する意思があるedgeだけ張る」という設計とも一致する。

そしてここが「GUIアプリとして勝ち」の条件だと思う。**CLI agentをGUIで並べるだけでは勝てない。人間が頭の中でやっている orchestration state を構造として外在化し、その構造自体を操作面にすること。**

上澄みは既にterminal 4枚＋記憶でこれをやっている。M3EはそこをGUI化して一般化するだけでなく、上澄みに対しても **3並列→10並列、さらに階層化されたagent組織**へ伸ばせる可能性がある。記事がいう「タスク管理＝AIを動かすインターフェース」([Zenn](https://zenn.dev/mkj/articles/geminitask_20260325)) を、M3Eならさらに **「graph＝AI組織そのもののcontrol surface」** まで押し進められる。

---

**Sources:**

- [AI時代におけるタスク管理を考える](https://zenn.dev/mkj/articles/geminitask_20260325)

## Prompt:
2026/8/8 9:11:59

さらに踏み込んで、PJのGOAも混ぜたマップにしたら結構 who, what, whyまでが見えてきそう。

## Response:
2026/8/8 9:12:19

> **GOAを構造化する**
>
> 私はGOAを「Why＝目標・目的」「What＝作業・成果物」「Who＝役割・担当者」の3層として整理するのがよさそうだと考えています。エージェント実行状態は別の投影として重ねると、意味とランタイムを混同せず、目的から担当者まで追跡できる設計になります。
>
> **GOAを構造化した**
>
> 
>
> **評価したGOAに基づくWho-What-WhyマッピングとPJ役割分担**
>
> 
>
> 18s考えました

**English:** “If we go further and mix the project’s GOA into the same map, it seems like we could make not only *who* and *what*, but also *why* visible.”

あかげふ、それはかなり本質的。**Agent Mapping を「agent管理」から「PJそのものの実行モデル」へ昇格できる。**

### PM: 3層を同じ graph に載せる

**PM1. Why = GOA**  
`Goal / Objective / Action` 系が、「なぜこの仕事が存在するか」を持つ。

**PM2. What = Work**  
Task、Deliverable、Decision、Issue、Artifact が「何をするか」を持つ。

**PM3. Who = Organization / Runtime**  
Role → Actor Instance が「誰が責任を持ち、今誰が実行しているか」を持つ。

すると単純には、

$$
\boxed{\text{Why}\rightarrow\text{What}\rightarrow\text{Who}}
$$

```text
Goal
  │ realized-by
  ▼
Objective
  │ decomposed-into
  ▼
Task ───────── assigned-to ────────► Role
  │                                  │
  │ depends-on                       │ occupied-by
  ▼                                  ▼
Task                              Actor
                                     │
                                     ▼
                                  Session
```

になる。

これができると、任意の稼働agentについて **「こいつ何のために動いてる？」を逆向きに辿れる**。

$$
Actor\to Role\to Task\to Objective\to Goal
$$

逆にGoalから見れば、

$$
Goal\to\{Tasks\}\to\{Roles\}\to\{Actors\}
$$

なので、**「この目標はいま誰がどこまで進めている？」**も一発で出る。

ここで既存M3EのPJ設計ともかなり噛み合っている。既に「PJはmap-firstで、facet骨格の上にtaskとreviewを成長させる」という方向になっている。`TheDesign.md` Agentをここへ載せれば、別のAgent Dashboardを眺める必要がなくなる。

### PA: ただし「全部を一つのtreeにする」は違う

重要なのは、**同じ map に置く ≠ 同じ hierarchy に押し込む**こと。

```text
PJ Semantic Graph
├─ Intent graph       Why
├─ Work graph         What
├─ Organization graph Who
├─ Runtime overlay    Now
└─ Resource graph     With what
```

これらをtyped edgeで接続し、Surface側で射影する。

つまり普段は、

`Strategy View` → Why中心  
`Execution View` → What中心  
`Agent View` → Who中心  
`Runtime View` → Now中心

と見る。しかし**実体graphは同じ**。

この構成だとAgent Mapping pluginは「agentだけを描くplugin」ですらなくなる。**PJ semantic graphに対して組織・runtimeの語彙とsurfaceを追加するplugin**になる。

そして一番面白いのは、GUI上で「説明可能な実行」が自然に成立すること。

> **Sonnet-3 が動いている → Task 42 を担当 → Objective B を満たすため → Goal『鳥コン機体完成』に寄与**

これを人間が文章で管理する必要がない。**graphそのものが who / what / why の provenance になる。**

たぶんここまで行くと、先の記事の「AIタスク管理GUI」より一段深い。**タスクを管理するGUIではなく、PJの意図構造と実行組織を同一モデル上で接続するGUI**になる。これならM3Eを使う必然性がかなり強くなる。

## Prompt:
2026/8/8 9:12:55

treeではなくこれはGraph viewとなりそう。

## Response:
2026/8/8 9:13:01

**English:** “Rather than a tree, this would probably become a Graph View.”

そう。**ここは Tree View では構造的に無理が出る。Graph View が本命**だと思う。

### GV: Graph Viewとしての整理

**GV1. Treeでは1つの分解原理しか主構造にできない。**  
例えば `Goal → Objective → Action → Task` は綺麗なtreeになるが、そこへ `Role / Actor / Resource / Dependency / Runtime` を混ぜると、同じTaskが複数軸に所属し始める。

$$
\text{Task}
\begin{cases}
\to \text{Objective} & \text{why}\\
\to \text{Role} & \text{who}\\
\to \text{Artifact} & \text{what output}\\
\to \text{Task} & \text{dependency}\\
\to \text{Actor} & \text{runtime assignment}
\end{cases}
$$

これはもう本質的に **typed graph**。

**GV2. ただしM3Eのownership treeを捨てる必要はない。** むしろ、

$$
\boxed{\text{Tree = ownership/spine},\qquad \text{Graph View = semantic projection}}
$$

とすると綺麗。

```text
PJ scope
├─ GOA
├─ Tasks
├─ Organization
├─ Resources
└─ Runtime
```

という正本上の整理は残しつつ、Graph Viewではそれらをscope境界を越えて接続する。

**GV3. Graph Viewで初めて who / what / why / now が同時に見える。**

```text
[Goal]
   │ why
   ▼
[Objective] ──realized-by──► [Task]
                                │
                   assigned-to │ produces
                                ▼
                             [Role] ──occupied-by──► [Actor]
                                │                       │
                                │                       └─state──► running
                                │
                                └─uses──► [Resource]
```

ここで node を選べば、例えばTaskについて、

- `why` → 上流GOA
- `who` → Role / Actor
- `what` → deliverable / task内容
- `when/now` → runtime state
- `blocked by` → dependency

が同時に出る。

**GV4. さらに重要なのは、Graph Viewの全edgeを常時表示しないこと。** 全部出すと即座にスパゲッティになる。したがってGraph View自体がfacet/projectionを持つ。

`Intent` → GOA edge中心  
`Execution` → Task dependency中心  
`Organization` → Role / Actor中心  
`Runtime` → session/state/attention中心  
`Full PJ` → 必要なedgeだけ合成

つまり、

$$
G_{\mathrm{view}}=(V,\ E_{\mathrm{selected}})
\subseteq G_{\mathrm{PJ}}
$$

という**edge-type射影**になる。

たぶんAgent Mapping pluginの完成形は「Agent Graph」より、**PJ Graph ViewにAgent/Runtime layerを追加するplugin**と考えた方が自然。Agentだけを主語にすると狭い。主語はあくまで **PJ** で、その中に `why / what / who / now` が共存する。これ、かなりM3EのGraph Viewのkiller use caseになりそう。



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)