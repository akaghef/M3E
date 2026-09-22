import { it, expect } from 'vitest';
import { normalizeCodexAppSnapshot } from '../../src/shared/orrery_observation';
import { projectOrreryMap, orreryRuntimeNodeId } from '../../src/shared/orrery_map';
import type { AppState } from '../../src/shared/types';
const t='2026-09-22T00:00:00Z';
function fixture(){
 const snapshot=normalizeCodexAppSnapshot({schema_version:1,generated_at:t,runtimes:['a','b'].map((id,i)=>({external_id:id,session_id:id,agent_name:'same',program:'codex',state:'idle',last_seen_at:t,capabilities:[],...(i?{parent_external_id:'a'}:{})}))},{id:'src',hostId:'host'});
 const state:AppState={rootId:'root',nodes:{root:{id:'root',parentId:null,children:[],text:'Authored',details:'details',note:'note',link:'',collapsed:false,attributes:{role:'Director'}}},surfaces:{main:{id:'main',scopeId:'root',kind:'scatter',layout:'scatter',nodeViews:{root:{x:123,y:456}}}}};return {snapshot,state};
}
it('materializes deterministic runtime nodes/GraphLinks without touching author data or coordinates',()=>{
 const {snapshot,state}=fixture(),before=JSON.stringify(state),p=projectOrreryMap(state,snapshot);
 expect(p.runtimeNodeIds).toHaveLength(2);expect(p.runtimeLinkIds).toHaveLength(1);expect(JSON.stringify(state)).toBe(before);
 p.state.nodes.root.attributes.role='changed';p.state.surfaces!.main.nodeViews!.root.x=999;
 expect(JSON.stringify(state)).toBe(before);expect(projectOrreryMap(state,snapshot).runtimeNodeIds).toEqual(p.runtimeNodeIds);
});
it('keeps observations separate from bound authoring fields',()=>{
 const {snapshot,state}=fixture(),p=projectOrreryMap(state,snapshot,[{actorId:snapshot.actors[0].id,mapNodeId:'root'}]);
 expect(p.state.nodes.root.text).toBe('Authored');expect(p.state.nodes.root.attributes).toEqual({role:'Director'});expect(p.actorByNodeId.root.name).toBe('same');expect(p.runtimeNodeIds).toHaveLength(1);
});
it('rejects malformed bindings and collisions',()=>{
 const {snapshot,state}=fixture();expect(()=>projectOrreryMap(state,snapshot,[{actorId:snapshot.actors[0].id,mapNodeId:'missing'}])).toThrow('invalid_binding');
 const id=orreryRuntimeNodeId(snapshot.actors[0].id);state.nodes[id]={...state.nodes.root,id};expect(()=>projectOrreryMap(state,snapshot)).toThrow('id_collision');
});
