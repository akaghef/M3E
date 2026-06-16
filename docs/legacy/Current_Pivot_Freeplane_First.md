# Current Pivot: Freeplane-Informed Custom Engine

## 判断

当面の M3E は、Freeplane をそのまま土台 UI として使うのではなく、
Freeplane を参考実装および互換入力形式として扱い、
描画と操作は M3E 側で自作する方針へ切り替える。

## 背景

Freeplane-first は、研究支援価値の検証を早く進めるうえでは有効だった。
しかし、M3E の独自価値が最終的に宿るのは、
研究思考に合った描画、操作、差分提示の設計そのものにある。

そのため、今後は次の前提で進める。

- Freeplane は参考実装として読む
- `.mm` は互換入力形式として扱う
- M3E の描画、操作、差分提示は独自実装する
- レイアウト、モデル、描画を分離して将来拡張しやすくする

## 何を Freeplane から学ぶか

- `.mm` の構造
- ノードの `text` `details` `note` `attributes` `link`
- 折り畳み、保存、既存運用の考え方
- マインドマップ編集で必要になる最低限の操作要件

## 何を M3E 側で自作するか

- 描画エンジン
- ヒットテスト
- 選択
- パン、ズーム
- ノード追加、編集、削除、再親付け
- Undo/Redo
- 構造の読み取りと変換
- 論点分解
- 比較軸整理
- 仮説整理
- 研究設計の整理
- AI へのコンテクスト変換
- 提案差分の提示

## この方針の利点

- M3E 固有の思考支援 UI を最初から設計できる
- Freeplane の制約に縛られずにモデル境界を保てる
- 描画と操作を一体で設計できる
- `.mm` 互換を保ちながら独自進化できる

## この方針の制約

- 初期の実装コストは Freeplane-first より上がる
- 描画、入力、永続化、Undo/Redo の品質を自分たちで担保する必要がある
- Freeplane 互換範囲を意識しつつ独自モデルを保つ必要がある

## 結論

Freeplane は最終形でも土台 UI でもなく、参考実装および互換入力形式である。
M3E は独自の描画エンジンと操作系を持つ研究思考支援ツールとして進める。

## 関連文書

- 帯域仕様: [../03_Spec/Band_Spec.md](../03_Spec/Band_Spec.md)
- Freeplane との写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
- 新 ADR: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
- 旧 ADR: [../09_Decisions/ADR_001_Freeplane_First.md](../09_Decisions/ADR_001_Freeplane_First.md)
