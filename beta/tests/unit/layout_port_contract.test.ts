import { describe, expect, test } from "vitest";
import {
  layout,
  normalizeLayoutVocabulary,
  routeLayoutEdge,
  type LayoutOptions,
} from "../../src/shared/layout_port";
import { layoutSamples, toVisibleLayoutGraph } from "../../src/labs/layout/layout_samples";

const treeStress = layoutSamples.find((sample) => sample.sample_id === "tree-stress-30")!;
const treeGraph = toVisibleLayoutGraph(treeStress);

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

  test.each(["mindmap", "logic-chart"] as const)("%s preserves six directions and valid vertical branch ports", (structuredMode) => {
    const directions: NonNullable<LayoutOptions["direction"]>[] = ["left/right", "left", "right", "up/down", "up", "down"];
    directions.forEach((direction) => {
      const result = layout(treeGraph, treeStress.input.boxSizes, structuredMode, {
        ...treeStress.input.options,
        structuredMode,
        direction,
      });
      const root = result.pos[treeStress.input.options.displayRootId!]!;
      const child = result.pos[treeGraph.childrenOf(treeStress.input.options.displayRootId!)[0]!]!;
      const path = routeLayoutEdge(root, child, "Tree", direction, "curve");
      if (direction === "up/down") {
        expect(child.branchPortSide === "up" || child.branchPortSide === "down").toBe(true);
        expect(["top", "bottom"]).toContain(path.source.side);
        expect(["top", "bottom"]).toContain(path.target.side);
      }
      console.info(JSON.stringify({ structuredMode, direction, branchPortSide: child.branchPortSide, ports: [path.source.side, path.target.side] }));
    });
  });

  test("Axial preserves the two-sided direction axis", () => {
    const rootId = treeStress.input.options.displayRootId!;
    const rootChildren = treeGraph.childrenOf(rootId);
    const horizontal = layout(treeGraph, treeStress.input.boxSizes, "Axial", {
      ...treeStress.input.options,
      structuredMode: "timeline",
      direction: "left/right",
    });
    const vertical = layout(treeGraph, treeStress.input.boxSizes, "Axial", {
      ...treeStress.input.options,
      structuredMode: "timeline",
      direction: "up/down",
    });
    const horizontalRoot = horizontal.pos[rootId]!;
    const verticalRoot = vertical.pos[rootId]!;

    expect(rootChildren.some((id) => horizontal.pos[id]!.x < horizontalRoot.x)).toBe(true);
    expect(rootChildren.some((id) => horizontal.pos[id]!.x > horizontalRoot.x)).toBe(true);
    expect(rootChildren.some((id) => vertical.pos[id]!.y < verticalRoot.y)).toBe(true);
    expect(rootChildren.some((id) => vertical.pos[id]!.y > verticalRoot.y)).toBe(true);
  });

  test("uses space defaults in Tree when spacing is omitted", () => {
    const tight = treeLayout({ direction: "right", space: "tight" });
    const loose = treeLayout({ direction: "right", space: "loose" });

    expect(loose.totalWidth).toBeGreaterThan(tight.totalWidth);
    expect(loose.totalHeight).toBeGreaterThan(tight.totalHeight);
  });
});
