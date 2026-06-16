# 05. 出版ツール統合 — LaTeX / Overleaf / Markdown 出版（H5）

論文・申請書執筆ツールへの export 統合。
project_projection_vision（半年で科研費出力）に **直結** する最重要カテゴリ。

idea/export_publish/ B1, B2 と重複領域だが、ここでは「**統合先ツールの仕様に合わせる**」観点で深掘り。

## H5. LaTeX/Overleaf 統合

### H5.1 出力先パターン

| ID | 出力先 | 配布チャネル | 編集後の戻し |
|----|-------|-------------|-------------|
| H5.1.a | ローカル .tex ファイル群 | Git / 手動 | M3E に再 import 不要 |
| H5.1.b | Overleaf プロジェクト（Git push）| Overleaf 共著 | 編集差分を取り込み |
| H5.1.c | 1ファイル .tex export（コピペ用）| 手動 | なし |
| H5.1.d | LaTeX → PDF まで生成 | PDF 配布 | なし |
| H5.1.e | LaTeX テンプレ + コンテンツ分離 | Git | 戻し可能 |
| H5.1.f | Overleaf API 直接書き込み | Overleaf | API 経由 |

→ **H5.1.b（Overleaf へ git push）** が共著時の現実解。

### H5.2 マップ → LaTeX の構造変換

| ID | 戦略 |
|----|------|
| H5.2.a | subtree = section、子 = subsection |
| H5.2.b | tag による章割り当て（@intro / @method / @result）|
| H5.2.c | IMRAD ビューを LaTeX 構造に直接マッピング |
| H5.2.d | カスタム DSL: ノード attribute で `latex_section: 2.3` を直接指定 |
| H5.2.e | 1 ノード = 1 段落、改行は `\\` 変換 |
| H5.2.f | text を Markdown 扱い → pandoc で LaTeX 変換 |

推し: **H5.2.c IMRAD + H5.2.f pandoc**。構造は IMRAD で、本文整形は pandoc に委譲。

### H5.3 引用 / Bibliography（H4 連動）

- H5.3.a 文献ノード → 自動で .bib エントリ生成
- H5.3.b ノード本文中の `@bibtex_key` を `\cite{...}` に変換
- H5.3.c Zotero Better BibTeX 出力 .bib を再利用
- H5.3.d natbib / biblatex のスタイル選択
- H5.3.e DOI から自動で BibTeX 取得

### H5.4 数式・図表

| ID | 内容 | 戦略 |
|----|------|------|
| H5.4.a | M3E ノード内 `$...$` をそのまま LaTeX に | Markdown→LaTeX で OK |
| H5.4.b | M3E ノード内の図（attribute path） → `\includegraphics` | 図ファイル管理 |
| H5.4.c | 表 → tabular 環境変換 | Markdown 表 |
| H5.4.d | アルゴリズム擬似コード | algorithmicx |
| H5.4.e | M3E のマップ subtree を tikz 図として出力 | 凝った機能 |

### H5.5 テンプレート方式（Tp）

| ID | 方式 |
|----|------|
| H5.5.a | 固定テンプレ（IMRAD のみ）|
| H5.5.b | 雑誌別テンプレ（IEEE / Elsevier / Nature） |
| H5.5.c | ユーザ定義テンプレ（自分のフォーマット） |
| H5.5.d | LLM プロンプトでテンプレ自動生成 |
| H5.5.e | Overleaf 既存テンプレ流用（テンプレに穴埋め）|
| H5.5.f | 申請書テンプレ（科研費・助成金）|

### H5.6 LLM 介入度（LLM）

| レベル | 内容 |
|-------|------|
| 0 | 純テンプレ展開、ノード text をそのまま |
| 1 | ノード本文を要約・繋ぎ言葉だけ AI |
| 2 | ノード群から段落を AI 生成 |
| 3 | 構成も AI（subtree 全体を読んで再構造化）|

レベル選択を **章単位** で切替可能にする案あり（Method は 0、Discussion は 2 など）。

### H5.7 双方向（戻し）

LaTeX → M3E に編集を戻す:

| ID | 戦略 |
|----|------|
| H5.7.a | 戻さない（M3E は思考、LaTeX は出力）|
| H5.7.b | section 単位の差分を該当ノードに通知 |
| H5.7.c | LaTeX のコメント `% m3e-node-id: xxx` で結合保持、編集が戻る |
| H5.7.d | 共著者の追記を「外部追記ノード」として import |
| H5.7.e | git diff を見て M3E に変更履歴ノード生成 |

### H5.8 ファイル分割戦略

| ID | 戦略 |
|----|------|
| H5.8.a | 全部 main.tex 1 本 |
| H5.8.b | section 別 .tex（\input） |
| H5.8.c | subtree 別ディレクトリ |
| H5.8.d | 章=ファイル、節=パラグラフ |
| H5.8.e | bib / fig / sty を専用ディレクトリ |

### H5.9 ユースケース

- UC-L1. 論文初稿: マップ Discussion subtree → LaTeX で出力 → Overleaf push
- UC-L2. 科研費申請書: 専用テンプレ + マップから穴埋め生成
- UC-L3. レビュー対応: 査読コメント = M3E の「対応ノード」、改稿後再 export
- UC-L4. 学位論文: 5章を 5 subtree、各 subtree を export
- UC-L5. プレプリント版を arXiv 用、final 版を雑誌用にテンプレ切替
- UC-L6. 共著者が Overleaf で編集 → diff を M3E に通知（H5.7.b）

### H5.10 Overleaf 連携の具体手順

```
M3E → 一時ディレクトリに .tex 生成
   → cd tmp && git init && git add . && git commit
   → git remote add overleaf https://git.overleaf.com/<project>
   → git push overleaf master
```

論点:
- Overleaf の git URL 認証（password / token）
- 共著者の編集を pull してから次回 push
- conflict 時の挙動

## H5 と Markdown 出版

LaTeX 以外の Markdown 系 export も併記:

### H5.M Markdown export

- H5.M.a Hugo / Jekyll / Astro 用静的サイト生成
- H5.M.b Notion ページ書き出し（H7 と接続）
- H5.M.c Zenn / Qiita 記事 export
- H5.M.d README.md 風の単一ファイル
- H5.M.e mdBook / docusaurus サイト

### H5.P PDF 直接出力

- H5.P.a Markdown → pandoc → PDF
- H5.P.b LaTeX → xelatex → PDF
- H5.P.c HTML → puppeteer print → PDF
- H5.P.d 専用デザインテンプレ（Typst 等）

### H5.S スライド出力（B3 / slideshow と接続）

- H5.S.a Reveal.js
- H5.S.b Marp（Markdown）
- H5.S.c Beamer（LaTeX）
- H5.S.d Google Slides API（クラウド）
- H5.S.e Keynote / PowerPoint export

## H5 横断の論点

### Pb1. 「正本はどこにあるか」問題
- M3E が正本: LaTeX は throw-away
- LaTeX が正本: M3E は構造設計のみ
- 両方が正本: 双方向同期必須

### Pb2. 申請書 vs 論文 vs スライドの違い
- 申請書: 文字数制限、図少ない、独自テンプレ
- 論文: IMRAD、引用必須、雑誌スタイル
- スライド: 1スライド1主張、図多い、短文

→ 同じマップから3形式が出る前提でテンプレ設計

### Pb3. 査読対応サイクル
- 初稿 → 査読 → 改稿 → 再査読 のループ
- 各ラウンドの差分を M3E でどう管理するか

### Pb4. 共著者との協働
- 共著者が M3E を使わない前提
- LaTeX/Overleaf が共通言語
- M3E はあくまで自分の構造管理

### Pb5. プライバシーと公開
- 論文に出してよい内容 vs プライベート思考の区別
- export 時に「公開可」フラグでフィルタ
- L2 自動マスキングと連動

## 推し度ランキング（H5 内）

| ランク | 案 | 理由 |
|-------|---|------|
| 1 | H5.2.c IMRAD → section 直マッピング | 構造変換の最短経路 |
| 2 | H5.5.f 申請書テンプレ | project_projection_vision 直撃 |
| 3 | H5.1.b Overleaf git push | 共著者との協働に不可欠 |
| 4 | H5.3.a + H5.3.b 文献自動引用 | H4 Zotero と接続、論文の必須機能 |
| 5 | H5.6 LLM 介入度の段階選択 | ユーザコントロールの本質 |
