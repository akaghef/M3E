import { createOtForce } from "../shared/ot_force";
import type { ForceGraph, ForceSimulation, ForceSnapshot, ForceParameters } from "../shared/force_seam_interface";

/** Viewer adapter owns lifecycle and transient coordinates; OT seam owns physics.
 * Neither a frame nor snapshot mutates the saved map. */
export class DisperseForceController {
  private simulation: ForceSimulation | null = null;
  private key = "";
  private signature = "";
  private dragId: string | null = null;
  private lastDrag = { x: 0, y: 0 };
  lastStepMs = 0;
  steps = 0;
  sync(key: string, graph: ForceGraph, collapsed: Set<string>, enabled: boolean, runInitial = true, parameters: Partial<ForceParameters> = {}): boolean {
    const signature = JSON.stringify([graph.nodes.map(n => [n.id, n.parentId, n.label, n.w, n.h]), graph.links, [...collapsed]]);
    let changed = false;
    const created = key !== this.key || !this.simulation;
    if (key !== this.key || !this.simulation) {
      this.key = key; this.simulation = createOtForce(graph); this.simulation.setParameters(parameters); this.signature = ""; this.dragId = null;
    }
    if (signature !== this.signature) {
      this.simulation.updateGraph(graph);
      // Apply parent collapse first. Children already hidden by it need no toggle.
      let initiallyVisible = new Map(this.simulation.snapshot().nodes.map(n => [n.id, n]));
      for (const n of graph.nodes) {
        const visible = initiallyVisible.get(n.id);
        if (visible && visible.collapsed !== collapsed.has(n.id)) {
          this.simulation.setCollapsed(n.id, collapsed.has(n.id));
          initiallyVisible = new Map(this.simulation.snapshot().nodes.map(n => [n.id, n]));
        }
      }
      this.signature = signature; changed = true;
    }
    if (!enabled || (created && !runInitial)) this.simulation.pause();
    return changed;
  }
  snapshot(): ForceSnapshot | null { return this.simulation?.snapshot() ?? null; }
  step(): ForceSnapshot | null {
    if (!this.simulation) return null;
    const start = performance.now(); const next = this.simulation.step();
    this.lastStepMs = performance.now() - start; this.steps++; return next;
  }
  positions() { return this.simulation?.positions() ?? []; }
  reheat(): void { this.simulation?.reheat(); }
  pause(): void { this.simulation?.pause(); }
  parameters(patch: Partial<ForceParameters>): void { this.simulation?.setParameters(patch); }
  beginDrag(id: string, ids: string[] = []): void { if (this.dragId || !this.simulation) return; this.dragId = id; this.lastDrag = { x: 0, y: 0 }; this.simulation.beginDrag(id, false, ids); }
  moveDrag(x: number, y: number): void {
    if (!this.dragId || !this.simulation) return;
    this.simulation.moveDrag(x - this.lastDrag.x, y - this.lastDrag.y); this.lastDrag = { x, y };
  }
  endDrag(): void { if (this.dragId) this.simulation?.endDrag(); this.dragId = null; }
  invalidate(): void { this.endDrag(); this.pause(); this.key = ""; this.signature = ""; this.simulation = null; }
}
