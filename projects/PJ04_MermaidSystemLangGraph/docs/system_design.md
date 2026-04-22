---
title: PJ04 — System Design (Canonical Master)
pj: PJ04
status: canonical
date: 2026-04-22
role: "このプロジェクトの単一入口。他の doc はすべてこの文書の appendix or deep dive。"
supersedes_nothing: 本書は上書きではなく **束ねるだけ**。各 deep dive doc は残す。
---

# PJ04 System Design — Canonical Master

## 0. Collaboration Stance (北極星)

**M3E は「LangGraph 系システムの協働 authoring 環境」**。
人間と AI が 1 つの map 上で concurrent に作業し、**全工程が M3E 内で完結する**ことが最上位目的。

### 6-step Workflow

```
① Sketch (人間)      L1 Outer に概観を描く:
                     agent 名 + 主要 edge (「Planner → Executor → Verifier、fail で retry」)

② Fill (AI)          L2 Inner に詳細を生成:
                     prompt-text / source-view / schema-json / channels-def / 子 tool

③ Review (人間)      [ で scope に入って L2 を確認 (意図合致、tool 選択、channel 漏れ)

④ Tune (人間)        L2 の inline data node を直接編集
                     or 「この agent の prompt を厳密化」で AI に局所再生成

⑤ Run (M3E)          compile → L4 Bridge → L5 Runtime、
                     live-view が L2 にストリームされる

⑥ Iterate            ④ に戻る (or ① に戻って骨格修正)
```

### この workflow が要求する設計

| 要請 | どこで満たす |
|---|---|
| 概観 / 詳細の 2 段 | **L1 (Outer) / L2 (Inner) の分離** |
| AI が詳細を書く | **AI-fill コマンド** + 書き込み先 = L2 inline data node |
| 人間が確認する | `[` で scope に入り L2 を読む |
| 人間が微修正する | L2 inline data node を直接編集可能 |
| 実行結果の取り込み | L5 stream → L2 の `live-view` に反映 |
| provenance | 属性 `m3e:provenance` で AI-generated / human-edited を区別 |

### 帰結 (この stance が強制すること)

- **L2 が正式レイヤー** (substrate ではない) — AI が書く場所として命名される必要がある
- **node = scope 統一** (後述 §3) — AI の書き込み先を一律に "scope の中" に置くため
- **I9 (schema も map)** を堅持 — 外部 file を正本にすると M3E 内で完結しない
- **AI-fill は first-class operation** — 設計枠に入れる (実装は後で構わない)

---

> **TL;DR**: M3E は **LangGraph 系システムの協働 authoring 環境**。
> 人間が **L1 Outer (骨格)** を描き、AI が **L2 Inner (詳細)** を埋め、人間が確認・微修正し、M3E 内で実行まで完結する。
> L1+L2 → L3 Spec → L4 Bridge → L5 Runtime の 5 層で、**node = scope 統一**、
> **atom は kind で識別される scope** (agent / tool / sub-agent / router / entry / terminal)。
> **authoring は骨格だけ、詳細は L2 に格納、surface にはエラーだけ**。

---

## 1. Glossary (用語正本)

以下が本プロジェクト全体の**語彙正本**。他 doc の用語揺れはこの表で解消する。

### 1.1 Map / Surface / Window

| 用語 | 意味 | 備考 |
|---|---|---|
| **map** | 1 知識単位。sqlite の単一レコード | 正本、唯一の persistent source of truth |
| **surface** | map の「何を描いているか」を決める図面 | `tree` / `system` の 2 種 |
| **system surface** | `flow-lr` の Mermaid ふう図 | LangGraph 実行対象 |
| **tree surface** | 従来の mind map | authoring 補助 |
| **window** | surface を**どう見ているか** | zoom / pan / selection / stance / 4 軸 |
| **scope** | subsystem の内部図。1 scope ≒ 1 subgraph | LangGraph の subgraph と対応 |
| **scope node** | 下位 scope を持つ node (旧 `portal`) | `[` / `]` で出入り |
| **entity node** | 下位 scope を持たない通常 node | leaf |

### 1.2 Atoms — **node = scope 統一 (採用)**

**(c) 全 node = scope** を採用。leaf / container の違いだけで同種。

#### L1 Outer に並ぶ scope の kind

| kind | 役割 | LangGraph 対応 | 子に置けるもの |
|---|---|---|---|
| **agent** | prompt + LLM call + tools binding | callable (LLM 中心) | tool / sub-agent / router + L2 inline data |
| **tool** | 決定的 Python 関数 | ToolNode 配下 | L2 inline data のみ |
| **sub-agent** | 別 agent tree を埋め込み | subgraph | agent と同じ (recursive) |
| **router** | 条件分岐決定 | conditional route fn | L2 inline data のみ |
| **entry** | `__start__` alias | — | L2 inline data のみ |
| **terminal** | `__end__` alias | — | L2 inline data のみ |

#### L2 Inner に並ぶ inline data node の kind

scope の中に置ける情報コンテナ。map に persist される (I9)。

| kind | 内容 | 書き手 | authoring/derived |
|---|---|---|---|
| **prompt-text** | LLM prompt template | AI 初稿 → 人間微修正 | authoring |
| **schema-json** | tool の input/output schema | AI → 人間 | authoring |
| **channels-def** | scope 内で使う channel 宣言 | AI → 人間 | authoring |
| **note** | 自由メモ | 人間 | authoring |
| **source-view** | Python 関数本体 | Bridge 経由で fetch | derived |
| **live-view** | 実行中の channel 値 (最新) | Bridge stream | derived |

**reducer** は inline data には現れない — channels-def の中で ref string として参照されるのみ (実体は registry)。

**核の判断**: atom = **agent scope** が first-class。「意味ある 1 行」は `agent(prompt, tools)` の粒度。L2 Inner に入ると prompt / source / live / 子 tool が見える。

### 1.3 Edges / Relations

| 用語 | 意味 |
|---|---|
| **relation** | node 間の意味関係 (`approve` / `reject` / `next` / ...) |
| **edge** | relation の描画表現 (線 + ラベル + 矢印) |
| **forward edge** | 主進行方向 (左→右) |
| **back edge** | 戻り / loop (上下に逃がして U-arch) |
| **static edge** | 無条件遷移 |
| **conditional edge** | router の branch key で分岐 |

### 1.4 Data side

| 用語 | 意味 |
|---|---|
| **State Schema** | graph 全体の型定義 (TypedDict 相当) |
| **channel** | 名前付き data slot (`messages` / `plan` / ...) |
| **reducer** | channel の merge semantics (`replace` / `append` / `merge` / `custom`) |
| **checkpoint** | `{channel_values, channel_versions, parent}` の 1 snapshot |
| **thread** | checkpoint chain。`thread_id` で管理 |

### 1.5 View 軸 (4 本 + 2 stance)

| 軸 | 値域 | 所有 |
|---|---|---|
| **構造軸** | parent-child / scope containment | map |
| **遷移軸** | edge / relation | map |
| **具象軸** | L0 (箱) → L1 (preview) → L2 (attr 要約) → L3 (signature) → L4 (source) → L5 (live state) | **window state** |
| **時間軸** | checkpoint chain を辿る | **window state** |

| stance | 値 | 効果 |
|---|---|---|
| **authoring** | L0-L1 固定、bridge 不要、panel 軽量 | 骨格を書く |
| **inspection** | L2-L5 可、bridge 必要、panel 詳細 | 読む / 覗く |

---

## 2. Architecture Layers — **M3E-LangGraph stack** (5 層)

全体呼称: **M3E-LangGraph stack**。各層の呼称は固定 (他 doc / コメント / 会話全てで統一):

| L | 名前 | 1 行説明 | 書き手 |
|---|---|---|---|
| L1 | **Outer** | scope box + edges (surface 外観) | **人間** (骨格) |
| L2 | **Inner** | scope contents (prompt / source / schema / live / channels-def / 子 scope) | **AI** (詳細)、人間が微修正 |
| L3 | **Spec** | derived JSON (GraphSpec v0.1) — L1+L2 から compile | — (derived) |
| L4 | **Bridge** | Python subprocess / IPC | 開発者 |
| L5 | **Runtime** | LangGraph 1.1.8 (embed) | 本家 |

**sqlite Map** は L1/L2 の persistence substrate。設計会話では名指さない (必要時は "storage substrate" と呼ぶ)。

**L1/L2 の境界 = 概観/詳細の境界 = 人間/AI の担当境界 = `[` / `]` 移動の境界**。全部が同じ線で揃う。


```
┌──────────────────────────────────────────────────────────────────┐
│  👤 USER (authoring intent)  +  🤖 AI (fill-in)                  │
└──────────────────────────────────────────────────────────────────┘
              ▲   │
      4 axes  │   │  stance: authoring / inspection
              │   ▼
┌──────────────────────────────────────────────────────────────────┐
│  🖼️ L1 — Outer  (scope boxes + edges、surface 外観)                │
│    人間が骨格を描く: agent 名 / kind / 配置 / routing 接続          │
│    rule: box = 骨格 + 負の情報 (赤/黄バッジ) のみ                 │
│    atoms 配置: agent / tool / sub-agent / router / entry/terminal │
└──────────────────────────────────────────────────────────────────┘
              ↕  [ / ] で出入り
┌──────────────────────────────────────────────────────────────────┐
│  🧠 L2 — Inner  (scope contents、scope の中身)                     │
│    AI が詳細を書き込む + 人間が確認・微修正                        │
│    inline data kinds:                                             │
│      prompt-text / schema-json / channels-def / note (authoring)  │
│      source-view / live-view                     (derived)        │
│    + 子 scope (tool / sub-agent / router)                         │
│    右 panel は L2 の structured editor として機能                 │
└──────────────────────────────────────────────────────────────────┘
              │ persistence: sqlite Map (substrate、設計上は名指さない)
              │
              │ compileFromMap(map, scopeId) — pure, deterministic
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  📜 L3 — Spec  (GraphSpec v0.1、neutral JSON、derived)             │
│    { version, scopeId, entry, nodes[], edges[], channels[] }     │
│    永続化しない、毎回再生成                                       │
└──────────────────────────────────────────────────────────────────┘
              │ stdin (JSON), stdout (NDJSON)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  🐍 L4 — Bridge  (Python subprocess、PJ04-local venv)              │
│    bridge.py / registry.py / schema.py                            │
│    IPCs: invoke / stream / update_state / get_state_history /     │
│          introspect_callable / fetch_source                       │
└──────────────────────────────────────────────────────────────────┘
              │ Python API
              ▼
┌──────────────────────────────────────────────────────────────────┐
│  ⚙️ L5 — Runtime  (LangGraph 1.1.8、embed、自前実装しない)         │
│    StateGraph / Pregel / SqliteSaver / ToolNode / Interrupt       │
│    thread_id → checkpoint chain (別 sqlite、PJ03 と分離)          │
└──────────────────────────────────────────────────────────────────┘
```

**最大の判断**:
- **L1/L2 は authoring 2 段** (人間 / AI の担当が分かれる)
- **L5 は本家丸投げ** (自前再実装しない)
- **我々が作るのは L1-L4**、特に L1/L2 の分離と L4 Bridge

---

## 3. Composition Model — agent tree + graph edges

### 3.1 木 (tree) と グラフ (graph) の二面

| 次元 | 何を表す | 例 |
|---|---|---|
| **木** (parent-child) | agent の **内部 binding** | agent planner の子 = tool search / tool calc / sub-agent verifier |
| **graph** (edge) | agent 間の **routing** | planner → verifier (approve) / planner → end (reject) |

```
Authoring (tree):                Execution (graph):
  🌳 planner                      ┌─ planner ─┐
  ├─ 🔧 search                    │           ↓
  ├─ 🔧 calc           ⇒          │       verifier ──(approve)──→ end
  └─ 🌳 verifier                  │           ↓
     └─ 🔧 validator              └── (reject) ←┘
```

- **木は authoring 時の composition**: "agent に tool を足す" は parent-child で自然
- **graph は execution 時の routing**: "state 次第でどこに進む" は edge
- **両者は直交**: 同じ map が木としても graph としても読める

### 3.2 atom の 子 が持つ意味

| 親 atom | 子に置ける | 子の意味 |
|---|---|---|
| agent | tool / sub-agent / router | **binding** (その agent の capability) |
| sub-agent | 同上 | 同上 (再帰) |
| tool | — | leaf |
| router | — | leaf |
| entry / terminal | — | leaf |

**規則**: agent の tree 内は "binding"。agent 間の関係は必ず **edge** で描く (tree 兼用禁止)。

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
| **I8** | data authoring minimal | channel 定義は scope 属性、surface にはエラーのみ |
| **I9** | schema も map | State Schema は map の一部 (外部 Python file 正本にしない) |
| **I10** | 時間軸と具象軸の独立 | checkpoint timeline と L0-L5 は別コントロール |
| **I11** | tree と edge の役割分離 | agent 内の木は binding、agent 間の線は routing。兼用禁止 |
| **I12** | node = scope 統一 | 全 node は scope。leaf / container の違いだけで同種。詳細は L2 Inner に格納 |
| **I13** | AI-fill は L2 のみ | AI が書き込むのは L2 inline data node と子 scope。L1 Outer の骨格は AI が勝手に動かさない (人間の担当) |

---

## 5. Authoring Minimalism (UI 原則)

**authoring と inspection は別の仕事**。混ぜると作成が止まる。

### 5.1 surface に出してよい情報

| 種類 | 出す? | 例 |
|---|---|---|
| 骨格 | ✅ | 箱 / label / shape / edge / scope frame |
| kind icon | ✅ (L2 以上) | agent ⚙ / tool 🔧 / sub 📦 / router ◇ |
| **error バッジ (赤)** | ✅ (常時) | `unresolved ref` / `unknown channel` / `unreachable` |
| **warning バッジ (黄)** | ✅ (常時) | `write only` / `reducer custom, ref empty` |
| signature / source / live value | ❌ (box には出さない) | L3+ でも **panel へ** |
| channels / reducers 定義 | ❌ (box には出さない) | **panel の structured editor** へ |

**原則**: **正の情報は panel、負の情報だけ surface**。

### 5.2 panel のセクション

選択が `scope root` のとき:
- **Channels** (structured editor, add/remove/rename)
- **Entry** (node select)
- **Interrupt Before / After** (node multi-select, Phase D)

選択が `agent` / `tool` / `router` のとき:
- **Kind / ref** (callable ref)
- **Reads / Writes** (optional channel 注釈)
- **Signature** (L3+)
- **Source** (L4)
- **Recent trace** (L5, active thread)

---

## 6. Phase 分割

### 6.1 実行 (LangGraph 取り込み系)

| Phase | 狙い | deliverable 要約 |
|---|---|---|
| **A** | Contract freeze | GraphSpec v0.1 pin、vitest、map_attribute_spec 穴埋め |
| **B** | Bridge MVP | `bridge.py` / `registry.py` / TS client、invoke 往復、`introspect` / `fetch_source` |
| **C** | Streaming + Checkpoint | stream 4 mode、thread 再開、viewer highlight |
| **D** | Interrupt + Time Travel | `interrupt_before/after`、approval UI、`update_state` fork、checkpoint timeline bar |
| **E** | Tool / LLM (Anthropic 1 本) | `ToolNode` + `bind_tools`、ReAct agent sample |
| **F** | Observability + Hardening | NDJSON ring buffer、OTel、crash recovery |

### 6.2 View 拡張 (具象軸系)

| Task | 狙い | 依存 |
|---|---|---|
| **T-CX-0** | L2 (attr 要約) | 独立、bridge 不要 |
| **T-CX-1** | L3 (signature) | Phase B |
| **T-CX-2** | L4 (source) | T-CX-1 |
| **T-CX-3** | L5 (live state) | Phase C |
| **T-CX-4** | per-node override (`o` / `shift-o`) | T-CX-1 |

### 6.3 Layout + Multi-Root (並行戦略)

| Task | 狙い |
|---|---|
| **T-LAY-1...6** | lane-role / anchor / engine 導入判定 (詳細は [layout_strategy.md](layout_strategy.md)) |

---

## 7. 着手順 (immediate)

1. **T-A-1 Contract Freeze** (Phase A、1-3 日、bridge 不要)
   - GraphSpec v0.1 pin、vitest 3 ケース、map_attribute_spec 穴埋め
2. **T-CX-0 L2 要約** (並行、1-2 日、bridge 不要)
   - kind icon のみ (当初の channels badge / ref tag は panel へ降ろす)

両者独立、衝突ファイル無し、並行可。Phase B-F と CX-1-4 は Phase A 通過後。

---

## 8. 未決 (E 候補)

| ID | 問い | 推奨 |
|---|---|---|
| Q1 | Python venv 配置 | PJ04 配下 (`runtime/bridge/`) |
| Q2 | registry 配置 | PJ04 配下 |
| Q3 | trace 保存 | NDJSON file |
| Q4 | interrupt UI token | Phase D 時点で決める |
| Q5 | `add_messages` を既存 reducer にマップするか | **新 `messages` kind を追加** |
| Q6 | channel 名命名 | `ascii_lower_snake` |
| Q7 | subgraph state isolation | `m3e:kernel-subgraph-mode` 属性、Phase 4 で決める |
| Q8 | channel editor type hint | 列挙 + `custom` free string |
| Q9 | atom に `agent` を追加するか | **yes、本書で採用** (旧 `callable` は legacy として残置) |

---

## 9. 非目標 (やらない)

- TS で LangGraph を再実装 (feasibility 🔴、XL 工数、embed で十分)
- Pregel super-step 自前実装 / pending writes 完全互換 / LangSmith 完全互換
- 既存 PJ03 `workflow_reducer.ts` / `graph_runtime.ts` / 17 `ALLOWED_EDGES` の書き換え
- data channel を surface に lane として描く (authoring minimalism 違反)
- State Schema を外部 Python file 正本にする (I9 違反)
- authoring surface に L3+ 情報 (signature / source / live) を直接描く (I6 + minimalism 違反)

---

## 10. Deep Dive References (参考資料)

本書で概要を押さえれば、以下は必要時だけ読めば OK。

| ファイル | 扱う範囲 |
|---|---|
| [langgraph_integration_plan.md](langgraph_integration_plan.md) | Phase A-F の IPC / spec / 出口条件の詳細 |
| [langgraph_feasibility.md](langgraph_feasibility.md) | 機能ごとの 🟢🟡🔴 評価 (なぜ embed を採ったか) |
| [concreteness_axis.md](concreteness_axis.md) | L0-L5 の data source / rendering / IPC 詳細 |
| [state_and_channels.md](state_and_channels.md) | data 側 D1-D4、赤/黄バッジカタログ、panel 仕様 |
| [map_attribute_spec.md](map_attribute_spec.md) | `m3e:kernel-*` 属性の契約 |
| [layout_strategy.md](layout_strategy.md) | layout engine / multi-root / lane-role の戦略 |
| [system_diagram_map_model.md](system_diagram_map_model.md) | map model の理論定義 |
| [render_target_definition.md](render_target_definition.md) | 用語定義の最初の固定 (Phase 1) |
| [merge_strategy.md](merge_strategy.md) | PJ 終了後の本体 merge 順序 |
| [idea/langgraph_full_feature_reproduction.md](../idea/langgraph_full_feature_reproduction.md) | **保留案** (TS 全再実装、採用しない) |

---

## 11. 1 文要約

> **M3E-LangGraph stack**: Outer → Inner → Spec → Bridge → Runtime の 5 層。
> 人間が L1 Outer (骨格) を描き、AI が L2 Inner (詳細) を埋め、M3E 内で compile → run まで完結する。
> **全 node = scope 統一** (I12)、atom は kind で識別される scope (agent / tool / sub-agent / router / entry / terminal)。
> **5 layer + 4 axis + 13 不変式 + 6-step workflow** が一貫性の骨格。
