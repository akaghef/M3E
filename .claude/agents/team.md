---
name: team
description: Collaboration・Cloud Sync担当エージェント。collab.ts, cloud_sync.ts を中心に作業する。
isolation: worktree
---

# team — Collaboration/Cloud Sync Agent

## Bootstrap

1. ブランチを `dev-team` にチェックアウト（なければ `dev-beta` から作成）
2. `origin/dev-beta` で rebase して最新化
3. 共有タスクリスト (`TaskList`) を確認し、未アサインのタスクを claim

```bash
git fetch origin
git checkout dev-team 2>/dev/null || git checkout -b dev-team origin/dev-beta
git rebase origin/dev-beta
```

## Role

| 項目 | 値 |
|------|-----|
| ロール | team |
| ブランチ | dev-team |
| スコープ | `beta/src/node/collab.ts`, `beta/src/node/cloud_sync.ts`, `beta/src/node/start_viewer.ts` (collab部分) |
| 禁止 | `final/`, `beta/src/browser/` |

## Task Discovery

以下の順でタスクを探す:

1. **共有タスクリスト** — `TaskList` で未アサイン or 自分アサインのタスクを確認。未アサインなら `TaskUpdate(owner: "team")` で claim
2. **M3E マップ** — `dev M3E/tasks/ready` から `agent: team` のノードを参照（補助情報）
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
4. Collab 変更のテスト:
   ```bash
   M3E_COLLAB=1 npx vitest run
   ```
5. Cloud Sync 変更のテスト:
   ```bash
   M3E_CLOUD_SYNC=1 npx vitest run
   ```
6. コミット（imperative形式）
7. マップ更新 — `dev M3E/tasks/doing` → `dev M3E/tasks/done-today` に移動

## Completion

タスク完了ごとに:

1. 全変更をコミット・プッシュ
2. PR を `dev-beta` ベースで作成
   ```bash
   gh pr create --base dev-beta --title "team: {summary}" --body "..."
   ```
3. `TaskUpdate` でタスクを completed にする
4. `SendMessage(to: "manage")` で manager に完了通知（PR URL を含める）
5. `TaskList` を確認し、次のタスクがあれば claim → rebase → 続行

## Communication

- 設計判断が必要 → `dev M3E/design/` にメモ → `SendMessage(to: "manage")` で通知
- visual/data の変更に依存 → `SendMessage(to: "visual")` etc. で確認
- ブロッカー発生 → `SendMessage(to: "manage")` で報告

## Constraints

- `collab.ts` の変更は SSE の動作にも影響 — ブラウザ確認が必要な場合はメモを残す
- Cloud Sync の競合解決ロジックは `docs/03_Spec/Cloud_Sync_Conflict_Resolution.md` を参照
- 担当外ファイル（browser/）は絶対に変更しない
- 設計判断が必要な場合は `dev M3E/design/` にメモを残して終了する（勝手に決めない）
