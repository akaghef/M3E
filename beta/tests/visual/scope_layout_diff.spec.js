const { test, expect } = require('@playwright/test');
const { laneServer } = require('./lane_helpers');
const base = require('../fixtures/shortcut_test.json');
const open = laneServer(test);
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
const work = page => page.locator('#board').evaluate(el => JSON.parse(el.dataset.editWork));
const geometry = page => page.locator('.node-hit').evaluateAll(nodes => nodes.map(n =>
  [n.dataset.nodeId, ...['x', 'y', 'width', 'height'].map(a => n.getAttribute(a))]));

// Real Core commit + SSE reload in a temporary workspace. Counters assert work
// avoidance, not frame rate. Inspect every render, not only the last frame.
async function external(page, url, id, text, create = false) {
  const origin = new URL(url).origin, mapId = new URL(url).pathname.split('/').at(-1);
  const call = async (name, args) => {
    const value = await (await page.request.post(`${origin}/api/mcp/call`, { data: { name, arguments: args } })).json();
    expect(value.ok).toBe(true); return value;
  };
  const context = await call('m3e_context', { action: 'enter', target: `m3e://maps/${mapId}` });
  await page.evaluate(() => {
    window.layoutWork = [];
    window.layoutObserver?.disconnect();
    window.layoutObserver = new MutationObserver(records => {
      for (const r of records) if (r.attributeName === 'data-edit-work')
        window.layoutWork.push(JSON.parse(r.target.dataset.editWork));
    });
    window.layoutObserver.observe(document.querySelector('#board'), { attributes: true });
  });
  await call(create ? 'm3e_create' : 'm3e_update', { context_id: context.context_id,
    kind: create ? 'node' : 'content', target: `m3e://maps/${mapId}/nodes/${id}`, text });
  await call('m3e_context', { action: 'leave', context_id: context.context_id });
  await expect.poll(() => page.evaluate(() => window.layoutWork.length)).toBeGreaterThan(0);
  return page.evaluate(() => window.layoutWork);
}
async function enterA(page) {
  await page.locator('#board').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-a');
  await page.keyboard.press(']');
  await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'child-a');
}
for (const renderer of ['svg', 'webgl']) {
  test(`${renderer}: unrelated scope edits and append reuse layout; affected edits invalidate it`, async ({ page }) => {
    const fixture = structuredClone(base);
    fixture.state.nodes['child-a'].nodeType = 'folder';
    fixture.state.nodes['child-c'].nodeType = 'folder';
    const { url } = await open(page, fixture, { renderer, surfaceReady: true });
    if (renderer === 'webgl') await expect.poll(() => page.evaluate(() => Boolean(window.__m3eWebGLProjection?.getDebugState().active))).toBe(true);
    const rootGeometry = await geometry(page);
    await enterA(page);
    const before = await geometry(page);
    for (const create of [false, true]) {
      const records = await external(page, url, create ? 'child-c' : 'grandchild-c1', create ? 'New hidden child' : 'Hidden edit\nextra lines', create);
      expect(records.every(w => w.layouts === 0 && w.measured === 0 && w.branches === 0)).toBe(true);
      expect(await geometry(page)).toEqual(before);
    }
    const records = await external(page, url, 'grandchild-a1', 'Visible edit\nsecond\nthird\nfourth');
    expect(records.some(w => w.layouts === 1 && w.measured === 1)).toBe(true);
    expect(await geometry(page)).not.toEqual(before);
    await expect(page.locator('text[data-node-id="grandchild-a1"]')).toContainText('Visible edit');
    await page.locator('#board').focus(); await page.keyboard.press('[');
    await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'root');
    expect(await work(page)).toMatchObject({ layouts: 0, measured: 0, branches: 0 });
    expect(await geometry(page)).toEqual(rootGeometry);
  });
  test(`${renderer}: cross-scope alias dependency is updated`, async ({ page }) => {
    const fixture = structuredClone(base);
    fixture.state.nodes['child-c'].nodeType = 'folder';
    Object.assign(fixture.state.nodes['child-b'], { nodeType: 'alias', targetNodeId: 'grandchild-c1', aliasLabel: '', access: 'read' });
    const { url } = await open(page, fixture, { renderer, surfaceReady: true });
    if (renderer === 'webgl') await expect.poll(() => page.evaluate(() => Boolean(window.__m3eWebGLProjection?.getDebugState().active))).toBe(true);
    const records = await external(page, url, 'grandchild-c1', 'Referenced text\nextra line\nmore');
    expect(records.some(w => w.layouts === 1 && w.measured === 1)).toBe(true);
    await expect(page.locator('text[data-node-id="child-b"]')).toContainText('Referenced text');
  });
}
test('Lane reuses placement for unrelated content and invalidates visible dimensions', async ({ page }) => {
  const fixture = structuredClone(base);
  fixture.state.nodes['child-c'].nodeType = 'folder';
  const { url } = await open(page, fixture);
  await page.locator('#board').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.wb-progressive-nav[data-pn-mode="active-node"].is-open')).toBeVisible();
  await page.locator('[data-pn-node="lane-root"]').click();
  await expect(page.locator('#board')).toHaveAttribute('data-lane-state', 'ready');
  const before = await geometry(page);
  const unchanged = await external(page, url, 'grandchild-c1', 'Hidden Lane edit');
  expect(unchanged.every(w => w.layouts === 0 && w.measured === 0)).toBe(true);
  expect(await geometry(page)).toEqual(before);
  const changed = await external(page, url, 'grandchild-a1', 'Visible Lane edit\nsecond\nthird');
  expect(changed).toEqual(expect.arrayContaining([expect.objectContaining({ layouts: 1, measured: 1 })]));
  expect(await geometry(page)).not.toEqual(before);
});

for (const mode of ['timeline', 'system']) {
  test(`${mode}: reuse unchanged scope and refresh settings and preview dependencies`, async ({ page }) => {
    const fixture = structuredClone(base);
    fixture.state.nodes['child-a'].nodeType = 'folder';
    fixture.state.nodes['child-c'].nodeType = 'folder';
    const { url, read } = await open(page, fixture);
    await page.evaluate(mode => window.dispatchEvent(new CustomEvent('m3e:set-surface-layout', { detail: { mode } })), mode);
    await expect(page.locator('html')).toHaveAttribute('data-surface-view-mode', mode);
    await expect.poll(async () => (await read()).scopes?.['scope:root']?.primarySurfaceId).toBe(`surface:root:${mode}`);
    const before = await geometry(page);
    const unchanged = await external(page, url, 'grandchild-c1', 'Hidden edit');
    expect(unchanged.every(w => w.layouts === 0 && w.measured === 0)).toBe(true);
    expect(await geometry(page)).toEqual(before);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('m3e:set-surface-layout', { detail: { direction: 'down', space: 'loose' } })));
    expect((await work(page)).layouts).toBe(1);
    await expect.poll(async () => (await read()).surfaces?.[`surface:root:${mode}`]?.surfaceView).toMatchObject({ direction: 'down', space: 'loose' });
    if (mode === 'system') {
      await page.locator('#board').focus(); await page.keyboard.press('j');
      const previewBefore = await geometry(page);
      const changed = await external(page, url, 'grandchild-c1', 'Preview changed\nsecond\nthird\nfourth\nfifth');
      expect(changed).toEqual(expect.arrayContaining([expect.objectContaining({ layouts: 1, measured: 1 })]));
      expect(await geometry(page)).not.toEqual(previewBefore);
    }
  });
}
