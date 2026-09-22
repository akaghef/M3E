import { afterEach, describe, expect, it, vi } from "vitest";
import { WebGLRenderingProjection, type RenderSnapshot } from "../../src/rendering/webgl_projection";

// Call-contract mock, not GPU/browser or performance evidence. A small texture
// limit forces pagination without allocating real images or large fixtures.
function harness() {
  let serial = 0;
  const resource = () => ({ id: ++serial });
  const noop = Object.fromEntries([
    "shaderSource", "compileShader", "attachShader", "linkProgram", "deleteShader",
    "enable", "disable", "blendFunc", "viewport", "bindBuffer", "bufferData",
    "bindTexture", "texParameteri", "pixelStorei", "texImage2D", "deleteTexture",
    "deleteBuffer", "deleteProgram", "useProgram", "uniform3f", "uniform2f", "uniform1i",
    "enableVertexAttribArray", "vertexAttribPointer", "drawArrays", "activeTexture", "clearColor", "clear",
  ].map(name => [name, vi.fn()]));
  const constants = Object.fromEntries([
    "VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "BLEND", "SRC_ALPHA",
    "ONE_MINUS_SRC_ALPHA", "DEPTH_TEST", "ARRAY_BUFFER", "STATIC_DRAW", "DYNAMIC_DRAW", "MAX_TEXTURE_SIZE",
    "TEXTURE_2D", "TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER", "TEXTURE_WRAP_S", "TEXTURE_WRAP_T",
    "LINEAR", "CLAMP_TO_EDGE", "UNPACK_PREMULTIPLY_ALPHA_WEBGL", "RGBA", "UNSIGNED_BYTE", "FLOAT",
    "TRIANGLES", "TEXTURE0", "COLOR_BUFFER_BIT",
  ].map((name, index) => [name, index + 1]));
  const gl = {
    ...constants, ...noop,
    createShader: vi.fn(resource), createProgram: vi.fn(resource), createBuffer: vi.fn(resource), createTexture: vi.fn(resource),
    getShaderParameter: vi.fn(() => true), getProgramParameter: vi.fn(() => true),
    getParameter: vi.fn(() => 256), getAttribLocation: vi.fn(() => 0), getUniformLocation: vi.fn(resource),
    isContextLost: vi.fn(() => false),
  };
  const raster = {
    font: "", textBaseline: "", fillStyle: "",
    measureText: vi.fn((text: string) => ({ width: text.length * 14 })),
    save: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), fillText: vi.fn(), restore: vi.fn(),
  };
  const createElement = vi.fn(() => ({ width: 0, height: 0, getContext: vi.fn(() => raster) }));
  vi.stubGlobal("document", { createElement });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  const listeners = new Map<string, (event: Event) => void>();
  const canvas = {
    width: 0, height: 0, getContext: vi.fn(() => gl),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 600 }),
    addEventListener: vi.fn((name: string, listener: (event: Event) => void) => { listeners.set(name, listener); }),
    removeEventListener: vi.fn((name: string) => { listeners.delete(name); }),
  };
  const onUnavailable = vi.fn(), onRestored = vi.fn();
  const projection = new WebGLRenderingProjection(canvas as unknown as HTMLCanvasElement, { onUnavailable, onRestored, labelMinZoom: 0 });
  const emit = (name: string) => {
    const event = new Event(name, { cancelable: true });
    listeners.get(name)?.(event);
    return event;
  };
  return { projection, gl, calls: noop, canvas, raster, createElement, listeners, onUnavailable, onRestored, emit };
}

function scene(count = 2): RenderSnapshot {
  return {
    revision: "initial", bounds: { minX: -200, minY: -100, maxX: count * 180, maxY: 100 }, groups: [], edges: [], graphLinks: [],
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `n${index}`, x: -200 + index * 180, y: -100, width: 140, height: 54,
      label: `Node ${index}`, labelLines: [`Node ${index}`], fontSize: 13, shape: "rect" as const, fill: "#ffffff", stroke: "#000000",
    })),
    labels: [{ id: "header", x: -200, y: -140, width: 200, height: 24, lines: ["Group header"], fontSize: 11, color: "#ffffff", align: "left" }],
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("WebGL projection resource lifecycle (mock GL)", () => {
  it("reuses text textures for position-only snapshots but updates vertex geometry", () => {
    const h = harness(); expect(h.projection.mount()).toBe(true);
    const initial = scene(); h.projection.setSnapshot(initial);
    const uploads = h.calls.texImage2D!.mock.calls.length;
    const geometry = h.projection.getDebugState().geometryUploads;
    const rasterCalls = h.raster.fillText.mock.calls.length;
    const moved = structuredClone(initial); moved.revision = "moved";
    moved.nodes.forEach(node => { node.x += 42; node.y -= 15; });
    moved.labels![0]!.x += 42;
    h.projection.setSnapshot(moved);
    expect(h.calls.texImage2D).toHaveBeenCalledTimes(uploads);
    expect(h.raster.fillText).toHaveBeenCalledTimes(rasterCalls);
    expect(h.projection.getDebugState()).toMatchObject({ revision: "moved", geometryUploads: geometry + 1, labelCount: 3 });
    h.projection.destroy();
  });

  it("updates camera uniforms without any geometry upload or text rasterization", () => {
    const h = harness(); h.projection.mount(); h.projection.setSnapshot(scene());
    const before = h.projection.getDebugState();
    const bufferUploads = h.calls.bufferData!.mock.calls.length;
    h.calls.texImage2D!.mockClear();
    h.projection.setCamera({ x: 170, y: 80, zoom: 0.1 });
    expect(h.calls.bufferData).toHaveBeenCalledTimes(bufferUploads);
    expect(h.calls.texImage2D).not.toHaveBeenCalled();
    expect(h.projection.getDebugState()).toMatchObject({ geometryUploads: before.geometryUploads, cameraUpdates: before.cameraUpdates + 1 });
    expect(h.calls.uniform3f).toHaveBeenLastCalledWith(expect.anything(), 170, 80, 0.1);
    expect(h.projection.getDebugState().drawCalls).toBeGreaterThan(before.drawCalls);
    h.projection.destroy();
  });

  it("rebuilds text on content/width changes and deletes replaced pages", () => {
    const h = harness(); h.projection.mount(); const input = scene(); h.projection.setSnapshot(input);
    const oldTextures = h.gl.createTexture.mock.results.map(result => result.value);
    const uploads = h.calls.texImage2D!.mock.calls.length;
    const renamed = structuredClone(input); renamed.nodes[0]!.labelLines = ["Renamed"];
    h.projection.setSnapshot(renamed);
    expect(h.calls.texImage2D!.mock.calls.length).toBeGreaterThan(uploads);
    for (const texture of oldTextures) expect(h.calls.deleteTexture).toHaveBeenCalledWith(texture);
    const nextUploads = h.calls.texImage2D!.mock.calls.length;
    const resized = structuredClone(renamed); resized.nodes[0]!.width += 10;
    h.projection.setSnapshot(resized);
    expect(h.calls.texImage2D!.mock.calls.length).toBeGreaterThan(nextUploads);
    h.projection.destroy();
  });

  it("keeps every node and standalone label across multiple atlas pages", () => {
    const h = harness(); h.projection.mount(); h.projection.setSnapshot(scene(60));
    const debug = h.projection.getDebugState();
    expect(debug.labelPages).toBeGreaterThan(1);
    expect(debug.labelCount).toBe(61);
    expect(h.calls.texImage2D).toHaveBeenCalledTimes(debug.labelPages);
    expect(h.raster.fillText.mock.calls.map(call => call[0])).toEqual([
      ...Array.from({ length: 60 }, (_, index) => `Node ${index}`), "Group header",
    ]);
    h.projection.destroy();
  });

  it("restores the latest snapshot, camera and selection after context loss", () => {
    const h = harness(); h.projection.mount(); h.projection.setSnapshot(scene());
    const camera = { x: 110, y: 120, zoom: 2 };
    h.projection.setCamera(camera);
    h.projection.setInteractionState({ selectedNodeIds: ["n0"], primarySelectedNodeId: "n0", selectedGraphLinkId: null, hoveredNodeId: null, gestureActive: false });
    const uploads = h.calls.texImage2D!.mock.calls.length;
    expect(h.emit("webglcontextlost").defaultPrevented).toBe(true);
    expect(h.projection.getDebugState().active).toBe(false);
    expect(h.onUnavailable).toHaveBeenCalledWith("WebGL context was lost.");
    const latest = scene(4); latest.revision = "during-loss";
    h.projection.setSnapshot(latest);
    expect(h.calls.texImage2D).toHaveBeenCalledTimes(uploads);
    h.calls.drawArrays!.mockClear();
    h.calls.bufferData!.mockClear();
    h.emit("webglcontextrestored");
    expect(h.calls.drawArrays!.mock.invocationCallOrder[0]).toBeGreaterThan(h.calls.bufferData!.mock.invocationCallOrder[0]!);
    expect(h.onRestored).toHaveBeenCalledTimes(1);
    expect(h.projection.getDebugState()).toMatchObject({ active: true, revision: "during-loss", nodeCount: 4, labelCount: 5, camera, selectedNodeIds: ["n0"] });
    expect(h.calls.texImage2D!.mock.calls.length).toBeGreaterThan(uploads);
    h.projection.destroy();
  });

  it("deletes all owned resources and removes context listeners on destroy", () => {
    const h = harness(); h.projection.mount(); h.projection.setSnapshot(scene(12));
    h.projection.destroy();
    for (const result of h.gl.createTexture.mock.results) expect(h.calls.deleteTexture).toHaveBeenCalledWith(result.value);
    for (const result of h.gl.createBuffer.mock.results) expect(h.calls.deleteBuffer).toHaveBeenCalledWith(result.value);
    for (const result of h.gl.createProgram.mock.results) expect(h.calls.deleteProgram).toHaveBeenCalledWith(result.value);
    expect(h.listeners.size).toBe(0);
    expect(h.projection.getDebugState()).toMatchObject({ active: false, labelPages: 0, labelCount: 0 });
    const draws = h.calls.drawArrays!.mock.calls.length;
    h.emit("webglcontextrestored"); h.projection.setCamera({ x: 0, y: 0, zoom: 1 }); h.projection.destroy();
    expect(h.calls.drawArrays).toHaveBeenCalledTimes(draws);
    expect(h.onRestored).not.toHaveBeenCalled();
  });

  it("reports rasterization failure as inactive rather than throwing from setSnapshot", () => {
    const h = harness(); h.projection.mount();
    h.createElement.mockImplementationOnce(() => ({ width: 0, height: 0, getContext: vi.fn(() => null as unknown as typeof h.raster) }));
    expect(() => h.projection.setSnapshot(scene())).not.toThrow();
    expect(h.projection.getDebugState().active).toBe(false);
    expect(h.onUnavailable).toHaveBeenCalledWith("Text rasterization unavailable.");
    h.projection.destroy();
  });

  it("releases a texture if its paired label buffer allocation fails", () => {
    const h = harness(); h.projection.mount();
    h.gl.createBuffer.mockReturnValueOnce(null as unknown as ReturnType<typeof h.gl.createBuffer>);
    h.projection.setSnapshot(scene());
    expect(h.projection.getDebugState().active).toBe(false);
    expect(h.onUnavailable).toHaveBeenCalledWith("Unable to allocate label atlas.");
    const orphan = h.gl.createTexture.mock.results[0]!.value;
    expect(orphan).toBeTruthy();
    h.projection.destroy();
    expect(h.calls.deleteTexture).toHaveBeenCalledWith(orphan);
  });
});
