import { SaveStateTracker } from '../../src/browser/save_command';
import { keysBetween } from '../../src/shared/record_model/order_key';
import { expect, it, vi } from 'vitest';
import { captureNodeFields, captureStatePatch, applyStatePatch, inverseStatePatch, ChildOrderHistory } from '../../src/browser/viewer_delta_state';
import { rotateRange } from '../../src/browser/viewer_delta_reorder';
import { DeltaBroadcast } from '../../src/browser/viewer_delta_broadcast';

it.each([50, 20000])('undo and redo copy only declared records (%i nodes)', count => {
  const state = { nodes: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i), { text: String(i) }])) };
  const original = state.nodes['1'];
  const patch = captureStatePatch(state, { nodes: ['0', 'new'] });
  expect(patch.records).toHaveLength(2);
  state.nodes['0']!.text = 'changed'; state.nodes.new = { text: 'created' };
  const inverse = captureStatePatch(state, patch.touches);
  applyStatePatch(state, patch); expect(state.nodes['0']!.text).toBe('0'); expect(state.nodes.new).toBeUndefined();
  applyStatePatch(state, inverse); expect(state.nodes['0']!.text).toBe('changed'); expect(state.nodes.new.text).toBe('created');
  expect(state.nodes['1']).toBe(original);
});

it('broadcasts deltas after baseline exchange, recovers gaps and ignores duplicates', () => {
  const state = { nodes: { a: { text: 'before' } } };
  const channel = { postMessage: vi.fn() }, receive = vi.fn();
  const sender = new DeltaBroadcast(channel, 'a', () => ({ state, savedAt: 'base' }), vi.fn());
  const receiver = new DeltaBroadcast(channel, 'b', () => ({ state, savedAt: 'base' }), receive);
  sender.accept({ type: 'STATE_REQUEST', fromTabId: 'b' });
  receiver.accept(channel.postMessage.mock.calls.at(-1)![0]);
  state.nodes.a.text = 'after'; sender.mark({ nodes: ['a'] }); sender.send();
  const first = channel.postMessage.mock.calls.at(-1)![0];
  expect(first.patch.records).toHaveLength(1); expect(first.state).toBeUndefined();
  receiver.accept(first); expect(receive).toHaveBeenCalledTimes(2);
  receiver.accept(first); expect(receive).toHaveBeenCalledTimes(2);
  receiver.accept({ ...first, sequence: 5 });
  expect(channel.postMessage.mock.calls.at(-1)![0]).toMatchObject({ type: 'STATE_REQUEST', to: 'a' });
  sender.send(); expect(channel.postMessage.mock.calls.at(-1)![0].patch.records).toHaveLength(0);
});

it.each([50, 20000])('Grab cancellation, undo, redo and wire payload visit only overwritten child slots (%i)', count => {
  const children = Array.from({length:count},(_,i)=>`n${i}`);
  const state = {nodes:{root:{children}}};
  let unrelatedReads=0;
  Object.defineProperty(children,count-1,{get(){unrelatedReads++;return `n${count-1}`;},configurable:true});
  const history=new ChildOrderHistory();
  history.record('root',children,1,2);rotateRange(children,1,2);
  history.record('root',children,2,3);rotateRange(children,2,3);
  const before=history.patch(),after=inverseStatePatch(state,before);
  expect(before.children).toEqual([{id:'root',index:1,values:['n1','n2','n3']}]);
  expect(history.changed(state.nodes)).toBe(true);
  applyStatePatch(state,before);expect(history.changed(state.nodes)).toBe(false);
  expect(children.slice(0,5)).toEqual(['n0','n1','n2','n3','n4']);
  applyStatePatch(state,after);expect(children.slice(0,5)).toEqual(['n0','n2','n3','n1','n4']);
  const channel={postMessage:vi.fn()};
  const sender=new DeltaBroadcast(channel,'sender',()=>({state,savedAt:'now'}),vi.fn());
  sender.mark(after.touches);sender.childOrder(after.children!);sender.send();
  const message=channel.postMessage.mock.calls[0]![0];
  expect(message.patch.records).toEqual([]);
  expect(message.patch.children).toEqual(after.children);
  const peer={nodes:{root:{children:['n0','n1','n2','n3','n4']}}};
  applyStatePatch(peer,message.patch);expect(peer.nodes.root.children).toEqual(children.slice(0,5));
  expect(unrelatedReads).toBe(0);
});

it('returning to the original order within a Grab records no change',()=>{
  const children=['a','b','c'],history=new ChildOrderHistory();
  history.record('root',children,0,1);rotateRange(children,0,1);
  history.record('root',children,1,0);rotateRange(children,1,0);
  expect(history.changed({root:{children}})).toBe(false);
});

it.each([50, 20000])('Grab edge order survives cancel, redo, save and peer application (%i)', count => {
  const children = Array.from({length:count},(_,i)=>`n${i}`);
  const nodes: Record<string,any> = {root:{id:'root',parentId:null,children}};
  const keys=keysBetween(undefined,undefined,count);
  children.forEach((id,i)=>nodes[id]={id,parentId:'root',children:[],edgeOrder:keys[i],text:id});
  const state={rootId:'root',nodes},base=structuredClone(state),peer=structuredClone(state);
  const tracker=new SaveStateTracker(base,state,{indexedEdges:true}),history=new ChildOrderHistory();
  let unrelatedReads=0;
  Object.defineProperty(children,count-1,{get(){unrelatedReads++;return `n${count-1}`;},configurable:true});
  history.record('root',children,1,2);rotateRange(children,1,2);
  history.recordEdgeOrders(state,'n1',2);tracker.markParentEdge('n1',2);
  const before=history.patch(),after=inverseStatePatch(state,before),movedKey=nodes.n1.edgeOrder;
  expect(before.fields).toHaveLength(1);expect(movedKey).not.toBe(keys[1]);
  applyStatePatch(state,before);expect(nodes.n1.edgeOrder).toBe(keys[1]);
  applyStatePatch(state,after);expect(nodes.n1.edgeOrder).toBe(movedKey);
  tracker.mark(after.touches);
  const captured=tracker.capture();expect(captured.changes).toHaveLength(1);
  expect(captured.changes[0]).toMatchObject({kind:'edge',op:'update'});
  const channel={postMessage:vi.fn()},sender=new DeltaBroadcast(channel,'sender',()=>({state,savedAt:'now'}),vi.fn());
  sender.mark(after.touches);sender.childOrder(after.children!,after.fields);sender.send();
  const patch=channel.postMessage.mock.calls[0]![0].patch;
  expect(patch.records).toEqual([]);expect(patch.fields).toHaveLength(1);
  applyStatePatch(peer,patch);
  expect(peer.nodes.n1.edgeOrder).toBe(movedKey);expect(peer.nodes.root.children.slice(0,4)).toEqual(['n0','n2','n1','n3']);
  expect('edges' in peer).toBe(false);expect(unrelatedReads).toBe(0);
});

it('captures newly inserted neighbours whose edge keys are assigned during a move',()=>{
  const nodes:Record<string,any>={root:{children:['a','new','b','c']},a:{parentId:'root',edgeOrder:'a0'},new:{parentId:'root'},b:{parentId:'root',edgeOrder:'a1'},c:{parentId:'root',edgeOrder:'a2'}};
  const state={nodes},history=new ChildOrderHistory();
  history.record('root',nodes.root.children,2,1);rotateRange(nodes.root.children,2,1);
  history.recordEdgeOrders(state,'b',1);
  const patch=history.patch();expect(patch.fields?.map(f=>f.id)).toEqual(['b','new']);
  nodes.b.edgeOrder='a0V';nodes.new.edgeOrder='a0l';applyStatePatch(state,patch);
  expect(nodes.b.edgeOrder).toBe('a1');expect(Object.hasOwn(nodes.new,'edgeOrder')).toBe(false);
});

it.each([50,20000])('peer order updates a lazy save baseline without reading its whole child list (%i)',count=>{
  const ids=Array.from({length:count},(_,i)=>`n${i}`),keys=keysBetween(undefined,undefined,count);
  const nodes:Record<string,any>={root:{id:'root',parentId:null,children:ids}};
  ids.forEach((id,i)=>nodes[id]={id,parentId:'root',children:[],text:id,edgeOrder:keys[i]});
  const live={rootId:'root',nodes},base=structuredClone(live),tracker=new SaveStateTracker(base,live,{indexedEdges:true});
  rotateRange(ids,1,2);tracker.markParentEdge('n1',2);tracker.capture().accept();
  const getter=Object.getOwnPropertyDescriptor(base.nodes.root,'children')!.get!;
  let baselineReads=0;Object.defineProperty(base.nodes.root,'children',{get(){baselineReads++;return getter();},configurable:true});
  const history=new ChildOrderHistory();history.record('root',ids,2,3);rotateRange(ids,2,3);
  history.recordEdgeOrders(live,'n1',3);tracker.markParentEdge('n1',3);
  const patch=inverseStatePatch(live,history.patch());
  tracker.acceptExternal(patch.touches,(state,keyed)=>applyStatePatch(state,patch,keyed));
  expect(baselineReads).toBe(0);expect(base.nodes.root.children.slice(0,5)).toEqual(['n0','n2','n3','n1','n4']);
  expect(tracker.capture().changes).toEqual([]);
  rotateRange(ids,3,2);tracker.markParentEdge('n1',2);tracker.capture().accept();
  expect(base.nodes.root.children.slice(0,5)).toEqual(['n0','n2','n1','n3','n4']);
});

it.each([50,20000])('property history and its wire payload never read the edited owner children (%i)',count=>{
  const state:any={nodes:{root:{text:'before',children:Array.from({length:count},(_,i)=>`n${i}`)}}};
  const children=state.nodes.root.children;let reads=0;
  Object.defineProperty(state.nodes.root,'children',{get(){reads++;return children;}});
  const before=captureNodeFields(state,['root'],['text','link']);
  state.nodes.root.text='after';state.nodes.root.link='https://example.com';
  const after=inverseStatePatch(state,before);
  applyStatePatch(state,before);expect(state.nodes.root.text).toBe('before');expect('link' in state.nodes.root).toBe(false);
  applyStatePatch(state,after);expect(state.nodes.root.text).toBe('after');
  const channel={postMessage:vi.fn()},sender=new DeltaBroadcast(channel,'sender',()=>({state,savedAt:'now'}),vi.fn());
  sender.mark(after.touches);sender.childOrder([],after.fields);sender.send();
  const patch=channel.postMessage.mock.calls[0]![0].patch;
  expect(patch.records).toEqual([]);expect(patch.fields).toHaveLength(2);
  expect(reads).toBe(0);
});
