// A scope is a plane (record-schema DA59): each parent-child edge lies on one scope.
// A child of a scope's entry can stay outside that scope, beside the entry.
// Temporary workspace through lane_helpers; no personal data.
const { test, expect } = require('@playwright/test');
const { laneServer } = require('./lane_helpers');
const base = require('../fixtures/shortcut_test.json');
const open = laneServer(test);

const shown = page => page.locator('.node-hit[data-node-id]').evaluateAll(nodes => [...new Set(nodes.map(n => n.dataset.nodeId))].sort());

test('a child outside a scope shows beside the entry and not inside; Shift+F moves a child across', async ({ page }) => {
  const { read } = await open(page, structuredClone(base));

  // Scopen child-a through the viewer, enter it and move a1 outside with Shift+F.
  await page.locator('#board').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-a');
  await page.keyboard.press('f');
  await expect.poll(async () => (await read()).nodes['child-a'].nodeType).toBe('folder');
  await page.keyboard.press(']');
  await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'child-a');
  await expect.poll(() => shown(page)).toEqual(['child-a', 'grandchild-a1', 'grandchild-a2']);
  await page.locator('.node-hit[data-node-id="grandchild-a1"]').first().click();
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'grandchild-a1');
  await page.keyboard.press('Shift+F');
  await expect.poll(() => shown(page)).toEqual(['child-a', 'grandchild-a2']);
  await page.keyboard.press('[');
  await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'root');

  // Root scope: the entry child-a with its outside child a1; a2 is inside child-a and hidden.
  await expect.poll(() => shown(page)).toEqual(['child-a', 'child-b', 'child-c', 'grandchild-a1', 'grandchild-c1', 'root']);

  // Inside child-a: a2 shows, a1 does not.
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-a');
  await page.keyboard.press(']');
  await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'child-a');
  await expect.poll(() => shown(page)).toEqual(['child-a', 'grandchild-a2']);

  // Shift+F on a2 moves it outside child-a: it leaves this scope and shows at the root scope.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'grandchild-a2');
  await page.keyboard.press('Shift+F');
  await expect.poll(() => shown(page)).toEqual(['child-a']);
  await page.keyboard.press('[');
  await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'root');
  await expect.poll(() => shown(page)).toEqual(['child-a', 'child-b', 'child-c', 'grandchild-a1', 'grandchild-a2', 'grandchild-c1', 'root']);

  // A child added under the entry while at the root scope stays outside it (DA56).
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-a');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await shown(page)).length).toBe(8);

  // The marks are saved: a1, a2 and the new child stay outside child-a.
  await expect.poll(async () => {
    const nodes = (await read()).nodes;
    return nodes['child-a'].children.map(id => nodes[id].edgeOutsideScope === true);
  }).toEqual([true, true, true]);

  // Unscopen child-a: all its children lie on the root scope again and the marks go.
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-a');
  await page.keyboard.press('f');
  await expect.poll(async () => {
    const nodes = (await read()).nodes;
    return [nodes['child-a'].nodeType ?? 'text', ...nodes['child-a'].children.map(id => nodes[id].edgeOutsideScope ?? null)];
  }).toEqual(['text', null, null, null]);
});
