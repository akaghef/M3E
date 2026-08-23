import { describe, expect, test } from "vitest";
import {
  layout,
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

  test("uses density defaults in Tree when spacing is omitted", () => {
    const compact = treeLayout({ direction: "right", density: "compact" });
    const spacious = treeLayout({ direction: "right", density: "spacious" });

    expect(spacious.totalWidth).toBeGreaterThan(compact.totalWidth);
    expect(spacious.totalHeight).toBeGreaterThan(compact.totalHeight);
  });
});
