// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { ViewerFilterScene, filterSceneInput } from '../../src/browser/viewer-filter-scene';
import { defaultFilterSelection, evaluateViewFilter } from '../../src/shared/view_filter';
import { RetainedSvgScene } from '../../src/browser/incremental_scene';
it('dims all owned paint, retains geometry/hits, restores base opacity, and survives retained/selection patches', () => {
  document.body.innerHTML='<svg></svg>';const svg=document.querySelector('svg')!;
  const retained=new RetainedSvgScene(), scene=new ViewerFilterScene();
  const markup='<rect class="node-hit" data-node-id="a" x="10" y="20" width="30" height="40"/><path class="node-shape" data-node-id="a" d="M0 0L20 20" style="opacity:0.5"/><text data-node-id="a"><tspan>A</tspan></text><rect class="status-badge"/><text class="status-badge-text">Ready</text><g><rect class="preview"/></g>';
  retained.update(svg,[['node:a',markup],['node:b','<rect class="node-hit" data-node-id="b"/><rect class="node-shape" data-node-id="b"/>'],['links','<path class="graph-link" data-link-id="ab" data-source-node-id="a" data-target-node-id="b" d="M0 0L10 10" marker-end="url(#arrow)"/><path class="graph-link-hit" data-link-id="ab"/><text data-link-id="ab">Relation</text>'],['defs','<defs><marker id="arrow"><path d="M0 0L5 5"/></marker></defs>'],['edge','<path class="edge" data-source-node-id="a" data-target-node-id="b"/><text class="edge-label" data-node-id="b">Child</text>']]);
  const nodes={a:{id:'a',attributes:{importance:'1'}},b:{id:'b',attributes:{importance:'3'}}};
  const links={ab:{id:'ab',sourceNodeId:'hidden',targetNodeId:'hidden2'}};
  const input=filterSceneInput(svg,nodes,links);expect(input.nodes).toHaveLength(2);expect(input.links[0].sourceNodeId).toBe('a');
  const geometry=()=>Array.from(svg.querySelectorAll('*')).map(e=>[e.tagName,...['x','y','width','height','d','marker-end'].map(a=>e.getAttribute(a))]);
  const before=geometry(),selection={...defaultFilterSelection(),importance:'high-plus'};
  const result=evaluateViewFilter(input,selection);scene.apply(svg,result,selection,nodes);
  expect(svg.querySelector<SVGElement>('.node-shape')!.style.opacity).toBe('0.09');
  expect(svg.querySelector<SVGElement>('.status-badge')!.style.opacity).toBe('0.18');expect(svg.querySelector<SVGElement>('.preview')!.style.opacity).toBe('0.18');
  expect(svg.querySelector<SVGElement>('.edge-label')!.style.opacity).toBe('0.18');
  expect(svg.querySelector('.node-hit')!.getAttribute('style')).toBeNull();expect(svg.querySelector('marker path')!.getAttribute('style')).toBeNull();
  scene.apply(svg,result,selection,nodes);expect(svg.querySelector<SVGElement>('.node-shape')!.style.opacity).toBe('0.09');expect(geometry()).toEqual(before);
  retained.patch('node:a',markup.replace('node-shape','node-shape selected'));scene.apply(svg,result,selection,nodes);expect(svg.querySelector<SVGElement>('.selected')!.style.opacity).toBe('0.09');
  const all=defaultFilterSelection();scene.apply(svg,evaluateViewFilter(input,all),all,nodes);expect(svg.querySelector<SVGElement>('.selected')!.style.opacity).toBe('0.5');expect(svg.querySelector('.status-badge')!.getAttribute('style')).toBeNull();expect(geometry()).toEqual(before);
});

it('invalidates cached text/arrow capture and GPU tiles on opacity-only changes', async () => {
  const { vi } = await import('vitest');
  const { captureSvgPaintScene, WebGLSceneTiles } = await import('../../src/browser/webgl_scene_tiles');
  // jsdom supplies DOM ownership/style; only missing SVG geometry and GPU APIs are stubbed.
  vi.stubGlobal('SVGTextElement', class { static [Symbol.hasInstance](e: Element) { return e.tagName === 'text'; } });
  vi.stubGlobal('SVGGeometryElement', class { static [Symbol.hasInstance](e: Element) { return e.tagName === 'path'; } });
  vi.stubGlobal('CSS', {escape:(s:string)=>s});
  const computed = getComputedStyle;
  vi.stubGlobal('getComputedStyle', (e: Element) => {
    const css = computed(e);
    return new Proxy(css, {get(target,key) {
      const defaults: Record<string,string> = {opacity:'1',fillOpacity:'1',strokeOpacity:'1',fill:'#222',stroke:'none',strokeDasharray:'none',paintOrder:'normal',fontSize:'12px'};
      const value = Reflect.get(target,key);
      return typeof value === 'function' ? value.bind(target) : value || defaults[String(key)] || '';
    }});
  });
  try {
    document.body.innerHTML='<svg><defs><marker id="arrow"><path d="M0 0L5 5"/></marker></defs><g data-render-key="node:a"><path class="node-hit" data-node-id="a" d="M0 0L10 10"/><text data-node-id="a"><tspan>Alpha</tspan></text></g><path class="graph-link" data-link-id="ab" data-source-node-id="a" data-target-node-id="b" d="M0 0L10 10" style="marker-end:url(#arrow)"/></svg>';
    const root=document.querySelector('svg')!;
    root.querySelectorAll('*').forEach((e:any)=>{e.getBBox=()=>({x:0,y:0,width:10,height:10});e.getNumberOfChars=()=>5;e.getStartPositionOfChar=()=>({x:0,y:5});e.getTotalLength=()=>10;e.getPointAtLength=(x:number)=>({x,y:0});});
    const marker:any=root.querySelector('marker');marker.viewBox={baseVal:{width:10,height:10}};
    for(const key of ['markerWidth','markerHeight','refX','refY'])marker[key]={baseVal:{value:1}};
    const input={nodes:[{id:'a',attributes:{importance:'1'}},{id:'b',attributes:{importance:'3'}}],links:[{id:'ab',sourceNodeId:'a',targetNodeId:'b'}]};
    const normal=captureSvgPaintScene(root);expect(normal.commands.some(c=>c.kind==='text')).toBe(true);
    const context:any={measureText:()=>({width:10})};for(const method of ['save','restore','transform','setTransform','clearRect','setLineDash','fill','stroke','fillText','strokeText','fillRect'])context[method]=vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
    vi.stubGlobal('Path2D',class{});
    const gl:any={createTexture:()=>({})};for(const method of ['deleteTexture','bindTexture','texParameteri','pixelStorei','texImage2D'])gl[method]=vi.fn();
    const tiles=new WebGLSceneTiles(gl);tiles.setScene(normal);tiles.draw({x:0,y:0,zoom:1},100,100,1,()=>{});expect(tiles.cacheSize).toBeGreaterThan(0);
    const scene=new ViewerFilterScene(),selection={...defaultFilterSelection(),importance:'high-plus'};
    scene.apply(root,evaluateViewFilter(input,selection),selection,Object.fromEntries(input.nodes.map(n=>[n.id,n])));
    const dim=captureSvgPaintScene(root,undefined,true);
    expect(dim.commands.filter(c=>c.kind==='text').map(c=>c.style.opacity)).toEqual([0.18]);
    expect(dim.commands.filter(c=>c.kind==='path'&&!c.editorBody).map(c=>c.style.opacity)).toEqual([0.18,0.18]);
    tiles.setScene(dim);expect(tiles.cacheSize).toBe(0);
    const all=defaultFilterSelection();scene.apply(root,evaluateViewFilter(input,all),all,Object.fromEntries(input.nodes.map(n=>[n.id,n])));
    expect(captureSvgPaintScene(root,undefined,true)).toEqual(normal);
  } finally { vi.restoreAllMocks();vi.unstubAllGlobals(); }
});

it('Axial stems use both parent and child, while decorations stay in the scene', () => {
  document.body.innerHTML='<svg><path class="timeline-stem" data-node-id="child" d="M0 0L10 10"/><circle class="timeline-dot" data-node-id="child"/><rect class="lane-boundary"/><text class="lane-count">1 個</text></svg>';
  const root=document.querySelector('svg')!,nodes={parent:{id:'parent',attributes:{importance:'1'}},child:{id:'child',parentId:'parent',attributes:{importance:'3'}}};
  const input={nodes:Object.values(nodes),links:[]},selection={...defaultFilterSelection(),importance:'high-plus'};
  new ViewerFilterScene().apply(root,evaluateViewFilter(input,selection),selection,nodes);
  expect(root.querySelector<SVGElement>('.timeline-stem')!.style.opacity).toBe('0.18');
  for(const selector of ['.timeline-dot','.lane-boundary','.lane-count'])expect(root.querySelector(selector)!.getAttribute('style')).toBeNull();
});

it('dims visible Disperse hit circles while preserving transparent hit rectangles', () => {
  document.body.innerHTML='<svg><circle class="node-hit scatter-node-circle" data-node-id="low" cx="20" cy="30" r="10" style="opacity:0.8;pointer-events:all"/><rect class="node-hit" data-node-id="low" x="1" width="20"/></svg>';
  const svg=document.querySelector('svg')!, circle=svg.querySelector<SVGElement>('circle')!, scene=new ViewerFilterScene();
  const nodes={low:{id:'low',attributes:{importance:'1'}}}, input={nodes:Object.values(nodes),links:[]};
  const selection={...defaultFilterSelection(),importance:'high-plus'};
  scene.apply(svg,evaluateViewFilter(input,selection),selection,nodes);
  expect(Number(circle.style.opacity)).toBeCloseTo(.144);
  expect(circle.style.pointerEvents).toBe('all');expect(circle.getAttribute('r')).toBe('10');
  expect(svg.querySelector('rect')!.getAttribute('style')).toBeNull();
  const all=defaultFilterSelection();scene.apply(svg,evaluateViewFilter(input,all),all,nodes);
  expect(circle.style.opacity).toBe('0.8');
});
