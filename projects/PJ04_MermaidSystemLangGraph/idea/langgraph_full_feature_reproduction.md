# PJ04 — LangGraph 全機能を M3E 上で再現するプラン

## Context

PJ04 (`projects/PJ04_MermaidSystemLangGraph/`) の描画側は基本完了（flow-lr surface, portal bracket, diamond shape, `[` / `]` keybind, edge midpoint anchoring, scope frame+title, selection preservation, URL scope tracking）。Mermaid ふうの system diagram が M3E 上で描画・編集できる土台が整った。

次のフェーズは、この diagram を**動かす** — つまり LangGraph が提供する orchestration 機能群を M3E 上で再現し、map から runnable graph を compile できるようにすること。PJ03 で作った `graph_runtime.ts` / `workflow_reducer.ts` は generator/evaluator/router 固定 role・17 edge fail-closed の特化実装で、そのままでは LangGraph の汎用性に届かない。よって**既存 runtime は PJ03 契約として据え置き、PJ04 は汎用 `GraphKernel` 層を別レイヤで並走させる**方針とする（ユーザー確認済み）。

ユーザー確認済みスコープ:
- **Observability まで完全再現**（Orchestration + Tool/LLM binding + LangSmith 互換 trace emission）
- **並存**（workflow_reducer は残し、新レイヤを別名前空間で作る）
- **両方 (embedded node + browser worker)**（heavy 実行は Node、inspection/edit は browser worker + viewer）

---

## Architecture Overview — 3 層設計

```
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Authoring Surface (既存)                        │
│   viewer.ts の flow-lr / portal / diamond / [ ] 操作     │
│   map の attribute で node/edge を記述                    │
└─────────────────────────────────────────────────────────┘
              │ compile (map → GraphSpec)
              ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 2: GraphKernel (新規, 汎用)                        │
│   - GraphSpec (StateChannel + Node + Edge + Command)     │
│   - Pregel-style executor (super-step + barrier)         │
│   - Checkpointer / Interrupt / Subgraph / Stream         │
│   - ToolNode / bind_tools / LLM adapter                  │
│   - Trace emission (LangSmith 互換 schema)               │
└─────────────────────────────────────────────────────────┘
              │ coexist (never overwrite)
              ▼
┌─────────────────────────────────────────────────────────┐
│ Layer 1: 既存 PJ03 runtime (据え置き)                     │
│   workflow_reducer.ts / graph_runtime.ts                 │
│   WorkflowStateCamel 固定 schema                          │
│   17 edge fail-closed                                     │
└─────────────────────────────────────────────────────────┘
```

**名前空間分離**: 新レイヤは `beta/src/node/kernel/` と `beta/src/shared/kernel/` に隔離。既存の `graph_runtime.ts` / `workflow_types.ts` は一切触らない。

---

## LangGraph 機能 → M3E 実装マッピング

| LangGraph | M3E 実装 | Layer | 場所 |
|---|---|---|---|
| `StateGraph(Schema)` | `GraphBuilder<TState>` | Kernel | `kernel/builder.ts` |
| `add_node(name, callable)` | `builder.addNode(id, fn)` | Kernel | `kernel/builder.ts` |
| `add_edge(a, b)` | `builder.addEdge(a, b)` | Kernel | `kernel/builder.ts` |
| `add_conditional_edges(a, router, map)` | `builder.addConditional(a, router, map)` | Kernel | `kernel/builder.ts` |
| `START` / `END` | `KERNEL_START` / `KERNEL_END` sentinel | Kernel | `kernel/constants.ts` |
| `TypedDict` + `Annotated[...reducer]` | `defineChannel<T>({ reducer })` | Kernel | `kernel/channel.ts` |
| `add_messages` | `messageChannel()` built-in | Kernel | `kernel/channels/messages.ts` |
| `operator.add` | `appendReducer` built-in | Kernel | `kernel/reducers.ts` |
| `Command(goto=..., update=...)` | `{ kind: "command", goto, update }` return | Kernel | `kernel/command.ts` |
| `Send("node", payload)` | `{ kind: "send", target, payload }` return | Kernel | `kernel/send.ts` |
| `compile(checkpointer, interrupt_before, ...)` | `builder.compile(opts)` → `CompiledGraph` | Kernel | `kernel/compile.ts` |
| `invoke(input, config)` | `compiled.invoke(input, config)` | Runtime | `kernel/executor.ts` |
| `stream(..., stream_mode=...)` | `compiled.stream(input, { mode })` AsyncIterator | Runtime | `kernel/executor.ts` |
| `stream_events` | `compiled.streamEvents(input, config)` | Runtime | `kernel/events.ts` |
| `MemorySaver` | `InMemoryCheckpointer` | Persistence | `kernel/checkpointers/memory.ts` |
| `SqliteSaver` | `SqliteCheckpointer` (既存 sqlite 流用) | Persistence | `kernel/checkpointers/sqlite.ts` |
| `thread_id` | `config.configurable.threadId` | Runtime | `kernel/config.ts` |
| `get_state(config)` | `compiled.getState(config)` | Runtime | `kernel/executor.ts` |
| `get_state_history` | `compiled.getStateHistory(config)` | Runtime | `kernel/executor.ts` |
| `update_state` | `compiled.updateState(config, values, asNode?)` | Runtime | `kernel/executor.ts` |
| `interrupt_before` / `_after` | `compile({ interruptBefore, interruptAfter })` | Runtime | `kernel/interrupt.ts` |
| Dynamic interrupt | `throw new Interrupt(payload)` in node | Runtime | `kernel/interrupt.ts` |
| `recursion_limit` | `config.recursionLimit` + guard | Runtime | `kernel/executor.ts` |
| Subgraph | `builder.addNode(id, compiledSub.asNode())` | Kernel | `kernel/subgraph.ts` |
| `ToolNode([tools])` | `new ToolNode(tools)` (node として addNode 可) | Tools | `kernel/tools/tool_node.ts` |
| `bind_tools(llm, tools)` | `bindTools(llm, tools)` wrapper | Tools | `kernel/tools/bind.ts` |
| LLM adapter | `LLM` interface + Anthropic/OpenAI 実装 | Tools | `kernel/llm/` |
| LangSmith run_id / trace | `TraceEmitter` が OTel 互換 span 発行 | Observability | `kernel/trace/` |

---

## Phase 分け

PJ04 既存 Phase 体系 (`plan.md` 参照) に接続する。Phase 3/4/5 の中身として展開。

### **Phase 3a — GraphKernel Foundation** (M0)
最小再現: Graph 定義 + State channel + Sequential invoke。

**成果物**:
- `beta/src/shared/kernel/types.ts` — `GraphSpec`, `NodeSpec`, `EdgeSpec`, `ChannelSpec`, `Command`, `Send`, `Interrupt`
- `beta/src/shared/kernel/constants.ts` — `KERNEL_START`, `KERNEL_END`
- `beta/src/shared/kernel/channel.ts` — `defineChannel`, built-in reducers (`lastWriteWins`, `appendReducer`, `replaceReducer`)
- `beta/src/node/kernel/builder.ts` — `GraphBuilder<TState>`
- `beta/src/node/kernel/compile.ts` — `CompiledGraph`
- `beta/src/node/kernel/executor.ts` — Pregel-style super-step loop (`invoke` のみ)
- `beta/src/node/kernel/__tests__/m0_basic.spec.ts` — `START → node → END`, 条件分岐, reducer 合成

**出口条件**:
- `pj04_lab_seed.py` と等価な 3-node graph (gen → verifier → router) を TS で定義 → invoke → 期待 state
- `add_messages` 相当の message channel で会話蓄積
- cycle detection + recursion_limit

### **Phase 3b — Persistence + Streaming** (M1)
checkpoint, thread, stream mode, state history。

**成果物**:
- `beta/src/node/kernel/checkpointers/base.ts` — `Checkpointer` interface
- `beta/src/node/kernel/checkpointers/memory.ts` — `InMemoryCheckpointer`
- `beta/src/node/kernel/checkpointers/sqlite.ts` — `SqliteCheckpointer`（既存 sqlite を流用。schema: `kernel_checkpoints(thread_id, checkpoint_id, parent_id, channel_values_json, channel_versions_json, created_at)`）
- `beta/src/node/kernel/executor.ts` 拡張 — `stream({ mode: "values" | "updates" | "messages" | "debug" })` → AsyncIterator
- `beta/src/node/kernel/executor.ts` — `getState`, `getStateHistory`, `updateState`

**出口条件**:
- thread_id 指定で同一 graph を中断・再開できる
- state history から任意時点を `updateState` で上書きして再実行（time travel）
- 4 種 stream mode が独立に動く

### **Phase 3c — Control Primitives** (M2)
Command, Send, conditional, interrupt。

**成果物**:
- `beta/src/shared/kernel/command.ts` — `Command<TState>` type、runtime 側で goto + update を適用
- `beta/src/shared/kernel/send.ts` — `Send<TPayload>` type、executor が super-step で fan-out
- `beta/src/node/kernel/interrupt.ts` — `interrupt_before` / `interrupt_after` + `throw new Interrupt(payload)` の dynamic interrupt
- resume protocol: `invoke({ resume: value }, config)` で interrupt から再開

**出口条件**:
- map-reduce パターン（`Send` で N 個の sub-task を fan-out → reducer で集約）が動く
- 特定 node 前で止まり、human approval 相当の外部入力で再開できる
- Command で動的に goto + state partial update が併用できる

### **Phase 4 — Map Compiler** (M3)
**PJ04 の本丸**: M3E map を GraphSpec に compile する。

**成果物**:
- `beta/src/node/kernel/compile_from_map.ts` — map 上の attribute を読んで `GraphBuilder` を構築
  - node.attributes: `m3e:kernel-node-kind` = `"callable" | "subgraph" | "tool" | "entry" | "terminal"`
  - node.attributes: `m3e:kernel-callable-ref` = module path or registered function id
  - edge.attributes: `m3e:kernel-edge-kind` = `"static" | "conditional"`
  - edge.attributes: `m3e:kernel-router-ref` (conditional のみ)
  - scope.attributes: `m3e:kernel-state-schema` = JSON schema / TS type ref
- `beta/src/node/kernel/registry.ts` — callable / router / tool / reducer の name-based registry
- `projects/PJ04_MermaidSystemLangGraph/runtime/kernel/` — 登録済み callable の実体 (TS)
- `projects/PJ04_MermaidSystemLangGraph/docs/map_to_graph_spec.md` — attribute 規約

**出口条件**:
- PJ04 の canonical map (`map_1776786701079_pan0ih`) の subgraph を GraphSpec に変換 → invoke できる
- Execute System scope が subgraph として compile され、親 graph からネストで呼ばれる
- map を編集すると compile 結果が追従する（watch mode）

### **Phase 4b — Tool / LLM Integration** (M4)
**成果物**:
- `beta/src/shared/kernel/tool.ts` — `Tool` interface (`name`, `description`, `inputSchema`, `invoke`)
- `beta/src/node/kernel/tools/tool_node.ts` — `ToolNode` (message 末尾の tool_calls を並列実行)
- `beta/src/node/kernel/tools/bind.ts` — `bindTools(llm, tools)` → `LLM` with tool schemas
- `beta/src/node/kernel/llm/base.ts` — `LLM` interface
- `beta/src/node/kernel/llm/anthropic.ts` — Anthropic Messages API 実装（stream 対応）
- `beta/src/node/kernel/llm/openai.ts` — OpenAI Responses API 実装
- Agent pattern sample: `projects/PJ04_MermaidSystemLangGraph/runtime/kernel/react_agent.ts`

**出口条件**:
- ReAct エージェント（LLM → ToolNode → LLM loop）が動く
- multi-agent supervisor パターンが subgraph 組み合わせで書ける
- tool_calls の並列実行（`Send` fan-out 経由）

### **Phase 4c — Browser Worker Runtime** (M5)
Browser 側でも軽量実行できるようにする。

**成果物**:
- `beta/src/browser/kernel_worker.ts` — Web Worker として Kernel executor をホスト
- `beta/src/browser/kernel_client.ts` — viewer から worker を呼ぶ RPC
- `beta/src/node/kernel/checkpointers/indexeddb.ts` — browser 側 checkpoint
- viewer.ts に inspection overlay — 現在 node、channel values、trace を map 上に重ねる

**出口条件**:
- viewer だけで graph を invoke → trace が map 上に animate される
- node 上に state snapshot のポップアップ
- heavy は node 側、inspection は browser の役割分担が機能

### **Phase 5 — Observability** (M6)
**成果物**:
- `beta/src/node/kernel/trace/emitter.ts` — `TraceEmitter` (event stream)
- `beta/src/node/kernel/trace/langsmith.ts` — LangSmith 互換 span format (`run_id`, `parent_run_id`, `start_time`, `end_time`, `inputs`, `outputs`)
- `beta/src/node/kernel/trace/otel.ts` — OpenTelemetry span exporter
- optional: LangSmith HTTP export（env `LANGSMITH_API_KEY` 検出時）
- viewer overlay — trace timeline を scope 下部に表示

**出口条件**:
- 1 invoke で per-node span tree が出る
- LangSmith UI で読める schema
- エラー時に failing node + stack trace が trace に含まれる

---

## Critical Files

**新規（touch 対象）**:
- `beta/src/shared/kernel/` 以下一式
- `beta/src/node/kernel/` 以下一式
- `beta/src/browser/kernel_worker.ts` / `kernel_client.ts`
- `projects/PJ04_MermaidSystemLangGraph/runtime/kernel/` (callable 登録)
- `projects/PJ04_MermaidSystemLangGraph/docs/kernel_spec.md`, `map_to_graph_spec.md`
- `projects/PJ04_MermaidSystemLangGraph/tasks.yaml` (M0-M6 タスク追加)

**再利用（read-only）**:
- `beta/src/shared/graph_types.ts:23-29` — `GraphEdge` 型の命名規約を参考にする
- `beta/src/shared/checkpoint_types.ts` — checkpoint JSON layout を踏襲
- `beta/src/shared/types.ts:6-23` — `TreeNode.attributes` 仕組み（`m3e:kernel-*` namespace で拡張）
- `beta/src/browser/viewer.ts:1079-1087` — attribute parsing 方式（kernel 属性を同じ方式で追加）
- 既存 sqlite 接続（`beta/src/node/` の DB 層）を `SqliteCheckpointer` で流用

**絶対に触らない**:
- `beta/src/node/graph_runtime.ts` / `workflow_reducer.ts`
- `beta/src/shared/workflow_types.ts` / `checkpoint_types.ts` の既存 field
- 既存 `17 ALLOWED_EDGES` 制約

---

## Verification

各 Phase は独立に検証可能。

**Phase 3a**:
```bash
cd beta && npx vitest run src/node/kernel/__tests__/m0_basic.spec.ts
```
- `pj04_lab_seed.py` の出力と TS 実装の出力が一致（同じ input → 同じ final state）

**Phase 3b**:
```bash
npx vitest run src/node/kernel/__tests__/m1_persistence.spec.ts
```
- thread_id で中断→再開、history 復元、stream mode 4 種
- `kernel_checkpoints` table round-trip

**Phase 3c**:
```bash
npx vitest run src/node/kernel/__tests__/m2_control.spec.ts
```
- map-reduce: 10 個の Send fan-out → reducer 集約
- interrupt 後の resume

**Phase 4**:
```bash
node beta/dist/node/kernel/cli.js compile --map map_1776786701079_pan0ih --scope Execute_System
```
- compile 結果（GraphSpec JSON）を目視確認
- invoke して trace を PJ04 canonical と照合

**Phase 4b**:
- `projects/PJ04_MermaidSystemLangGraph/runtime/kernel/react_agent.ts` で ANTHROPIC_API_KEY 使って 3 ターン会話

**Phase 4c**:
- viewer で map を開く → play ボタン → trace が map 上で animate される

**Phase 5**:
- LangSmith dashboard で run が表示される（or OTel collector で span が読める）
- エラーケースでも trace が欠損しない

---

## Open Questions（実装を止めない。Phase 3a 着手後に決めて OK）

1. **Message channel 型**: `add_messages` 互換のために `BaseMessage` 相当を M3E 側で定義するか、LangChain.js に依存するか。→ 初期は M3E 内定義、後で adapter で LangChain.js 互換に
2. **Recursion / super-step 戦略**: Pregel そのままか、sequential first → 後で fan-out 拡張か。→ 後者推奨（M0 は sequential、M2 で super-step 化）
3. **Subgraph の state 共有**: shared vs isolated を node spec で切り替える UI。→ `m3e:kernel-subgraph-mode` attribute で `"shared"` / `"isolated"`
4. **Tool registry の sandbox**: callable / tool を任意の TS から解決すると eval 面倒。→ Phase 4 時点で name-based registry（明示登録のみ）に限定
5. **Browser worker の heavy 判定**: どこから worker、どこから node に投げるか。→ M5 時点で LLM call と長時間 tool は node、その他は worker を default

---

## Risks & Mitigations

- **Scope inflation**: LangGraph の進化が速く、完全再現は moving target。→ **LangGraph 1.1.8 (requirements.txt 指定版) を pin** して、それ以降は差分管理
- **既存 PJ03 runtime との混同**: 両層が似た名前だと事故る。→ **名前空間完全分離**（`kernel/` prefix）+ 既存型を import しない
- **checkpoint schema 分岐**: 既存 `CheckpointFile` v1 と kernel の schema が別物になる。→ **別 table / 別 dir** (`runtime/kernel_checkpoints/`)、migration 不要
- **LLM の API drift**: Anthropic/OpenAI の SDK 変化。→ `LLM` interface を**自前で定義**し、SDK は adapter に閉じ込める

---

## Out of Scope

- 既存 PJ03 workflow_reducer の書き換え
- WorkflowState / WorkflowEdge の schema 変更
- viewer 側の更なる描画機能拡張（j/k 詳細度ズーム等）は別 task
- LangGraph Platform / LangGraph Cloud 相当の deployment 機能
