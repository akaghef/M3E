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
    "uniform4f", "uniform1f", "deleteBuffer", "deleteProgram", "useProgram", "uniform3f", "uniform2f", "uniform1i",
    "enableVertexAttribArray", "vertexAttribPointer", "drawArrays", "activeTexture", "clearColor", "clear",
  ].map(name => [name, vi.fn()]));
  const constants = Object.fromEntries([
    "VERTEX_SHADER", "FRAGMENT_SHADER", "COMPILE_STATUS", "LINK_STATUS", "BLEND", "SRC_ALPHA",
    "ONE", "ONE_MINUS_SRC_ALPHA", "DEPTH_TEST", "ARRAY_BUFFER", "STATIC_DRAW", "DYNAMIC_DRAW", "MAX_TEXTURE_SIZE",
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
    save: vi.fn(), transform: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(), setLineDash: vi.fn(), fill: vi.fn(), stroke: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), fillText: vi.fn(), restore: vi.fn(),
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
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const projection = new WebGLRenderingProjection(canvas as unknown as HTMLCanvasElement, { onUnavailable, onRestored, labelMinZoom: 0 });
  const emit = (name: string) => {
    const event = new Event(name, { cancelable: true });
    listeners.get(name)?.(event);
    return event;
  };
  return { projection, gl, calls: noop, canvas, raster, createElement, listeners, onUnavailable, onRestored, emit };
}

function scene(): RenderSnapshot {
  return { revision:"one", bounds:{minX:0,minY:0,maxX:800,maxY:600},groups:[],edges:[],graphLinks:[],
    nodes:[{id:"n0",x:20,y:20,width:140,height:50,label:"Node",labelLines:["Node"],shape:"rect",fill:"white",stroke:"black"}],
    paintScene:{commands:[{kind:"text",nodeId:"n0",text:"Node",x:20,y:50,bounds:{x:20,y:20,width:140,height:50},matrix:[1,0,0,1,0,0],font:"14px sans-serif",style:{fill:"black",stroke:"none",width:0,opacity:1,fillOpacity:1,strokeOpacity:1,cap:"round",join:"round",dash:[],dashOffset:0,fillRule:"nonzero",strokeFirst:false}}]}};
}
afterEach(()=>vi.unstubAllGlobals());
describe("shared retained projection GPU lifecycle",()=>{
  it("reuses unchanged paint and releases every owned resource",()=>{
    const h=harness();expect(h.projection.mount()).toBe(true);h.projection.setSnapshot(scene());h.projection.present();
    const uploads=h.calls.texImage2D.mock.calls.length;expect(uploads).toBeGreaterThan(0);
    h.projection.setSnapshot(scene());h.projection.present();expect(h.calls.texImage2D).toHaveBeenCalledTimes(uploads);
    h.projection.destroy();
    for(const r of h.gl.createTexture.mock.results)expect(h.calls.deleteTexture).toHaveBeenCalledWith(r.value);
    for(const r of h.gl.createBuffer.mock.results)expect(h.calls.deleteBuffer).toHaveBeenCalledWith(r.value);
    for(const r of h.gl.createProgram.mock.results)expect(h.calls.deleteProgram).toHaveBeenCalledWith(r.value);
    expect(h.listeners.size).toBe(0);
  });
  it("camera movement within cached tiles does not upload geometry or textures",()=>{
    const h=harness();h.projection.mount();h.projection.setSnapshot(scene());h.projection.present();
    const geometry=h.projection.getDebugState().geometryUploads,uploads=h.calls.texImage2D.mock.calls.length;
    h.projection.setCamera({x:5,y:5,zoom:1});h.projection.present();
    expect(h.projection.getDebugState().geometryUploads).toBe(geometry);expect(h.calls.texImage2D).toHaveBeenCalledTimes(uploads);h.projection.destroy();
  });
  it("changed text invalidates its paint cache",()=>{
    const h=harness();h.projection.mount();const input=scene();h.projection.setSnapshot(input);h.projection.present();
    const uploads=h.calls.texImage2D.mock.calls.length;const next=structuredClone(input);next.paintScene!.commands[0].text="Renamed";
    h.projection.setSnapshot(next);h.projection.present();expect(h.calls.texImage2D.mock.calls.length).toBeGreaterThan(uploads);
    expect(h.raster.fillText).toHaveBeenCalledWith("Renamed",20,50);h.projection.destroy();
  });
  it("restores the latest scene, camera and selection after context loss",()=>{
    const h=harness();h.projection.mount();h.projection.setSnapshot(scene());h.projection.present();h.projection.setCamera({x:10,y:10,zoom:1});
    h.projection.setInteractionState({selectedNodeIds:["n0"],primarySelectedNodeId:"n0",selectedGraphLinkId:null,hoveredNodeId:null,gestureActive:false});
    expect(h.emit("webglcontextlost").defaultPrevented).toBe(true);const latest=scene();latest.revision="during-loss";h.projection.setSnapshot(latest);
    h.emit("webglcontextrestored");h.projection.present();expect(h.onRestored).toHaveBeenCalledOnce();
    expect(h.projection.getDebugState()).toMatchObject({active:true,revision:"during-loss",selectedNodeIds:["n0"],camera:{x:10,y:10,zoom:1}});h.projection.destroy();
  });
  it("rejects incomplete paint so a Lab cannot downgrade the Viewer",()=>{
    const h=harness();h.projection.mount();const input=scene();delete input.paintScene;
    expect(()=>h.projection.setSnapshot(input)).toThrow("complete paint scene");h.projection.destroy();
  });
});
