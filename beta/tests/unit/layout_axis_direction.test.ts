import { describe, expect, test } from "vitest";
import { layout, type LayoutDirection, type LayoutNodePosition, type LayoutResult } from "../../src/shared/layout_port";
import { layoutSamples, toVisibleLayoutGraph, type LayoutLabSample } from "../../src/labs/layout/layout_samples";
import { syntheticLayoutSamples } from "../../src/labs/layout/synthetic_layout_samples";

const directions: LayoutDirection[] = ["left/right", "left", "right", "up/down", "up", "down"];
const treeStress30 = layoutSamples.find((sample) => sample.sample_id === "tree-stress-30")!;

interface Rect {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function rectFor(id: string, position: LayoutNodePosition): Rect {
  return {
    id,
    left: position.x,
    right: position.x + position.w,
    top: position.y - position.h / 2,
    bottom: position.y + position.h / 2,
  };
}

function overlapPairs(rects: Rect[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i]!;
      const b = rects[j]!;
      // Strict intersection: edge/corner contact is not an overlap.
      if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  return pairs;
}

function report(result: LayoutResult, sampleId: string, direction: LayoutDirection): Array<[string, string]> {
  const rects = result.order.map((id) => rectFor(id, result.pos[id]!));
  const overlaps = overlapPairs(rects);
  const bounds = {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  };
  console.info(JSON.stringify({ sampleId, direction, placed: result.order.length, overlapPairs: overlaps.length, bounds }));
  return overlaps;
}

function breadthCenter(position: LayoutNodePosition, direction: LayoutDirection): number {
  return direction === "up" || direction === "down" || direction === "up/down"
    ? position.x + position.w / 2
    : position.y;
}

function expectNoOverlapsForEveryDirection(sample: LayoutLabSample): void {
  directions.forEach((direction) => {
    const result = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, sample.input.mode, {
      ...sample.input.options,
      direction,
    });

    expect(Object.keys(result.pos)).toHaveLength(sample.input.graph.nodeIds.length);
    expect(report(result, sample.sample_id, direction)).toEqual([]);
  });
}

describe("Tree layout direction-aware extents", () => {
  test("synthetic-100-varied-boxes has no strict rectangle intersections in six directions", () => {
    expectNoOverlapsForEveryDirection(syntheticLayoutSamples[0]);
  });

  test("tree-stress-30 has no strict rectangle intersections in six directions", () => {
    expectNoOverlapsForEveryDirection(treeStress30);
  });

  test("centers the synthetic depth 4 through 21 single-child chain in all six directions", () => {
    const sample = syntheticLayoutSamples[0];
    directions.forEach((direction) => {
      const result = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, sample.input.mode, {
        ...sample.input.options,
        direction,
      });
      const chain = result.order
        .filter((nodeId) => {
          const depth = result.pos[nodeId]?.depth;
          return depth !== undefined && depth >= 4 && depth <= 21;
        })
        .map((nodeId) => ({ nodeId, breadth: breadthCenter(result.pos[nodeId]!, direction) }));

      expect(chain).toHaveLength(18);
      expect(new Set(chain.map(({ breadth }) => breadth))).toEqual(new Set([chain[0]!.breadth]));
      console.info(JSON.stringify({ sampleId: sample.sample_id, direction, singleChildChainBreadth: chain }));
    });
  });

  test("centers tree-stress-30 graphlinks to cross-scope-link in all six directions", () => {
    directions.forEach((direction) => {
      const result = layout(toVisibleLayoutGraph(treeStress30), treeStress30.input.boxSizes, treeStress30.input.mode, {
        ...treeStress30.input.options,
        direction,
      });
      const parent = result.pos.graphlinks!;
      const child = result.pos["cross-scope-link"]!;
      const parentBreadth = breadthCenter(parent, direction);
      const childBreadth = breadthCenter(child, direction);

      expect(childBreadth).toBe(parentBreadth);
      console.info(JSON.stringify({
        sampleId: treeStress30.sample_id,
        direction,
        parent: { nodeId: "graphlinks", breadth: parentBreadth },
        child: { nodeId: "cross-scope-link", breadth: childBreadth },
      }));
    });
  });
});
