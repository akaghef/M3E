# Home

## M3E とは何か

M3E は、個人オフライン前提の思考整理環境である。  
目的は、情報管理ではなく「構造を保ったまま考えること」を支えることにある。

現時点では、独自エディタを先に完成させるのではなく、Freeplane を土台にして思考支援の有効性を検証する方針を採る。

## この文書群の使い方

- 思想から入りたい場合は [../01_Vision/Core_Principles.md](../01_Vision/Core_Principles.md)
- 今の方針を知りたい場合は [Current_Status.md](./Current_Status.md)
- 何を作るかを知りたい場合は [../02_Strategy/MVP_Definition.md](../02_Strategy/MVP_Definition.md)
- 実体モデルを知りたい場合は [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
- スコープ設計を知りたい場合は [../03_Spec/Scope_and_Alias.md](../03_Spec/Scope_and_Alias.md)
- 実装責務を知りたい場合は [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)

## 全体像

### Vision

M3E の核は次の 4 点である。

- 構造は親子を主軸に保つ
- scope で認知境界を制御する
- alias で他スコープを参照する
- AI は提案し、人間が確定する

### Strategy

現段階では、思考支援の価値検証を優先する。  
そのため、編集 UI・描画・永続化を最初から自作せず、Freeplane を既存の思考整理基盤として活用する。

### Spec

仕様の中核は次の通り。

- 実体ノードは永続 ID を持つ
- 実体ノードは単一スコープに属する
- alias は参照専用であり alias から alias は辿らない
- 帯域は Flash / Rapid / Deep の 3 つ

### Architecture

独自実装へ進む場合の基本線は以下で固定する。

- Model が整合性と履歴を持つ
- Controller が入力を解釈して Command を作る
- View は描画に専念する
- ドラッグ中の一時状態は ViewState に置く

## 読むべき優先順

1. 原則を確認する
2. 現在のピボットを確認する
3. MVP の範囲を確認する
4. 仕様とアーキテクチャに降りる
5. Freeplane との対応を確認する
