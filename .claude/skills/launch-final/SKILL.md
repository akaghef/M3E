---
name: launch-final
description: |
  dev-beta の安定版を final/ へプロモートするローンチスキル。
  beta → final のコード同期、ビルド検証、差分レビュー、コミット、データ移行までを一貫して扱う。
  以下の場面でトリガーする:
  - 「/launch-final」「finalに反映」「finalへローンチ」「final更新」「betaをfinalに」と言われたとき
  - devM3E の Wrap-up フェーズで final 反映が議題になったとき
  - 「finalとbetaの差分」「final同期」「migrate」と言われたとき
  - scripts/final/ のスクリプトについて聞かれたとき
  final/ への変更は必ずこのスキル経由で行う。直接編集は禁止。
---

# launch-final — Beta to Final プロモーション

beta/ で検証済みのコードを final/ へ同期し、本番品質で固定するフロー。

```
差分確認 → 同期 → ビルド検証 → テスト → 差分レビュー → コミット → データ移行案内
```

## 基本原則

- final/ で新機能を先行開発しない。変更は常に beta/ → final/ の一方向
- 同期は `scripts/final/migrate-from-beta.sh|.bat` と同じファイルセットに従う
- ユーザーデータ（SQLite）はリポジトリ外。スキーマ変更時のみ migration script を用意する
- final/ の独自ファイル（`FINAL_POLICY.md` 等）は同期対象外として保護する

---

## Step 1: 事前チェック

現在の状態を確認する。

```bash
git branch --show-current          # dev-beta であること
git status                         # clean であること
git log --oneline -5 -- final/     # final/ の最終更新を確認
```

dev-beta 以外のブランチにいる場合は checkout する。
uncommitted changes がある場合はユーザーに確認する。

---

## Step 2: 差分確認

beta/ と final/ の差分を把握する。何が変わるか先にユーザーに見せる。

```bash
# ソースの差分サマリー
diff -rq beta/src/ final/src/ --exclude node_modules --exclude dist | head -40
diff -q beta/viewer.html final/viewer.html
diff -q beta/viewer.css final/viewer.css
diff -q beta/package.json final/package.json
```

差分がない場合は「final/ は最新です」と報告して終了。

差分がある場合、変更サマリーをユーザーに提示する:

```
## Final ローンチ差分

変更ファイル: {n}件
主な変更:
- {概要1}
- {概要2}
...

続行しますか？
```

---

## Step 3: 同期

同期対象ファイルセットは `references/sync_manifest.md` に定義。
migrate-from-beta スクリプトと同じ対象を維持する。

```bash
# ディレクトリ同期（beta/ → final/）
cp -r beta/src/ final/src/
cp -r beta/tests/ final/tests/
cp -r beta/legacy/ final/legacy/

# 単体ファイル同期
cp beta/viewer.html final/viewer.html
cp beta/viewer.css final/viewer.css
cp beta/package.json final/package.json
cp beta/package-lock.json final/package-lock.json
cp beta/tsconfig.browser.json final/tsconfig.browser.json
cp beta/tsconfig.node.json final/tsconfig.node.json
cp beta/playwright.config.js final/playwright.config.js
cp beta/test_server.js final/test_server.js

# デモデータ
cp beta/data/*.json final/data/ 2>/dev/null || true
cp beta/data/*.mm final/data/ 2>/dev/null || true
```

### 同期から除外するもの（final/ 固有）

- `final/FINAL_POLICY.md`
- `final/README.md`（final 独自の内容がある場合）
- `final/data/` 内のユーザー作成ファイル
- `final/node_modules/`, `final/dist/`

beta/ にあって final/ にない新規ディレクトリ（例: `beta/public/katex/`）は
同期対象に追加が必要。`references/sync_manifest.md` を更新し、
migrate-from-beta スクリプトにも反映すること。

---

## Step 4: ビルド検証

```bash
cd final
npm ci
npm run build
```

ビルド失敗時は同期内容を確認し、beta/ 側の問題か同期漏れかを切り分ける。

---

## Step 5: テスト（オプション）

変更の性質に応じて実行する。

| 変更 | 検証 |
|------|------|
| TypeScript | `npx tsc --noEmit` |
| ロジック変更 | `npx vitest run`（テストがある場合） |
| UI変更 | Playwright（`npx playwright test`） |
| 設定のみ | ビルド成功で十分 |

---

## Step 6: 差分レビュー

コミット前に git diff を確認する。

```bash
git diff --stat -- final/
git diff -- final/src/browser/viewer.ts | head -100  # 主要ファイルの中身確認
```

以下の観点でチェック:
- beta/ の変更が正しく反映されているか
- final/ 固有ファイル（FINAL_POLICY.md 等）が上書きされていないか
- 不要なファイル（beta/ 固有の prompts/ 等）が混入していないか

レビュー結果をユーザーに報告:

```
## Final ローンチレビュー

同期元: dev-beta ({commit hash})
変更: {n}ファイル, +{追加} -{削除}

チェック:
- [pass|fail] ビルド
- [pass|fail] テスト
- [pass|fail] 固有ファイル保護
- [pass|fail] 不要ファイル混入なし

コミットしてよいですか？
```

---

## Step 7: コミット

ユーザーが承認したら、変更をコミットする。

```bash
git add final/
git commit -m "chore(final): sync from beta ({変更の要約})"
```

コミットメッセージは `chore(final): sync from beta` を prefix とし、
主な変更内容を括弧内に簡潔に記載する。

例:
- `chore(final): sync from beta (graph link, variable-height layout)`
- `chore(final): sync from beta (wheel normalization, meta panel fix)`

---

## Step 8: push

```bash
git push origin dev-beta
```

---

## Step 9: main マージ & タグ付け

dev-beta の内容を main ブランチへマージし、リリースタグを付与する。
main = 本番リリース履歴を示すブランチ。

### 9-1. main へマージ

```bash
git checkout main
git merge dev-beta -m "merge: dev-beta → main (beta promotion to final)"
git push origin main
git checkout dev-beta
```

マージ方針: **通常マージ**（fast-forward ではなくマージコミットを残す）。
コンフリクトが発生した場合はユーザーに報告して判断を仰ぐ。

### 9-2. vYYMMDD タグを付与

タグ命名規則: `vYYMMDD`（年2桁 + 月2桁 + 日2桁）

```bash
# 今日の日付でタグ名を決定（例: v260408）
TAG="v$(date +%y%m%d)"

# 同日に既存タグがある場合はサフィックスを付ける
if git tag -l "$TAG" | grep -q .; then
  # v260408 が存在 → v260408-2, v260408-3, ... と探す
  N=2
  while git tag -l "${TAG}-${N}" | grep -q .; do
    N=$((N + 1))
  done
  TAG="${TAG}-${N}"
fi

git tag "$TAG"
git push origin "$TAG"
```

タグはユーザーに確認してから push する:
```
タグ: {TAG} を作成します。push してよいですか？
```

### 既存のタグ例

| タグ | 内容 |
|------|------|
| v260402 | 初回リリース |
| v260402-2 | 同日2回目 |
| v260403, v260403-2, v260403-3 | 4/3 の3回 |

---

## Step 10: データ移行案内

スキーマ変更を伴う場合、ユーザーに migration 手順を案内する。

スキーマ変更なし（通常）:
```
Final 更新完了。データ移行は不要です。
起動: scripts/final/launch.bat（Windows）または scripts/final/launch.sh
```

スキーマ変更あり:
```
Final 更新完了。スキーマ変更があります。
初回起動前に migration を実行してください:

scripts/final/update-and-launch.bat
（自動でバックアップ → migration → 起動します）
```

---

## 同期対象の新規追加が必要な場合

beta/ に新しいディレクトリやファイルが追加された場合:

1. `references/sync_manifest.md` を更新
2. `scripts/final/migrate-from-beta.sh` に sync 行を追加
3. `scripts/final/migrate-from-beta.bat` に xcopy 行を追加
4. このスキルの Step 3 同期コマンドに反映

3つの場所を同期させることを忘れないこと。

---

## Quick Reference

| やりたいこと | コマンド |
|-------------|---------|
| 差分だけ見たい | Step 2 のみ実行 |
| フル同期 + リリース | Step 1-10 を順に実行 |
| ビルド確認だけ | Step 3-4 を実行 |
| main マージ + タグのみ | Step 9 を実行 |
| ユーザーが手動で同期 | `scripts/final/migrate-from-beta.bat` |
| 起動のみ | `scripts/final/launch.bat` |

---

## devM3E との連携

devM3E Core Loop における位置づけ:
- **pr-review** で dev-beta への統合が完了した後、Wrap-up フェーズで final 反映を検討
- final 反映の判断基準: beta で十分な検証が完了しており、ユーザーが「final に入れてよい」と判断した機能
- 毎回の dev-beta マージで自動的に final へ反映するわけではない。明示的なローンチ判断が必要
