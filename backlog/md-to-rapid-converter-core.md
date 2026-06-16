# md群 → Rapid tree 変換器（PJ02 本丸）

## 背景
- 研究活動は F→R→D→R→D... の反復サイクル
- M3E の本質的価値は **md群 → syntax tree 表示 (Rapid) → semantics tree (Deep)** の変換にある
- この変換器が現在欠けている

## やること
- markdown ファイル群を M3E の TreeNode 構造（Rapid）に変換する importer
- md の見出し階層 → 親子 edge、段落 → ノード text
- Blueprint dep_graph → Rapid も同系統の変換器（Codex 委任）

## 設計上の問い
- md の見出し階層は is-a? part-of? → edge protocol（edgeType）と直結
- 複数 md 間の参照関係（引用・cross-ref）→ GraphLink relationType
- 変換時に edgeType を自動推定するか、後付けか

## 位置づけ
- PJ02 edge protocol の最初のユースケース
- Blueprint importer と合わせて「→ Rapid 変換器」ファミリーを形成
- strategy S4 (dogfood) + S5 (Blueprint-first) の合流点

*2026-04-17*
