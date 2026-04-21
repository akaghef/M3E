/**
 * T-3-2 test — workflow_scope_projector 動作検証
 *
 * 検査:
 *  1. projectTasks が read-only（入力ファイルを変更しない）
 *  2. 出力 AppState が beta/src/shared/types.ts の TreeNode shape に準拠
 *  3. workflow.* attribute が全 task node に付与される
 *  4. root node が breakdown 集計を含む
 *  5. deterministic (同じ入力で同じ出力)
 *  6. blocked task の note に "BLOCKER:" が入る
 *  7. sleeping task の attribute に wakeup_at が入る
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { projectTasks } from "./workflow_scope_projector";
import { saveCheckpointState } from "./workflow_reducer";
import type { WorkflowStateCamel } from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log(`  [PASS] ${msg}`);
  else { failures++; console.error(`  [FAIL] ${msg}`); }
}

function makeTempPj(entries: Array<{ id: string; phase?: number; linked_review?: string | null; deps?: string[] }>): { tasks: string; runtime: string } {
  const root = path.join(os.tmpdir(), `pj03-t32-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, "runtime", "checkpoints"), { recursive: true });
  const tasksFile = path.join(root, "tasks.yaml");
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`- id: ${e.id}`);
    lines.push(`  phase: ${e.phase ?? 0}`);
    lines.push(`  verb: test`);
    lines.push(`  target: "${e.id}-target"`);
    lines.push(`  done_when: ["cond1", "cond2"]`);
    lines.push(`  eval_required: true`);
    lines.push(`  eval_criteria: ["c1"]`);
    lines.push(`  round_max: 3`);
    lines.push(`  dependencies: ${JSON.stringify(e.deps ?? [])}`);
    lines.push(`  linked_review: ${e.linked_review ? JSON.stringify(e.linked_review) : "null"}`);
    lines.push("");
  }
  fs.writeFileSync(tasksFile, lines.join("\n"), "utf8");
  return { tasks: tasksFile, runtime: path.join(root, "runtime") };
}

function s(kind: WorkflowStateKind, overrides: Partial<WorkflowStateCamel> = {}): WorkflowStateCamel {
  return {
    kind, round: 0, roundMax: 3,
    lastFeedback: null, blocker: null,
    escalationKind: null, wakeupAt: null, wakeupMechanism: null, failureReason: null,
    ...overrides,
  };
}

function test1_readOnly(): void {
  console.log("test 1: projectTasks は read-only");
  const { tasks, runtime } = makeTempPj([{ id: "T-A" }]);
  saveCheckpointState(runtime, "T-A", s("done", { round: 1, lastFeedback: "ok" }));
  const beforeTasks = fs.readFileSync(tasks, "utf8");
  const beforeCp = fs.readFileSync(path.join(runtime, "checkpoints", "T-A.json"), "utf8");
  projectTasks(tasks, runtime);
  const afterTasks = fs.readFileSync(tasks, "utf8");
  const afterCp = fs.readFileSync(path.join(runtime, "checkpoints", "T-A.json"), "utf8");
  assert(beforeTasks === afterTasks, "tasks.yaml unchanged");
  assert(beforeCp === afterCp, "checkpoint JSON unchanged");
}

function test2_treeNodeShape(): void {
  console.log("test 2: AppState / TreeNode shape");
  const { tasks, runtime } = makeTempPj([{ id: "T-B", phase: 1 }]);
  saveCheckpointState(runtime, "T-B", s("ready"));
  const app = projectTasks(tasks, runtime);
  assert(app.rootId === "root", "rootId = root");
  assert(!!app.nodes["root"], "root node exists");
  assert(!!app.nodes["task:T-B"], "task:T-B node exists");
  const t = app.nodes["task:T-B"]!;
  assert(t.parentId === "root", "parentId = root");
  assert(t.nodeType === "text", "nodeType = text");
  assert(typeof t.text === "string" && t.text.length > 0, "text non-empty");
  assert(typeof t.collapsed === "boolean", "collapsed is boolean");
  assert(typeof t.link === "string", "link is string");
  assert(!!t.attributes, "attributes object");
  assert(Array.isArray(t.children), "children is array");
}

function test3_workflowAttrs(): void {
  console.log("test 3: workflow.* attributes");
  const { tasks, runtime } = makeTempPj([{ id: "T-C", linked_review: "Qn_test", deps: ["T-A"] }]);
  saveCheckpointState(runtime, "T-C", s("in_progress", { round: 2, lastFeedback: "ongoing" }));
  const app = projectTasks(tasks, runtime);
  const t = app.nodes["task:T-C"]!;
  assert(t.attributes["workflow.kind"] === "in_progress", "kind");
  assert(t.attributes["workflow.round"] === "2", "round");
  assert(t.attributes["workflow.round_max"] === "3", "round_max");
  assert(t.attributes["workflow.phase"] === "0", "phase");
  assert(t.attributes["workflow.last_feedback"] === "ongoing", "last_feedback");
  assert(t.attributes["workflow.linked_review"] === "Qn_test", "linked_review");
  assert(t.attributes["workflow.dependencies"] === "T-A", "dependencies comma-separated");
  assert(t.attributes["workflow.eval_required"] === "true", "eval_required");
  assert(typeof t.attributes["workflow.next_signal"] === "string", "next_signal present");
}

function test4_rootBreakdown(): void {
  console.log("test 4: root node attributes contain breakdown");
  const { tasks, runtime } = makeTempPj([
    { id: "T-1" }, { id: "T-2" }, { id: "T-3" },
  ]);
  saveCheckpointState(runtime, "T-1", s("done"));
  saveCheckpointState(runtime, "T-2", s("done"));
  saveCheckpointState(runtime, "T-3", s("blocked", { blocker: "stuck" }));
  const app = projectTasks(tasks, runtime);
  const r = app.nodes["root"]!;
  assert(r.attributes["workflow.total"] === "3", "total = 3");
  assert(r.attributes["workflow.count.done"] === "2", "done count = 2");
  assert(r.attributes["workflow.count.blocked"] === "1", "blocked count = 1");
  assert(r.children.length === 3, "root has 3 children");
  assert(r.nodeType === "folder", "root is folder");
}

function test5_deterministic(): void {
  console.log("test 5: deterministic");
  const { tasks, runtime } = makeTempPj([{ id: "T-D" }]);
  saveCheckpointState(runtime, "T-D", s("ready"));
  const a1 = projectTasks(tasks, runtime);
  const a2 = projectTasks(tasks, runtime);
  assert(JSON.stringify(a1) === JSON.stringify(a2), "same input → same output");
}

function test6_blockedNote(): void {
  console.log("test 6: blocked task note contains BLOCKER:");
  const { tasks, runtime } = makeTempPj([{ id: "T-E" }]);
  saveCheckpointState(runtime, "T-E", s("blocked", { blocker: "waiting for human" }));
  const app = projectTasks(tasks, runtime);
  const t = app.nodes["task:T-E"]!;
  assert(t.note.includes("BLOCKER: waiting for human"), "note has BLOCKER prefix");
  assert(t.attributes["workflow.blocker"] === "waiting for human", "attribute.blocker");
}

function test7_sleepingAttrs(): void {
  console.log("test 7: sleeping task attributes");
  const { tasks, runtime } = makeTempPj([{ id: "T-F" }]);
  saveCheckpointState(runtime, "T-F", s("sleeping", {
    wakeupAt: "2026-05-01T12:00:00.000Z",
    wakeupMechanism: "cron",
  }));
  const app = projectTasks(tasks, runtime);
  const t = app.nodes["task:T-F"]!;
  assert(t.attributes["workflow.wakeup_at"] === "2026-05-01T12:00:00.000Z", "wakeup_at");
  assert(t.attributes["workflow.wakeup_mechanism"] === "cron", "wakeup_mechanism");
  assert(t.note.includes("WAKEUP: 2026-05-01T12:00:00.000Z"), "note has WAKEUP prefix");
}

function main(): void {
  test1_readOnly();
  test2_treeNodeShape();
  test3_workflowAttrs();
  test4_rootBreakdown();
  test5_deterministic();
  test6_blockedNote();
  test7_sleepingAttrs();
  if (failures > 0) {
    console.error(`\n[T-3-2 TEST] FAIL (${failures})`);
    process.exit(1);
  }
  console.log(`\n[T-3-2 TEST] PASS — scope projector validated (read-only + shape + namespace + deterministic)`);
}

main();
