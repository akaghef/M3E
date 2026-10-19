import { expect, test } from "vitest";
import { computeLaneLayout } from "../../src/shared/lane_layout";
import { projectLane } from "../../src/shared/lane_view";
import type { AppState } from "../../src/shared/types";
import large from "../fixtures/lane_view_large.json";
import asys from "../fixtures/lane_asys.json";

for (const [name, fixture, rootId, count, links] of [["100/200", large, "diagram", 100, 200], ["A-sys", asys, "asys", 25, 82]] as const) {
  for (const direction of ["down", "right"] as const) test(name + " " + direction + " synchronous placement finishes within one second without overlap", () => {
    const state = fixture.state as AppState;
    const metrics = Object.fromEntries(Object.keys(state.nodes).map(id => [id, { w: 140, h: 40 }]));
    const start = performance.now(), projection = projectLane(state, rootId, new Set());
    const result = computeLaneLayout({ projection: { rootId, lanes: projection.lanes }, metrics, direction, space: "normal" });
    const elapsed = performance.now() - start;
    expect(result).not.toBeInstanceOf(Promise);
    expect(projection.nodeIds).toHaveLength(count); expect(projection.links).toHaveLength(links);
    expect(Object.keys(result.pos)).toHaveLength(count); expect(elapsed).toBeLessThanOrEqual(1000);
    const nodes = Object.values(result.pos);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h / 2 <= b.y - b.h / 2 || b.y + b.h / 2 <= a.y - a.h / 2).toBe(true);
    }
    console.info(JSON.stringify({ fixture: name, direction, grandchildren: count, links, elapsedMs: elapsed,
      centers: result.lane!.boundaries.map(b => direction === "down" ? b.y + b.h / 2 : b.x + b.w / 2),
      size: [result.totalWidth, result.totalHeight] }));
  });
}
