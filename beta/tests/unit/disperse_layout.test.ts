import { describe, expect, test } from "vitest";
import { layoutDisperse } from "../../src/shared/disperse_layout";
import { syntheticLayoutSamples } from "../../src/labs/layout/synthetic_layout_samples";

const metrics = {
  root: { w: 180, h: 72 }, left: { w: 320, h: 48 }, right: { w: 96, h: 126 }, leaf: { w: 240, h: 60 },
};
const graph = {
  nodeIds: ["root", "left", "right", "leaf"],
  childrenOf: (id: string) => ({ root: ["left", "right"], left: ["leaf"], right: [], leaf: [] })[id] || [],
  graphLinks: [{ id: "cross", sourceNodeId: "right", targetNodeId: "leaf" }],
};

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, epsilon = 1e-6): boolean {
  const overlapWidth = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapHeight = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return overlapWidth > epsilon && overlapHeight > epsilon;
}

function separatedByGap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, gap: number, epsilon = 1e-6): boolean {
  const horizontalGap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  const verticalGap = Math.max(a.y - a.h / 2, b.y - b.h / 2) - Math.min(a.y + a.h / 2, b.y + b.h / 2);
  return horizontalGap >= gap - epsilon || verticalGap >= gap - epsilon;
}

describe("Disperse WebCola seam", () => {
  test("is deterministic and preserves rectangular dimensions", () => {
    const options = { displayRootId: "root", subtype: "force" as const, space: "normal" as const };
    const first = layoutDisperse(graph, metrics, options);
    const second = layoutDisperse(graph, metrics, options);
    expect(second.pos).toEqual(first.pos);
    expect(first.pos.right).toMatchObject({ w: 96, h: 126 });
    const nodes = Object.values(first.pos);
    expect(nodes.some((node, index) => nodes.slice(index + 1).some((other) => overlap(node, other)))).toBe(false);
  });

  test("contracts a collapsed subtree to one descendant-area super-node", () => {
    const result = layoutDisperse(graph, metrics, { displayRootId: "root", subtype: "cluster", collapsedNodeIds: ["left"], superNodeFootprint: "descendant-area", edgeAggregation: "weighted" });
    expect(result.pos["collapse:left"]).toBeDefined();
    expect(result.pos.left).toBeUndefined();
    expect(result.pos.leaf).toBeUndefined();
    expect(result.edges.some((edge) => edge.weight > 1 || edge.sourceId === "collapse:left" || edge.targetId === "collapse:left")).toBe(true);
  });

  test.each(["force", "cluster"] as const)("keeps the 100-node rectangular corpus non-overlapping in %s mode", (subtype) => {
    const sample = syntheticLayoutSamples[0]!;
    const result = layoutDisperse({
      nodeIds: sample.input.graph.nodeIds,
      childrenOf: (id) => sample.input.graph.children[id] || [],
      graphLinks: [],
    }, sample.input.boxSizes, { displayRootId: "syn-root", subtype, space: "normal" });
    const nodes = Object.values(result.pos);
    expect(nodes.some((node, index) => nodes.slice(index + 1).some((other) => overlap(node, other)))).toBe(false);
    expect(Math.min(...nodes.map((node) => node.x))).toBeGreaterThanOrEqual(0);
    expect(Math.min(...nodes.map((node) => node.y - node.h / 2))).toBeGreaterThanOrEqual(0);
    if (subtype === "cluster") {
      const left = Math.min(...nodes.map((node) => node.x));
      const top = Math.min(...nodes.map((node) => node.y - node.h / 2));
      const right = Math.max(...nodes.map((node) => node.x + node.w));
      const bottom = Math.max(...nodes.map((node) => node.y + node.h / 2));
      expect((right - left) / (bottom - top)).toBeGreaterThan(0.5);
    }
  });

  test.each(["normal", "loose"] as const)("keeps the cluster corpus separated in %s space", (space) => {
    const sample = syntheticLayoutSamples[0]!;
    const minimumGap = space === "normal" ? 16 : 40;
    const result = layoutDisperse({
      nodeIds: sample.input.graph.nodeIds,
      childrenOf: (id) => sample.input.graph.children[id] || [],
      graphLinks: [],
    }, sample.input.boxSizes, { displayRootId: "syn-root", subtype: "cluster", space });
    const nodes = Object.values(result.pos);
    expect(nodes.every((node, index) => nodes.slice(index + 1).every((other) => separatedByGap(node, other, minimumGap)))).toBe(true);
  });
});
