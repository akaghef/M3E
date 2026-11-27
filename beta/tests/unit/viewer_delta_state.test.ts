import { expect, it, vi } from 'vitest';
import { captureStatePatch, applyStatePatch } from '../../src/browser/viewer_delta_state';
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
