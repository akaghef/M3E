# 01. コンセプト — なぜ既存ツール統合か

## 1.1 目的の再定義

M3E が孤立した「もう一つの島」になる最大のリスクを **統合** で回避する。
研究者・開発者は既に Git・Calendar・Obsidian・Zotero・VSCode・Slack 等を使っており、
M3E を採用するためにこれらを捨てさせるのは現実的でない。

→ **既存ツールの脇に M3E を置き、データを通わせる**。

## 1.2 統合の三類型

| 類型 | 方向 | 例 | 難度 | 価値 |
|------|------|---|------|------|
| Import（取り込み） | 外→M3E | Obsidian Vault 読み込み・GitHub Issue 一覧取得 | 低 | 中（既存資産活用） |
| Export（書き出し） | M3E→外 | LaTeX 論文出力・Markdown ブログ生成 | 中 | 高（成果物） |
| 双方向同期 | 双方向 | Notion ページ ⇔ ノード・Linear タスク ⇔ ノード | 高 | 高（運用統合） |

ブレスト方針: **3類型をどの統合先で採用するかは個別に判断**。
H1 Git は import + export 両方、H4 Zotero は import 中心、H7 Notion は双方向、など。

## 1.3 想定ユースケース（誰が・いつ・どんなシーン）

研究者 akaghef を中心に、**5+ シーン** を具体化:

### UC1. 論文執筆の最終 1 週間
- Zotero（H4）から引用文献ノードが既に M3E に取り込まれている
- M3E の subtree（Discussion セクション）を LaTeX（H5）に書き出し
- Overleaf に push → 共著者と協働
- Calendar（H2）の「投稿締切」イベントが M3E に紐付き、進捗ノードと並ぶ

### UC2. 朝の研究計画
- Calendar（H2）の今日の予定が M3E のデイリービューに表示
- 各予定ノードに、関連する研究マップ subtree がリンクされている
- 「14時の指導会」ノード → 議論したい3点の subtree

### UC3. 実装中の思考ログ
- VSCode（H6）でコードを書きながら、ノードを横に表示
- TODO コメントを書くと M3E に scratch ノードとして自動取り込み（A7 + H1）
- git commit するとマップに「実装ノード」が自動生成、commit メッセージが本文に

### UC4. 文献読みセッション
- Zotero（H4）で PDF を開く → 注釈を付ける
- M3E 側に「文献ノード」が自動生成、注釈本文がノードに転写
- 関連ノード（既存研究 subtree）との link 候補が AI 提案（C4 連動）

### UC5. Obsidian からの移行
- 過去 3 年分の Obsidian Vault（H3）を import
- 既存の `[[wikilink]]` 構造を M3E のノード ↔ link に変換
- 移行後も Obsidian は読み取り専用バックアップとして併用

### UC6. チーム研究室の Notion 連携
- 研究室の文献輪読 Notion ページ（H7）が M3E に subtree として import
- M3E で議論メモを追加 → Notion ページに同期で書き戻し
- 教員は Notion を見る、学生は M3E を使う

### UC7. PR レビュー連動（M3E 自身の開発）
- GitHub の PR（H1）が M3E の dev map に自動取り込み
- PR コメント = ノードコメント、レビュー状況 = ノード status
- M3E ドッグフード（O1）強化

## 1.4 既存ツールとの差分（なぜ M3E が必要か）

統合する以上、「M3E が既存ツールに何を足すか」を明確にする必要がある:

| 既存ツール | できること | M3E で足すもの |
|-----------|-----------|---------------|
| Git | 履歴・ブランチ | コミット間の **意味的構造** をノードリンクで |
| Calendar | 予定の時系列 | 予定間の **意味的関連**（テーマ・プロジェクト軸） |
| Obsidian | リンクされたノート | **空間配置** とビュー切替（IMRAD/Status等） |
| Zotero | 文献メタデータ | 文献間の **議論構造**（賛成/反対/関連） |
| LaTeX | 文章フォーマット | **執筆前の構造設計**（マップ→章節） |
| VSCode | コード編集 | コード外の **思考・設計メモ** との接続 |
| Notion | ページ階層 | **グラフ構造**（階層に縛られない） |
| Linear/Jira | タスク管理 | タスク間の **思考プロセス** ログ |

## 1.5 既存ツール調査メモ（簡易）

各統合先の API/データモデルの要点（深掘りは 02〜05 で）:

### H1 Git/GitHub
- Git: ローカル `.git` 直読み可能（gitoxide / isomorphic-git）
- GitHub: REST + GraphQL API、PAT or OAuth、webhook 可
- 主要オブジェクト: commit / branch / Issue / PR / discussion

### H2 Calendar
- Google Calendar API: OAuth 2.0 必須、events.list で取得、push notification 可
- Outlook/Microsoft Graph: OAuth、CalDAV 経由も可
- Apple Calendar: ローカル CalDAV、iCloud 経由

### H3 Obsidian/Roam/Logseq
- Obsidian: ローカル Markdown ファイル群、`[[wikilink]]` `#tag` 規約、frontmatter (YAML)
- Roam: クラウド、export JSON、block-level の親子関係
- Logseq: ローカル Markdown / Org-mode、block 単位

### H4 Zotero
- Local API: SQLite 直読み（zotero.sqlite）または Local API (port 23119)
- Web API: api.zotero.org、API key
- 主要オブジェクト: Item / Collection / Tag / Attachment / Note

### H5 LaTeX/Overleaf
- LaTeX: ローカル .tex 出力 → `pdflatex` / `xelatex`
- Overleaf: Git 経由（push 可）、API は限定的
- BibTeX: Zotero と直結

### H6 VSCode
- VSCode Extension API: TypeScript、Webview / TreeView / 言語サーバ
- 拡張公開: marketplace
- M3E ビューを Webview として埋め込み可能

### H7 Notion/Linear/Jira
- Notion API: OAuth、Block ベース、page = block tree
- Linear: GraphQL API、OAuth、Issue / Project / Cycle
- Jira: REST API、PAT / OAuth、Issue / Sprint / Epic

## 1.6 ブレストで意識する切り口

| 切り口 | 具体例 |
|-------|-------|
| **データ流** | どっち向きにデータが流れるか（C1.5 の三類型） |
| **トリガー** | いつ同期するか（手動 / 監視 / webhook / cron） |
| **粒度** | 何を1ノードにマップするか（commit/Issue/event/page） |
| **ID 戦略** | 外部 ID を M3E でどう保持するか |
| **プライバシー** | 何を外部に流すか / 流さないか |
| **オフライン** | 接続切れ時の動作 |
| **マルチアカウント** | 個人 GitHub と組織 GitHub の同居 |

## 1.7 横断的観察

- **「ローカル直読み」が一番楽で、一番安全で、一番強い**。Obsidian/Zotero/Git ローカルは OAuth 不要
- **クラウド統合は OAuth とトークン更新の運用負荷が継続発生**。一度作って放置できない
- **「全部のイベントをノードにする」は破綻する**。Calendar の「全予定」「全commit」「全Issue」を取り込んだら数千ノードに
- **絞り込みルール（タグ・スコープ・ラベル）の設計が統合の本質**
- **統合は capture_ingest と export_publish の特殊形**。完全に独立した機能ではない
