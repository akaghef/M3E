import { describe, expect, test } from "vitest";
import { routeParentChildEdge } from "../../src/shared/parent_child_edge_adapter";

describe("parent-child edge adapter", () => {
  test("keeps parent-child relation separate from route style", () => {
    const routed = routeParentChildEdge({
      relation: { kind: "parent-child", parentNodeId: "p", childNodeId: "c" },
      parentRect: { x: 100, y: 100, w: 80, h: 40 },
      childRect: { x: 300, y: 105, w: 90, h: 50 },
      surfaceMode: "tree",
      direction: "right",
      routeStyle: "orthogonal",
    });
    expect(routed.relation.kind).toBe("parent-child");
    expect(routed.path.style).toBe("orthogonal");
    expect([routed.ports.source.side, routed.ports.target.side]).toEqual(["right", "left"]);
  });

  test("Tree both consumes LayoutResult branchSide and does not infer from geometry", () => {
    const routed = routeParentChildEdge({
      relation: { kind: "parent-child", parentNodeId: "p", childNodeId: "c" },
      parentRect: { x: 100, y: 100, w: 80, h: 40 },
      childRect: { x: 300, y: 105, w: 90, h: 50 },
      childPosition: { branchSide: "left" },
      surfaceMode: "mindmap",
      direction: "right",
      routeStyle: "curve",
    });
    expect(routed.branchDirection).toEqual({ view: "Tree", direction: "both", branchSide: "left" });
    expect([routed.ports.source.side, routed.ports.target.side]).toEqual(["left", "right"]);
  });

  test("Tree both fails when LayoutResult branchSide is missing", () => {
    expect(() => routeParentChildEdge({
      relation: { kind: "parent-child", parentNodeId: "p", childNodeId: "c" },
      parentRect: { x: 100, y: 100, w: 80, h: 40 },
      childRect: { x: 300, y: 105, w: 90, h: 50 },
      surfaceMode: "mindmap",
      direction: "right",
      routeStyle: "curve",
    })).toThrow(/LayoutResult\.branchSide/);
  });
});

