import { describe, expect, test } from "vitest";
import {
  layout,
  type LayoutNodeMetric,
  type LayoutOptions,
  type LayoutResult,
  type VisibleLayoutGraph,
} from "../../src/shared/layout_port";

describe("LayoutPort contract", () => {
  test("lays out a deterministic tree through the public port", () => {
    const graph: VisibleLayoutGraph = {
      nodeIds: ["root", "child"],
      childrenOf: (id) => (id === "root" ? ["child"] : []),
      graphLinks: [],
    };
    const boxSizes: Record<string, LayoutNodeMetric> = {
      root: { w: 200, h: 64 },
      child: { w: 120, h: 38 },
    };
    const options: LayoutOptions = {
      displayRootId: "root",
      structuredMode: "Tree",
      density: "balanced",
      branchDirection: "both",
    };

    const result: LayoutResult = layout(graph, boxSizes, "Tree", options);

    expect(result.order).toEqual(["root", "child"]);
    expect(result.pos.root).toMatchObject({ x: 80, y: 54, depth: 0, w: 200, h: 64 });
    expect(result.pos.child).toMatchObject({ x: 535, y: 29.5, depth: 1, w: 120, h: 38 });
    expect(result.totalWidth).toBe(1620);
    expect(result.totalHeight).toBe(760);
  });
});
