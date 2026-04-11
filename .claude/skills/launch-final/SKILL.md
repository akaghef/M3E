---
name: launch-final
description: |
  dev-beta の安定版を final/ へプロモートするローンチスキル。
  beta → final のコード同期、ビルド検証、差分レビュー、コミット、VM配布検証、
  人間の確認を経て main マージまでを一貫して扱う。
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
差分プレビュー → コピー + ビルド → 既存テスト(tsc, vitest)
  → コミット(dev-beta) → push(dev-beta)
    → main マージ(ローカル)
      → vm_test.bat ──────────┐
      → 手動確認(ブラウザ等) ──┤ 並行
                              ↓
      → ✋「両方OK？origin/main に push する？」
        → origin/main push → タグ付与 + push
```

## 基本原則

- final/ で新機能を先行開発しない。変更は常に beta/ → final/ の一方向
- 同期は **exclude 方式**: beta/ を丸ごとコピーし、除外リストに該当するものだけ除く
- ユーザーデータ（SQLite の作業DB）はリポジトリ外。スキーマ変更時のみ migration script を用意する
- final/ の独自ファイル（`FINAL_POLICY.md` 等）は同期対象外として保護する
- **リリースゲートは origin/main push 前の1箇所のみ**。VM検証 + 手動確認の両方がOKで通過

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
# ソースの差分サマリー（除外対象を除く）
diff -rq beta/ final/ \
  --exclude node_modules --exclude dist \
  --exclude .env --exclude Beta_Policy.md --exclude FINAL_POLICY.md \
  --exclude prompts --exclude tmp --exclude public \
  --exclude e2e_test_server.js --exclude playwright.e2e.config.js \
  --exclude backups --exclude audit --exclude conflict-backups \
  --exclude .m3e-launched --exclude M3E_dataV1.sqlite \
  | head -40
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
```

---

## Step 3: 同期（exclude 方式）

beta/ を丸ごと final/ にコピーし、除外リストに該当するものだけスキップする。

### 除外リスト

| 対象 | 理由 |
|------|------|
| `node_modules/` | 再インストールする |
| `dist/` | 再ビルドする |
| `.env` | 開発用シークレット |
| `Beta_Policy.md` | beta 固有ドキュメント |
| `prompts/` | 開発用プロンプト |
| `tmp/` | 一時ファイル |
| `public/` | 開発用アセット |
| `e2e_test_server.js` | E2Eテスト専用 |
| `playwright.e2e.config.js` | 同上 |
| `data/M3E_dataV1.sqlite` | 作業DB（final 側は初期化済み） |
| `data/backups/` | ランタイム生成物 |
| `data/audit/` | 同上 |
| `data/conflict-backups/` | 同上 |
| `data/.m3e-launched` | 初回起動フラグ |

### 同期コマンド（sh）

```bash
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  --exclude Beta_Policy.md \
  --exclude prompts \
  --exclude tmp \
  --exclude public \
  --exclude e2e_test_server.js \
  --exclude playwright.e2e.config.js \
  --exclude 'data/M3E_dataV1.sqlite' \
  --exclude 'data/backups' \
  --exclude 'data/audit' \
  --exclude 'data/conflict-backups' \
  --exclude 'data/.m3e-launched' \
  beta/ final/

# final/ 固有ファイルを保護（rsync --delete で消えた場合は復元）
git checkout -- final/FINAL_POLICY.md 2>/dev/null || true
```

### 同期コマンド（bat — robocopy）

```bat
robocopy beta\ final\ /MIR /NFL /NDL /NJH /NJS ^
  /XD node_modules dist prompts tmp public backups audit conflict-backups ^
  /XF .env Beta_Policy.md e2e_test_server.js playwright.e2e.config.js ^
     M3E_dataV1.sqlite .m3e-launched
REM robocopy returns 0-7 for success
if %errorlevel% GTR 7 goto :error
REM Restore final-only files
git checkout -- final\FINAL_POLICY.md 2>nul
```

### final/ 固有ファイルの保護

以下は final/ にのみ存在し、同期で消えてはいけない:
- `final/FINAL_POLICY.md`
- `final/README.md`（final 独自の内容がある場合）

rsync `--delete` / robocopy `/MIR` で消える可能性があるので、同期後に `git checkout` で復元する。

---

## Step 4: ビルド検証

```bash
cd final
npm ci
npm run build
```

ビルド失敗時は同期内容を確認し、beta/ 側の問題か同期漏れかを切り分ける。

---

## Step 5: 既存テスト

```bash
cd final
npx tsc --noEmit
npx vitest run
```

テスト失敗時は修正してから先へ進む。

---

## Step 6: コミット & push（dev-beta）

```bash
git add final/
git commit -m "chore(final): sync from beta ({変更の要約})"
git push origin dev-beta
```

コミットメッセージは `chore(final): sync from beta` を prefix とし、
主な変更内容を括弧内に簡潔に記載する。

---

## Step 7: main マージ（ローカル）

```bash
git checkout main
git merge dev-beta -m "merge: dev-beta → main (beta promotion to final)"
git checkout dev-beta
```

マージ方針: **通常マージ**（fast-forward ではなくマージコミットを残す）。
コンフリクトが発生した場合はユーザーに報告して判断を仰ぐ。

この時点ではまだ push しない。

---

## Step 8: VM 配布検証 + 手動確認（並行）

VM テストと手動確認を並行で実施する。

### VM テスト

```bat
scripts\ops\vm_test.bat
```

VirtualBox の clean snapshot から配布パッケージを検証する。
結果は `C:\M3E_test_reports\` に出力される。

### 手動確認

VM テスト実行中に、ローカルでブラウザ確認等を行う。
- final/ をローカル起動して主要機能の動作確認
- UI の表示崩れがないか
- 新機能が意図通り動くか

---

## Step 9: リリースゲート ✋

**ここが唯一の人間確認ポイント。**

VM テストの結果と手動確認の結果をユーザーに報告する:

```
## リリースゲート

VM テスト: {PASS / FAIL}
  結果: C:\M3E_test_reports\test_*\report.txt
手動確認: ユーザー判断

origin/main に push してよいですか？
```

ユーザーが承認 → Step 10 へ
ユーザーが却下 → main マージを `git reset` で巻き戻し、修正してやり直し

---

## Step 10: origin/main push + タグ

```bash
git checkout main
git push origin main

# vYYMMDD タグを付与
TAG="v$(date +%y%m%d)"
if git tag -l "$TAG" | grep -q .; then
  N=2
  while git tag -l "${TAG}-${N}" | grep -q .; do
    N=$((N + 1))
  done
  TAG="${TAG}-${N}"
fi

git tag "$TAG"
git push origin "$TAG"
git checkout dev-beta
```

### バージョンレジストリ更新

タグ付与後、`dev-docs/00_Home/Version_Registry.md` を更新する。

```markdown
| タグ | data schema | 主な変更 |
|------|-------------|---------|
| {TAG} | v{N} | {変更サマリー} |
```

data schema version は `beta/src/shared/types.ts` の `SavedDoc.version` で確認する。

---

## Step 11: データ移行案内

スキーマ変更なし（通常）:
```
Final 更新完了。データ移行は不要です。
起動: scripts/final/launch.bat
```

スキーマ変更あり:
```
Final 更新完了。スキーマ変更があります。
初回起動前に migration を実行してください:
  scripts/final/update-and-launch.bat
```

---

## 除外リストの更新

beta/ に新しい開発専用ファイル/ディレクトリが追加された場合:

1. この SKILL.md の Step 3 除外リスト・除外テーブルに追加
2. `scripts/final/migrate-from-beta.sh` の rsync 除外に追加
3. `scripts/final/migrate-from-beta.bat` の robocopy 除外に追加

3つの場所を同期させることを忘れないこと。

---

## Quick Reference

| やりたいこと | コマンド / Step |
|-------------|----------------|
| 差分だけ見たい | Step 2 のみ |
| フル同期 + リリース | Step 1-11 を順に |
| ビルド確認だけ | Step 3-4 |
| VM テストだけ | `scripts\ops\vm_test.bat` |
| main マージ + タグのみ | Step 7, 10 |
| ユーザーが手動で同期 | `scripts/final/migrate-from-beta.bat` |
| 起動のみ | `scripts/final/launch.bat` |

---

## devM3E との連携

devM3E Core Loop における位置づけ:
- **pr-review** で dev-beta への統合が完了した後、Wrap-up フェーズで final 反映を検討
- final 反映の判断基準: beta で十分な検証が完了しており、ユーザーが「final に入れてよい」と判断した機能
- 毎回の dev-beta マージで自動的に final へ反映するわけではない。明示的なローンチ判断が必要
- **普段の開発ループでは既存テスト（tsc, vitest）で回す。VM テストはリリース時のみ**
