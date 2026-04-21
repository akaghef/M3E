/**
 * T-1-10 test — Clock / Resolver injection 検証
 *
 * 検査項目:
 *  1. FixedClock で sleeping → ready の自動遷移 (E09)
 *  2. AdvanceableClock で時刻進行前後の挙動差
 *  3. Dependency cycle detection が明示 Error を throw
 *  4. linked_review open で E12 (human_approve) が reject される
 *  5. linked_review resolved で E15 (blocker_cleared) が自動発火
 *  6. restore test (T-1-8) が依然として pass (regression 防止)
 *
 * 使用: node dist/node/clock_resolver_test.js
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AdvanceableClock, FixedClock } from "../shared/clock";
import {
  DependencyResolver,
  ReviewResolver,
  ReviewResolution,
  detectDependencyCycles,
} from "../shared/resolvers";
import {
  ReducerContext,
  TasksFileDependencyResolver,
  loadCheckpointState,
  runOneStep,
  saveCheckpointState,
  tickAutoTransitions,
} from "./workflow_reducer";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) { console.log(`  [PASS] ${msg}`); }
  else { failures++; console.error(`  [FAIL] ${msg}`); }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTempPj(): { root: string; tasks: string; runtime: string; reviewsDir: string } {
  const root = path.join(os.tmpdir(), `pj03-t110-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const runtime = path.join(root, "runtime");
  const reviewsDir = path.join(root, "reviews");
  fs.mkdirSync(path.join(runtime, "checkpoints"), { recursive: true });
  fs.mkdirSync(reviewsDir, { recursive: true });
  const tasks = path.join(root, "tasks.yaml");
  return { root, tasks, runtime, reviewsDir };
}

function writeTasksYaml(tasksFile: string, entries: Array<{ id: string; deps?: string[]; linked_review?: string | null }>): void {
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
    lines.push(`  linked_review: ${e.linked_review === undefined ? "null" : (e.linked_review === null ? "null" : JSON.stringify(e.linked_review))}`);
    lines.push("");
  }
  fs.writeFileSync(tasksFile, lines.join("\n"), "utf8");
}

function freshState(kind: WorkflowStateKind, overrides: Partial<WorkflowStateCamel> = {}): WorkflowStateCamel {
  return {
    kind, round: 0, roundMax: 3,
    lastFeedback: null, blocker: null,
    escalationKind: null, wakeupAt: null, wakeupMechanism: null, failureReason: null,
    graphPosition: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function testFixedClockSleepingToReady(): void {
  console.log("test 1: FixedClock で sleeping → ready (E09)");
  const { tasks, runtime } = makeTempPj();
  writeTasksYaml(tasks, [{ id: "T-X" }]);
  const wakeupAt = "2026-05-01T12:00:00.000Z";

  // T-X を sleeping 状態で保存
  saveCheckpointState(runtime, "T-X", freshState("sleeping", {
    wakeupAt,
    wakeupMechanism: "one-shot",
  }));

  // clock が wakeup 前: tick で何も起きない
  const beforeClock = new FixedClock(new Date("2026-05-01T11:59:59.000Z"));
  const depResolver = new TasksFileDependencyResolver(tasks, runtime);
  const reviewResolver: ReviewResolver = { resolve: () => "unknown" };
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const t1 = tickAutoTransitions(ctx, { clock: beforeClock, depResolver, reviewResolver });
  assert(t1.transitions.length === 0, "wakeup 前は遷移なし");

  // clock が wakeup 時: tick で E09 が発火
  const afterClock = new FixedClock(new Date("2026-05-01T12:00:00.000Z"));
  const depResolver2 = new TasksFileDependencyResolver(tasks, runtime); // re-read
  const t2 = tickAutoTransitions(ctx, { clock: afterClock, depResolver: depResolver2, reviewResolver });
  assert(t2.transitions.length === 1, "wakeup 時に 1 遷移");
  assert(t2.transitions[0]?.edge === "E09", "edge = E09");
  assert(t2.transitions[0]?.to === "ready", "sleeping → ready");

  const after = loadCheckpointState(runtime, "T-X");
  assert(after.kind === "ready", "checkpoint state = ready");
  assert(after.wakeupAt === null, "wakeupAt reset to null");
}

function testAdvanceableClock(): void {
  console.log("test 2: AdvanceableClock の advance 前後");
  const { tasks, runtime } = makeTempPj();
  writeTasksYaml(tasks, [{ id: "T-Y" }]);
  saveCheckpointState(runtime, "T-Y", freshState("sleeping", {
    wakeupAt: "2026-06-01T00:00:00.000Z",
    wakeupMechanism: "cron",
  }));
  const clock = new AdvanceableClock(new Date("2026-05-31T23:00:00.000Z"));
  const depResolver = new TasksFileDependencyResolver(tasks, runtime);
  const reviewResolver: ReviewResolver = { resolve: () => "unknown" };
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };

  const r1 = tickAutoTransitions(ctx, { clock, depResolver, reviewResolver });
  assert(r1.transitions.length === 0, "advance 前は遷移なし");
  clock.advance(60 * 60 * 1000 + 1); // 1h + 1ms
  const depResolver2 = new TasksFileDependencyResolver(tasks, runtime);
  const r2 = tickAutoTransitions(ctx, { clock, depResolver: depResolver2, reviewResolver });
  assert(r2.transitions.length === 1, "advance 後に遷移");
}

function testCycleDetection(): void {
  console.log("test 3: Dependency cycle detection");
  const { tasks, runtime } = makeTempPj();
  writeTasksYaml(tasks, [
    { id: "T-A", deps: ["T-B"] },
    { id: "T-B", deps: ["T-C"] },
    { id: "T-C", deps: ["T-A"] },
  ]);
  for (const id of ["T-A", "T-B", "T-C"]) {
    saveCheckpointState(runtime, id, freshState("pending"));
  }
  const depResolver = new TasksFileDependencyResolver(tasks, runtime);
  const reviewResolver: ReviewResolver = { resolve: () => "unknown" };
  const clock = new FixedClock(new Date());
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };

  let caught: Error | null = null;
  try {
    tickAutoTransitions(ctx, { clock, depResolver, reviewResolver });
  } catch (e) {
    caught = e as Error;
  }
  assert(caught !== null, "cycle で Error throw");
  assert(!!caught && /cycle detected/.test(caught.message), "エラーメッセージに 'cycle detected'");
}

function testLinkedReviewOpenBlocksApprove(): void {
  console.log("test 4: linked_review open が E12 (human_approve) を reject");
  const { tasks, runtime, reviewsDir } = makeTempPj();
  writeTasksYaml(tasks, [{ id: "T-Z", linked_review: "Qn_test" }]);
  saveCheckpointState(runtime, "T-Z", freshState("escalated", {
    escalationKind: "E1",
  }));
  fs.writeFileSync(path.join(reviewsDir, "Qn_test.md"), `# Qn_test\n\n- **status**: open\n`, "utf8");

  const reviewResolver: ReviewResolver = {
    resolve: (id: string): ReviewResolution => {
      const p = path.join(reviewsDir, `${id}.md`);
      if (!fs.existsSync(p)) return "unknown";
      const text = fs.readFileSync(p, "utf8");
      if (/status[\*\s:]*open/i.test(text)) return "open";
      if (/status[\*\s:]*resolved/i.test(text)) return "resolved";
      return "unknown";
    },
  };
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };
  const out = runOneStep(ctx, { taskId: "T-Z", signal: { kind: "human_approve" } }, { reviewResolver });
  assert(out.rejected === true, "human_approve が reject");
  assert(out.rejectionReason?.includes("linked_review") === true, "reject reason に linked_review 言及");

  // resolve に変更するとパス
  fs.writeFileSync(path.join(reviewsDir, "Qn_test.md"), `# Qn_test\n\n- **status**: resolved\n`, "utf8");
  const out2 = runOneStep(ctx, { taskId: "T-Z", signal: { kind: "human_approve" } }, { reviewResolver });
  assert(out2.rejected === false, "resolved 後は human_approve OK");
  assert(out2.edge?.id === "E12", "edge = E12");
  assert(out2.nextState?.kind === "ready", "→ ready");
}

function testLinkedReviewAutoClears(): void {
  console.log("test 5: linked_review resolved で blocked → ready 自動 (E15)");
  const { tasks, runtime, reviewsDir } = makeTempPj();
  writeTasksYaml(tasks, [{ id: "T-W", linked_review: "Qn_x" }]);
  saveCheckpointState(runtime, "T-W", freshState("blocked", {
    blocker: "waiting for Qn_x",
  }));
  fs.writeFileSync(path.join(reviewsDir, "Qn_x.md"), `- **status**: resolved\n`, "utf8");
  const reviewResolver: ReviewResolver = {
    resolve: (id: string): ReviewResolution => {
      const p = path.join(reviewsDir, `${id}.md`);
      if (!fs.existsSync(p)) return "unknown";
      const text = fs.readFileSync(p, "utf8");
      if (/resolved/.test(text)) return "resolved";
      return "open";
    },
  };
  const depResolver = new TasksFileDependencyResolver(tasks, runtime);
  const clock = new FixedClock(new Date());
  const ctx: ReducerContext = { tasksFile: tasks, runtimeDir: runtime, cheatsheetFile: "", dryRun: false };

  const r = tickAutoTransitions(ctx, { clock, depResolver, reviewResolver });
  assert(r.transitions.length === 1, "1 遷移");
  assert(r.transitions[0]?.edge === "E15", "edge = E15");
  assert(r.transitions[0]?.to === "ready", "blocked → ready");
  const after = loadCheckpointState(runtime, "T-W");
  assert(after.blocker === null, "blocker cleared");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main(): void {
  testFixedClockSleepingToReady();
  testAdvanceableClock();
  testCycleDetection();
  testLinkedReviewOpenBlocksApprove();
  testLinkedReviewAutoClears();

  if (failures > 0) {
    console.error(`\n[T-1-10 TEST] FAIL (${failures} assertions)`);
    process.exit(1);
  }
  console.log(`\n[T-1-10 TEST] PASS — Clock / Resolver / cycle / linked_review all validated`);
}

main();
