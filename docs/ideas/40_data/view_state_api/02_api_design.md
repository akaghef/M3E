# View State API 案

## 方針

API を semantic state と view state に分ける。

```text
Semantic state
- map schema
- node text
- parent / children
- graph links
- attributes
- notes

View state
- expanded / collapsed
- selected node
- current scope
- viewport
- zoom
- surface mode
- panel visibility
- filters
- active tool
```

## API 案

```http
GET /api/maps/:mapId
```

semantic state を返す。
原則として viewer の一時表現状態は含めない。

```http
PATCH /api/maps/:mapId/nodes/:nodeId
```

単一 node の本文・note・attributes などを部分更新する。
`collapsed` はここでは更新しない。

```http
PATCH /api/maps/:mapId/structure
```

親子関係、追加、削除、並び替えなどの構造更新を行う。

```http
GET /api/maps/:mapId/view-state?user=:userId&surface=:surface
PATCH /api/maps/:mapId/view-state?user=:userId&surface=:surface
```

viewer の表現状態を user / surface ごとに保存する。

## View State 例

```json
{
  "scopeId": "n_xxx",
  "selectedNodeIds": ["n_yyy"],
  "expandedNodeIds": ["n_a", "n_b"],
  "collapsedNodeIds": ["n_c"],
  "viewport": {
    "x": 120,
    "y": -40,
    "zoom": 0.72
  },
  "surfaceMode": "tree",
  "panels": {
    "inspector": true,
    "linear": false
  },
  "filters": {
    "importance": "all"
  },
  "activeTool": "select"
}
```

## 互換移行

短期的には `TreeNode.collapsed` を残してよい。
ただし agent/API 書き込みでは以下を守る。

```json
{
  "mergePolicy": {
    "preserveViewState": true,
    "preserveCollapsed": true,
    "preserveViewport": true,
    "preserveSelection": true
  }
}
```

または endpoint を分ける。

```http
POST /api/maps/:mapId
X-M3E-Preserve-View-State: true
```

## Agent 向け安全規則

agent が構造・本文を更新するときは、原則として view state を触らない。

必須:

- text 変更だけなら node PATCH を使う
- full POST する場合は保存前後で `collapsed` 差分を検査する
- 既存ノードを置換する場合は同名/同役割ノードの view state を引き継ぐ
- user が開いている scope の selected / viewport / expanded を勝手に初期化しない

## 優先実装

1. `collapsed` を semantic write から保護する merge policy
2. node 単位 PATCH
3. `view-state` endpoint
4. user / surface 別の view-state persistence
5. agent 書き込み用の dry-run diff: semantic diff と view diff を分けて表示
