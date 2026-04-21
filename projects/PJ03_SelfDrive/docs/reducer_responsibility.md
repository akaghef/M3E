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

## Phase 2 での engine 化候補（非コミット）

以下は **Phase 2 で akaghef が kickoff するなら** の候補。現状は未着手:

- `workflow_orchestrator.ts`: Generator / Evaluator の subagent dispatch
- `clock_daemon.ts`: sleeping task の wakeup 発火 (ScheduleWakeup / CronCreate 連携)
- `hook_bridge.ts`: SessionStart / PostCompact hook からの resume 呼び出し
- `review_bridge.ts`: reviews/Qn の frontmatter を watch して `blocker_cleared` signal を発火

いずれも「engine」を名乗る前に責務境界を明文化すること。

## Cross-reference

- `projects/PJ03_SelfDrive/docs/checkpoint_schema.md`: persistence adapter の対象
- `projects/PJ03_SelfDrive/docs/workflow_edges.md`: selectEdge の根拠
- `beta/src/node/workflow_reducer.ts`: 本責務の実装
- `beta/src/node/workflow_cli.ts`: CLI wrapper
