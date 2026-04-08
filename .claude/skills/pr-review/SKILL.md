---
name: pr-review
description: |
  M3E開発でPR（Pull Request）のレビュー・マージ・事後処理を行うスキル。
  pr-beta（PR作成）の対になるスキルで、マネージャー側のワークフローを担う。
  以下の場面でトリガーする:
  - 「/pr-review」「PRレビューして」「PR見て」「マージして」と言われたとき
  - PR URLやPR番号が提示されたとき
  - devM3E の Integrate フェーズでマージ判断が必要なとき
  - 「PRどうなってる」「PR状況」と聞かれたとき
  dev-beta ブランチ（統合ロール）で使うことを想定。部下ブランチから呼ばれた場合でも動作するが、マージ権限は統合ロールのみ。
---

# pr-review — PR レビュー・マージ・事後処理

PR作成後のマネージャー側フロー全体を扱う。

```
PR受領 → 差分レビュー → 検証 → 判定 → マージ → 事後処理
```

---

## Step 1: PR の読み込み

PR番号 or URLが指定された場合:
```bash
gh pr view <number> --json title,body,headRefName,baseRefName,files,commits,state
gh pr diff <number>
```

PR番号が不明な場合:
```bash
# open なPR一覧（base=dev-beta）
gh pr list --base dev-beta --state open
```

読み取る情報:
- タイトル・概要
- ソースブランチ → ベースブランチ
- コミット一覧
- 変更ファイル一覧と差分
- 既存のレビューコメント

---

## Step 2: レビュー

3つの観点で差分を評価する。devM3E の reviewer agent と同じ基準だが、PR文脈に特化。

### 2a. Spec整合チェック

変更が関連specに準拠しているか確認する。

1. 変更ファイルから関連specを特定（`references/spec_index.md` 参照）
2. データモデル不変条件の維持
3. Commandパターン（undo/redo）の維持
4. scope/alias ルールへの適合

specを読む必要がある場合は `dev-docs/03_Spec/` から該当文書を読む。

### 2b. コード品質チェック

- 型安全性（不必要な `any`、型アサーション）
- エラーハンドリング（fail-closed か）
- パフォーマンス懸念（O(n²)ループ、不要な再レンダリング）
- テストカバレッジ（新規コードにテストがあるか）

### 2c. 運用ルール準拠

- コミットメッセージが imperative 形式か
- daily note（`dev-docs/daily/YYMMDD.md`）が更新されているか
- Decision Pool に記録すべき設計判断が埋もれていないか
- ブランチ名がロールに合致しているか（visual→dev-beta-visual等）

---

## Step 3: 検証（オプション）

差分の性質に応じて検証を実行する。

| 変更の性質 | 実行する検証 |
|-----------|------------|
| TypeScript コード | `npx tsc --noEmit` |
| テスト関連 | `npx vitest run` |
| ビルド影響あり | `npm run build` |
| UI変更 | Playwright（該当テストがあれば） |
| ドキュメントのみ | スキップ |

検証を実行する場合は、PR のブランチをチェックアウトして行う:
```bash
gh pr checkout <number>
cd beta
npx tsc --noEmit && npx vitest run && npm run build
```

---

## Step 4: 判定

レビュー結果を以下の形式でユーザーに報告する。

```
## PR #{number}: {title}

### 判定: ✅ approve / ⚠️ comment / ❌ request-changes

### 変更サマリー
{ファイル数}ファイル, +{追加行} -{削除行}
影響範囲: {beta/ | dev-docs/ | scripts/ 等}

### レビュー結果
- [pass|fail] Spec整合: {detail}
- [pass|fail] コード品質: {detail}
- [pass|fail] 運用ルール: {detail}

### 検証結果
- tsc: pass/fail
- test: pass/fail ({n}/{total})
- build: pass/fail

### issue（あれば）
- [{severity}] {description}

### 推奨アクション
{マージしてよい / 修正が必要 / 要議論}
```

### 判定基準

| 判定 | 条件 |
|------|------|
| **approve** | issue なし or nit のみ。検証パス |
| **comment** | minor issue あるがマージをブロックしない |
| **request-changes** | major/critical issue あり。修正が必要 |

---

## Step 5: マージ

ユーザーが承認した場合、マージを実行する。

```bash
# dev-beta に切り替え
git checkout dev-beta

# マージ（fast-forward 優先、不可なら merge commit）
gh pr merge <number> --merge

# または squash（コミットが多い場合）
gh pr merge <number> --squash
```

### マージ方法の選択

| 条件 | マージ方法 |
|------|----------|
| コミット1-3件、各コミットが意味ある単位 | `--merge`（通常マージ） |
| コミット多数 or WIPコミット含む | `--squash`（1コミットに集約） |
| ユーザーが指定 | 指定に従う |

---

## Step 6: 事後処理

マージ完了後に以下を実行する。

### 6a. Current Status 更新

統合ロールとして `dev-docs/00_Home/Current_Status.md` を更新:
- 「最近の成果」に追加
- 「In Progress」から完了項目を除去
- 「Next 5」の更新（必要に応じて）

### 6b. Todo Pool 更新

`dev-docs/06_Operations/Todo_Pool.md` の該当項目を `done` に変更。

### 6c. rebase 指示

マージ元のブランチ担当者（部下エージェント or ユーザー）に rebase を通知:

```
## 統合完了: PR #{number}

{title} を dev-beta にマージしました。
次の作業前に rebase してください:

git fetch origin dev-beta
git rebase origin/dev-beta
```

### 6d. ブランチ削除（オプション）

feature branch（`dev-beta-*` 以外の一時ブランチ）の場合:
```bash
gh pr close <number> --delete-branch
```

`dev-beta-visual` / `dev-beta-data` は永続ブランチなので削除しない。

---

## Cowork 環境での制限

Coworkサンドボックスから `gh` コマンドや `git push` がブロックされる場合:

1. レビュー（Step 1-4）はローカルの差分で実行可能
2. マージ・事後処理のコマンドをユーザーに提示:

```
## ローカルで実行してください

gh pr merge {number} --merge
git checkout dev-beta && git pull origin dev-beta
```

3. ユーザーがマージ完了を報告したら事後処理（6a-6d）を実行

---

## pr-beta との連携

```
pr-beta（作成側）          pr-review（レビュー側）
─────────────────         ──────────────────────
状態チェック               PR読み込み
差分分析                   レビュー（spec/品質/運用）
タイトル・ボディ生成  →→→  検証（tsc/test/build）
push & PR作成              判定 → ユーザーに報告
結果報告                   マージ
                           事後処理（status/todo/rebase指示）
```

devM3E Core Loop における位置づけ:
- **pr-beta**: Execute 完了 → Integrate フェーズ前半（PR作成）
- **pr-review**: Integrate フェーズ後半（レビュー・マージ）→ Review フェーズへ
