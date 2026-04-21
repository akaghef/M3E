# Qn4 — migrate_checkpoints regression (legacy one-shot を再実行した)

- **status**: resolved 2026-04-21 (self-inflicted、削除で対処)
- **phase**: 2 kickoff
- **pooled**: 2026-04-21

## 何が起きたか

Phase 2 kickoff で T-2-1..T-2-5 の checkpoint JSON を生成するため
`node dist/node/migrate_checkpoints.js` を再実行したところ、全 16 既存 checkpoint の
`state.kind` が undefined に潰された（JSON には kind フィールドが欠落）。

原因:
- migrate_checkpoints.ts は T-1-8 rework 以前の schema 前提（tasks.yaml の `status:` 行を読む）
- T-1-8 で tasks.yaml から `status` が削除された後も migrate script が残っていた
- 再実行で `entry.status` が undefined になり、全 task の checkpoint が壊れた

復旧:
- `git checkout HEAD -- runtime/checkpoints/` で 16 既存ファイル復元
- T-2-1..T-2-5 は git 未 track だったので Edit で手動修復（kind=pending 追加）

## 教訓

- 一度役目が終わった migration script を repo に残しておくと、後続 phase で事故る
- 新 task 追加時の checkpoint 生成は migration ではなく reducer の `initCheckpoint(taskId)` 的 helper で行うべき
- schema breaking change 後、関連する legacy script は削除 or 明示的 guard を入れる

## 対処

1. `beta/src/node/migrate_checkpoints.ts` 削除（legacy schema 前提）
2. `beta/src/node/strip_tasks_state.ts` 削除（T-1-8 一度限り）
3. `beta/src/node/add_task_fields.ts` 削除（T-1-10 一度限り）
4. Phase 2 以降、新 task checkpoint は `reducer.initCheckpoint(runtimeDir, contract)` で生成する運用にする（T-2-2 orchestrator 実装時に追加候補）

## 決定者

Manager が即時対処（akaghef レビュー不要、自己修復）。
