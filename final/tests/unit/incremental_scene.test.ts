import { afterEach, describe, expect, it, vi } from "vitest";
import { DerivedNodeCache, RetainedSvgScene, ScopeDerivedCache } from "../../src/browser/incremental_scene";

afterEach(() => vi.unstubAllGlobals());

it("patches one retained SVG fragment without visiting or replacing siblings", () => {
  const elements: any[] = [];
  vi.stubGlobal("document", { createElementNS: () => {
    let markup = "";
    const element = { dataset: {}, nextElementSibling: null,
      get innerHTML() { return markup; },
      set innerHTML(value: string) { markup = value; },
    };
    elements.push(element);
    return element;
  } });
  const root = {firstElementChild:null,insertBefore:vi.fn(),replaceChildren:vi.fn()} as unknown as SVGSVGElement;
  const scene = new RetainedSvgScene();
  scene.update(root, [["a","before"],["b","unaffected"]]);
  const siblingWrite = vi.spyOn(elements[1], "innerHTML", "set");
  vi.mocked(root.insertBefore).mockClear();
  expect(scene.patch("a","selected")).toBe(true);
  expect(elements[0].innerHTML).toBe("selected");
  expect(elements[1].innerHTML).toBe("unaffected");
  expect(root.insertBefore).not.toHaveBeenCalled();
  expect(siblingWrite).not.toHaveBeenCalled();
  expect(scene.patch("missing","ignored")).toBe(false);
});

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

it("retains separate scope derivations across visits, with bounded eviction", () => {
  const scopes = new ScopeDerivedCache(() => new DerivedNodeCache<number>(), 2);
  const a = scopes.get("map:A"), b = scopes.get("map:B");
  a.get("node", "before", () => 1); b.get("node", "before", () => 2);
  expect(scopes.get("map:A")).toBe(a);
  b.get("node", "after", () => 3);
  expect(a.get("node", "before", () => { throw Error("unaffected scope recomputed"); })).toBe(1);
  expect(scopes.get("other-map:A")).not.toBe(a);
  expect(scopes.get("map:A")).toBe(a);
  expect(scopes.get("map:B")).not.toBe(b);
});
