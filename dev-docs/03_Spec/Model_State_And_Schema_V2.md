# Model State 分離と Schema v2 仕様

## 目的

本仕様は以下を明確化する。

1. Persisted document state と ViewState の分離境界
2. Model 側の必須項目（MUST）
3. v1 -> v2 のスキーマ変更と migration 方針

対象は Beta の model 層であり、Final 固有の運用要件は含めない。

---

## 1. State 分離（詳細）

### 1.1 基本方針

- 永続化対象は `PersistedDocument` のみとする。
- 画面操作に依存する状態は `ViewState` として分離する。
- SQLite / JSON に保存するのは `PersistedDocument` のみ。

### 1.2 PersistedDocument（保存対象）

`PersistedDocument` はドメイン正本であり、次を含む。

- `version`
- `rootId`
- `nodes`
- （将来）`scopes`
- （将来）`aliases`
- `meta`（作成・更新時刻など）

### 1.3 ViewState（非保存対象）

`ViewState` はセッション状態であり、次を含む。

- `selectedNodeId`
- `expandedNodeIds`
- `viewport`（pan/zoom）
- `dragState`
- `hoverState`
- `inlineEditorState`

### 1.4 境界ルール

- Model API は `PersistedDocument` を入出力する。
- Viewer 側は `PersistedDocument + ViewState` を合成して描画する。
- Undo/Redo は `PersistedDocument` の差分のみを対象とする。
- `ViewState` は保存/復元の正当性判定に使わない。

---

## 2. 必須項目（MUST）

### 2.1 Document Top-level MUST

- `version: number`
- `rootId: string`
- `nodes: Record<string, Node>`
- `meta.createdAt: string (ISO8601)`
- `meta.updatedAt: string (ISO8601)`

### 2.2 Node MUST

- `id: string`（永続一意）
- `type: "text" | "image" | "folder" | "alias"`
- `parentId: string | null`
- `children: string[]`（順序意味あり）
- `scopeId: string`
- `content: object`（型ごとに構造を定義）
- `createdAt: string (ISO8601)`
- `updatedAt: string (ISO8601)`

### 2.3 型別 MUST

- `text`: `content.text: string`
- `image`: `content.imageRef: string`
- `folder`: `content.title: string`
- `alias`: `content.targetNodeId: string`

### 2.4 整合性 MUST

- `rootId` は `nodes` に存在する。
- すべての `children[]` は実在ノードを参照する。
- `parentId` と `children[]` は相互整合する。
- 主構造に cycle を作らない。
- 全ノードが root から到達可能である。
- alias は実体ノードのみを参照する（alias -> alias 禁止）。
- 実体ノードは単一 scope にのみ所属する。

---

## 3. Schema v2 設計

### 3.1 v1 との差分

v1 は以下が不足している。

- `type`
- `scopeId`
- `createdAt` / `updatedAt`
- `meta`（documentレベル）
- `content` の型分離（現在は text/details/note/link 併置）

v2 では MUST 項目を満たす構造へ移行する。

### 3.2 v2 形式（例）

```json
{
  "version": 2,
  "rootId": "n_root",
  "meta": {
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-01T10:00:00.000Z"
  },
  "nodes": {
    "n_root": {
      "id": "n_root",
      "type": "text",
      "parentId": null,
      "children": ["n_a"],
      "scopeId": "scope_root",
      "content": { "text": "Root" },
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z"
    }
  }
}
```

### 3.3 migration 方針

- 読み込み時に `version` を必ず判定する。
- `version === 1` の場合のみ `migrateV1ToV2()` を適用する。
- migration 後に `validateV2()` を実行し、失敗時は reject する。

### 3.4 v1 -> v2 変換ルール

- `type` が無いノードは `"text"` を付与
- `scopeId` が無いノードは `"scope_root"` を付与
- `createdAt/updatedAt` は migration 時刻で埋める
- 既存 `text/details/note/link/attributes` は `content` へ再配置
- document-level `meta` を新規生成

### 3.5 後方互換ポリシー

- 読み込み対応: v1, v2
- 書き込み形式: v2 のみ
- v1 の再出力は行わない

### 3.6 テスト要件

- v1 fixture を v2 に migration できる
- migration 後 `validateV2()` が pass する
- round-trip（save/load）で意味が不変
- 異常系（欠損/循環/不正alias）を reject する

---

## 4. 実装タスク（Model）

1. `PersistedDocumentV2` 型定義を追加
2. `ViewState` を model 永続化対象から分離
3. `validateV2()` を追加
4. `migrateV1ToV2()` を追加
5. save は常に v2 を出力
6. v1/v2 fixture で unit test を追加
