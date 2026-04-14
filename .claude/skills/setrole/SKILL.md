---
name: setrole
description: |
  M3Eプロジェクトでエージェントが作業開始時にロールを確定するスキル。
  ワークツリーで起動した各エージェントは、最初にこのスキルを実行して
  担当ロール・ブランチ・作業範囲・割り当てタスクを確認する。
  以下の場面でトリガーする:
  - 「/setrole」「setrole」「ロール設定」と言われたとき
  - エージェントがワークツリーで起動された直後
  - 「自分の担当は？」「何をすればいい？」と聞かれたとき
  - ブランチや作業範囲の確認が必要なとき
  devM3E の Execute フェーズでサブエージェントを起動する際に自動実行される。
---

# setrole — Agent Role Initialization

ワークツリーで起動したエージェントが自分の役割を確定し、割り当てタスクを拾うためのスキル。

## Usage

```
/setrole {role}
```

role を省略した場合は、現在のブランチ名から自動判定する。

## ロール定義

| ロール | ブランチ | 担当領域 | ファイルスコープ |
|--------|---------|---------|----------------|
| `visual` | dev-visual | UI・描画・CSS・SVG・UX | `beta/src/browser/`, `beta/viewer.css`, `beta/viewer.html` |
| `data` | dev-data | model・controller・API・永続化 | `beta/src/node/`, `beta/src/shared/` |
| `data2` | dev-data2 | data の並列ワーカー | `beta/src/node/`, `beta/src/shared/` |
| `team` | dev-team | Collaboration・Cloud Sync | `beta/src/node/collab.ts`, `beta/src/node/cloud_sync.ts`, `beta/src/node/start_viewer.ts` (collab部分) |
| `manage` | dev-beta | CI・運用・文書・統合 | `dev-docs/`, `.claude/`, `scripts/`, `AGENTS.md` |

## 実行フロー

### Step 1: ロール確定

引数があればそのロールを採用。なければブランチ名からマッピング:

```
dev-visual            → visual
dev-data              → data
dev-data2             → data2
dev-team              → team
dev-beta              → manage
worktree-agent-*      → (ブランチ名では判定不可。引数必須)
```

**Worktree 環境での注意**: `isolation: worktree` で起動されたエージェントは
`worktree-agent-*` ブランチにいる場合がある。この場合はロール引数が必須。
引数なし + 不明ブランチ → エラー停止。

マッピングできなければエラーで停止する（不明なブランチでは作業しない）。

### Step 2: ブランチ検証

```bash
git branch --show-current
```

現在のブランチがロールの期待ブランチと一致することを確認する。

**Worktree 環境**: `worktree-agent-*` ブランチにいる場合は、ロールの期待ブランチに
チェックアウトし、`origin/dev-beta` で rebase する:

```bash
git fetch origin
git checkout dev-visual 2>/dev/null || git checkout -b dev-visual origin/dev-beta
git rebase origin/dev-beta
```

**通常環境**: 一致しない場合はチェックアウトを提案する:

```
⚠ 現在 dev-beta にいますが、ロール visual のブランチは dev-visual です。
切り替えますか？
```

### Step 3: タスク収集

以下の2箇所からタスクを収集する:

#### 3a. マップの strategy ボードを読む

M3E サーバーが起動中なら:

```bash
curl -sf http://localhost:38482/api/docs/rapid-main
```

`dev M3E/strategy` 配下のノードを走査し、`attributes.agent` が自分のロール名を含むノードを抽出する。
`attributes.status` が `ready` または `doing` のものを優先表示。

サーバー未起動なら: スキップして Step 3b のみ。

#### 3b. ハンドオフファイルをスキャン

```bash
ls dev-docs/tasks/handoff_*.md
```

各ファイルの先頭を読み、`AssignedTo` が自分のロール名に一致するものを抽出する。

### Step 4: 作業開始レポート

以下のフォーマットで出力:

```
## Role: {role}
Branch: {branch}
Scope: {file scope}

## Assigned Tasks
1. [{priority}] {task description} — {source: map/handoff}
2. ...

## Constraints
- beta/ が開発対象
- final/ は触らない（launch-final の管轄）
- 担当外ファイルは変更しない
- PR は dev-beta ベースで作成（/pr-beta 使用）

Ready to start. どのタスクから着手しますか？
```

タスクがなければ:

```
## Role: {role}
Branch: {branch}

割り当てタスクはありません。
マップの strategy ボードを確認するか、マネージャーに問い合わせてください。
```

## ロール固有の追加ルール

### visual
- SVG の描画変更は `beta/tests/visual/` のスナップショットテストに影響する。変更後は `npx playwright test` を実行
- `viewer.tuning.ts` の定数変更はレイアウト全体に波及するため慎重に

### data / data2
- `rapid_mvp.ts` のモデル変更は `validate()` の整合性に影響する。テスト必須
- `start_viewer.ts` のAPI追加はREST API spec (`dev-docs/03_Spec/REST_API.md`) も更新する
- data と data2 が同じファイルを同時編集しないよう、タスク単位で分離する

### team
- `collab.ts` の変更は `M3E_COLLAB=1` でテストする
- Cloud Sync の変更は `M3E_CLOUD_SYNC=1` でテストする
- SSE の変更はブラウザでの動作確認も必要

### manage
- ドキュメントは日本語で書く（技術トークンは英語）
- スキル変更後はトリガーテストを推奨
- CI 関連の変更は全ブランチに影響するため、dev-beta への PR 時に注意

## devM3E との連携

setrole は devM3E の **Phase 3: Execute** でサブエージェントを起動する際のブートストラップとして使う。

```
1. devM3E がタスクを選定（Plan）
2. サブエージェントを worktree で起動
3. サブエージェントが /setrole を実行 ← ここ
4. 割り当てタスクに着手
5. 完了後 /pr-beta で PR 作成
```

devM3E の自動アサインでも、ハンドオフファイル経由でタスクが届く。
