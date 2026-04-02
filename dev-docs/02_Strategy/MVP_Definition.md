# MVP Definition

## MVP の目的

M3E の MVP は、Freeplane を参考にしつつ、
独自描画エンジンと独自操作系を持つ研究思考支援ツールの最小成立形を示すことである。
Freeplane の `.mm` マップは互換入力形式として受け取り、
研究思考支援に向けた最小の操作可能性を示す。

## MVP の一貫した定義

MVP で成立している状態を、以下の 4 点で定義する。

1. Freeplane の `.mm` を安定して読み取れる
2. M3E の最小モデルへ変換できる
3. 独自描画と最小編集操作を安全に扱える
4. 保存と再読込まで含めて日常利用で破綻しない

この段階では高度な UI 完成度までは要求しないが、
独自描画面が動いていること自体は MVP の成立条件に含める。

## 実装の起点

- MVP は Rapid 帯域の最小実装から始める
- Flash と Deep は後続フェーズで段階的に実装する
- 今週は「Rapid で迷わず編集できること」を最優先にする

## Freeplane をどう使うか

- Freeplane は参考実装および互換入力形式として使う
- 最初の対象は `.mm` ファイルの import/export とする
- Freeplane の UI や操作系をそのまま土台にはしない
- Freeplane の内部概念に M3E 全体を押し込まない
- `scope` `alias` などの M3E 固有概念は M3E 側の外部モデルで持つ

## MVP で必須のこと

### 1. 構造を読める

- Freeplane のマップ構造を読み取れる
- ノード階層を安定して取得できる
- 最低限の属性を扱える

最低限の属性:

- `id`
- `parentId`
- `children`
- `text`
- `details`
- `note`
- `attributes`
- `link`

### 2. M3E 最小モデルへ変換できる

- Freeplane ノードを M3E ノードへ変換できる
- 主構造は親子ツリーとして保持できる
- `scope` は最初は推論対象または未設定でよい
- M3E 固有意味は Freeplane の生属性から分離して保持する

### 3. コア編集を安全に扱える

- 独自描画面の上で編集できる
- ノード追加
- ノード編集
- ノード削除
- 再親付け
- Undo/Redo

### 4. 本当に簡単に操作できる

- ノードを選択してすぐ編集できる
- 主要操作が少ない手順で到達できる
- 説明なしでも基本操作を試せる

### 5. 保存して戻せる

- 保存前に不整合を検出できる
- 保存 -> 再読込で同一構造を再現できる
- Undo/Redo により編集事故を回復できる

## MVP で後回しにすること

- 高性能な独自レンダリング最適化
- 独自ドラッグ操作の作り込み
- 高度なリアルタイム同期
- マルチユーザー
- 課金や公開サービス化
- 完全な Deep 差分履歴
- Freeplane API やスクリプトとの密結合
- AI 提案生成と承認フロー

## UI 方針

- UI shell は React + TypeScript ベースで進める
- 描画は SVG 先行でよい
- 描画層はレイアウト層と分離する
- Canvas 移行可能性を保つため、描画面は差し替え可能な境界を持たせる
- 独自描画面は MVP の一部である

## Freeplane から参考にする部分

Freeplane から直接学ぶ価値が高いのは次の部分である。

- `.mm` の XML ベース構造
- ノードの `text` `details` `note` `attributes` `link`
- 折り畳み、ノード順序、ローカル保存
- 既存の import/export と autosave の考え方

逆に、そのまま採用しないものは次の通り。

- M3E 固有の `scope`
- alias による厳密参照制約
- command ベースの変更履歴
- AI 提案と承認フロー (MVP 後)

## MVP タスク一覧

### Phase 1: 読み取り基盤

1. Freeplane `.mm` 入力の最小実装
2. ノード階層パーサ実装
3. M3E 最小モデルへの変換
4. 整合性バリデータ実装

受け入れ基準:

- サンプル 10 マップでクラッシュせず読み取れる
- ツリー整合性エラーが明示される

### Phase 2: コア編集機能

1. ノード追加
2. ノード編集
3. ノード削除
4. 再親付け
5. Undo/Redo

受け入れ基準:

- 4 操作すべてが Command 経由で実行される
- Undo/Redo 連続 30 回で状態破綻しない

### Phase 3: コア表示機能

1. ノードと親子エッジの基本描画
2. 選択ノードの可視化
3. パン、ズーム、ノード中心移動
4. 500 ノード規模で最低性能確認

受け入れ基準:

- 編集から描画更新まで 3 ステップ以内で確認できる
- 500 ノードで致命的な遅延がない
- 独自描画面の上で基本編集が成立する

### Phase 4: 保存と保護

1. 保存形式に version を付与
2. 保存前検証
3. バックアップ保存
4. 保存後再読込テスト

受け入れ基準:

- 不正状態保存を拒否できる
- 保存後再読込で同一構造が復元される

### Phase 5: 操作性の最終調整

1. 主要操作の導線を短くする
2. 操作ラベルと状態表示を整理する
3. 初見ユーザーでの簡易操作確認を行う

受け入れ基準:

- 主要操作が迷わず実行できる
- 最低 1 セッションを詰まらず完了できる

## MVP 完了判定

以下を満たしたら MVP とみなす。

- `.mm` を安定して読める
- 独自描画面で基本表示と基本編集ができる
- 最小編集が壊れずに動く
- 保存後再読込で同一構造を再現できる
- 初見でも基本操作を完了できる

## 関連文書

- 現在の方針: [./Current_Pivot_Freeplane_First.md](./Current_Pivot_Freeplane_First.md)
- データモデル: [../03_Spec/Data_Model.md](../03_Spec/Data_Model.md)
- Freeplane 対応: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
- 新 ADR: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
- UI 基盤判断: [../09_Decisions/ADR_002_React_UI_Basis.md](../09_Decisions/ADR_002_React_UI_Basis.md)
