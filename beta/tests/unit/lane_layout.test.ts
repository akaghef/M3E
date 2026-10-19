import { describe, expect, test } from "vitest";
import { projectLane } from "../../src/shared/lane_view";
import { computeLaneLayout } from "../../src/shared/lane_layout";
import type { AppState } from "../../src/shared/types";
import fixture from "../fixtures/lane_view.json";
import asys from "../fixtures/lane_asys.json";

function input(direction: "right" | "down", state = structuredClone(fixture.state) as AppState, rootId = "diagram", space: "tight" | "normal" | "loose" = "normal") {
  const projection = projectLane(state, rootId, new Set());
  const metrics = Object.fromEntries(Object.keys(state.nodes).map((id, i) => [id, { w: 80 + i % 5 * 37, h: 24 + i % 3 * 15 }]));
  return { projection, metrics, direction, space };
}

function assertNoOverlap(pos: Record<string, { x: number; y: number; w: number; h: number }>) {
  const nodes = Object.values(pos);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h / 2 <= b.y - b.h / 2 || b.y + b.h / 2 <= a.y - a.h / 2).toBe(true);
  }
}

for (const [name, payload, rootId, counts] of [["first slice", fixture, "diagram", [2, 3, 2]], ["A-sys", asys, "asys", [3, 3, 5, 6, 5, 3]]] as const) {
  describe(name + " Lane contract", () => {
    for (const direction of ["right", "down"] as const) test(direction + ": one centerline, sibling order, separated bands, no overlap, GraphLink independence", async () => {
      const state = structuredClone(payload.state) as AppState, before = structuredClone(state), data = input(direction, state, rootId);
      const result = await computeLaneLayout(data);
      const bands = result.lane!.boundaries;
      expect(bands.map(b => b.id)).toEqual(state.nodes[rootId].children);
      expect(data.projection.lanes.map(l => l.nodeIds.length)).toEqual(counts);
      expect(result.pos[rootId]).toBeUndefined();
      data.projection.lanes.forEach((lane, index) => {
        const points = lane.nodeIds.map(id => result.pos[id]);
        const center = direction === "down" ? bands[index].y + bands[index].h / 2 : bands[index].x + bands[index].w / 2;
        for (const point of points) expect(direction === "down" ? point.y : point.x + point.w / 2).toBe(center);
        for (let i = 1; i < points.length; i++) expect(direction === "down" ? points[i - 1].x + points[i - 1].w < points[i].x : points[i - 1].y + points[i - 1].h / 2 < points[i].y - points[i].h / 2).toBe(true);
        const crossSize = Math.max(...points.map(p => direction === "down" ? p.h : p.w));
        expect(direction === "down" ? bands[index].h : bands[index].w).toBeGreaterThan(crossSize);
        expect(new Set(bands.map(b => direction === "down" ? b.h : b.w)).size).toBe(1);
      });
      for (let i = 1; i < bands.length; i++) expect(direction === "down" ? bands[i - 1].y + bands[i - 1].h <= bands[i].y : bands[i - 1].x + bands[i - 1].w <= bands[i].x).toBe(true);
      assertNoOverlap(result.pos);
      expect(state).toEqual(before);
      state.links = {};
      expect((await computeLaneLayout(input(direction, state, rootId))).pos).toEqual(result.pos);
    });
  });
}

test("A-sys source contains six lanes, 25 grandchildren and 82 links", () => {
  const data = input("down", asys.state as AppState, "asys");
  expect(data.projection.lanes.map(l => l.label)).toEqual(["AI", "Cloud", "Device", "Domain", "Apps", "Back"]);
  expect(data.projection.nodeIds).toHaveLength(25); expect(data.projection.links).toHaveLength(82);
});

test("root and grandchild reordering follow their own sibling arrays without mutation", async () => {
  const state = structuredClone(fixture.state) as AppState;
  state.nodes.diagram.children.reverse(); state.nodes.research.children.reverse();
  const before = structuredClone(state), result = await computeLaneLayout(input("down", state));
  expect(result.lane!.boundaries.map(b => b.id)).toEqual(["operations", "development", "research"]);
  expect(result.pos.analysis.x).toBeLessThan(result.pos.reading.x); expect(state).toEqual(before);
});

for (const direction of ["right", "down"] as const) test(direction + " space increases gaps within and between lanes", async () => {
  const tight = await computeLaneLayout(input(direction, undefined, "diagram", "tight")), loose = await computeLaneLayout(input(direction, undefined, "diagram", "loose"));
  const itemGap = (r: typeof tight) => direction === "down" ? r.pos.analysis.x - r.pos.reading.x - r.pos.reading.w : r.pos.analysis.y - r.pos.analysis.h / 2 - r.pos.reading.y - r.pos.reading.h / 2;
  const bandGap = (r: typeof tight) => direction === "down" ? r.pos.viewer.y - r.pos.reading.y - r.pos.reading.h : r.pos.viewer.x - r.pos.reading.x - r.pos.reading.w;
  expect(itemGap(loose)).toBeGreaterThan(itemGap(tight)); expect(bandGap(loose)).toBeGreaterThan(bandGap(tight));
});

test("empty lanes, empty root, and long headers have finite bounds without saved placeholders", async () => {
  const state = structuredClone(fixture.state) as AppState; state.nodes.development.children = [];
  const data = input("down", state); data.metrics.research = { w: 420, h: 90 };
  const result = await computeLaneLayout(data);
  expect(result.lane!.boundaries.map(b => b.id)).toEqual(["research", "development", "operations"]);
  expect(result.lane!.boundaries[1].h).toBeGreaterThan(0); assertNoOverlap(result.pos);
  expect(Object.keys(result.pos).some(id => id.startsWith("lane-empty:"))).toBe(false);
  state.nodes.diagram.children = [];
  const empty = await computeLaneLayout(input("down", state));
  expect(empty.order).toEqual([]); expect(empty.lane!.boundaries).toEqual([]);
  expect(Number.isFinite(empty.totalWidth + empty.totalHeight)).toBe(true);
});
