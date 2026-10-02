import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WebGLRenderingProjection,
  hitTestSnapshot,
  screenToWorld,
  worldToScreen,
  type CameraState,
  type RenderSnapshot,
} from "../../src/browser/webgl_projection";
import type { PaintCommand } from "../../src/browser/webgl_scene_tiles";

afterEach(() => vi.unstubAllGlobals());

const camera: CameraState = { x: 120, y: -36, zoom: 1.75 };

const snapshot: RenderSnapshot = {
  revision: "fixture-1",
  bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 600 },
  nodes: [
    { id: "root", x: 20, y: 30, width: 160, height: 48, label: "ルート", labelLines: ["ルート"], shape: "rect", fill: "#ffffff", stroke: "#334155" },
    { id: "circle", x: 280, y: 100, width: 64, height: 64, label: "Alias", labelLines: ["Alias"], shape: "circle", fill: "#e0f2fe", stroke: "#0369a1" },
  ],
  groups: [{ id: "root-group", memberIds: ["root", "circle"], x: 0, y: 0, width: 400, height: 300 }],
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

  it("keeps Disperse group boundaries out of hit testing", () => {
    expect(snapshot.groups).toHaveLength(1);
    expect(hitTestSnapshot(snapshot, { x: 220, y: 260 })).toBeNull();
  });

  it("represents non-Disperse scenes with an empty group collection", () => {
    const treeSnapshot: RenderSnapshot = { ...snapshot, groups: [] };
    expect(treeSnapshot.groups).toEqual([]);
  });
});

function projectionHarness() {
  const pending = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {pending.set(++serial,fn);return serial;});
  vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
  const canvas = {addEventListener:vi.fn()} as unknown as HTMLCanvasElement;
  const projection = new WebGLRenderingProjection(canvas,{onUnavailable:vi.fn(),onRestored:vi.fn()});
  // Exercise scheduling/working-set logic without pretending a mock is GPU proof.
  const internals = projection as any;
  internals.active = true; internals.gl = {};
  internals.sceneTiles = {setScene:vi.fn(),updateCommands:vi.fn(),setEditingNode:vi.fn()};
  const draw = vi.spyOn(internals,"draw").mockImplementation(()=>{});
  vi.spyOn(internals,"uploadInteractionGeometry").mockImplementation(()=>{});
  return {projection,internals,draw,pending,tick:()=>{
    const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(0));
  }};
}

it("coalesces snapshot, camera and interaction setters into one presentation", () => {
  const {projection,draw,pending,tick}=projectionHarness();
  projection.setSnapshot({...snapshot,paintScene:{commands:[]}});
  projection.setCamera({x:10,y:20,zoom:1});
  projection.setCamera({x:30,y:40,zoom:1});
  projection.setInteractionState({selectedNodeIds:["root"],primarySelectedNodeId:"root",hoveredNodeId:null,selectedGraphLinkId:null,gestureActive:false});
  expect(pending.size).toBe(1);expect(draw).not.toHaveBeenCalled();
  tick();expect(draw).toHaveBeenCalledTimes(1);
  expect(projection.getDebugState().camera).toEqual({x:30,y:40,zoom:1});
  projection.setCamera({x:40,y:40,zoom:1});projection.present();tick();
  expect(draw).toHaveBeenCalledTimes(2);
});

it("drag patches only moved nodes and incident edges with absolute deltas, not full snapshots", () => {
  const {projection,internals}=projectionHarness();
  const base:PaintCommand={kind:"path",nodeId:"root",path:"M 20 30 L 180 30",bounds:{x:20,y:30,width:160,height:48},matrix:[1,0,0,1,0,0],
    style:{fill:"#fff",stroke:"#222",width:1,opacity:1,fillOpacity:1,strokeOpacity:1,cap:"round",join:"round",dash:[],dashOffset:0,fillRule:"nonzero",strokeFirst:false}};
  const edge:PaintCommand={...base,nodeId:undefined,sourceNodeId:"root",targetNodeId:"circle",path:"M 180 54 L 280 132"};
  const unrelated:PaintCommand={...base,nodeId:"circle"};
  const initial={...snapshot,paintScene:{commands:[base,edge,unrelated]}};
  projection.setSnapshot(initial);
  projection.beginNodeDrag(["root"]);
  projection.previewNodeDrag({x:10,y:20});
  projection.previewNodeDrag({x:30,y:40});
  expect(internals.sceneTiles.setScene).toHaveBeenCalledTimes(1);
  const patches=internals.sceneTiles.updateCommands.mock.calls[1][0] as Map<number,PaintCommand>;
  expect([...patches.keys()]).toEqual([0,1]);
  expect(patches.get(0)!.matrix).toEqual([1,0,0,1,30,40]);
  expect(patches.get(1)!.path).toBe("M 210 94 L 280 132");
  expect(internals.nodesById.get("root").x).toBe(snapshot.nodes[0]!.x+30);
  expect(initial.paintScene.commands).toEqual([base,edge,unrelated]);
  expect(internals.snapshot).toBe(initial);
  projection.setSnapshot(initial);
  expect(internals.nodesById.get("root")).toBe(snapshot.nodes[0]);
  expect(internals.dragPreview).toBeNull();
});
