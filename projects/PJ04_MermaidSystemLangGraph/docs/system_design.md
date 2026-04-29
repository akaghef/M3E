---
title: PJ04 — System Design (Canonical Master)
pj: PJ04
status: canonical
date: 2026-04-22
role: "このプロジェクトの単一入口。他の doc はすべてこの文書の appendix or deep dive。"
supersedes_nothing: 本書は上書きではなく **束ねるだけ**。各 deep dive doc は残す。
---

# PJ04 System Design — Canonical Master

> **TL;DR**: M3E は **LangGraph 系システムの協働 authoring 環境**。
> 人間が `subsystem` の `linear text` に **intent 散文**を書き、AI が protocol に沿って **contract tree** を生成、
> skeleton error は AI が auto-repair。**subsystem scope = 1 .py file** の粒度で Python へ emit。
> authoring 上は **L1 = system diagram / L2 = contract tree**、技術 stack は **Surface → Map → GraphSpec → Bridge → LangGraph**。
> **node = scope 統一** (I12)、**tree as protocol** (I15)、**linear text = polymorphic payload** (I24)。

---

## 0. Collaboration Stance (北極星)

**M3E は「LangGraph 系システムの協働 authoring 環境」**。
人間と AI が 1 つの map 上で concurrent に作業し、**全工程が M3E 内で完結する**ことが最上位目的。

### 0.1 7-step Workflow (linear-centric)

```
① Write Intent (人間)     scope の linear text に意図を散文で書く (markdown 可)
                          「Planner が計画を立て、Executor が実行、Verifier が検証、
                           fail したら Planner に戻る。messages channel を append」

② Build & Fill (AI)       linear text を読んで:
                          - Map 上に Outer (scope + edges、protocol 遵守) を生成
                          - Map 上に Inner (child scopes: prompt-text / channels-def / 子 tool ...) を生成
                          - 各 scope の linear text を kind 別 payload として埋める

③ Auto-repair (AI)        skeleton error があれば自動補修、diff を viewer に提示

④ Review (人間)           `[` で scope に入って Inner を確認、linear panel で payload を読む

⑤ Tune (人間)             意図ズレがあれば top-level linear text (intent) を直して ② に戻る
                          or 個別 scope の linear text を直接 micro-edit

⑥ Run (M3E)               compile → Bridge → LangGraph runtime、live-view が Inner にストリーム

⑦ Iterate                 実行結果を見て ① or ⑤ に戻る
```

**人間の時間配分**: ① Write Intent と ⑤ Tune で 90%+。③ ④ は AI 主導。

### 0.2 Write Modes (人間の作業優先度)

| 優先度 | 書き場所 | 書き方 | 書き手 |
|---|---|---|---|
| 高 | **top-level subsystem scope の linear text** (intent / 散文) | markdown / 自由文 | 人間 |
| 中 | **個別 scope の linear text** (payload: prompt / body / JSON ...) | micro-edit | 人間 |
| 低 | **Outer skeleton** (scope 追加・edge 追加) | box 操作 | 人間 (稀) |
| 自動 | skeleton error の auto-repair | — | AI |

### 0.3 帰結

- **Inner (scope の中身) が正式な authoring 場所** — AI が書く場所として命名される
- **node = scope 統一** (§1.2) — AI の書き込み先を一律に "scope の中" に
- **I9 (schema も map)** を堅持 — 外部 file を正本にすると M3E 内で完結しない
- **AI-fill は first-class operation** — 設計枠に入れる (実装は後で良い)

### 0.4 Authoring Layers (L1/L2)

本 PJ では、**authoring 上の見え方**として次の 2 段を使う。

| Layer | 正式名 | 役割 | 何が見えるか |
|---|---|---|---|
| **L1** | **system diagram** | system 全体の骨格を見る/描く | subsystem / agent を表す node、主要 edge、lane、全体構成 |
| **L2** | **contract tree** | 各 system node の内側の契約を読む/編集する | channels、prompt、tool、router、schema、module-header など |

**L1 の node は L2 contract tree への入口**。
`[` / `]` による出入りは、概観/詳細の切替であると同時に、**L1 system diagram ↔ L2 contract tree** の移動でもある。

この L1/L2 は **authoring の段**であり、後述の **技術 stack** (Surface / Map / GraphSpec / Bridge / LangGraph) とは別物である。

---

## 1. Glossary (用語正本)

本プロジェクトの**語彙正本**。他 doc の用語揺れはこの表で解消。

### 1.1 Map / Surface / Window

| 用語 | 意味 | 備考 |
|---|---|---|
| **map** | 1 知識単位。sqlite 1 レコード | 正本、唯一の persistent source of truth |
| **surface** | map の「何を描いているか」を決める図面 | `tree` / `system` の 2 種 |
| **system surface** | `flow-lr` の Mermaid ふう図 | LangGraph 実行対象 |
| **tree surface** | 従来の mind map | authoring 補助 |
| **window** | surface をどう見ているか | zoom / pan / selection / stance / 4 軸 |
| **scope** | subsystem 境界。1 scope ≒ 1 node (I12) | node = scope 統一 |
| **System Scope** | 1 つの実行可能 system / subsystem の境界 | 内部に Control Graph と State Contract を持つ |
| **subsystem** | Python file の所有者となる scope | map root 直下 or `m3e:kernel-subsystem=true` |
| **linear text** | scope 単位で 1 本、長文 payload | polymorphic: kind で意味が変わる (§1.7) |

### 1.2 Atoms — node = scope 統一 (I12)

**全 node は scope**。leaf / container の違いだけで同種。

#### scope kind (Map 上の identity)

| kind | 役割 | LangGraph 対応 | Python file? | 子を持つ? |
|---|---|---|---|---|
| **subsystem** | Python module の境界 | — | **所有者** | ✅ (agent / tool / router / sub-subsystem) |
| **agent** | prompt + LLM call + tools | callable (LLM 中心) | 中の 1 関数 | ✅ (tool / sub-agent / router / inline data) |
| **tool** | 決定的 Python 関数 | ToolNode 配下 | 中の 1 関数 | inline data のみ |
| **sub-agent** | 別 agent tree を埋め込み | subgraph | 中の 1 関数 | agent と同じ (recursive) |
| **router** | 条件分岐決定 | conditional route fn | 中の 1 関数 | inline data のみ |
| **entry** | `__start__` alias | sentinel | — | inline data のみ |
| **terminal** | `__end__` alias | sentinel | — | inline data のみ |

#### inline data node の kind (scope の中身、leaf)

| kind | 内容 (= linear text の payload) | 書き手 |
|---|---|---|
| **module-header** | subsystem file の module-level Python (imports / constants / shared helpers) | AI 初稿 → 人間微修正 |
| **prompt-text** | LLM prompt template | AI 初稿 → 人間微修正 |
| **schema-json** | tool の input/output schema (JSON text) | AI → 人間 |
| **channels-def** | scope 内 channel 宣言 (構造は child channel で表現、linear text は使わず) | AI → 人間 |
| **note** | 自由 prose | 人間 |
| **live-view** | 実行中の channel 値 (derived) | Bridge stream (read-only) |

**`source-view` は廃止**。
Python body は `agent` / `tool` / `router` の scope 自身の `linear text` に格納し、subsystem の module-level Python は `module-header` 子 scope に格納する。

### 1.3 Tree Schema per Atom Kind (protocol 正本、I15)

各 kind は**固定された tree shape**を持つ。compile / AI-fill / validation の単一参照点。

#### `subsystem` scope
```
🏛️ subsystem "PlannerSystem"    linear text = intent markdown (primary)
 ├─ 🧩 module-header              (optional, 1)    ← module-level Python (imports / constants)
 ├─ 🎞️ channels-def               (optional, 1)    ← State Schema 宣言
 ├─ 🌳 <agent scope>              (0+)             ← 子 agent
 ├─ 🔧 <tool scope>               (0+)             ← 子 tool
 ├─ ◇ <router scope>             (0+)             ← 子 router
 └─ 📝 <note inline>              (0+)             ← intent 以外の補足長文
```

#### `agent` scope
```
🌳 agent "planner"               linear text = function body (Python、省略時は compile が wrapper 自動生成)
 ├─ 📝 prompt-text                (required, 1)   ← LLM prompt
 ├─ 🧾 schema-json                (optional, 1)   ← structured output
 ├─ 📦 tools/                     (optional container) ← 下に tool scope
 ├─ 📦 sub-agents/                (optional container) ← 下に sub-agent scope
 └─ 📊 live-view                  (derived, 1)    ← runtime stream
```

**意図**:
- `agent` は、決定的 Python に落ちない**裁量付きの仕事**を first-class に持つ
- 典型形は **Claude supervisor** で、workflow の state を見て **sub-agent を handoff / review / escalate** する
- したがって `agent` の正本は prompt だけではなく、**input / output / allowed tools / handoff / escalation** を含む contract tree である

#### `tool` scope
```
🔧 tool "search"                 linear text = function body (Python、必須)
 ├─ 🧾 signature                  (required, 1)
 │   ├─ 🔹 param <name>            kind=param, attrs: type / default
 │   └─ ...
 ├─ 📝 description                (optional, 1)  ← LLM に見せる説明 (linear text でもよい)
 └─ 📊 live-view                  (derived, 1)
```

#### `router` scope
```
◇ router "validate"              linear text = function body (routing logic Python)
 └─ 📊 live-view                  (derived, 1)
```

**router の branch key 正本は scope 間 edge list** (I19 / I31)。`branches/` container は **sqlite に永続化せず、viewer が edge list から derive する virtual view** に限定する。compile は edge list を走査、Python annotation (`Literal[...]`) は optional な照合用にのみ使う。`"default"` edge ラベルは明示必須。

#### `channels-def` scope
```
🎞️ channels-def                  linear text 未使用 (構造は children で表現)
 ├─ 🎚️ channel <name>             kind=channel, attrs: reducer / reducerRef / typeHint
 └─ ...
```

#### `sub-agent` scope
→ `agent` と同じ schema (recursive)。

#### Supervisor / Sub-agent pattern

PJ04 の multi-agent 実行は、**Claude supervisor が workflow に沿って sub-agent を回す**形を基本パターンとする。

| 役割 | 意味 | 典型 responsibilities |
|---|---|---|
| **supervisor agent** | 現在 state を見て次の役割へ handoff する親 agent | route、retry、review、escalate、done 判定 |
| **sub-agent** | 局所責務を持つ子 agent | plan、execute、review、research、synthesize |
| **tool** | 決定的な関数 | search、calc、fs_read、validator |
| **human gate** | 人間の判断が必要な節 | approve、reject、rewrite、policy check |

最小構成の想定は次である。

```
Claude supervisor
 ├─ planner
 ├─ executor
 └─ reviewer
```

このとき supervisor は「全部を即興でやる agent」ではなく、**workflow contract に従って sub-agent をオーケストレーションする agent** として扱う。

#### `entry` / `terminal` scope
```
▶ entry  (or ■ terminal)         linear text = description (optional)
```

### 1.4 Edges / Relations

| 用語 | 意味 |
|---|---|
| **Control Graph** | System Scope 内の処理遷移。node / edge / router / fallback loop からなる LangGraph 側の graph 構造 |
| **relation** | node 間の意味関係 (`approve` / `reject` / `next` / ...) |
| **edge** | relation の描画表現 (線 + ラベル + 矢印) |
| **forward edge** | 主進行方向 (左→右) |
| **back edge** | 戻り / loop (上下 U-arch) |
| **static edge** | 無条件遷移 |
| **conditional edge** | router の branch key で分岐 |

**edge の正本 = Map 上の link (GraphLink)**。router scope の `branches/` container は authoring 便宜のための**同期的 shadow view** (compile は edge list を走査、branches は cross-check のみ)。

### 1.5 Data side

| 用語 | 意味 |
|---|---|
| **State Contract** | System Scope 内の data contract。State Schema / channel / reducer / Resource Binding を束ねる |
| **State Schema** | graph 全体の型定義 (TypedDict 相当) |
| **State Channel** | 名前付き data slot (`messages` / `plan` / ...)。旧称 channel |
| **channel** | State Channel の短縮表記 |
| **reducer** | channel の merge semantics (`replace` / `append` / `merge` / `messages` / `custom`) |
| **Resource Binding** | State Channel と file / artifact / map node / API resource などの実体を結びつける薄い参照 |
| **Resource Metadata** | Resource Binding が指す実体の `exists` / `freshness` / `valid` / `hash` / `updated_at` などの派生情報 |
| **Data View** | Resource Metadata を Runtime Board / panel に表示する view。独自の data state machine ではない |
| **checkpoint** | `{channel_values, channel_versions, parent, spec_identity}` の 1 snapshot。spec_identity = `{graph_spec_hash, map_snapshot_id, emitted_python_hash?}` |
| **thread** | checkpoint chain、`thread_id` で管理 |
| **resume** | checkpoint 時点の **old spec (freeze)** で続きを実行する (I2 と整合)。current spec で再実行したいときは **別操作 `replay-with-current`** を使う (I29) |
| **handoff** | supervisor が次の sub-agent へ制御と必要 state を渡す操作 |
| **escalation** | agent / sub-agent が human gate or 上位 supervisor に判断を戻す操作。payload は **summary + changed channels + optional full state** (I33) |

`reducer = "messages"` は LangGraph の `add_messages` へ bind される (Bridge layer が import)。型は `list[BaseMessage]` 相当として扱う。

#### Control Graph と State Contract の分離

System Scope には最低限、次の 2 つを分けて置く。

```text
System Scope
├─ Control Graph      # 何をどの順に実行するか
└─ State Contract     # 何の State Channel を読み書きするか
```

**Control Graph** は LangGraph の graph 構造そのもの。
**State Contract** は LangGraph の State / Channel / Reducer に Resource Binding を足したもの。

`Data Automaton` / `Data State Machine` という独自語は使わない。
data 側の変化は LangGraph の State Channel update と checkpoint で扱い、M3E は必要に応じて Data View を出すだけにする。

| 避ける語 | 正規語 |
|---|---|
| System Automaton | **Control Graph** |
| Data Automaton | **State Contract** |
| Data State | **State Channel** |
| File State | **Resource Metadata** |
| Data UI | **Data View** |

例: PJv34 Weekly Review

```text
Weekly Review System Scope
├─ Control Graph
│  ├─ Load Sources
│  ├─ Build Context
│  ├─ Generate Draft
│  ├─ Evaluate Draft
│  ├─ Fallback / Qn
│  └─ Write Outputs
│
└─ State Contract
   ├─ State Channel: sourceFolder
   ├─ State Channel: contextPackage
   ├─ State Channel: draftDocument
   ├─ State Channel: finalReport
   └─ State Channel: trace
```

### 1.6 Authoring Layers vs Technical Stack

用語の衝突を避けるため、authoring の L1/L2 と技術 stack は分けて扱う。

| 区分 | 名称 | 役割 |
|---|---|---|
| **authoring layer L1** | system diagram | system の骨格を描く |
| **authoring layer L2** | contract tree | node の内側の契約を持つ |
| **technical stack** | Surface / Map / GraphSpec / Bridge / LangGraph | 実装責務を分ける |

以降、本書では **L1/L2** と書いたときは authoring layers を指し、技術面は原則として **名前で呼ぶ**。

### 1.7 View 軸 (4 本 + 2 stance)

| 軸 | 値域 | 所有 |
|---|---|---|
| **構造軸** | parent-child / scope containment | Map |
| **遷移軸** | edge / relation | Map |
| **具象軸** | L0 (箱) → L1 (preview) → L2 (attr 要約) → L3 (signature) → L4 (source) → L5 (live state) | window state |
| **時間軸** | checkpoint chain を辿る | window state |

| stance | 値 | 効果 |
|---|---|---|
| **authoring** | 具象軸 L0-L1 固定、bridge 不要 | 骨格を書く |
| **inspection** | 具象軸 L2-L5 可、bridge 必要 | 読む / 覗く |

### 1.8 Linear Text Polymorphism (I24 核の定義)

**linear text は scope kind に応じて payload の意味が切り替わる polymorphic slot**。

| scope kind | linear text の payload |
|---|---|
| `subsystem` | **intent markdown** (人間の主 authoring 入力) |
| `agent` | **function body** (Python、通常は compile 生成で空、custom 時のみ書く) |
| `tool` | **function body** (Python、必須) |
| `router` | **function body** (routing logic Python) |
| `module-header` (inline) | **module-level Python** (imports / constants / shared helpers) |
| `prompt-text` (inline) | **prompt template** (LLM に渡す文字列本体) |
| `schema-json` (inline) | **JSON text** |
| `note` (inline) | **自由 prose** |
| `channels-def` (inline) | 不使用 (children で表現) |
| `entry` / `terminal` | 短い説明 (optional) |

**intent の置き場**:
- `subsystem` の主 intent は **subsystem 自身の `linear text`** に書く
- `m3e:intent` は **1-2 行の short summary** 用に使う
- 補足長文は `note` 子 scope に退避する

このため、`subsystem` だけは「人間が最初に書く主入力」として `linear text` を intent markdown に割り当てる。

### 1.9 属性 → tree position migration

現 `m3e:kernel-*` attribute の多くは tree 位置に畳める (I15 帰結):

| 旧 attribute | 新 tree position |
|---|---|
| `m3e:kernel-node-kind` | scope の kind (表示アイコン用に残す) |
| `m3e:kernel-callable-ref` | 不要 (scope id そのものが ref) |
| `m3e:kernel-router-ref` | router scope の linear text (body) で自己完結 |
| `m3e:kernel-channels` (JSON) | `channels-def` scope の child 群 |
| `m3e:kernel-reads` / `writes` | agent scope の optional `reads/` / `writes/` container |
| `m3e:kernel-subgraph-scope` | `sub-agents/` 下の sub-agent identity |
| `m3e:kernel-entry` | `entry` scope (kind) の位置 |

**段階移行**:
- **Phase A**: schema v1 定義、**既存 attribute は warn only で併存**
- **Phase B**: channels-def scope / linear text polymorphism 実装
- **Phase C 以降**: attribute 読みは deprecated、tree 正本へ

---

## 2. Technical Stack — **MLG stack (M3E-LangGraph)**

全体の正式名は **M3E-LangGraph technical stack**。以降の本書では **MLG stack** で呼ぶ。

**authoring 層の visibility 原則 (I27)**: user facing surface は **authoring layer (A1 Diagram + A2 Contract) のみ**。A3 以降 (Executable / Runtime) および T3 以降の technical layer はすべて implementation detail として扱い、authoring の主線から外す。人間の書き場は **M1/M2 相当 (intent + contract)** に集約し、compile / emit / bridge / runtime は「確認できる形で見える」だけで「編集対象」ではない。

MLG stack は **A 軸 (user facing) × T 軸 (technical)** の 2 軸で構成する。融合しない (I28 の matrix が正本)。

### 2.0 A 軸 — user facing layers

| A | user が見るもの | 支える T |
|---|---|---|
| **A1 Diagram** | node / edge / lane (system 骨格) | T1 + T2 |
| **A2 Contract** | prompt / channels / tools / router (node 内契約) | T2 |
| **A3 Executable contract** | GraphSpec + emitted Python preview (**read-only**、編集は A2 経由) | T3 + T4 + T5 |
| **A4 Runtime inspect** | state / trace / checkpoint / interrupt | T5 + T6 + T7 |

- **A1 ↔ A2** は `[` / `]` の drill-down (scope 詳細化)
- **A1 ↔ A2 ↔ A3** は **直交軸**。A1/A2 切替は別 shortcut or split view (drill-down とは独立)
- **A4 inspection 中は A3 を隣接サブ panel に表示** — 「今実行されているのはこの spec」を常に視界に置く
- **subsystem intent markdown は A1 側** (system diagram 上の subsystem 箱選択で読める)

### 2.1 T 軸 — technical layers (7 本)

| T | 名前 | 責務 | 実体 |
|---|---|---|---|
| **T1** | **Surface render** | 箱 + 線 + panel の描画、keybind / selection | `beta/src/browser/viewer.ts`, `viewer.css` |
| **T2** | **Map API + persistence** | authoring 正本。scope tree + attribute + linear text | `beta/data/*.sqlite` |
| **T3** | **Compile** (Map → GraphSpec) | derived JSON、毎回再生成、決定性 (I1) | `graph_spec_types.ts` / `graph_spec_compile.ts` |
| **T4** | **Emit** (GraphSpec → .py) | `runtime/registry/*.py` へ hash-gated emit | `registry_emitter.ts` |
| **T5** | **Bridge IPC** | Python subprocess + IPC | `runtime/bridge/bridge.py` / `registry.py` |
| **T6** | **Runtime (LangGraph)** | 本家 embed (自前実装しない) | `langgraph==1.1.8` |
| **T7** | **Checkpoint store** | LangGraph SqliteSaver + spec_identity 併存保存 | `langgraph.checkpoint.sqlite` |

> 旧 L1/L2/L3/L4/L5 呼称は T1 / T2 / T3+T4 / T5 / T6+T7 に対応。旧 stack 名 (Surface / Map / GraphSpec / Bridge / LangGraph) は T1-T6 の略記として残る。

```
┌─────────────────────────────────────────────┐
│  👤 USER  (intent / review / tune)           │
└─────────────────────────────────────────────┘
              ↕  authoring / inspection stance
┌─────────────────────────────────────────────┐
│  🎨 T1  Surface (viewer.ts)                  │
│     scope box + edges + panel                │
└─────────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────────┐
│  💾 T2  Map (sqlite、単一正本)                │
│     scope tree + linear text + attributes    │
│     "Outer" (骨格) と "Inner" (詳細) に分かれる │
└─────────────────────────────────────────────┘
              ↓  compileFromMap()
┌─────────────────────────────────────────────┐
│  📜 T3  GraphSpec (JSON、derived、毎回再生成) │
└─────────────────────────────────────────────┘
              ↓  stdin JSON / NDJSON
┌─────────────────────────────────────────────┐
│  🐍 T4  Bridge (Python subprocess)           │
│     bridge.py / registry.py / schema.py      │
│     IPCs: invoke / stream / update_state /   │
│          get_state_history / introspect /    │
│          fetch_source                        │
└─────────────────────────────────────────────┘
              ↓  Python API
┌─────────────────────────────────────────────┐
│  ⚙️  T5  LangGraph 1.1.8 (embed、本家)       │
│     StateGraph / Pregel / SqliteSaver /      │
│     ToolNode / Interrupt                     │
└─────────────────────────────────────────────┘
```

### 2.2 Outer / Inner (Map 内の組織構造、layer ではない)

**Outer** と **Inner** は**技術レイヤではなく Map の内部組織**。

| 概念 | 意味 | Map 上の実体 | Surface での挙動 |
|---|---|---|---|
| **Outer** | scope box の骨格 (kind / 配置 / edges) | scope の外形 + link | 箱として描画 |
| **Inner** | scope の中身 (child scopes + linear text + attributes) | scope の children + scope 自身の linear text | `[` で入ると Surface の panel / child surface |

**Outer / Inner 境界 = `[` / `]` 移動の境界 = 概観 / 詳細の境界 = 人間 / AI の主担当境界**。
authoring 上では、**L1 system diagram が Outer を見せ、L2 contract tree が Inner を見せる**。

### 2.3 Python file の単位 (subsystem = 1 .py)

**subsystem scope = Python module (.py file) の所有者** (I22)。

```
🏛️ subsystem "PlannerSystem"   ──→  runtime/registry/planner_system.py
   │  linear text: intent markdown
   │
   ├─ 🧩 module-header              ──→  imports / constants / shared helpers
   ├─ 🎞️ channels-def               ──→ (Python TypedDict として emit)
   ├─ 🌳 agent "planner"            ──→  def planner(state): ...  (linear text = body)
   ├─ 🌳 agent "verifier"           ──→  def verifier(state): ...
   ├─ 🔧 tool "search"              ──→  def search(query: str): ...
   └─ ◇ router "validate"          ──→  def validate(state): ...
```

### 2.4 Subsystem 境界を跨ぐ参照 (I23)

- **subsystem 内**: 同 file 内の function、直接呼び合える
- **subsystem 間**: 必ず registry の ref 経由 (`ref = "executor_system.runner"`)、Python の直接 import なし
- **external library** (LangGraph / Anthropic SDK): `site-packages/` にある通常の Python 依存、`requirements.txt` に pin

### 2.5 subsystem の判定

3 通りで subsystem が確定する:
1. **(default)** map root 直下の scope は自動で subsystem
2. **(override)** 任意 scope に attribute `m3e:kernel-subsystem=true` で明示
3. **(auto-decompose)** 1 subsystem file が 500 行超えたら viewer が `[decompose]` バッジ → 人間が (2) で sub-scope を昇格

### 2.6 Source-of-truth matrix (I28 正本)

各 artifact の **正本性・書く場所・編集可否・保存期間** を下記 matrix で固定する。

| 物件 | 正本性 | 書く場所 | 編集可? | 保存期間 |
|---|---|---|---|---|
| **Map** | canonical | sqlite (T2) | ✅ | 永続 |
| **GraphSpec** | derived | in-memory (T3) | ❌ | 実行中のみ (debug 時は `--dump-spec` で JSON 書き出し可、canonical ではない) |
| **generated Python** | emitted (Map hash-gated cache) | `runtime/registry/*.py` (T4) | ❌ (overwrite warn) | hash 一致時 skip |
| **checkpoint** | snapshot | LangGraph SqliteSaver (T7) | ❌ (`update_state` API 経由のみ) | thread 生存中 |
| **trace** | append-only log | NDJSON per session | ❌ (追記のみ) | session 単位 rotate |

checkpoint には `{graph_spec_hash, map_snapshot_id, emitted_python_hash?}` を併存保存する (I30)。「値本体より、何で作られた state かの識別」が time travel / resume の前提になる。

### 2.7 最大の判断まとめ

- **Surface と Map を分ける** — rendering と persistence を混ぜない
- **GraphSpec は derive、永続化しない** — Map こそが authoring 正本 (I9)
- **generated Python は hash-gated emit** — Map が動いていない時は再生成しない
- **checkpoint は spec_identity 併存** — time travel は old spec 正本 (I29)
- **LangGraph は本家丸投げ** — 自前再実装しない (feasibility 🔴)
- **我々が作るのは T1-T5 と T7 の wrapping**、特に Map schema (protocol 正本) と Bridge
- **subsystem = 1 .py** (I22) で Python と tree の粒度を揃える

---

## 3. Composition Model — agent tree + graph edges

### 3.1 木 (tree) と graph (edge) の二面

| 次元 | 何を表す | 例 |
|---|---|---|
| **木** (parent-child) | agent / subsystem の **内部 binding** | agent planner の子 = tool search / tool calc / sub-agent verifier |
| **graph** (edge) | scope 間の **routing** | planner → verifier (approve) / planner → end (reject) |

```
Authoring (tree):                Execution (graph):
  🏛️ PlannerSystem                ┌─ planner ─┐
   ├─ 🌳 planner                   │           ↓
   │   ├─ 🔧 search      ⇒          │       verifier ──(approve)──→ terminal
   │   └─ 🔧 calc                   │           ↓
   ├─ 🌳 verifier                  └── (reject) ←┘
   └─ ◇ validate
```

- **木は authoring 時の composition**: "agent に tool を足す" は parent-child で自然
- **graph は execution 時の routing**: "state 次第でどこに進む" は edge
- **両者は直交**: 同じ map が木としても graph としても読める

### 3.1.1 Supervisor orchestration

PJ04 では、agent tree の代表形として **supervisor → sub-agent 群** を強く想定する。

- 親 agent は Claude supervisor として振る舞う
- 子 agent は planner / executor / reviewer などの局所責務を持つ
- edge は **どの順で handoff するか** を表す
- interrupt / approval は **escalation 境界**として扱う

したがって、agent ノードの contract は「prompt がある」だけでは足りない。最低限、次を持つ必要がある。

| contract field | 意味 |
|---|---|
| **input channels** | 何を受け取って判断するか |
| **output schema** | 次ノードへ何を返すか |
| **allowed tools** | 何を呼んでよいか |
| **handoff targets** | 誰に渡せるか |
| **done / fail / escalate 条件** | どこで終わり、どこで戻すか |
| **human review required** | 人間の承認が必要か |

### 3.2 atom の子が持つ意味

| 親 atom | 子に置ける | 子の意味 |
|---|---|---|
| `subsystem` | agent / tool / sub-subsystem / router / channels-def / note | file 内 member |
| `agent` | tool / sub-agent / router / inline data | **binding** (agent の capability) |
| `sub-agent` | 同上 | 同上 (recursive) |
| `tool` | inline data (signature / description) | tool spec |
| `router` | inline data のみ (branches/ は derived view、sqlite に永続化しない) | routing metadata |
| `entry` / `terminal` | inline data のみ | sentinel description |

**I11**: agent 内の tree = binding、scope 間の edge = routing。兼用禁止。

---

## 4. 不変式 (一貫した状態の骨格)

| ID | 不変式 | 趣旨 |
|---|---|---|
| **I1** | compile 決定性 | 同 map snapshot → 同 GraphSpec |
| **I2** | 実行不可侵 | map 編集は実行中 thread に影響しない (compile 時 freeze) |
| **I3** | ref 一方向 | map は文字列 ref のみ、Python が解決 |
| **I4** | trace 非破壊 | trace は append-only、map に書き戻さない |
| **I5** | checkpoint 分離 | kernel checkpoint は PJ03 `CheckpointFile` と別 table |
| **I6** | 具象軸 volatile | concreteness level は window state、map に書かない |
| **I7** | introspect 無害 | `introspect_callable` / `fetch_source` は read-only |
| **I8** | data authoring minimal | channel 定義は scope 内、surface にはエラーのみ |
| **I9** | schema も map | State Schema は map の一部 (外部 Python file 正本にしない) |
| **I10** | 時間軸と具象軸の独立 | checkpoint timeline と L0-L5 は別コントロール |
| **I11** | tree と edge の役割分離 | agent 内の木は binding、scope 間の線は routing。兼用禁止 |
| **I12** | node = scope 統一 | 全 node は scope。leaf / container の違いだけ |
| **I13** | AI-fill は Inner 主、L1 は auto-repair 経由 | AI が自発的に Outer 構造を再構築しない。変更は linear text 起点 or error auto-repair のみ |
| **I14** | Python も map | user callable の Python 本体は `agent` / `tool` / `router` の `linear text` が正本、subsystem の module-level Python は `module-header` 子 scope が正本。registry の .py は compile 時 emit (build artifact)。bridge infra / external lib は対象外 |
| **I15** | tree as protocol | atom kind ごとの tree schema が正本。compile / AI-fill / validation はこの schema を単一参照点 |
| **I16** | schema versioning | tree schema に `SCHEMA_VERSION`、古い map は warn only |
| **I17** | AI skeleton integrity | skeleton error は AI が auto-repair。人間は意図修正に専念 |
| **I18** | linear text 所有 | linear text は scope 単位で 1 本。node ではなく scope が持つ |
| **I19** | edge が routing の正本 | router scope の `branches/` は cross-check 用 shadow。compile は edge list を走査 |
| **I20** | leaf scope は surface を持たない | tool / router / inline data は `[` で入っても child tree の panel 表示のみ。独立 surface なし |
| **I21** | (欠番) | — |
| **I22** | subsystem = Python file 単位 | subsystem scope が 1 .py file の所有者。子 scope の callable は function として同一 file 内に emit |
| **I23** | cross-subsystem via registry | subsystem 境界を跨ぐ参照は registry の ref 経由。Python の直接 import は subsystem 内のみ |
| **I24** | linear text polymorphism | linear text の payload 意味は scope kind で切り替わる (subsystem: intent markdown / callable: function body / module-header: module-level Python / inline: payload) |
| **I25** | intent summary と intent body を分ける | `subsystem` の主 intent は `linear text`、`m3e:intent` は 1-2 行 summary、補足長文は `note` 子 scope に退避 |
| **I26** | supervisor は contract-bound | Claude supervisor は sub-agent を自由放流せず、handoff / tool / escalation 契約に従って動く |
| **I27** | authoring layer visibility | user-visible surface は authoring layer (A1 Diagram + A2 Contract) のみ。A3 (Executable) は read-only preview、A4 (Runtime) は inspection 専用。T3 以降の technical layer は implementation detail |
| **I28** | source-of-truth matrix 固定 | §2.6 matrix が正本 (Map canonical / GraphSpec derived / Python emitted / checkpoint snapshot / trace append-only) |
| **I29** | time travel は old spec 正本 | resume は checkpoint 時点の spec (freeze) に従う。current spec で再実行は `replay-with-current` として別操作に分離。I2 と整合 |
| **I30** | checkpoint spec_identity 併存 | checkpoint には `graph_spec_hash + map_snapshot_id`、可能なら `emitted_python_hash` も併存保存。値本体より生成元の識別が重要 |
| **I31** | router branch key = edge list 正本 | edge list が branch key の単一正本。`"default"` edge ラベルは明示必須。branch key は state channel に直結必須ではない (router output として独立可)。Python annotation `Literal[...]` は optional 照合用 |
| **I32** | subgraph state = Phase A は shared only | Phase A では subgraph state isolation は **shared のみ**。isolated + input/output mapper は Phase C/D へ deferred (park ではなく時期指定) |
| **I33** | interrupt payload = summary + diff 中心 | interrupt / escalation payload は **summary + changed channels (+ optional full state)**。full dump を初期正本にしない。Phase D で詰める |

---

## 5. Authoring Minimalism (UI 原則)

**authoring と inspection は別の仕事**。混ぜると作成が止まる。

### 5.1 Surface に出してよい情報

| 種類 | 出す? | 例 |
|---|---|---|
| 骨格 | ✅ | 箱 / label / shape / edge / scope frame |
| kind icon | ✅ (L2 以上) | subsystem 🏛️ / agent 🌳 / tool 🔧 / router ◇ |
| **error バッジ (赤)** | ✅ (常時) | `unresolved ref` / `unknown channel` / `unreachable` / `router missing` |
| **warning バッジ (黄)** | ✅ (常時) | `write only` / `reducer custom, ref empty` / `[decompose]` (500 行超) |
| signature / source / live value | ❌ (box には出さない) | L3+ は panel へ |
| channels / reducers 定義 | ❌ (box には出さない) | panel の structured editor へ |

**原則**: **正の情報は panel、負の情報だけ surface**。

### 5.2 Panel のセクション

選択が `subsystem` scope:
- **Intent** (linear text が primary、markdown / 自由文)
- **Module Header** (`module-header` 子 scope。imports / constants / shared helpers)
- **Channels** (channels-def が子にあれば structured editor)
- **Interrupt Before / After** (Phase D)

選択が `agent` / `tool` / `router`:
- **Body** (linear text = function body)
- **Prompt / Schema / Tools** (agent のみ、対応する子 inline / child scope を編集)
- **Signature** (tool 時、child scope)
- **Recent trace** (live-view、active thread 時のみ)

選択が inline data (`prompt-text` / `schema-json` / `note`):
- **Payload** (linear text)

---

### 5.3 Contract Preview closedness (A3 の「確認できた」の定義)

A3 Executable contract preview が「確認できた」(closed) とは、下記を **すべて** 満たす状態を言う。

1. 必須項目が埋まっている
2. **🔴 バッジが 0**
3. compile (T3) 成功
4. A3 preview (GraphSpec + emitted Python) が生成できる

**「実行 1 回通過」は stronger condition** として別扱い。closedness の基本定義には含めない (run は Phase C 以降の別ゲート)。

### 5.4 Data violation badge taxonomy (意味ベース 2 色)

surface のバッジ分類は、**色 = 意味判断の重さ** で決める。

| 色 | 意味 | 直し方 | 発火 | 例 |
|---|---|---|---|---|
| 🟡 | 構造・宣言の補完 / 正規化で直せる | R3-a 自動候補 (auto-repair) | AI 即時 | missing container、reducer 未指定、`reads/` 省略 (= "全 channel 可読") warn |
| 🔴 | 意味判断 / 本文生成 / 実装と宣言の乖離 | R3-b 提案型 fill (linear text 生成を伴う意味修正) | **人間発火必須** | `writes/` 未宣言、`writes/` 宣言と function body return の不一致、prompt 欠落 |

`writes/ declared but function body returns different keys` のような **宣言と実装の乖離は基本 🔴**。

### 5.5 A4 Runtime Inspect — 3 pane / tabs

A4 runtime inspect は次の 3 要素を **1 window 内で 3 pane (or tabs)** として統一表示する (具体 UI は構造決定より後)。

- **timeline** (checkpoint chain、時間軸)
- **current state** (channel 値の live snapshot)
- **trace** (append-only log)

A4 inspection 中は、隣接サブ panel として **A3 preview を常時可視** に保つ (今の state が "どの spec で作られたか" を失わない)。

---

## 6. Phase 分割

### 6.1 実行 (LangGraph 取り込み系)

| Phase | 狙い | deliverable 要約 |
|---|---|---|
| **A** | Contract freeze | GraphSpec v0.1 pin、vitest、schema v1 定義、attribute spec 穴埋め |
| **B** | Bridge MVP | `bridge.py` / `registry.py` / TS client、invoke 往復、`introspect` / `fetch_source`、subsystem → .py emit |
| **C** | Streaming + Checkpoint | stream 4 mode、thread 再開、live-view overlay、viewer highlight |
| **D** | Interrupt + Time Travel | `interrupt_before/after`、approval UI、`update_state` fork、checkpoint timeline bar |
| **E** | Tool / LLM (Anthropic 1 本) | `ToolNode` + `bind_tools`、ReAct agent sample |
| **F** | Observability + Hardening | NDJSON ring buffer、OTel、crash recovery |

### 6.2 View 拡張 (具象軸系)

| Task | 狙い | 依存 |
|---|---|---|
| **T-CX-0** | L2 (attr 要約: kind icon のみ) | 独立、bridge 不要 |
| **T-CX-1** | L3 (signature) | Phase B |
| **T-CX-2** | L4 (source、panel で表示) | T-CX-1 |
| **T-CX-3** | L5 (live state) | Phase C |
| **T-CX-4** | per-node override (`o` / `shift-o`) | T-CX-1 |

### 6.3 Layout + Multi-Root (並行)

| Task | 狙い |
|---|---|
| **T-LAY-1...6** | lane-role / anchor / engine 導入判定 (詳細は [layout_strategy.md](layout_strategy.md)) |

---

## 7. 着手順 (immediate)

1. **T-A-1 Contract Freeze** (Phase A、1-3 日、bridge 不要)
   - GraphSpec v0.1 pin
   - schema v1 定義 (tree schema per kind)
   - vitest 3 ケース (linear / conditional / subgraph scope)
   - attribute spec 穴埋め (subgraph channel 継承、conditional default branch、entry semantics)
2. **T-CX-0 L2 要約** (並行、1-2 日、bridge 不要)
   - kind icon のみ (channels badge / ref tag は panel へ)

両者独立、衝突ファイル無し、並行可。Phase B-F と CX-1-4 は Phase A 通過後。

---

## 8. 未決 (E 候補)

### 8.1 Active (解決 target あり)

| ID | 問い | 現時点の推奨 |
|---|---|---|
| Q1 | Python venv 配置 | PJ04 配下 (`runtime/bridge/`) |
| Q2 | registry 配置 | PJ04 配下 (`runtime/registry/`) |
| Q4 | interrupt UI token | Phase D 時点で決める (payload 方針は I33 で固定済) |
| Q6 | channel 名命名 | `ascii_lower_snake` |
| Q8 | channel editor type hint | 列挙 + `custom` free string |
| Q9 | atom に `agent` を追加するか | **採用** (本書 §1.2) |
| Q10 | linear text polymorphism (I24) 採用するか | **採用** (β 案、本書 §1.8) |
| Q11 | subsystem 境界の判定 | default = root 直下 + `m3e:kernel-subsystem` override (本書 §2.5) |
| Q12 | edge vs router branches の正本 | **edge が正本** (I19 / I31)、branches は derived view |
| Q13 | leaf scope の surface | **持たない** (I20) |
| Q15 | AI-fill invocation 方法 | 明示コマンド / linear text save hook、Phase B で決める |

### 8.2 Park (時期を決めて凍結)

| ID | 問い | 扱い |
|---|---|---|
| Q-Park-1 | concreteness axis L0-L5 の名前衝突 (stack T1-T7 との記法ズレ) | **完全 park** (Q6-A)。今回セッションでは解かない |
| Q-Park-2 | provenance 粒度 (scope 単位 / linear text 単位 / channel schema history) | **当面 scope 単位** の `m3e:provenance` のみ。log 用途に限定。linear text 単位 / channel 粒度は必要が出てから |
| Q-Park-3 | subgraph isolated mode + input/output mapper | **Phase C/D へ deferred** (park ではなく時期指定、I32) |
| Q-Park-4 | interrupt UI full state 表示 | Phase D で詰める (summary + diff を初期正本、I33) |

### 8.3 解消済 (本文反映、行削除)

- ~~Q3 trace 保存~~ → I28 matrix で NDJSON append-only 固定
- ~~Q5 `add_messages`~~ → `reducer = "messages"` 追加で解決
- ~~Q7 subgraph state isolation~~ → I32 で Phase A shared only 確定
- ~~Q14 channels migration~~ → `m3e:kernel-channels` は clean cut (legacy read せず、`channels-def` 子 scope のみ canonical)
- ~~Q16 provenance 属性~~ → Q-Park-2 に park

---

## 9. 非目標 (やらない)

- TS で LangGraph を再実装 (feasibility 🔴、XL 工数、embed で十分)
- Pregel super-step 自前実装 / pending writes 完全互換 / LangSmith 完全互換
- 既存 PJ03 `workflow_reducer.ts` / `graph_runtime.ts` / 17 `ALLOWED_EDGES` の書き換え
- data channel を surface に lane として描く (authoring minimalism 違反)
- State Schema を外部 Python file 正本にする (I9 違反)
- authoring surface に L3+ 情報 (signature / source / live) を直接描く (I6 + minimalism 違反)
- linear text を node ごとに持つ (scope per 1 本が I18 の正本)
- router の branches/ から compile する (edge が正本、I19 / I31)
- `m3e:kernel-channels` attribute を canonical として読む (clean cut、`channels-def` 子 scope のみ canonical)
- A3 (GraphSpec / Python preview) を直接編集させる (A3 は read-only、編集は A2 経由、I27)
- checkpoint resume で **current spec** を適用する (resume = old spec 正本、current spec 実行は `replay-with-current`、I29)

---

## 10. Deep Dive References

本書で概要を押さえれば、以下は必要時だけ読めば OK。

| ファイル | 扱う範囲 |
|---|---|
| [langgraph_integration_plan.md](langgraph_integration_plan.md) | Phase A-F の IPC / spec / 出口条件の詳細 |
| [langgraph_feasibility.md](langgraph_feasibility.md) | 機能ごとの 🟢🟡🔴 評価 (なぜ embed を採ったか) |
| [concreteness_axis.md](concreteness_axis.md) | L0-L5 の data source / rendering / IPC 詳細 |
| [state_and_channels.md](state_and_channels.md) | data 側 D1-D4、赤/黄バッジカタログ、panel 仕様 |
| [map_attribute_spec.md](map_attribute_spec.md) | `m3e:kernel-*` 属性の契約 (段階的に schema v1 正本へ移行) |
| [layout_strategy.md](layout_strategy.md) | layout engine / multi-root / lane-role の戦略 |
| [system_diagram_map_model.md](system_diagram_map_model.md) | map model の理論定義 |
| [render_target_definition.md](render_target_definition.md) | 用語定義の最初の固定 (Phase 1) |
| [merge_strategy.md](merge_strategy.md) | PJ 終了後の本体 merge 順序 |
| [idea/langgraph_full_feature_reproduction.md](../idea/langgraph_full_feature_reproduction.md) | **保留案** (TS 全再実装、採用しない) |

---

## 11. 1 文要約

> authoring 上は **A1 Diagram / A2 Contract**、その下に read-only の **A3 Executable / A4 Runtime**。
> 技術面は **MLG stack** (T1 Surface → T2 Map → T3 Compile → T4 Emit → T5 Bridge → T6 LangGraph → T7 Checkpoint)。
> Map は **Outer (骨格) と Inner (詳細)** に分かれ、**subsystem scope = 1 .py file** の粒度で Python emit。
> 人間は **top-level subsystem の linear text に意図を散文で書く**、AI が protocol に沿って tree を生成、skeleton error は auto-repair。
> **node = scope 統一 (I12)**、**tree as protocol (I15)**、**linear text polymorphism (I24)**、**authoring visibility (I27)**、**source-of-truth matrix (I28)** を核とし、time travel は **old spec 正本 (I29)**、checkpoint は **spec_identity 併存 (I30)**、router branch は **edge list 正本 (I31)**。
> **A4 層 + T7 層 + 4 axis + 33 不変式 + 7-step workflow** が骨格。
