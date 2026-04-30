/**
 * T-2-1 test — Clock daemon 動作検証
 *
 * 検査:
 *  1. runDaemonTick が tickAutoTransitions を正しく委譲
 *  2. planWakeups が sleeping task の wakeup_at に応じた plan を返す
 *  3. overdue task は "overdue" kind として報告される
 *  4. wakeupMechanism=cron は cronCreate に分類される
 *  5. idempotent: tick を連続呼び出ししても state が壊れない
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { FixedClock } from "../shared/clock";
import { ReviewResolver } from "../shared/resolvers";
import { planWakeups, runDaemonTick } from "./clock_daemon";
import {
  ReducerContext,
  loadCheckpointState,
  saveCheckpointState,
} from "./workflow_reducer";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log(`  [PASS] ${msg}`);
  else { failures++; console.error(`  [FAIL] ${msg}`); }
}

function makeTempPj() {
  const root = path.join(os.tmpdir(), `pj03-t21-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, "runtime", "checkpoints"), { recursive: true });
  fs.mkdirSync(path.join(root, "reviews"), { recursive: true });
  const tasks = path.join(root, "tasks.yaml");
  return { root, tasks, runtime: path.join(root, "runtime") };
}

function writeTasks(tasksFile: string, entries: Array<{ id: string; deps?: string[]; linked_review?: string | null }>): void {
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`- id: ${e.id}`);
    lines.push(`  phase: 0`);
    lines.push(`  verb: test`);
    lines.push(`  target: "t"`);
    lines.push(`  done_when: ["d"]`);
    lines.push(`  eval_required: false`);
    lines.push(`  round_max: 3`);
    lines.push(`  dependencies: ${JSON.stringify(e.deps ?? [])}`);
    lines.push(`  linked_review: ${e.linked_review ? JSON.stringify(e.linked_review) : "null"}`);
    lines.push("");
  }
  fs.writeFileSync(tasksFile, lines.join("\n"), "utf8");
}

function stateOf(kind: WorkflowStateKind, overrides: Partial<WorkflowStateCamel> = {}): WorkflowStateCamel {
  return {
    kind, round: 0, roundMax: 3,
    lastFeedback: null, blocker: null,
    escalationKind: null, wakeupAt: null, wakeupMechanism: null, failureReason: null,
    graphPosition: null,
    ...overrides,
  };
}

const nullReviewResolver: ReviewResolver = { resolve: () => "unknown" };

function test1_daemonTickDelegates(): void {
  console.log("test 1: runDaemonTick が tickAutoTransitions に委譲");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-X", deps: [] }]);
  saveCheckpointState(runtime, "T-X", stateOf("pending"));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const clock = new FixedClock(new Date());
  const r = runDaemonTick(ctx, { clock, reviewResolver: nullReviewResolver });
  assert(r.transitions.length === 1, "1 transition (pending deps empty → ready)");
  assert(r.transitions[0]?.edge === "E01", "edge = E01");
  const cp = loadCheckpointState(runtime, "T-X");
  assert(cp.kind === "ready", "state persisted = ready");
}

function test2_planWakeupsOneShot(): void {
  console.log("test 2: planWakeups returns scheduleWakeup for future one-shot");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-Y" }]);
  const wakeupAt = new Date(Date.UTC(2026, 4, 1, 12, 0, 0)).toISOString();
  saveCheckpointState(runtime, "T-Y", stateOf("sleeping", { wakeupAt, wakeupMechanism: "one-shot" }));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const clock = new FixedClock(new Date(Date.UTC(2026, 4, 1, 11, 0, 0))); // 1h before
  const plans = planWakeups(ctx, clock);
  assert(plans.length === 1, "1 plan");
  assert(plans[0]?.kind === "scheduleWakeup", "kind = scheduleWakeup");
  assert(plans[0]?.kind === "scheduleWakeup" && plans[0].delaySeconds === 3600, "delay ≈ 3600s");
}

function test3_planWakeupsOverdue(): void {
  console.log("test 3: planWakeups reports overdue when wakeup_at is past");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-OD" }]);
  saveCheckpointState(runtime, "T-OD", stateOf("sleeping", {
    wakeupAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    wakeupMechanism: "one-shot",
  }));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const clock = new FixedClock(new Date(Date.UTC(2026, 4, 1)));
  const plans = planWakeups(ctx, clock);
  assert(plans.length === 1 && plans[0]?.kind === "overdue", "overdue reported");
  assert(plans[0]?.kind === "overdue" && plans[0].overdueSeconds > 0, "overdueSeconds > 0");
}

function test4_planWakeupsCron(): void {
  console.log("test 4: cron mechanism → cronCreate plan");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-CR" }]);
  saveCheckpointState(runtime, "T-CR", stateOf("sleeping", {
    wakeupAt: new Date(Date.UTC(2026, 6, 1)).toISOString(),
    wakeupMechanism: "cron",
  }));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const clock = new FixedClock(new Date(Date.UTC(2026, 4, 1)));
  const plans = planWakeups(ctx, clock);
  assert(plans.length === 1 && plans[0]?.kind === "cronCreate", "cron → cronCreate");
}

function test5_idempotentTick(): void {
  console.log("test 5: 連続 tick で state が壊れない");
  const { tasks, runtime } = makeTempPj();
  writeTasks(tasks, [{ id: "T-IDEM" }]);
  saveCheckpointState(runtime, "T-IDEM", stateOf("done"));
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const clock = new FixedClock(new Date());
  const r1 = runDaemonTick(ctx, { clock, reviewResolver: nullReviewResolver });
  const r2 = runDaemonTick(ctx, { clock, reviewResolver: nullReviewResolver });
  assert(r1.transitions.length === 0 && r2.transitions.length === 0, "done state: no transitions on either tick");
  const cp = loadCheckpointState(runtime, "T-IDEM");
  assert(cp.kind === "done", "state stays done");
}

function main(): void {
  test1_daemonTickDelegates();
  test2_planWakeupsOneShot();
  test3_planWakeupsOverdue();
  test4_planWakeupsCron();
  test5_idempotentTick();

  if (failures > 0) {
    console.error(`\n[T-2-1 TEST] FAIL (${failures})`);
    process.exit(1);
  }
  console.log(`\n[T-2-1 TEST] PASS — Clock daemon tick + planWakeups validated`);
}

main();
