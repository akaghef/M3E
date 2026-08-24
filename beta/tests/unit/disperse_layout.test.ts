import { describe, expect, test } from "vitest";
import { layoutDisperse } from "../../src/shared/disperse_layout";

const metrics = {
  root: { w: 180, h: 72 }, left: { w: 320, h: 48 }, right: { w: 96, h: 126 }, leaf: { w: 240, h: 60 },
};
const graph = {
  nodeIds: ["root", "left", "right", "leaf"],
  childrenOf: (id: string) => ({ root: ["left", "right"], left: ["leaf"], right: [], leaf: [] })[id] || [],
  graphLinks: [{ id: "cross", sourceNodeId: "right", targetNodeId: "leaf" }],
};

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y - a.h / 2 < b.y + b.h / 2 && a.y + a.h / 2 > b.y - b.h / 2;
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
});
