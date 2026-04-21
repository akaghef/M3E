# Qn3_gate2_rework — Gate 2 差戻の鍵論点

- **status**: resolved 2026-04-21 (akaghef が P1-P4 方針確定 + rework 完了条件を明示)
- **phase**: 1 → 1.5（rework）
- **blocker_for**: T-1-7（Gate 2 通過）
- **pooled**: 2026-04-21

## akaghef 指摘（原文要旨 + 該当コード）

### 1. persistence gap — SSOT 宣言と実装の矛盾（最重要）

WorkflowState に escalationKind / wakeupAt / wakeupMechanism / failureReason を宣言 ([workflow_types.ts:47](../../../beta/src/shared/workflow_types.ts#L47)) しつつ、[workflow_runner.ts:126-136](../../../beta/src/node/workflow_runner.ts#L126-L136) の entryToCheckpoint で全部 null に潰す。applyWriteback ([workflow_runner.ts:287-359](../../../beta/src/node/workflow_runner.ts#L287-L359)) も書き戻し対象外。sleeping/escalated/failed が実稼働した瞬間、resume で理由と再開条件を失う。invariant 宣言と機械検査が不一致。

### 2. runner は reducer であって engine ではない

StepSignal が全て外部注入、selectEdge は signal → edge ID の写像のみ ([workflow_runner.ts:154-210](../../../beta/src/node/workflow_runner.ts#L154-L210))。dogfood log 自身が「副作用は呼び出し側」「Generator/Evaluator 起動は Phase 2」と書いている ([dogfood_run_01.md:43-46](../artifacts/dogfood_run_01.md))。Gate 2 の「1 task workflow が実際に回る」主張は過大。実態は「人間/Manager が signal を逐次注入したときに状態遷移表と writeback が動く」まで。

### 3. pickNextTask は FIFO、state-machine ではない

in_progress/ready/pending 検索のみ ([workflow_runner.ts:108-124](../../../beta/src/node/workflow_runner.ts#L108-L124))。依存解決・sleeping wakeup・escalated 再開可否を見ない。E01 条件「依存 task が done」は tasks schema に dependencies フィールドが無く（[workflow_runner.ts:38-55](../../../beta/src/node/workflow_runner.ts#L38-L55)）、モデルに存在しない条件を edge table に載せているだけ。

### 4. sleeping に時間ソースが無い

E08/E09 は表にあるが runner は clock を読まない。`--resume` は pickNextTask を呼ぶのみ ([workflow_runner.ts:695-706](../../../beta/src/node/workflow_runner.ts))。state を増やしたのに runtime semantics が無い。

### 5. escalated が人間判断 queue として不完全

escalationKind 復元不可、reviews/Qn との紐付け未モデル化 ([workflow_runner.ts:253-256](../../../beta/src/node/workflow_runner.ts), 431-459)。state ではなく flag に退化。

### 6. WorkflowNode / workflow_example.json が実行で未使用

runner は node graph を読まず、遷移は ALLOWED_EDGES + CLI signal のみ。design artifact と実動コードが拘束関係なしに二重表現。ズレ確実。

### 7. applyWriteback の surgical replace が checkpoint 正本として脆弱

`includes(patch.taskId)` で - id 行検索は ID 部分一致・コメント混在に弱い ([workflow_runner.ts:316](../../../beta/src/node/workflow_runner.ts#L316))。field 行欠落時に補完せず、hits 不足でも成功扱い（[workflow_runner.ts:342-350](../../../beta/src/node/workflow_runner.ts)）。構造保持と引き換えに完全性を犠牲。

### 8. round 定義が曖昧

E06 のみで増加 ([workflow_runner.ts:242](../../../beta/src/node/workflow_runner.ts#L242))。初回 dispatch・generator 再実行・resume 跨ぎで未定義。pending/ready に `round == 0` invariant を課しつつ E15 で blocked → ready 時に round 維持。workflow_state_set.md と実装の整合が弱い。Hermes feedback loop で必ず揉める。

### 9. "code-reachable" は gate 根拠として不十分

sleeping/escalated/failed は 1・4・5 の永続化欠落があるため、到達可能でも運用成立を示せていない。Evaluator pass は甘い。

## 差戻の優先順（akaghef 指定）

- **P1**: tasks.yaml に checkpoint 必須フィールド追加 or 別機械正本を作るかを決定
- **P2**: runner の責務を reducer と明言するか、dispatch/orchestration を取り込んで engine にするかを決定
- **P3**: E01 / E08 / E09 / E10-E16 の条件を実データと runtime で観測可能な形に落とす
- **P4**: workflow_example.json を実行入力に昇格するか、artifact から降格するか決定

## 私の立場（Manager 提案）

各論点への**提案**であり確定ではない。akaghef が P1-P4 の方針を決めたら rework tasks T-1-8..T-1-11 を起票。

- P1: 別機械正本 `projects/PJ{NN}_{Name}/runtime/checkpoints/{taskId}.json` を導入し、tasks.yaml は sprint contract だけに留める。tasks.yaml は comment/構造保持が重要なので、機械完全性が要る state を混ぜたくない
- P2: reducer に明言。名前を `workflow_reducer.ts` に改名、「signal を受けて state と writeback を管理する」と責務を limit。engine 化は Phase 2 で別 task
- P3: tasks.yaml に `dependencies: [T-X-Y, ...]` 追加。sleeping の wakeup 判定は reducer の `pickNextTask` に clock 参照を追加。escalated は reviews/Qn への `linked_review` field を checkpoint に持つ
- P4: workflow_example.json は降格。`docs/workflow_example.md` として description artifact 化し、reducer の動作例コード（または失敗テスト）に置換

## 決定者

akaghef（P1-P4 の方針確定 → rework task 起票 → 再 gate 2）

## akaghef 確定（2026-04-21）

- **P1 採用**: tasks.yaml は人間向け契約に限定。machine SSOT は `runtime/checkpoints/{taskId}.json` に分離
- **P2 採用**: `workflow_reducer.ts` に改名。責務は `(state, signal) -> nextState + persistence patch` に限定。orchestration/engine は Phase 2 へ
- **P3 採用（一部修正）**: dependencies / linked_review 追加。clock は「参照」ではなく **注入可能な Clock interface** にする（Date.now() 直参照を設計に埋めない）
  - tasks.yaml に追加: `dependencies`, `linked_review`, `eval_required`（既存）
  - checkpoint JSON: `state, round, last_feedback, blocker, escalation_kind, wakeup_at, wakeup_mechanism, failure_reason`
  - reducer input: `clock`, `reviewResolver`, `dependencyResolver`
- **P4 採用**: `workflow_example.json` → `docs/workflow_example.md` に降格。コード寄りの場所に動かない spec を置かない
- **rework 完了条件**: 「未観察 edge を増やす」ではなく「**宣言した state の resume 情報が欠落しない**」。これを満たさない限り Gate 2 再提出禁止
