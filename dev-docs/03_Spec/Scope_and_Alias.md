# Scope and Alias

## なぜ scope が必要か

ファイルやタブの開閉だけでは、思考対象の境界をうまく制御できない。  
M3E は storage boundary ではなく cognition boundary を扱うために scope を導入する。

## Scope の定義

scope は `folder` を root に持つ局所世界である。  
ここで以下を制御する。

- 何が見えるか
- どこまで編集できるか
- どの構造を同時に考えるか

実装上は `scopeId` を各ノードに保存せず、親子構造から所属 scope を導出する。

## Scope の原則

### 閉包性

- 原則として scope 内で思考を完結させる
- 外部の情報は既定で露出しない

### 局所性

- 日常操作は現在 scope に最適化する
- 全体俯瞰は要約された形で扱う

### 往復可能性

- folder を開くとその folder world に入る
- 戻る操作で迷子にならないことを重視する

## Alias の役割

alias は、他 scope の実体を複製せずに参照するための窓である。

## Alias の原則

- alias は参照専用である
- 実体の正本は 1 箇所だけに置く
- 他 scope へ見せたいときだけ alias を置く
- alias から alias は辿らない

## Scope と Alias の組み合わせで解く問題

- 見えすぎることで集中が崩れる
- 同じノードを複製して整合性が壊れる
- 全体と局所の往復が煩雑になる

## UI/UX 上の含意

- 現在 scope 外の情報は常時表示しない
- 外部参照は alias や明示的導線でのみ見せる
- rename / move / delete 時は alias 表示との整合を保つ

## 関連文書

- 原則: [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
- 実体モデル: [./Data_Model.md](./Data_Model.md)
