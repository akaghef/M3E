# Editing Design

## 目的

この文書は、M3E の独自描画エンジン上で行う
編集操作の詳細設計を定義する。

## 対象操作

- add
- edit
- delete
- reparent
- marquee selection
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

## 用語

- `drag pan`: 主ボタンを押したまま空白領域をドラッグして viewport を動かす操作
- `two-finger pan`: trackpad の二本指移動、または同等のホイール入力で viewport を動かす操作
- 本文書で `pan` とだけ書く場合は、以後は `two-finger pan` を指す

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

### MarqueeSelecting

キャンバス上の空白領域から範囲選択を行っている状態。
選択矩形と暫定選択集合は ViewState に保持する。

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

- Enter で同階層（breadth）追加し、新規ノード編集へ入る
- Tab で子（depth）追加し、新規ノード編集へ入る
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
- F2
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

### marquee selection

目的:

- 余白ドラッグを viewport pan ではなく範囲選択へ置き換える
- 近接ノードをまとめて選択し、後続の delete / move / inspect の前段操作に使えるようにする

処理:

1. 空白領域の `pointerdown` で `MarqueeSelecting` に入る
2. `pointermove` で選択矩形を ViewState に保持する
3. 可視ノード矩形との交差判定で暫定選択集合を更新する
4. `pointerup` で暫定選択集合を `multiSelectedNodeIds` へ反映する
5. 選択矩形をクリアし、必要なら `anchorNodeId` を更新する

入力ルール:

- ノード上ドラッグは従来どおり `reparent` / `reorder`
- 空白領域上の主ボタンドラッグは `marquee selection`
- 単クリック空白は選択解除
- `Shift` 押下中の marquee は既存選択への追加
- `Alt` または `Meta/Ctrl` を使う減算選択は MVP では保留としてよい

HitTest ルール:

- 対象は可視ノードのみ
- 判定単位はラベル文字列ではなくノードの表示矩形全体
- 部分交差で選択扱いにする
- collapse された部分木の不可視子は対象外

ViewState 追加候補:

- `marqueeState`
- `multiSelectedNodeIds`
- `anchorNodeId`

`marqueeState` の最小要素:

- `pointerId`
- `startX`
- `startY`
- `currentX`
- `currentY`
- `mode` (`replace` / `add`)
- `previewNodeIds`

描画ルール:

- 選択矩形は半透明 fill + 明瞭な border で表示する
- marquee 中に選択される予定のノードは通常選択と別スタイルで preview 表示する
- `selectedNodeId` は単一選択の主カーソルとして残し、複数選択時は anchor を優先表示してよい

制約:

- marquee 自体は Command を発行しない
- marquee 中は Model を更新しない
- inline edit 中は marquee を開始しない
- drag reparent と marquee selection は同時に成立させない

パン操作の扱い:

- 主ボタンの空白ドラッグによる `drag pan` は廃止する
- wheel / trackpad による `two-finger pan` は維持する
- マウス主体ユーザー向けの代替 viewport 移動ジェスチャは別途決める

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
ただし marquee selection を入れる段階で複数選択の保持は必要になる。

## Text Editing の扱い

編集中テキストは即時に Model へ書かない。

- 入力中は ViewState
- 確定時のみ Command
- Esc で破棄
- Shift+Enter でノード内改行（複数行入力）
- Enter は改行ではなく確定後に同階層ノード追加へ使う
- Tab は確定後に子ノード追加へ使う

## エラー処理

- 不正 reparent は Model が拒否する
- Controller は失敗理由を UI へ返す
- 失敗時も正本は不変
- Dragging 中の候補表示は即時に消す
- marquee 中に候補ノードが 0 件でもエラーにしない
- marquee 完了時に選択対象が 0 件なら空選択として扱う

## 実装順

1. selection
2. marquee selection
3. add
4. edit
5. delete
6. collapse / expand
7. reparent
8. undo / redo

## 受け入れ基準

- add/edit/delete/reparent がすべて Command 経由で動く
- 失敗操作で正本が壊れない
- Undo/Redo で構造と順序が戻る
- drag 中に正本が書き換わらない
- text 編集中にキャンセルできる
- 空白ドラッグで marquee が表示され、可視ノードの複数選択が成立する
- ノードドラッグ時は marquee に遷移せず、従来どおり reparent 系判定が優先される
- `two-finger pan` が marquee 導入後も壊れない

## 関連文書

- MVC と command: [./MVC_and_Command.md](./MVC_and_Command.md)
- ドラッグ操作: [./Drag_and_Reparent.md](./Drag_and_Reparent.md)
- データモデル: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
