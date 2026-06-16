# Layout Algorithm

## 目的

この文書は、M3E の独自描画エンジンにおける
ノード配置アルゴリズムの基本方針と実装単位を定義する。

MVP では、Miro の mind map を参考にした
自動整列中心のツリーレイアウトを採用する。

## レイアウト方針

- Miro mind map のように root を起点とした階層レイアウトを採用する
- auto layout を既定で ON にする
- ノード移動や再親付け後に、子孫は自動で整列する
- 手動移動は許すが、MVP では最終的に `Layout nodes` 相当で整列できるようにする
- depth-axis 展開（左右）と breadth-axis 展開（上下）の両方向を将来視野に入れるが、MVP の標準は `horizontal-right`（depth 軸が右方向）とする

## 前提

- 主構造は親子ツリーである
- 初期 MVP では横方向に展開するツリーを採用する
- レイアウト計算は描画技術から分離する
- SVG と Canvas のどちらでも同じレイアウト結果を使えるようにする

## レイアウト層の責務

- 各ノードの矩形サイズを受け取る
- 各ノードの配置座標を計算する
- 親子エッジの接続点を計算する
- 折り畳み状態を考慮する
- 再計算範囲を限定する
- `auto layout` と `layout nodes` の両方を支える

## 入力

### 必須入力

- `rootId`
- 親子関係
- 子順序
- 各ノードの表示サイズ
- 折り畳み状態
- レイアウト設定

### レイアウト設定

- `direction`
- `levelGap`
- `siblingGap`
- `paddingX`
- `paddingY`
- `nodeAnchor`
- `edgeStyle`
- `autoLayout`

### direction

- `horizontal-right`
- `vertical-down`

MVP の既定値は `horizontal-right`。

## 出力

### NodeLayout

- `nodeId`
- `x`
- `y`
- `width`
- `height`
- `subtreeWidth`
- `subtreeHeight`

### EdgeLayout

- `fromNodeId`
- `toNodeId`
- `startX`
- `startY`
- `endX`
- `endY`

## 基本方針

### 1. 二段階で計算する

1. 下から上へ部分木サイズを集計する
2. 上から下へ実座標を割り当てる

### 2. ノード矩形は先に確定させる

レイアウト層はテキスト折り返しやフォント計測そのものを持たない。
矩形サイズは上流から受け取る。

### 3. 折り畳みは部分木の切り落としとして扱う

- 折り畳まれたノードは子を持たないものとして計算する
- 展開時だけ子孫を再計算対象に含める

### 4. 安定性を優先する

Miro 的な操作感に寄せるため、
編集後に位置が大きく飛びにくいことを優先する。

## MVP の標準レイアウト

### horizontal-right

depth 軸が右方向、breadth 軸が下方向のレイアウト。

- root を左側に置く
- 子（depth 方向）は右方向へ展開する
- 兄弟ノード（breadth 方向）は縦に積む
- 親は子部分木の中央付近に置く

### vertical-down

depth 軸が下方向、breadth 軸が右方向のレイアウト。

- root を上側に置く
- 子（depth 方向）は下方向へ展開する
- 兄弟ノード（breadth 方向）は横に並べる
- 親は子部分木の中央付近に置く

## 最小アルゴリズム

### Pass 1: 部分木サイズ計算

各ノードについて再帰的に以下を計算する。

- `subtreeWidth`
- `subtreeHeight`

計算規則:

- 葉なら自矩形サイズを返す
- 子があるなら方向に応じて主軸方向と副軸方向を合成する
- sibling gap は兄弟数に応じて加算する

### Pass 2: 実座標割り当て

親の基準点から子列の開始位置を求め、
順番に子へ `x` `y` を配る。

horizontal-right の規則（depth 軸 = X、breadth 軸 = Y）:

- 子の `x = parent.x + parent.width + levelGap`（depth 方向）
- 子の `y` は兄弟列開始位置から順に加算する（breadth 方向）

vertical-down の規則（depth 軸 = Y、breadth 軸 = X）:

- 子の `y = parent.y + parent.height + levelGap`（depth 方向）
- 子の `x` は兄弟列開始位置から順に加算する（breadth 方向）

## auto layout

MVP では Miro を参考に、
親ノード配下の整列は既定で自動化する。

### auto layout ON

- add 後に新規ノードを自動整列する
- edit によりサイズが変わったら祖先列を再整列する
- reparent 後に旧親系統と新親系統を再整列する
- move で親ノードを動かした場合、子孫も一緒に移動する

### auto layout OFF

- 将来拡張として許容する
- MVP では UI フラグだけ先に置いてもよい
- OFF でも `Layout nodes` で再整列できるようにする

## Layout nodes

Miro の `Layout nodes` を参考に、
乱れた部分木を再整列する明示操作を用意する。

- 対象は選択ノードを root とする部分木
- ViewState の仮オフセットは無視する
- 現在の子順序を維持したまま整列する

## move と reparent の区別

Miro の mind map では、
ドラッグ時に親変更と単純移動の扱いが分かれている。
M3E でも内部的に次のように分ける。

- node move: 同一部分木を平行移動する ViewState 操作
- node reparent: 親子関係を変更する Command 操作

MVP では structure first を優先し、
意味のある移動は原則 reparent として扱う。

## インクリメンタル更新

再計算単位は次で切る。

- add: 追加ノードの祖先列
- edit: サイズ変更ノードの祖先列
- delete: 削除元の祖先列
- reparent: 旧親系統と新親系統の両方
- collapse: 対象部分木と祖先列
- layout-nodes: 対象部分木全体

## ViewState との分離

レイアウト結果は正本の構造配置であり、
ドラッグ中の仮位置は含めない。

- 正式座標は LayoutResult
- ドラッグ中の一時オフセットは ViewState
- drop 確定後に再レイアウトする

## エッジ描画の考え方

Miro は straight / curved の見た目切替を持つ。
M3E でも MVP でその余地を残す。

- 始点は親矩形の主軸側中央
- 終点は子矩形の対向側中央
- `edgeStyle = straight | curved`
- Layout は接続点を返し、実際の path 生成は Rendering Layer が持つ

## 受け入れ基準

- 同じ木構造なら毎回同じ座標が出る
- 兄弟順序変更が表示順に反映される
- add/edit/delete/reparent 後に整合した配置が得られる
- `Layout nodes` で部分木を再整列できる
- 500 ノード規模で致命的な遅延がない

## 今後の拡張

- 左右両側展開
- auto layout ON/OFF の完全実装
- scope ごとの帯域レイアウト
- ノード重要度に応じた間隔調整
- 部分木固定と自動整列の併用

## 参考

この方針は、Miro 公式ヘルプの mind map の挙動
`horizontal / vertical`、`auto layout`、`Layout nodes`、`reassign` を参考にしている。

**軸の定義（本プロジェクト統一用語）:**

| 用語 | 意味 | horizontal-right での方向 |
|---|---|---|
| depth 軸 | 親子方向（root → leaf） | 左→右（X 軸） |
| breadth 軸 | 兄弟方向（同深度の横並び） | 上→下（Y 軸） |
| abstraction 軸 | 抽象度レベル（将来） | 奥行き |

## 関連文書

- MVC と command: [./MVC_and_Command.md](./MVC_and_Command.md)
- ドラッグ操作: [./Drag_and_Reparent.md](./Drag_and_Reparent.md)
- 編集設計: [./Editing_Design.md](./Editing_Design.md)
- 帯域仕様: [../03_Spec/Band_Spec.md](../03_Spec/Band_Spec.md)

## Edge vs Link

`Edge` and `Link` should be handled in different phases.

### Edge

- generated from tree structure
- required for structural readability
- affects placement assumptions
- belongs to the main layout output

### Link

- generated after layout as an overlay pass
- does not affect node coordinates
- may use different routing from structural edges
- may be toggled separately in the renderer

### Implementation Direction

Recommended pipeline:

1. place nodes from the tree
2. generate structural `EdgeLayout`
3. generate overlay `LinkLayout`
4. render `Edge` first, `Link` second, interaction highlights last
