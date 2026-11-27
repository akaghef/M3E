import type { AppState, TreeNode } from '../shared/types';

/** Derived presence count. Unknown writes invalidate; known writes inspect only
 * the changed records. State replacement is detected without proxying reads. */
export class NodePresence {
  private state: AppState | null = null;
  private matched = new Set<string>();
  constructor(private matches: (node: TreeNode) => unknown) {}
  change(state: AppState, ids?: readonly string[], unknown = false): void {
    if (unknown) { this.state = null; return; }
    if (state !== this.state) return;
    for (const id of ids ?? []) {
      if (state.nodes[id] && this.matches(state.nodes[id]!)) this.matched.add(id);
      else this.matched.delete(id);
    }
  }
  has(state: AppState): boolean {
    if (this.state !== state) {
      this.matched.clear();
      for (const node of Object.values(state.nodes)) if (this.matches(node)) this.matched.add(node.id);
      this.state = state;
    }
    return this.matched.size > 0;
  }
}
