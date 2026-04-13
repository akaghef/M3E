---
name: intensive-develop
description: |
  M3E開発の自動オーケストレーションモード。toggle on/off で起動・停止する。
  起動中は定期的に進捗を監視し、完了検知→次タスク選定→ワーカーへの自動アサインを行う。
  以下の場面でトリガーする:
  - 「/intensive-develop」「intensive on」「intensive off」「intensive tick」と言われたとき
  - 「自動でタスク回して」「巡回して」「監視モード」と言われたとき
  - 「intensive止めて」「巡回停止」と言われたとき
  devM3E スキルの自動化レイヤーとして動作する。devM3E が手動の開発ループなら、
  intensive-develop はそのループを定期実行する cron のようなもの。
  タスク管理、進捗監視、停滞検出に関する話題でも積極的にトリガーすること。
---

# intensive-develop — M3E Automated Orchestration Mode

devM3E の Assess→Plan→Execute ループを自動で定期実行するトグルモード。
起動すると `/loop` で定期 tick が走り、停止するまで続く。

## Commands

| コマンド | 動作 |
|---------|------|
| `/intensive-develop on [間隔]` | モード起動。間隔は `5m`, `15m`, `30m` 等（デフォルト `15m`） |
| `/intensive-develop off` | モード停止。loop 停止 → 最終状態レポート |
| `/intensive-develop tick` | 手動で1回だけ tick を実行（テスト・デバッグ用） |
| `/intensive-develop status` | 現在の状態表示（on/off、最終 tick 時刻、間隔、タスク概況） |
| `/intensive-develop interval [間隔]` | 実行中に間隔を変更（例: `interval 5m`） |

### 間隔の指定

引数で tick 間隔を指定する。単位は `m`（分）。省略時は `15m`。

例:
- `/intensive-develop on 5m` — 5分間隔で起動
- `/intensive-develop on 30m` — 30分間隔で起動
- `/intensive-develop interval 10m` — 実行中に10分間隔に変更

---

## ON: 起動シーケンス

```
1. 環境チェック
   - 現在ブランチが dev-beta 系か確認
   - git remote にアクセスできるか確認
   - hostname を記録（Multi-PC タグ用）

2. Todo Pool 正規化
   - Todo_Pool.md を読み込み
   - 新フィールド（AssignedTo, AssignedPC 等）が未設定のエントリにデフォルト値を付与
   - 変更があればコミット

3. 初回 tick 実行
   - 下記の tick ロジックを1回実行
   - 結果をユーザーに報告

4. loop 開始
   - /loop {INTERVAL} /intensive-develop tick で定期 tick を設定
   - INTERVAL はユーザー指定値（デフォルト 15m）
   - 「Intensive mode ON. {INTERVAL}おきに巡回中。'intensive off' で停止」と報告
```

## OFF: 停止シーケンス

```
1. loop 停止

2. 最終状態レポート
   - 現在の doing/assigned タスク一覧
   - セッション中に完了したタスク数
   - 未処理の stall warning

3. daily note に intensive セッション記録を追記
```

---

## Tick ロジック（1回の巡回で行うこと）

tick はトークンを節約するために段階的に処理する。変化がなければ早期に終了する。

### Step 1: Signal 収集

まず `scripts/ops/intensive_check.sh` を実行してシグナルを一括収集する。
スクリプトが使えない環境では以下を直接実行:

```bash
# 各ブランチの最近のコミット
git log --oneline --since="20 minutes ago" --all --no-merges 2>/dev/null

# open PR 一覧
gh pr list --base dev-beta --state open --json number,title,headRefName,updatedAt 2>/dev/null

# merged PR（直近）
gh pr list --base dev-beta --state merged --json number,title,mergedAt -L 5 2>/dev/null
```

### Step 2: 早期終了判定

コミットもPR変化もなければ → `"Tick: no changes"` を出力して終了。
これが idle 時のトークン節約パス。

### Step 3: Todo Pool 読み込みと状態更新

`dev-docs/06_Operations/Todo_Pool.md` ��読み、各エントリの状態を更新:

| 検出シグナル | アクション |
|------------|-----------|
| assigned タスクのブランチにコミットあり | State → `doing` |
| doing タスクの PR が open | State → `verify` |
| verify タスクの PR が merged | State → `done`、daily note 追記 |
| doing/assigned でコミットなし | StallCycles += 1 |
| StallCycles >= 3 (約3×[TIME]分) | ユーザーに warning 表示 |
| StallCycles >= 6 (約６×[TIME]分) | State → `blocked`、escalation |

### Step 4: 次タスクアサイン

空きワーカー（doing/assigned タスクを持たないワーカー）がいれば、
`ready` タスクから優先度順に選んでアサインする。

#### アサインルール

| タスクの性質 | ワーカー | WorkerType | Branch |
|-------------|---------|------------|--------|
| UI・描画・CSS・SVG | visual | external-codex | dev-visual |
| model・API・DB・永続化 | data | external-codex | dev-data |
| data 並列ワーカー | data2 | external-codex | dev-data2 |
| Collaboration / Cloud Sync | team | external-codex | dev-team |
| 文書更新・spec・CI | claude (self) | in-session | dev-beta |
| 軽微修正 (<20行) | subagent | in-session | feature branch |
| 手動テスト・判断が必要 | akaghef | user | any |

PC 制約がある場合（`AssignedPC` が `any` でない）、現在のホストと一致するタスクのみアサイン。

#### アサイン実行

1. Todo_Pool.md のエントリを更新:
   - State → `assigned`
   - AssignedTo, AssignedPC, AssignedAt, WorkerType, Branch を設定
2. ハンドオフを実行（ワーカー種別による）

### Step 5: ハンドオフ

| WorkerType | ハンドオフ方式 |
|-----------|--------------|
| `in-session` | Agent tool でサブエージェントを直接起動。implementer.md の指示に従う。worktree 分離推奨 |
| `external-codex` | `dev-docs/tasks/handoff_{slug}.md` を生成 → commit → push。外部セッションが bootstrap 時に拾う |
| `user` | daily note に「タスク X が ready」と追記。ユーザーの次回確認を待つ |

### Step 6: レポート（変化があった場合のみ）

```
Tick 14:32 — 1 completed (Linear↔Tree L1), 1 newly assigned (scope/alias → codex2), 2 doing
```

変化がなければ silent。stall や escalation があれば目立つように表示。

---

## タスクの拡張フィールド

Todo_Pool.md の既存フィールド（Date, Topic, Owner, State, Link, Note）に加え、
intensive mode では以下を使う:

```markdown
- AssignedTo: visual
- AssignedPC: any
- AssignedAt: 2026-04-08T14:30:00
- WorkerType: external-codex
- Branch: dev-visual
- StallCycles: 0
```

| フィールド | デフォルト | 説明 |
|-----------|----------|------|
| AssignedTo | `-` | 未アサイン |
| AssignedPC | `any` | どのマシンでも実行可 |
| AssignedAt | `-` | アサイン前 |
| WorkerType | `-` | 未定 |
| Branch | `-` | 未定 |
| StallCycles | `0` | tick ごとにカウント |

フィールドが無いエントリは ON 時の正規化で自動補完される。

---

## 状態遷移の全体像

```
pooled → ready → assigned → doing → verify → done
                    │          │        │
                    │          │        └── build/test fail → doing に戻す
                    │          └── StallCycles >= 6 → blocked
                    └── StallCycles >= 6 → blocked（セッション未開始の長期放置）

blocked → ready（ブロッカー解消時、手動で戻す）
```

---

## Handoff ファイルフォーマット

`dev-docs/tasks/handoff_{slug}.md` に以下を書く:

```markdown
# Handoff: {タスクトピック}

- AssignedTo: {worker}
- AssignedAt: {ISO 8601}
- Branch: {branch name}
- Priority: {P1-P5}

## Task

{タスクの説明}

## Spec References

- {関連する spec ファイルパス}

## Acceptance Criteria

- [ ] {検証可能な完了条件1}
- [ ] {検証可能な完了条件2}

## Notes

{追加コンテキスト、注意事項}
```

外部 Codex セッションは bootstrap（`/setrole`）時に `dev-docs/tasks/handoff_*.md` を
スキャンし、自分の role に一致するファイルを拾って作業を開始する。

---

## devM3E との関係

intensive-develop は devM3E の**自動化レイヤー**。

```
┌──────────────────────────────────────────┐
│  intensive-develop (自動巡回)              │
│    tick → Assess → Plan → assign          │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │  devM3E (実行エンジン)                │  │
│  │    Execute → Verify → Integrate      │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  サブエージェント / 外部 Codex / ユーザー    │
└──────────────────────────────────────────┘
```

- intensive-develop が Assess と Plan を自動化
- 実際の Execute 以降は devM3E のフローに従う
- intensive off でも devM3E は手動で使える

---

## 制約と安全ルール

1. **beta/ が開発対象** — コード変更は beta/ 配下のみ
2. **final/ は触らない** — launch-final skill の管轄
3. **破壊的操作は自動実行しない** — force push, reset --hard, ブランチ削除は人間の確認が必要
4. **アサインの上書きは確認を求める** — 既に assigned/doing のタスクを別ワーカーに振り直す場合はユーザーに聞く
5. **idle tick はトークンを使わない** — Step 2 の早期終了を厳守
6. **1 tick あたりのサブエージェント起動は最大2つ** — リソース制御

---

## Reference Files

| ファイ��� | 読むタイミング |
|---------|-------------|
| `scripts/ops/intensive_check.sh` | tick の Signal 収集時 |
| devM3E `agents/implementer.md` | in-session サブエージェント起動時 |
| devM3E `agents/verifier.md` | verify フェーズの検証時 |
| devM3E `agents/doc-updater.md` | daily/status 更新時 |
| devM3E `references/operations_quickref.md` | 運用ルール確認時 |
