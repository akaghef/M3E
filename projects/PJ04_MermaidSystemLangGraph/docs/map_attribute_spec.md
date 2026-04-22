# PJ04 — Map Attribute Specification

M3E map 上の node / link / scope に付く **`m3e:kernel-*` 名前空間**の属性定義。
これが map (authoring surface) と GraphSpec (neutral execution contract) の **唯一の契約**。

## 位置づけ

```
┌────────────────────────────────────────┐
│ M3E map (authoring)                     │
│   TreeNode / GraphLink / MapScope       │
│   + m3e:kernel-* attributes             │  ← この文書
└────────────────────────────────────────┘
              │  compileFromMap()
              ▼
┌────────────────────────────────────────┐
│ GraphSpec (neutral JSON)                │
│   beta/src/shared/graph_spec_types.ts   │
└────────────────────────────────────────┘
              │  (embed or self-implement)
              ▼
┌────────────────────────────────────────┐
│ Execution runtime                       │
│   LangGraph subprocess, or              │
│   Future: TS runtime                    │
└────────────────────────────────────────┘
```

**設計原則**:
- GraphSpec に出ない概念は attribute に書かない (authoring と execution の結合を避ける)
- 既存の `m3e:layout` / `m3e:shape` / `m3e:display-role` / `m3e:scope-portal` 等は**描画専用**として据え置き。`m3e:kernel-*` は execution 意味論だけを持つ
- 未指定時のフォールバック挙動を常に定義する (attribute 無しの map もそのまま graph になる)

---

## Node 属性

TreeNode.attributes に付ける。

| Key | Required | Values | Default | 意味 |
|---|---|---|---|---|
| `m3e:kernel-node-kind` | ✗ | `callable` / `subgraph` / `tool` / `entry` / `terminal` | `callable` | GraphSpecNode.kind |
| `m3e:kernel-callable-ref` | △ | registry name (string) | — | kind=callable / tool のとき必須。登録済み関数名 |
| `m3e:kernel-subgraph-scope` | △ | scope id | — | kind=subgraph のとき必須 |
| `m3e:kernel-label` | ✗ | string | node.text | 表示ラベルの override |
| `m3e:kernel-metadata` | ✗ | JSON string (flat object) | — | 実行に影響しない自由メタ |

### Sentinel nodes

`entry` / `terminal` は `__start__` / `__end__` の alias。明示的に entry / terminal の
box を map に描きたいときに使う。`m3e:kernel-node-kind="entry"` または `"terminal"`。

---

## Edge (link) 属性

GraphLink に直接 attribute 欄は無いので、**link の `relationType` を以下の規約で利用する**:

| `relationType` の先頭 | 意味 |
|---|---|
| (何も無し or 未設定) | static edge |
| `cond:` | conditional edge。末尾は branch key (例: `cond:approve`) |
| `route:` | conditional edge。router ref を link のメタから参照する (後述) |

将来 link attribute が導入されたら以下に移行:

| Key | Required | Values | 意味 |
|---|---|---|---|
| `m3e:kernel-edge-kind` | ✗ | `static` / `conditional` | 省略時 static |
| `m3e:kernel-router-ref` | △ | registry name | kind=conditional のとき必須 |
| `m3e:kernel-branch-key` | △ | string | conditional edge 各枝の branch key |
| `m3e:kernel-edge-label` | ✗ | string | GraphSpecEdge.label override |

### Conditional edge の表現 (暫定)

conditional 分岐は「同じ source から複数 link が出て、それぞれ branch key を持つ」形で表現する。
router ref は source node の attribute `m3e:kernel-router-ref` に置く (source node の責務)。

例:

```
source node: Gate_1
  attributes:
    m3e:kernel-router-ref = "gate1_router"

link A: Gate_1 → Research
  relationType = "cond:reject"

link B: Gate_1 → Dependency_Sort
  relationType = "cond:approve"
```

これで GraphSpec 側は:

```json
{
  "kind": "conditional",
  "source": "Gate_1",
  "routerRef": "gate1_router",
  "branches": { "reject": "Research", "approve": "Dependency_Sort" }
}
```

---

## Scope 属性 (channels / entry)

**scope root node の attributes** に以下を置く:

| Key | Required | Values | 意味 |
|---|---|---|---|
| `m3e:kernel-channels` | ✗ | JSON array | channel 定義の列。省略時は空 |
| `m3e:kernel-entry` | ✗ | node id (string) | 明示的 entry。省略時は `__start__` |

`m3e:kernel-channels` の中身:

```json
[
  { "name": "messages", "reducer": "append", "typeHint": "Message[]" },
  { "name": "plan",     "reducer": "replace", "typeHint": "string" },
  { "name": "usage",    "reducer": "custom", "reducerRef": "sum_usage" }
]
```

reducer は `append` / `replace` / `merge` / `custom` のいずれか。
`custom` のときは `reducerRef` が必須 (registry で解決)。

---

## Callable / Router / Reducer の registry

`ref` で名前参照される関数群は、**map 側には実体を持たない**。
GraphSpec を実行ランタイムに渡す時点で、ランタイムが ref を解決する。

- TS 側 registry: 未実装 (将来必要なら別途定義)
- LangGraph subprocess: Python 側の registry モジュールで解決

registry の具体仕様は本文書の scope 外。**map attribute はあくまで ref 文字列を持つだけ**。

---

## Minimal example

```
scope: MyGraph (root node)
  attributes:
    m3e:kernel-channels = '[{"name":"messages","reducer":"append"}]'
    m3e:kernel-entry = "planner"

  children:
    - planner  (text="Planner")
        attributes:
          m3e:kernel-node-kind = "callable"
          m3e:kernel-callable-ref = "agents.planner"
    - executor  (text="Executor")
        attributes:
          m3e:kernel-node-kind = "callable"
          m3e:kernel-callable-ref = "agents.executor"
          m3e:kernel-router-ref = "route_after_exec"

  links:
    - planner → executor                  (relationType = "", static)
    - executor → planner    (relationType = "cond:continue")
    - executor → __end__   (relationType = "cond:done")
```

これが compileFromMap を通ると GraphSpec JSON になり、LangGraph subprocess または TS 実装で実行できる。

---

## 既存属性との共存

| 属性 | 用途 | kernel との関係 |
|---|---|---|
| `m3e:layout=flow-lr` | 描画 mode (system surface) | 独立 |
| `m3e:shape=diamond` | box 形状 | 独立 |
| `m3e:display-role=subsystem` | portal 表示 | `m3e:kernel-node-kind=subgraph` と両立推奨 |
| `m3e:scope-portal=true` | portal 表示 | 同上 |
| `m3e:kernel-*` | **execution 意味論** | このドキュメント |

描画属性と kernel 属性は**独立の軸**として併存する (意味は kernel、見た目は display-role/shape)。
