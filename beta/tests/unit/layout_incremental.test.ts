import { describe, expect, it } from "vitest";
import { layout, TreeSpanCache, type LayoutDirection, type LayoutNodeMetric, type VisibleLayoutGraph } from "../../src/shared/layout_port";

function fixture() {
  const children: Record<string, string[]> = {root: ["a", "b", "c"], a: ["a1", "a2"], b: ["b1"], c: ["c1"]};
  const metrics: Record<string, LayoutNodeMetric> = Object.fromEntries(["root","a","b","c","a1","a2","b1","c1"].map(id=>[id,{w:120,h:40}]));
  const graph: VisibleLayoutGraph = {nodeIds:Object.keys(metrics), childrenOf:id=>children[id] || [], graphLinks:[]};
  return {children,metrics,graph};
}

describe("incremental branch dimensions", () => {
  for (const direction of ["right", "left", "down", "up", "left/right", "up/down"] as LayoutDirection[]) {
    for (const depthAlign of ["packed", "aligned"] as const) {
      it(`matches full layout after resize/add/remove/reorder in ${direction} ${depthAlign}`, () => {
        const {children,metrics,graph} = fixture();
        const treeCache = new TreeSpanCache();
        const options = {displayRootId:"root",direction,depthAlign};
        const compare = () => expect(layout(graph,metrics,"Tree",{...options,treeCache})).toEqual(layout(graph,metrics,"Tree",options));
        compare();
        metrics.a1 = {w:560,h:210,labelLines:["日本語", "long text"]}; compare();
        metrics.b2 = {w:180,h:90}; children.b.push("b2"); graph.nodeIds.push("b2"); compare();
        children.root.reverse(); compare();
        children.a.splice(0,1); delete metrics.a1; graph.nodeIds=graph.nodeIds.filter(id=>id!=="a1"); compare();
        metrics.b2 = {w:70,h:34}; compare();
      });
    }
  }
  it("reuses unaffected branch spans and stops when a parent extent is unchanged", () => {
    const {graph,metrics} = fixture();
    const treeCache=new TreeSpanCache();
    const draw=()=>layout(graph,metrics,"Tree",{displayRootId:"root",treeCache});
    draw(); expect(treeCache.computed).toBe(8);
    draw(); expect(treeCache.computed).toBe(0);
    metrics.a1.w=500; draw(); expect(treeCache.computed).toBe(0);
    metrics.a1.h=150; draw(); expect(treeCache.computed).toBe(3); // leaf -> a -> root only
    metrics.a.h=50; draw(); expect(treeCache.computed).toBe(1); // children still dominate a's height
  });
  it("invalidates dimensions when orientation or spacing changes",()=>{
    const {graph,metrics}=fixture(); const treeCache=new TreeSpanCache();
    layout(graph,metrics,"Tree",{treeCache});
    for(const direction of ["down","right"] as LayoutDirection[]) {
      const options={treeCache,direction,space:"loose" as const};
      expect(layout(graph,metrics,"Tree",options)).toEqual(layout(graph,metrics,"Tree",{...options,treeCache:undefined}));
    }
  });
});
