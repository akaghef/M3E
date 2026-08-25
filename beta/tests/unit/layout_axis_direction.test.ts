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

  test("keeps the synthetic extreme boxes on a shallow branch apart from the deep chain", () => {
    const sample = syntheticLayoutSamples[0];
    const { children, nodeIds } = sample.input.graph;
    const parentByChild = Object.fromEntries(
      Object.entries(children).flatMap(([parentId, childIds]) => childIds.map((childId) => [childId, parentId])),
    );
    const longNodeIds = nodeIds.filter((nodeId) => sample.input.boxSizes[nodeId]!.w >= 480);
    const longBranchRoot = parentByChild[longNodeIds[0]!];
    const chainIds = nodeIds.filter((nodeId) => /^syn-d(?:[4-9]|10)-/.test(nodeId));

    expect(longNodeIds).toHaveLength(3);
    expect(longNodeIds.map((nodeId) => sample.input.boxSizes[nodeId]!.w)).toEqual([480, 640, 800]);
    expect(longBranchRoot).toBeDefined();
    expect(parentByChild[longBranchRoot!]).toBe("syn-root");
    expect(longNodeIds.every((nodeId) => parentByChild[nodeId] === longBranchRoot)).toBe(true);
    expect(chainIds).toHaveLength(7);
    expect(Math.max(...chainIds.map((nodeId) => sample.input.boxSizes[nodeId]!.w))).toBeLessThanOrEqual(360);
    expect(chainIds.slice(0, -1).map((nodeId) => children[nodeId]!.length === 1)).toEqual(
      Array(chainIds.length - 1).fill(true),
    );
    expect(children[chainIds.at(-1)!]).toEqual([]);
    expect(nodeIds).toHaveLength(100);

    const widths = nodeIds.map((nodeId) => sample.input.boxSizes[nodeId]!.w).sort((a, b) => a - b);
    const heights = nodeIds.map((nodeId) => sample.input.boxSizes[nodeId]!.h).sort((a, b) => a - b);
    const depthByNode: Record<string, number> = { "syn-root": 0 };
    nodeIds.forEach((nodeId) => {
      (children[nodeId] || []).forEach((childId) => { depthByNode[childId] = depthByNode[nodeId]! + 1; });
    });
    const depthDistribution = Object.entries(depthByNode)
      .reduce<Record<number, number>>((distribution, [, depth]) => ({ ...distribution, [depth]: (distribution[depth] || 0) + 1 }), {});
    const median = (values: number[]): number => (values[49]! + values[50]!) / 2;
    console.info(JSON.stringify({
      sampleId: sample.sample_id,
      longBranchPaths: longNodeIds.map((nodeId) => ["syn-root", longBranchRoot, nodeId]),
      depthDistribution,
      maxDepth: Math.max(...Object.values(depthByNode)),
      width: { min: widths[0], median: median(widths), max: widths.at(-1) },
      height: { min: heights[0], median: median(heights), max: heights.at(-1) },
    }));
  });

  test("reports synthetic-100-varied-boxes Disperse geometry in six directions", () => {
    const sample = syntheticLayoutSamples[0];
    directions.forEach((direction) => {
      const result = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, "Disperse", {
        ...sample.input.options,
        direction,
      });
      expect(Object.keys(result.pos)).toHaveLength(sample.input.graph.nodeIds.length);
      report(result, sample.sample_id, `Disperse/${direction}` as LayoutDirection);
    });
  });

  test("tree-stress-30 has no strict rectangle intersections in six directions", () => {
    expectNoOverlapsForEveryDirection(treeStress30);
  });

  test("centers the synthetic depth 4 through 10 single-child chain in all six directions", () => {
    const sample = syntheticLayoutSamples[0];
    directions.forEach((direction) => {
      const result = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, sample.input.mode, {
        ...sample.input.options,
        direction,
      });
      const chain = result.order
        .filter((nodeId) => {
          const depth = result.pos[nodeId]?.depth;
          return depth !== undefined && depth >= 4 && depth <= 10;
        })
        .map((nodeId) => ({ nodeId, breadth: breadthCenter(result.pos[nodeId]!, direction) }));

      expect(chain).toHaveLength(7);
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
