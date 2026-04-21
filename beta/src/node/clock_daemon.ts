/**
 * PJ03 SelfDrive — Clock daemon (T-2-1)
 *
 * 責務:
 *   - reducer の tickAutoTransitions を定期実行する wrapper
 *   - sleeping state の task について、wakeup_at に基づく ScheduleWakeup 指示を生成
 *   - CronCreate による長周期 tick 指示を生成
 *
 * 非責務:
 *   - state 遷移そのもの (reducer)
 *   - subagent dispatch (orchestrator, T-2-2)
 *   - 実際の ScheduleWakeup / CronCreate API 呼び出し (Claude Code runtime が担う)
 *
 * 本モジュールは:
 *  - 純粋関数 runDaemonTick で 1 回分の tick を実行し、副作用は reducer 経由のみ
 *  - planWakeups / planCron で「何を schedule すべきか」を決定し返す（実登録は caller）
 *
 * caller は Claude Code の harness 側で、planWakeups の結果を受けて
 * ScheduleWakeup / CronCreate を実発行する。
 */

import { Clock, SystemClock } from "../shared/clock";
import {
  ReducerContext,
  TasksFileDependencyResolver,
  TickResult,
  loadAllTaskViews,
  tickAutoTransitions,
} from "./workflow_reducer";
import { ReviewResolver } from "../shared/resolvers";

// ---------------------------------------------------------------------------
// Tick (thin wrapper)
// ---------------------------------------------------------------------------

export interface DaemonDeps {
  clock: Clock;
  reviewResolver: ReviewResolver;
}

/**
 * runDaemonTick — ReducerContext を受け、tickAutoTransitions を 1 回呼ぶ。
 * daemon loop はこの関数を繰り返し呼び出すだけ。
 */
export function runDaemonTick(ctx: ReducerContext, deps: DaemonDeps): TickResult {
  const depResolver = new TasksFileDependencyResolver(ctx.tasksFile, ctx.runtimeDir);
  return tickAutoTransitions(ctx, {
    clock: deps.clock,
    depResolver,
    reviewResolver: deps.reviewResolver,
  });
}

// ---------------------------------------------------------------------------
// Wakeup planning
// ---------------------------------------------------------------------------

export type WakeupPlan =
  | { kind: "scheduleWakeup"; taskId: string; wakeupAt: string; delaySeconds: number }
  | { kind: "cronCreate"; taskId: string; wakeupAt: string; mechanism: "cron" }
  | { kind: "overdue"; taskId: string; wakeupAt: string; overdueSeconds: number };

/**
 * planWakeups — sleeping state の task を列挙し、各々について
 * ScheduleWakeup / CronCreate / overdue のどれを発行すべきかを返す。
 *
 * 実際の ScheduleWakeup / CronCreate API 呼び出しは本モジュールの責務ではない。
 * caller (harness / CLI) が返り値を見て発行する。
 */
export function planWakeups(ctx: ReducerContext, clock: Clock): WakeupPlan[] {
  const views = loadAllTaskViews(ctx.tasksFile, ctx.runtimeDir);
  const now = clock.now().getTime();
  const plans: WakeupPlan[] = [];

  for (const v of views) {
    if (v.state.kind !== "sleeping") continue;
    if (!v.state.wakeupAt) continue;
    const at = new Date(v.state.wakeupAt).getTime();
    const deltaMs = at - now;

    if (deltaMs < 0) {
      plans.push({
        kind: "overdue",
        taskId: v.contract.id,
        wakeupAt: v.state.wakeupAt,
        overdueSeconds: Math.round(-deltaMs / 1000),
      });
    } else if (v.state.wakeupMechanism === "cron") {
      plans.push({
        kind: "cronCreate",
        taskId: v.contract.id,
        wakeupAt: v.state.wakeupAt,
        mechanism: "cron",
      });
    } else {
      // one-shot (default)
      plans.push({
        kind: "scheduleWakeup",
        taskId: v.contract.id,
        wakeupAt: v.state.wakeupAt,
        delaySeconds: Math.ceil(deltaMs / 1000),
      });
    }
  }
  return plans;
}

// ---------------------------------------------------------------------------
// CLI entry (called as `node dist/node/clock_daemon.js` directly)
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const tasksFile = getArg("--tasks");
  const runtimeDir = getArg("--runtime");
  const reviewsDir = getArg("--reviews");
  const cheatsheetFile = getArg("--cheatsheet") ?? "";
  const mode = args.includes("--plan-only") ? "plan" : "tick";

  if (!tasksFile || !runtimeDir || !reviewsDir) {
    console.error("usage: clock_daemon --tasks <path> --runtime <path> --reviews <path> [--cheatsheet <path>] [--plan-only]");
    process.exit(2);
  }

  const ctx: ReducerContext = {
    tasksFile,
    runtimeDir,
    cheatsheetFile,
    dryRun: false,
  };
  const clock = new SystemClock();

  if (mode === "plan") {
    const plans = planWakeups(ctx, clock);
    if (plans.length === 0) {
      console.log("PLAN: no sleeping tasks");
      return;
    }
    for (const p of plans) {
      if (p.kind === "overdue") {
        console.log(`PLAN: ${p.taskId} OVERDUE by ${p.overdueSeconds}s (wakeup_at=${p.wakeupAt})`);
      } else if (p.kind === "scheduleWakeup") {
        console.log(`PLAN: ${p.taskId} scheduleWakeup in ${p.delaySeconds}s (wakeup_at=${p.wakeupAt})`);
      } else {
        console.log(`PLAN: ${p.taskId} cronCreate for ${p.wakeupAt}`);
      }
    }
    return;
  }

  // tick mode: reviewResolver を fs-backed で初期化
  // 循環 import を避けるため ReviewsDirReviewResolver は workflow_reducer から import
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ReviewsDirReviewResolver } = require("./workflow_reducer");
  const reviewResolver = new ReviewsDirReviewResolver(reviewsDir);
  const result = runDaemonTick(ctx, { clock, reviewResolver });
  if (result.transitions.length === 0) {
    console.log("TICK: no transitions");
  } else {
    for (const t of result.transitions) {
      console.log(`TICK: ${t.taskId}: ${t.from} -> ${t.to} (edge=${t.edge}, trigger=${t.trigger})`);
    }
  }
}

if (require.main === module) {
  main();
}
