import { expect, it } from 'vitest';
import { createMapNormalizer } from '../../src/browser/viewer_delta_model';
import { applyStatePatch, captureStatePatch } from '../../src/browser/viewer_delta_state';
import type { AppState, TreeNode } from '../../src/shared/types';
const create = () => createMapNormalizer({ rawAttr: (node, key) => node.attributes[key] || '', isFolderNode: node => node.nodeType === 'folder',
  uiLabel: node => node.text, surfaceLayoutForKind: kind => kind === 'system' ? 'flow-lr' : kind === 'mindmap' ? 'tree' : kind });
const node = (id: string, parentId: string | null, children: string[] = []): TreeNode => ({ id, parentId, children, collapsed: false, text: id, details: '', note: '', attributes: {}, link: '' });
it.each([50, 20000])('normalizes one scope without enumerating the node dictionary (%i nodes)', count => {
  const ids = Array.from({ length: count }, (_, i) => `n${i}`);
  const state: AppState = { rootId: 'root', nodes: { root: node('root', null, ids), ...Object.fromEntries(ids.map(id => [id, node(id, 'root')])) }, links: {} };
  const normalizer = create(); normalizer.sanitizeMapModelState(state);
  const before = captureStatePatch(state, normalizer.editTouches(state, [ids[0]!])!);
  state.nodes[ids[0]!]!.nodeType = 'folder';
  const distant = state.nodes[ids[count - 1]!]!;
  Object.defineProperty(state.nodes, ids[count - 1]!, { configurable: true, enumerable: true,
    get() { throw new Error('unrelated node read during local normalization'); } });
  const normalized = normalizer.normalizeTouched(state, [ids[0]!]);
  Object.defineProperty(state.nodes, ids[count - 1]!, { configurable: true, enumerable: true, writable: true, value: distant });
  expect(normalized!.scopes).toEqual([`scope:${ids[0]}`]);
  const expected = structuredClone(state); create().sanitizeMapModelState(expected); expect(state).toEqual(expected);
  applyStatePatch(state, before); normalizer.restoreIndex(state, before.touches);
  const afterUndo = structuredClone(state); create().sanitizeMapModelState(afterUndo); expect(state).toEqual(afterUndo);
});
it('keeps relation membership and order equal to full normalization across nested scopes', () => {
  const state: AppState = { rootId: 'root', nodes: { root: node('root', null, ['a', 'b']), a: node('a', 'root', ['c']), b: node('b', 'root'), c: node('c', 'a') },
    links: { first: { id: 'first', sourceNodeId: 'a', targetNodeId: 'c' }, second: { id: 'second', sourceNodeId: 'b', targetNodeId: 'c' } } };
  const normalizer = create(); normalizer.sanitizeMapModelState(state);
  for (const type of ['folder', undefined, 'folder'] as const) {
    state.nodes.a!.nodeType = type; normalizer.normalizeTouched(state, ['a']);
    const expected = structuredClone(state); create().sanitizeMapModelState(expected); expect(state).toEqual(expected);
  }
});

it.each([50,20000])('normalizes an owner text edit without visiting its descendants (%i)',count=>{
  const ids=Array.from({length:count},(_,i)=>`n${i}`);
  const state:AppState={rootId:'root',nodes:{root:node('root',null,ids),...Object.fromEntries(ids.map(id=>[id,node(id,'root')]))},links:{}};
  const normalizer=create();normalizer.sanitizeMapModelState(state);
  state.nodes.root!.text='edited';
  const children=state.nodes.root!.children;let reads=0;
  Object.defineProperty(state.nodes.root!,'children',{get(){reads++;return children;},configurable:true});
  const scope=state.scopes!['scope:root']!,relations=scope.relationIds;
  Object.defineProperty(scope,'relationIds',{get(){throw Error('unchanged relation collection read');},configurable:true});
  expect(normalizer.normalizeTouched(state,['root'])).toEqual({scopes:[],surfaces:[]});expect(reads).toBe(0);
  Object.defineProperty(scope,'relationIds',{value:relations,writable:true,configurable:true});
  Object.defineProperty(state.nodes.root!,'children',{value:children,writable:true,configurable:true});
  const expected=structuredClone(state);create().sanitizeMapModelState(expected);expect(state).toEqual(expected);
});
