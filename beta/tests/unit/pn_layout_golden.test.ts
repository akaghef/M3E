import { describe, expect, test } from "vitest";
import { layoutProgressiveNav, type PnLayoutInput } from "../../src/shared/pn_layout";
import { pnNodes } from "./pn_layout_contract.test";

function metrics(): PnLayoutInput["nodeMetrics"] {
  return Object.fromEntries(pnNodes.map((node) => [node.id, { w: node.id === "gui" ? 44 : 172, h: node.id === "gui" ? 44 : 47 }]));
}

describe("pn_layout placement ratchet", () => {
  test("tries right then dock-left and adopts first canvas overlapScore zero placement", () => {
    const result = layoutProgressiveNav({
      nodes: pnNodes,
      rootId: "gui",
      activeId: "layout-direction",
      anchorRect: { x: 300, y: 300, w: 44, h: 44 },
      viewport: { width: 1200, height: 760, zoom: 1 },
      safeZones: [
        {
          id: "selected-canvas-node",
          reason: "selected-node",
          weight: 10,
          rect: { x: 370, y: 120, w: 540, h: 540 },
        },
      ],
      nodeMetrics: metrics(),
      options: { routeStyle: "orthogonal" },
    });

    expect(result.placement.trialOrder).toEqual(["right-of-anchor", "dock-left-of-anchor", "compact", "fixed-side-panel", "scroll"]);
    expect(result.placement.mode).toBe("dock-left-of-anchor");
    expect(result.placement.canvasNodeOverlapScore).toBe(0);
    expect(result.placement.rejected).toEqual([
      expect.objectContaining({ mode: "right-of-anchor", canvasNodeOverlapScore: expect.any(Number) }),
    ]);
    expect(result.placement.rejected[0]!.canvasNodeOverlapScore).toBeGreaterThan(0);
    expect(result.edges.find((edge) => edge.id === "layout-layout-direction")).toMatchObject({
      sourceSide: "left",
      targetSide: "right",
    });
  });

  test("uses explicit overflow state instead of silent clipping in narrow viewport", () => {
    const result = layoutProgressiveNav({
      nodes: pnNodes,
      rootId: "gui",
      activeId: "layout-direction-right",
      anchorRect: { x: 80, y: 180, w: 44, h: 44 },
      viewport: { width: 360, height: 300, zoom: 1 },
      safeZones: [],
      nodeMetrics: metrics(),
      options: { routeStyle: "line" },
    });

    expect(["scroll", "compact", "side-panel"]).toContain(result.overflow.mode);
    expect(result.overflow.scrollRect).toBeDefined();
  });
});
