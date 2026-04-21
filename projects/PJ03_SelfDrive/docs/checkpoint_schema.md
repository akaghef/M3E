# Checkpoint Schema — tasks.yaml / checkpoint JSON の責務分離

- **status**: authoritative (T-1-8)
- **phase**: 1.5 rework
- **source**: Qn3_gate2_rework P1 akaghef 確定
- **referenced by**: T-1-9 reducer 実装、T-1-10 observable 条件、T-1-11 example 処遇

## 設計原則

- **tasks.yaml = 人間向け sprint contract**: 何をやるか（done_when / eval_criteria / 依存関係）の宣言
- **checkpoint JSON = 機械向け実行状態**: state machine の現在値、resume に必要な全 invariant field
- **SSOT**: 各フィールドは片方にしか存在しない。cross-write 禁止
- **atomic persistence**: checkpoint JSON は tmp write → rename で atomic 更新
- **invariant 完全性**: checkpoint JSON を読み戻すと WorkflowState の全 invariant が復元される（resume 情報欠落なし — rework 完了条件）

## フィールド境界表

| フィールド | tasks.yaml | checkpoint JSON | 根拠 |
|---|---|---|---|
| `id` | ✓ | (file 名に embed) | 契約単位 |
| `phase` | ✓ | — | 契約 |
| `verb` / `target` | ✓ | — | 契約 |
| `done_when` | ✓ | — | 契約 |
| `eval_required` | ✓ | — | 契約 |
| `eval_criteria` | ✓ | — | 契約 |
| `parallelizable` | ✓ | — | 契約 |
| `scope` | ✓ | — | 契約 |
| `facet` | ✓ | — | 契約 |
| `round_max` | ✓ | — | 契約（上限） |
| `dependencies` (T-1-10) | ✓ | — | 契約（静的依存） |
| `linked_review` (T-1-10) | ✓ | — | 契約（紐付け review） |
| **`state.kind`** | — | ✓ | 実行状態 |
| **`state.round`** | — | ✓ | 実行状態 |
| **`state.last_feedback`** | — | ✓ | 実行状態 |
| **`state.blocker`** | — | ✓ | 実行状態 |
| **`state.escalation_kind`** | — | ✓ | 実行状態 |
| **`state.wakeup_at`** | — | ✓ | 実行状態 |
| **`state.wakeup_mechanism`** | — | ✓ | 実行状態 |
| **`state.failure_reason`** | — | ✓ | 実行状態 |
| `updated_at` | — | ✓ | checkpoint metadata |
| `schema_version` | — | ✓ | checkpoint metadata |

## checkpoint JSON 形式

`projects/PJ03_SelfDrive/runtime/checkpoints/{taskId}.json`

```json
{
  "schema_version": 1,
  "task_id": "T-0-1",
  "updated_at": "2026-04-21T12:00:00.000Z",
  "state": {
    "kind": "done",
    "round": 1,
    "round_max": 3,
    "last_feedback": "evaluator pass (2026-04-21)",
    "blocker": null,
    "escalation_kind": null,
    "wakeup_at": null,
    "wakeup_mechanism": null,
    "failure_reason": null
  }
}
```

`round_max` は契約から checkpoint に複製される（invariant 検査 `round <= round_max` の runtime データ）。
契約側が上限を定義し、checkpoint 側が現実の round を持つ。

### round_max drift 防止（reconciliation）

契約 `tasks.yaml.round_max` と checkpoint `state.round_max` は同値でなければならない（contract 正本、checkpoint は cache）。
reducer の起動時に不一致を検出した場合:

- 契約側を採用（contract always wins）
- checkpoint を書き換えて同期
- stderr に warning を 1 行出す

T-1-9 rename 時、または T-1-10 で Clock injection 実装時に `reconcileRoundMax` 関数として導入する。現状は restore test が通るため P1 の完了条件は満たすが、drift 検出は Phase 1.5 のうちに済ませる（Evaluator soft flag）。

## atomic write 手順

```ts
// saveCheckpoint 実装
const tmpPath = `${path}.tmp-${randomId}`;
fs.writeFileSync(tmpPath, JSON.stringify(file, null, 2) + "\n", "utf8");
fs.renameSync(tmpPath, path);  // POSIX atomic; Windows は最善努力
```

- tmp と本体は同一ディレクトリ（cross-device rename を避ける）
- 中断時に tmp ファイルが残り得るので、起動時に `.tmp-*` を列挙してクリーンアップ
- 部分書き込みファイルを本体として読むことはない

## restore test（rework 完了条件）

`beta/src/node/checkpoint_restore_test.ts` (T-1-8 で追加):

1. 9 state それぞれについて synthetic WorkflowState を作る（全 invariant field を非 null で埋める）
2. saveCheckpoint → loadCheckpoint で round-trip
3. 全フィールドが deep-equal であることを assert
4. 1 つでも欠落すると Error exit → test fail

これが pass するまで Gate 2 再提出不可（akaghef 明示）。

## Migration plan (T-1-8 実行手順)

1. `beta/src/shared/checkpoint_types.ts` 新設、CheckpointFile 型 export
2. 各 task の現 tasks.yaml 値を元に `runtime/checkpoints/{id}.json` 生成（migrate script or 手動 1 回）
3. `beta/src/node/workflow_runner.ts` の read/write 経路を checkpoint JSON に切り替え（このファイルは T-1-9 で `workflow_reducer.ts` に rename）
4. tasks.yaml から status / round / last_feedback / blocker の 4 フィールドを全 entry から除去
5. build + restore test で完了確認
