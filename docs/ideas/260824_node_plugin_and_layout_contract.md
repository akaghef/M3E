# Node plugin と layout 契約 — 設計会話ログ (2026-08-24)

[ADR_011](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md) の思想の出典。**会話ログであって決定ではない。** 要点は node core を最小に保つ、layout への契約は box size のみ（`Visual semantics ↛ Layout semantics`）、WebGL = 空間 / HTML = node UI、GraphLink は port 選択込みの route solver で解いて freeze。なお `renderNode` による viewer 内 capability plugin は ADR_011 D1 で**採用しなかった**。

- 原題: バックエンド接続設計
- **User:** Anonymous  
- **Created:** 8/24/2026 9:46:02  
**Updated:** 8/24/2026 10:14:53  
**Exported:** 8/26/2026 22:46:43  
**Link:** [https://chatgpt.com/g/g-p-69f33f7f8ed88191a18c8a3ef1d1f12c/c/6a8b9401-cf4c-83e8-85fd-0205eddfb629?src=history_search&messageId=32650fc1-7673-4361-b282-d9d45965e780&historySearchQuery=plugin](https://chatgpt.com/g/g-p-69f33f7f8ed88191a18c8a3ef1d1f12c/c/6a8b9401-cf4c-83e8-85fd-0205eddfb629?src=history_search&messageId=32650fc1-7673-4361-b282-d9d45965e780&historySearchQuery=plugin)  

## Prompt:
2026/8/24 9:45:57

今surface viewはsvgからwebGLに移行させてるが、それとは別に、nodeはメモリ上でオブジェクトとして管理してるから、agent orreryでagent監視システムと接続して、nodeに特定処理を挟む場合も、バック側で問題ない？

## Response:
2026/8/24 9:46:02

**English:** “Surface View is currently being migrated from SVG to WebGL. Separately, since nodes are managed as in-memory objects, can Agent Orrery connect to the agent monitoring system and insert specific processing around nodes entirely on the backend side?”

あかげふ、**基本的には問題ない。むしろその分離が正しい**。ただし一点だけ重要で、**「メモリ上の node object を backend が直接触る」設計にはしない**方がいい。

### AR: 境界

**AR1. WebGL化とはほぼ直交する**  
Surface View は最終的に

$$
\text{Domain State}\rightarrow\text{Layout/Projection}\rightarrow\text{WebGL Render}
$$

の最後の射影層。SVG→WebGL は renderer の交換なので、agent runtime や node 処理を renderer に依存させなければ影響しない。M3E自身も「実体は1つ、見え方は複数」「Surface View は View」としている。`TheDesign.md`

**AR2. Agent Orrery が触るべきなのは object ではなく node identity / event**  
例えば browser memory に

```text
MapNode {
  id
  text
  attributes
  ...
}
```

があっても、backend にその JS object reference を渡すのではなく、

$$
(nodeId,\ command,\ event,\ snapshot/version)
$$

を境界にする。

```text
                       ┌─ WebGL Surface
                       │
Node Domain Model ─────┼─ Inspector
       │               │
       │               └─ Agent Orrery
       │
       └─ Command / Domain Event
                 │
                 ▼
             Backend
          Agent Runtime
          Monitor / Trace
          Hook / Policy
```

つまり **Orrery も Surface View の一種**にかなり近い。違いは「構造を描く Surface」ではなく、**runtime state を node に重畳する operational projection**。

**AR3. 「nodeに処理を挟む」は command/event 層に挟むのが一番綺麗**  
たとえば、

$$
\texttt{nodeChanged}
\rightarrow
\texttt{agentHook}
\rightarrow
\texttt{runtime/action}
\rightarrow
\texttt{trace}
\rightarrow
\texttt{Orrery update}
$$

にする。

`onRenderNode()` のような renderer hook に agent logic を置くのは悪手。WebGL はフレームごとに何度も描画するので、domain semantics と一致しない。

### どこまで backend に置けるか

| 処理 | 置き場 |
|---|---|
| agent status / health / token / latency監視 | **Backend** |
| node変更をtriggerにagent起動 | **Backend / command-event層** |
| nodeへのagent assignment | **Backend/domain** |
| trace/checkpoint保存 | **Backend** |
| node status overlay生成 | Backend → frontend |
| hover / selection / drag preview | **Frontend** |
| WebGL hit-test / LOD / culling | **Frontend** |
| 60fpsで変わる視覚状態 | **Frontend** |

特に既存M3E設計でも `Authoring Map → GraphSpec → Runtime → Trace Store → Runtime Board` と分離していて、Runtime Board は Authoring Map を直接汚さない構造になっている。Agent Orrery はこの **Runtime Board の一般化**として置くのがかなり自然。`TheDesign.md`

### AR4. 唯一の注意

もし現在、

```text
browser memory の MapNode object
= 唯一の最新状態
```

なら、backendだけでは処理を挟めない。

この場合は、

```text
UI mutation
   ↓
Command
   ↓
Domain Model mutation
   ↓
Domain Event
   ├→ persistence
   ├→ agent runtime
   ├→ audit
   └→ renderer invalidation
```

まで引き上げればよい。

つまり設計上の本質は **WebGL化ではなく「node mutation の chokepoint を作ること」**。

これができていれば、Agent Orrery・監査・同期・AI自動処理・将来のpluginは全部同じ event stream にぶら下げられる。**Surface renderer と Agent runtime は互いを知らなくてよい**。

## Prompt:
2026/8/24 9:48:26

goal graph, agent orreryの定義を述べて

## Response:
2026/8/24 9:48:45

**English:** “Define Goal Graph and Agent Orrery.”

既存のM3E文脈での定義を揃えて、両者の境界が分かる形で述べます。

> **ゴールグラフとエージェント・オレリーの定義を整理**
>
> 
>
> **思い出しています**
>
>
> **思い出しGoal GraphとAgent Orreryの定義を整理しM3E議論と接続**
>
> 
>
> 25s考えました

**English:** “Define Goal Graph and Agent Orrery.”

あかげふ、M3E文脈ではこう切るのが最も明確です。

## DG: 定義

**DG1. Goal Graph**  
**PJが「なぜ存在し、何を達成し、そのために何をし、誰が担うか」を表す意味グラフ。**

中心は **intent / goal** で、

$$
\text{Why}
\rightarrow
\text{Goal}
\rightarrow
\text{Strategy / Objective}
\rightarrow
\text{Task}
$$

だけでなく、

$$
\text{Actor/Role}\rightarrow\text{Task}\rightarrow\text{Goal}
$$

を結ぶ。したがって単なるWBSでもGoal Treeでもなく、**Why-What-Who を一つのPJ意味空間として接続した graph**。TreeではなくGraph Viewになるのは、1つのTaskが複数Goalに寄与したり、Role・resource・dependencyが多対多になるため。既存議論でも goal decomposition / hierarchical planning が近いが、M3Eではそこへ責任主体や実行構造まで統合する。

**DG2. Agent Orrery**  
**実際に稼働しているagent群の runtime topology を観測・操作する運用盤。**

node は主に agent/session/resource、edge は

$$
\text{spawn, conversation, handoff, conflict, lock, wait}
$$

などを表す。running / standby / waiting / gone、context残量、current task、lock、resource queue、logs等を監視し、`exit / resume / replay / handoff` などの lifecycle 操作を行う。つまり「組織図」ではなく、**動いているagent networkそのものの observability + control surface**。`TheDesign.md` `TheDesign.md`

## DG3. 両者の関係

極端に圧縮すると、

$$
\boxed{\text{Goal Graph}=\text{何を・なぜ・誰がやるべきか}}
$$

$$
\boxed{\text{Agent Orrery}=\text{誰が今どう動いているか}}
$$

である。

したがって、

```text
Goal Graph
  Goal ─ Task ─ Role
             │
             │ realization / assignment
             ▼
Agent Orrery
  Actor ─ Session ─ Resource
```

という関係になる。

**Goal Graph = desired / semantic structure**、**Agent Orrery = actual / runtime structure**。ここを接続すると、M3E上で **Why → What → Who → Now** が連続して見える。

## Prompt:
2026/8/24 9:50:15

そう。basicなnodeにcore pluginとしてnodeに機能を持たせていく設計が良いと思うんよ

## Response:
2026/8/24 9:50:21

**English:** “Yes. I think the right design is to keep the basic node minimal, then add capabilities to nodes through core plugins.”

あかげふ、その方向がかなり良い。**Node を肥大化させるのではなく、Node を kernel object として固定し、機能を capability として積む**構造が自然。

## NP: Node Plugin Architecture

**NP1. Basic Node = identity + structure + content のみ**  
Core node は極力、

$$
N=(id,\ type,\ parent,\ children,\ content,\ attributes)
$$

程度に留める。`agentStatus` や `goal` や `runtime` を Node 本体のフィールドとして増殖させない。M3E の既存 Data Model でも Node は実体/参照、親子、scope 所属を中心に定義されているので、この kernel を安定させるのがよい。`TheDesign.md`

**NP2. Core Plugin = M3E が意味を保証する capability**  
例えば、

```text
Basic Node
 ├─ Structure Core
 ├─ Alias Core
 ├─ Goal Plugin
 ├─ Agent Plugin
 ├─ Runtime / Trace Plugin
 ├─ Reminder Plugin
 ├─ Resource Plugin
 └─ Component Plugin
```

という構造。

ここで重要なのは「plugin = UI 部品」ではないこと。むしろ、

$$
\text{Plugin}
=
\text{schema}
+\text{commands}
+\text{events}
+\text{projection}
+\text{optional runtime}
$$

くらいの単位。

**NP3. Goal Graph は Goal Plugin が有効な node 群の projection**  
例えば node に、

```text
goal:
  kind: goal | strategy | task | role
  status: ...
```

という capability を付与する。

すると Goal Graph は別DBではなく、

$$
\operatorname{GoalGraph}
=
\operatorname{project}_{goal}(N,E)
$$

として生成できる。

**NP4. Agent Orrery も同じ**  
Agent node なら、

```text
agent:
  runtimeId
  role
  state
  currentTask
  capabilities
```

Runtime plugin が、

```text
runtime:
  session
  latency
  tokenUsage
  locks
  trace
```

を提供する。

Agent Orrery は、

$$
\operatorname{Orrery}
=
\operatorname{project}_{agent,runtime}(N,E,\text{live state})
$$

になる。

つまり **Goal Graph と Agent Orreryを別アプリとして作る必要がない**。同じ node substrate に異なる capability と projection を掛ける。

---

特に強いのが、例えば一つの node が同時に

```text
Node: "Aerodynamics Agent"

Goal Plugin
  role = aerodynamic design

Agent Plugin
  actor = HA-17

Runtime Plugin
  state = running

Resource Plugin
  reads = aircraft ontology

Surface Plugin
  component = agent-card
```

を持てること。

するとその**同じ実体**が、

- Goal Graphでは「担当Role」
- Agent Orreryでは「running agent」
- System Viewでは「subsystem」
- 通常Treeでは「ただのnode」

として見える。

これはM3Eの既存原則 **「単一の実体、複数の見え方」**そのもの。`TheDesign.md`

さらに設計上は、

$$
\boxed{\text{Node Core} \neq \text{Feature}}
$$

$$
\boxed{\text{Node Core}+\sum \text{Capabilities}\rightarrow\text{Views / Behaviors}}
$$

と切っておくと、かなり綺麗になる。

一番避けたいのは `TreeNode` に `goalStatus`, `agentId`, `tokenUsage`, `reminder`, `runtimeState`, `componentType`……と全部直足しする設計。**Basic Node を substrate、core plugins を意味機能層、Surface View を projection 層**にすると、今のWebGL移行とも完全に噛み合う。

## Prompt:
2026/8/24 9:51:44

ただ、UI designはhtmlでラクに設計できたらいいよね　わざわざsvgで手書きすると壊れるし

## Response:
2026/8/24 9:51:51

**English:** “But it would be nice if the UI design could be done easily in HTML. Hand-writing it in SVG tends to break.”

あかげふ、そこは **WebGL + HTML overlay の二層構造**がかなり自然。

## UI: 推奨分離

**UI1. WebGL = 空間と大量描画**  
WebGL側はできるだけ primitive に限定する。

$$
\text{WebGL}:
\quad
\text{edges, background, selection area, minimap, massive nodes}
$$

つまり「グラフ空間を描くGPU」。

**UI2. HTML = 意味を持つUI component**  
Node plugin が提供するUIは普通のHTMLとして書く。

```text
Node
 ├─ basic appearance
 ├─ Goal Plugin
 │    └─ <GoalCard />
 ├─ Agent Plugin
 │    └─ <AgentStatus />
 └─ Runtime Plugin
      └─ <TracePanel />
```

HTMLなら `flex/grid/input/button/tooltip/context menu` が全部素直に使える。SVGでフォームや複雑なcardを手書きする理由はほぼない。

構造的には、

```text
┌──────────── HTML Overlay ─────────────┐
│  Node UI / Plugin UI / Editor / Menu │
│      ↑ screen-space projection       │
├──────────── WebGL Canvas ─────────────┤
│ nodes / edges / graph geometry       │
└───────────────────────────────────────┘
```

にする。

**UI3. Nodeの位置だけWebGL座標系からHTMLへ渡す**

$$
p_{\mathrm{screen}}
=
T_{\mathrm{camera}}\,p_{\mathrm{world}}
$$

を計算して、

```css
transform: translate(x, y);
```

でHTML nodeを配置する。WebGLとHTMLが同じ `camera transform` を共有すればよい。

---

### UI4. ただし全nodeをHTMLにするとまた死ぬ

ここだけ重要。

100〜数百 nodeならDOMでかなり余裕だが、数千〜万nodeで

```text
1 node = 1 complicated HTML subtree
```

をやるとWebGL化した意味が薄れる。

なので、

$$
\boxed{\text{WebGL base}+\text{DOM virtualization}}
$$

がよい。

例えば、

```text
far / tiny
    → WebGL primitive only

visible
    → simple WebGL + HTML label

selected / zoomed-in
    → full HTML Plugin UI
```

というLOD。

特に Agent Orrery なら、遠景では

```text
● running
○ idle
× error
```

だけWebGLで描き、近づくと

```text
Agent name
Task
Tokens
Latency
[Pause] [Inspect]
```

というHTML cardを出せばいい。

**UI5. Plugin APIもHTML componentを返す形にできる**

概念的には、

```ts
plugin.register({
  capability: "agent",
  renderNode: AgentNodeComponent,
  renderInspector: AgentInspector,
  renderOverlay: AgentRuntimeOverlay
})
```

くらいでよい。

これなら **Node Core → Plugin capability → HTML component** の流れが一直線になる。

既存M3Eの `registered component` も、「raw HTMLをnode dataに保存せず、登録済componentをnodeに割り当てる」という方向なので、この設計と非常に相性がいい。`TheDesign.md`

結論としては、**WebGLをUI frameworkにしない**ことだと思う。

$$
\boxed{
\text{WebGL = spatial rendering engine},\qquad
\text{HTML = application UI}
}
$$

この境界なら、Surface ViewをGPU化しつつ、Goal GraphやAgent OrreryのUIは普通のWeb開発として高速に作れる。

## Prompt:
2026/8/24 10:01:46

じゃぁgraph全体はwebGL計算しつつ、node単位はhtmlで設計が可能になって、かなりバグが起きにくそう

## Response:
2026/8/24 10:01:51

**English:** “So the graph as a whole can be computed/rendered with WebGL, while each node can be designed in HTML. That seems like it would reduce bugs a lot.”

あかげふ、その理解でかなり合ってる。**責務分離が強くなるので、壊れ方が局所化する**。

## UI: 何が良くなるか

**UI1. Graph全体はWebGL**  
担当するのは主に、

$$
\text{layout / camera / edge / culling / hit-test / LOD}
$$

つまり「大量の空間要素を高速に扱う」部分だけ。

**UI2. Node単位はHTML**  
担当するのは、

$$
\text{card / text / button / input / badge / plugin UI}
$$

なので、通常のDOM/CSSで設計できる。Agent Orrery のカードや Goal node の inspector も普通のHTML componentで済む。

**UI3. バグが減る本質**  
SVG時代だと、

```text
layout
+ geometry
+ text rendering
+ interaction
+ component UI
```

が全部同じ描画系に混ざりやすかった。

分離後は、

```text
Domain Node
   ↓
Layout Engine
   ↓
World Position
   ├─ WebGL: graph geometry
   └─ HTML: node component
```

になるので、**node UIを変えてもlayout algorithmを壊しにくいし、WebGL rendererを変えてもbutton/inputを壊しにくい**。

特にM3Eの「単一の実体、複数の見え方」という原則にも綺麗に一致する。node実体は一つで、WebGLとHTMLは別projectionとして扱える。`TheDesign.md`

## UI4. 残る主要リスク

完全にノーバグになるわけではなく、境界はほぼ一つに集約される。

$$
\boxed{\text{world coordinates} \leftrightarrow \text{screen DOM coordinates}}
$$

つまり camera transform、zoom、scroll、devicePixelRatio、resize の同期。

ここさえ `ViewportTransform` のような**単一SSOT**にすればかなり強い。

最終形はかなり単純で、

$$
\boxed{
\text{Node Core}
\rightarrow
\begin{cases}
\text{WebGL spatial projection}\\
\text{HTML semantic component}
\end{cases}
}
$$

となる。**SVGで全部を抱えていた時より、設計自由度も保守性もかなり上がる構成**だと思う。

## Prompt:
2026/8/24 10:10:08

nodeがlayoutに渡す契約はnode boxサイズだけで、あとはグラフトポロジーのデータからlayout確定し、ここの描画要素はその後の定義ロジックで描画される、って感じか

## Response:
2026/8/24 10:10:16

**English:** “So the contract a node passes to layout is basically only its node-box size; layout is then determined from the graph topology, and the individual visual elements are rendered afterward according to separate definition logic—is that the idea?”

あかげふ、**ほぼその理解でよい**。むしろその順序を明確に固定するとアーキテクチャがかなり綺麗になる。

## LA: 描画パイプライン

**LA1. Node → Layout の契約は最小化する**  
基本的には、

$$
\text{LayoutInput}(v)=\{id,\ box=(w,h)\}
$$

と graph topology、

$$
G=(V,E)
$$

だけ渡す。

Layout engine は、

$$
(G,\{w_v,h_v\},\text{SurfaceViewConfig})
\longrightarrow
\{x_v,y_v\}
$$

を計算する。つまり **node の中身が Goal なのか Agent なのか、HTML がどうなっているかを layout は知らない**。

**LA2. Layout の出力は geometry**  
結果は例えば、

```ts
{
  nodeId,
  x, y,
  width, height
}
```

だけ。そこから edge router が box geometry と topology を使って線を引く。

$$
\text{Topology}
\rightarrow
\text{Layout}
\rightarrow
\text{Geometry}
$$

ここまでが WebGL / layout 側。

**LA3. 描画内容はその後に決定する**  
各 node の実際の見た目は、

$$
(\text{node data},\text{plugins},\text{state},\text{geometry})
\rightarrow
\text{Node Component}
$$

で決める。

例えば同じ `(x,y,w,h)` に、

```text
basic node   → TitleCard
goal node    → GoalCard
agent node   → AgentCard
running agent→ AgentCard + runtime badge
```

をHTMLで載せる。

したがって全体は、

```text
Node data ───────┐
                 ├─ measure → box size ─┐
Graph topology ──┘                      │
                                       ▼
                              Layout Engine
                                       │
                              x, y, w, h
                                       │
                    ┌──────────────────┴──────────────┐
                    ▼                                 ▼
             WebGL geometry                    HTML component
             edges / background                node content / UI
```

となる。

## LA4. 重要なのは「HTML → box size」だけ逆流すること

唯一のフィードバックは、

$$
\text{HTML definition}\rightarrow(w,h)\rightarrow\text{Layout}
$$

だけ。

つまり、

$$
\boxed{\text{Visual semantics} \not\rightarrow \text{Layout semantics}}
$$

で、**サイズだけが境界を越える**。

これなら例えばAgent Orreryのcardにボタンを3つ増やしても、高さが `80 → 110 px` になるだけで、layout engine自体には変更不要。

ただし実装上は、HTMLを描いてから毎回実測すると `render → resize → relayout → render` の循環が起きうる。なので **plugin側がまず desired box size を返す**か、DOM実測するなら `ResizeObserver` でサイズ変更時だけ再layoutするのがよい。

## LA5. 例外は ports くらい

System Viewで

```text
[Agent]
 input ○     ○ output
```

のような明示portを持たせたくなった場合だけ、

$$
\{w,h,\text{anchors/ports}\}
$$

までlayout contractを拡張する余地がある。

ただし通常のTree / Goal Graph / Orreryなら、edge endpointはboxから自動導出できるので、**基本契約は box size だけで十分**。

要するに、

$$
\boxed{
\text{Node defines size and semantics;}
\quad
\text{Graph defines topology;}
\quad
\text{Layout defines geometry;}
\quad
\text{Renderer defines appearance.}
}
$$

と4層を完全分離する感じ。これなら新しいcore pluginを追加しても、原則としてlayout実装を触らずに済む。

## Prompt:
2026/8/24 10:13:32

graphlinkが重なってしまう挙動があって困るが、経路の座標を機械的に決定するのは困難なので、力学的に近似的に決定して固定するのはアリよね

## Response:
2026/8/24 10:13:38

**English:** “GraphLinks sometimes overlap, which is a problem. Since mechanically determining their route coordinates exactly is difficult, would it be reasonable to determine them approximately using a physics-based method and then freeze the resulting routes?”

あかげふ、**かなりアリ**。むしろ GraphLink routing は「閉形式で正解を出す」より、**制約付き最適化として近似解を求めて、その結果を固定する**方が自然。

## GR: 方針

**GR1. Node layout と Link routing を分離する**  
まず node box は既に確定しているとして、

$$
\{B_i\},\quad G_{\text{link}}
$$

を固定。その上で各 GraphLink の経路

$$
\gamma_e(s)
$$

だけを変数にする。

つまり node は動かさず、**edge の中間 control point だけを力学系で緩和**する。

**GR2. エネルギー関数で十分**  
例えば

$$
E=
\lambda_1 E_{\mathrm{length}}
+\lambda_2 E_{\mathrm{bend}}
+\lambda_3 E_{\mathrm{node\ collision}}
+\lambda_4 E_{\mathrm{edge\ overlap}}
$$

くらい。

- `length`: 無駄に長い経路を嫌う
- `bend`: 曲率を小さくする
- `node collision`: node boxから反発
- `edge overlap`: 他Linkから反発

最小化して、

$$
\gamma_e^\ast=\arg\min E
$$

がある程度収束したら**座標をfreeze**。

### GR3. 「力学で毎フレーム描画」はやらない

ここが重要。

```text
Topology / node box changed
        ↓
routing invalidated
        ↓
physics relaxation
        ↓
converged route
        ↓
freeze control points
        ↓
WebGL render only
```

にする。

常時計算すると、

- jitter
- CPU/GPU負荷
- 同じmapなのに毎回違う見た目
- linkを掴めない

が起きる。

なのでこれは **dynamic layoutではなく、route solver** と考えた方がいい。

## GR4. 保存するなら中間点

例えば、

```ts
GraphLink {
  sourceNodeId,
  targetNodeId,
  route: {
    mode: "solved",
    points: [
      {x, y},
      {x, y},
      ...
    ]
  }
}
```

としておけば、次回はsolver不要。

node移動やlayout変更時だけ、

$$
\text{route invalidation}
$$

して再計算すればよい。

ただし絶対座標より、

$$
p_k = p_{\text{source}} + \Delta p_k
$$

のような局所座標や、source-target座標系で持った方がnode移動に多少追従しやすい。

## GR5. さらに良いのは「粗い経路＋力学」

完全な自由曲線を力学だけで解くより、

1. node障害物を避ける粗いwaypoint生成
2. waypoint/control pointを力学緩和
3. spline化
4. freeze

が安定する。

つまり、

$$
\text{discrete routing}
\rightarrow
\text{continuous relaxation}
$$

の二段階。

これはかなり筋が良い。

**結論として、GraphLinkだけは layout engine から独立した「近似 routing solver」を持ち、結果を永続化する設計がよい。** Node layout は deterministic、GraphLink route は optimization-based、という非対称性は全く問題ない。

## Prompt:
2026/8/24 10:14:37

真逆のportからedgeが伸びて、カッコ悪い、ってケースがある。ここも力学なら記述がラクそう

## Response:
2026/8/24 10:14:40

**English:** “There are cases where an edge extends from a port on the exact opposite side, which looks bad. This also seems easier to express with a physics-based formulation.”

あかげふ、そう。ここは**幾何ルールを大量にif文で書くより、ポート選択そのものをエネルギー最小化に含める**とかなり綺麗。

## PE: Port-aware routing

**PE1. ポート方向の不自然さを penalty にする**  
source port の外向き法線を $n_s$、edge の初期接線を $t_s$ とすると、

$$
E_{\mathrm{port},s}
=
\lambda_p\left(1-\frac{n_s\cdot t_s}{\|t_s\|}\right)
$$

で、**port の外向き方向と edge が逆向きに出るほど高コスト**にできる。

target 側も同様に、

$$
E_{\mathrm{port},t}
=
\lambda_p\left(1-\frac{-n_t\cdot t_t}{\|t_t\|}\right)
$$

とすればいい。

**PE2. port自体も離散変数にしてよい**  
例えば矩形nodeに

$$
P=\{\mathrm{left,right,top,bottom}\}
$$

の4 portを持たせ、

$$
(p_s^\*,p_t^\*,\gamma^\*)
=
\arg\min_{p_s,p_t,\gamma} E
$$

とする。

すると solver が自然に、

- 相手が右側なら right port
- 下側なら bottom port
- 障害物があれば別port
- edge重複がひどければ多少遠回り

を選べる。

## PE3. 全体の energy

かなり素直に、

$$
E=
\lambda_lE_{\mathrm{length}}
+\lambda_bE_{\mathrm{bend}}
+\lambda_nE_{\mathrm{node}}
+\lambda_eE_{\mathrm{edge}}
+\lambda_pE_{\mathrm{port}}
$$

で済む。

「見た目がダサい」を、実際には

$$
\text{wrong departure direction}
$$

という局所幾何コストへ落とせるのが強い。

**PE4. 特に“真逆のport”は非常に強いpenaltyでよい**  
例えば source-target方向を

$$
d=\frac{x_t-x_s}{\|x_t-x_s\|}
$$

として、

$$
E_{\mathrm{port-choice}}
=
-\lambda_d\, n_p\cdot d
$$

を入れるだけでも、相手方向を向くportが優先される。

その後にrouting solverで障害物回避すればよい。

つまり、

$$
\boxed{\text{port selection} \rightarrow \text{route relaxation} \rightarrow \text{freeze}}
$$

という二段構成がかなり良い。

これなら「右に相手がいるのに左portから出る」みたいなケースを、個別ルールではなく**目的関数の一項**として処理できる。かなりM3E向き。



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)