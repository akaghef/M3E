import { describe, expect, test } from "vitest";
import { projectLane } from "../../src/shared/lane_view";
import { computeLaneLayout } from "../../src/shared/lane_layout";
import fixture from "../fixtures/lane_view.json";

function input(direction: "right" | "down", state = structuredClone(fixture.state), space: "tight" | "normal" | "loose" = "normal") {
  const projection = projectLane(state, "diagram", new Set());
  const metrics = Object.fromEntries(Object.keys(state.nodes).map(id => [id, { w: 140, h: 40 }]));
  return { projection, metrics, direction, space };
}

export function assertNoOverlap(pos: Record<string, {x:number;y:number;w:number;h:number}>) {
  const nodes = Object.values(pos);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h / 2 <= b.y - b.h / 2 || b.y + b.h / 2 <= a.y - a.h / 2).toBe(true);
  }
}

describe("real elkjs Lane placement", () => {
  for (const direction of ["right", "down"] as const) test(direction + " partitions follow root sibling order", async () => {
    const result = await computeLaneLayout(input(direction));
    expect(result.lane?.boundaries.map(b => b.id)).toEqual(["research", "development", "operations"]);
    expect(result.order).toHaveLength(7);
    expect(result.pos.diagram).toBeUndefined();
    assertNoOverlap(result.pos);
    const boundaries = result.lane!.boundaries;
    for (let i = 1; i < boundaries.length; i++) {
      const a = boundaries[i-1], b = boundaries[i];
      expect(direction === "right" ? a.x + a.w <= b.x : a.y + a.h <= b.y).toBe(true);
    }
  });

  test("reordering root children changes bands without mutating topology", async () => {
    const state = structuredClone(fixture.state);
    state.nodes.diagram.children.reverse();
    const snapshot = structuredClone(state);
    const result = await computeLaneLayout(input("down", state));
    expect(result.lane!.boundaries.map(b => b.id)).toEqual(["operations", "development", "research"]);
    expect(state).toEqual(snapshot);
  });

  test("empty and disconnected bands retain their order", async () => {
    const state = structuredClone(fixture.state);
    state.nodes.development.children = [];
    state.links = {} as typeof state.links;
    const result = await computeLaneLayout(input("down", state));
    expect(result.lane!.boundaries.map(b => b.id)).toEqual(["research", "development", "operations"]);
    expect(result.lane!.boundaries[1].h).toBeGreaterThan(0);
    assertNoOverlap(result.pos);
  });

  test("space increases both ELK spacing options", async () => {
    const tight = await computeLaneLayout(input("down", undefined, "tight"));
    const loose = await computeLaneLayout(input("down", undefined, "loose"));
    expect(loose.totalHeight).toBeGreaterThan(tight.totalHeight);
    expect(loose.totalWidth).toBeGreaterThan(tight.totalWidth);
  });
});

test("grandchild sibling reordering never changes lane order; cycles and reverse links use real ELK",async()=>{
 const state=structuredClone(fixture.state);state.nodes.research.children.reverse();
 const result=await computeLaneLayout(input("right",state));
 expect(result.lane!.boundaries.map(b=>b.id)).toEqual(["research","development","operations"]);assertNoOverlap(result.pos);
});
test("empty root and long measured headers produce valid finite geometry",async()=>{
 const state=structuredClone(fixture.state);state.nodes.diagram.children=[];
 const empty=await computeLaneLayout(input("down",state));expect(empty.order).toEqual([]);expect(empty.lane!.boundaries).toEqual([]);
 const measured=input("right");measured.metrics.research={w:420,h:90};
 const long=await computeLaneLayout(measured);expect(long.lane!.boundaries[0].w).toBeGreaterThanOrEqual(420);assertNoOverlap(long.pos);
});
