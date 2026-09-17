import { describe, expect, it } from "vitest";
import { DerivedNodeCache } from "../../src/browser/incremental_scene";

describe("node derivations",()=>{
  it("remeasures the changed label and retains all unrelated values",()=>{
    const cache=new DerivedNodeCache<{w:number}>();
    cache.begin();
    const a=cache.get("a","before",()=>({w:10}));
    const b=cache.get("b","same",()=>({w:20}));
    cache.begin();
    expect(cache.get("a","after",()=>({w:40}))).not.toBe(a);
    expect(cache.get("b","same",()=>{throw Error("unrelated measurement");})).toBe(b);
    expect(cache.computed).toBe(1);
    cache.retain(new Set(["a"])); cache.begin();
    expect(cache.get("b","same",()=>({w:30}))).not.toBe(b);
    cache.begin(true);
    expect(cache.get("a","after",()=>({w:50}))).toEqual({w:50});
  });
});
