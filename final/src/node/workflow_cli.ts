/**
 * PJ03 SelfDrive — workflow CLI (T-1-9 split)
 *
 * 責務:
 *   - argv パース
 *   - reducer の library API を呼ぶ薄い wrapper
 *   - stdout / stderr への整形出力と exit code
 *
 * 非責務:
 *   - state transition ロジック (workflow_reducer.ts)
 *   - edge 選択 (workflow_reducer.ts: selectEdge / stepOnce)
 *   - persistence (workflow_reducer.ts: loadCheckpointState / saveCheckpointState)
 */

import * as path from "path";

import {
  ReducerContext,
  StepSignal,
  TasksFileDependencyResolver,
  ReviewsDirReviewResolver,
  loadAllTaskViews,
  pickNextTask,
  runOneStep,
  suggestNextSignal,
  tickAutoTransitions,
} from "./workflow_reducer";
import { SystemClock } from "../shared/clock";

interface CliArgs {
  tasksFile: string;
  runtimeDir: string;
  reviewsDir: string;
  cheatsheetFile: string;
  taskId: string | null;
  signal: string | null;
  dryRun: boolean;
  resume: boolean;
  inspect: boolean;
  tick: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    tasksFile: "",
    runtimeDir: "",
    reviewsDir: "",
    cheatsheetFile: "",
    taskId: null,
    signal: null,
    dryRun: false,
    resume: false,
    inspect: false,
    tick: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tasks") out.tasksFile = argv[++i];
    else if (a === "--runtime") out.runtimeDir = argv[++i];
    else if (a === "--reviews") out.reviewsDir = argv[++i];
    else if (a === "--cheatsheet") out.cheatsheetFile = argv[++i];
    else if (a === "--task") out.taskId = argv[++i];
    else if (a === "--signal") out.signal = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--resume") out.resume = true;
    else if (a === "--inspect") out.inspect = true;
    else if (a === "--tick") out.tick = true;
  }
  return out;
}

function buildSignal(name: string): StepSignal {
  switch (name) {
    case "dependencies_done":     return { kind: "dependencies_done" };
    case "dispatch_generator":    return { kind: "dispatch_generator" };
    case "generator_done_eval":   return { kind: "generator_done", evalRequired: true, objectiveCheckPass: true };
    case "generator_done_noeval": return { kind: "generator_done", evalRequired: false, objectiveCheckPass: true };
    case "evaluator_pass":        return { kind: "evaluator_verdict", pass: true };
    case "evaluator_fail":        return { kind: "evaluator_verdict", pass: false };
    case "blocker_cleared":       return { kind: "blocker_cleared" };
    default: throw new Error(`unknown signal: ${name}`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tasksFile || !args.runtimeDir) {
    console.error("usage: workflow_cli --tasks <tasks.yaml> --runtime <runtimeDir> [--cheatsheet <path>] [--task <id> --signal <name>] [--dry-run] [--inspect] [--resume]");
    process.exit(2);
  }

  if (args.inspect) {
    const views = loadAllTaskViews(args.tasksFile, args.runtimeDir);
    for (const v of views) {
      console.log(`${v.contract.id.padEnd(8)} ${v.state.kind.padEnd(14)} round=${v.state.round}/${v.state.roundMax}${v.state.blocker ? `  blocker=${JSON.stringify(v.state.blocker)}` : ""}`);
    }
    return;
  }

  if (args.tick) {
    if (!args.reviewsDir) {
      console.error("--tick requires --reviews <reviewsDir>");
      process.exit(2);
    }
    const clock = new SystemClock();
    const depResolver = new TasksFileDependencyResolver(args.tasksFile, args.runtimeDir);
    const reviewResolver = new ReviewsDirReviewResolver(args.reviewsDir);
    const ctx: ReducerContext = {
      tasksFile: path.resolve(args.tasksFile),
      runtimeDir: path.resolve(args.runtimeDir),
      cheatsheetFile: args.cheatsheetFile ? path.resolve(args.cheatsheetFile) : "",
      dryRun: args.dryRun,
    };
    const r = tickAutoTransitions(ctx, { clock, depResolver, reviewResolver });
    if (r.transitions.length === 0) {
      console.log(`TICK: no auto transitions fired (dryRun=${args.dryRun})`);
    } else {
      for (const t of r.transitions) {
        console.log(`TICK: ${t.taskId}: ${t.from} -> ${t.to} (edge=${t.edge}, trigger=${t.trigger}, dryRun=${args.dryRun})`);
      }
    }
    return;
  }

  if (args.resume) {
    const depResolver = new TasksFileDependencyResolver(args.tasksFile, args.runtimeDir);
    const next = pickNextTask(args.tasksFile, args.runtimeDir, depResolver);
    if (!next) { console.log("RESUME: no next task (all terminal/blocked). E1 candidate."); return; }
    console.log(`RESUME: ${next.contract.id} state=${next.state.kind} round=${next.state.round}/${next.state.roundMax}`);
    console.log(`  last_feedback: ${next.state.lastFeedback ?? "(none)"}`);
    console.log(`  blocker: ${next.state.blocker ?? "(none)"}`);
    console.log(`  escalation_kind: ${next.state.escalationKind ?? "(none)"}`);
    console.log(`  wakeup_at: ${next.state.wakeupAt ?? "(none)"}`);
    console.log(`  expected next signal class: ${suggestNextSignal(next.state.kind)}`);
    return;
  }

  if (!args.taskId || !args.signal) {
    console.error("require --task and --signal (or --inspect / --resume)");
    process.exit(2);
  }
  const ctx: ReducerContext = {
    tasksFile: path.resolve(args.tasksFile),
    runtimeDir: path.resolve(args.runtimeDir),
    cheatsheetFile: args.cheatsheetFile ? path.resolve(args.cheatsheetFile) : "",
    dryRun: args.dryRun,
  };
  const reviewResolver = args.reviewsDir
    ? new ReviewsDirReviewResolver(args.reviewsDir)
    : undefined;
  const out = runOneStep(
    ctx,
    { taskId: args.taskId, signal: buildSignal(args.signal) },
    { clock: new SystemClock(), reviewResolver },
  );
  if (out.rejected) {
    console.error(`REJECTED: ${out.rejectionReason}`);
    process.exit(1);
  }
  console.log(`${out.taskId}: ${out.fromState.kind} -> ${out.nextState?.kind} (edge=${out.edge?.id}, wrote=${out.wrote}, dryRun=${ctx.dryRun})`);
}

if (require.main === module) {
  main();
}
