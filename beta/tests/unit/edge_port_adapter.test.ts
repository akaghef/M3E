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

  test("viewer Tree wiring consumes direction and LayoutResult branchPortSide without geometry inference", () => {
    const routed = routeParentChildEdge({
      relation: { kind: "parent-child", parentNodeId: "p", childNodeId: "c" },
      parentRect: { x: 100, y: 100, w: 80, h: 40 },
      childRect: { x: 300, y: 105, w: 90, h: 50 },
      childPosition: { branchPortSide: "left" },
      surfaceMode: "mindmap",
      direction: "left/right",
      routeStyle: "curve",
    });
    expect(routed.edgeDirection).toEqual({ view: "Tree", direction: "left/right", branchSide: "left" });
    expect([routed.ports.source.side, routed.ports.target.side]).toEqual(["left", "right"]);
  });

  test("viewer Tree wiring selects canonical ports for every direction", () => {
    const expected = {
      "left/right": ["left", "right"], left: ["left", "right"], right: ["right", "left"],
      "up/down": ["top", "bottom"], up: ["top", "bottom"], down: ["bottom", "top"],
    } as const;
    (Object.keys(expected) as Array<keyof typeof expected>).forEach((direction) => {
      const routed = routeParentChildEdge({
        relation: { kind: "parent-child", parentNodeId: "p", childNodeId: "c" },
        parentRect: { x: 100, y: 100, w: 80, h: 40 },
        childRect: { x: 300, y: 105, w: 90, h: 50 },
        childPosition: { branchPortSide: direction === "left/right" ? "left" : direction === "up/down" ? "up" : undefined },
        surfaceMode: "mindmap",
        direction,
        routeStyle: "orthogonal",
      });
      expect([routed.ports.source.side, routed.ports.target.side]).toEqual(expected[direction]);
      console.info(JSON.stringify({ direction, sourcePort: routed.ports.source, targetPort: routed.ports.target }));
    });
  });

  test("falls back to the center-to-center vector when composite direction lacks branchPortSide", () => {
    const routed = routeParentChildEdge({
      relation: { kind: "parent-child", parentNodeId: "p", childNodeId: "c" },
      parentRect: { x: 100, y: 100, w: 80, h: 40 },
      childRect: { x: 300, y: 105, w: 90, h: 50 },
      surfaceMode: "mindmap",
      direction: "left/right",
      routeStyle: "curve",
    });
    expect(routed.edgeDirection).toEqual({ view: "Disperse", direction: "free" });
    expect([routed.ports.source.side, routed.ports.target.side]).toEqual(["right", "left"]);
  });
});
