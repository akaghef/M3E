# M3E Scope Integration — Phase 3 投影設計

- **status**: authoritative (T-3-1)
- **phase**: 3
- **source**: akaghef Phase 3 focus（M3E 1 scope 内への最小統合、map / reducer の責務混線回避）
- **referenced by**: T-3-2 projector 実装、T-3-3 dogfood

## 設計原則

1. **SSOT は checkpoint JSON のみ**: scope 側は投影（projection）で、書き戻し無し。map → reducer の逆流禁止。
2. **One-way projection**: `checkpoint JSON + tasks.yaml → AppState` の write-only 方向。map 表示は reducer state のスナップショット。
3. **workflow namespace 隔離**: scope node の attribute は `workflow.kind` / `workflow.round` など prefix で隔離。既存 M3E facet (fill / urgency / importance / status) を汚染しない。
4. **読取専用 projector**: projector は fs write も map POST もしない。`AppState` オブジェクトを返すだけ。実際の map 書き込みは caller (CLI / hook / future orchestrator) が担う。

## 責務分離

```
checkpoint JSON ─┐
tasks.yaml ─────┼─→ [workflow_scope_projector] ─→ AppState ─→ (caller) ─→ map server
                │
              (read-only)                      (offline, deterministic)
```

- reducer: checkpoint JSON の SSOT. projector を呼ばない。
- orchestrator: projection を消費しない。reducer API のみ使う。
- projector: checkpoint / tasks.yaml を read、AppState を return。副作用無し。
- caller (CLI / hook): projection 結果を file に dump する or map server に POST する。

**許容される逆流**: なし（Phase 3 では）。将来 map 編集で reducer を動かす要件が出たら、明示的な bridge task を別途設計する。

## Scope 構造

1 root ノードの下に全 task を子として並べる最小構成。

```
pj03-workflow (root, nodeType=folder)
├── task:T-0-1 (attributes: workflow.kind=done, workflow.round=1, ...)
├── task:T-0-2
├── ...
└── task:T-3-4
```

### root node

| 項目 | 値 |
|---|---|
| id | `root` |
| parentId | `null` |
| text | `PJ03 Workflow Snapshot (as of <timestamp>)` |
| nodeType | `folder` |
| attributes | `workflow.total=21`, `workflow.done=N`, `workflow.blocked=M` ... |

### task node

| 項目 | 値 |
|---|---|
| id | `task:{taskId}` (例: `task:T-0-1`) |
| parentId | `root` |
| text | `{verb} {target}` (契約の 1 行表現) |
| nodeType | `text` |
| attributes | workflow-prefixed（下表） |
| details | task の done_when 列挙 |
| note | current feedback / blocker reason |

### task node の attributes (workflow namespace)

| attribute | 値 | 由来 |
|---|---|---|
| `workflow.kind` | `pending` \| `ready` \| ... \| `failed` | state.kind |
| `workflow.round` | 整数文字列 | state.round |
| `workflow.round_max` | 整数文字列 | state.round_max |
| `workflow.phase` | 整数文字列 | contract.phase |
| `workflow.blocker` | 文字列 (null は空) | state.blocker |
| `workflow.escalation_kind` | `E1` \| `E2` \| `E3` \| 空 | state.escalation_kind |
| `workflow.wakeup_at` | ISO 文字列 \| 空 | state.wakeup_at |
| `workflow.failure_reason` | 文字列 \| 空 | state.failure_reason |
| `workflow.last_feedback` | 文字列 \| 空 | state.last_feedback |
| `workflow.next_signal` | 文字列 | suggestNextSignal(kind) の結果 |
| `workflow.dependencies` | comma-separated | contract.dependencies |

## 4 表示要件の scope 位置

akaghef 指示の 4 表示それぞれの置き場:

| 表示 | 位置 |
|---|---|
| **workflow summary view** | root node の `attributes.workflow.*` + text summary |
| **current state 表示** | 各 task node の `attributes.workflow.kind` + `workflow.round` |
| **next transition 表示** | 各 task node の `attributes.workflow.next_signal` (suggestNextSignal の結果) |
| **blocked reason 表示** | 各 task node の `attributes.workflow.blocker` + `note` (blocker が non-null なら強調) |

将来 M3E 側で workflow.kind を facet として描画するコードを書く場合、**別 PJ** として起票する（本 PJ03 では scope data の生成までに留める）。

## facet / 既存 M3E との共存ルール

M3E の既存 facet は `scope_types.ts` / viewer 側で fill / urgency / importance / status を扱う。
workflow projection はこれらと衝突しないよう:

- workflow.* prefix を attribute key に固定
- 既存 facet の key（`fill`, `urgency`, `importance`, `status` など）を上書きしない
- projection が生成する AppState は独立 scopeId を持つ（既存 map に merge する場合も、workflow スコープ下だけ触る）

## 出力 AppState の shape（抜粋）

`beta/src/shared/types.ts` の AppState 型に準拠。

```ts
{
  rootId: "root",
  nodes: {
    "root": { id: "root", parentId: null, children: ["task:T-0-1", ...], nodeType: "folder", text: "...", attributes: {...}, ... },
    "task:T-0-1": { id: "task:T-0-1", parentId: "root", children: [], nodeType: "text", text: "finalize 最小 workflow state set", attributes: { "workflow.kind": "done", ... }, ... },
    ...
  }
}
```

- `links` は使わない（依存関係は attribute の `workflow.dependencies` に並列で入れる）
- `linearNotesByScope` も使わない

## 決定論性

同じ checkpoint JSON + tasks.yaml を入力として projector を複数回呼び出すと、
完全に同一の AppState が返る必要がある。タイムスタンプを含める場合は caller が root.text に差し込む
（projector は `updated_at` を参照しない）。

## Cross-reference

- beta/src/shared/types.ts: AppState の既存型
- beta/src/node/workflow_reducer.ts: loadAllTaskViews が投影のデータソース
- projects/PJ03_SelfDrive/docs/reducer_responsibility.md: 責務階層（projector は reducer の上位レイヤ）
