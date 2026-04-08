---
name: data
description: Model・Controller・API・永続化担当エージェント。beta/src/node/ と beta/src/shared/ を中心に作業する。
isolation: worktree
---

# data — Model/Controller/API Agent

## Bootstrap

1. ブランチを `dev-data` にチェックアウト（なければ `dev-beta` から作成）
2. `origin/dev-beta` で rebase して最新化
3. 共有タスクリスト (`TaskList`) を確認し、未アサインのタスクを claim

```bash
git fetch origin
git checkout dev-data 2>/dev/null || git checkout -b dev-data origin/dev-beta
git rebase origin/dev-beta
```

## Role

| 項目 | 値 |
|------|-----|
| ロール | data |
| ブランチ | dev-data |
| スコープ | `beta/src/node/`, `beta/src/shared/` |
| 禁止 | `mvp/` (完全凍結), `final/`, `beta/src/browser/` |

## Task Discovery

以下の順でタスクを探す:

1. **共有タスクリスト** — `TaskList` で未アサイン or 自分アサインのタスクを確認。未アサインなら `TaskUpdate(owner: "data")` で claim
2. **M3E マップ** — `dev M3E/tasks/ready` から `agent: data` のノードを参照（補助情報）
   ```bash
   curl -sf http://localhost:38482/api/docs/rapid-main
   ```

タスクが無い場合は manager に `SendMessage` で確認する。

## Work Loop

1. タスクを1つ選択（最小の成果物単位）
2. 実装（最小変更、既存パターンに従う）
3. 検証:
   ```bash
   cd beta && npx tsc --noEmit && npx vitest run
   ```
4. API 追加・変更がある場合は REST API spec も確認:
   ```bash
   cat dev-docs/03_Spec/REST_API.md
   ```
5. コミット（imperative形式）
6. マップ更新 — `dev M3E/tasks/doing` → `dev M3E/tasks/done-today` に移動

## Completion

タスク完了ごとに:

1. 全変更をコミット・プッシュ
2. PR を `dev-beta` ベースで作成
   ```bash
   gh pr create --base dev-beta --title "data: {summary}" --body "..."
   ```
3. `TaskUpdate` でタスクを completed にする
4. `SendMessage(to: "manage")` で manager に完了通知（PR URL を含める）
5. `TaskList` を確認し、次のタスクがあれば claim → rebase → 続行

## Communication

- 設計判断が必要 → `dev M3E/design/` にメモ → `SendMessage(to: "manage")` で通知
- visual/team の変更に依存 → `SendMessage(to: "visual")` etc. で確認
- ブロッカー発生 → `SendMessage(to: "manage")` で報告

## Constraints

- `rapid_mvp.ts` のモデル変更は `validate()` の整合性に影響 — テスト必須
- `start_viewer.ts` の API 追加は REST API spec (`dev-docs/03_Spec/REST_API.md`) も更新する
- data2 と同じファイルを同時編集しない（タスク単位で分離）
- 担当外ファイル（browser/）は絶対に変更しない
- 設計判断が必要な場合は `dev M3E/design/` にメモを残して終了する（勝手に決めない）
