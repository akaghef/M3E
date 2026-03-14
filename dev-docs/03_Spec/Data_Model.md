# Data Model

## 目的

この文書は、M3E の実体モデルに関する不変条件を定義する。  
実装方式や UI に関係なく守るべき制約をここに置く。

## 基本要素

### Node

思考要素の最小単位。型は以下を持つ。

- `text`
- `image`
- `folder`
- `alias`

### Edge

主構造を表す親子関係。  
M3E の骨格は親から子への有向ツリーとする。

### Scope

`folder` を root とする可視性・編集範囲。  
scope はストレージ単位ではなく認知境界である。

## Node の必須属性

- 永続的な一意 ID
- node type
- 親 ID
- 子 ID の順序列
- 所属 scope
- 内容
- 作成時刻
- 更新時刻

## 型ごとの追加属性

### text

- 本文

### image

- 画像参照

### folder

- 下位階層の root として振る舞う識別

### alias

- 参照先 node ID

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

### alias 制約

- alias は実体ノードのみを参照できる
- alias から alias を参照しない

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
- MVC と command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
- Freeplane への写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
