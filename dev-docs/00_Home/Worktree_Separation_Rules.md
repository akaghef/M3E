# Worktree 分離運用ルール

最終更新: 2026-04-01

---

## 目的

AI エージェント並行開発時のブランチ混在を防ぐため、担当ごとに Git worktree を分離して運用する。

---

## 役割と担当ブランチ

- `claude`: `dev-beta`（マージ、仕様、タスク管理、Final 反映）
- `codex1`: `dev-beta-visual`（visual 関連）
- `codex2`: `dev-beta-data`（model / controller 関連）
- `akaghef`: 全体レビューと指示

---

## ディレクトリ割り当て（固定）

- `C:/Users/Akaghef/dev/M3E` -> `dev-beta`
- `C:/Users/Akaghef/dev/M3E-dev-beta-visual` -> `dev-beta-visual`
- `C:/Users/Akaghef/dev/M3E-dev-beta-data` -> `dev-beta-data`

各担当は自分のディレクトリのみを VS Code で開く。

---

## 日次運用ルール

1. 作業開始時に現在ブランチを確認する。
   - `git branch --show-current`
2. pull / test / commit / push は必ず担当 worktree 内で実行する。
3. 共有時（画面共有、ペア作業）も、表示中のターミナルでブランチ名を都度確認する。
4. 役割外のブランチに切り替えない。必要時は `akaghef` にエスカレーションする。

---

## セッション開始ゲート（1回だけ）

1. セッション開始時に次を 1 回だけ実施する。
   - 役割確認
   - ブランチ確認
   - worktree / ディレクトリ確認
2. 以降は軽量チェックのみ継続する。
   - ブランチと編集対象の整合
3. 毎ステップでルール全文を再確認する運用はしない。

---

## 変更・マージ方針

- `dev-beta-visual` と `dev-beta-data` の成果は `dev-beta` に統合する。
- `final/` への反映は `scripts/final/migrate-from-beta.bat` 経由のみ。
- `main` / release 系ブランチでの破壊的操作（history rewrite、force-push）は禁止。

### 強制プロトコル（部下 -> 上司 -> 再開）

1. 部下（`codex1` / `codex2`）は担当ブランチへ push する。
2. 上司（`claude`）が `dev-beta` へ merge する。
3. 部下は次サイクル着手前に最新 `origin/dev-beta` を自分の担当ブランチへ rebase する。
4. rebase 未実施の状態で実装を再開してはならない。

部下側の最小手順:

```bash
git fetch origin
git checkout dev-beta-visual   # codex2 の場合は dev-beta-data
git rebase origin/dev-beta
```

---

## 初期セットアップ / 再作成

既存 worktree がない場合は、リポジトリルートで以下を実行する。

```bash
git worktree add ../M3E-dev-beta-data dev-beta-data
git worktree add -b dev-beta-visual ../M3E-dev-beta-visual dev-beta
```

状態確認:

```bash
git worktree list
```

---

## 運用チェックリスト（最小）

- [ ] 正しいディレクトリを開いている
- [ ] `git branch --show-current` が担当ブランチになっている
- [ ] `git status` が想定どおりである
- [ ] テスト実行後に commit / push している
