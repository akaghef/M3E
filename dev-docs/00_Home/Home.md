# Home

## M3E とは何か
 M3Eは科学研究のための枠組(フレームワーク)思考​支援を
目的としたGraph構造UIのツールです。目標として
チャット形式のLLMの進化版となり、世界モデルを構築して
可視化・外在化し、意思決定を加速することを掲げます。
特徴としてこの文章のように構造と文章の相互変換、
構造(情報)の直接的な操作/やり取り、Flash/Rapid/Deepの
3つの思考の帯域のモード、範疇(Scope)の制御が有ります。
​

M3E は、科学研究を中心とした個人オフライン前提の思考ツールである。  
主目的は、研究の論点整理、仮説形成、比較、設計判断を、構造を保ったまま進められるようにすることにある。

現時点では、独自エディタを先に完成させるのではなく、Freeplane を土台にして思考支援の有効性を検証する方針を採る。  
独自実装へ進む場合も、UI 全体は React コンポーネントで組み、マップ描画だけを独立したレンダリング層として切り出す。

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

- 科学研究を前に進めるための思考支援を主目的にする
- 構造は親子を主軸に保つ
- scope (範疇)で認知境界を制御する
- alias で他スコープを参照する
- AI は提案し、人間が確定する

### Strategy

現段階では、科学研究の思考支援として価値があるかの検証を優先する。  
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
- UI shell は React コンポーネントで構成する
- マップ描画は React から分離した専用レンダリング層として扱う
- ドラッグ中の一時状態は ViewState に置く

## 読むべき優先順

1. 原則を確認する
2. 現在のピボットを確認する
3. MVP の範囲を確認する
4. 仕様とアーキテクチャに降りる
5. Freeplane との対応を確認する
6. 旧前提が必要なら `legacy/` を参照する
