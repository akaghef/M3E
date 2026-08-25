import { describe, expect, test } from "vitest";
import {
  layout,
  normalizeLayoutVocabulary,
  type LayoutOptions,
} from "../../src/shared/layout_port";
import { layoutSamples, toVisibleLayoutGraph } from "../../src/labs/layout/layout_samples";

const treeStress = layoutSamples.find((sample) => sample.sample_id === "tree-stress-30")!;
const treeGraph = toVisibleLayoutGraph(treeStress);

function measured(result: ReturnType<typeof layout>) {
  const nodes = Object.values(result.pos);
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y - node.h / 2));
  const right = Math.max(...nodes.map((node) => node.x + node.w));
  const bottom = Math.max(...nodes.map((node) => node.y + node.h / 2));
  const overlapPairs = nodes.reduce((total, node, index) => total + nodes.slice(index + 1).filter((other) =>
    Math.min(node.x + node.w, other.x + other.w) > Math.max(node.x, other.x)
      && Math.min(node.y + node.h / 2, other.y + other.h / 2) > Math.max(node.y - node.h / 2, other.y - other.h / 2),
  ).length, 0);
  return { nodes: nodes.length, overlapPairs, bbox: `${Number((right - left).toFixed(3))}x${Number((bottom - top).toFixed(3))}` };
}

function treeLayout(options: Partial<LayoutOptions> = {}) {
  return layout(treeGraph, treeStress.input.boxSizes, "Tree", {
    ...treeStress.input.options,
    ...options,
  });
}

describe("LayoutPort contract", () => {
  test("migrates persisted legacy layout vocabulary to direction and space", () => {
    expect(normalizeLayoutVocabulary({ branchDirection: "both", density: "compact" })).toEqual({ direction: "left/right", space: "tight" });
    expect(normalizeLayoutVocabulary({ branchDirection: "left", density: "balanced" })).toEqual({ direction: "left", space: "normal" });
    expect(normalizeLayoutVocabulary({ branchDirection: "right", density: "spacious" })).toEqual({ direction: "right", space: "loose" });
    expect(normalizeLayoutVocabulary({ direction: "up/down", space: "loose" })).toEqual({ direction: "up/down", space: "loose" });
  });

  test("applies all Tree spacing controls", () => {
    const base = { direction: "left/right" as const };
    const compactSiblings = treeLayout({ ...base, spacing: { nodeGap: 1, levelGap: 112, padding: 92 } });
    const looseSiblings = treeLayout({ ...base, spacing: { nodeGap: 60, levelGap: 112, padding: 92 } });
    const shortLevels = treeLayout({ ...base, spacing: { nodeGap: 14, levelGap: 60, padding: 92 } });
    const longLevels = treeLayout({ ...base, spacing: { nodeGap: 14, levelGap: 260, padding: 92 } });
    const narrowSides = treeLayout({ ...base, spacing: { nodeGap: 14, levelGap: 112, padding: 20 } });
    const wideSides = treeLayout({ ...base, spacing: { nodeGap: 14, levelGap: 112, padding: 200 } });

    expect(looseSiblings.totalHeight).toBeGreaterThan(compactSiblings.totalHeight);
    expect(longLevels.totalWidth).toBeGreaterThan(shortLevels.totalWidth);
    expect(wideSides.totalWidth).toBeGreaterThan(narrowSides.totalWidth);
    expect(wideSides.totalHeight).toBeGreaterThan(narrowSides.totalHeight);
  });

  test("supports every canonical Tree direction and both depth alignments", () => {
    const spacing = { nodeGap: 14, levelGap: 112, padding: 92 };
    const signatures = ["left/right", "left", "right", "up/down", "up", "down"].map((direction) => {
      const result = treeLayout({ direction: direction as LayoutOptions["direction"], spacing, depthAlign: "packed" });
      const root = result.pos[treeStress.input.options.displayRootId!]!;
      return `${result.totalWidth}x${result.totalHeight}@${root.x},${root.y}`;
    });
    const packed = treeLayout({ direction: "left/right", spacing, depthAlign: "packed" });
    const aligned = treeLayout({ direction: "left/right", spacing, depthAlign: "aligned" });

    expect(new Set(signatures).size).toBe(6);
    expect(`${packed.totalWidth}x${packed.totalHeight}`).not.toBe(`${aligned.totalWidth}x${aligned.totalHeight}`);
  });

  test("uses space defaults in Tree when spacing is omitted", () => {
    const tight = treeLayout({ direction: "right", space: "tight" });
    const loose = treeLayout({ direction: "right", space: "loose" });

    expect(loose.totalWidth).toBeGreaterThan(tight.totalWidth);
    expect(loose.totalHeight).toBeGreaterThan(tight.totalHeight);
  });

  test("omits descendants of a collapsed node from structured layout while retaining that node", () => {
    const target = treeStress.input.graph.nodeIds.find((nodeId) => {
      const children = treeStress.input.graph.children[nodeId] || [];
      return nodeId !== treeStress.input.options.displayRootId && children.length > 0;
    })!;
    const child = treeStress.input.graph.children[target]![0]!;
    const collapsedGraph = toVisibleLayoutGraph(treeStress, [target]);
    const result = layout(collapsedGraph, treeStress.input.boxSizes, "Tree", treeStress.input.options);

    expect(collapsedGraph.childrenOf(target)).toEqual([]);
    expect(result.pos[target]).toBeDefined();
    expect(result.pos[child]).toBeUndefined();
    expect(result.order.length).toBeLessThan(treeStress.input.graph.nodeIds.length);
  });

  test("reports the lab's Tree and Disperse collapse measurements", () => {
    const target = treeStress.input.graph.nodeIds.find((nodeId) => {
      const children = treeStress.input.graph.children[nodeId] || [];
      return nodeId !== treeStress.input.options.displayRootId && children.length > 0;
    })!;
    const treeOff = treeLayout();
    const treeOn = layout(toVisibleLayoutGraph(treeStress, [target]), treeStress.input.boxSizes, "Tree", treeStress.input.options);
    const disperseOptions: LayoutOptions = {
      ...treeStress.input.options,
      disperse: { subtype: "cluster", superNodeFootprint: "descendant-area", edgeAggregation: "bundle" },
    };
    const disperseOff = layout(treeGraph, treeStress.input.boxSizes, "Disperse", disperseOptions);
    const disperseOn = layout(treeGraph, treeStress.input.boxSizes, "Disperse", {
      ...disperseOptions,
      disperse: { ...disperseOptions.disperse, collapsedNodeIds: [target] },
    });

    console.info(`LAYOUT_LAB_COLLAPSE ${JSON.stringify({ target, tree: { off: measured(treeOff), on: measured(treeOn) }, disperse: { off: measured(disperseOff), on: measured(disperseOn) } })}`);
    expect(treeOn.order.length).toBeLessThan(treeOff.order.length);
    expect(disperseOn.order).toContain(`collapse:${target}`);
    expect(disperseOn.order.length).toBeLessThan(disperseOff.order.length);
  });
});
