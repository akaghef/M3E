import {describe,it,expect} from 'vitest';
import {enumerateDrawn,orderDrawn,parentChildTarget,cycleDrawn,arrowEndpoint,escapeNode,reconcileSelection,selectionHighlight,selectionTransition,editIntent,canDelete,formatStatus,refKey,selectionReason,
 type Presented,type Scene,type Topology,type KeyInput,type Selection} from '../../src/shared/edge_graphlink_selection';
const topology:Topology={nodes:{root:{parentId:null,children:['a','b']},a:{parentId:'root',children:['c','d']},b:{parentId:'root',children:[]},c:{parentId:'a',children:[]},d:{parentId:'a',children:[]}}};
const item=(id:string,source='a',target='b',x=10,y=0,kind:'graph-link'|'parent-child'='graph-link'):Presented=>({ref:kind==='graph-link'?{kind,renderKey:id,linkIds:[id]}:{kind,parentNodeId:source,childNodeId:target},source:{nodeId:source,renderedNodeId:source,center:{x:0,y:0}},target:{nodeId:target,renderedNodeId:target,center:{x,y}},presentation:{kind:'line',renderKey:id,labelAnchor:{x,y}}});
const scene=(items:Presented[]=[],extra:Partial<Scene>={}):Scene=>({revision:1,items,visibleNodeIds:Object.keys(topology.nodes),notDrawnReasons:{},...extra});
const key=(key:string,extra:Partial<KeyInput>={}):KeyInput=>({key,alt:false,ctrl:false,meta:false,shift:false,repeat:false,textEditing:false,composing:false,boardOwnsInput:true,...extra});
const origin:Selection={kind:'node',nodeId:'a'};
const select=(items:Presented[],input:KeyInput,selection:Selection=origin,extra:Partial<Scene>={})=>selectionTransition({selection,key:input,topology,scene:scene(items,extra),scopeRootId:'root'});
const ids=(items:readonly Presented[])=>items.map(i=>i.presentation.renderKey);
describe('drawn candidates and ordering',()=>{
 it('excludes parent, non-line presentations; includes incoming/outgoing and distinct parallel lines once',()=>{
  const parent=item('parent','root','a',0,0,'parent-child'),child=item('child','a','c',0,0,'parent-child');
  const band={...item('band','a','d',0,0,'parent-child'),presentation:{kind:'lane-band' as const,renderKey:'band',ownerNodeId:'a',labelAnchor:{x:0,y:0}}};
  const outgoing=item('out'),incoming=item('in','b','a'),parallel=item('parallel');
  expect(ids(enumerateDrawn('a',topology,scene([parent,child,band,outgoing,incoming,parallel,outgoing])))).toEqual(['child','out','in','parallel']);
 });
 it.each([5.9,6,6.1])('row boundary %s px',y=>expect(ids(orderDrawn('a',[item('top','a','b',10,0),item('next','a','c',0,y)]))).toEqual(y<=6?['next','top']:['top','next']));
 it('does not chain Y=0/5/10; deterministic under shuffled inputs and does not mutate',()=>{
  const a=[item('zero','a','b',20,0),item('five','a','c',0,5),item('ten','a','d',-20,10)];const before=JSON.stringify(a);
  expect(ids(orderDrawn('a',a))).toEqual(['five','zero','ten']);expect(ids(orderDrawn('a',[a[2],a[0],a[1]]))).toEqual(['five','zero','ten']);expect(JSON.stringify(a)).toBe(before);
 });
 it('ties use Y, kind and stable code-unit identity',()=>{
  expect(ids(orderDrawn('a',[item('z'),item('A'),item('edge','a','c',10,0,'parent-child')]))).toEqual(['edge','A','z']);
  expect(ids(orderDrawn('a',[item('later','a','b',1,5),item('earlier','a','c',1,0)]))).toEqual(['earlier','later']);
 });
 it('CSS zoom changes row membership',()=>expect(ids(orderDrawn('a',[item('top','a','b',20,0),item('other','a','c',0,10)]))).toEqual(['top','other']));
 it('first right/left, both wrap ends, singleton, zero and current outside cycle',()=>{
  const a=item('a'),b=item('b');const list=[a,b];
  for(const [current,step,expected] of [[null,1,a],[null,-1,b],[a.ref,-1,b],[b.ref,1,a],[item('other').ref,1,a]] as const) expect(cycleDrawn(list,current,step)).toEqual({kind:'selected',ref:expected.ref});
  expect(cycleDrawn([a],a.ref,-1)).toEqual({kind:'selected',ref:a.ref});expect(cycleDrawn([],null,1)).toEqual({kind:'none',reason:'no-lines'});
 });
});
describe('direct selection and OP41',()=>{
 it('uses children[0], not screen order, and parent identity',()=>{
  const c=item('c','a','c',100,100,'parent-child'),d=item('d','a','d',0,0,'parent-child'),parent=item('p','root','a',0,0,'parent-child');
  expect(parentChildTarget('a','ArrowDown',topology,scene([d,c]))).toEqual({kind:'selected',ref:c.ref});
  expect(parentChildTarget('a','ArrowUp',topology,scene([parent]))).toEqual({kind:'selected',ref:parent.ref});
  expect(parentChildTarget('root','ArrowUp',topology,scene())).toEqual({kind:'none',reason:'no-parent'});
  expect(parentChildTarget('b','ArrowDown',topology,scene())).toEqual({kind:'none',reason:'no-child'});
 });
 it.each(['collapsed','below-drawn-depth','outside-scope','not-drawn'] as const)('returns %s and restores origin without effects',reason=>{
  expect(select([],key('ArrowDown',{alt:true}),{...item('g').ref,originNodeId:'a'},{visibleNodeIds:['root','a','b'],notDrawnReasons:{c:reason}})).toEqual({kind:'consume',next:origin,reason});
  expect(selectionReason(reason)).toBeTruthy();
 });
});
describe('endpoint axis and state transitions',()=>{
 it.each([[10,0,'ArrowRight','b'],[-10,0,'ArrowLeft','b'],[0,10,'ArrowDown','b'],[0,-10,'ArrowUp','b'],[10,10,'ArrowRight','b'],[-10,10,'ArrowLeft','b'],[10,-10,'ArrowRight','b'],[-10,-10,'ArrowLeft','b'],[1,2,'ArrowUp','a'],[1,0,'ArrowRight','b'],[.5,.5,'ArrowRight',null],[10,0,'ArrowUp',null]] as const)('%s,%s with %s', (x,y,k,id)=>expect(arrowEndpoint(item('g','a','b',x,y),k)).toBe(id));
 it('selection uses primary, retains origin across cycles, Esc returns; node arrows pass',()=>{
  const a=item('g'),b=item('h');const selected={...a.ref,originNodeId:'a'};
  expect(select([a,b],key('ArrowRight',{alt:true}))).toEqual({kind:'consume',next:selected});
  expect(select([a,b],key('ArrowRight',{alt:true,repeat:true}),selected)).toEqual({kind:'consume',next:{...b.ref,originNodeId:'a'}});
  expect(select([a],key('Escape'),selected)).toEqual({kind:'consume',next:origin});
  expect(select([a],key('ArrowDown'),selected)).toEqual({kind:'consume',next:selected});
  expect(select([a],key('ArrowRight'),selected)).toEqual({kind:'consume',next:{kind:'node',nodeId:'b'}});
  expect(select([a],key('ArrowRight'))).toEqual({kind:'pass'});
 });
 it.each([{textEditing:true},{composing:true},{boardOwnsInput:false},{ctrl:true},{meta:true},{shift:true}])('respects guard %j',guard=>expect(select([item('g')],key('ArrowRight',{alt:true,...guard}))).toEqual({kind:'pass'}));
 it('escapes to visible ancestor, root, or null, and reconciles stale membership/deletion',()=>{
  expect(escapeNode('c',topology,['root','a'],'root')).toBe('a');expect(escapeNode('gone',topology,['root'],'root')).toBe('root');expect(escapeNode('gone',topology,[],'root')).toBeNull();
  const i=item('g'),selected={...i.ref,originNodeId:'a'},links={g:{id:'g',sourceNodeId:'a',targetNodeId:'b'}};
  expect(reconcileSelection(selected,topology,links,scene([i]),'root')).toEqual(selected);
  expect(reconcileSelection(selected,topology,{},scene([i]),'root')).toEqual(origin);
  expect(reconcileSelection(selected,topology,links,scene([],{visibleNodeIds:['root']}),'root')).toEqual({kind:'node',nodeId:'root'});
  const edge=item('c','a','c',10,0,'parent-child');expect(reconcileSelection({...edge.ref,originNodeId:'a'},topology,{},scene([edge]),'root')).toEqual({...edge.ref,originNodeId:'a'});
 });
 it('plans both ends and presentation, separate from node selection',()=>{
  const i=item('g');expect(selectionHighlight({...i.ref,originNodeId:'a'},scene([i]))).toEqual({nodeIds:['a','b'],presentation:i.presentation});expect(selectionHighlight(origin,scene([i]))).toEqual({nodeIds:[],presentation:null});
 });
});
describe('status and selection-only editing refusal',()=>{
 it('aggregate is one candidate, count status, all editing refused',()=>{
  const i={...item('aggregate'),ref:{kind:'graph-link' as const,renderKey:'aggregate',linkIds:['one','two','three'] as const}};
  expect(enumerateDrawn('a',topology,scene([i]))).toHaveLength(1);
  expect(formatStatus({kind:'graph-link',sourceLabel:'計画',targetLabel:'実行',graphLinkCount:3,label:'unused'})).toBe('計画 → 実行（GraphLink 3 本）');
  for(const k of ['F2','[',']','S','B','Delete','Backspace','Enter','Tab','m','x','v']) expect(editIntent({...i.ref,originNodeId:'a'},key(k),scene([i]))).toEqual({kind:'blocked',reason:'複数の GraphLink を表す線は編集できません'});
  expect(canDelete(i.ref,scene([i]),true).allowed).toBe(false);
 });
 it('formats label/type, empty and broken names without identifiers',()=>{
  expect(formatStatus({kind:'graph-link',sourceLabel:'A',targetLabel:'B',label:'Label',relationType:'Type'})).toBe('A → B（Label / Type）');
  expect(formatStatus({kind:'graph-link',sourceLabel:'',targetLabel:null})).toBe('名称未設定 → 参照先がありません（GraphLink）');
  expect(formatStatus({kind:'parent-child',sourceLabel:'A',targetLabel:'B'})).toBe('A → B（親子）');
  expect(formatStatus({kind:'parent-child',sourceLabel:'A',targetLabel:'B',label:'補足'})).toBe('A → B（補足）');
  for(const input of [{label:'label'},{relationType:'type'}]) expect(formatStatus({kind:'graph-link',sourceLabel:'A',targetLabel:'B',...input})).toContain(Object.values(input)[0]);
 });
 it('canDelete distinguishes parent, missing, readonly, singleton; no editing runs in this slice',()=>{
  const i=item('g'),s=scene([i]);expect(canDelete(i.ref,s,true)).toEqual({allowed:true});expect(canDelete(i.ref,s,false).allowed).toBe(false);expect(canDelete(i.ref,scene(),true).allowed).toBe(false);expect(canDelete(item('p','a','c',0,0,'parent-child').ref,s,true).allowed).toBe(false);
  expect(editIntent(origin,key('F2'),s)).toEqual({kind:'pass'});expect(editIntent({...i.ref,originNodeId:'a'},key('F2',{textEditing:true}),s)).toEqual({kind:'pass'});
  expect(editIntent({...i.ref,originNodeId:'a'},key('F2'),s).kind).toBe('blocked');
  expect(refKey({...i.ref,kind:'graph-link',renderKey:'g',linkIds:['b','a']})).toBe(refKey({kind:'graph-link',renderKey:'g',linkIds:['a','b']}));
 });
});
