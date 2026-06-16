# Claude Managed Agents 調査レポート

調査日: 2026-04-09

---

## 1. 概要

Claude Managed Agents は、Anthropic が 2026年4月8日に公開ベータとしてリリースした新サービス。
Claude をクラウド上で自律的なエージェントとして実行するための**マネージドインフラストラクチャ**を提供する。

開発者は自前でエージェントループ、ツール実行基盤、サンドボックスなどを構築する必要がなく、
Anthropic のインフラ上でファイル操作、コマンド実行、Web 検索、コード実行などを安全に実行できる。

> "プロトタイプから本番投入まで、月単位ではなく日単位で実現する"

初期採用企業: Notion、Rakuten、Sentry、Asana など。

---

## 2. 技術的な詳細

### 2.1 コアコンセプト（4つの構成要素）

| 概念 | 説明 |
|------|------|
| **Agent** | モデル、システムプロンプト、ツール、MCP サーバー、スキルの定義 |
| **Environment** | コンテナテンプレート（パッケージ、ネットワークアクセス設定） |
| **Session** | Agent + Environment で起動される実行インスタンス。タスクを遂行し出力を生成 |
| **Events** | アプリケーションとエージェント間でやり取りされるメッセージ（ユーザーターン、ツール結果、ステータス更新） |

### 2.2 アーキテクチャ: Brain / Hands / Session の分離

Anthropic のエンジニアリングブログで説明されている設計思想:

- **Brain（脳）**: LLM / コントローラー。推論を担当
- **Hands（手）**: 実行サンドボックス。コンテナはツールコールが必要になった時点で初めてプロビジョニングされる
- **Session（セッション）**: メモリ / コンテキストをコンテキストウィンドウの外に永続化。`getEvents()` でイベントストリームのスライスを取得可能

この分離により、コンテナが不要な場合は推論を即座に開始でき、スケーリングが柔軟になる。

### 2.3 利用可能なツール

- **Bash** - コンテナ内でシェルコマンド実行
- **ファイル操作** - read, write, edit, glob, grep
- **Web 検索 / fetch** - Web 検索とコンテンツ取得
- **MCP サーバー** - 外部ツールプロバイダーへの接続

### 2.4 ワークフロー

1. Agent を作成（モデル、プロンプト、ツール定義）→ ID で参照
2. Environment を作成（Python, Node.js, Go 等のパッケージ、ネットワークルール）
3. Session を起動（Agent + Environment を参照）
4. Events を送信 → Claude が自律的にツール実行 → SSE でストリーミング返却
5. 実行中に追加指示を送ったり、中断して方向転換が可能

### 2.5 レート制限

| 操作 | 制限 |
|------|------|
| 作成エンドポイント | 60 リクエスト/分 |
| 読み取りエンドポイント | 600 リクエスト/分 |

### 2.6 料金

- 通常の Claude トークン料金 + **$0.08 / セッション時間**（ミリ秒単位で課金）
- アイドル時間（ユーザー入力待ち、ツール確認待ち等）は**無料**
- Web 検索: $10 / 1,000検索
- コンテナ時間の別途課金はなし（セッション時間に含まれる）

### 2.7 ベータヘッダー

すべてのエンドポイントに `managed-agents-2026-04-01` ベータヘッダーが必要。SDK は自動設定。

---

## 3. リリース日 / ステータス

- **リリース日**: 2026年4月8日
- **ステータス**: パブリックベータ
- **利用条件**: Claude API キーがあれば全 API アカウントでデフォルト有効
- **研究プレビュー機能**（要申請）:
  - Outcomes（成果定義）
  - **Multi-agent**（マルチエージェント）
  - Memory（メモリ）

---

## 4. 既存の Claude Code エージェント機能との違い

| 比較項目 | Claude Code サブエージェント | Claude Managed Agents |
|----------|---------------------------|----------------------|
| **実行場所** | ローカルマシン（worktree） | Anthropic クラウド上のコンテナ |
| **インフラ管理** | ユーザー側（ローカル環境依存） | Anthropic が全て管理 |
| **セッション持続性** | ローカルプロセスのライフタイム | 永続セッション（中断・再開可能） |
| **スケーリング** | ローカルリソースに制限 | クラウドで自動スケール |
| **ツール実行** | Claude Code 内蔵ツール | マネージドサンドボックス内のツール |
| **主な用途** | 開発中のコーディング作業 | 本番環境でのエージェントデプロイ |
| **状態管理** | コンテキストウィンドウ内 | サーバーサイドでイベント履歴永続化 |
| **マルチエージェント** | worktree で手動オーケストレーション | API で multi-agent パイプライン構築可能（研究プレビュー） |
| **コスト** | API トークン料金のみ | トークン料金 + $0.08/時間 |

**Agent SDK との違い**:
- **Agent SDK**: Claude Code と同じツール・エージェントループをライブラリとして提供。自分のアプリに組み込んで使う
- **Managed Agents**: インフラ含めてフルマネージド。ツール実行、コンテキスト管理、エラーリカバリを Anthropic 側で処理

---

## 5. M3E プロジェクトへの活用可能性

### 現状の M3E 開発ワークフロー
- Claude Code の worktree 機能でサブエージェント（codex1/codex2）を並行起動
- ローカルマシンのリソースに依存
- devM3E スキルでオーケストレーション

### Managed Agents で改善できる点

**活用メリット**:
1. **並行開発のスケールアウト**: ローカルリソースの制約なく、クラウド上で複数エージェントを同時実行可能
2. **長時間タスク**: ビルド検証やテスト実行など時間のかかるタスクをクラウドに任せ、ローカル環境を解放
3. **永続セッション**: セッションが永続化されるため、中断しても途中から再開可能
4. **multi-agent 機能**（研究プレビュー）: エージェントが他のエージェントをスピンアップする機能。M3E のマネージャー → ワーカーのパターンに適合

**注意点 / 制限**:
1. **コスト**: セッション時間課金が追加されるため、長時間の並行開発はコスト増になる可能性
2. **ベータ段階**: 本番利用にはリスクあり。特に multi-agent は研究プレビューで要申請
3. **ローカルファイルアクセス**: クラウド実行のため、ローカルリポジトリへの直接アクセスは不可。Git 経由での同期が必要
4. **現行ワークフローとの統合**: 現在の worktree ベースのワークフロー（devM3E, setrole, pr-beta 等のスキル群）はローカル前提で設計されており、移行には再設計が必要

### 結論
現時点では M3E の開発ワークフローは worktree ベースのローカルオーケストレーションで十分機能しており、即座に Managed Agents に移行する必要性は低い。ただし、multi-agent 機能が GA（一般提供）になった際には、クラウドベースの並行開発パイプラインとして検討する価値がある。

---

## 6. 公式ドキュメント / 参考 URL

### 公式
- [Claude Managed Agents 概要 - API Docs](https://platform.claude.com/docs/en/managed-agents/overview)
- [クイックスタート - API Docs](https://platform.claude.com/docs/en/managed-agents/quickstart)
- [Agent 定義 - API Docs](https://platform.claude.com/docs/en/managed-agents/agent-setup)
- [公式ブログ: Claude Managed Agents](https://claude.com/blog/claude-managed-agents)
- [エンジニアリングブログ: Scaling Managed Agents](https://www.anthropic.com/engineering/managed-agents)
- [Agent SDK 概要](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Code サブエージェント](https://code.claude.com/docs/en/sub-agents)
- [料金ページ](https://platform.claude.com/docs/en/about-claude/pricing)

### ニュース記事
- [Analytics India Magazine](https://analyticsindiamag.com/ai-news/anthropic-launches-claude-managed-agents-to-speed-up-deployment-for-developers)
- [The New Stack](https://thenewstack.io/with-claude-managed-agents-anthropic-wants-to-run-your-ai-agents-for-you/)
- [SiliconANGLE](https://siliconangle.com/2026/04/08/anthropic-launches-claude-managed-agents-speed-ai-agent-development/)
- [Hacker News Discussion](https://news.ycombinator.com/item?id=47693047)
- [Epsilla: アーキテクチャ解説](https://www.epsilla.com/blogs/anthropic-managed-agents-decoupling-brain-hands-enterprise-orchestration)
