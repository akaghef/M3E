# 02. 開発ツール統合 — Git/GitHub・VSCode（H1, H6）

開発系ツール（コード履歴・エディタ・Issue）と M3E の接続選択肢を列挙。
研究者でも開発者でも **時間の最大投入先** であり、ここを統合できれば M3E の常駐性が跳ね上がる。

## H1. Git/GitHub 統合

### H1.1 何をマップに入れるか（粒度の選択肢）

| ID | 粒度 | 説明 | 良い点 | 悪い点 |
|----|------|------|-------|-------|
| H1.1.a | commit = ノード | 各 commit が1ノード | 履歴がそのままマップに | 数千ノードに爆発 |
| H1.1.b | branch = ノード | branch ごとに親ノード、commit は属性 | コンパクト | commit detail 失う |
| H1.1.c | PR = ノード | PR 単位、レビュー状況が status | 意味的単位 | 単独 commit が落ちる |
| H1.1.d | Issue = ノード | Issue/discussion が1ノード | 議論構造が乗る | コードと切れる |
| H1.1.e | tag/release = ノード | リリース節目だけ | 超コンパクト | 細部失う |
| H1.1.f | ファイル = ノード | 主要ファイルが1ノード、commit は履歴 | 構造的 | 移動・rename 追従難 |
| H1.1.g | ハイブリッド | commit + Issue + PR を別 attribute で | 柔軟 | 複雑 |

推し: **H1.1.c (PR) + H1.1.d (Issue) のハイブリッド**。意味的単位が大きすぎず小さすぎない。

### H1.2 同期方向（Sd）

| ID | パターン | 例 |
|----|---------|---|
| H1.2.a | GitHub → M3E のみ | Issue/PR を読むだけ、編集しない |
| H1.2.b | M3E → GitHub のみ | M3E のノードから Issue を作成 |
| H1.2.c | 双方向 | Issue タイトル変更が両側に伝播 |
| H1.2.d | M3E → repo にコミット | マップ自体を repo にコミット（version 管理） |

H1.2.d は既存の M3E backup 機能と相性が良い（マップを `m3e-map.json` として commit）。

### H1.3 トリガー（Tr）

| ID | トリガー | 内容 |
|----|---------|-----|
| H1.3.a | 手動 fetch | UI ボタンで「今 GitHub から取り込み」 |
| H1.3.b | 起動時 | M3E 起動時に自動 fetch |
| H1.3.c | 定期 poll | 5分ごとに更新確認 |
| H1.3.d | webhook | GitHub 側から push 通知（要 ngrok 等） |
| H1.3.e | git hook | post-commit で M3E API 叩く |
| H1.3.f | CLI | `m3e git pull` コマンド |
| H1.3.g | GitHub Action | repo 側の Action で M3E に通知 |

ローカル開発では **H1.3.e (git hook)** が一番シームレス。

### H1.4 認証（Au）

| ID | 方式 | 難度 | スコープ |
|----|-----|------|---------|
| H1.4.a | ローカル `.git` 直読み | 不要 | 本人のみ |
| H1.4.b | PAT (Personal Access Token) | 低 | 個人開発者 |
| H1.4.c | GitHub App | 高 | 組織 |
| H1.4.d | OAuth | 中 | 多ユーザ |
| H1.4.e | SSH key 経由 | 低 | git push のみ |

ローカル `.git` だけで commit / branch / log は十分読める。GitHub Issue/PR には API 必要。

### H1.5 commit メッセージ → ノード本文の変換

- H1.5.a そのままノード本文に貼る
- H1.5.b Conventional Commits パース（feat/fix/docs を tag に）
- H1.5.c 1 行目をタイトル、本文を details に
- H1.5.d AI で要約してノードに
- H1.5.e diff の規模を attribute（loc 増減）に格納
- H1.5.f 関連 Issue 番号（#123）を自動 link 化

### H1.6 マップを repo にコミット（H1.2.d 深掘り）

- H1.6.a `m3e-map.json` を毎回 commit（バイナリ的）
- H1.6.b ノードごとに別 .md ファイル化（diff フレンドリー）
- H1.6.c 別ブランチ（`m3e-map`）に隔離
- H1.6.d submodule 化
- H1.6.e 別 repo として管理、リンクのみ

H1.6.b は Obsidian Vault と相性良い（H3 と接続）。

### H1.7 GitHub 特有の概念マッピング

| GitHub | → M3E |
|--------|-------|
| Issue label | tag |
| Issue assignee | attribute（assignee） |
| Milestone | 親ノード |
| Project board column | status |
| PR review state | status（pending/approved/changes-requested） |
| Discussion category | subtree |
| Wiki page | ノード |

### H1.8 ユースケース具体例

- UC-G1. M3E 自身の dev map に GitHub Issue が自動取り込み（O1 強化）
- UC-G2. 研究プロジェクトの実装を git で管理、commit 進捗が研究マップに反映
- UC-G3. PR レビュー時に「このコードに関連する設計ノード」を表示
- UC-G4. release tag が出るたび「リリースノートノード」が自動生成
- UC-G5. fork した別 repo から「自分の貢献分」だけ抽出してマップ化

## H6. VSCode 拡張統合

### H6.1 拡張の形態

| ID | 形態 | 説明 |
|----|------|-----|
| H6.1.a | Webview パネル | M3E ビューをそのまま VSCode サイドバー or エディタ列で表示 |
| H6.1.b | TreeView | ノード階層を VSCode の Explorer 風 TreeView で |
| H6.1.c | 言語サーバ | コード内の特殊コメント（@m3e-node-id 等）から飛べる |
| H6.1.d | コマンドパレット連携 | `M3E: Add Node` で即追加 |
| H6.1.e | エディタ装飾 | コード行に「関連ノード」マーカー |
| H6.1.f | Status Bar 表示 | 現在開いているファイル関連ノード数 |

推し: **H6.1.a + H6.1.d** の組み合わせ。

### H6.2 双方向リンクの粒度

| ID | リンク対象 | 識別子 |
|----|-----------|-------|
| H6.2.a | ファイル単位 | path |
| H6.2.b | 関数単位 | symbol（LSP） |
| H6.2.c | 行範囲 | path:start-end |
| H6.2.d | コミット単位 | sha |
| H6.2.e | TODO コメント | コメント本文 |

行範囲（H6.2.c）は移動に弱い。LSP symbol（H6.2.b）が rename にも追従する点で強い。

### H6.3 トリガーアクション

- H6.3.a ファイル保存時に M3E ノードに「last_touched_code」属性更新
- H6.3.b TODO コメント追加時に scratch ノード生成（A7 と H1 の合流点）
- H6.3.c カーソルが特定関数内 → サイドバーに関連ノード表示
- H6.3.d コードレビュー時 → コメント = ノードコメント
- H6.3.e ブレークポイント設置 → デバッグメモノード生成

### H6.4 通信方式

| ID | 方式 | 良い点 | 悪い点 |
|----|------|-------|-------|
| H6.4.a | M3E ローカル REST API（既存）| 既存資産 | M3E サーバ起動必須 |
| H6.4.b | ファイル監視（map.json）| サーバ不要 | リアルタイム弱 |
| H6.4.c | WebSocket | リアルタイム | サーバ複雑化 |
| H6.4.d | VSCode 拡張内に M3E 内蔵 | スタンドアロン | 同期難 |
| H6.4.e | 別ポート（拡張専用）| 分離可能 | ポート増 |

### H6.5 ユースケース具体例

- UC-V1. コード書きながら横にマップ → 設計ノードを参照しつつ実装
- UC-V2. `// @m3e: node-abc-123` コメントから該当ノードへジャンプ
- UC-V3. PR レビュー中にレビュアー視点ノードを記録
- UC-V4. テスト失敗時に「失敗パターンノード」を即追加
- UC-V5. リファクタ計画ノード ⇔ 実コード位置のリンク

### H6.6 サイドエフェクト

- VSCode 起動が重くなる懸念
- M3E 本体と機能重複（どっちで編集するか）
- ショートカット衝突
- マルチワークスペース時の挙動

## H1 + H6 横断の論点

### Cd1. M3E 自身が VSCode 拡張として配布される未来
- 拡張 marketplace で配布
- ローカル M3E サーバ自動起動
- VSCode 内で完結（ブラウザ不要）

### Cd2. Git hook + VSCode 拡張のハイブリッド
- VSCode で編集 → 保存 → git commit → M3E ノード自動更新
- 完全にループが閉じる

### Cd3. dev map の自己参照
- M3E のリポジトリ自身を M3E で開発（既に部分実装、O1）
- VSCode 拡張で M3E を編集している様子を M3E で追跡

## 推し度ランキング（H1, H6 内）

| ランク | 案 | 理由 |
|-------|---|------|
| 1 | H1.4.a + H1.5.a + H1.3.e | ローカル git hook で commit を即ノード化、認証不要 |
| 2 | H6.1.a + H6.4.a | Webview で既存 M3E をそのまま埋め込み、最小実装 |
| 3 | H1.1.c PR ノード化 | 意味的単位として最も価値 |
| 4 | H1.6.b ノード別 .md ファイル化 | Obsidian/git diff 互換、長期運用に強い |
| 5 | H6.3.b TODO → scratch | 既存 A7 案と統合、習慣化しやすい |
