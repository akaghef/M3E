/**
 * T-2-4 dogfood_run_02 — sleeping / escalated / failed の実稼働観察
 *
 * Phase 1.5 で未観察だった 3 停止カテゴリを、本物の reducer + checkpoint JSON
 * + Clock / ReviewResolver を使って実走行させ、観察結果を記録する。
 *
 * mock test ではなく実稼働: 本モジュール自体が CLI と同じ API 経由で動く。
 * 結果は stdout に dump し、Manager が artifacts/dogfood_run_02.md に転記する。
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { AdvanceableClock, FixedClock } from "../shared/clock";
import { ReviewResolver } from "../shared/resolvers";
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

function setupPj(entries: Array<{ id: string; linked_review?: string | null }>): { ctx: ReducerContext; reviewsDir: string } {
  const root = path.join(os.tmpdir(), `pj03-dogfood-02-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, "runtime", "checkpoints"), { recursive: true });
  fs.mkdirSync(path.join(root, "reviews"), { recursive: true });
  const tasksFile = path.join(root, "tasks.yaml");
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`- id: ${e.id}`);
    lines.push(`  phase: 2`);
    lines.push(`  verb: observe`);
    lines.push(`  target: "${e.id} transition"`);
    lines.push(`  done_when: ["observed"]`);
    lines.push(`  eval_required: false`);
    lines.push(`  round_max: 3`);
    lines.push(`  dependencies: []`);
    lines.push(`  linked_review: ${e.linked_review ? JSON.stringify(e.linked_review) : "null"}`);
    lines.push("");
  }
  fs.writeFileSync(tasksFile, lines.join("\n"), "utf8");
  const ctx: ReducerContext = {
    tasksFile,
    runtimeDir: path.join(root, "runtime"),
    cheatsheetFile: "",
    dryRun: false,
  };
  return { ctx, reviewsDir: path.join(root, "reviews") };
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

function obs(label: string, before: WorkflowStateCamel, after: WorkflowStateCamel, edge?: string): void {
  console.log(`== ${label} ==`);
  console.log(`  before: kind=${before.kind} round=${before.round} blocker=${JSON.stringify(before.blocker)} escalation=${before.escalationKind} wakeup=${before.wakeupAt}`);
  console.log(`  after:  kind=${after.kind} round=${after.round} blocker=${JSON.stringify(after.blocker)} escalation=${after.escalationKind} wakeup=${after.wakeupAt} failure=${after.failureReason}`);
  if (edge) console.log(`  edge:   ${edge}`);
  console.log();
}

function observeSleeping(): void {
  console.log("=== SCENARIO 1: sleeping (E08 → E09) ===\n");
  const taskId = "T-DF-SLEEP";
  const { ctx } = setupPj([{ id: taskId }]);

  // pending → ready (via tick, deps empty)
  saveCheckpointState(ctx.runtimeDir, taskId, freshState("pending"));
  const nullReview: ReviewResolver = { resolve: () => "unknown" };
  const clock = new AdvanceableClock(new Date("2026-06-01T10:00:00.000Z"));
  const depR = new TasksFileDependencyResolver(ctx.tasksFile, ctx.runtimeDir);
  tickAutoTransitions(ctx, { clock, depResolver: depR, reviewResolver: nullReview });

  // ready → in_progress
  runOneStep(ctx, { taskId, signal: { kind: "dispatch_generator" } }, { clock });

  // in_progress → sleeping (E08) with wakeup 15 min later
  const before = loadCheckpointState(ctx.runtimeDir, taskId);
  const wakeupAt = new Date(clock.now().getTime() + 15 * 60 * 1000).toISOString();
  runOneStep(ctx, { taskId, signal: { kind: "schedule_wakeup", wakeupAt, mechanism: "one-shot" } }, { clock });
  let after = loadCheckpointState(ctx.runtimeDir, taskId);
  obs("E08 in_progress → sleeping", before, after, "E08");

  // advance clock past wakeup
  clock.advance(16 * 60 * 1000);

  // tick: sleeping → ready (E09)
  const before2 = loadCheckpointState(ctx.runtimeDir, taskId);
  const depR2 = new TasksFileDependencyResolver(ctx.tasksFile, ctx.runtimeDir);
  const r = tickAutoTransitions(ctx, { clock, depResolver: depR2, reviewResolver: nullReview });
  after = loadCheckpointState(ctx.runtimeDir, taskId);
  obs(`E09 sleeping → ready (${r.transitions.length} transitions)`, before2, after, r.transitions.find(t => t.taskId === taskId)?.edge);
}

function observeEscalated(): void {
  console.log("=== SCENARIO 2: escalated (E10 → E12 via review resolved) ===\n");
  const taskId = "T-DF-ESC";
  const { ctx, reviewsDir } = setupPj([{ id: taskId, linked_review: "Qn_dogfood_esc" }]);
  saveCheckpointState(ctx.runtimeDir, taskId, freshState("pending"));
  const clock = new FixedClock(new Date("2026-06-01T10:00:00.000Z"));

  // review を open で作成
  const reviewPath = path.join(reviewsDir, "Qn_dogfood_esc.md");
  fs.writeFileSync(reviewPath, `# Qn_dogfood_esc\n\n- **status**: open\n`, "utf8");
  const reviewResolver: ReviewResolver = {
    resolve: (id: string) => {
      const p = path.join(reviewsDir, `${id}.md`);
      if (!fs.existsSync(p)) return "unknown";
      const t = fs.readFileSync(p, "utf8");
      if (/resolved/.test(t)) return "resolved";
      if (/rejected/.test(t)) return "rejected";
      return "open";
    },
  };

  // pending → ready → in_progress
  const depR = new TasksFileDependencyResolver(ctx.tasksFile, ctx.runtimeDir);
  tickAutoTransitions(ctx, { clock, depResolver: depR, reviewResolver });
  runOneStep(ctx, { taskId, signal: { kind: "dispatch_generator" } }, { clock });

  // in_progress → escalated (E10)
  const b1 = loadCheckpointState(ctx.runtimeDir, taskId);
  runOneStep(ctx, { taskId, signal: { kind: "escalation_detected", escalation: "E2" } }, { clock });
  let a1 = loadCheckpointState(ctx.runtimeDir, taskId);
  obs("E10 in_progress → escalated (E2 env break)", b1, a1, "E10");

  // review を resolved に
  fs.writeFileSync(reviewPath, `# Qn_dogfood_esc\n\n- **status**: resolved\n`, "utf8");

  // tick: escalated + linked_review resolved → ready (E12)
  const b2 = loadCheckpointState(ctx.runtimeDir, taskId);
  const depR2 = new TasksFileDependencyResolver(ctx.tasksFile, ctx.runtimeDir);
  const r = tickAutoTransitions(ctx, { clock, depResolver: depR2, reviewResolver });
  const a2 = loadCheckpointState(ctx.runtimeDir, taskId);
  obs(`E12 escalated → ready via linked_review resolved (${r.transitions.length} transitions)`, b2, a2, r.transitions.find(t => t.taskId === taskId)?.edge);
}

function observeFailed(): void {
  console.log("=== SCENARIO 3: failed (E17 fatal_exception) ===\n");
  const taskId = "T-DF-FAIL";
  const { ctx } = setupPj([{ id: taskId }]);
  saveCheckpointState(ctx.runtimeDir, taskId, freshState("pending"));
  const clock = new FixedClock(new Date("2026-06-01T10:00:00.000Z"));
  const nullReview: ReviewResolver = { resolve: () => "unknown" };

  // pending → ready → in_progress
  const depR = new TasksFileDependencyResolver(ctx.tasksFile, ctx.runtimeDir);
  tickAutoTransitions(ctx, { clock, depResolver: depR, reviewResolver: nullReview });
  runOneStep(ctx, { taskId, signal: { kind: "dispatch_generator" } }, { clock });

  // in_progress → failed (E17)
  const b = loadCheckpointState(ctx.runtimeDir, taskId);
  runOneStep(ctx, { taskId, signal: { kind: "fatal_exception", reason: "simulated runtime crash in dogfood_02" } }, { clock });
  const a = loadCheckpointState(ctx.runtimeDir, taskId);
  obs("E17 in_progress → failed", b, a, "E17");
  console.log(`  failure_reason persisted: ${JSON.stringify(a.failureReason)}`);
}

function main(): void {
  observeSleeping();
  observeEscalated();
  observeFailed();
  console.log("=== dogfood_run_02 complete ===");
}

main();
