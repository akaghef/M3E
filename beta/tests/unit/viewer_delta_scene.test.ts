import { expect, it, vi } from 'vitest';
import { StableScenePatch, SceneBounds } from '../../src/browser/viewer_delta_scene';
import { layout } from '../../src/shared/layout_port';

it.each([50, 20000])('a known same-size edit visits only its layout dependencies (%i nodes)', count => {
  const ids = Array.from({ length: count }, (_, i) => `n${i}`);
  const children = (id: string) => id === 'root' ? ids : [];
  const graph = { nodeIds: ['root', ...ids], childrenOf: children, graphLinks: [] };
  const metrics = Object.fromEntries(graph.nodeIds.map(id => [id, { w: 100, h: 40 }]));
  const before = layout(graph, metrics, 'tree', { displayRootId: 'root' });
  const scene = new StableScenePatch(before);
  graph.nodeIds.forEach(id => scene.remember(id, children(id), 'same dependencies'));
  const read = vi.fn(children), measure = vi.fn(id => metrics[id]), draw = vi.fn();
  expect(scene.apply({ nodes: [ids[0]!] }, { children: read, dependency: () => 'same dependencies', measure, draw })).toBe(true);
  expect(read).toHaveBeenCalledTimes(1); expect(measure).toHaveBeenCalledTimes(1); expect(draw).toHaveBeenCalledTimes(1);
  expect(before).toEqual(layout(graph, metrics, 'tree', { displayRootId: 'root' }));
  // Validate every change before committing any fragment, including a late miss.
  metrics[ids[1]!] = { w: 200, h: 40 }; draw.mockClear();
  expect(scene.apply({ nodes: [ids[0]!, ids[1]!] }, { children, dependency: () => 'same dependencies', measure, draw })).toBe(false);
  expect(draw).not.toHaveBeenCalled();
});

it('updates exact bounds after a former extremum shrinks', () => {
  const bounds = new SceneBounds();
  bounds.set('left', { x: -100, y: -20, width: 10, height: 10 });
  bounds.set('right', { x: 200, y: 30, width: 50, height: 30 });
  expect(bounds.box).toEqual({ x: -100, y: -20, width: 350, height: 80 });
  bounds.set('right', { x: 0, y: 0, width: 10, height: 10 });
  expect(bounds.box).toEqual({ x: -100, y: -20, width: 110, height: 30 });
  bounds.set('unsupported', null); expect(bounds.box).toBeNull();
});

it.each([50,20000])('declared property edits retain layout without querying an owner child list (%i)',count=>{
  const ids=Array.from({length:count},(_,i)=>`n${i}`),children=(id:string)=>id==='root'?ids:[];
  const graph={nodeIds:['root',...ids],childrenOf:children};
  const metrics=Object.fromEntries(graph.nodeIds.map(id=>[id,{w:100,h:40,fontSize:14,labelLines:['before']}]));
  const current=layout(graph,metrics,'tree'),scene=new StableScenePatch(current);
  scene.remember('root',ids,'same topology and style');
  const measure=vi.fn(()=>({w:100,h:40,fontSize:14,labelLines:['after']})),draw=vi.fn();
  expect(scene.apply({nodes:['root'],edges:[]},{children(){throw Error('unneeded child list');},childrenUnchanged:true,dependency:()=> 'same topology and style',measure,draw})).toBe(true);
  expect(measure).toHaveBeenCalledTimes(1);expect(draw).toHaveBeenCalledTimes(1);
  metrics.root!.labelLines=['after'];expect(current).toEqual(layout(graph,metrics,'tree'));
});
