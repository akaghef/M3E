/**
 * PJ03 SelfDrive — resolver interfaces (T-1-10 P3)
 *
 * reducer は依存解決・review 解決を自前では行わない。
 * 外部から注入可能な interface として定義し、実装は別モジュール or test stub で供給する。
 */

import type { WorkflowStateKind } from "./workflow_types";

/**
 * DependencyResolver — task 間依存を解決する。
 *
 * reducer は tasks.yaml の dependencies field（T-1-10 で追加）から
 * 各 task の依存 task id 配列を受け、全員 done かどうか問い合わせる。
 *
 * 循環依存検出は本 interface の責務ではなく、caller 側で行う
 * （detectDependencyCycles ヘルパを別途提供）。
 */
export interface DependencyResolver {
  /**
   * 指定 taskId の dependencies がすべて done なら true。
   * dependencies が空なら true。
   * 1 つでも not-done（pending / ready / in_progress / etc.）なら false。
   */
  allDone(taskId: string): boolean;

  /**
   * 依存一覧（直接依存のみ）を返す。cycle detection 用途。
   */
  dependenciesOf(taskId: string): string[];

  /**
   * 指定 task の state kind を返す。cycle detection 後の逐次照会に使う。
   */
  stateOf(taskId: string): WorkflowStateKind;
}

export type ReviewResolution = "open" | "resolved" | "rejected" | "unknown";

/**
 * ReviewResolver — reviews/Qn の状態を解決する。
 *
 * tasks.yaml の linked_review field（T-1-10 で追加）から
 * review id を受け取り、pool / resolved / rejected を返す。
 *
 * E12 (human_approve) / E13 (human_reject) / E15 (blocker_cleared) は
 * linked_review の state によって条件発火する。
 */
export interface ReviewResolver {
  /**
   * review id (例: "Qn3_gate2_rework") に対する現在の resolution。
   * ファイルが無い場合 / frontmatter が無い場合は "unknown"。
   */
  resolve(reviewId: string): ReviewResolution;
}

/**
 * 循環依存検出 — DFS ベース。
 *
 * 返り値:
 *   - 循環なし: null
 *   - 循環あり: 検出された cycle の task id 配列（先頭 == 末尾で閉じる）
 */
export function detectDependencyCycles(
  resolver: DependencyResolver,
  taskIds: readonly string[],
): string[] | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of taskIds) color.set(id, WHITE);
  const stack: string[] = [];

  function dfs(id: string): string[] | null {
    const c = color.get(id);
    if (c === GRAY) {
      const cycleStart = stack.indexOf(id);
      return stack.slice(cycleStart).concat(id);
    }
    if (c === BLACK) return null;
    color.set(id, GRAY);
    stack.push(id);
    for (const dep of resolver.dependenciesOf(id)) {
      if (!color.has(dep)) continue; // unknown dep, skip (caller の責務で先に弾く)
      const sub = dfs(dep);
      if (sub) return sub;
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const id of taskIds) {
    if (color.get(id) === WHITE) {
      const sub = dfs(id);
      if (sub) return sub;
    }
  }
  return null;
}
