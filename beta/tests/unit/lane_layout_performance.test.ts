import { expect, test } from "vitest";
import { computeLaneLayout } from "../../src/shared/lane_layout";
import { projectLane } from "../../src/shared/lane_view";
import type { AppState } from "../../src/shared/types";
import fixture from "../fixtures/lane_view_large.json";
test("real ELK cache miss places 100 grandchildren and 200 links within one second",async()=>{
 const projection=projectLane(fixture.state as AppState,"diagram",new Set());expect(projection.nodeIds).toHaveLength(100);expect(projection.links).toHaveLength(200);
 const input={projection,metrics:Object.fromEntries(Object.keys(fixture.state.nodes).map(id=>[id,{w:140,h:40}])),direction:"down" as const,space:"normal" as const};
 const coldStart=performance.now();const cold=await computeLaneLayout(input);const coldMs=performance.now()-coldStart;
 const start=performance.now();const result=await computeLaneLayout(input);const elapsed=performance.now()-start;
 console.info(`Lane real ELK: first ${coldMs.toFixed(1)} ms; next cache miss ${elapsed.toFixed(1)} ms`);
 expect(Object.keys(cold.pos)).toHaveLength(100);expect(coldMs).toBeLessThanOrEqual(1000);expect(elapsed).toBeLessThanOrEqual(1000);
 const nodes=Object.values(result.pos);
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=nodes[i],b=nodes[j];expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h/2<=b.y-b.h/2||b.y+b.h/2<=a.y-a.h/2).toBe(true);
 }
});
