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
- 所属 scope（構造から導出される）
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

### scope 導出ルール（正規化）

- `scopeId` はノードに永続化しない
- ノードの所属 scope は、祖先列で最も近い `folder` ノード ID から導出する
- 祖先に `folder` が無いノードは document `rootId` に属するとみなす
- `reparent` 時の scope 変更は `parentId` / `children` 更新のみで表現し、scope のカスケード更新は行わない

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
- state分離と schema v2: [./Model_State_And_Schema_V2.md](./Model_State_And_Schema_V2.md)
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
