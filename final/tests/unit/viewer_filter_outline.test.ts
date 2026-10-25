import { describe, expect, it, vi } from 'vitest';
import { WebGLRenderingProjection, hitTestSnapshot } from '../../src/rendering/webgl_projection';

// Buffer contract only; browser pixel acceptance lives in viewer_filter_renderers.spec.js.
describe('filter factor on interaction outlines', () => {
  for (const [kind, alpha] of [['selection', 1], ['hover', .82], ['drag', 1], ['drop', 1]] as const) {
    it(`${kind} scales alpha only, retaining outline geometry and hit testing`, () => {
      const node = {id:'n', x:10, y:20, width:100, height:40, label:'N', labelLines:['N'], shape:'rect' as const, fill:'#fff', stroke:'#000', opacity:1};
      const snapshot = {revision:'test', nodes:[node], edges:[], graphLinks:[], groups:[], bounds:{minX:0,minY:0,maxX:200,maxY:100}};
      const bufferData = vi.fn();
      const projection: any = new WebGLRenderingProjection({addEventListener:vi.fn()} as unknown as HTMLCanvasElement, {onUnavailable:vi.fn(),onRestored:vi.fn()});
      projection.gl = {bindBuffer:vi.fn(),bufferData};
      projection.overlayBuffer = {};
      projection.snapshot = snapshot;
      projection.nodesById = new Map([['n', node]]);
      projection.interaction = {selectedNodeIds:kind==='selection'?['n']:[], primarySelectedNodeId:'n', dragSourceNodeIds:kind==='drag'?['n']:[], hoveredNodeId:kind==='hover'?'n':null, dropTargetNodeId:kind==='drop'?'n':null};
      projection.uploadInteractionGeometry();
      const normal = Array.from(bufferData.mock.calls.at(-1)![1] as Float32Array);
      node.opacity = .18;
      projection.uploadInteractionGeometry();
      const dimmed = Array.from(bufferData.mock.calls.at(-1)![1] as Float32Array);
      expect(normal.length).toBeGreaterThan(0);
      expect(dimmed.length).toBe(normal.length);
      normal.forEach((value,index) => {
        if (index % 6 === 5) {expect(value).toBeCloseTo(alpha);expect(dimmed[index]).toBeCloseTo(alpha*.18);}
        else expect(dimmed[index]).toBe(value);
      });
      expect(hitTestSnapshot(snapshot,{x:50,y:40})).toEqual({kind:'node',nodeId:'n'});
    });
  }
});
