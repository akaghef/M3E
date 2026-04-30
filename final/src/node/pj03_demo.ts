/**
 * PJ03 demo runner
 *
 * 目的:
 *   - idea/demo_skeleton.md の live demo 導線を 1 本の CLI に束ねる
 *   - 既存の test / dogfood / projection 実装を再利用し、デモ時の手打ちを減らす
 *
 * 非責務:
 *   - workflow の新規ロジック追加
 *   - dogfood シナリオ自体の再実装
 */

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

import { loadAllTaskViews } from "./workflow_reducer";

type DemoMode = "preflight" | "core" | "scope" | "full";

interface DemoArgs {
  mode: DemoMode;
  tasksFile: string;
  runtimeDir: string;
  reviewsDir: string;
  artifactsDir: string;
  sampleTaskId: string;
}

interface DemoStep {
  label: string;
  script: string;
  args?: string[];
}

function repoRootFromHere(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function defaultArgs(): DemoArgs {
  const repoRoot = repoRootFromHere();
  return {
    mode: "full",
    tasksFile: path.join(repoRoot, "projects", "PJ03_SelfDrive", "tasks.yaml"),
    runtimeDir: path.join(repoRoot, "projects", "PJ03_SelfDrive", "runtime"),
    reviewsDir: path.join(repoRoot, "projects", "PJ03_SelfDrive", "reviews"),
    artifactsDir: path.join(repoRoot, "projects", "PJ03_SelfDrive", "artifacts"),
    sampleTaskId: "T-3-4",
  };
}

function parseArgs(argv: string[]): DemoArgs {
  const out = defaultArgs();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") out.mode = argv[++i] as DemoMode;
    else if (a === "--tasks") out.tasksFile = path.resolve(argv[++i]);
    else if (a === "--runtime") out.runtimeDir = path.resolve(argv[++i]);
    else if (a === "--reviews") out.reviewsDir = path.resolve(argv[++i]);
    else if (a === "--artifacts") out.artifactsDir = path.resolve(argv[++i]);
    else if (a === "--sample-task") out.sampleTaskId = argv[++i];
  }
  return out;
}

function heading(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function runNodeScript(step: DemoStep): string {
  const stdout = execFileSync(process.execPath, [step.script, ...(step.args ?? [])], {
    cwd: repoRootFromHere(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  console.log(stdout.trimEnd());
  return stdout;
}

function preflightSteps(): DemoStep[] {
  const dist = path.resolve(__dirname);
  return [
    { label: "checkpoint_restore_test", script: path.join(dist, "checkpoint_restore_test.js") },
    { label: "clock_resolver_test", script: path.join(dist, "clock_resolver_test.js") },
    { label: "clock_daemon_test", script: path.join(dist, "clock_daemon_test.js") },
    { label: "workflow_orchestrator_test", script: path.join(dist, "workflow_orchestrator_test.js") },
    { label: "workflow_scope_projector_test", script: path.join(dist, "workflow_scope_projector_test.js") },
  ];
}

function runPreflight(): void {
  heading("Preflight");
  for (const step of preflightSteps()) {
    console.log(`-- ${step.label}`);
    runNodeScript(step);
  }
}

function showCurrentSummary(tasksFile: string, runtimeDir: string): void {
  heading("Current Workflow Summary");
  const views = loadAllTaskViews(tasksFile, runtimeDir);
  const counts: Record<string, number> = {};
  for (const view of views) {
    counts[view.state.kind] = (counts[view.state.kind] ?? 0) + 1;
  }
  const summary = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, count]) => `${kind}=${count}`)
    .join(", ");
  console.log(`tasks: ${views.length}`);
  console.log(`breakdown: ${summary}`);

  const next = views.find((view) => view.state.kind !== "done" && view.state.kind !== "failed");
  if (next) {
    console.log(`next non-terminal: ${next.contract.id} (${next.state.kind})`);
  } else {
    console.log("next non-terminal: (none)");
  }
}

function showSampleCheckpoint(runtimeDir: string, taskId: string): void {
  heading(`Checkpoint Sample (${taskId})`);
  const file = path.join(runtimeDir, "checkpoints", `${taskId}.json`);
  if (!fs.existsSync(file)) {
    console.log(`missing checkpoint: ${file}`);
    return;
  }
  console.log(fs.readFileSync(file, "utf8").trimEnd());
}

function runDogfood02(): void {
  heading("Core Demo: dogfood_run_02");
  const script = path.resolve(__dirname, "dogfood_run_02.js");
  runNodeScript({ label: "dogfood_run_02", script });
}

function runDogfood03(tasksFile: string, runtimeDir: string, artifactsDir: string): void {
  heading("Scope Projection: dogfood_run_03");
  fs.mkdirSync(artifactsDir, { recursive: true });
  const outFile = path.join(artifactsDir, "workflow_scope_snapshot.json");
  const script = path.resolve(__dirname, "dogfood_run_03.js");
  runNodeScript({
    label: "dogfood_run_03",
    script,
    args: [tasksFile, runtimeDir, outFile],
  });
}

function printUsage(): void {
  console.error("usage: pj03_demo [--mode preflight|core|scope|full] [--tasks <tasks.yaml>] [--runtime <runtimeDir>] [--reviews <reviewsDir>] [--artifacts <artifactsDir>] [--sample-task <id>]");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!["preflight", "core", "scope", "full"].includes(args.mode)) {
    printUsage();
    process.exit(2);
  }

  console.log("PJ03 Demo Runner");
  console.log(`mode=${args.mode}`);
  console.log(`tasks=${args.tasksFile}`);
  console.log(`runtime=${args.runtimeDir}`);
  console.log(`reviews=${args.reviewsDir}`);
  console.log(`artifacts=${args.artifactsDir}`);

  if (args.mode === "preflight" || args.mode === "full") {
    runPreflight();
  }

  if (args.mode === "core" || args.mode === "full") {
    showCurrentSummary(args.tasksFile, args.runtimeDir);
    showSampleCheckpoint(args.runtimeDir, args.sampleTaskId);
    runDogfood02();
  }

  if (args.mode === "scope" || args.mode === "full") {
    runDogfood03(args.tasksFile, args.runtimeDir, args.artifactsDir);
  }

  heading("Done");
  console.log("PJ03 demo path completed.");
}

main();
