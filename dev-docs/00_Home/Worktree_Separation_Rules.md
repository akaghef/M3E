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

## 変更・マージ方針

- `dev-beta-visual` と `dev-beta-data` の成果は `dev-beta` に統合する。
- `final/` への反映は `scripts/final/migrate-from-beta.bat` 経由のみ。
- `main` / release 系ブランチでの破壊的操作（history rewrite、force-push）は禁止。

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
