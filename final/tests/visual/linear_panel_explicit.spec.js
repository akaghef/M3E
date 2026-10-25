const { test, expect } = require('@playwright/test');
const { laneServer } = require('./lane_helpers');
const base = require('../fixtures/shortcut_test.json');

// Functional behavior only; these tests do not measure frame rate.
const open = laneServer(test);
async function append(page, url, text) {
  const origin = new URL(url).origin;
  const mapId = new URL(url).pathname.split('/').at(-1);
  const call = async (name, args) => {
    const r = await page.request.post(`${origin}/api/mcp/call`, { data: { name, arguments: args } });
    const value = await r.json(); expect(value.ok).toBe(true); return value;
  };
  const context = await call('m3e_context', { action: 'enter', target: `m3e://maps/${mapId}` });
  await call('m3e_create', { context_id: context.context_id, kind: 'node', text });
  await call('m3e_context', { action: 'leave', context_id: context.context_id });
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}
async function regenerate(page) {
  const hideInspector = page.getByRole('button', { name: 'Hide inspector', exact: true });
  if (await hideInspector.isVisible()) await hideInspector.click();
  await page.locator('#linear-text').focus();
  await page.locator('#linear-menu-toggle').click();
  await expect(page.locator('#linear-reset')).toBeVisible();
  await page.locator('#linear-reset').click();
}

test('initial display, tree editing and real external append do not generate linear text', async ({ page }) => {
  const { url, read } = await open(page, structuredClone(base));
  const editor = page.locator('#linear-text');
  await expect(editor).toHaveValue('');
  await expect.poll(async () => (await read()).linearNotesByScope || {}).toEqual({});
  await page.locator('#board').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('textarea.inline-node-editor')).toBeVisible();
  await page.locator('textarea.inline-node-editor').fill('Tree edit');
  await page.keyboard.press('Escape');
  await expect(page.locator('textarea.inline-node-editor')).toHaveCount(0);
  await expect(editor).toHaveValue('');
  await expect.poll(async () => Object.values((await read()).nodes).some(n => n.text === 'Tree edit')).toBe(true);
  await append(page, url, 'External append');
  await expect(editor).toHaveValue('');
  await expect.poll(async () => (await read()).linearNotesByScope || {}).toEqual({});
});

test('explicit focus loads text, external append preserves the memo, explicit reload regenerates', async ({ page }) => {
  const { url, read } = await open(page, structuredClone(base));
  const editor = page.locator('#linear-text');
  await editor.focus();
  await expect(editor).toHaveValue(/Test Root/);
  await editor.fill('My scope memo');
  await expect.poll(async () => (await read()).linearNotesByScope?.root).toBe('My scope memo');
  await append(page, url, 'Later child');
  await expect(editor).toHaveValue('My scope memo');
  await expect(editor).toBeFocused();
  await regenerate(page);
  await expect(editor).toHaveValue(/Later child/);
  await expect(editor).not.toHaveValue('My scope memo');
  await expect.poll(async () => (await read()).linearNotesByScope?.root).toMatch(/Later child/);
  await editor.fill('Keyboard refresh');
  await page.locator('#linear-reset').focus();
  await page.keyboard.press('Enter');
  await expect(editor).toHaveValue(/Later child/);
  await expect(page.locator('textarea.inline-node-editor')).toHaveCount(0);
});

test('scope navigation leaves text alone until explicit focus and saves into the correct scope', async ({ page }) => {
  const fixture = structuredClone(base);
  fixture.state.nodes['child-a'].nodeType = 'folder';
  fixture.state.linearNotesByScope = { root: 'Root memo', 'child-a': 'Child memo' };
  const { read } = await open(page, fixture);
  const editor = page.locator('#linear-text');
  await expect(editor).toHaveValue('');
  await editor.focus();
  await expect(editor).toHaveValue('Root memo');
  await page.locator('#board').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-a');
  await page.keyboard.press(']');
  await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'child-a');
  await expect(editor).toHaveValue('Root memo');
  await editor.focus();
  await expect(editor).toHaveValue('Child memo');
  await editor.fill('Edited child memo');
  await expect.poll(async () => (await read()).linearNotesByScope).toMatchObject({ root: 'Root memo', 'child-a': 'Edited child memo' });
});
