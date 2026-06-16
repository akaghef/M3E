# 04. カタログ — 研究・学術系

研究者向け。akaghef の project_projection_vision（世界モデル→射影）との直接接続点。
論文執筆、文献レビュー、リサーチクエスチョン整理など。

## R1. PICO / PECO / PICOT

**用途**: 臨床研究・EBM で定番のリサーチクエスチョン構造化。

**構造（PICO）**:
```
親（研究課題）
├── Population / Patient （対象集団）
├── Intervention （介入）
├── Comparison （対照）
└── Outcome （アウトカム）
```

**バリエーション**:
- **PECO**: Exposure （曝露、観察研究用）
- **PICOT**: + Time （期間）
- **PICOTS**: + Setting （場面・環境）
- **SPIDER**: 質的研究用（Sample/Phenomenon of Interest/Design/Evaluation/Research type）

**推し**: 医学・公衆衛生分野では必須。M3E を研究支援ツールに見せる上で目玉スニペット候補。

## R2. IMRaD （Introduction / Methods / Results / Discussion）

**用途**: 論文構成の世界標準。

**構造**:
```
親（論文）
├── Introduction （背景・目的・仮説）
├── Methods （方法）
├── Results （結果）
└── Discussion （考察・限界・今後）
```

**連鎖**: 各ノードに IMRaD 内部用の下位スニペットを再帰展開（例: Methods の下に 参加者/手続/分析）。

## R3. 仮説-方法-結果 (HMR)

**用途**: IMRaD の単純化版。研究ノート・実験帳向け。

**構造**: `Hypothesis` / `Method` / `Result` / （`Next Action`）

## R4. 対立仮説整理（Multiple Working Hypotheses）

**用途**: 単一仮説にコミットせず、複数を並列で評価。Chamberlin の古典。

**構造**:
```
親（現象・問い）
├── 仮説 H1
│   ├── 支持する証拠
│   ├── 反証となる証拠
│   └── 判定可能な実験
├── 仮説 H2
└── 仮説 H3 （対立）
```

**推し**: **確証バイアス避け**に有効。Devil's Advocate モード（topic_pool C1）と連携可能。

## R5. 概念地図 (Concept Map)

**用途**: 概念同士のリンクに名前を付けて可視化（Novak 流）。

**構造**: ノード（概念） + ラベル付きエッジ（関係）

**スニペットとしての形**:
```
親（中心概念）
├── 関連概念 1 （リンク: "is-a" / "causes" / "part-of" 等）
├── 関連概念 2
└── 関連概念 3
```

**依存**: M3E のリンク機能（keyboard_modes M10 Link Mode と接続）。

## R6. 論文サマリ ABC / TADA / その他1ページ要約

**用途**: 読んだ論文を統一フォーマットで記録。

**構造例（ABC）**:
```
親（論文）
├── Argument （主張）
├── Basis （根拠）
└── Context / Critique （文脈・批判）
```

**バリエーション**:
- **TADA**: Thesis / Arguments / Data / Applicability
- **OMG**: Overview / Main points / Gaps
- **Mayer's 3C**: Claim / Context / Contribution
- **Chicago**: Research Question / Method / Findings / Implications / Limitations

**推し**: 読み溜めた論文を一気に同形式でスニペット展開すると文献管理が爆速。

## R7. 文献レビュー型

**用途**: レビュー論文・サーベイ構成。

**バリエーション**:
- **批判型**: 批判 → 統合 → 再構築
- **歴史型**: 時系列順に展開
- **比較型**: 複数研究をマトリクスで
- **方法論型**: 手法ごとに章立て

**構造（比較型）**:
```
親（レビュー）
├── 分析軸 （例: 手法/対象/結論）
├── 論文 A
├── 論文 B
├── 論文 C
└── クロス比較表
```

## R8. Toulmin 論証モデル

**用途**: 論証の構造化。哲学・法学・議論研究で標準。

**構造**:
```
親（主張 Claim）
├── Data / Grounds （根拠データ）
├── Warrant （論拠・推論の橋）
├── Backing （論拠の裏付け）
├── Qualifier （限定詞: 「おそらく」等）
└── Rebuttal （反論・例外条件）
```

**推し**: 単純な「主張-根拠」より深い。批判的思考訓練に。

## R9. CRAAP テスト

**用途**: 情報源の評価。Currency / Relevance / Authority / Accuracy / Purpose。

**構造**:
```
親（情報源）
├── Currency （鮮度）
├── Relevance （関連性）
├── Authority （権威）
├── Accuracy （正確性）
└── Purpose （目的・バイアス）
```

**拡張**: RADCAB, SMART チェック等のバリエーション。

## R10. PRISMA （系統的レビューフロー）

**用途**: 系統的レビューの報告構造。

**構造**:
```
親（レビュー）
├── Identification （検索でヒット）
├── Screening （スクリーニング）
├── Eligibility （適格性判定）
└── Included （最終組入）
```

**各段階で件数を保持**（数値プロパティが欲しい）。

## R11. STROBE / CONSORT / ARRIVE

**用途**: 分野別の研究報告チェックリスト。

- **STROBE**: 観察研究
- **CONSORT**: RCT
- **ARRIVE**: 動物実験

**構造**: 各項目がチェックリスト形式で展開（長いので折り畳み前提）。

## R12. リサーチクエスチョン階層

**用途**: 大きな研究課題を答えられる問いまで分解。

**構造**:
```
親（大問 Overarching RQ）
├── 中問1 （Guiding Questions）
│   ├── 小問 1a （Empirical Questions）
│   ├── 小問 1b
│   └── 小問 1c
├── 中問2
└── 中問3
```

**深さ**: 3 階層が標準（大中小）。

## R13. 三角測量 (Triangulation)

**用途**: 複数手法で同じ現象を捉える（質的研究での定番）。

**構造**:
```
親（現象）
├── 方法 1: インタビュー
├── 方法 2: 観察
├── 方法 3: 文書分析
└── 収束点 （共通して見えるもの）
```

**バリエーション**: Data / Investigator / Theory / Methodological の 4 種の triangulation。

## R14. オントロジー / 分類体系

**用途**: 概念階層の厳密な定義。

**構造**:
```
親（上位概念）
├── 下位概念1 （定義: ..., 区別条件: ...）
├── 下位概念2
└── 下位概念3
```

**関連**: math_ontology_services ブレスト（既存）との接続点。

## R15. Gettier 構造 / 知識論議論

**用途**: 哲学的な反例提示パターン。

**構造**:
```
親（主張: S は P を知る）
├── 条件A: S は P を信じる
├── 条件B: P は真
├── 条件C: S は正当化された根拠を持つ
└── 反例: 条件全満で知識にならないシナリオ
```

**ニッチ**: 哲学研究向け、専門スニペット。

---

## 横断論点（R）

- **Ra. 研究プロセスの時系列** — 構想 → PICO → 方法設計 → 実施 → IMRaD 執筆、の連鎖を一気通貫でサポート可能
- **Rb. 既存文献ノードとの統合** — R6（論文サマリ）を大量の文献に適用して検索可能にする
- **Rc. 分野特化パック** — 医学（PRISMA/STROBE/CONSORT）、法学（Toulmin）、人文学（三角測量）ごとにプリセット
- **Rd. テンプレ群の学術的出典** — 教科書・標準ガイドラインへの参照を保持（信頼性の担保）
- **Re. project_projection_vision 連携** — 世界モデル→射影 で科研費出力する時、R7（文献レビュー型）・R12（RQ階層）が中核
- **Rf. ontology との接続** — R14 は `idea/10_io/math_ontology_services/` と直接つながる
