// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost/viewer.html?map=test&renderer=svg"}
import {afterEach, expect, it, vi} from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
import base from '../fixtures/shortcut_test.json';
import {keysBetween} from '../../src/shared/record_model/order_key';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// Execute the actual input, scope, camera and retained SVG paths. jsdom supplies
// no font/layout engine: geometry here is deterministic, not browser evidence.
it('creates an outside child during scope exit without leaving the camera at the intermediate zoom', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = new DOMParser().parseFromString(fs.readFileSync(__dirname + '/../../viewer.html', 'utf8'), 'text/html').body.innerHTML;
  vi.stubGlobal('matchMedia', () => ({matches:false, addEventListener(){}, removeEventListener(){}}));
  vi.stubGlobal('ResizeObserver', class {observe(){} unobserve(){} disconnect(){}});
  vi.stubGlobal('EventSource', class {addEventListener(){} close(){}});
  vi.stubGlobal('BroadcastChannel', class {postMessage(){} close(){}});
  vi.stubGlobal('CSS', {escape:(x:string)=>x, supports:()=>false});
  Object.defineProperty(SVGElement.prototype, 'getBBox', {value:()=>({x:0,y:0,width:100,height:40}), configurable:true});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({measureText:(text:string)=>({width:text.length*8}), clearRect(){}, fillText(){}}) as any);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:1200,bottom:800,width:1200,height:800,toJSON(){}});
  const fixture:any=structuredClone(base);
  for(const node of Object.values(fixture.state.nodes) as any[]) {
    const keys=keysBetween(undefined,undefined,node.children.length);
    node.children.forEach((id:string,i:number)=>{fixture.state.nodes[id].edgeOrder=keys[i];});
  }
  vi.stubGlobal('fetch', vi.fn(async (url:any) => new Response(JSON.stringify(String(url).includes('/api/maps/test') ? fixture : {}), {status:200,headers:{'Content-Type':'application/json'}})));
  vi.stubGlobal('VIEWER_TUNING', new Function(ts.transpile(fs.readFileSync(__dirname + '/../../src/browser/viewer.tuning.ts', 'utf8')) + ';return VIEWER_TUNING')());
  const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 0, now = 0;
  vi.stubGlobal('requestAnimationFrame', (fn:FrameRequestCallback) => {frames.set(++nextFrame, fn); return nextFrame;});
  vi.stubGlobal('cancelAnimationFrame', (id:number) => frames.delete(id));
  const frame = () => {const pending=[...frames]; frames.clear(); now+=16; for(const [,fn] of pending) fn(now);};
  await import('../../src/browser/viewer');
  await vi.waitFor(() => expect(document.getElementById('board')?.dataset.ready).toBe('true'));
  const board=document.getElementById('board')!, meta=document.getElementById('meta')!;
  board.focus();
  const press = (key:string, shiftKey=false, ctrlKey=false) => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key,shiftKey,ctrlKey,bubbles:true,cancelable:true})); for(let i=0;i<4;i++) frame();
  };
  const shown = () => [...new Set([...document.querySelectorAll<SVGElement>('.node-hit[data-node-id]')].map(n=>n.dataset.nodeId))].sort();
  press('ArrowRight'); expect(meta.dataset.selectedNodeId).toBe('child-a');
  press('f'); press(']'); expect(meta.dataset.scopeId).toBe('child-a');
  press('ArrowRight'); expect(meta.dataset.selectedNodeId).toBe('grandchild-a1');
  press('F',true); press('['); press(']');
  press('ArrowRight'); expect(meta.dataset.selectedNodeId).toBe('grandchild-a2');
  press('F',true); press('[');
  expect(meta.dataset.scopeId).toBe('root'); expect(meta.dataset.selectedNodeId).toBe('child-a');
  expect(shown()).toHaveLength(7); expect(board.dataset.cameraMoving).toBe('true');
  press('Tab'); const added=meta.dataset.selectedNodeId;
  expect(document.activeElement?.getAttribute('data-node-id')).toBe(added);
  press('Escape');
  expect(shown()).toEqual(['child-a','child-b','child-c','grandchild-a1','grandchild-a2','grandchild-c1',added,'root'].sort());
  expect(board.dataset.cameraMoving).toBeUndefined();
  press('z',false,true); expect(shown()).not.toContain(added); expect(meta.dataset.selectedNodeId).toBe('child-a');
  press('z',true,true); expect(shown()).toContain(added); expect(meta.dataset.selectedNodeId).toBe(added);
}, 20000);
