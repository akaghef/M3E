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

const stabilityNodes: PnNode[] = [
  { id: "root", label: "Root", hint: "root" },
  { id: "a", label: "A", hint: "level 1", parentId: "root" },
  { id: "b", label: "B", hint: "level 2", parentId: "a" },
  { id: "s", label: "Sibling", hint: "level 2", parentId: "a" },
  { id: "c1", label: "C1", hint: "level 3", parentId: "b" },
  { id: "c2", label: "C2", hint: "level 3", parentId: "b" },
  { id: "c3", label: "C3", hint: "level 3", parentId: "b" },
  { id: "c4", label: "C4", hint: "level 3", parentId: "b" },
  { id: "c5", label: "C5", hint: "level 3", parentId: "b" },
  { id: "c6", label: "C6", hint: "level 3", parentId: "b" },
  { id: "c7", label: "C7", hint: "level 3", parentId: "b" },
  { id: "c8", label: "C8", hint: "level 3", parentId: "b" },
  { id: "d1", label: "D1", hint: "level 4", parentId: "c1", action: "command" },
  { id: "d2", label: "D2", hint: "level 4", parentId: "c1", action: "command" },
  { id: "d3", label: "D3", hint: "level 4", parentId: "c1", action: "command" },
  { id: "d4", label: "D4", hint: "level 4", parentId: "c1", action: "command" },
  { id: "d5", label: "D5", hint: "level 4", parentId: "c1", action: "command" },
  { id: "d6", label: "D6", hint: "level 4", parentId: "c1", action: "command" },
  { id: "d7", label: "D7", hint: "level 4", parentId: "c1", action: "command" },
  { id: "d8", label: "D8", hint: "level 4", parentId: "c1", action: "command" },
];

function screenRect(result: ReturnType<typeof layoutProgressiveNav>, nodeId: string) {
  const node = result.nodes.find((entry) => entry.id === nodeId);
  if (!node) throw new Error(`missing node ${nodeId}`);
  return {
    x: result.overlayRect.x + node.rect.x,
    y: result.overlayRect.y + node.rect.y,
    w: node.rect.w,
    h: node.rect.h,
  };
}

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
  test("keeps existing ancestor cards stationary when a selected child reveals descendants", () => {
    const metrics = Object.fromEntries(stabilityNodes.map((node) => [node.id, { w: node.id === "root" ? 44 : 172, h: node.id === "root" ? 44 : 47 }]));
    const common = {
      nodes: stabilityNodes,
      rootId: "root",
      anchorRect: { x: 48, y: 340, w: 44, h: 44 },
      viewport: { width: 1200, height: 720, zoom: 1 },
      safeZones: [],
      nodeMetrics: metrics,
      options: { routeStyle: "orthogonal" as const },
    };
    const base = layoutProgressiveNav({ ...common, activeId: "b" });
    const deeper = layoutProgressiveNav({ ...common, activeId: "c1" });

    for (const id of ["a", "b", "c1"]) {
      expect(screenRect(deeper, id)).toEqual(screenRect(base, id));
    }
  });

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

  test("keeps ancestor screen positions fixed while a tall child column opens", () => {
    const tallNodes: PnNode[] = [
      { id: "gui", label: "[GUI]", hint: "root" },
      { id: "board", label: "Board", hint: "file", parentId: "gui" },
      { id: "view", label: "View", hint: "surface", parentId: "gui" },
      ...Array.from({ length: 7 }, (_, index) => ({ id: `view-child-${index}`, label: `Surface ${index}`, hint: "surface", parentId: "view" })),
    ];
    const nodeMetrics = Object.fromEntries(tallNodes.map((node) => [node.id, { w: node.id === "gui" ? 44 : 172, h: node.id === "gui" ? 44 : 47 }]));
    const shared = {
      nodes: tallNodes,
      rootId: "gui",
      anchorRect: { x: 48, y: 340, w: 44, h: 44 },
      viewport: { width: 1200, height: 720, zoom: 1 },
      safeZones: [],
      nodeMetrics,
      options: { routeStyle: "orthogonal" as const },
    };
    const closed = layoutProgressiveNav({ ...shared, activeId: "gui" });
    const opened = layoutProgressiveNav({ ...shared, activeId: "view" });
    const screenTop = (result: typeof closed, id: string) => result.overlayRect.y + result.nodeRectsById[id]!.y;

    expect(screenTop(opened, "view")).toBeCloseTo(screenTop(closed, "view"), 6);
    expect(screenTop(opened, "board")).toBeCloseTo(screenTop(closed, "board"), 6);
    expect(opened.nodeRectsById["view-child-0"]!.y).toBeGreaterThanOrEqual(opened.nodeRectsById.view!.y);
  });
});
