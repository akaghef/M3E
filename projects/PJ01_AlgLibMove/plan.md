---
project: AlgLibMove
date: 2026-04-15
topic: AlgLibMove — AkaghefAlgebra 移植と Rapid/Deep 導線の dogfooding
status: active
owner: akaghef
kickoff: 2026-04-15 午後
related: README.md
---

# AlgLibMove — 実行計画

> MATLAB → world_model → Julia の 4 フェーズ導線を、VectAlg + VectHeisenbergDouble で完走させる。同時に M3E のスコープ機構・Rapid/Deep レイヤ・リンク/エイリアスの dogfood を行う。group 3-cocycle の新規実装は Future Work（別 PJ）。

## TL;DR
- **何を作る**: Julia 版 Heisenberg double（CyclicGroupAlg 上）＋ group 3-cocycle 実装
- **同時に何を検証する**: M3E を思考→設計→実装の場として使う導線の有効性
- **いつ**: Phase 毎に独立した成果。途中放棄しても各 Phase の成果は残す設計
- **主成果物**: Julia コードではなく **world_model（数学的世界観のマップ）**。Julia はその応用例

---

## 作業者向け必須情報（START HERE の前に読む）

### 対象リポジトリ
- **GitHub**: https://github.com/SSuzukiLab/AkaghefAlgebra
- **ローカル clone**: [tmp/tmp_repo/AkaghefAlgebra/](tmp/tmp_repo/AkaghefAlgebra/)
- **言語**: MATLAB（classdef ベース）、129 .m ファイル
- **License/公開性**: public repository
- **目的**: Public repository of MATLAB tool for computing mathematical objects（README より）
- **著者**: SSuzukiLab（akaghef 本人の研究コード）

### リポジトリ主要構成
```
AkaghefAlgebra/
├── Core/                     — 本体
│   ├── common/
│   │   └── VectAlg.m         ★ 抽象 Hopf 代数基底 (828 行)
│   ├── VectAlgebra/
│   │   ├── VectHeisenbergDouble.m  ★ 今回の主ターゲット (158 行)
│   │   ├── VectDrinfeldDouble.m    — 類似構造（参考）
│   │   ├── DualAlg.m               — 双対 Hopf 代数
│   │   ├── HopfAlg.m
│   │   ├── VectQuasiHopfAlg.m      — quasi-Hopf（associator 付）
│   │   ├── VectHomAlg.m
│   │   └── IAdditive.m             — 加法的インターフェース
│   ├── Base/                 — 基底表現（Bases, TensorBases, BaseConverter, NumericType）
│   ├── StrAlgebra/           — 構造代数（別系統、今回は触らない）
│   ├── PolAlgs/              — 多項式代数
│   ├── qAnalog/              — q-解析
│   ├── sequence/             — stirling1, stirling2 など
│   ├── tensor/               — calcTensorExpression 等
│   └── common/
├── Examples/
│   └── VectAlgebra/
│       └── CyclicGroupAlg.m  ★ 具体 Hopf 代数例（Z/NZ 群代数）
├── Execution/                — 具体計算実行スクリプト
│   ├── C2508/, C2511/, MSTinv/ 等
│   └── C260211KashaevEmbeddingSymmHalgd.m — Heisenberg 関連
├── External/                 — 外部依存
├── experiment/               — 実験コード
├── resources/
├── tests/                    — MATLAB テスト
├── AlgebraConfig.m           — グローバル設定
├── CR.m, CalcRuleInit.m      — 計算ルール初期化
└── README.md
```

### 今回触るファイル（優先度順）
| ファイル | 行数 | 役割 | 優先 |
|---|---|---|---|
| [Core/VectAlgebra/VectHeisenbergDouble.m](tmp/tmp_repo/AkaghefAlgebra/Core/VectAlgebra/VectHeisenbergDouble.m) | 158 | 主ターゲット | P0 |
| [Core/common/VectAlg.m](tmp/tmp_repo/AkaghefAlgebra/Core/common/VectAlg.m) | 828 | 抽象基底（必要 API のみ） | P0 |
| [Examples/VectAlgebra/CyclicGroupAlg.m](tmp/tmp_repo/AkaghefAlgebra/Examples/VectAlgebra/CyclicGroupAlg.m) | — | 具体 Hopf 代数実装例 | P0 |
| [Core/VectAlgebra/DualAlg.m](tmp/tmp_repo/AkaghefAlgebra/Core/VectAlgebra/DualAlg.m) | — | 双対構成（Heisenberg で必須） | P1 |
| [Core/Base/](tmp/tmp_repo/AkaghefAlgebra/Core/Base/) | — | TensorBases 等の基底機構 | P1 |
| [Core/tensor/](tmp/tmp_repo/AkaghefAlgebra/Core/tensor/) | — | calcTensorExpression 実装 | P1 |
| [Core/VectAlgebra/VectQuasiHopfAlg.m](tmp/tmp_repo/AkaghefAlgebra/Core/VectAlgebra/VectQuasiHopfAlg.m) | — | quasi-Hopf 分岐（Nice ゴール） | P2 |

### group cocycle について（重要）
- **AkaghefAlgebra リポジトリ内に group cocycle の実装は存在しない**（grep 済）
- これは**移植タスクではなく新規実装**。MATLAB コードなし、世界モデルから直接設計
- 文献参照例: Majid "Foundations of Quantum Group Theory", Kassel "Quantum Groups"
- 3-cocycle は quasi-Hopf 代数（群代数上）の associator Φ と対応

### 関連 M3E 内ドキュメント
- **思考プール**: [README.md](README.md) — 未分解論点の置き場（同ディレクトリ）
- **TODO 正本**: [docs/06_Operations/Todo_Pool.md](docs/06_Operations/Todo_Pool.md) — P1 として登録済
- **Core Principles**: [docs/](docs/) — 原則 0（科学研究）、2（scope）、1（オフライン）が本 PJ の論拠
- **privacy policy**: 研究データ本体は M3E 外。メタデータ・参照のみ保存

### 使う M3E スキル
- `m3e-map` — マップ読み書き（全 Phase）
- `m3e-scratch` — 思いつきを scratch に即投入
- `tomd` — backlog への書き出し
- `setrole` — サブエージェント投入時

### 前提知識（最低ライン）
- **MATLAB**: classdef, properties, methods, `<` 継承, `isa` 型判定
- **Hopf 代数**: 積 μ, 単位 η, 余積 Δ, 余単位 ε, 対蹠 S の 5 組 + 公理
- **テンソル縮約**: Einstein 記法、添字の上下、reshape/permute の意味
- **Julia**: 多重ディスパッチ、抽象型、パラメトリック型、TensorOperations.jl

### Julia 側予定
- パッケージ名（暫定）: `AkaghefAlgebra.jl`
- 依存候補: `TensorOperations.jl`, `LinearAlgebra`（stdlib）, `AbstractAlgebra.jl`（要検討）
- まだ repo は作成していない。Phase D 直前に作る

### 作業環境注意事項
- MATLAB 実行環境は未整備（ground truth 生成は Phase D で要対応）
- Octave での代替可能性は未検証
- Julia 環境は別途整備

---

## ゴールと成功基準

| レベル | 基準 |
|---|---|
| Must | VectHeisenbergDouble.setConst 相当の数値計算が Julia で MATLAB と一致 |
| Must | world_model に Hopf algebra 階層と Heisenberg double が concept として定着 |
| Must | port_log に「M3E に追加すべき機能」が 5 件以上列挙されている |
| Should | 12 facetsのうち最低 6 個（0,1,2,3,5,9）が稼働 |
| Nice | quasi-Hopf 分岐まで含めて完走 |
| Future | group 3-cocycle の新規実装（本 PJ スコープ外、別 PJ として切り出し） |
| Nice | ROOT スコープから全スコープへアクセス可能なダッシュボードが完成 |

## スコープ（対象と非対象）

### 対象
- MATLAB 側: `Core/common/VectAlg.m`, `Core/VectAlgebra/VectHeisenbergDouble.m`, `Examples/VectAlgebra/CyclicGroupAlg.m`, 直接依存（TensorBases, DualAlg, calcTensorExpression）
- Julia 側: `AbstractHopfAlgebra`, `GroupAlgebra`, `HeisenbergDouble` の最小実装
- M3E 側: スコープ 0,1,2,3,5,9 の最小構築、残りは必要になり次第

### 非対象（今回は捨てる）
- VectDrinfeldDouble, VectHomAlg の移植
- Integrals, verify 系メソッドの完全移植（最小限だけ）
- MATLAB 全 129 ファイルの投入（Rapid は対象周辺に絞る）
- Julia パッケージ公開・CI 整備

### Future Work（本 PJ 範囲外 → 別 PJ 化）
- **group 3-cocycle の新規実装**: AkaghefAlgebra 内に実装が存在せず、移植ではなく新規設計になるため本 PJ から分離。quasi-Hopf 代数（群代数上）の associator Φ との対応を Deep 側で検討する作業は、本 PJ 完了後に別プロジェクトとして立ち上げる
- 文献参照: Majid "Foundations of Quantum Group Theory", Kassel "Quantum Groups"

## 確定事項（2026-04-15 akaghef 確認済み）
- **PJ 名**: `AlgLibMove`
- **用語**: 本 PJ が観点として並走させる 12 個の単位は **facet** と呼ぶ（[Glossary 2.5](../../00_Home/Glossary.md)）。M3E の汎用機能 `scope` とは区別する。1 facet = M3E マップ内の 1 subtree
- **facet 跨ぎ操作の制限**: サブワーカー（subagent / 並行 session）は **facet 内に閉じた読み書きのみ行う**。facet を跨ぐ link / alias の作成・更新はマネージャー session が batch でまとめて実行（並行書き込み race を避けるため）
- **残留 race の扱い**: 異なる facet への並列 POST にはまだ race window がある（API レベル未対策）。**偶発事故として許容**し crash 時は再実行で対処。深刻化したら `feat/scope-isolation` で `acquireScopeLock` 配線
- **git worktree**: `prj-alglibmove`（`../M3E-prj-alglibmove/`、ブランチ `prj/AlgLibMove`）。VSCode は別ウィンドウで開き、dev-beta 本体開発と物理的に分離する
- **マップ構成**: プロジェクト専用マップ **`AlgLibMove`** を新規作成し、その中で 12 facets全てを展開する。既存 Rapid/Deep マップには入れない
- **Rapid/Deep モード**: 作業中はモードを気にしない。**PJ 完了後に「どのノードがどちらの帯域に属すべきだったか」を遡及的に判定**することが dogfood の主目的。現行 R/D 区分けが曖昧である事実そのものを port_log に記録する
- **エイリアス**: M3E に機能として存在。積極利用可
- **port_log 位置**: `AlgLibMove` マップ内 `port_log/` サブツリー

## 本日午後の着手手順（START HERE）

### Step 0: 環境確認（10 分）
- [ ] `tmp/tmp_repo/AkaghefAlgebra/` がある（既に clone 済）
- [ ] M3E 起動、マップ書き込み可能
- [ ] マップ `AlgLibMove` を新規作成

### Step 1: ROOT スコープと骨格作成（30 分）
`AlgLibMove` マップ上に:
- [ ] ルート直下に `ROOT`, `port_log/` を作る（他スコープは必要時に追加）
- [ ] ROOT に phase_marker="Phase A.1" を記入
- [ ] ROOT から各サブスコープへ `contains` link

### Step 2: 最小ファイルを Rapid に投入（60 分）
以下の 3 ファイルを詳細ノード化。**粒度はクラス依存、基本は全 method/property を列挙**（省略しない）:
- [ ] `VectAlg.m` — class + 全 properties + 全 method（約 40 個、operator/math/display/verify/construct でグルーピング）
- [ ] `VectHeisenbergDouble.m` — class + properties 3 個 + 全 method 7 個
- [ ] `CyclicGroupAlg.m` — class + 全 method

各ノード attribute: path / lines / signature / summary / matlab_doc。**深追いしない**。

### Step 3: スコープ 2（階層）とスコープ 4（依存）の link 張り（30 分）
- [ ] `inherits`: VectHeisenbergDouble → VectAlg, CyclicGroupAlg → VectAlg
- [ ] `uses_class`: VectHeisenbergDouble → DualAlg, TensorBases, calcTensorExpression
- [ ] 未投入の依存先は placeholder ノードだけ置く（後で詳細化）

### Step 4: 最初の concept 3 個を Deep に立てる（45 分）
- [ ] `concept: Hopf algebra` — formula, axioms, references（Kassel）
- [ ] `concept: smash product`
- [ ] `concept: Heisenberg double`
- [ ] 各 concept から Rapid 側 method へ `realizes` link（alias 経由でも可）
- [ ] この作業中の痛みを全て `port_log/scope_pain/` に記録

### Step 5: 振り返りと次セッション準備（15 分）
- [ ] port_log の件数を数える（3 件以上あるか）
- [ ] ROOT の phase_marker 更新
- [ ] 翌セッションの開始地点を ROOT/quick_access にメモ
- [ ] 本ファイル末尾の「進捗ログ」に 1 行追記

**総時間: 約 3 時間**。Step 4 まで終われば Phase A→B の**遷移**を一度は経験できる。

## 運用ルール（プロジェクト規約）

### ノード作成
1. 新規ノードは必ず**実体スコープを決める**（迷ったら port_log/scope_pain 記録）
2. method の実体 = scope 1、concept の実体 = scope 5、tensor 式の実体 = scope 7
3. 他スコープからは alias で参照

### link
- 1 周目は `realizes` 中心。必要になったら下表の語彙を追加
- 迷った種別は新規作成せず、scope_pain で pool してから決める

### port_log
- 迷い・詰まり・「ここ M3E 弱い」は**その場で**記録。後回ししない
- サブカテゴリ: `scope_pain/` `format_gap/` `open_question/` `decision/` `tool_wish/` `ai_handoff/`

### Phase 遷移の判定
- Phase A → B: 対象ファイルが Rapid に入り、主要 method が `realizes` で concept と繋がり始めたら
- Phase B → C: world_model が自己完結的に読める（MATLAB を参照しなくても理解できる）
- Phase C → D: target_design に Julia 型とシグネチャが確定
- Phase D 終了: 検証スコープで数値一致

### 中断時の保全
- 各 Step 終わりで ROOT の phase_marker と quick_access を更新
- 未完の作業は port_log/open_question として積む
- 翌セッションは ROOT を最初に見るだけで復帰可能にする

## 進捗ログ
- 2026-04-15: プロジェクト文書化完了、午後 Step 0-5 着手予定

---

## 問題意識
- 関数単位の翻訳往復は「翻訳しながら理解する」モードで、理解の浅さが実装に染み込み、実装の都合が理解を歪める
- 混乱を避けるには **理解完了 → 設計確定 → 実装** を直列に分離する
- M3E は「書く前に考える場」なので A〜C は全部 M3E 上で閉じ、D で初めて外に出る
- 世界モデルは副産物ではなく主成果物。Julia 実装は世界モデルの一応用でしかない

## レイヤ対応
Rapid/Deep がそのままレイヤ機構になっている。

- **Rapid マップ** = Phase A の投げ込み先。粒度も意味も気にせず repo 全体を大量投入
- **Deep マップ** = Phase B/C の世界モデルと設計を育てる場所
- Rapid→Deep の昇格が Phase A→B の遷移そのもの

```
Rapid map
  └ repo_dump/            ← Phase A: MATLAB 全部投げ込み
       ├ files/
       ├ functions/
       ├ ast/
       └ commits/
              ↓ 昇格（概念抽出・整理）
Deep map
  ├ world_model/          ← Phase B: 概念体系
  ├ target_design/        ← Phase C: Julia 設計
  └ port_log/             ← scope 痛み・open_question
              ↓
            Julia 実装（Phase D, コードは map 外）
```

---

## Phase A: 全取り込み（repo → Rapid map）
**目的**: MATLAB repo の全情報を M3E 上に再表現。repo が M3E に住む状態にする。

- 全ファイル・全関数・全コメント・全 README・全コミット履歴をノード化
- AST・依存グラフ・呼び出しグラフを link で展開
- 著者の意図の痕跡（コメント・変数名の癖・コミットメッセージ）も保存
- AI はここで解釈を加えない。生データの構造化だけ
- **成果**: MATLAB 版 AkaghefAlgebra の完全コピーが M3E 上にある状態

Phase A 単体でも価値: repo を M3E 上で探索できる = 読むための最強ビュー。

---

## Phase B: 世界モデル構築（Rapid → Deep）
**目的**: Phase A の生データからドメインの概念体系を抽出し、Deep レイヤに立ち上げる。実装は一切触らない。

- `world_model/` レイヤを Deep 側に作る（source とは independent）
- 概念抽出を AI 複数走で反復:
  - 走 1: 命名から概念候補を列挙
  - 走 2: 数式・アルゴリズムから概念候補を列挙
  - 走 3: 文献検索で対応する数学概念を同定
  - 走 4: 矛盾・重複・抜けを検出
- 各 concept ノードは Rapid の source ノード群に link（「この概念はここで具現化されている」）
- **open_question** ノードが主役:「この実装は何を仮定？」「この名前の意味は？」を徹底的に立てる
- 人間は open_question に回答する作業に集中
- **成果**: MATLAB コードを読まなくても AkaghefAlgebra の世界観が分かるマップ

**終了条件**: MATLAB 実装のあらゆる箇所が world_model のどれかの concept に属し、逆に全 concept が少なくとも 1 つの実装に接地している。双方向 coverage。

---

## Phase C: Julia 設計（Deep 内で完結）
**目的**: 世界モデルから Julia のモジュール構造・型階層・API を設計。まだコードは書かない。

- `target_design/` レイヤを新設
- world_model の concept → Julia の型 / module / function の対応を決める
- **MATLAB の構造を無視する**。世界モデルから自然な Julia 構造を導く
- MATLAB の冗長・不整合は world_model 段階で既に解消済みなので、設計は clean
- 多重ディスパッチ・型パラメータ・traits など Julia 固有機構をここで活用
- **成果**: この設計書を渡せば他人でも Julia が書ける状態

---

## Phase D: 実装（map → code）
**目的**: 設計を Julia コードに落とす。ほぼ機械的。

- Translator agent が target_design ノードを 1 つずつ実装化
- 人間のレビューは設計書通りかの確認のみ（数学的判断は Phase B/C で完了済み）
- 数値一致テストは MATLAB 版を ground truth として自動走行
- Phase A〜C に時間を投じた分、ここは速い・揉めない

---

## Rapid/Deep レイヤ観点で効く機能要求（M3E 本体への dogfooding）
- **Rapid→Deep 昇格ワークフロー**: Rapid ノード選択 → Deep 側に concept を立てる → link 自動生成、を 1 アクションで
- **coverage ビュー**: Rapid のどれだけが Deep に昇格済みかを可視化（Phase B 終了判定に直結）
- **repo ingestion ツール**: ディレクトリ一括→Rapid ノード化（Phase A の必須基盤）

この 3 つがあれば AkaghefAlgebra 移植がそのまま M3E の主要機能ドライバになる。

## なぜこの順序か
- 混乱の出所は「翻訳しながら理解する」こと
- 理解と実装を同時進行すると、理解の浅さが実装に染み込み、実装の都合が理解を歪める
- A→B→C は全部 M3E 上で閉じる。D で初めて外に出る
- 世界モデルは副産物ではなく主成果物。論文執筆・教育・別言語移植にも再利用可能

## Core Principles 照合
- 原則 0（科学研究を主対象）: ど真ん中
- 原則 2（認知境界としての scope）: Rapid/Deep レイヤの検証ケース
- 原則 1（個人オフラインファースト）: 研究データ外部送信しない方針と整合

## dogfood 由来の M3E 機能候補（PJ 内で随時 port_log に蓄積）
1. ingestion ツール（ディレクトリ一括 → Rapid ノード化、Phase A 基盤）
2. Rapid→Deep 昇格ワークフロー（Phase B 基盤）
3. coverage ビュー（どの Rapid ノードが Deep に昇格済みかの可視化）

これらは PJ 進行中の痛みから確定させ、明確になった時点で `feat/*` ブランチを切って dev-beta へ PR。

---

# スコープ確定: VectAlg + VectHeisenbergDouble

## 調査結果
- Repo 全体: 129 .m ファイル
- **Core/common/VectAlg.m**: 828 行、抽象 Hopf 代数基底（plus/mtimes/Delta/S/counit/verify/disp 等）
- **Core/VectAlgebra/VectHeisenbergDouble.m**: 158 行、VectAlg 継承の具体構成
- group cocycle は repo 内に**存在しない** → 本 PJ 範囲外（Future Work）

## 最小完遂スコープ
- 具体 Hopf 代数は CyclicGroupAlg に固定（VectQuasiHopfAlg 分岐・Drinfeld 等は捨てる）
- 抽象基底 VectAlg は必要最小 API のみを世界モデル側で再設計

---

# facet カタログ（12 facets）

AkaghefAlgebra 移植を通して必要になる facet を列挙。各 facet は M3E マップ内の 1 subtree として実装され、scope 単位の API（`?scope=<facetRootNodeId>`）で読み書きする。以降「スコープ N」は「facet N」と読み替える。

## 0. ROOT スコープ（全スコープ概観）

### 役割
12 facets並走中の**ハブ**。迷子防止と全体の健康状態の可視化。

### 持つ情報
- 各スコープへのエントリーポイント（ノード link）
- スコープ間の依存関係図（例: 5 は 1 を解釈したもの、11 は 5 から導出、10 は 11 と 1 の両方を参照）
- 進捗メタ: 各スコープのノード数・更新時刻・「育成中/塩漬け」フラグ
- phase ゲート: A/B/C/D のどこに居るかのマーカー

### 具体的ノード例
```
ROOT/
  phase_marker: "Phase A.2 (class implementation ingestion)"
  scopes/
    1_class_impl → link
    2_class_hier → link
    ...
  health/
    stale_scopes: [scope_3（2 週間更新なし）]
    hot_scopes: [scope_9（今週 30 件追加）]
```

### 使う瞬間
- セッション開始時に最初に見る
- どのスコープに戻るか判断できない時
- 他の agent に状況説明する時のビュー

---

## 1. クラス実装スコープ（MATLAB 実装の内部構造）

### 役割
1 classdef ファイルを忠実にノード化。**解釈を加えない生データ層**（Rapid 側の住人）。

### 構造（VectHeisenbergDouble を例に）
```
class: VectHeisenbergDouble (inherits VectAlg, file: Core/VectAlgebra/VectHeisenbergDouble.m, 158 lines)
  properties/
    rdim          — dimension of H1
    H1            — 1st Hopf algebra (type: VectAlg)
    H2            — 2nd Hopf algebra (type: VectAlg)
  methods/static/
    getGenerator(H1, H2, name)    — H(H2)=H1#H2 smashproduct constructor
    getGenerator1(H1, name)       — H(H1)=H1#(H1^*), dual auto-generated
    getGenerator2(H2, name)       — H(H2)=(H2^*)#H2
  methods/instance/
    split(obj)                     — reshape sparse into 2*rank tensor
    setMerge(obj, sparse)
    setConst(obj)                  — multiplication tensor MH setup (Hopf / quasi-Hopf branch)
    getGW(obj)                     — returns (G, W, W^-1) canonical elements
    castype(obj, arg)              — cast H1 or H2 element into H1#H2
    rep(obj)                       — matrix representation
    act(obj, arg)                  — action on H^* = H1
```

VectAlg 側も同形式で:
```
class: VectAlg (abstract, inherits IAdditive, 828 lines)
  properties/
    cf, ZERO, (Dependent: ...)
  methods/operator/
    plus, uminus, eq, mtimes, times, lb, mrdivide, mpower
    or (tensor product ⊗), and, not
  methods/math/
    Delta (comultiplication), counit, S (antipode), unit
    algID, algfun, calc
  methods/display/
    disp, disp_, disp0..disp3, string, latex
  methods/verify/
    verify, verifyHopf, verifyInt, dispInt
  methods/construct/
    make, setBase, setSC, setIntegrals, set_c, casttype, castCtype
```

### ノード属性（各 method について）
- `signature`: MATLAB 呼び出し形
- `summary`: 1 行要約（コメントから抽出）
- `body_lines`: [start, end]
- `matlab_doc`: ヘッダコメント原文
- `called_methods`: 他 method への参照（→ スコープ 3, 4 と link）

### 出力例（setConst ノード）
```
signature: setConst(obj)
body_lines: [57, 95]
matlab_doc: |
  set constants of Heisenberg double
  MH: multiplication tensor MH\indices{^1_2^3_{45}^6}
  Δ: comultiplication tensor Δ\indices{_1^{23}}
  ...
branches: [Hopf, quasi-Hopf (uses associator Psi)]
called_methods: [H2.getSC, calcTensorExpression, reshape]
```

---

## 2. クラス階層スコープ（型システム）

### 役割
継承・インターフェース実装・mixin 関係だけを抽出した純粋な型グラフ。

### 具体構造
```
matlab.mixin.indexing.RedefinesBrace (external mixin)
  └ (mixin into) VectAlg
IAdditive (abstract interface, Core/VectAlgebra/IAdditive.m)
  └ VectAlg (abstract, Core/common/VectAlg.m)
       ├ VectHomAlg
       ├ VectQuasiHopfAlg
       ├ VectDrinfeldDouble
       ├ VectHeisenbergDouble    ← 今回のスコープ
       ├ DualAlg
       ├ HopfAlg (in VectAlgebra — 注意: StrAlgebra にも HopfAlg.m あり、別物)
       └ CyclicGroupAlg (Examples/VectAlgebra/, 具体 Hopf 代数)
```

### link 種別
- `inherits`: MATLAB `<` 継承
- `mixes_in`: MATLAB `&` mixin
- `instance_of`: CyclicGroupAlg のインスタンスが VectAlg として扱われる箇所

### 読み取れること
- VectHeisenbergDouble は VectAlg を継承するが、中で `obj.H1`, `obj.H2` として別の VectAlg を保持 → **継承＋合成**の二重構造
- quasi-Hopf は `isa(..., "VectQuasiHopfAlg")` で分岐。これは階層スコープと実装スコープを跨ぐ判定
- InferiorClasses=?sym は symbolic math toolbox との演算優先順制御

### 注意点（port_log 候補）
- 同名 HopfAlg が 2 ファイル存在（VectAlgebra と StrAlgebra）→ **曖昧性**。Julia では名前空間で解消必要

---

## 3. 処理順スコープ（呼び出しフロー・時系列）

### 役割
シナリオ単位の**実行フィルム**。静的な依存関係（スコープ 4）と違い、ユーザが何かを達成する時に method がどの順で呼ばれるかを追う。

### サブスコープ分割方針（確定: 2026-04-15）
**巨大な 1 シナリオを作らず、マクロ手続きごとに小スコープに分ける**。粒度の目安:
- `3a_construct_HD/` — Heisenberg double の構成手続き（CyclicGroup → HD の立ち上げ）
- `3b_compute_product/` — HD 元同士の積計算
- `3c_canonical_elements/` — G, W, W^-1 の生成
- `3d_setConst_branch/` — Hopf / quasi-Hopf 分岐の内部フロー
- 必要になったら `3e`, `3f`, ... を追加

**理由**: 1 シナリオ内に分岐を全部詰め込むと link が絡まる。マクロ手続き単位で切ると、後で concept（scope 5）との対応が取りやすい。

### 具体シナリオ例: 「CyclicGroupAlg から Heisenberg double を作って積を計算する」
```
1. CyclicGroupAlg.getGenerator(N)
     ├─ new CyclicGroupAlg
     ├─ setBase(bs0.get(N))
     └─ setConst()                     [M, C, eta, ep, S 構造定数計算]

2. VectHeisenbergDouble.getGenerator1(H1, name)
     ├─ DualAlg.getGenerator(H1)       [H1^* を自動生成]
     └─ VectHeisenbergDouble.getGenerator(H1, H2=H1^*, name)
           ├─ new VectHeisenbergDouble
           ├─ setBase(TensorBases([H1.bs H2.bs], name))
           ├─ bs.helperHD
           └─ setConst()
                 ├─ H2.getSC('prod')         → M
                 ├─ H2.getSC('coprod')       → C
                 ├─ H2.getSC('unit')         → eta
                 ├─ H2.getSC('counit')       → ep
                 ├─ isa(..., "VectQuasiHopfAlg") 判定
                 │   ├─ [Hopf 分岐]  calcTensorExpression('C{...}M{...}')
                 │   └─ [quasi 分岐] H2.getSC('associator') 含む式
                 └─ obj.spec.SC{'prod'} / {'unit'} 更新

3. x * y  (mtimes オーバーロード @ VectAlg)
     ├─ 係数 tensor 縮約
     └─ set_c(...)
```

### link 種別
- `calls`: 直接呼び出し
- `follows`: 同じシナリオ内で時間的に後続
- `branches`: 条件分岐（isQuasi 等）
- `returns_into`: 戻り値が次のステップに流れる

### ノード属性
- `scenario_name`: "construct HD from CyclicGroup", "compute product" など
- `preconditions`: そのシナリオが始まる前提
- `postconditions`: 終了後の状態

### 使いどころ
- Julia 移植時の**受入テスト順序**の骨格に直結
- 「この分岐で失敗している」のトレース地図になる
- 概念スコープ（5）との重ね合わせで「数学的にどの段階で何が起きているか」が可視化

---

## 4. 依存スコープ（静的依存グラフ）

### 役割
「誰が誰を import / 参照しているか」だけを抽出。**時間を含まない**。呼び出し順スコープと違い、一度限りの呼び出しでも可能性としての呼び出しでも等価に扱う。

### サブスコープ分割方針（確定: 2026-04-15）
**小スコープに分ける方がベター**。分割軸は「依存の性格」:
- `4a_inherits/` — 型継承グラフ（scope 2 と alias で同期）
- `4b_class_use/` — method から他 class への型参照（`uses_class`）
- `4c_function_call/` — トップレベル関数呼び出し（`calls_function`）
- `4d_builtin/` — MATLAB 組み込み依存（Julia 翻訳表の素材）
- `4e_isa_check/` — 型判定による弱い依存（quasi-Hopf 分岐など）

**理由**: 依存の性格ごとに Julia 側の扱いが変わる（継承→trait、builtin→翻訳表、isa→dispatch）。一緒くたにすると Phase C で再分類が必要になる。

### VectHeisenbergDouble の直接依存
- `VectAlg` — 継承（スコープ 2 と重複するが、依存観点でも登録）
- `DualAlg` — `DualAlg.getGenerator(H1)` 呼び出し
- `TensorBases` — `TensorBases([H1.bs H2.bs], name)` 構築
- `calcTensorExpression` — テンソル式評価関数
- `VectQuasiHopfAlg` — `isa(..., "VectQuasiHopfAlg")` 型判定
- MATLAB 組み込み: `reshape`, `tensorprod`, `permute`, `eye`, `isa`, `isequal`

### 推移閉包（VectHeisenbergDouble が最終的に必要とするもの）
```
VectHeisenbergDouble
├ VectAlg
│  ├ IAdditive
│  ├ Bases / TensorBases / BaseConverter
│  ├ NumericType
│  └ (整数論や多項式は最小スコープでは切る)
├ DualAlg
│  └ VectAlg
├ TensorBases
│  └ Bases
└ calcTensorExpression
   └ (tensor util chain)
```

### link 種別
- `uses_class`: 型として参照
- `calls_function`: トップレベル関数呼び出し
- `isa_check`: 型判定（弱い依存）
- `builtin`: MATLAB 組み込みへの依存（Julia では別名になる可能性）

### 使いどころ
- Julia 側の `using/import` 構造の予測
- 移植順序の決定（葉から根へ）
- 「builtin 依存」を抽出すると MATLAB→Julia 翻訳の定型変換表が自動生成できる（例: `tensorprod` → `TensorOperations.jl`）

---

## 5. 数学概念スコープ（world_model 本体）

### 役割
**コード構造から独立**した数学体系の層。Hopf 代数の教科書が 1 冊 M3E 内に再構築されるイメージ。Deep 側の主役。

### 今回必要な concept（粗い順）
```
Vector space over k (field)
Algebra (associative, unital)
  │
Coalgebra (coassociative, counital)
  │
Bialgebra
  │
Hopf algebra           ← antipode S を持つ bialgebra
  ├─ axiom: S*id = id*S = η∘ε (convolution inverse)
  ├─ operation: Δ, ε, μ, η, S
  ├─ example: CyclicGroupAlg (group algebra of Z/NZ)
  └─ dual: H^*
Quasi-Hopf algebra     ← associator Φ を持つ一般化
  └─ axiom: pentagon, triangle
Smash product H1 # H2  ← module algebra structure
  │
Heisenberg double H(H) = H^* # H
  ├─ axiom: (f#a)(g#b) = ∑ f (ψ_1 ⇀ g) # (ψ_2 ⇀ a) b  (quasi 版)
  ├─ canonical elements: G, W, W^-1
  └─ representation on H^*

Group cohomology
  ├─ n-cochain: G^n → k^×
  ├─ coboundary δ: C^n → C^{n+1}
  ├─ n-cocycle: ker δ
  ├─ 2-cocycle: twist of algebra structure
  └─ 3-cocycle: associator of quasi-Hopf algebra over group algebra ← 今回の target
```

### ノード属性
- `kind`: `concept` / `axiom` / `operation` / `invariant` / `example` / `theorem`
- `formula_latex`: 正式な数式
- `prose`: 自然言語による意味
- `references`: 文献（Kassel "Quantum Groups", Majid, etc.）
- `dependencies`: 他 concept への論理的依存
- `open_questions`: 未解決の曖昧点（→ スコープ 9 に link）

### 具体ノード例
```
concept: Heisenberg double
kind: construction
formula_latex: H(H) := H^* \# H
prose: |
  Given a Hopf algebra H, its Heisenberg double is the smash product
  of H^* (dual) and H, where H acts on H^* via (a⇀f)(x) = f(xa).
dependencies: [Hopf algebra, smash product, dual Hopf algebra]
references:
  - Kashaev–Reshetikhin, "Invariants of tangles..."
  - Semenov-Tian-Shansky
canonical_elements: [G, W, W^{-1}]
open_questions:
  - quasi-Hopf 版での canonical elements の一意性
```

### 使いどころ
- Julia 型設計の根拠（スコープ 11）
- 実装が正しいかの**意味論的**基準
- 論文との対応付け
- group cocycle の新規実装は**このスコープからしか出てこない**（MATLAB に無いので）

---

## 6. 概念⇔実装マッピングスコープ（Rapid↔Deep 橋渡し）

### 役割
**最も強力だが曖昧な層**。コード世界（how）と数学世界（what）の唯一の縫合点。

### 強力さ
- 多対多: 1 concept が複数 method に散る / 1 method が複数 concept を体現
- 翻訳の正当性根拠: 「両者が同じ concept の表現」と言えれば実装が違ってもよい → 再設計可能
- 論文 ↔ コードの橋: concept 経由で method から論文まで辿れる
- coverage: 未実装 concept / 未解釈 method を両側から可視化できる

### 具体例（VectHeisenbergDouble.setConst で起きていること）
```
concept: Heisenberg double multiplication (quasi-Hopf 版)
  formula_latex: (f \# a)(g \# b) = \sum f(?\psi_1) g(?\psi_2 a_1) \# \psi_3 a_2 b
  realized_by:
    ├─ defines: method setConst (Hopf / quasi-Hopf 分岐を内包)
    ├─ encodes: tensor expression 'M{10,7,1}C{5,10,11}M{11,8,12}...'
    │           （添字 1,7,3,8,2,9,4 が式中の ?, ψ_1, ψ_2, a_1, ψ_3, a_2, b に対応）
    ├─ uses: H2.getSC('prod'), getSC('coprod'), getSC('associator')
    └─ stores_in: obj.spec.SC{'prod'}
```

### 曖昧さの論点
- **粒度の非対称**: concept は粗い、method は細かい。1 対「式の断片」や「tensor 添字」になる
- **link 種別が `realizes` だけでは不足**:
  - `defines`: method がこの concept の定義そのもの
  - `uses`: concept を道具として使う（例: setConst が Δ を使う）
  - `encodes`: tensor 添字がこの concept の数式を表す（例: `C{5,1,7}` は Δ(e_5) = Σ e_1⊗e_7）
  - `specializes`: 一般 concept の特殊化（Hopf ⇒ quasi-Hopf 分岐）
  - `violates`: 実装が concept の仮定を破っている（要注意点）
  - `approximates`: 数値精度の都合で近似している箇所
- **写像の方向**: concept → method（実現） と method → concept（抽象化） は別ラベル
- **時系列**: concept は静的、method は動作。動作中のどの瞬間に concept が現れるか

### 運用方針
- 1 周目は `realizes` 1 種だけ
- 2 例目で迷った瞬間に語彙を増やす（事前に決めない）
- Julia 設計導出: concept の束 → Julia 型の束（MATLAB を経由しない）

---

## 7. データフロー／テンソル式スコープ

### 役割
Heisenberg double の中心は calcTensorExpression の文字列式。これを**式レベル**で構造化し、添字の意味を追跡可能にする。

### 具体例（VectHeisenbergDouble.setConst 内、Hopf 分岐）
```
expression: 'C{5,1,7}C{2,9,8}M{7,9,3}M{8,4,6}'
free_indices: [1,2,3,4,5,6]
internal_indices: [7,8,9]
interpretation:
  tensor C: comultiplication Δ : V → V⊗V, C{out, in1, in2} → Δ_out^{in1, in2}
  tensor M: multiplication μ : V⊗V → V, M{in1, in2, out} → μ_{in1,in2}^out
  formula_rendered:
    MH\indices{^1_2^3_{45}^6} = Δ_5^{1,7} Δ_2^{9,8} μ_{7,9}^3 μ_{8,4}^6
```

### quasi-Hopf 分岐の式
```
'M{10,7,1}C{5,10,11}M{11,8,12}M{12,13,3}M{9,14,15}M{15,4,6}C{2,13,14}Psi{7,8,9}'
Psi = associator Φ
流れ: Φ を 3 ヶ所でインジェクト、積を複数段に
```

### ノード属性
- `raw_string`: 元の文字列
- `ast`: 添字と tensor のパース結果
- `free_indices`, `contracted_indices`
- `semantic_gloss`: 各 tensor の数学的意味（Δ, μ, Φ など）
- `corresponding_formula`: LaTeX

### 使いどころ
- Julia 側で `TensorOperations.jl` の `@tensor` マクロに機械的に変換できる
- MATLAB と Julia で**添字パターンが一致するか**を自動検証
- concept スコープ（5）の `operation` と 1:1 で対応させられる

### dogfood 論点
- calcTensorExpression のパーサを書かずに**文字列のまま保持**してよいか（ノード attribute に flat に入れるか、AST ノードとして子を展開するか）
- これは Phase A の粒度決定の典型例

---

## 8. 数学表記スコープ

### 役割
数式そのもの（LaTeX）と、それを記述する文献を管理する別レイヤ。concept（5）と分離することで、**同じ concept に複数の表記**が共存できる。

### 具体例
```
concept: comultiplication
  notations/
    ├─ Sweedler: Δ(a) = a_{(1)} ⊗ a_{(2)}
    ├─ index: Δ_i^{jk}
    ├─ matlab_code: C{i,j,k} (in calcTensorExpression)
    └─ julia_tentative: @tensor C[i] := Delta[i, j, k] * ...
  references/
    ├─ Kassel 1995, "Quantum Groups", Ch. III
    ├─ Majid, "Foundations of Quantum Group Theory"
    └─ Sweedler, "Hopf Algebras" (1969)
```

### ノード属性
- `latex`: 数式
- `notation_system`: Sweedler / index / graphical / categorical
- `source`: 初出文献
- `equivalents`: 同値な他表記へのリンク

### 使いどころ
- MATLAB のコメント内 LaTeX を正規化して保存
- Julia コメント生成時のソース
- 論文執筆・セミナー資料への再利用（Core Principle 0）

---

## 9. port_log スコープ（dogfood 成果物）

### 役割
**M3E 機能要求の源泉**。作業中の痛み・曖昧・決定を全てノード化。これが dogfooding の一次成果物。

### サブスコープ
```
port_log/
  scope_pain/       — スコープ境界が気持ち悪い瞬間（Core Principle 2 検証データ）
  format_gap/       — 今のノードフォーマットで表現できなかったもの
  open_question/    — 誰かに確認したい事項（数学・実装両方）
  decision/         — その場で決めた暫定ルール（いつ再検討するかも記録）
  tool_wish/        — 「この機能が M3E にあったら」リスト
  ai_handoff/       — AI に任せた・任せられなかった判断記録
```

### 具体例
```
scope_pain/2026-04-15-01:
  trigger: VectAlg の method を「math/」と「construct/」どちらに置くか迷った
  context: setSC は数学構造を設定する（math 寄り）が、初期化の一部（construct 寄り）
  tentative: construct に置き、math から link
  revisit_when: 2 つ目のクラス（VectHeisenbergDouble）でも同じ迷いが出たら

format_gap/2026-04-15-02:
  trigger: calcTensorExpression 文字列の内部構造を attribute に入れるか child ノードにするか
  missing: M3E に「テンソル式 AST ノード型」が無い
  workaround: attribute に文字列のまま保存、別途 scope 7 で詳細化

tool_wish/2026-04-15-03:
  wish: Rapid ノード選択 → Deep concept 新規作成＋link が 1 アクション
  frequency: Phase B で 100+ 回必要になる見込み
```

### 使いどころ
- 週次で分類 → M3E ロードマップへの機能要求
- scope_pain が 3 件貯まったら同じ境界を真面目に設計し直す合図
- 完遂後に論文・発表資料の素材

---

## 10. 検証スコープ

### 役割
MATLAB ground truth と Julia 実装の数値・構造一致を証明するエビデンス層。

### 構造
```
verify/
  test_case/
    ├─ case_01_cyclic_N3_product/
    │    ├─ input: (CyclicGroupAlg N=3, HD 元 x, y)
    │    ├─ matlab_output: [json/mat file ref]
    │    ├─ julia_output: [対応する Julia 実行結果]
    │    ├─ diff: element-wise max abs, tolerance
    │    └─ status: pass / fail / pending
    └─ case_02_HD_canonical_W_unitary/
         ├─ property: W * W^-1 = 1 ⊗ 1
         └─ ...
  property_test/
    ├─ S_squared_identity/       — S^2 = id on cocommutative H
    ├─ pentagon_for_quasi/       — Φ の整合性
    └─ ...
  coverage_matrix/
    rows: concept (scope 5)
    cols: test case
    cells: このテストがこの concept を検証している
```

### ノード属性
- `input_seed`: 再現可能な乱数 seed
- `tolerance`: 数値許容誤差
- `invariant_checked`: どの axiom/invariant を検証しているか（→ scope 5 に link）

### 使いどころ
- Phase D のゲート
- regression 検出
- 「この concept は十分検証されている」の判定材料

---

## 11. 設計スコープ（target_design, Phase C）

### 役割
Julia 側の型・モジュール・API を決める専用レイヤ。world_model から導出される。**MATLAB の構造を見ない**のがルール。

### 構造例（group cocycle + Heisenberg double を Julia で）
```
target_design/
  modules/
    AkaghefAlgebra/
      AbstractHopfAlgebra/     — trait based, not class hierarchy
      GroupAlgebra/             — CyclicGroupAlg の一般化
      DualHopf/
      HeisenbergDouble/
      GroupCocycle/             — 新規
  types/
    AbstractHopfAlgebra{T<:Field}
    GroupAlgebra{G,T} <: AbstractHopfAlgebra{T}
    HeisenbergDouble{H1,H2,T} <: AbstractHopfAlgebra{T}
    Cocycle{G,N,T}     — n-cocycle on group G
  api/
    comultiplication(h::AbstractHopfAlgebra) :: Linear
    antipode(h) :: Linear
    smash_product(H1, H2)
    heisenberg_double(H::AbstractHopfAlgebra) = smash_product(dual(H), H)
    # quasi-Hopf は trait で分岐、継承しない
    associator(h::QuasiHopfTrait) :: Tensor3
  design_decisions/
    ├─ use_multiple_dispatch_over_inheritance
    ├─ tensor_lib_choice: TensorOperations.jl
    └─ coefficient_type: parameterized T, default Rational{BigInt}
```

### ノード属性
- `maps_from`: world_model concept の list
- `design_rationale`: なぜこの選択か
- `matlab_reference`: 対応する MATLAB 実装（あれば、無くても可）

### 使いどころ
- Phase D の唯一の入力
- ここが固まるまで Julia コードを書かない

---

## 12. タスク／進捗スコープ

### 役割
全ノードの**作業状態**を横断管理。M3E strategy board と統合。

### 状態語彙
- `todo_rapid`: Rapid 側にまだ投入されていない
- `rapid_done`: Phase A 完了（コード的情報は入った）
- `deep_ready`: concept 候補が立った、人間レビュー待ち
- `deep_done`: concept 確定
- `design_ready`: 設計待ち
- `design_done`: Julia 設計確定
- `impl_ready`: 実装待ち
- `impl_done`: Julia コード有り
- `verified`: 数値一致確認済み
- `blocked`: 依存で止まっている
- `abandoned`: スコープ外と判断

### ノード属性
- `state`: 上記
- `assignee`: 人 or agent 名
- `blocked_by`: 他ノード
- `updated_at`

### 使いどころ
- ROOT スコープ（0）のダッシュボード材料
- 「deep_ready のまま 1 週間放置」を検出
- Agent への自動タスク割り振り

---

## 効くビュー（スコープ横断）
- 実装（1）× 呼び出し順（3）: 「この method はいつ呼ばれるか」
- 実装（1）× 概念マップ（5+6）: 「このメソッドは何の数学概念か」
- 概念（5）× 設計（11）: 「この概念は Julia でどう表現するか」
- 設計（11）× 検証（10）: 「この設計は MATLAB と一致するか」

## 最初に必要
- Phase A 骨格: 0, 1, 2, 3, 4
- Phase B 最小: 5, 6
- 全 phase: 9（port_log は常時書き続ける）
- 後で必要になってから: 7, 8, 10, 11, 12

---

# Phase A 最小ノードフォーマット（1 周目暫定）

```
kind: file | class | method | property | math_op
attributes:
  path: Core/common/VectAlg.m
  lines: 828
  lang: matlab
  summary: 1行
  deps: [他ノード名]
  matlab_doc: 元コメント原文
```
link 種別: `inherits` / `calls` / `uses_property` / `defined_in`

粒度（方針: クラス依存、基本全列挙）:
- **VectAlg**: class + 全 properties + 全 method（828 行・約 40 method 規模、operator/math/display/verify/construct でサブグループ化）
- **VectHeisenbergDouble**: class + 全 method 7 個 + 全 properties 3 個
- **CyclicGroupAlg**: class + 全 method（Examples なのでそもそも小規模）
- 間引くと Phase B の concept 抽出時に「欠けてる method 由来の概念」が出てこなくなる → **全列挙が原則**

---

# リンク・エイリアス活用

12 facetsが並走するとノードの重複と散逸が必ず起きる。link と alias を積極的に使い、「実体は 1 つ、現れは複数」を基本方針にする。

## エイリアス（同一実体の多面的配置）

### 使いどころ
同じ method / concept を**複数スコープから自然にアクセスできる**ようにする。実体は 1 箇所、エイリアスで他スコープからも参照。

### 具体例
```
実体: method:VectHeisenbergDouble.setConst
  配置元: scope_1 (class_impl) / VectHeisenbergDouble / methods/instance/setConst

alias: scope_3 (call_flow) / scenario_construct_HD / step_2.setConst
alias: scope_6 (concept_map) / Heisenberg_double_multiplication / realized_by/setConst
alias: scope_7 (tensor_expr) / MH2_expression / source_method
alias: scope_12 (progress) / rapid_done_list / setConst
```
1 つの実体を編集すれば全 alias に反映される。**属性の二重管理を防ぐ**。

### 命名エイリアス（短縮・慣用名）
- `VectHeisenbergDouble` → `HD` / `H(H)`
- `comultiplication` → `Δ` / `coprod` / `Delta`
- `antipode` → `S`
- scope 5 (concept) ノードに記法エイリアスを持たせると、scope 8 (表記) と自動的にリンクされる

## リンク（異なる実体間の意味関係）

### link 種別の整理（スコープ横断で再利用）
| link 種別 | 方向 | 使われるスコープ |
|---|---|---|
| `inherits` | 型→親型 | 2 |
| `mixes_in` | 型→mixin | 2 |
| `calls` | method→method | 3, 4 |
| `follows` | step→step | 3 |
| `branches` | step→step | 3 |
| `uses_class` | method→class | 4 |
| `builtin` | method→外部 | 4 |
| `realizes` | method→concept | 6 |
| `defines` | method→concept | 6 |
| `uses` | method→concept | 6 |
| `encodes` | tensor式→concept | 6, 7 |
| `specializes` | 派生→基底 | 5, 6 |
| `violates` | 実装→仮定 | 6, 9 |
| `maps_from` | 設計→concept | 11 |
| `verifies` | テスト→invariant | 10, 5 |
| `pain_about` | port_log→対象 | 9 |
| `evolved_from` | 新規→Rapid元 | 昇格 (A→B) |

### 特殊 link: `evolved_from`（Rapid→Deep 昇格の記録）
```
concept: Heisenberg double (in scope 5, Deep)
  evolved_from:
    - class:VectHeisenbergDouble (scope 1)
    - method:setConst (scope 1)
    - tensor_expr:MH2 (scope 7)
  evolution_notes: |
    MATLAB では Hopf/quasi-Hopf を isa 分岐で実装。
    Deep では trait として分離。
    associator Φ は base concept に昇格させ、quasi-Hopf でのみ non-trivial に。
```
これを記録しておくと、**なぜ Julia 設計が MATLAB と違うか**の履歴が永久に辿れる。

## ROOT スコープからの link / alias

ROOT は各スコープに対して `contains` link、各スコープの**入口ノード**に対して alias を持つ。
```
ROOT/
  quick_access/
    current_class: alias → VectHeisenbergDouble (scope 1)
    current_concept: alias → Heisenberg double (scope 5)
    current_pain: alias → port_log/latest (scope 9)
```
「今注目している場所」を alias で記憶させるとセッション再開が速い。

## 直交性の扱い（同一ノードが複数スコープに出る）

### 基本方針
- **ノード実体 = 1 箇所**。「所属スコープ」は最も強い帰属（定義場所）で決める
  - method の実体 → scope 1
  - concept の実体 → scope 5
  - tensor 式の実体 → scope 7
- **他スコープからは alias で参照**
- **alias は複数階層に置いてよい**（scope 3 のシナリオ内と scope 6 の concept 内、両方に同じ method の alias）

### 検索・ビューへの影響
- alias を辿ると実体に飛ぶ
- 実体のバックリンクで「どの alias から参照されているか」一覧 → coverage の自動算出に使える
  - 「この method には scope 6 からの alias が無い」 = 未解釈

## 運用ルール（暫定）

1. 新規ノード作成時は**必ず実体スコープを決める**。迷ったら port_log/scope_pain に記録
2. 同じ名前で 2 つ作りそうになったら alias を検討
3. link 種別は事前に決めない。`realizes` から始めて必要になったら増やす
4. ROOT の quick_access は週次で棚卸し
5. `evolved_from` は Rapid→Deep 昇格の **必須記録**（後で履歴を辿る唯一の手段）

---

# 走りながら決める項目（port_log で蓄積）

以下は事前確定せず、作業中に port_log へ痛みを記録して逐次判定する。

- **実体の置き場**: 基本ルール（階層が自然な場所）で決める。違和感が 2 回出たら `port_log/scope_pain` で再検討
- **scope 6 の link 語彙**: `realizes` 1 種から開始。迷った瞬間に追加（事前確定しない）
- **alias の pruning**: 未使用 alias の検出ルールは運用後に決める
- **MATLAB 同名衝突**（`HopfAlg` が VectAlgebra / StrAlgebra 両方に存在）: alias で許容するか名前空間で解消するか、Phase A でぶつかった時点で判定
- **数値閾値**（Phase A→B 遷移、port_log 件数の分母、scope 稼働定義）: 初回 Phase 遷移時に事後的に決める
