# 05. 研究・知識整理に特化したビュー

M3E が研究思考支援ツールであることを踏まえ、研究固有のフレームワークと
知識管理の整理ビューを集める。

## 研究プロセス固有

### V89. Hypothesis × Evidence Matrix

```
              支持する証拠   反証する証拠   未検証
仮説 H1     │ 強           │ 弱           │ 多
仮説 H2     │ 中           │ 強           │ 中
仮説 H3     │ 弱           │ 強           │ 少
```

- 用途: 仮説の現状況を一覧、優先検証対象の発見
- M3E 適用: hypothesis ノードと evidence ノードのリンクから自動生成

### V90. Literature Gap Matrix（文献ギャップ分析）

- 軸: 研究トピック × 既存研究の取り組み度
- 「重要なのに研究が薄い」象限を発見
- 用途: 新規研究テーマ探索、研究計画書

### V91. Method × Domain Matrix

- 軸: 研究手法 × 適用領域
- 用途: 研究の位置付け、未開拓セルの発見
- 適用例: 行 = 機械学習手法、列 = 応用分野

### V92. Question Tree

- ルート: 大問い
- 段階的に sub-question に分解
- 葉: 検証可能な小問い
- 用途: リサーチクエスチョン設計

### V93. PICO Framework（医学研究）

- Population / Intervention / Comparison / Outcome
- 用途: 介入研究の整理
- 4セクションにノード配置

### V94. IMRAD Layout（論文構造）

- Introduction / Methods / Results / Discussion
- 用途: 論文執筆時の素材整理
- M3E 適用: ノートを論文構造に投影

### V95. Funding × Topic Matrix

- 軸: 助成プログラム × 研究テーマ
- 用途: 申請戦略立案
- 既存メモリ project_projection_vision の「科研費等を出力」と直結

### V96. Deadline × Stage Matrix

- 軸: 締切距離 × 完成度
- 「締切近いのに未完成」をハイライト
- 用途: 投稿計画、申請書管理

### V97. Confidence × Novelty 配置

- 軸: 自分の確信度 × 結果の新規性
- 「確信あり×新規性高」が論文化候補
- 用途: 結果の論文化判断

## 知識のメタ整理

### V98. Zettelkasten Network View

- 完全フラット、Folgezettel（連番）+ 縦横リンク
- 用途: ルーマン式メモ運用
- M3E 適用: graph 性能を活かしやすい

### V99. PARA Layout

- 既出（V82）。研究文脈では:
  - Projects = 進行中論文・研究テーマ
  - Areas = 研究分野（継続的）
  - Resources = 文献・データ
  - Archive = 完了した研究
- M3E 適用: scratch/strategy/archive の対応付け

### V100. Atomic Notes View

- 各ノードが「単一概念」になっているか可視化
- 「複数概念混在」ノードを警告色
- 用途: ノート品質管理

### V101. Evergreen Notes Maturity

- ノードの成熟度: Seedling / Sapling / Evergreen
- 視覚的に色分け
- 用途: Andy Matuschak 流の永続ノート育成

### V102. Citation Density Heatmap

- ノードが何回引用されているか
- 高引用ノード = 中心概念候補
- 用途: マップ内のハブ発見

### V103. Source Type Layout

- 軸: 一次資料 / 二次資料 / 自分の解釈
- 用途: 引用元の質的整理
- 派生: タイムリー資料 vs クラシック資料

## クリエイティブ・発想系

### V104. SCAMPER 配置

- Substitute / Combine / Adapt / Modify / Put to other uses / Eliminate / Reverse
- 7区分にアイデアを配置
- 用途: 既存アイデア改良の刺激

### V105. Six Thinking Hats（6色の帽子）

- White (事実) / Red (感情) / Black (批判) / Yellow (楽観) / Green (創造) / Blue (プロセス)
- 用途: 多視点思考、議論整理

### V106. Crazy 8s / Brainwriting Layout

- 8マスにアイデア配置
- 用途: 短時間で発想を強制的に8個

### V107. TRIZ 矛盾マトリクス

- 改善したい性能 × 悪化する性能
- 用途: 発明問題解決、研究の設計問題

### V108. Analogy Map

- 自分のテーマと類似ドメインを並べ、構造類推
- 用途: 異分野アナロジー発見

## 学習・自己分析系

### V109. Knowledge Map（ハイマップ）

- 自分が知っている領域を可視化
- 軸: ドメイン × 深さ
- 用途: 学習計画、足りない領域発見

### V110. Skills Tree

- ゲーム的スキルツリー、依存関係付き
- 用途: 学習ロードマップ、スキル獲得計画

### V111. Reading Progress Map

- 読んだ／読みかけ／未読 を可視化
- 用途: 文献管理

### V112. Curiosity Heatmap

- 「最近気になったトピック」の濃淡
- 用途: 自分の関心の流れ把握

## エビデンス・推論可視化

### V113. Toulmin Argument Layout

- Claim / Data / Warrant / Backing / Qualifier / Rebuttal
- 用途: 論証構造の可視化、論文の論理チェック

### V114. Evidence Pyramid（医学研究）

- 上から RCT / コホート / 症例報告 / エビデンス無し
- 用途: 引用文献の信頼度層別

### V115. Steel-man / Straw-man View

- 自分の主張 vs 最強の反論 vs 弱い反論
- 用途: 議論の鍛え方、批判的思考

### V116. Bayes Belief Network

- ノード間の確率的依存
- 用途: 不確実性下の推論可視化

## 共通の論点

- **Rk1. 研究ドメイン依存** — 領域ごとに「定型ビュー」を持たせるか
- **Rk2. ノード属性の研究固有拡張** — hypothesis/evidence/citation 用フィールド追加
- **Rk3. 文献データとの統合** — Zotero/BibTeX 取り込み、citation 自動引き
- **Rk4. AI による自動分類** — どの象限／段階に該当するかをエージェント推定
- **Rk5. 投稿フォーマット出力** — IMRAD ビューから直接論文 draft 生成
