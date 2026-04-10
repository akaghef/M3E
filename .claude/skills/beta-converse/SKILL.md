---
name: beta-converse
description: >
  dev-beta ブランチへの収束（converge）を行うスキル。
  未コミット変更のコミット、作業ブランチの dev-beta へのマージ、不要な dev-*/worktree-* ブランチの削除、
  ワークツリーの掃除、リモートへの push を一括で行う。
  以下の場面でトリガーする:
  - 「/beta-converse」「converse」「収束」「統合して」「ブランチ整理」と言われたとき
  - 「未コミットなくして」「ブランチ消して」「push」「きれいにして」と言われたとき
  - 開発セッション終了時やリリース前にワークスペースを整理したいとき
  - 「散らかってる」「ブランチ多すぎ」「worktree消して」と言われたとき
---

# beta-converse — dev-beta 収束スキル

開発セッション中に散らばったコミット・ブランチ・ワークツリーを dev-beta に収束させ、
ワークスペースをクリーンな状態にする。

## ゴール

1. dev-beta 上の未コミット変更 → コミット
2. マージ可能な作業ブランチ → dev-beta にマージ
3. 不要なワークツリー → 削除
4. 不要なブランチ（ローカル＋リモート） → 削除
5. dev-beta を origin に push

## 実行フロー

### Step 0: 状況把握

まず全体像を把握する。以下を並列で実行:

```bash
git status --short
git branch --sort=-committerdate
git worktree list
git log --oneline -5
```

結果をユーザーに見せ、これから何をするか概要を示す。

### Step 1: dev-beta の未コミット変更をコミット

dev-beta ブランチに未コミット変更がある場合:

1. `git status` で変更内容を確認
2. `git diff` と `git diff --cached` で内容を把握
3. 変更をステージング（`beta/`, `.claude/skills/`, `dev-docs/` 等をグループ分け）
4. 適切なコミットメッセージでコミット

コミットは内容ごとにまとめる。全部を一つの巨大コミットにしない。
ただし過度に細かく分けすぎない — 2〜3コミットが目安。

`final/` 配下の変更は launch-final スキルの管轄なので、beta-converse ではコミットしない。
ユーザーに「final/ の変更は /launch-final で処理してください」と伝える。

### Step 2: 作業ブランチの棚卸し

ローカルブランチを一覧し、3つに分類する:

| 分類 | 条件 | アクション |
|------|------|-----------|
| **マージ済み** | dev-beta に既にマージされている | 削除 |
| **マージ可能** | dev-beta から分岐、コンフリクトなし | ユーザーに確認後マージ |
| **保留** | コンフリクトあり or 作業途中 | そのまま残す。ユーザーに報告 |

分類の手順:

```bash
# マージ済みブランチ一覧
git branch --merged dev-beta

# 各ブランチとdev-betaの差分を確認
git log dev-beta..<branch> --oneline
```

保護ブランチ（削除しない）: `main`, `dev-beta`

### Step 3: ワークツリーの掃除

```bash
git worktree list
```

ワークツリーは `.claude/worktrees/` 配下にある。

1. ワークツリーのブランチが既に dev-beta にマージ済み → `git worktree remove <path>`
2. ワークツリーに未コミット変更がある → ユーザーに報告（勝手に消さない）
3. ワークツリーのブランチが保留 → そのまま残す

ワークツリー削除後、対応するブランチも削除対象に含める。

### Step 4: ブランチ削除

Step 2 の結果に基づき:

```bash
# ローカルブランチ削除
git branch -d <branch>

# リモートブランチ削除
git push origin --delete <branch>
```

削除前にユーザーに一覧を見せて確認を取る:

```
以下のブランチを削除します:
ローカル:
  - worktree-agent-a870399b (マージ済み)
  - dev-visual-entity-list (マージ済み)
リモート:
  - origin/worktree-agent-a870399b
  - origin/dev-visual-entity-list

保留（残す）:
  - dev-data-flash (未マージ、3 commits ahead)

よろしいですか?
```

### Step 5: Push

```bash
git push origin dev-beta
```

### Step 6: 完了報告

最終状態をまとめて報告:

```
beta-converse 完了:
- コミット: 2件（skills更新, dev-docs追加）
- マージ: 3ブランチ → dev-beta
- 削除: 8ブランチ（ローカル+リモート）, 6ワークツリー
- 保留: 1ブランチ（dev-data-flash: 未マージ）
- push: origin/dev-beta 更新済み
```

## 安全規則

- `main` と `dev-beta` は絶対に削除しない
- `final/` 配下の変更はコミットしない（launch-final の管轄）
- ワークツリーに未コミット変更がある場合は削除しない
- force push は使わない
- ブランチ削除は `git branch -d`（safe delete）を使う。`-D` は使わない
- マージ可能ブランチのマージ前にユーザー確認を取る
- 削除対象の一覧をユーザーに見せてから実行する
