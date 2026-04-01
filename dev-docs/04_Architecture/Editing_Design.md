# Editing Design

## 目的

この文書は、M3E の独自描画エンジン上で行う
編集操作の詳細設計を定義する。

## 対象操作

- add
- edit
- delete
- reparent
- collapse / expand
- selection change

このうち正本を変更するのは
`add` `edit` `delete` `reparent` のみとする。

## 基本原則

- 正本変更は必ず Command 経由
- ドラッグ中や入力中の仮状態は ViewState に置く
- Controller は操作解釈を行う
- Model は最終整合性を持つ
- レイアウト再計算は Command 成功後に行う

## 編集状態

### Idle

何も操作していない通常状態。

### Pressed

対象ノードを押下したが、
まだ click か drag か確定していない状態。

### EditingText

ノード本文を入力中の状態。
未確定テキストは ViewState に保持する。

### Dragging

ノードを移動中の状態。
仮位置と drop 候補は ViewState に保持する。

## Command 一覧

### AddNodeCommand

- `parentId`
- `index`
- `nodeType`
- `initialContent`
- `createdNodeId`

### EditNodeCommand

- `nodeId`
- `before`
- `after`

### DeleteNodeCommand

- `rootNodeId`
- `parentId`
- `index`
- `deletedSubtreeSnapshot`

### ReparentNodeCommand

- `nodeId`
- `fromParentId`
- `toParentId`
- `fromIndex`
- `toIndex`

### CollapseNodeCommand

- `nodeId`
- `beforeCollapsed`
- `afterCollapsed`

`collapse` は ViewState に置く案もあるが、
MVP では表示再現性のため Command 化してよい。

## 各操作の詳細

### add

発火例:

- Enter で子追加
- ツールバーから追加
- ノード横の plus 操作

処理:

1. Controller が親ノードと挿入位置を決める
2. `AddNodeCommand` を生成する
3. Model が ID を確定し、親の子列へ挿入する
4. 成功後に新規ノードを選択状態にする
5. 必要なら即座に `EditingText` に入る

### edit

発火例:

- ダブルクリック
- Enter
- サイドパネル編集

処理:

1. ViewState に編集中テキストを持つ
2. 確定時に `EditNodeCommand` を生成する
3. Model が内容更新と時刻更新を行う
4. サイズが変わるならレイアウト再計算対象に入れる

### delete

発火例:

- Delete キー
- コンテキストメニュー

処理:

1. Controller が削除対象を確定する
2. 必要なら確認 UI を出す
3. `DeleteNodeCommand` を生成する
4. Model が対象部分木を除去する
5. 選択は兄弟、親、または null へ安全に移す

### reparent

処理:

1. pointerdown で Pressed
2. 閾値超えで Dragging
3. HitTest で drop proposal を更新する
4. pointerup で proposal に応じて `ReparentNodeCommand` を組み立てる
5. Model が循環と制約を検証する

drop proposal の定義:

- ノード中央帯に drop した場合:
  - 対象ノードを新しい親とする `reparent`
- ノード上端帯または下端帯に drop した場合:
  - 対象ノードの親配下での `reorder`
- sibling 間の空白帯に drop した場合:
  - その親配下の gap 位置への `reorder`

補足:

- `reorder` は別操作ではなく、`toParentId` と `toIndex` を伴う `reparent` の一形態として扱う
- 同一親への並べ替えも `ReparentNodeCommand` で表現してよい
- drop 成功時に親ノードを自動 expand しない

### collapse / expand

処理:

1. 対象ノードを確定する
2. `CollapseNodeCommand` を生成する
3. Model が折り畳み状態を更新する
4. 部分木レイアウトを再計算する

## Model 側の検証

### add

- 親が存在するか
- index が妥当か
- node type が許可範囲か

### edit

- 対象ノードが存在するか
- 内容制約に違反しないか

### delete

- root 削除を許可するか
- scope 制約を壊さないか
- alias の参照切れをどう扱うか

### reparent

- 自分自身への移動でないか
- 子孫への移動でないか
- scope 制約を壊さないか
- alias 制約を壊さないか
- index が妥当か
- 同一親内 reorder で、削除後基準の `toIndex` が妥当か

## Undo/Redo 要件

- すべての正本変更操作は巻き戻せる
- Command は逆操作に必要な情報を保持する
- Undo 後に選択状態をどう戻すかは ViewState 側で補助してよい

## Selection の扱い

選択は ViewState に置く。

- `selectedNodeId`
- `multiSelectedNodeIds`
- `anchorNodeId`

MVP では単一選択だけでもよい。

## Text Editing の扱い

編集中テキストは即時に Model へ書かない。

- 入力中は ViewState
- 確定時のみ Command
- Esc で破棄
- Enter の振る舞いは単一行か複数行かで分ける

## エラー処理

- 不正 reparent は Model が拒否する
- Controller は失敗理由を UI へ返す
- 失敗時も正本は不変
- Dragging 中の候補表示は即時に消す

## 実装順

1. selection
2. add
3. edit
4. delete
5. collapse / expand
6. reparent
7. undo / redo

## 受け入れ基準

- add/edit/delete/reparent がすべて Command 経由で動く
- 失敗操作で正本が壊れない
- Undo/Redo で構造と順序が戻る
- drag 中に正本が書き換わらない
- text 編集中にキャンセルできる

## 関連文書

- MVC と command: [./MVC_and_Command.md](./MVC_and_Command.md)
- ドラッグ操作: [./Drag_and_Reparent.md](./Drag_and_Reparent.md)
- データモデル: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
