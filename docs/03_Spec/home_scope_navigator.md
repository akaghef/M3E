# Home Screen / Scope Navigator -- Design Document

Date: 2025-04-09
Author: visual agent
Status: DRAFT


## 1. 現状分析

### 現在のスコープ管理
- `viewer.ts` で `enterScope()` / `exitScope()` が実装済み
- `ViewState.currentScopeId`, `currentScopeRootId`, `scopeHistory[]` でスコープスタックを管理
- folder nodeType のノードがスコープ境界として機能（`isFolderNode()` で判定）
- URL パラメータ `?scope=` でスコープを永続化（`updateScopeInUrl()`）
- `Ctrl+]` で enterScope、`Ctrl+[` で exitScope のキーバインド

### 現在の ThinkingMode
- `type ThinkingMode = "flash" | "rapid" | "deep"` として型定義済み
- UI: toolbar 内の `.mode-switch` に 3 ボタン（Flash / Rapid / Deep）
- キーボード: `1`, `2`, `3` で切り替え
- 現時点ではモード切替は `viewState.thinkingMode` を変えるのみ。レンダリングやレイアウトへの差分なし

### 起動フロー
- `viewer.html` ロード → `viewer.ts` 即実行 → map 読み込み → ツリー描画
- ホーム画面は存在しない


## 2. ホーム画面レイアウト設計

### 2.1 概要

ホーム画面はファイルエクスプローラーのメタファーを採用する。
トップレベルの folder ノードを「プロジェクト」として一覧表示し、
ドリルダウンでサブフォルダに入る構造。

### 2.2 ワイヤーフレーム

```
+======================================================================+
|  [=] M3E                                    [Flash] [Rapid] [Deep]   |
+======================================================================+
|                                                                      |
|  Scope Navigator                                      [+ New Scope]  |
|  ----------------------------------------------------------------    |
|                                                                      |
|  Pinned                                                              |
|  +------------------+  +------------------+  +------------------+    |
|  | ** dev M3E     **|  | ** Study Notes **|  | ** Project X   **|    |
|  | 12 nodes         |  | 34 nodes         |  | 8 nodes          |    |
|  | updated 2h ago   |  | updated 1d ago   |  | updated 3d ago   |    |
|  +------------------+  +------------------+  +------------------+    |
|                                                                      |
|  Recent                                                              |
|  +------------------+  +------------------+  +------------------+    |
|  | dev M3E/tasks    |  | Study/math       |  | Project X/api    |    |
|  | 5 nodes          |  | 18 nodes         |  | 3 nodes          |    |
|  | opened 10m ago   |  | opened 2h ago    |  | opened yesterday |    |
|  +------------------+  +------------------+  +------------------+    |
|                                                                      |
|  All Scopes (tree)                                    [List] [Card]  |
|  +----------------------------------------------------------------+  |
|  | > dev M3E                                                      |  |
|  |   > tasks                                                      |  |
|  |     ready                                                      |  |
|  |     doing                                                      |  |
|  |     done-today                                                 |  |
|  |   > design                                                     |  |
|  | > Study Notes                                                  |  |
|  |   math                                                         |  |
|  |   physics                                                      |  |
|  | > Project X                                                    |  |
|  +----------------------------------------------------------------+  |
|                                                                      |
+======================================================================+
```

### 2.3 コンポーネント構成

| コンポーネント | 説明 |
|---|---|
| Header bar | 既存 toolbar を流用。ThinkingMode スイッチはここに残す |
| Pinned section | ユーザーがピン留めしたスコープ。カード形式 |
| Recent section | 最近開いたスコープ。`scopeHistory` の情報を永続化して利用 |
| All Scopes tree | folder ノードの階層をインデント付きリストで表示 |
| View toggle | カード表示 / リスト表示の切り替え |

### 2.4 カードに表示する情報

- スコープ名（folder ノードの `text`）
- 子ノード数
- 最終更新日時（`updatedAt` があれば）
- ThinkingMode バッジ（そのスコープで最後に使ったモード -- Phase 2 以降）


## 3. Flash / Rapid / Deep の位置づけ

### 3.1 上位ビジョン: 日常→業務→研究の一気通貫

M3E が解く問題: **知識の蓄積は日常〜局所推論レベルでは機能するが、信頼性の累積ができないために大域的レベル（研究）に外挿できない。**

これを解決するために:
- ノードに **信頼度 (confidence) / 温度 (temperature)** 等のパラメータを付与するアーキテクチャ
- 人間の介入（ミクロな情報操作、構造のリファクタリング）を前提とした UX
- **LLM-friendly** な知識ベース — TCL (Tree Compatible Language) による構造↔自然言語の双方向変換
- 日常のメモから研究レベルの体系まで、**同一データモデル上でスケール**する設計

Flash / Rapid / Deep はこの「日常→業務→研究」のスケーラビリティを UX として体現する。

```
  信頼度の累積 / 構造の厳密さ
         ↑
         |  Deep   ── 研究レベル: 信頼度付きオントロジー、反証可能な仮説体系
         |              属性: confidence, evidence, temperature
         |              人間による構造リファクタリング + AI 検証
         |
         |  Rapid  ── 業務レベル: データフロー、因果モデル、システム設計
         |              構造は明示的だが信頼度は暗黙的
         |              チームでの共有・議論が中心
         |
         |  Flash  ── 日常レベル: 素早いキャプチャ、マルチモーダル入力
         |              構造は後付け、信頼度は未定義
         |              個人のワーキングメモリ拡張
         ↓
  入力の速さ / 自由度
```

**核心**: Flash で入れた知識が Rapid で構造化され、Deep で検証・体系化される。この **昇格パス** が M3E の本質的価値。

### 3.2 3サービスの定義

| Mode | 知識レベル | 本質 | メタファー |
|---|---|---|---|
| Flash | **日常** | マルチモーダル キャプチャ | デジタルホワイトボード |
| Rapid | **業務** | データフロー / 多様なグラフ構造 | ダイアグラムエディタ |
| Deep | **研究** | 体系的知識 / オントロジー | ナレッジベースエディタ |

#### Flash — 日常のキャプチャ
- 画像・音声・テキスト・スケッチの素早い取り込み
- 構造は後から付ける（または AI が提案する）
- ノードに信頼度パラメータは付かない（まだ「思いつき」段階）

#### Rapid — 業務の構造化
- フローチャート、ネットワーク図、因果関係図、シーケンス図
- 現在のマインドマップ（放射状ツリー）もここに含まれる
- 構造が明示的。チームで共有・議論するための可視化
- ノードに基本属性（status, priority, owner）が付く

#### Deep — 研究の体系化
- 階層分類、属性定義、メタデータ付き知識体系
- ノードに **信頼度 (confidence)、証拠強度 (evidence)、温度 (temperature)** が付く
- GraphLink の relationType で関係の意味を型付け（is-a, causes, contradicts, supports）
- TCL による構造↔自然言語の双方向変換
- 人間が構造をリファクタリングし、AI が整合性を検証する協働ループ

### 3.2.1 現在の実装との関係

現在の SVG ツリー + GraphLink の実装は **Deep と Rapid の両方に通用する**。
ただし Rapid が目指すのは現在のツリー構造に留まらない、**より多様なグラフレイアウト**:

- フローチャート（左→右の有向グラフ）
- ネットワーク図（force-directed layout）
- 因果ループ図（循環グラフ）
- シーケンス図
- 現在のマインドマップ（放射状ツリー）

Deep は現在のツリー構造をそのまま活かしつつ、**ノードの情報密度を上げる**方向。

### 3.2.2 知識の昇格パス

```
Flash (キャプチャ)
  │  AI提案: 「この写真メモを構造化しますか？」
  │  人間操作: ノードをRapidスコープにドラッグ
  ▼
Rapid (構造化)
  │  AI提案: 「このフローに矛盾があります。信頼度を付けますか？」
  │  人間操作: 属性にconfidence/evidenceを追加、構造リファクタリング
  ▼
Deep (体系化)
  │  AI検証: 「仮説H1の前提P2の信頼度が低下しています」
  │  人間操作: 反証条件の追加、既存体系への統合
  ▼
出力: TCL → 論文ドラフト / 教育資料 / API
```

この昇格は強制ではない。Flash だけで使っても、Deep だけで使っても構わない。
ただし **昇格パスが存在すること** が M3E のアーキテクチャ的優位性。

### 3.3 ホーム画面での表現

```
+======================================================================+
|  [=] M3E                                                             |
+======================================================================+
|                                                                      |
|  +------------------+  +------------------+  +------------------+    |
|  |    ⚡ Flash      |  |    🔀 Rapid      |  |    🔬 Deep       |    |
|  |                  |  |                  |  |                  |    |
|  |  最近のメモ 12件  |  |  ダイアグラム 5件 |  |  知識体系 3件     |    |
|  |  + 新規キャプチャ |  |  + 新規ダイアグラム|  |  + 新規オントロジー|    |
|  +------------------+  +------------------+  +------------------+    |
|                                                                      |
|  All Scopes                                           [List] [Card]  |
|  +----------------------------------------------------------------+  |
|  | > 研究ノート [Deep]           confidence: 0.85                 |  |
|  |   > 仮説群                    3 nodes, updated 2h ago          |  |
|  | > プロジェクト計画 [Rapid]     フロー図, 12 nodes               |  |
|  | > 今日のメモ [Flash]           画像3, テキスト8                 |  |
|  +----------------------------------------------------------------+  |
|                                                                      |
|  昇格候補                                              [AI提案]     |
|  +----------------------------------------------------------------+  |
|  | 💡 Flash「実験写真メモ」→ Rapid に構造化できそうです            |  |
|  | 💡 Rapid「因果モデル v2」→ Deep に信頼度を付与できます          |  |
|  +----------------------------------------------------------------+  |
+======================================================================+
```

ホーム画面の3つのセクション:
1. **モード別エントリ** — Flash / Rapid / Deep のカードから直接新規作成 or 最近のスコープ
2. **All Scopes** — 全スコープ一覧。各スコープにモードタグと信頼度サマリ
3. **昇格候補 (AI提案)** — Flash→Rapid、Rapid→Deep への昇格を AI が提案

### 3.4 エントリポイントの違い

- **Flash**: カードクリック → マルチモーダル入力画面。テキスト / 画像 / 音声を素早く取り込む
- **Rapid**: カードクリック → ダイアグラムエディタ。グラフ種別（フロー / ネットワーク / ツリー等）を選択可能
- **Deep**: カードクリック → ツリー表示 + 右パネルにメタデータエディタ（attributes, details, note, confidence, evidence）


### 3.5 Deep vs Rapid 境界要素一覧

**分析の軸**:
- Rapid = **業務レベル**: 構造の可視化・共有。多様なグラフレイアウトでデータフローを描く
- Deep = **研究レベル**: 信頼度パラメータ付きの体系的知識。ノード単位でメタデータを精密に扱う

#### 境界要素テーブル

| # | 要素 | Rapid | Deep | 境界の根拠 |
|---|------|-------|------|-----------|
| **レンダリング** | | | | |
| 1 | SVG ツリーレイアウト | 主役。全ノードを空間配置して構造を俯瞰 | 表示するが補助的。ノード間距離を広げて詳細パネルを挟む余地を作る | Rapid は「全体を見渡す」ため密なレイアウトが有利。Deep はノード個別の情報スペースが必要 |
| 2 | ベジェ曲線エッジ | 表示（depth カラーリング） | 表示（同様） | 両モード共通。親子関係の可視化は常に必要 |
| 3 | folder-box フレーム | 表示（スコープ境界の視認） | 表示（同様 + スコープ内ノード数等の追加情報を検討） | 共通だが Deep ではアノテーション追加の余地 |
| **表示情報量** | | | | |
| 4 | ノードラベル (`text`) | 表示。truncation あり（`maxNodeTextChars: 55`） | 表示。より長いテキストを許容（truncation 緩和 or 折り返し強化） | Rapid は「見出し」レベルで十分。Deep はノード本文も重要 |
| 5 | `details` フィールド | 非表示（SVG 上に露出なし） | ノード選択時にサイドパネル or tooltip で表示 | details は補足情報。俯瞰時はノイズ、深掘り時は必須 |
| 6 | `note` フィールド | linear panel 経由でのみ間接的にアクセス | ノード選択時にインラインまたはパネルで直接表示・編集 | note はノードに紐づくメモ。Deep でこそ活用 |
| 7 | `attributes` | 非表示（importance filter のみ間接利用） | ノード選択時にキーバリューエディタで表示・編集 | attributes は構造化メタデータ。Rapid では不要、Deep で初めて意味を持つ |
| 8 | `link` フィールド | 非表示 | ノード選択時にリンクアイコン or パネルで表示。クリックで開く | URL リンクは深掘り時の参照資料 |
| 9 | alias バッジ | 表示（read/write/broken のテキストバッジ） | 表示 + alias 対象ノードの preview を表示 | Rapid は「このノードは alias」と分かれば十分。Deep は参照先の中身が見たい |
| **GraphLink（明示的リンク）** | | | | |
| 10 | GraphLink 曲線描画 | 表示（ただし style=soft のみ、他は情報過多になりうる） | 全スタイル表示（default/dashed/soft/emphasis） | Rapid は構造の流れが主。Deep はリンクの種類・意味まで識別したい |
| 11 | GraphLink ラベル | 非表示 or hover 時のみ | 常時表示（relationType, label） | ラベルは Rapid の俯瞰ビューではノイズ |
| 12 | GraphLink 方向矢印 | 表示（方向の区別は構造理解に有用） | 表示（同様） | 共通 |
| **操作体験** | | | | |
| 13 | キーボード ノード移動 (Arrow) | 主要操作。高速にツリーを巡回 | 同様に使用 | 共通 |
| 14 | Inline editor | Enter でラベル編集のみ | Enter でラベル編集 + Tab で details/note/attributes 編集へ遷移 | Rapid は「ラベルだけ直す」。Deep は「ノードの全フィールドを編集する」 |
| 15 | Drag & Drop (reparent/reorder) | 主要操作。構造の大幅な組み替え | 使用可能だが、Deep ではキーボード操作 (`M`->`P`) を優先 | Rapid はビジュアルで直感的な構造変更。Deep は正確な操作 |
| 16 | Multi-selection | 頻用。複数ノードをまとめて移動・削除・グループ化 | 使用可能だが、単一ノードの深掘りが中心 | Rapid は「まとめて操作」、Deep は「1つずつ丁寧に」 |
| 17 | Group selected (`Ctrl+G`) | 頻用。素早いカテゴリ分け | 使用可能 | 構造化は Rapid の主要操作 |
| 18 | Copy/Cut/Paste | 頻用 | 使用可能 | 共通 |
| **レイアウト** | | | | |
| 19 | `columnGap` (170px) | 現在値が適切。ノード間を詰めて全体を見渡す | より広い値（例: 250px）。ノード間に details パネルを表示する余地 | Deep は情報密度を上げるためスペースが必要 |
| 20 | `siblingGap` (1px) | 密。多くのノードを画面内に収める | より広い値（例: 12-20px）。各ノードの details 表示スペース | Rapid は「数」、Deep は「個々の質」 |
| 21 | 折りたたみ挙動 (`Space`) | 頻用。不要なブランチを隠して俯瞰を維持 | 使用可能だが、Deep ではデフォルト展開気味 | Rapid は「見たいところだけ開く」。Deep は「全部見る」が基本 |
| 22 | Zoom 範囲 (0.15-2.5) | フル活用。zoom out で全体を俯瞰 | zoom in 側を多用。個別ノードの詳細を見るため | Rapid は鳥瞰、Deep は顕微鏡 |
| **パネル** | | | | |
| 23 | Linear panel | 補助的。スコープの文字列表現を確認・軽微な編集 | **表示する（TCL 変換は Deep の核心機能）** | 全モードで利用可能。Deep では TCL 変換の主要インターフェース |
| 24 | Meta panel | toggle で開閉（デバッグ用） | 常時表示を検討。scope/mode/stats 情報が Deep では有用 | Deep は作業状態の確認頻度が高い |
| 25 | Scope summary | meta panel 内に表示 | パンくずリスト + コンテキストパネルに統合 | Deep はスコープの外部コンテキストを常に意識 |
| **新規 Deep 専用要素（未実装）** | | | | |
| 26 | Node detail panel | -- | 選択ノードの details/note/attributes/link を編集するサイドパネル | Deep の核心機能。Rapid には不要 |
| 27 | Attribute editor | -- | key-value ペアの CRUD UI | attributes は Deep でのみ直接操作 |
| 28 | Note editor | -- | Markdown 対応のリッチエディタ | note は Deep でインライン表示・編集 |
| 29 | Link inspector | -- | GraphLink の一覧表示、relationType/style の編集 | リンクの詳細操作は Deep 専用 |
| 30 | Importance filter UI | toolbar にフィルタ切り替えボタン（既存ロジック流用） | 同様 + attributes パネルから直接 importance を設定 | フィルタは両方で使うが、設定は Deep |
| **LaTeX** | | | | |
| 31 | LaTeX レンダリング | 表示（foreignObject + KaTeX） | 表示（同様） + 数式ソース編集の専用 UI | 表示は共通。ソース編集は Deep 向け |

#### 分類サマリー

**Rapid 専用（Deep では抑制する要素）**:
- なし。Rapid の全機能は Deep でも利用可能であるべき。ただし UI の優先度が異なる

**Deep 専用（Rapid にはない要素）**:
- Node detail panel (details/note/attributes/link の閲覧・編集)
- Attribute editor
- Note editor (インライン)
- Link inspector (GraphLink の詳細操作)
- LaTeX ソース編集 UI

**両モード共通だがパラメータが異なる要素**:
- `columnGap` / `siblingGap`: Deep は広め
- `maxNodeTextChars`: Deep は緩和
- GraphLink label: Rapid は非表示 or hover、Deep は常時表示
- Linear panel: 全モードで表示（Deep では TCL 変換の主要 UI）
- 折りたたみデフォルト: Rapid は折りたたみ気味、Deep は展開気味
- Zoom 利用パターン: Rapid は zoom out 多用、Deep は zoom in 多用

#### 設計判断: Flash / Rapid / Deep の境界（2026-04-09 確定）

**A. データモデル**

| # | 問い | 判断 | 備考 |
|---|------|------|------|
| A1 | スコープは1つのモードに固定？ | **切り替え可能（単一ビュー）** | モードはビュー属性であり、データ属性ではない。同一スコープを F/R/D どれでも開ける |
| A2 | Flash と Deep のノードは同じ型？ | **Flash は別型（マルチモーダル）、Rapid と Deep は同じ TreeNode 型** | Flash はメディア（画像・音声等）を扱うため専用構造が必要。Rapid はグラフ型も許可（GraphLink は全モード共通） |
| A3 | confidence / temperature の保存先 | **未定** | 今後他にも増えそう。attributes 予約キーか新フィールドかはもう少し要件が固まってから決める |
| A4 | Rapid のグラフレイアウト情報の保存先 | **Deep と同じ場所** | レイアウト情報の保存方式は F/R/D で分けない。統一的に扱う |

**B. UX**

| # | 問い | 判断 | 備考 |
|---|------|------|------|
| B1 | Flash → Rapid の昇格トリガー | **編集方法が変わること自体がトリガー** | ツリー構造で編集し始めた時点で Rapid 的。明示的な「昇格」操作は不要。ツリーの方が体系的知識として良いはず |
| B2 | Rapid → Deep の昇格トリガー | **同上。編集の深さが変わる** | confidence を付け始めたら自然と Deep 的。閾値ではなくグラデーション |
| B3 | モード切替時の状態遷移 | **未定** | 追って詳細設計 |
| B4 | Linear panel は Deep でも表示？ | **表示する** | TCL 変換は Deep の核心機能。Linear panel は全モードで利用可能 |
| B5 | チーム同時編集で異なるモードの競合 | **モードは見方であってデータではないので基本的に競合しない** | ただし優先度設定の仕組みは検討した方がよい |

**C. Rapid 固有**

| # | 問い | 判断 | 備考 |
|---|------|------|------|
| C1 | グラフレイアウトは表示切替 or データ構造変更？ | **表示切替。データ構造は変わらない** | ノードの位置（座標）は変わるが、中身のデータ構造（TreeNode + GraphLink）は同じ |
| C2 | TreeNode で循環グラフ・任意グラフを扱えるか？ | **ツリーが主軸。GraphLink で補完** | データ構造としてツリーの主軸は常に存在する。循環関係は GraphLink として表現。新データ構造は不要 |
| C3 | フローの矢印は GraphLink か親子エッジか？ | **データフローでは GraphLink も可視化** | 親子エッジ + GraphLink の両方が見える。フローの文脈では GraphLink の方向・ラベルが重要 |
| C4 | 自由配置エディタか自動レイアウトか？ | **切り替え可能** | 自動レイアウト（デフォルト）と自由配置（手動ドラッグで座標固定）を切り替えられる |
| C5 | GraphLink の意味が Rapid と Deep で混在？ | **混在しない** | GraphLink 自体は汎用。relationType で意味を区別（flow / is-a / causes 等）。モードによって表示の強弱は変わるが、データとしては統一 |

**D. Flash 固有**

| # | 問い | 判断 | 備考 |
|---|------|------|------|
| D1 | マルチモーダルデータの保存先 | **Flash はごちゃごちゃしてよい** | F→R→D と段階的に情報が整理されていくフロー。Flash 段階ではラフな保存で OK |
| D2 | Flash のレンダリングは SVG か HTML か？ | **未定** | 画像・音声の表示に SVG は制約が多い。HTML カードビューが自然かもしれないが、要検証 |
| D3 | Flash に構造はあるか？ | **時系列が原則だが厳密ではない** | 並び順は基本的に時系列。ただし強制ではなく、ユーザーが自由に並べ替え可能 |

**残り未定の項目**: A3（confidence 保存先）、B3（モード切替時の状態遷移）、D2（Flash のレンダリング方式）

#### 実装上の境界ポイント

ThinkingMode によるビュー分離を実装する場合、以下のアプローチが考えられる:

1. **VIEWER_TUNING の mode 分岐**: `columnGap`, `siblingGap`, `maxNodeTextChars` を mode ごとに定義
2. **render() 内の条件分岐**: GraphLink label の表示/非表示、linear panel の表示制御
3. **新規パネルの追加**: Node detail panel は Deep モード時のみ DOM に追加
4. **CSS クラスによる切り替え**: `body.mode-deep`, `body.mode-rapid` でスタイルを分岐

最小変更で最大効果を得るなら、まず (1) VIEWER_TUNING の mode 分岐 と (2) render() の条件分岐から始め、
(3) Node detail panel は Phase 3 で新規実装するのが妥当。


## 4. ナビゲーション遷移

### 4.1 画面遷移図

```
                    +==============+
                    |   Home       |
                    |   Screen     |
                    +==============+
                      |    ^    |
          Flash       |    |    |       Deep
          click       |    |    |       click
                      v    |    v
  +-----------+    +============+    +-----------+
  | Flash     |    |  Rapid     |    |  Deep     |
  | (linear   |<-->|  (SVG map) |<-->|  (outline |
  |  editor)  |    |            |    |   editor) |
  +-----------+    +============+    +-----------+
       |                |                 |
       |     Escape / Home button         |
       +----------> Home <----------------+
                      |
                      | Ctrl+] on folder
                      v
                 +============+
                 | Sub-scope  |
                 | (same mode)|
                 +============+
                      |
                      | Ctrl+[ / Escape
                      v
                    Home or Parent scope
```

### 4.2 パンくずリスト / パスバー

既存の `scopePathIds()` をそのまま活用できる。

```
+--------------------------------------------------------------+
| Home > dev M3E > tasks > ready                          [x]  |
+--------------------------------------------------------------+
```

- 各セグメントはクリッカブル。クリックでそのスコープに直接ジャンプ
- 右端の `[x]` でホームに戻る
- 既存の `scope-meta` div を置き換える形で toolbar 直下に配置

### 4.3 キーボードショートカット

| Key | Action |
|---|---|
| `Escape` | エディタ内: 編集キャンセル（既存動作維持）。ナビゲーション状態: 親スコープに戻る。ルートスコープ: ホームに戻る |
| `Ctrl+[` | 親スコープに戻る（既存） |
| `Ctrl+]` | 選択中の folder に入る（既存） |
| `Alt+H` | どこからでもホームに戻る |
| `Ctrl+P` | スコープ Quick Picker（VS Code 風のコマンドパレット） |

### 4.4 Quick Picker（Phase 2）

```
+----------------------------------------------+
| > Search scopes...                           |
|----------------------------------------------|
| dev M3E / tasks / ready          (3 nodes)   |
| dev M3E / design                 (12 nodes)  |
| Study Notes / math               (18 nodes)  |
+----------------------------------------------+
```

- `Ctrl+P` で開くモーダル
- インクリメンタルサーチでスコープをフィルタ
- Enter で選択したスコープに遷移


## 5. 既存 UI との整合性

### 5.1 viewer.html への統合

別ページではなく、SPA 内の状態切り替えとして実装する。

理由:
- 現在 `viewer.html` が唯一のエントリポイント。ルーティングの仕組みがない
- データ（`map`。実装上は `doc`）は JS 変数としてメモリ上に存在。ページ遷移するとロードし直しが必要
- overlay 方式なら既存の SVG レンダリングと共存しやすい

### 5.2 実装アプローチ: overlay div

```html
<!-- viewer.html に追加 -->
<div id="home-screen" class="home-screen">
  <!-- ホーム画面 HTML -->
</div>
```

- `.home-screen` は `position: absolute; inset: 0; z-index: 10;` で board の上に配置
- ホーム表示中は `.board` と `.linear-panel` を `visibility: hidden` にする（DOM は維持）
- これにより、スコープ選択後の復帰が高速（再レンダリング不要）

### 5.3 scope-meta パネルとの関係

- ホーム画面導入後、`scope-meta` はパンくずリストに統合される
- `meta-panel` は開発者向けデバッグ情報として hidden のまま残す
- `scope-summary`（outside: ...）の情報はホーム画面のカードに移動

### 5.4 CSS 設計

- 既存の `viewer.css` に `.home-screen` セクションを追加
- カード / リストのスタイルは既存の glassmorphism デザイン言語に合わせる
  - `background: rgba(255, 255, 255, 0.9)`
  - `backdrop-filter: blur(10px)`
  - `border-radius: 14px`
  - `box-shadow: 0 16px 34px rgba(24, 24, 24, 0.12)`


## 6. データモデルへの影響

### 6.1 必要な永続化データ

ホーム画面のために以下の情報を localStorage（または doc のメタデータ）に保存する:

```typescript
interface HomeScreenState {
  pinnedScopeIds: string[];          // ピン留めスコープ
  recentScopes: RecentScope[];       // 最近開いたスコープ（最大 20）
  viewPreference: "card" | "list";   // 表示形式
  lastModePerScope: Record<string, ThinkingMode>;  // Phase 2
}

interface RecentScope {
  scopeId: string;
  openedAt: number;   // Unix timestamp
}
```

### 6.2 TreeNode への変更

変更なし。既存の `nodeType: "folder"` がスコープ境界として機能する。


## 7. 実装フェーズ

### Phase 1: 基本ホーム画面（MVP）

目標: ホーム画面として最低限のスコープ一覧 + 遷移

- [ ] `viewer.html` に `#home-screen` overlay div を追加
- [ ] `viewer.css` にホーム画面スタイルを追加
- [ ] `viewer.ts` に `showHomeScreen()` / `hideHomeScreen()` を追加
- [ ] folder ノードを走査してスコープ一覧を構築する関数
- [ ] スコープカードのクリックで `enterScope()` を呼び出す
- [ ] `Alt+H` でホームに戻るキーバインド
- [ ] パンくずリスト（`scopePathIds()` ベース）

変更ファイル:
- `beta/viewer.html` -- overlay div 追加
- `beta/viewer.css` -- ホーム画面スタイル
- `beta/src/browser/viewer.ts` -- ホーム画面ロジック

### Phase 2: ピン留め + 最近のスコープ

- [ ] `HomeScreenState` を localStorage に保存/復元
- [ ] ピン留め UI（カード右上にピンアイコン）
- [ ] 最近開いたスコープの自動記録
- [ ] Quick Picker (`Ctrl+P`) の実装

### Phase 3: ThinkingMode ごとのビュー分離

- [ ] Flash モード: スコープ選択 → linear panel フルスクリーン
- [ ] Deep モード: アウトラインビュー（新規実装）
- [ ] モードごとのホーム画面レイアウト切り替え
- [ ] `lastModePerScope` の保存

### Phase 4: ミニマップ プレビュー + 検索

- [ ] カードにスコープ内容のサムネイル（縮小 SVG）
- [ ] スコープ横断のテキスト検索
- [ ] ドラッグ & ドロップによるスコープ間のノード移動


## 8. リスク・注意事項

- `viewer.tuning.ts` の定数はホーム画面には直接影響しないが、
  エディタ復帰時のレイアウト再計算に注意
- ホーム画面は HTML/CSS ベース（SVG ではない）。二つのレンダリング系統が混在することになる
- `scopeHistory` は現在セッション内のみ。ホーム画面で「最近のスコープ」を提供するには
  別途 localStorage への永続化が必要
- Escape キーの多重責務（編集キャンセル / スコープ戻り / ホーム戻り）は
  状態オートマトンを明確に定義して衝突を防ぐ必要がある


## 9. 設計判断が必要な項目

以下は manager への確認が必要:

1. **ホーム画面をデフォルト表示にするか?**
   起動時にホーム画面を見せるか、従来通り即ツリー表示にするか。
   URL に `?scope=` がある場合はツリー直行が自然だが、ない場合はどちらか。

2. **Flash モードの独自ビューをどこまで作るか?**
   Phase 3 の Flash フルスクリーン linear は大きな変更。
   まずは Rapid のみでホーム画面を完成させるべきか。

3. **スコープ永続化の保存先**
   localStorage vs map メタデータ。
   Cloud Sync との整合性を考えると map 内が望ましいが、
   実装上は `doc` フォーマットの変更を伴う。
