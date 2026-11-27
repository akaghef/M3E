import { layoutPositionBounds, layoutBoundsFromMaximum, type LayoutDirection, type LayoutResult } from '../shared/layout_port';
import { SceneBounds } from './viewer_delta_scene';

export interface ReorderPlan {
  parent: string; source: string; from: number; to: number;
  /** Visible subtrees in their old order. Unrelated siblings are never visited. */
  roots: string[]; changed: string[]; offsets: Map<string, number>;
}
/** Retained Tree topology. Swapping sibling intervals preserves every span and
 * depth coordinate. Only the crossed intervals and their incoming edges move. */
export class TreeReorder {
  private children = new Map<string, string[]>();
  private indices = new Map<string, number>();
  private parents = new Map<string, string>();
  private orderIndices = new Map<string, number>();
  private bounds = new SceneBounds();
  constructor(private layout: LayoutResult, children: (id: string) => string[],
    private span: (id: string) => number | undefined, private direction: LayoutDirection,
    private invalidateLayoutCache: () => void = () => {}) {
    layout.order.forEach((id, index) => {
      this.orderIndices.set(id, index);
      this.bounds.set(id,layoutPositionBounds(layout.pos[id]!));
      const list = children(id).filter(child => !!layout.pos[child]);
      this.children.set(id, list);
      list.forEach((child, index) => { this.indices.set(child, index); this.parents.set(child, id); });
    });
  }
  /** Same-parent breadth navigation; depth/reparent requests stay with the
   * existing command until their layout transaction is supported. */
  planKey(source: string, key: string): ReorderPlan | null {
    if (!['right','left','down'].includes(this.direction)) return null;
    const vertical = this.direction === 'down';
    const step = key === (vertical ? 'ArrowLeft' : 'ArrowUp') ? -1
      : key === (vertical ? 'ArrowRight' : 'ArrowDown') ? 1 : 0;
    const parent = this.parents.get(source), from = this.indices.get(source);
    if (!step || parent === undefined || from === undefined) return null;
    return this.plan(source, from + step);
  }
  plan(source: string, to: number): ReorderPlan | null {
    const parent = this.parents.get(source), from = this.indices.get(source);
    if (parent === undefined || from === undefined) return null;
    const children = this.children.get(parent)!;
    if (to < 0 || to >= children.length || from === to) return null;
    const low = Math.min(from,to), high = Math.max(from,to), roots = children.slice(low,high+1);
    const extent = this.span(source), next = children[from + Math.sign(to-from)]!, nextExtent = this.span(next);
    if (extent === undefined || nextExtent === undefined || roots.some(id => this.span(id) === undefined)) return null;
    const breadth = (id: string) => this.direction === 'down' ? this.layout.pos[id]!.x + this.layout.pos[id]!.w/2 : this.layout.pos[id]!.y;
    const gap = Math.abs(breadth(next)-breadth(source))-(extent+nextExtent)/2;
    const offsets = new Map<string,number>(), changed: string[] = [];
    const visit = (id: string, offset: number) => {
      changed.push(id); offsets.set(id,offset);
      for (const child of this.children.get(id) ?? []) visit(child,offset);
    };
    const sign = Math.sign(to-from);
    let displacement = 0;
    for (const id of roots) if (id !== source) displacement += this.span(id)! + gap;
    for (const id of roots) visit(id, id === source ? sign*displacement : -sign*(extent+gap));
    return {parent,source,from,to,roots,changed,offsets};
  }
  apply(plan: ReorderPlan): void {
    // The cached key describes the old topology. In-place positions must never
    // be returned for that key again, particularly after cancel/undo.
    this.invalidateLayoutCache();
    const children = this.children.get(plan.parent)!;
    const start = this.orderIndices.get(plan.roots[0]!)!;
    const blocks = new Map<string,string[]>();
    const visit = (id: string, block: string[]) => {block.push(id); for(const child of this.children.get(id) ?? []) visit(child,block);};
    for (const root of plan.roots) {const block:string[]=[];visit(root,block);blocks.set(root,block);}
    rotateRange(children,plan.from,plan.to);
    let cursor = start;
    for (let i=Math.min(plan.from,plan.to);i<=Math.max(plan.from,plan.to);i++) {
      const root=children[i]!;this.indices.set(root,i);
      for(const id of blocks.get(root)!) {this.layout.order[cursor]=id;this.orderIndices.set(id,cursor++);}
    }
    for(const [id,offset] of plan.offsets) {
      const p=this.layout.pos[id]!;
      if(this.direction==='down')p.x+=offset;else p.y+=offset;
      this.bounds.set(id,layoutPositionBounds(p));
    }
    const bounds=this.bounds.box!;
    Object.assign(this.layout,layoutBoundsFromMaximum(bounds.x+bounds.width,bounds.y+bounds.height));
  }
  index(id: string): number | undefined { return this.indices.get(id); }
  ordered(plan: ReorderPlan): string[] { return [...plan.changed].sort((a,b)=>this.orderIndices.get(a)!-this.orderIndices.get(b)!); }
}

/** Unlike remove+splice, rotation writes only the crossed range. */
export function rotateRange<T>(values: T[], from: number, to: number): void {
  const value=values[from]!, step=Math.sign(to-from);
  for(let i=from;i!==to;i+=step) values[i]=values[i+step]!;
  values[to]=value;
}
