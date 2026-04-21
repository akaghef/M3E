# LangGraph → M3E Projection Design (T-9-4)

- **status**: authoritative (Plan 4 Phase 4-3)
- **phase**: 9
- **source**: plan4.md Phase 4-3、T-9-1 lab、T-9-2 bridge design
- **referenced by**: 後続 PJ (実装 PJ 候補)

## 原則（Plan 4 §アーキテクチャ原則 B 再掲）

**tree は projection、runtime の正本ではない。**

M3E map / scope は LangGraph runtime の観察・参照・デモ面として使う。
逆方向 (map の編集が graph に影響) は **禁止**。

## 既存 projectGraph との関係

T-7-1 で `workflow_scope_projector.ts` に `projectGraph(graphInstance, runtimeDir)` を
追加した。これは **Plan 2 自前 runtime の GraphInstance** を前提とする。

Plan 4 反転後の整理:

| projector 関数 | 入力 | 出力 | Plan 4 での位置 |
|---|---|---|---|
| `projectTasks(tasksFile, runtimeDir)` | tasks.yaml + checkpoint JSON | AppState（task 一覧） | 保持。人間向け task summary として有用 |
| `projectGraph(graphInstance, runtimeDir)` | `GraphInstance`（自前 runtime） | AppState（graph view） | **廃止 or "legacy" として保持**。Plan 4 では自前 GraphInstance を使わない |
| `projectLangGraphThread(threadSnapshot)` (新規、本 doc 提案) | LangGraph thread state JSON + contract | AppState（LangGraph graph view） | **Plan 4 の M3E bridge 本体。実装は次 task** |

## 新 projector 設計

```
Python: pj03_lab.py --emit-snapshot <path>
   ↓ JSON intermediate (thread_id, state dict, graph_definition dict)
TypeScript: projectLangGraphThread(snapshotPath): AppState
   ↓
M3E map (人間が見る read-only view)
```

### JSON intermediate schema

```json
{
  "schema_version": 1,
  "thread_id": "task-T-1-3",
  "state": {
    "kind": "done",
    "round": 1,
    "round_max": 3,
    "feedback": "criteria met",
    "blocked": false,
    "last_node": "end_pass",
    "trace": ["gen#0: ...", "verifier#0: fail", ...]
  },
  "graph_definition": {
    "nodes": [
      {"id": "gen", "role": "generator", "description": "..."},
      {"id": "verifier", "role": "evaluator", "description": "..."},
      {"id": "router", "role": "router", "description": "..."},
      ...
    ],
    "edges": [
      {"id": "e-gen-verifier", "source": "gen", "target": "verifier", "kind": "always"},
      {"id": "e-verifier-router", "source": "verifier", "target": "router", "kind": "conditional"},
      ...
    ]
  },
  "emitted_at": "2026-04-21T10:30:00Z"
}
```

### AppState 投影規則

既存 `projectGraph` の namespace 規約 (`workflow.graph.*`) を踏襲する。追加 prefix として
**`langgraph.*`** を導入：

| source | AppState location |
|---|---|
| thread_id | `root.attributes.langgraph.thread_id` |
| state.kind | `root.attributes.langgraph.state.kind` + 各 gnode の current flag |
| state.round | `root.attributes.langgraph.state.round` |
| state.feedback | `root.note` に embed |
| state.last_node | `root.attributes.langgraph.current_node_id` |
| state.trace | task-level note or details として root.details |
| graph_definition.nodes | gnode children |
| graph_definition.edges | gnode の attributes.outgoing に文字列化 |

workflow.* (自前 runtime) と langgraph.* は **並立**、衝突しない。

## 実装方針

### 1. Python 側 `--emit-snapshot`

```python
# pj03_lab.py 拡張
def emit_snapshot(app, thread_id: str, out_path: str, graph_def: dict):
    config = {"configurable": {"thread_id": thread_id}}
    snapshot = app.get_state(config)
    payload = {
        "schema_version": 1,
        "thread_id": thread_id,
        "state": dict(snapshot.values),
        "graph_definition": graph_def,
        "emitted_at": datetime.utcnow().isoformat() + "Z",
    }
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
```

### 2. TypeScript 側 `projectLangGraphThread`

```ts
// beta/src/node/workflow_scope_projector.ts に追加（or 別 file）
export interface LangGraphSnapshot {
  schema_version: 1;
  thread_id: string;
  state: Record<string, unknown>;
  graph_definition: {
    nodes: Array<{ id: string; role: string; description: string }>;
    edges: Array<{ id: string; source: string; target: string; kind: string }>;
  };
  emitted_at: string;
}

export function projectLangGraphThread(snapshot: LangGraphSnapshot): AppState {
  // AppState 生成。workflow.graph.* とは別 namespace (langgraph.*)
  // root node を "langgraph-root" に、nodes を "lgnode:<id>" に prefix
  // ...
}
```

### 3. CLI wiring

`workflow_cli.ts` に `--langgraph-snapshot <path>` オプション追加：

```bash
node dist/node/workflow_cli.js \
  --langgraph-snapshot ../projects/PJ03_SelfDrive/artifacts/langgraph_snapshot_01.json \
  --emit-projection ../projects/PJ03_SelfDrive/artifacts/langgraph_scope_snapshot_01.json
```

map server への POST は Plan 3 system_diagram_runner と同じ型を使える（AppState shape が同じ）。

## 逆流禁止の機械化

Plan 4 §原則 B (tree は projection、runtime の正本ではない) を機械で保証:

1. `projectLangGraphThread` は snapshot JSON から AppState を **生成するのみ**。入力 JSON は書き換えない
2. map server → LangGraph thread state を書き戻す API は **実装しない** (bridge 設計から除外)
3. もし人間が viewer で langgraph.* attribute を編集した場合、次 `--emit-snapshot` 時に **上書きされる**
4. runner (system_diagram_runner 的な live-edit tool) を langgraph.* namespace に向けない

## 既存 projectGraph との共存・廃止判断

Plan 4 §Gate ルール 3 (tree 代替達成扱いしていない) を満たすため:

- **共存案**: `workflow.graph.*` (自前 legacy) と `langgraph.*` (Plan 4 正本) が同じ map 上に並ぶ。
  混乱しないように map 内で別 scope にする or 片方を削除
- **廃止案**: `projectGraph` を廃止、`projectLangGraphThread` を正本に
- **推奨**: **廃止案**。Plan 2 自前 GraphInstance は Plan 4 で役割消失したため、
  projection も同時に廃止するのが責務境界に整合

実際の廃止タイミングは **Plan 4 Gate 6 通過後の別 task** (実装 PJ 候補)。

## 本 plan の非目標

- 実装（Plan 4 Phase 4-3 は設計止まり）
- map viewer 側の langgraph.* 描画コード
- 双方向 sync
- multi-thread multi-graph の同時投影

## Cross-reference

- `projects/PJ03_SelfDrive/plan4.md` §Phase 4-3 / §原則 B
- `projects/PJ03_SelfDrive/docs/langgraph_bridge.md` (T-9-2)
- `projects/PJ03_SelfDrive/docs/m3e_scope_integration.md` (T-3-1、Plan 1 の projection 原則)
- `beta/src/node/workflow_scope_projector.ts` (projectTasks / projectGraph、後者は legacy 候補)
