---
name: pr-beta
description: |
  M3E開発で作業ブランチから dev-beta へのPR（Pull Request）を作成するスキル。
  sub-agent（visual/data/data2/team/feature branch）が作業完了後に manager へ
  マージ依頼を出すワークフローを自動化する。
  以下の場面でトリガーする:
  - 「/pr-beta」「PRを作って」「dev-betaにマージ」「統合して」と言われたとき
  - 作業ブランチでの実装が完了し、統合フローに進むとき
  - devM3E の Integrate フェーズでPR作成が必要なとき
  dev-beta 以外のブランチにいるときに使う。dev-beta 上で呼ばれた場合はエラーにする。
---

# pr-beta — dev-beta 統合PR作成

作業ブランチの変更を dev-beta にマージするためのPRを作成する。
M3Eの統合フロー（Documentation_Rules）に準拠。

## 前提条件

- 現在のブランチが `dev-beta` 以外であること
- リモートに push 済み（未 push なら自動 push する）
- 未コミットの変更がないこと（あれば警告して停止）

## 実行手順

### Step 1: 状態チェック

```bash
# ブランチ確認
BRANCH=$(git branch --show-current)
if [ "$BRANCH" = "dev-beta" ]; then
  echo "ERROR: dev-beta 上では使えない。作業ブランチに切り替えてから実行すること。"
  exit 1
fi

# 未コミット変更チェック
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: 未コミットの変更あり。先にコミットすること。"
  git status --short
  exit 1
fi
```

### Step 2: dev-beta との差分分析

```bash
# リモート最新を取得
git fetch origin dev-beta

# コミット一覧（分岐点から現在まで）
git log --oneline origin/dev-beta..HEAD

# 差分統計
git diff --stat origin/dev-beta..HEAD

# 変更ファイル一覧
git diff --name-only origin/dev-beta..HEAD
```

差分を分析して以下を特定する:
- 変更の主題（何を実装/修正したか）
- 影響範囲（beta/, dev-docs/, scripts/ 等）
- 関連する spec/architecture 文書

### Step 3: PRタイトルとボディの生成

コミット履歴と差分から自動生成する。

**タイトル規約**: `{type}: {概要}` （70文字以内）

| type | 用途 |
|------|------|
| `add` | 新機能 |
| `fix` | バグ修正 |
| `update` | 既存機能の改善 |
| `refactor` | リファクタリング |
| `docs` | ドキュメントのみの変更 |
| `test` | テストの追加/修正 |
| `chore` | ビルド/CI/設定の変更 |

**ボディテンプレート**:

```markdown
## 概要
{1-3行の変更概要}

## 変更内容
{変更ファイルとその内容をカテゴリ別に列挙}

## 関連
{関連するspec/ADR/issue/Todo Poolエントリがあれば}

## テスト
- [ ] tsc --noEmit 通過
- [ ] vitest run 通過
- [ ] ビルド成功
{該当しないものは削除}

## daily 更新
- [ ] dev-docs/daily/YYMMDD.md 更新済み
```

### Step 4: Push & PR作成

```bash
# リモートに push（未 push の場合）
git push -u origin "$BRANCH"

# PR作成
gh pr create \
  --base dev-beta \
  --title "{生成したタイトル}" \
  --body "{生成したボディ}"
```

### Step 5: 結果報告

PR作成後、以下を報告する:
- PR URL
- 差分サマリー（ファイル数、追加行、削除行）
- マージ前に必要なアクション（daily未更新、テスト未実行等）

## ロール別の振る舞い

| ロール | ブランチ | PR先 | 備考 |
|-------|---------|------|------|
| visual | dev-visual | dev-beta | UI/レンダリング変更 |
| data | dev-data | dev-beta | model/controller変更 |
| data2 | dev-data2 | dev-beta | data 並列ワーカー |
| team | dev-team | dev-beta | Collaboration/Cloud Sync |
| manage | feature branch | dev-beta | 横断的変更 |

## daily note の自動チェック

PR作成前に、今日の daily note (`dev-docs/daily/YYMMDD.md`) が更新されているか確認する。

- 更新済み → そのまま続行
- 未更新 → 「daily note が未更新。更新してからPR作成する？」とユーザーに確認
- ユーザーが「更新して」と言えば doc-updater agent を呼び出してから PR作成

## エラーハンドリング

| エラー | 対処 |
|-------|------|
| dev-beta にいる | 「作業ブランチに切り替えてから実行してください」 |
| 未コミット変更あり | 変更一覧を表示し、「コミットしてから再実行してください」 |
| push 失敗 | エラーメッセージを表示。認証/ネットワーク問題の可能性を示唆 |
| gh CLI なし | `git push` まで実行し、PR URLの手動作成コマンドを提示 |
| conflict あり | conflict ファイルを表示し、解消方法を提案 |

## Cowork 環境での制限

Coworkサンドボックスから GitHub への push がブロックされる場合がある（HTTP 403）。
その場合は:

1. コミットまではローカルで完了
2. push + PR作成コマンドをユーザーに提示
3. ユーザーがローカルターミナルで実行

提示フォーマット:

```
## ローカルで実行してください

git push -u origin {branch}
gh pr create --base dev-beta --title "{title}" --body "{body}"
```
