// @vitest-environment jsdom
// DOM ownership/work-count contract; browser geometry/CSS parity is separate.
import { afterEach, expect, it, vi } from 'vitest';
import { captureSvgPaintScene, captureHiddenNodePaint, capturedNodeElements, refreshCapturedNodeFragment } from '../../src/rendering/webgl_scene_tiles';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();delete (SVGElement.prototype as any).getBBox;delete (SVGElement.prototype as any).transform;document.body.replaceChildren();});

it.each([50,20000])('captures only changed fragments without exposing or growing the %i-node SVG',size=>{
  vi.stubGlobal('SVGGeometryElement',SVGElement);
  vi.stubGlobal('SVGTextElement',class {});
  Object.defineProperty(SVGElement.prototype,'transform',{configurable:true,get:function(this:SVGElement){
    const match=/translate\(([-\d.]+) ([-\d.]+)\)/.exec(this.getAttribute('transform')||'');
    return {baseVal:{numberOfItems:match?1:0,getItem:()=>({matrix:{a:1,b:0,c:0,d:1,e:Number(match?.[1]),f:Number(match?.[2])}})}};
  }});
  Object.defineProperty(SVGElement.prototype,'getBBox',{configurable:true,value:function(this:SVGElement){
    expect(this.closest('svg')?.hasAttribute('hidden')).toBe(false);
    return {x:Number(this.getAttribute('x')),y:0,width:20,height:10};
  }});
  const style=vi.fn((element:Element)=>{
    const root=element.closest('svg')!;
    expect(root.hasAttribute('hidden')).toBe(false);
    if(root.hasAttribute('data-capture-stage')) expect(root.querySelectorAll('rect')).toHaveLength(1);
    return {fill:'#123',stroke:'none',strokeWidth:'0',opacity:'1',fillOpacity:'1',strokeOpacity:'1',strokeLinecap:'butt',strokeLinejoin:'miter',
      strokeDasharray:'none',strokeDashoffset:'0',fillRule:'nonzero',paintOrder:'normal',display:'inline',visibility:'visible',getPropertyValue:()=>''};
  });
  vi.stubGlobal('getComputedStyle',style);
  document.body.innerHTML='<div class="board"><svg id="canvas"></svg></div>';
  const root=document.querySelector('svg')!;
  root.innerHTML=Array.from({length:size},(_,i)=>`<g data-render-key="node:n${i}" transform="translate(5 6)"><rect class="node-hit" data-node-id="n${i}" x="${i*30}" width="20" height="10"/></g>`).join('');
  captureSvgPaintScene(root);root.setAttribute('hidden','');
  const mutations=new MutationObserver(()=>{});mutations.observe(root,{attributes:true});
  const fragment=root.firstElementChild as SVGGElement;
  style.mockClear();
  for(let edit=0;edit<25;edit++) {
    fragment.innerHTML=`<rect class="node-hit" data-node-id="n0" x="${edit}" width="20" height="10"/>`;
    refreshCapturedNodeFragment(root,'n0',fragment);
    const result=captureHiddenNodePaint(root,new Set(['n0']));
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]!.matrix).toEqual([1,0,0,1,5,6]);
    expect(capturedNodeElements(root,'n0')).toHaveLength(1);
    expect(root.children).toHaveLength(size);
    expect(document.querySelectorAll('[data-capture-stage]')).toHaveLength(0);
  }
  expect(style.mock.calls.length).toBe(50);
  expect(mutations.takeRecords()).toHaveLength(0);mutations.disconnect();
},30000);

it('removes the temporary capture root after a geometry failure',()=>{
  document.body.innerHTML='<svg><rect class="node-hit" data-node-id="one"/></svg>';
  const root=document.querySelector('svg')!;
  vi.stubGlobal('getComputedStyle',()=>({display:'none'}));
  captureSvgPaintScene(root);root.setAttribute('hidden','');
  vi.stubGlobal('getComputedStyle',()=>{throw new Error('measurement failed');});
  expect(()=>captureHiddenNodePaint(root,new Set(['one']))).toThrow('measurement failed');
  expect(document.querySelectorAll('[data-capture-stage]')).toHaveLength(0);
  expect(root.hasAttribute('hidden')).toBe(true);
});
