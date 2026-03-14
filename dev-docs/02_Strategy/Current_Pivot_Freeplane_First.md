# Current Pivot: Freeplane First

## 判断

当面の M3E は、独自エディタを先に作るのではなく、Freeplane を土台にした科学研究向け思考支援レイヤーとして進める。

## 背景

独自エディタを早期に作り込むと、以下のコストが大きい。

- 描画基盤
- IME を含む入力制御
- 保存と復元の信頼性
- Undo/Redo の整合性
- 日常運用での操作感の調整

これらは重要だが、いま最優先なのは「M3E の研究支援が本当に価値を持つか」の検証である。

## 何を Freeplane に任せるか

- 日常の入力
- 既存のツリー編集
- 折り畳みと構造閲覧
- ベースとなるマップ保存

## 何を M3E 側で担うか

- 構造の読み取り
- 論点分解
- 比較軸整理
- 仮説整理
- 研究設計の整理
- AI へのコンテクスト変換
- 提案差分の提示

## この方針の利点

- 独自 UI 実装の負債を先送りできる
- 思考支援の価値検証に集中できる
- 既存ツール上で日常運用を始めやすい
- 独自実装が必要かどうかを後で判断できる

## この方針の制約

- scope / alias / command を Freeplane がそのまま表現できるわけではない
- M3E の中核モデルを Freeplane の内部表現に委ねるべきではない
- 将来的に独自モデルへ戻る余地を残す必要がある

## 結論

Freeplane は最終形ではなく、検証フェーズの土台である。  
M3E の価値は描画そのものではなく、研究構造を読み替えて思考を進めることにある。

## 関連文書

- MVP 定義: [./MVP_Definition.md](./MVP_Definition.md)
- Freeplane との写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
- ADR: [../09_Decisions/ADR_001_Freeplane_First.md](../09_Decisions/ADR_001_Freeplane_First.md)
