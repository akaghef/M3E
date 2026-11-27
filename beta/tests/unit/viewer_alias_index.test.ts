import {expect,it} from 'vitest';
import {AliasIndex} from '../../src/browser/viewer_delta_alias';
import type {AppState} from '../../src/shared/types';
it.each([50,20000])('reads only aliases of the renamed target (%i)',count=>{
  const state={rootId:'root',nodes:Object.fromEntries(Array.from({length:count},(_,i)=>[`n${i}`,{id:`n${i}`,text:'name',children:[]}]))} as unknown as AppState;
  state.nodes.a={id:'a',nodeType:'alias',targetNodeId:'n0',text:'name',children:[]} as any;
  const index=new AliasIndex();index.change(state);
  Object.defineProperty(state.nodes,`n${count-1}`,{get(){throw Error('unrelated node read');},configurable:true});
  expect(index.forTarget(state,'n0')).toEqual(['a']);
  state.nodes.a!.targetNodeId='n1';index.change(state,['a']);
  expect(index.forTarget(state,'n0')).toEqual([]);expect(index.forTarget(state,'n1')).toEqual(['a']);
  state.nodes.a!.aliasLabel='explicit';expect(index.forTarget(state,'n1')).toEqual([]);
  delete state.nodes.a;index.change(state,['a']);expect(index.forTarget(state,'n1')).toEqual([]);
});
