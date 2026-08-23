import { describe, expect, it } from "vitest";
import {
  hitTestSnapshot,
  screenToWorld,
  worldToScreen,
  type CameraState,
  type RenderSnapshot,
} from "../../src/browser/webgl_projection";

const camera: CameraState = { x: 120, y: -36, zoom: 1.75 };

const snapshot: RenderSnapshot = {
  revision: "fixture-1",
  bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 600 },
  nodes: [
    { id: "root", x: 20, y: 30, width: 160, height: 48, label: "ルート", labelLines: ["ルート"], shape: "rect", fill: "#ffffff", stroke: "#334155" },
    { id: "circle", x: 280, y: 100, width: 64, height: 64, label: "Alias", labelLines: ["Alias"], shape: "circle", fill: "#e0f2fe", stroke: "#0369a1" },
  ],
  edges: [{ id: "root-circle", sourceNodeId: "root", targetNodeId: "circle", points: [{ x: 180, y: 54 }, { x: 280, y: 132 }], color: "#94a3b8", width: 4, kind: "edge" }],
  graphLinks: [{ id: "related", sourceNodeId: "circle", targetNodeId: "root", points: [{ x: 312, y: 100 }, { x: 180, y: 54 }], color: "#7c3aed", width: 3, kind: "graph-link" }],
};

describe("WebGL rendering projection geometry", () => {
  it("round-trips world and screen coordinates", () => {
    const world = { x: 241.25, y: 88.5 };
    const restored = screenToWorld(worldToScreen(world, camera), camera);
    expect(restored.x).toBeCloseTo(world.x, 8);
    expect(restored.y).toBeCloseTo(world.y, 8);
  });

  it("keeps a zoom anchor on the same world point", () => {
    const screenAnchor = { x: 420, y: 260 };
    const worldBefore = screenToWorld(screenAnchor, camera);
    const zoom = 2.5;
    const zoomed: CameraState = {
      zoom,
      x: screenAnchor.x - worldBefore.x * zoom,
      y: screenAnchor.y - worldBefore.y * zoom,
    };
    expect(screenToWorld(screenAnchor, zoomed)).toEqual(worldBefore);
  });

  it("selects a node before its incident GraphLink or edge", () => {
    expect(hitTestSnapshot(snapshot, { x: 50, y: 50 })).toEqual({ kind: "node", nodeId: "root" });
    expect(hitTestSnapshot(snapshot, { x: 312, y: 132 })).toEqual({ kind: "node", nodeId: "circle" });
  });

  it("hit-tests GraphLink and tree edge geometry when no node owns the point", () => {
    expect(hitTestSnapshot(snapshot, { x: 240, y: 75 }, 6)).toEqual({ kind: "graph-link", edgeId: "related" });
    expect(hitTestSnapshot(snapshot, { x: 228, y: 92 }, 6)).toEqual({ kind: "edge", edgeId: "root-circle" });
  });
});
