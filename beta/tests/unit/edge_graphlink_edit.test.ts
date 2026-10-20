import {describe,it,expect} from 'vitest';
import {editIntent,labelChange,nextPort,nextStyle,nextDirection,formatStatus} from '../../src/shared/edge_graphlink_edit';
import type {KeyInput,Scene,Selection,Presented} from '../../src/shared/edge_graphlink_selection';
import type {GraphLink,LinkPort,LinkStyle,LinkDirection} from '../../src/shared/types';
const selection:Selection={kind:'graph-link',renderKey:'drawn',linkIds:['link'],originNodeId:'a'};
const item:Presented={ref:selection,source:{nodeId:'a',renderedNodeId:'a',center:{x:0,y:0}},target:{nodeId:'b',renderedNodeId:'b',center:{x:10,y:10}},presentation:{kind:'line',renderKey:'drawn',labelAnchor:{x:5,y:5}}};
const scene:Scene={revision:1,items:[item],visibleNodeIds:['a','b'],notDrawnReasons:{}};
const links:Record<string,GraphLink>={link:{id:'link',sourceNodeId:'a',targetNodeId:'b',attributes:{keep:'yes'}}};
const key=(value:string,extra:Partial<KeyInput>={}):KeyInput=>({key:value,shift:false,ctrl:false,meta:false,alt:false,repeat:false,composing:false,textEditing:false,boardOwnsInput:true,...extra});
const run=(value:string,extra:Partial<KeyInput>={},sel:Selection=selection,s:Scene=scene,writable=true)=>editIntent(sel,key(value,extra),s,links,writable);
describe('line edit intents',()=>{
 it('cycles every supported value and default',()=>{
  expect(([undefined,'auto','right','bottom','left','top'] as (LinkPort|undefined)[]).map(nextPort)).toEqual(['right','right','bottom','left','top','right']);
  expect(([undefined,'default','dashed','soft','emphasis'] as (LinkStyle|undefined)[]).map(nextStyle)).toEqual(['dashed','dashed','soft','emphasis','default']);
  expect(([undefined,'none','forward','backward','both'] as (LinkDirection|undefined)[]).map(nextDirection)).toEqual(['forward','forward','backward','both','none']);
 });
 it.each([['F2',false,'label'],['[',false,'port'],[']',false,'port'],['S',true,'style'],['b',true,'direction'],['Delete',false,'delete'],['Backspace',false,'delete']] as const)('%s proposes one intent without mutation',(value,shift,kind)=>{
  const before=structuredClone(links);const r=run(value,{shift});expect(r).toMatchObject({kind:'edit',intent:{kind}});expect(links).toEqual(before);
 });
 it('keeps source and target ports distinct',()=>{expect(run('[')).toMatchObject({intent:{endpoint:'source',value:'right'}});expect(run(']')).toMatchObject({intent:{endpoint:'target',value:'right'}});});
 it.each(['F2','[',']','Delete','Backspace','S','B'])('blocks %s for readonly/repeat/stale/aggregate',value=>{
  const extra={shift:['S','B'].includes(value)};
  expect(run(value,extra,selection,scene,false).kind).toBe('blocked');expect(run(value,{...extra,repeat:true}).kind).toBe('blocked');expect(run(value,extra,selection,{...scene,items:[]}).kind).toBe('blocked');
  const aggregate:Selection={kind:'graph-link',renderKey:'drawn',linkIds:['link','second'],originNodeId:'a'},s={...scene,items:[{...item,ref:aggregate}]};
  expect(run(value,extra,aggregate,s)).toMatchObject({kind:'blocked',reason:'複数の GraphLink を表す線は編集できません'});expect(run(value,extra,selection,s).kind).toBe('blocked');
 });
 it('respects text entry, IME and input ownership',()=>{for(const extra of [{textEditing:true},{composing:true},{boardOwnsInput:false}])expect(run('F2',extra)).toEqual({kind:'pass'});});
 it('blocks extra modifiers and node mutations, preserves history dispatch',()=>{for(const extra of [{alt:true},{ctrl:true},{meta:true},{shift:true}])expect(run('F2',extra).kind).toBe('blocked');for(const value of ['Enter','Tab','m','p','x','v'])expect(run(value).kind).toBe('blocked');expect(run('z',{meta:true})).toEqual({kind:'pass'});});
 it('permits only labels on parent-child edges',()=>{const parent:Selection={kind:'parent-child',parentNodeId:'a',childNodeId:'b',originNodeId:'a'},s={...scene,items:[{...item,ref:parent}]};expect(run('F2',{},parent,s)).toMatchObject({kind:'edit',intent:{kind:'label',ref:{kind:'parent-child',childNodeId:'b'}}});for(const value of ['[',']','Delete','Backspace','S','B'])expect(run(value,{shift:['S','B'].includes(value)},parent,s).kind).toBe('blocked');});
 it('rejects a deleted saved link',()=>expect(editIntent(selection,key('F2'),scene,{},true).kind).toBe('blocked'));
 it('distinguishes unchanged labels from removal',()=>{expect(labelChange('a',' a ')).toBe(null);expect(labelChange(undefined,' ')).toBe(null);expect(labelChange('a',' ')).toBe('');expect(labelChange('a',' b ')).toBe('b');expect(labelChange(' a ','a')).toBe('a');});
 it('formats names and aggregate counts without identifiers',()=>expect(formatStatus({kind:'graph-link',sourceLabel:' ',targetLabel:null,graphLinkCount:3})).toBe('名称未設定 → 参照先がありません（GraphLink 3 本）'));
});
