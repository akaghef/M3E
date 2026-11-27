import { expect, it } from 'vitest';
import { layout, TreeSpanCache, type LayoutDirection } from '../../src/shared/layout_port';
import { TreeReorder, rotateRange } from '../../src/browser/viewer_delta_reorder';
import { DerivedNodeCache } from '../../src/browser/incremental_scene';

it.each([50,20000])('reorders sibling intervals without inspecting %i unrelated nodes',size=>{
  const children:Record<string,string[]>={root:Array.from({length:size},(_,i)=>`n${i}`)};
  const metrics:any={root:{w:200,h:40}};
  for(let i=0;i<size;i++){children[`n${i}`]=[];metrics[`n${i}`]={w:80,h:30};}
  const graph={nodeIds:Object.keys(metrics),childrenOf:(id:string)=>children[id]!},cache=new TreeSpanCache();
  const current=layout(graph,metrics,'tree',{treeCache:cache}), retained=new TreeReorder(current,graph.childrenOf,id=>cache.span(id),'right');
  let reads=0;
  const unrelated=current.pos[`n${size-1}`]!;
  Object.defineProperty(current.pos,`n${size-1}`,{configurable:true,get:()=>{reads++;return unrelated;}});
  for(let i=0;i<10;i++) {
    const plan=retained.planKey('n1',i%2?'ArrowUp':'ArrowDown')!;
    expect(plan.changed).toHaveLength(2);
    rotateRange(children.root!,plan.from,plan.to);retained.apply(plan);
  }
  expect(reads).toBe(0);
  const full=layout(graph,metrics,'tree');
  expect(current).toEqual(full);
});

it.each(['right','left','down'] as LayoutDirection[])('matches full layout for differently sized subtrees in %s',direction=>{
  const children:Record<string,string[]>={root:['a','b','c'],a:['a1','a2'],a1:[],a2:[],b:['b1'],b1:[],c:[]};
  const metrics=Object.fromEntries(Object.keys(children).map((id,i)=>[id,{w:80+i*20,h:30+i*10}]));
  const graph={nodeIds:Object.keys(children),childrenOf:(id:string)=>children[id]!},cache=new TreeSpanCache();
  const current=layout(graph,metrics,'tree',{treeCache:cache,direction});
  const retained=new TreeReorder(current,graph.childrenOf,id=>cache.span(id),direction);
  for(const to of [2,0,1]) {
    const plan=retained.plan('a',to)!;
    rotateRange(children.root!,plan.from,plan.to);retained.apply(plan);
    const full=layout(graph,metrics,'tree',{direction});
    expect(current).toEqual(full);
  }
});

it('does not reuse mutated layout under the old topology key after cancellation',()=>{
  const children:Record<string,string[]>={root:['a','b'],a:[],b:[]};
  const graph={nodeIds:Object.keys(children),childrenOf:(id:string)=>children[id]!};
  const metrics=Object.fromEntries(graph.nodeIds.map(id=>[id,{w:80,h:30}]));
  const spans=new TreeSpanCache(),cache=new DerivedNodeCache<ReturnType<typeof layout>>();
  const current=cache.get('layout','original',()=>layout(graph,metrics,'tree',{treeCache:spans}));
  const before=structuredClone(current);
  const retained=new TreeReorder(current,graph.childrenOf,id=>spans.span(id),'right',()=>cache.begin(true));
  const plan=retained.plan('a',1)!;rotateRange(children.root!,0,1);retained.apply(plan);
  rotateRange(children.root!,1,0);
  const restored=cache.get('layout','original',()=>layout(graph,metrics,'tree',{treeCache:spans}));
  expect(restored).not.toBe(current);expect(restored).toEqual(before);
});

it.each([50,20000])('replays an incoming child range and its inverse without reading other positions (%i)',size=>{
  const children:Record<string,string[]>={root:Array.from({length:size},(_,i)=>`n${i}`)};
  const metrics:any={root:{w:200,h:40}};
  for(let i=0;i<size;i++){children[`n${i}`]=[];metrics[`n${i}`]={w:80,h:30};}
  const graph={nodeIds:Object.keys(metrics),childrenOf:(id:string)=>children[id]!},cache=new TreeSpanCache();
  const current=layout(graph,metrics,'tree',{treeCache:cache}),retained=new TreeReorder(current,graph.childrenOf,id=>cache.span(id),'right');
  let reads=0;const unrelated=current.pos[`n${size-1}`]!;
  Object.defineProperty(current.pos,`n${size-1}`,{configurable:true,get:()=>{reads++;return unrelated;}});
  for(const values of [['n3','n1','n2'],['n1','n2','n3']]){
    const plan=retained.planRange('root',1,values)!;expect(plan.changed).toHaveLength(3);
    values.forEach((id,i)=>children.root![i+1]=id);retained.apply(plan);expect(reads).toBe(0);
    expect(current).toEqual(layout(graph,metrics,'tree'));reads=0;
  }
});

it.each(['right','left','down'] as LayoutDirection[])('replays subtree permutations in %s with the original paint order as the before image',direction=>{
  const children:Record<string,string[]>={root:['a','b','c'],a:['a1','a2'],a1:[],a2:[],b:['b1'],b1:[],c:[]};
  const metrics=Object.fromEntries(Object.keys(children).map((id,i)=>[id,{w:80+i*20,h:30+i*10}]));
  const graph={nodeIds:Object.keys(children),childrenOf:(id:string)=>children[id]!},cache=new TreeSpanCache();
  const current=layout(graph,metrics,'tree',{treeCache:cache,direction}),retained=new TreeReorder(current,graph.childrenOf,id=>cache.span(id),direction);
  for(const values of [['c','a','b'],['a','b','c']]){
    const before=current.order.slice(1),plan=retained.planRange('root',0,values)!;
    expect(plan.changed).toEqual(before);children.root=values;retained.apply(plan);
    expect(current).toEqual(layout(graph,metrics,'tree',{direction}));
  }
});
