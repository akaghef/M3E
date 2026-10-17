import { expect, test, vi } from "vitest";
import { LaneLayoutCache, type LaneLayoutInput } from "../../src/shared/lane_layout";
import type { LayoutResult } from "../../src/shared/layout_port";
const input={} as LaneLayoutInput;
const result=(width:number):LayoutResult=>({pos:{},order:[],totalWidth:width,totalHeight:1});
const deferred=()=>{let resolve!:(v:LayoutResult)=>void;let reject!:(e:Error)=>void;const promise=new Promise<LayoutResult>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test("pending requests deduplicate and ready result rerenders once",async()=>{
 const pending=deferred(),compute=vi.fn(()=>pending.promise),changed=vi.fn(),cache=new LaneLayoutCache(compute,changed);
 expect(cache.read("same",input)).toBeUndefined();expect(cache.read("same",input)).toBeUndefined();expect(compute).toHaveBeenCalledTimes(1);
 pending.resolve(result(10));await flush();expect(cache.read("same",input)?.totalWidth).toBe(10);expect(changed).toHaveBeenCalledTimes(1);
});
test("root/direction/map changes discard stale results and unload invalidates pending work",async()=>{
 const first=deferred(),second=deferred(),changed=vi.fn(),compute=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),cache=new LaneLayoutCache(compute,changed);
 cache.read("root-a/right",input);cache.read("root-b/down",input);second.resolve(result(20));await flush();first.resolve(result(10));await flush();
 expect(cache.read("root-b/down",input)?.totalWidth).toBe(20);expect(changed).toHaveBeenCalledTimes(1);
 const third=deferred();compute.mockReturnValueOnce(third.promise);cache.read("map-b/right",input);cache.invalidate();third.resolve(result(30));await flush();
 expect(cache.phase).toBe("idle");expect(changed).toHaveBeenCalledTimes(1);
});
test("failures remain visible until input changes",async()=>{
 const pending=deferred(),compute=vi.fn(()=>pending.promise),cache=new LaneLayoutCache(compute,()=>{});
 cache.read("bad",input);pending.reject(new Error("ELK failed"));await flush();expect(cache.phase).toBe("failed");
 expect(()=>cache.read("bad",input)).toThrow("ELK failed");expect(compute).toHaveBeenCalledTimes(1);cache.invalidate();expect(cache.phase).toBe("idle");
});
test("synchronous worker creation failure enters a stable failed state",async()=>{
 const cache=new LaneLayoutCache(()=>{throw new Error("Worker unavailable");},()=>{});
 expect(cache.read("worker",input)).toBeUndefined();await flush();expect(cache.phase).toBe("failed");expect(()=>cache.read("worker",input)).toThrow("Worker unavailable");
});
