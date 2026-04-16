# Worktree 分離運用ルール

最終更新: 2026-04-15

---

## 目的

AI エージェント並行開発時のブランチ混在を防ぐため、ロールごとに Git worktree を分離して運用する。

---

## 役割と担当ブランチ

正規ロール名は `visual / data / data2 / team / manage` （`00_Home/Glossary.md` 参照）。

| ロール | ブランチ | 責務 |
|---|---|---|
| `manage` | `dev-beta` | マージ、仕様、タスク管理、final 反映 |
| `visual` | `dev-visual` | UI・描画・CSS・SVG |
| `data` | `dev-data` | model・controller・API・永続化 |
| `data2` | `dev-data2` | data 領域の並列作業用 |
| `team` | `dev-team` | 協働・Cloud Sync |

`akaghef`（人間）は全体レビューと判断。

---

## ディレクトリ割り当て

**2系統併用**:

### 1. 持続 worktree（人間が VS Code で開く）

| ロール | パス |
|---|---|
| manage | `C:/Users/Akaghef/dev/M3E` |
| visual | `C:/Users/Akaghef/dev/M3E-dev-visual` |
| data | `C:/Users/Akaghef/dev/M3E-dev-data` |
| data2 | `C:/Users/Akaghef/dev/M3E-dev-data2` |
| team | `C:/Users/Akaghef/dev/M3E-dev-team` |

各担当は自分のディレクトリのみを VS Code で開く。

### 2. Agent 一時 worktree（サブエージェント専用）

`C:/Users/Akaghef/dev/M3E/.claude/worktrees/agent-<hash>`

- サブエージェント起動時に自動生成される
- 作業完了（merge / 破棄）後に掃除
- 人間は通常開かない

---

## セッション開始ゲート（setrole）

`scripts/ops/setrole.ps1 -Role <role>` で以下を自動実行:

1. 対象 worktree に `cd`
2. ブランチ整合確認（`dev-<role>` になっているか）
3. `git fetch origin`
4. `git rebase origin/dev-beta`（未コミット変更があれば中断）

**重要**: `reset --hard` は使わない（作業消失防止）。rebase が競合した場合は手動解決。

持続 worktree が未作成ならセットアップ手順（後述）で作る。

---

## 日次運用ルール

1. 作業開始時に現在ブランチを確認: `git branch --show-current`
2. pull / test / commit / push は必ず担当 worktree 内で実行
3. 役割外のブランチに切り替えない。必要時は akaghef にエスカレーション

---

## 変更・マージ方針

- `dev-<role>` の成果は `dev-beta` に PR 経由で統合（`pr-beta` skill）
- `final/` への反映は `launch-final` skill 経由のみ
- `main` / release 系ブランチでの破壊的操作（history rewrite、force-push）は禁止

### 強制プロトコル（sub-agent → manager → 再開）

1. sub-agent は担当ブランチへ push
2. manager (`dev-beta`) が PR を merge
3. sub-agent は次サイクル着手前に `origin/dev-beta` を担当ブランチへ rebase
4. rebase 未実施の状態で実装を再開してはならない

```bash
git fetch origin
git checkout dev-<role>
git rebase origin/dev-beta
```

---

## 初期セットアップ（持続 worktree 未作成時）

```bash
git worktree add ../M3E-dev-visual dev-visual
git worktree add ../M3E-dev-data dev-data
git worktree add ../M3E-dev-data2 dev-data2
git worktree add ../M3E-dev-team dev-team
```

状態確認: `git worktree list`

---

## 運用チェックリスト（最小）

- [ ] 正しいディレクトリを開いている
- [ ] `git branch --show-current` が担当ブランチになっている
- [ ] `git status` が想定どおりである
- [ ] テスト実行後に commit / push している
