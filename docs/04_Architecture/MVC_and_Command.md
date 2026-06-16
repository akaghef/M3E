# MVC and Command

## 目的

この文書は、M3E を独自実装する場合の責務分離の基本線を定義する。  
現行方針では、UI shell は React コンポーネントで構築し、マップ描画は独立したレンダリング層として扱う。

## 採用方針

- Core は Model 中心
- 操作は Command パターンで表す
- Undo/Redo は Model が管理する
- ViewState を Model から分離する
- UI レイアウトは React コンポーネントで組む
- レンダリング層は React から交換可能な境界として分離する

## 責務分離

### Model

- Node / Edge / Graph 構造
- 整合性検証
- Command 適用
- Undo / Redo
- 永続化

### UI Shell

- React によるパネル構成
- ツールバー
- 検索
- 設定
- ステータス表示

### Rendering Layer

- マップ描画
- 見た目の更新
- HitTest を支える表示情報
- Canvas / SVG など具体描画技術の実装

### Controller

- ブラウザ入力の解釈
- HitTest の利用
- Command 生成
- ViewState 更新
- UI Shell と Rendering Layer の橋渡し

### ViewState

- カメラ
- 選択状態
- hover
- drag 中の仮位置
- 一時ハイライト

## 基本フロー

1. Browser event が UI Shell または Rendering Layer から Controller に入る
2. Controller が必要なら HitTest を行う
3. Controller が Command を生成する
4. `Model.apply(command)` を呼ぶ
5. Model が整合性を確認して更新する
6. Model が変更通知を出す
7. UI Shell と Rendering Layer が必要な部分だけ更新する

## Command を採用する理由

- Undo/Redo を自然に実装できる
- 変更の入口を 1 箇所に寄せられる
- 差分表示の土台になる
- データ消失や不整合の調査がしやすい

## ViewState を分ける理由

- ドラッグ中の一時表示で正本を汚さない
- カメラや選択は永続データと性質が違う
- UI 操作を軽く保てる
- React の再構成と描画面の一時状態を切り分けやすい

## この構成を採る理由

- AI がコード生成しやすい
- 部品単位で差し替えや修正がしやすい
- 描画技術の選定を後ろに倒せる
- 初期段階の実装速度を優先できる

## 重要な設計ルール

- 正本の変更は Model 経由のみ
- Controller は最終整合性を持たない
- 明らかな不正操作の事前チェックは Controller でよい
- 最終責任は Model が持つ
- React には業務 UI を持たせ、コアロジックは持たせない
- Rendering Layer は UI フレームワークに依存させすぎない

## 関連文書

- ドラッグ操作: [./Drag_and_Reparent.md](./Drag_and_Reparent.md)
- データモデル: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
- 判断理由: [../09_Decisions/ADR_002_React_UI_Basis.md](../09_Decisions/ADR_002_React_UI_Basis.md)
