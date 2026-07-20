import { describe, expect, test } from "vitest";
import { layoutProgressiveNav, type PnLayoutInput } from "../../src/shared/pn_layout";
import { pnNodes } from "./pn_layout_contract.test";

function metrics(): PnLayoutInput["nodeMetrics"] {
  return Object.fromEntries(pnNodes.map((node) => [node.id, { w: node.id === "gui" ? 44 : 172, h: node.id === "gui" ? 44 : 47 }]));
}

describe("pn_layout placement ratchet", () => {
  test("keeps the action tree to the right even when the canvas safe zone overlaps", () => {
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

    expect(result.placement.trialOrder).toEqual(["right-of-anchor"]);
    expect(result.placement.mode).toBe("right-of-anchor");
    expect(result.placement.rect.x).toBeGreaterThan(344);
    expect(result.placement.canvasNodeOverlapScore).toBeGreaterThan(0);
    expect(result.placement.rejected).toEqual([]);
    expect(result.edges.find((edge) => edge.id === "layout-layout-direction")).toMatchObject({
      sourceSide: "right",
      targetSide: "left",
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

    expect(result.overflow.mode).toBe("scroll");
    expect(result.overflow.scrollRect).toBeDefined();
  });
});
