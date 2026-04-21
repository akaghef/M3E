# Resume Protocol — checkpoint / reload path

- **status**: authoritative (T-1-5, updated T-1-8 / T-1-9 for checkpoint JSON split and reducer rename)
- **phase**: 1.5 rework
- **referenced by**: SessionStart / PostCompact hook の将来配線（Phase 2）

## Checkpoint の正本

T-1-8 以降は **checkpoint JSON が machine SSOT**。tasks.yaml は human contract に限定。

| layer | 正本ファイル | 書く主体 | 読む主体 |
|---|---|---|---|
| **machine (primary)** | `projects/PJ{NN}_{Name}/runtime/checkpoints/{taskId}.json` の `state` フィールド群（kind / round / last_feedback / blocker / escalation_kind / wakeup_at / wakeup_mechanism / failure_reason） | `workflow_reducer.saveCheckpointState`（atomic tmp+rename） | `workflow_reducer.loadCheckpointState` |
| human contract | `projects/PJ{NN}_{Name}/tasks.yaml`（id / phase / verb / target / done_when / eval_required / eval_criteria / round_max / dependencies / linked_review） | 人間 / Generator | `workflow_reducer.readContracts` |
| human summary | `projects/PJ{NN}_{Name}/resume-cheatsheet.md`（reducer-managed block） | `workflow_reducer.regenerateCheatsheet` | Manager / akaghef |

checkpoint JSON が machine SSOT。resume-cheatsheet.md と tasks.yaml はそれぞれ別軸の正本。

## Resume コマンド

```bash
node dist/node/workflow_cli.js --tasks <tasks.yaml> --runtime <runtimeDir> --resume
```

出力:
- 次処理対象の taskId
- 現 state / round / roundMax
- last_feedback / blocker
- 推奨次 signal 種別（`suggestNextSignal` の結果）

## pickNextTask の優先順

1. `status: in_progress`（前セッションで中断、同 node を再開）
2. `status: ready`（依存解決済、dispatch 待ち）
3. `status: pending`（phase → id 昇順で先頭）
4. それ以外（terminal / blocked / sleeping / escalated）→ null = E1 Phase gate 候補 or 別オペ待ち

## Idempotency 保証

`applyWriteback` は値トークンのみを surgical に書き戻す:
- `newContent === raw` なら `updated: false` を返し、`fs.writeFileSync` を呼ばない
- 同じ patch を 2 回適用しても I/O は 1 回目のみ
- `runOneStep` 経由で同じ (state, signal) を 2 回投げると、1 回目で state 遷移した後 2 回目は fail-closed で REJECTED（double-fire 防止は state machine 本体の性質）

## Double-fire 防止（Generator / Evaluator 再起動防止）

- `status: done` の task に対しては `selectEdge` が null を返す（terminal 不可逆）
- 同じ `taskId` に対して `generator_done` を 2 回投げても、2 回目は `eval_pending` or `done` から発火不能で reject
- reducer は副作用（外部プロセス起動・ファイル生成）を直接は持たない。副作用は呼び出し側（sub-pj-do skill / hook）が state 遷移を見て判断する

## Corrupt checkpoint 処理

`readTasks` は 3 段階で検証し、いずれも明示的 Error を throw:
1. ファイル読取失敗 → `checkpoint read failed: ...`
2. YAML parse 失敗 → `checkpoint corrupt: YAML parse error in ...`
3. top-level が list でない / entry.id 欠落 / unknown status → `checkpoint corrupt: ...`

silent reset は行わない。呼び出し側が catch して reviews/Qn に pool するか、人間に escalate する。

## SessionStart / PostCompact hook 配線方針（将来）

現状: `.claude/skills/sub-pj/phase/resume.md` が SessionStart hook の additionalContext で注入される。人間 / Manager が読んで手順に従う。

将来（Phase 2 以降）:
- SessionStart hook が `workflow_reducer --resume` を自動実行し、次 task の checkpoint 情報を chat に注入
- PostCompact hook も同様、compact 直後に checkpoint を dump して context 欠落を補填
- hook スクリプト配置: `.claude/scripts/hooks/session-start-workflow.sh`（未作成）

現 Phase 1 では reducer の CLI が動くことを確認するまで。hook 配線は backlog。

## Test: kill-mid-transition resume

手動再現手順:
1. `--task T-X --signal generator_done_eval` を実行（writeback まで走る）
2. ファイルは `eval_pending` 状態、round は 0
3. 別セッションで `--resume` を叩く → 同 task を `eval_pending` / expected signal class = "evaluator_verdict | ..." で復元
4. `--task T-X --signal evaluator_pass` で継続、`done` へ

kill のタイミングが writeback 前なら state は前 state のまま、writeback 後なら新 state。どちらも resume から整合継続可能。

## Cross-reference

- beta/src/node/workflow_reducer.ts: `readTasks` / `loadCheckpoint` / `pickNextTask` / `applyWriteback` / `suggestNextSignal`
- workflow_state_set.md: terminal 定義（double-fire 防止の根拠）
- legacy_asset_mapping.md: PostCompact / SessionStart / Stop hook の checkpoint role
