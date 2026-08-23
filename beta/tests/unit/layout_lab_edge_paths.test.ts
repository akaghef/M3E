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
  return { source, target, path: layoutLabEdgePath(source, target, direction) };
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
});
