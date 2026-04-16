# 04. プロセス・ライフサイクル系ビュー

「ノードがどういう流れの中にいるか」を構造そのものに埋め込むビュー。
時間ではなく **概念的なステップ／ループ** が軸。

## ループ・反復系

### V61. OODA Loop（Observe / Orient / Decide / Act）

- 4象限ではなく円環、矢印で反復を表現
- ノードを4ステージのいずれかに配置
- 用途: 意思決定の高速ループ可視化、研究での観察→定位→判断→実行

### V62. PDCA Cycle（Plan / Do / Check / Act）

- 同上、4ステージ円環
- 用途: 改善サイクル、研究の計画→実験→検証→改善

### V63. Lean Build-Measure-Learn

- 3ステージ、矢印で輪
- 用途: プロトタイピング思考、MVP 検証

### V64. Double Diamond（Discover / Define / Develop / Deliver）

- 「広げる→絞る→広げる→絞る」の2連続ダイヤモンド
- 用途: デザイン思考、研究設計

### V65. Design Thinking 5段階

- Empathize / Define / Ideate / Prototype / Test
- ノードを段階別に配置
- 用途: ユーザー研究、UX デザイン

### V66. DMAIC（Define / Measure / Analyze / Improve / Control）

- Six Sigma 改善プロセス
- 用途: 定量改善プロジェクト

### V67. Hypothesis Cycle

```
Question → Hypothesis → Experiment → Analysis → Refined hypothesis → ...
```

- 用途: 科学研究の核
- M3E 適用: 研究マップの中核ビューになりうる

## 階層・段階系

### V68. Maslow's Hierarchy（ピラミッド5段）

- 下から上に階層、下層が前提
- 用途: 必要条件の可視化、依存階層
- 適用例: 「論文を書く」の下に「データ揃える」「文献読む」「スペース取る」

### V69. Bloom's Taxonomy（教育目標分類）

- Remember / Understand / Apply / Analyze / Evaluate / Create
- 用途: 学習設計、自分の知識レベル評価

### V70. DIKW Pyramid（Data / Information / Knowledge / Wisdom）

- データから智恵への階層
- 用途: ノートの抽象度分類、知識整理

### V71. Iceberg Model（4階層: Events / Patterns / Structures / Mental Models）

- 表層から深層へ
- 用途: システム思考、根本原因分析
- 適用例: バグ→バグの傾向→構造的問題→メンタルモデルのズレ

### V72. Cynefin Framework

```
Complex     │ Complicated
─────────────┼─────────────
Chaotic     │ Simple (Clear)
                   Disorder (中央)
```

- 用途: 状況分類と対応策の選択
- 適用例: タスクの難易度／不確実性分類

### V73. SECI モデル（暗黙知 ↔ 形式知の4変換）

- Socialization / Externalization / Combination / Internalization
- 用途: 知識創造プロセス、研究室の知識共有設計

### V74. Maturity Model（5段階成熟度）

- Initial / Repeatable / Defined / Managed / Optimizing
- 用途: プロセス成熟度、研究テーマの熟成度

## 因果・ロジック系

### V75. Fishbone / Ishikawa Diagram

- 中心問題、骨に原因カテゴリ
- 用途: 問題の根本原因探索

### V76. Five Whys

- 1問題 → 5回 "Why" を縦展開
- 用途: 根本原因への深掘り

### V77. Logic Tree / Issue Tree

- 上位問題から論理的に分解
- 用途: 仮説整理、研究問題の構造化

### V78. Theory of Change

- インプット → 活動 → アウトプット → アウトカム → インパクト
- 用途: 研究や事業の影響経路設計

### V79. Causal Loop Diagram

- 変数 + 矢印で正負ループ
- 用途: システム思考、フィードバックループ分析

### V80. Pre-mortem View

- 「失敗した」と仮定して失敗要因を列挙する平面
- 用途: リスク予測、計画の脆弱性発見

## 階層的タスク管理系

### V81. GTD Workflow View

- Capture → Clarify → Organize → Reflect → Engage
- 用途: GTD 実践者向けタスク管理ビュー

### V82. PARA Layout（Projects / Areas / Resources / Archive）

- 4カテゴリにノード配置
- 用途: ノートシステム整理（Tiago Forte 流）
- M3E 適用: scratch / strategy / archive の整理基準

### V83. Zettelkasten View

- 完全フラット + リンクのみ
- 用途: ニクラス・ルーマン式ノート、研究ノート
- 既存 M3E のグラフ性能を活用しやすい

### V84. Inbox-Now-Next-Later-Someday View

- 5列カンバンの一種だが時間距離特化
- 用途: 個人タスク管理、Things 風

## 評価・優先付け系

### V85. MoSCoW（Must / Should / Could / Won't）

- 4区分にノード配置
- 用途: 要件優先度、スコープ判断

### V86. Kano Model

- 軸: 機能の充足度 × ユーザー満足度
- 領域: Basic / Performance / Excitement
- 用途: プロダクト機能の質的分類

### V87. RICE Score Layout

- Reach × Impact × Confidence ÷ Effort で順位、それを並べて見る
- 用途: 機能優先度、研究テーマ選別

### V88. Now / Next / Later（3列）

- シンプルな3区分
- 用途: ロードマップの低粒度版

## 共通の論点

- **Px1. ステージへの自動分類** — 属性から自動 / ユーザ手動 / AI 推定
- **Px2. ループの完了履歴** — サイクルを何周したか記録するか
- **Px3. ステージ間遷移の演出** — 静的配置 / アニメーション / 遷移ログ
- **Px4. 複数フレームワーク同時** — OODA で見つつ Cynefin でも色分け、等
- **Px5. フレームワーク自体の編集** — ステップ数・ラベル変更を許すか
