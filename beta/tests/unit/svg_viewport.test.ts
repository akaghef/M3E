// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {RetainedSvgScene} from '../../src/browser/incremental_scene';
import {logicalSvgRoot,viewportBox,type SvgBox} from '../../src/rendering/svg_viewport';

afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren();});
// A static inventory: jsdom eagerly rebuilds an accessed live HTMLCollection on
// every mutation, which would make the observation itself quadratic.
const mounted=(root:Element)=>{const result:Element[]=[];for(let el=root.firstElementChild;el;el=el.nextElementSibling)result.push(el);return result;};
const svg=()=>{const root=document.createElementNS('http://www.w3.org/2000/svg','svg');document.body.append(root);return root;};

it.each([50,20000])('mounts only viewport fragments and updates an offscreen node without a scene scan (%i)',count=>{
  const root=svg(),scene=new RetainedSvgScene<SvgBox>();
  const markup=(i:number,y=i*100)=>`<circle class="node-hit" data-node-id="n${i}" cx="20" cy="${y+20}" r="20"/><text x="20" y="${y+20}">Node ${i}</text>`;
  scene.update(root,Array.from({length:count},(_,i)=>[`node:n${i}`,markup(i)]));
  const bounds=vi.fn((key:string)=>scene.derived(key,html=>({x:0,y:Number(/cy="(\d+)"/.exec(html)![1])-20,width:100,height:40})));
  const last=scene.element(`node:n${count-1}`)!,hit=last.firstElementChild;
  scene.virtualize(root,{x:0,y:0,width:500,height:400},bounds);
  expect(mounted(root)).toHaveLength(5);expect(last.isConnected).toBe(false);
  expect(logicalSvgRoot(last.parentElement!)).toBe(root);
  bounds.mockClear();
  for(let i=0;i<10;i++)scene.refreshViewport({x:0,y:i%2*100,width:500,height:400});
  expect(bounds).not.toHaveBeenCalled();expect(mounted(root)).toHaveLength(5);
  scene.patch(`node:n${count-1}`,markup(count-1,50));scene.refreshViewport();
  expect(bounds).toHaveBeenCalledTimes(1);expect(last.firstElementChild).toBe(hit);
  scene.refreshViewport({x:0,y:0,width:500,height:400});
  expect(last.isConnected).toBe(true);expect(mounted(root)).toHaveLength(6);
  const resume=scene.suspendViewport();expect(mounted(root)).toHaveLength(count);
  scene.refreshViewport({x:0,y:0,width:500,height:400});expect(mounted(root)).toHaveLength(count);
  resume();expect(mounted(root)).toHaveLength(6);
  scene.materialize();expect(mounted(root)).toHaveLength(count);
  expect(root.lastElementChild).toBe(last);
  scene.refreshViewport();expect(mounted(root)).toHaveLength(6);
},30000);

it('retains scatter endpoint references across animated frames, addition and edge editing',()=>{
  const root=svg(),scene=new RetainedSvgScene();
  const body=(id:string,x:number)=>`<circle class="scatter-node-circle node-hit" data-node-id="${id}" cx="${x}" cy="20" r="20"/><text data-node-id="${id}">${id}</text>`;
  scene.update(root,[['node:a',body('a',20)],['node:b',body('b',80)]]);
  const a=root.querySelector('[data-node-id=a]')!,b=root.querySelector('[data-node-id=b]')!;
  for(let frame=0;frame<25;frame++){
    scene.update(root,[['edges',''],['node:a',body('a',20+frame)],['node:b',body('b',80-frame)],...(frame>10?[['node:c',body('c',120)] as [string,string]]:[])],frame===11);
    expect(root.querySelector('[data-node-id=a]')).toBe(a);expect(a.isConnected).toBe(true);
    expect(root.querySelector('[data-node-id=b]')).toBe(b);expect(b.isConnected).toBe(true);
  }
  scene.patch('edges','<path class="graph-link" data-source-node-id="a" data-target-node-id="b" d="M44 20L56 20"/>');
  expect(root.querySelector('.graph-link')).not.toBeNull();expect(a.isConnected&&b.isConnected).toBe(true);
});

it('preserves canonical order across mounted and parked sibling moves',()=>{
  const root=svg(),scene=new RetainedSvgScene();
  scene.update(root,['a','b','c','d'].map(id=>[id,`<rect data-node-id="${id}"/>`]));
  const boxes:Record<string,SvgBox>=Object.fromEntries(['a','b','c','d'].map((id,i)=>[id,{x:0,y:i*100,width:30,height:30}]));
  scene.virtualize(root,{x:0,y:0,width:100,height:150},key=>boxes[key]);
  scene.reorder(['b','c'],['c','b']);
  scene.materialize();expect([...mounted(root)].map(el=>(el as SVGElement).dataset.renderKey)).toEqual(['a','c','b','d']);
  scene.refreshViewport({x:0,y:0,width:100,height:500});expect(mounted(root)).toHaveLength(4);
  expect(viewportBox(-100,-200,2,400,300,100)).toEqual({x:0,y:50,width:300,height:250});
});
