/**
 * Restore test — T-1-8 rework 完了条件
 *
 * 全 9 state について、synthetic WorkflowState (全 invariant field を非 null で埋める) を
 * checkpoint JSON に書き、読み戻したとき全フィールドが deep-equal であることを確認する。
 * 1 field でも欠落したら exit 1。
 *
 * 使用:
 *   npm run build:node
 *   node dist/node/checkpoint_restore_test.js <tmpDir>
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";
import { loadCheckpointState, saveCheckpointState } from "./workflow_reducer";

const KINDS: WorkflowStateKind[] = [
  "pending", "ready", "in_progress", "eval_pending",
  "blocked", "sleeping", "escalated", "done", "failed",
];

function synthState(kind: WorkflowStateKind): WorkflowStateCamel {
  return {
    kind,
    round: 2,
    roundMax: 5,
    lastFeedback: `feedback for ${kind}`,
    blocker: kind === "blocked" ? `blocked reason for ${kind}` : null,
    escalationKind: kind === "escalated" ? "E2" : null,
    wakeupAt: kind === "sleeping" ? "2026-05-01T00:00:00.000Z" : null,
    wakeupMechanism: kind === "sleeping" ? "one-shot" : null,
    failureReason: kind === "failed" ? `failure reason for ${kind}` : null,
    graphPosition: `node-for-${kind}`,
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function main(): void {
  const tmpRoot = process.argv[2] ?? path.join(os.tmpdir(), `pj03-restore-${Date.now()}`);
  fs.mkdirSync(path.join(tmpRoot, "checkpoints"), { recursive: true });
  console.log(`[restore-test] tmpRoot=${tmpRoot}`);

  let failures = 0;
  for (const kind of KINDS) {
    const taskId = `SYN-${kind}`;
    const original = synthState(kind);

    saveCheckpointState(tmpRoot, taskId, original);
    const restored = loadCheckpointState(tmpRoot, taskId);

    if (!deepEqual(original, restored)) {
      failures++;
      console.error(`[FAIL] ${kind}:`);
      console.error(`  original: ${JSON.stringify(original)}`);
      console.error(`  restored: ${JSON.stringify(restored)}`);
      continue;
    }

    // 個別 field 欠落チェック（冗長だが明示的に）
    const fields: Array<keyof WorkflowStateCamel> = [
      "kind", "round", "roundMax", "lastFeedback", "blocker",
      "escalationKind", "wakeupAt", "wakeupMechanism", "failureReason",
      "graphPosition",
    ];
    for (const f of fields) {
      if (original[f] !== restored[f]) {
        failures++;
        console.error(`[FAIL] ${kind}.${f}: original=${JSON.stringify(original[f])}, restored=${JSON.stringify(restored[f])}`);
      }
    }

    console.log(`[PASS] ${kind}: round-trip preserved all 9 fields`);
  }

  if (failures > 0) {
    console.error(`\n[RESTORE TEST] FAIL (${failures} field mismatches across ${KINDS.length} states)`);
    process.exit(1);
  }
  console.log(`\n[RESTORE TEST] PASS — all ${KINDS.length} states round-trip with full invariant preservation (10 fields incl. graphPosition)`);
}

main();
