# 先行事例への参照ガイド

新 PJ 設計時に参考にすべき箇所。PJ 固有の深い内容はテンプレート化しない — 実例を読んで学ぶ。

## PJ01 AlgLibMove — 最も詳細な実例

| ファイル | 何を学ぶか |
|----------|-----------|
| `docs/projects/PJ01_AlgLibMove/plan.md` | Phase 設計の深さ、12 facets カタログ、処理フロー詳細、ノードフォーマット定義、リンク種別の整理 |
| `docs/projects/PJ01_AlgLibMove/README.md` | セッション起動プロトコル、役割分担の粒度、確定事項の記録方法 |

### plan.md で特に参考になるセクション

- **作業者向け必須情報**: 対象リポジトリの構成、触るファイル一覧、前提知識、関連ドキュメント
- **facets カタログ**: ドメインを複数の観点（実装/階層/フロー/依存/概念/...）に分解する方法
- **Phase A〜D の設計**: 「全取り込み → 世界モデル構築 → 設計 → 実装」の 4 段階
- **リンク・エイリアス活用**: 実体は 1 つ、alias で多面配置。link 種別の段階的追加
- **本日午後の着手手順**: Step 0〜5 の具体タイムライン

### PJ01 で生まれた PJ 固有の深い内容（テンプレート化しない）

- 12 facets のスコープ設計（ドメインに依存）
- テンソル式の構造化（calcTensorExpression の AST 表現）
- 処理フロー詳細（MATLAB の呼び出しシナリオ）
- 数学概念スコープの設計（Hopf 代数の教科書再構築）

## PJ02 MathOntoBridge — ビジョン凝縮の実例

| ファイル | 何を学ぶか |
|----------|-----------|
| `projects/PJ02_MathOntoBridge/README.md` | ビジョン凝縮（In/Out の明確な切り分け）、Codex 委任の書き方、位置づけ（帯域軸・他 PJ との関係） |
| `projects/PJ02_MathOntoBridge/plan.md` | Phase 0 の最小単位設計 |

### PJ02 で特に参考になるパターン

- **二つの木**（Semantic tree / Syntax tree）: PJ の対象を 2 軸で整理する方法
- **Codex 委任**: 「設計は Claude、実装は Codex」の分業パターン
- **prior_art.md**: 既存考察を 1 ファイルに集約する手法

## 会話ログの所在

PJ ごとの会話ログは `~/.claude/projects/` 配下にワークツリーパスで保存される:

| PJ | パス |
|----|------|
| PJ01 | `c--Users-Akaghef-dev-M3E-prj-alglibmove/` |
| PJ02+ | ブランチではなく **ワークツリーのディレクトリパス** に紐づく |

`.jsonl` ファイルは Claude Code 内部フォーマット。`memory/` 配下に要約済みの知見がある。