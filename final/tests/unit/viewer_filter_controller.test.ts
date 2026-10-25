import { expect, it } from 'vitest';
import { ViewerFilterController } from '../../src/browser/viewer-filter-controller';
const input = { nodes:[{id:'a',attributes:{domain:'Research'}}], links:[] };
it('resets only on map transitions and rejects late old-map scenes', () => {
  const c = new ViewerFilterController();let notifications=0;const unsubscribe=c.subscribe(()=>notifications++);
  c.enterMap('one');c.setScene('one',input);c.select('domain',['Research']);c.openMenu('domain');
  c.enterMap('one');expect(c.getSnapshot().open).toBe('domain');expect(c.getSnapshot().result.nodes.size).toBe(1);
  c.setScene('one',{nodes:[{id:'none'}],links:[]});expect(c.getSnapshot().result.active).toBe(false);expect(c.getSnapshot().open).toBeNull();expect(c.getSnapshot().selection.domain).toEqual(['Research']);
  c.setScene('one',input);expect(c.getSnapshot().result.active).toBe(true);
  c.setScene('one',{nodes:[{id:'other',attributes:{domain:'Other'}}],links:[]});expect(c.getSnapshot().result.nodes.size).toBe(0);expect(c.getSnapshot().selection.domain).toEqual(['Research']);
  c.enterMap('two');expect(c.getSnapshot().result.active).toBe(false);expect(c.getSnapshot().selection.domain).toEqual([]);
  expect(c.setScene('one',input)).toBe(false);expect(c.getSnapshot().result.nodeCount).toBe(0);
  c.setScene('two',input);c.select('domain',['Missing']);c.clear();expect(c.getSnapshot().result.nodes.size).toBe(1);
  expect(new ViewerFilterController().getSnapshot().selection.domain).toEqual([]);
  expect(notifications).toBeGreaterThan(0);unsubscribe();
});
