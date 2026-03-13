# Drag and Reparent

## 目的

ノードのドラッグによる親付け替えを、Model を壊さずに扱うための操作設計を定義する。

## 基本原則

- ドラッグ中は Model を更新しない
- 見た目の追従は ViewState で表現する
- drop 確定時だけ Command を発行する
- 最終的な整合性判定は Model が行う

## 状態遷移

### 1. pointerdown

- Controller が HitTest で対象ノードを取る
- `Pressed(nodeId)` 相当の内部状態に入る
- 必要なら ViewState に開始位置を記録する

### 2. pointermove で閾値超え

- `Dragging(nodeId)` に遷移する
- ViewState の仮位置を更新する
- drop 候補を HitTest して hover 対象を更新する

### 3. pointermove 継続

- 仮位置を更新し続ける
- 候補親のハイライトを更新する
- View は ViewState に基づいて再描画する

### 4. pointerup

- 最終 drop 対象を確定する
- Controller が reparent 用 Command を組み立てる
- `Model.apply(command)` を呼ぶ
- 成功後に ViewState をクリアする

## Reparent Command の最小要素

- `nodeId`
- `fromParentId`
- `toParentId`
- `fromIndex`
- `toIndex`

## Controller 側で見てよいこと

- 自分自身への drop でないか
- 明らかに無効な対象でないか
- UI 上の候補親表示

## Model 側で必ず見ること

- 循環が起きないか
- scope 制約を壊さないか
- alias 制約を壊さないか
- 順序更新が妥当か

## Undo/Redo

- Reparent は必ず元の親情報を保持する
- Undo で親と順序を元に戻せるようにする

## 関連文書

- MVC と command: [./MVC_and_Command.md](./MVC_and_Command.md)
- scope 制約: [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)
