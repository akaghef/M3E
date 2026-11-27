import type { LayoutNodeMetric, LayoutResult } from '../shared/layout_port';
import type { SaveTouches } from './save_command';

/** Retained-layout transaction. Validate all dependencies before the first write.
 * Unsupported/unknown deltas return false and use the canonical full renderer. */
export class StableScenePatch {
  private entries = new Map<string, { children: string[]; dependency: string }>();
  constructor(private layout: LayoutResult) {}
  remember(id: string, children: string[], dependency: string): void {
    this.entries.set(id, { children, dependency });
  }
  apply(touches: SaveTouches, access: {
    children(id: string): string[];
    dependency(id: string): string;
    measure(id: string): LayoutNodeMetric | undefined;
    beforeDraw?(): void;
    draw(id: string): void;
  }): boolean {
    if (Object.keys(touches).some(field => field !== 'nodes')) return false;
    const changes: Array<[string, LayoutNodeMetric]> = [];
    for (const id of new Set(touches.nodes)) {
      const old = this.entries.get(id), position = this.layout.pos[id];
      if (!old || !position || old.dependency !== access.dependency(id)) return false;
      const children = access.children(id);
      if (old.children.length !== children.length || old.children.some((child, i) => child !== children[i])) return false;
      const metric = access.measure(id);
      if (!metric || metric.w !== position.w || metric.h !== position.h) return false;
      changes.push([id, metric]);
    }
    access.beforeDraw?.();
    for (const [id, metric] of changes) {
      Object.assign(this.layout.pos[id]!, metric);
      access.draw(id);
    }
    return true;
  }
}

import RBush from 'rbush';
export interface SceneBox { x: number; y: number; width: number; height: number }
interface IndexedBox { minX: number; minY: number; maxX: number; maxY: number }
/** Exact bounds including shrinking/deleting an extremum. No scene rescan. */
export class SceneBounds {
  private tree = new RBush<IndexedBox>();
  private entries = new Map<string, IndexedBox>();
  private unknown = new Set<string>();
  clear(): void { this.tree.clear(); this.entries.clear(); this.unknown.clear(); }
  set(id: string, box: SceneBox | null | undefined): void {
    const old = this.entries.get(id);
    if (old) { this.tree.remove(old); this.entries.delete(id); }
    this.unknown.delete(id);
    if (!box) { this.unknown.add(id); return; }
    if (!box.width && !box.height) return;
    const entry = { minX: box.x, minY: box.y, maxX: box.x + box.width, maxY: box.y + box.height };
    this.entries.set(id, entry); this.tree.insert(entry);
  }
  get box(): SceneBox | null {
    if (this.unknown.size) return null;
    if (!this.entries.size) return { x: 0, y: 0, width: 0, height: 0 };
    const { minX, minY, maxX, maxY } = this.tree.toJSON();
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
