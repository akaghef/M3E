import { expect, it, vi } from 'vitest';
import { NodePresence } from '../../src/browser/viewer_delta_presence';
import type { AppState } from '../../src/shared/types';

it.each([50, 20000])('presence updates inspect only the written node in %i nodes', size => {
  const state = { nodes: Object.fromEntries(Array.from({length:size}, (_, i) => [`n${i}`, {id:`n${i}`, attributes:{}}])) } as AppState;
  const read = vi.fn(node => node.attributes.agent === 'yes');
  const presence = new NodePresence(read);
  expect(presence.has(state)).toBe(false); read.mockClear();
  for (let i=0; i<100; i++) {
    state.nodes.n0!.attributes.agent = i%2 ? 'no' : 'yes';
    presence.change(state, ['n0']);
    for (let j=0; j<5; j++) expect(presence.has(state)).toBe(i%2===0);
  }
  expect(read).toHaveBeenCalledTimes(100);
  state.nodes.n0!.attributes.agent = 'yes'; presence.change(state, undefined, true);
  expect(presence.has(state)).toBe(true);
  const replacement = {nodes:{}} as AppState;
  expect(presence.has(replacement)).toBe(false);
});
