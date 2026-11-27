import { expect, it, vi } from 'vitest';
import { captureStatePatch, applyStatePatch, inverseStatePatch, ChildOrderHistory } from '../../src/browser/viewer_delta_state';
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
