# Reducer Responsibility — workflow_reducer.ts の責務境界

- **status**: authoritative (T-1-9)
- **phase**: 1.5 rework
- **source**: Qn3_gate2_rework P2 akaghef 確定
- **referenced by**: T-1-10 Clock/resolver injection、Phase 2 engine 化検討

## 確定した境界（akaghef P2 確定）

### 責務（reducer が担う）

1. **state machine**: `(state, signal) → nextState` の純粋関数 (`stepOnce`, `selectEdge`, `driveCycle`)
2. **fail-closed edge 選択**: ALLOWED_EDGES にない遷移は null 返却
3. **persistence adapter**: checkpoint JSON の atomic read/write (`loadCheckpointState`, `saveCheckpointState`)
4. **task 全体像の read-only ビュー**: tasks.yaml + checkpoint の統合 (`loadAllTaskViews`, `pickNextTask`)
5. **resume cheatsheet の runner-managed block 再生成** (`regenerateCheatsheet`)

### 非責務（reducer は含まない — engine 化は Phase 2 の別 task）

| 責務 | 理由 | 将来の置き場 |
|---|---|---|
| Generator 起動（subagent spawn） | orchestration であって reducer ではない | Phase 2: workflow_orchestrator.ts |
| Evaluator 起動（subagent spawn） | 同上 | Phase 2: workflow_orchestrator.ts |
| 時刻 polling による wakeup 発火 | Clock 管理は外部化 | T-1-10: Clock interface 経由 |
| 依存解決（E01 の条件判定） | dependency resolver 未実装 | T-1-10: DependencyResolver 経由 |
| reviews/Qn との統合（E12/E13/E15） | ReviewResolver 未実装 | T-1-10: ReviewResolver 経由 |
| hook wiring (SessionStart/PostCompact) | process lifecycle 管理 | Phase 2: workflow_orchestrator.ts |
| CLI パース・整形出力 | UI 層 | **workflow_cli.ts** (T-1-9 分離済) |

### 純粋性の現状

reducer の core 関数（`stepOnce` / `selectEdge` / `driveCycle` / `freshState` / `suggestNextSignal`）は Date / fs / subprocess を直接呼ばない。

persistence adapter（`loadCheckpointFile` / `saveCheckpointFile` / `loadCheckpointState` / `saveCheckpointState`）は fs / Date を使う（現状は直参照）。T-1-10 で Clock / FS adapter を injection して reducer を完全純粋化する。

## 過大評価の防止

Gate 2 差戻の直接原因の 1 つが「engine と呼んだが実体は reducer」だった。以下を守る:

- 文書で `reducer` と呼ぶ。`engine` を使うときは必ず "Phase 2 以降" と明記
- dogfood 記録で「workflow が回る」と書くときは「reducer が signal → state を反映する」に置き換える
- Generator/Evaluator の起動を reducer が担うと書かない

## CLI との分離

T-1-9 で `workflow_cli.ts` を新設。reducer は副作用なし library、CLI は薄い wrapper。

- `workflow_reducer.ts`: library only. `main` / argv / stdout への直接書き込みなし
- `workflow_cli.ts`: `parseArgs`, `buildSignal`, `main`, `process.exit` を持つ
- 両者は 1:1 ではない。reducer の API を他の CLI や test から直接呼んでよい

## Phase 2 orchestrator / clock daemon 責務境界（T-2-1 / T-2-2 確定）

T-2-1 で `clock_daemon.ts`、T-2-2 で `workflow_orchestrator.ts` を追加。
reducer はそのまま不変で、両者は reducer の API を薄くラップする層。

### clock_daemon.ts (T-2-1)

- 責務: `runDaemonTick`（tickAutoTransitions 委譲）、`planWakeups`（sleeping task に対する ScheduleWakeup / CronCreate 指示生成）
- 非責務: 実際の ScheduleWakeup / CronCreate API 呼び出し（harness / CLI 側）、state 遷移（reducer 側）

### workflow_orchestrator.ts (T-2-2)

- 責務: `orchestrateOnce` で pickNextTask → state に応じた Generator/Evaluator 起動 → verdict → `runOneStep` へ signal 注入
- 責務: `SubagentAdapter` interface (test で mock 化)、`FeedbackHook`（Hermes 的 feedback 変換点、Phase 2 では interface のみ）
- 責務: `initCheckpointFor`（Qn4 対応、新 task の checkpoint 生成）
- 非責務: state 遷移そのもの（reducer 側）、checkpoint の直接書き換え（reducer 経由のみ。initCheckpointFor は bootstrap 専用で既存ファイル保護）
- 非責務: 実際の Anthropic API 呼び出し（SubagentAdapter 実装側が担う、orchestrator 本体には出てこない）

### 全体のレイヤ

```
┌─────────────────────────────────────────────────┐
│ workflow_cli.ts  (argv + stdout + exit code)     │
├─────────────────────────────────────────────────┤
│ workflow_orchestrator.ts  (subagent dispatch)    │
│ clock_daemon.ts           (tick + wakeup plan)   │
├─────────────────────────────────────────────────┤
│ workflow_reducer.ts  (state machine + checkpoint)│
├─────────────────────────────────────────────────┤
│ checkpoint_types.ts / clock.ts / resolvers.ts    │
└─────────────────────────────────────────────────┘
```

上位レイヤは下位レイヤの API のみを呼ぶ。下位は上位を知らない（循環依存なし）。
engine を名乗るのはこの 4 層がすべて揃い、かつ Generator / Evaluator の実 subagent adapter が配線された Phase 2 後半以降。

## 将来 kickoff 候補（非コミット）

- `hook_bridge.ts`: SessionStart / PostCompact hook からの resume 呼び出し (T-2-3 で着手)
- `review_bridge.ts`: reviews/Qn の frontmatter を watch して `blocker_cleared` signal を発火
- Anthropic API を実際に叩く SubagentAdapter 実装（PJ 外）

## Cross-reference

- `projects/PJ03_SelfDrive/docs/checkpoint_schema.md`: persistence adapter の対象
- `projects/PJ03_SelfDrive/docs/workflow_edges.md`: selectEdge の根拠
- `beta/src/node/workflow_reducer.ts`: 本責務の実装
- `beta/src/node/workflow_cli.ts`: CLI wrapper
