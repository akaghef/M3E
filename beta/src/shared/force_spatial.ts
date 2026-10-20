import { quadtree, type QuadtreeInternalNode, type QuadtreeLeaf } from "d3-quadtree";
import RBush from "rbush";
import type { ForceRect } from "./force_seam_interface";

interface Particle { x: number; y: number; vx: number; vy: number; }
type QuadtreeNode<T> = QuadtreeInternalNode<T> | QuadtreeLeaf<T>;
interface Mass { count: number; x: number; y: number; }
/** D3 owns the spatial tree; this adapter preserves OT's inverse-square law,
 * cutoff and deterministic coincident-point rule (d3-force uses a different law).
 * theta=0 is the exact reference path for bounded approximation tests. */
export function applySpatialRepulsion<T extends Particle>(bodies: T[], strength: number, fixed: (body: T) => boolean, theta = .6): number {
  const tree = quadtree<T>().x(n => n.x).y(n => n.y).addAll(bodies);
  const mass = new WeakMap<QuadtreeNode<T>, Mass>();
  const indices = new Map(bodies.map((n, i) => [n, i]));
  tree.visitAfter(node => {
    let count = 0, x = 0, y = 0;
    if (node.length) {
      for (const child of node) if (child) { const m = mass.get(child)!; count += m.count; x += m.x * m.count; y += m.y * m.count; }
    } else {
      let leaf: QuadtreeLeaf<T> | undefined = node;
      do { count++; x += leaf.data.x; y += leaf.data.y; leaf = leaf.next; } while (leaf);
    }
    mass.set(node, { count, x: x / count, y: y / count });
  });
  let visits = 0;
  for (const a of bodies) {
    if (fixed(a)) continue;
    tree.visit((node, x0, y0, x1, y1) => {
      visits++;
      const nearX = Math.max(x0 - a.x, 0, a.x - x1), nearY = Math.max(y0 - a.y, 0, a.y - y1);
      if (nearX * nearX + nearY * nearY >= 90000) return true;
      const m = mass.get(node)!;
      let dx = a.x - m.x, dy = a.y - m.y, d2 = dx * dx + dy * dy;
      const farX = Math.max(Math.abs(x0 - a.x), Math.abs(x1 - a.x));
      const farY = Math.max(Math.abs(y0 - a.y), Math.abs(y1 - a.y));
      const containsSelf = a.x >= x0 && a.x < x1 && a.y >= y0 && a.y < y1;
      if (node.length && !containsSelf && farX * farX + farY * farY < 90000 && (x1 - x0) ** 2 < theta * theta * d2) {
        const f = strength * m.count / (d2 * Math.sqrt(d2)); a.vx += dx * f; a.vy += dy * f;
        return true;
      }
      if (!node.length) {
        let leaf: QuadtreeLeaf<T> | undefined = node;
        do {
          const b = leaf.data;
          if (a !== b) {
            dx = a.x - b.x; dy = a.y - b.y; d2 = dx * dx + dy * dy;
            if (d2 < 1e-8) {
              const i = indices.get(a)!, j = indices.get(b)!;
              const angle = (Math.min(i, j) * 31 + Math.max(i, j) * 17) * 2.399963;
              const sign = i < j ? 1 : -1; dx = Math.cos(angle) * sign; dy = Math.sin(angle) * sign; d2 = 1;
            }
            if (d2 < 90000) { const f = strength / (d2 * Math.sqrt(d2)); a.vx += dx * f; a.vy += dy * f; }
          }
          leaf = leaf.next;
        } while (leaf);
      }
      return false;
    });
  }
  return visits;
}

interface BoxEntry { minX: number; minY: number; maxX: number; maxY: number; index: number; }
/** Mutable broad phase: exact rectangle penetration remains owned by OT seam. */
export class ForceBoxIndex {
  private tree = new RBush<BoxEntry>();
  private entries: BoxEntry[];
  constructor(boxes: ForceRect[], private gap: number) {
    this.entries = boxes.map((box, index) => this.entry(box, index)); this.tree.load(this.entries);
  }
  private entry(b: ForceRect, index: number): BoxEntry { return { minX: b.x, minY: b.y, maxX: b.x + b.w, maxY: b.y + b.h, index }; }
  update(index: number, box: ForceRect): void { this.tree.remove(this.entries[index]); this.entries[index] = this.entry(box, index); this.tree.insert(this.entries[index]); }
  candidates(index: number): number[] {
    const e = this.entries[index], gap = this.gap;
    return this.tree.search({ minX: e.minX - gap, minY: e.minY - gap, maxX: e.maxX + gap, maxY: e.maxY + gap })
      .map(n => n.index).filter(j => j > index).sort((a, b) => a - b);
  }
}
