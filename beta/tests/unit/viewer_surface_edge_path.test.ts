import { describe, expect, test } from "vitest";
import { layout, type LayoutDirection, type LayoutNodePosition, type LayoutMode } from "../../src/shared/layout_port";
import { routeParentChildEdge, type ParentChildSurfaceMode } from "../../src/shared/parent_child_edge_adapter";

const directions: LayoutDirection[] = ["left/right", "left", "right", "up/down", "up", "down"];
const modes: Array<{ layoutMode: LayoutMode; surfaceMode: ParentChildSurfaceMode }> = [
  { layoutMode: "Tree", surfaceMode: "tree" },
  { layoutMode: "Axial", surfaceMode: "timeline" },
  { layoutMode: "Disperse", surfaceMode: "scatter" },
  { layoutMode: "System", surfaceMode: "system" },
];

const graph = {
  nodeIds: ["root", "a", "b", "a1"],
  childrenOf: (id: string) => ({ root: ["a", "b"], a: ["a1"] }[id] || []),
  graphLinks: [],
};
const metrics = Object.fromEntries(graph.nodeIds.map((id) => [id, { w: 120, h: 40, labelLines: [id] }]));

function positionRect(position: LayoutNodePosition) {
  return { x: position.x, y: position.y - position.h / 2, w: position.w, h: position.h };
}

/** Mirrors viewer.ts layoutEdgePath input construction, including Timeline stems. */
function viewerPath(surfaceMode: ParentChildSurfaceMode, direction: LayoutDirection, parent: LayoutNodePosition, child: LayoutNodePosition) {
  const timelineStemParent = surfaceMode === "timeline" ? { ...parent, x: child.x, w: child.w } : parent;
  return routeParentChildEdge({
    relation: { kind: "parent-child", parentNodeId: "parent", childNodeId: "child" },
    parentRect: positionRect(timelineStemParent),
    childRect: positionRect(child),
    childPosition: child,
    surfaceMode,
    direction,
    routeStyle: "curve",
  });
}

describe("viewer surface edge path", () => {
  test("renders every mode and direction without a branchPortSide exception", () => {
    modes.forEach(({ layoutMode, surfaceMode }) => {
      directions.forEach((direction) => {
        const result = layout(graph, metrics, layoutMode, {
          displayRootId: "root",
          structuredMode: layoutMode,
          direction,
          disperse: { subtype: "cluster" },
        });
        const parent = result.pos["root"] || result.pos[result.order[0]!];
        const child = result.pos["a"] || result.pos[result.order[1]!];
        expect(parent).toBeDefined();
        expect(child).toBeDefined();
        expect(() => viewerPath(surfaceMode, direction, parent!, child!)).not.toThrow();
      });
    });
  });

  test("Timeline stem takes the vector fallback when its child has no branchPortSide", () => {
    const result = layout(graph, metrics, "Axial", { displayRootId: "root", structuredMode: "timeline", direction: "left/right" });
    const routed = viewerPath("timeline", "left/right", result.pos.root!, result.pos.a!);
    expect(result.pos.a!.branchPortSide).toBeUndefined();
    expect(routed.edgeDirection).toEqual({ view: "Disperse", direction: "free" });
  });

});
