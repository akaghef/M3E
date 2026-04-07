# Data Model

## 目的

この文書は、M3E の実体モデルに関する不変条件を定義する。  
実装方式や UI に関係なく守るべき制約をここに置く。

## 基本要素

### Node

思考要素の最小単位。型（`nodeType`）を持つ。

### Edge

主構造を表す親子関係。  
M3E の骨格は親から子への有向ツリーとする。

### Scope

`folder` を root とする可視性・編集範囲。  
scope はストレージ単位ではなく認知境界である。

## ノードの分類

### 分類軸: 実体ノード（entity）と 参照ノード（reference）

M3E のノードは **実体ノード** と **参照ノード** の 2 種に大別される。
この分類は nodeType が増えても変わらない不変の軸である。

| 分類 | 定義 | 現在の nodeType |
|------|------|----------------|
| **実体ノード** | 固有の内容を持ち、ツリー上に正本が 1 箇所だけ存在するノード。子を持てる。scope に所属する | `text`, `image`, `folder` |
| **参照ノード** | 他ノードへの参照であり、固有の内容を持たない。子を持てない（leaf 強制） | `alias` |

#### 実体ノードの共通性質

1. **正本が 1 つ**: 同じ内容を複製しない。他 scope に見せたいときは alias を置く
2. **子を持てる**: children に他ノードを格納できる
3. **scope に所属する**: 親チェーンから導出される 1 つの scope に属する
4. **直接編集できる**: 所属 scope 内から直接編集可能
5. **alias の target になれる**: 参照ノードの参照先として指定できる
6. **Link の endpoint になれる**: GraphLink の source/target として指定できる

#### 参照ノードの共通性質

1. **固有の内容を持たない**: 表示名は target から取得するか、aliasLabel で上書きする
2. **leaf 強制**: children は常に空。子ノードを持てない
3. **target が必須**: 参照先となる実体ノードを指す
4. **参照の連鎖禁止**: 参照ノードから参照ノードを辿らない

### nodeType 一覧

| nodeType | 分類 | 説明 | 子 | scope 効果 |
|----------|------|------|-------|-----------|
| `text` | 実体 | 通常のテキストノード。デフォルト型 | 可 | なし |
| `image` | 実体 | 画像参照を持つノード | 可 | なし |
| `folder` | 実体 | scope の根になるノード。子は folder scope に所属する | 可 | 子 scope を作る |
| `alias` | 参照 | 実体ノードへの参照窓。read/write 権限を持つ | 不可 | なし |

### 新しい nodeType を追加するときの規則

1. まず「実体」か「参照」かを決める
2. 上記の共通性質をすべて満たすことを確認する
3. 型ごとの追加属性をこの文書に追記する
4. types.ts の `NodeType` union に追加する
5. Command_Language.md の `m3e.setType()` 表に追記する

## Node の必須属性

全 nodeType 共通:

- 永続的な一意 ID
- nodeType
- 親 ID
- 子 ID の順序列（参照ノードは常に空）
- 所属 scope（構造から導出される）
- 作成時刻
- 更新時刻

## 型ごとの追加属性

### text（実体）

- 本文（text フィールド）

### image（実体）

- 画像参照

### folder（実体）

- 下位階層の root として振る舞う識別
- 本文（text フィールド。folder 名として使用）

### alias（参照）

- 参照先 node ID（targetNodeId）
- 表示名上書き（aliasLabel、任意）
- アクセス権限（access: "read" | "write"）
- target 消失時のスナップショット（targetSnapshotLabel、任意）
- 破損フラグ（isBroken、任意）

## 不変条件

### 一意性

- 実体ノードは複製しない
- 参照は alias で行う

### ツリー整合性

- 主構造に循環を作らない
- 親子順序は安定して管理する

### 所属

- 実体ノードは単一 scope にのみ属する
- 他 scope から直接共有しない

### scope 導出ルール（正規化）

- `scopeId` はノードに永続化しない
- ノードの所属 scope は、祖先列で最も近い `folder` ノード ID から導出する
- 祖先に `folder` が無いノードは document `rootId` に属するとみなす
- `reparent` 時の scope 変更は `parentId` / `children` 更新のみで表現し、scope のカスケード更新は行わない

### 参照ノード制約

- 参照ノードの target は実体ノードのみ（参照→参照の連鎖禁止）
- 参照ノードは children を持てない（leaf 強制）
- 参照ノードは alias の target にできない

## 変更履歴

- 変更は command として表現できる形にする
- Undo/Redo を可能にする
- 将来の差分比較に備える

## スキーマ方針

- 保存形式は version を持つ
- 破壊的変更には migration を用意する
- 保存と復元で意味が変わらないことを重視する

## 関連文書

- scope と alias の意味: [./Scope_and_Alias.md](./Scope_and_Alias.md)
- state分離と schema v2: [./Model_State_And_Schema_V2.md](./Model_State_And_Schema_V2.md)
- クラウド同期の最小戦略: [./Cloud_Sync.md](./Cloud_Sync.md)
- MVC と command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
- Freeplane への写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)

## Edge and Link Separation

M3E should distinguish `Edge` and `Link` as different concepts.

### Edge

- expresses the primary parent-child tree structure
- is part of the structural graph
- participates in layout
- is always derived from ownership relation

### Link

- expresses non-tree relation between nodes
- is an overlay relation, not a structural ownership relation
- does not participate in layout
- may later support relation type, label, direction, or styling

## Graph-level Link 仕様

### 目的

`Link` は tree の外側にある意味関係を表す。

- 因果
- 参照
- 補足
- 対比
- 関連

`Link` は親子の `Edge` を置き換えるものではない。
構造は `Edge`、非木関係は `Link` として分離する。

### 保存単位

`Link` は node に埋め込まず、document 全体の relation 集合として持つ。

```typescript
interface AppState {
  rootId: string
  nodes: Record<string, TreeNode>
  links?: Record<string, GraphLink>
}

interface GraphLink {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relationType?: string
  label?: string
  direction?: "none" | "forward" | "backward" | "both"
  style?: "default" | "dashed" | "soft" | "emphasis"
}
```

Beta では `links` は optional でよい。
未実装 viewer と既存 save data を壊さないためである。

### 不変条件

#### 1. endpoint の存在

- `sourceNodeId` と `targetNodeId` は、保存時点で実在ノードを指す必要がある
- どちらかが欠けた `Link` は broken relation として保存しない

#### 2. alias endpoint

- `Link` の endpoint は実体ノードを既定対象とする
- alias ノードを endpoint として許可するかは Beta では保留とする
- Beta 実装の既定は「alias endpoint を禁止」でよい

#### 3. self link

- `sourceNodeId === targetNodeId` の self link は既定では禁止する
- 特殊用途が必要になった時だけ再検討する

#### 4. layout 非参加

- `Link` は node 座標決定に影響しない
- `Link` の追加・削除だけで subtree placement を変えない

#### 5. ownership 非参加

- `Link` は所有権や親子順序を変えない
- `Link` は `scope` 所属決定の根拠に使わない
- `Link` は delete / reparent / alias 規則を上書きしない

### node-level `link` との分離

- `TreeNode.link` は URL や外部参照などの node 属性である
- `GraphLink` は node 間の relation line である
- 名前が似ていても、保存場所・意味・描画方法は別である

### 操作単位

将来の command 層では、少なくとも以下を分けて持つ。

- `createLink`
- `updateLink`
- `deleteLink`

node 編集 command と混在させない。

### delete / move 時の扱い

#### node delete

- endpoint node が削除されたら、接続している `Link` は同時に削除する
- broken endpoint を持つ `Link` を残さない

#### node move / reparent

- `Link` は endpoint の ID 参照を維持する
- node が別親や別 scope に移動しても `Link` 自体は消えない
- ただし viewer は scope 表示ポリシーに応じて非表示にしてよい

### Beta 実装で先に固定すること

- `AppState.links` を relation 集合として持てるようにする
- endpoint は実体ノードのみを対象とする
- self link は禁止する
- layout 非参加を前提に overlay 描画とする
- node-level `link` と graph-level `Link` を絶対に混同しない

### Beta 実装でまだ保留にすること

- relationType の語彙セット
- link label の編集 UI
- arrowhead と direction の表示仕様
- cross-scope link をどこまで常時表示するか
- alias endpoint を許可するか
- `.mm` import/export への写像

### Important Note

Freeplane-imported node-level `link` values and future graph-level `Link` relations are not the same thing.

- node-level `link`: external or attached link stored on a node
- graph-level `Link`: relation line between nodes inside the map

These must remain separate in model design.

## データベース選定方針

### 現時点の結論

Rapid MVP では、SQLite を persistence layer として採用する。

優先順位は以下とする。

1. 論理正本は JSON document model とする
2. Rapid MVP の永続化実装は SQLite とする
3. `.mm` は import/export 互換フォーマットとして維持する
4. PostgreSQL はサーバー要件が固まった段階で再評価する

### なぜ SQLite を採るか

MVP の主目的は以下である。

- viewer/editor を素早く成立させる
- save/load の境界を安定させる
- Freeplane `.mm` との往復可能性を保つ
- ローカルで壊れずに編集できることを優先する

SQLite は上記目的に対して、実装コストと運用コストを抑えつつ必要な永続化を提供できる。

- ローカル前提で完結できる
- デモ手順を単純化できる
- save/load デバッグがしやすい
- 将来の migration に備えた version 管理と相性が良い

### なぜ今は PostgreSQL を採らないか

Rapid MVP の現状課題は DB スケールではなく、編集体験・保存境界・表示安定性にある。
この段階で PostgreSQL のようなサーバー DB を先に入れると、以下の負債が増える。

- バックエンド実装
- 認証と接続管理
- マイグレーション運用
- 起動手順とデモ手順の複雑化
- 保存失敗時の原因切り分けの増加

### JSON を正本にする理由

- 現在の model は木構造であり、JSON で素直に表現できる
- `.mm` import/export と対応づけやすい
- デバッグ時に内容を直接読める
- 差分確認と fixture 化がしやすい
- migration を version フィールドで段階的に扱いやすい

特に MVP では、「保存内容を人間が読める」「壊れた時にすぐ確認できる」ことを重視する。

### PostgreSQL の再評価条件

- 複数端末同期が MVP 範囲に入る
- 共有編集またはユーザー単位の保存が必要になる
- 履歴、監査、検索をサーバー側で持つ必要が出る
- map がローカルファイル運用では扱いにくい規模になる
- バックアップ、復元、権限制御がプロダクト要件になる

### 将来 DB 導入時の第一候補

将来サーバー導入が必要になった場合の第一候補は PostgreSQL とする。

理由:

- 汎用性が高い
- JSONB を併用しやすい
- 関係データと半構造化データの両方を扱いやすい
- 将来の履歴、監査、共有機能に発展させやすい

ただしこれは「MVP 今すぐ採用」ではなく、「サーバー導入が必要になった時の有力候補」である。
