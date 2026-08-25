import { describe, expect, test } from "vitest";
import { layout, type LayoutDirection, type LayoutNodePosition, type LayoutMode } from "../../src/shared/layout_port";
import { routeParentChildEdge, type ParentChildSurfaceMode } from "../../src/shared/parent_child_edge_adapter";

const directions: LayoutDirection[] = ["left/right", "left", "right", "up/down", "up", "down"];
const modes: Array<{ layoutMode: LayoutMode; surfaceMode: ParentChildSurfaceMode }> = [
  { layoutMode: "Tree", surfaceMode: "tree" },
  { layoutMode: "Axial", surfaceMode: "timeline" },
  { layoutMode: "Radial", surfaceMode: "mindmap" },
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

function legacyRenderedBoxRect(position: LayoutNodePosition) {
  if (position.depth === 0) return positionRect(position);
  return { x: position.x - 14, y: position.y - position.h / 2 + 6, w: position.w + 28, h: position.h - 12 };
}

function endpointInsideRect(point: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }, epsilon = 1.5) {
  return point.x > rect.x + epsilon
    && point.x < rect.x + rect.w - epsilon
    && point.y > rect.y + epsilon
    && point.y < rect.y + rect.h - epsilon;
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

  test("Radial parent-child paths have no endpoints 1.5px inside either rectangle", () => {
    let insideEndpointCount = 0;
    let legacyDiagnosticInsideCount = 0;
    directions.forEach((direction) => {
      const result = layout(graph, metrics, "Radial", {
        displayRootId: "root",
        structuredMode: "Radial",
        direction,
      });
      ([
        ["root", "a"],
        ["root", "b"],
        ["a", "a1"],
      ] as const).forEach(([parentId, childId]) => {
        const parent = result.pos[parentId]!;
        const child = result.pos[childId]!;
        const routed = viewerPath("mindmap", direction, parent, child);
        const parentRect = positionRect(parent);
        const childRect = positionRect(child);
        insideEndpointCount += Number(endpointInsideRect(routed.path.source, parentRect));
        insideEndpointCount += Number(endpointInsideRect(routed.path.target, childRect));
        // Before the fix, edge-mindmap used these visual boxes in diagnostics
        // while its path used the layout boxes above.  That made valid boundary
        // endpoints look 14px inside non-root nodes.
        legacyDiagnosticInsideCount += Number(endpointInsideRect(routed.path.source, legacyRenderedBoxRect(parent)));
        legacyDiagnosticInsideCount += Number(endpointInsideRect(routed.path.target, legacyRenderedBoxRect(child)));
        expect(routed.edgeDirection).toEqual({ view: "Radial", direction: "balanced" });
      });
    });
    expect(legacyDiagnosticInsideCount).toBe(12);
    expect(insideEndpointCount).toBe(0);
  });
});
