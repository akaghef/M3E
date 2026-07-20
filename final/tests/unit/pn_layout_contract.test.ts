import { describe, expect, test } from "vitest";
import { layoutProgressiveNav, type PnLayoutInput, type PnNode } from "../../src/shared/pn_layout";

export const pnNodes: PnNode[] = [
  { id: "gui", label: "[GUI]", hint: "root" },
  { id: "view", label: "View", hint: "surface", parentId: "gui" },
  { id: "layout", label: "Layout", hint: "options", parentId: "view" },
  { id: "layout-direction", label: "Direction", hint: "axis", parentId: "layout" },
  { id: "layout-direction-right", label: "Right", hint: "grow right", parentId: "layout-direction", action: "command" },
  { id: "layout-edge-route", label: "Edge Route", hint: "tree edge", parentId: "layout" },
  { id: "layout-edge-elbow", label: "Elbow", hint: "orthogonal", parentId: "layout-edge-route", action: "command" },
  { id: "board", label: "Board", hint: "file", parentId: "gui" },
];

function input(overrides: Partial<PnLayoutInput> = {}): PnLayoutInput {
  const metrics = Object.fromEntries(pnNodes.map((node) => [node.id, { w: node.id === "gui" ? 44 : 172, h: node.id === "gui" ? 44 : 47 }]));
  return {
    nodes: pnNodes,
    rootId: "gui",
    activeId: "layout-direction",
    anchorRect: { x: 48, y: 340, w: 44, h: 44 },
    viewport: { width: 1200, height: 720, zoom: 1 },
    safeZones: [],
    nodeMetrics: metrics,
    options: { routeStyle: "orthogonal" },
    ...overrides,
  };
}

describe("layoutProgressiveNav contract", () => {
  test("returns visible path, focus order, placed rects, overflow state, and EdgePort route metadata", () => {
    const result = layoutProgressiveNav(input());

    expect(result.pathIds).toEqual(["gui", "view", "layout", "layout-direction"]);
    expect(result.visibleNodeIds).toEqual(expect.arrayContaining(["gui", "view", "layout", "layout-direction", "layout-direction-right"]));
    expect(result.focusOrder[0]).toBe("view");
    expect(result.overflow.mode).toBe("none");
    expect(result.overlayRect).toMatchObject({ w: expect.any(Number), h: expect.any(Number) });
    expect(result.nodeRectsById["layout-direction"]).toMatchObject({ w: 172, h: 47 });

    const edge = result.edges.find((item) => item.id === "layout-layout-direction");
    expect(edge).toMatchObject({
      sourceId: "layout",
      targetId: "layout-direction",
      sourceSide: "right",
      targetSide: "left",
      routeStyle: "orthogonal",
    });
    expect(edge?.d.startsWith("M ")).toBe(true);
  });

  test("keeps active path context under search filtering", () => {
    const result = layoutProgressiveNav(input({ options: { searchQuery: "Right", routeStyle: "line" } }));

    expect(result.visibleNodeIds).toEqual(expect.arrayContaining(["gui", "view", "layout", "layout-direction", "layout-direction-right"]));
    expect(result.nodes.find((node) => node.id === "layout-direction-right")?.visibleReason).toBe("search");
  });
});
