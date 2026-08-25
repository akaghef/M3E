import { describe, expect, test } from "vitest";
import { layout } from "../../src/shared/layout_port";
import { layoutLabEdgePath } from "../../src/labs/layout/layout_edge_paths";
import { layoutSamples, toVisibleLayoutGraph } from "../../src/labs/layout/layout_samples";

const sample = layoutSamples.find((item) => item.sample_id === "tree-stress-30")!;
const graph = toVisibleLayoutGraph(sample);
const rootId = sample.input.options.displayRootId!;

function representativePath(direction: "left/right" | "left" | "right" | "up/down" | "up" | "down") {
  const result = layout(graph, sample.input.boxSizes, "Tree", {
    ...sample.input.options,
    direction,
    spacing: { nodeGap: 14, levelGap: 112, padding: 92 },
  });
  const childId = graph.childrenOf(rootId).find((id) => result.pos[id]?.branchPortSide === (
    direction === "left/right" ? "left" : direction === "up/down" ? "up" : undefined
  )) ?? graph.childrenOf(rootId)[0]!;
  const source = result.pos[rootId]!;
  const target = result.pos[childId]!;
  return { source, target, path: layoutLabEdgePath(source, target, "Tree", direction) };
}

describe("Layout Lab edge exclusive seam", () => {
  test("uses selected ports for every canonical Tree direction", () => {
    const expected = {
      "left/right": ["left", "right"], left: ["left", "right"], right: ["right", "left"],
      "up/down": ["top", "bottom"], up: ["top", "bottom"], down: ["bottom", "top"],
    } as const;
    (Object.keys(expected) as Array<keyof typeof expected>).forEach((direction) => {
      const { source, target, path } = representativePath(direction);
      expect([path.source.side, path.target.side]).toEqual(expected[direction]);
      expect(path.source.x).toBe(direction === "left/right" || direction === "left" ? source.x : direction === "right" ? source.x + source.w : source.x + source.w / 2);
      expect(path.target.x).toBe(direction === "left/right" || direction === "left" ? target.x + target.w : direction === "right" ? target.x : target.x + target.w / 2);
      expect(path.source.y).toBe(direction === "up/down" || direction === "up" ? source.y - source.h / 2 : direction === "down" ? source.y + source.h / 2 : source.y);
      expect(path.target.y).toBe(direction === "up/down" || direction === "up" ? target.y + target.h / 2 : direction === "down" ? target.y - target.h / 2 : target.y);
      console.info(JSON.stringify({ direction, sourcePort: path.source, targetPort: path.target }));
    });
  });

  test("uses the Disperse center-to-center vector without Tree branch metadata", () => {
    const result = layout(graph, sample.input.boxSizes, "Disperse", {
      ...sample.input.options,
      scatter: { edgeLength: 500 },
    });
    const source = result.pos[rootId]!;
    const targetId = graph.childrenOf(rootId)[0]!;
    const target = result.pos[targetId]!;

    expect(target.branchPortSide).toBeUndefined();
    const path = layoutLabEdgePath(source, target, "Disperse", undefined);
    const sourceCenter = { x: source.x + source.w / 2, y: source.y };
    const targetCenter = { x: target.x + target.w / 2, y: target.y };
    expect([path.source.side, path.target.side]).toEqual(
      Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y)
        ? (targetCenter.x >= sourceCenter.x ? ["right", "left"] : ["left", "right"])
        : (targetCenter.y >= sourceCenter.y ? ["bottom", "top"] : ["top", "bottom"]),
    );
    console.info(JSON.stringify({ sourceCenter, targetCenter, sourcePort: path.source, targetPort: path.target }));
  });

  test("selects canonical ports without exceptions for every mode and direction", () => {
    const directions = ["left/right", "left", "right", "up/down", "up", "down"] as const;
    (["Tree", "Axial", "Radial", "Disperse", "System"] as const).forEach((mode) => {
      directions.forEach((direction) => {
        const result = layout(graph, sample.input.boxSizes, mode, {
          ...sample.input.options,
          structuredMode: mode === "Tree" || mode === "Axial" || mode === "Radial" ? mode : undefined,
          direction,
        });
        // System surfaces deliberately omit the tree root, so use two actual
        // rendered nodes for the adapter's mode-wide drawability contract.
        const source = result.pos[result.order[0]!]!;
        const target = result.pos[result.order[1]!]!;
        expect(() => layoutLabEdgePath(source, target, mode, direction)).not.toThrow();
        console.info(JSON.stringify({ mode, direction, source: source.branchPortSide, target: target.branchPortSide }));
      });
    });
  });
});
