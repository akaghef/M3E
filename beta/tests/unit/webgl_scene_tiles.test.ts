import { afterEach, describe, expect, it, vi } from "vitest";
import { PaintIndex, WebGLSceneTiles, cameraBounds, intersects, tileCoordinates, translatePaintScene, replaceNodePaint, sceneWorldBounds, type PaintCommand } from "../../src/browser/webgl_scene_tiles";

function label(index: number): PaintCommand {
  return {
    kind: "text", text: `日本語ラベル ${index}`, nodeId: `n${index}`,
    x: 20, y: index*80+30, bounds: {x:20,y:index*80,width:300,height:45},
    matrix: [1,0,0,1,0,0], font: 'normal 400 30px sans-serif',
    style: {fill:"#222",stroke:"none",width:0,opacity:1,fillOpacity:1,strokeOpacity:1,
      cap:"round",join:"round",dash:[],dashOffset:0,fillRule:"nonzero",strokeFirst:false},
  };
}
function harness() {
  const context: any = {};
  for (const method of ["save","restore","transform","setTransform","clearRect","setLineDash","fill","stroke","fillText","strokeText","fillRect"]) context[method] = vi.fn();
  context.measureText = () => ({width:100});
  vi.stubGlobal("document", {createElement: () => ({getContext: () => context})});
  vi.stubGlobal("Path2D", class { constructor(public path: string) {} });
  const gl: any = {};
  for (const method of ["deleteTexture","bindTexture","texParameteri","pixelStorei","texImage2D"]) gl[method] = vi.fn();
  gl.createTexture = () => ({});
  return {context,gl,tiles:new WebGLSceneTiles(gl)};
}
afterEach(() => vi.unstubAllGlobals());

describe("retained WebGL scene tiles", () => {
  it("includes negative world geometry without rewriting its coordinates", () => {
    const box = {x:-900,y:-1200,width:300,height:200};
    expect(sceneWorldBounds(box,1600,900)).toEqual({minX:-932,minY:-1232,maxX:1600,maxY:900});
    const {tiles,context} = harness();
    const command = {...label(0),bounds:box,x:-900,y:-1170};
    tiles.setScene({commands:[command]});
    tiles.draw({x:950,y:1250,zoom:1},400,300,1,()=>{});
    expect(context.fillText).toHaveBeenCalledWith(command.text,-900,-1170);
    expect(command.bounds).toEqual(box);
  });
  it("retains unaffected paint and stacking order when changing selection", () => {
    const first = label(0), second = label(1), third = label(2);
    const selected = {...second,font:'normal 600 30px sans-serif'};
    const result = replaceNodePaint({commands:[first,second,third]},{commands:[selected]},new Set(['n1']));
    expect(result.commands).toEqual([first,selected,third]);
    expect(result.commands[0]).toBe(first);
    expect(result.commands[2]).toBe(third);
  });
  it("invalidates only tiles touched by old/new selection paint", () => {
    const {tiles,gl} = harness();
    const original = {...label(0),x:40,y:150,bounds:{x:40,y:100,width:100,height:80}};
    tiles.setScene({commands:[original,label(10)]});
    tiles.draw({x:0,y:0,zoom:1},1000,1000,1,()=>{});
    const count = tiles.cacheSize;
    const before = gl.texImage2D.mock.calls.length;
    tiles.updateNodePaint({commands:[{...original,font:'normal 600 30px sans-serif'}]},new Set(['n0']));
    expect(tiles.cacheSize).toBe(count-1);
    tiles.draw({x:0,y:0,zoom:1},1000,1000,1,()=>{});
    expect(gl.texImage2D.mock.calls.length-before).toBe(1);
  });
  it("uses camera inverse coordinates including overscan", () => {
    expect(cameraBounds({x:100,y:-200,zoom:0.5},800,600,100)).toEqual({x:-400,y:200,width:2000,height:1600});
    expect(tileCoordinates({x:-10,y:-10,width:20,height:20},1)).toEqual([{x:-1,y:-1},{x:0,y:-1},{x:-1,y:0},{x:0,y:0}]);
  });
  it("retains paint order and crossing paths with both endpoints off screen", () => {
    const crossing = {...label(0),kind:"path" as const,path:"M -100000 20 C -1000 80 1000 80 100000 20",bounds:{x:-100000,y:20,width:200000,height:60}};
    const commands = [label(0),crossing,label(1)];
    expect(new PaintIndex(commands).query({x:0,y:0,width:100,height:200})).toEqual([0,1,2]);
    expect(intersects(crossing.bounds,{x:0,y:0,width:100,height:200})).toBe(true);
  });
  it("moves node paint and incident Disperse edge paint with drag hit geometry", () => {
    const edge: PaintCommand = {...label(0),kind:"path",nodeId:undefined,path:"M 0 0 L 100 200",sourceNodeId:"n0",targetNodeId:"n1"};
    const scene = {commands:[label(0),edge]};
    const moved = translatePaintScene(scene,new Set(["n0"]),{x:10,y:20});
    expect(moved.commands[0]!.matrix).toEqual([1,0,0,1,10,20]);
    expect(moved.commands[1]!.path).toBe("M 10 20 L 100 200");
    expect(scene.commands[1]!.path).toBe("M 0 0 L 100 200");
  });
  it("draws late Japanese labels below 18%, without a global atlas capacity limit", () => {
    const {tiles,context} = harness();
    tiles.setScene({commands:Array.from({length:2000},(_,i)=>label(i))});
    tiles.draw({x:0,y:-1999*80*0.15,zoom:0.15},800,600,2,()=>{});
    expect(context.fillText.mock.calls.some(([text]: string[])=>text==='日本語ラベル 1999')).toBe(true);
    expect(context.fillText.mock.calls.length).toBeLessThan(200);
    expect(tiles.visibleTextCount).toBeGreaterThan(0);
  });
  it("reuses cached pixels, refines on demand, and never hides labels at any zoom", () => {
    const {tiles,gl,context} = harness();
    tiles.setScene({commands:[label(0)]});
    const camera = {x:0,y:0,zoom:0.15};
    tiles.draw(camera,400,300,2,()=>{});
    const uploads = gl.texImage2D.mock.calls.length;
    tiles.draw(camera,400,300,2,()=>{});
    expect(gl.texImage2D.mock.calls.length).toBe(uploads);
    tiles.refine({x:0,y:0,zoom:0.5},2);
    tiles.draw({x:0,y:0,zoom:0.5},400,300,2,()=>{});
    expect(context.fillText).toHaveBeenCalledWith('日本語ラベル 0',20,30);
    expect(tiles.visibleTextCount).toBe(1);
  });
  it("bounds the cache without discarding visible text when moving across a large map", () => {
    const {tiles} = harness();
    tiles.setScene({commands:Array.from({length:2000},(_,i)=>label(i))});
    for (let i=0;i<30;i++) tiles.draw({x:0,y:-i*1000,zoom:1},400,300,1,()=>{});
    expect(tiles.cacheSize).toBeLessThanOrEqual(64);
    expect(tiles.visibleTextCount).toBeGreaterThan(0);
  });
  it("suppresses only the edited node label, restoring it on commit/cancel", () => {
    const {tiles,context} = harness();
    tiles.setScene({commands:[label(0),label(1)]});
    tiles.setEditingNode('n0');
    tiles.draw({x:0,y:0,zoom:1},400,300,1,()=>{});
    expect(context.fillText.mock.calls.some(([text]:string[])=>text==='日本語ラベル 0')).toBe(false);
    tiles.setEditingNode(null);
    tiles.draw({x:0,y:0,zoom:1},400,300,1,()=>{});
    expect(context.fillText.mock.calls.some(([text]:string[])=>text==='日本語ラベル 0')).toBe(true);
  });
});
