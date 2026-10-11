const { test, expect } = require('@playwright/test');
const fixture = require('../fixtures/shortcut_test.json');
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, reducedMotion: 'reduce', viewport: { width: 1600, height: 1000 } });
async function launch(page, renderer, options = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(platform => Object.defineProperty(navigator, 'platform', { get: () => platform }), options.platform || 'Win32');
  const data = structuredClone(fixture);
  if (options.collapsed) data.state.nodes['child-a'].collapsed = true;
  data.state.nodes['child-c'].nodeType = 'folder';
  let writes = 0;
  await page.route(/\/api\/maps\/[^/?]+$/, route => {
    if (route.request().method() !== 'GET') { writes++; return route.fulfill({ json: { ok: true } }); }
    return route.fulfill({ json: data });
  });
  await page.goto(`/viewer.html?renderer=${renderer}&map=fit-fixture${options.surface ? `&surface=${options.surface}` : ''}`);
  await expect(page.locator('#board')).toHaveAttribute('data-ready', 'true');
  if (renderer === 'webgl') await expect(page.locator('#webgl-canvas')).toBeVisible();
  await page.locator('#board').focus();
  return () => writes;
}
async function fit(page, mode, reverse = false) {
  await page.keyboard.press(reverse ? 'Alt+Shift+KeyV' : 'Alt+KeyV');
  await expect(page.locator('#board')).toHaveAttribute('data-fit-mode', mode);
  await expect(page.locator('#status')).toContainText('Fit：');
  // Camera motion is 300 ms when the browser does not honor reduced motion.
  await page.waitForTimeout(350);
}
async function geometry(page, ids = null) {
  return page.evaluate(ids => {
    const canvas = document.querySelector('#canvas');
    const hidden = canvas.hasAttribute('hidden'); canvas.removeAttribute('hidden');
    const m = new DOMMatrixReadOnly(canvas.style.transform), vb = canvas.viewBox.baseVal;
    const camera = { x: m.e-vb.x*m.a, y: m.f-vb.y*m.a, zoom: m.a };
    const boxes = [...canvas.children].filter(el => el.dataset.renderKey?.startsWith('node:') &&
      (!ids || ids.includes(el.dataset.renderKey.slice(5)))).map(el => {
      const b = el.getBBox();
      return { left: camera.x+b.x*camera.zoom, right: camera.x+(b.x+b.width)*camera.zoom,
        top: camera.y+b.y*camera.zoom, bottom: camera.y+(b.y+b.height)*camera.zoom };
    });
    if (hidden) canvas.setAttribute('hidden', '');
    const board = document.querySelector('#board').getBoundingClientRect();
    const panel = document.querySelector('.wb-right-panel').getBoundingClientRect();
    const rail = document.querySelector('.wb-left-rail').getBoundingClientRect();
    const topbar = document.querySelector('.wb-topbar').getBoundingClientRect();
    return { camera, boxes, safe: { left: rail.right-board.left+20, right: panel.left-board.left-20,
      top: topbar.bottom-board.top+20, bottom: board.height-64 } };
  }, ids);
}
async function expectFits(page, ids = null) {
  const { boxes, safe } = await geometry(page, ids);
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.left).toBeGreaterThanOrEqual(safe.left-1); expect(b.right).toBeLessThanOrEqual(safe.right+1);
    expect(b.top).toBeGreaterThanOrEqual(safe.top-1); expect(b.bottom).toBeLessThanOrEqual(safe.bottom+1);
  }
}
for (const renderer of ['svg', 'webgl']) {
  test(`${renderer}: initial graph, forward/reverse targets and selection stability`, async ({ page }) => {
    const writes = await launch(page, renderer);
    await expectFits(page);
    const initial = (await geometry(page)).camera;
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-a');
    await fit(page, 'graph');
    expect((await geometry(page)).camera).toEqual(initial);
    await fit(page, 'subtree'); await expectFits(page, ['child-a', 'grandchild-a1', 'grandchild-a2']);
    expect((await geometry(page)).camera.zoom).toBeGreaterThan(initial.zoom);
    await fit(page, 'graph-linear');
    expect((await geometry(page)).camera.zoom).toBeLessThan(initial.zoom);
    const panel = await page.locator('.linear-panel').boundingBox(), { safe } = await geometry(page);
    expect(panel.x+panel.width).toBeLessThanOrEqual(safe.right+1);
    await fit(page, 'node'); await expectFits(page, ['child-a']);
    expect((await geometry(page)).camera.zoom).toBeLessThanOrEqual(1);
    await fit(page, 'graph');
    for (const mode of ['node', 'graph-linear', 'subtree', 'graph']) await fit(page, mode, true);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-b');
    await fit(page, 'subtree'); await expectFits(page, ['child-b']);
    expect(writes()).toBe(0);
  });
  test(`${renderer}: first reverse, pan/zoom resets, direct fit and scope resets`, async ({ page }) => {
    await launch(page, renderer); await fit(page, 'node', true);
    await page.mouse.move(350, 300); await page.mouse.wheel(30, 80);
    await expect(page.locator('#board')).not.toHaveAttribute('data-fit-mode', /.+/);
    await fit(page, 'graph'); await fit(page, 'subtree');
    await page.keyboard.press('-'); await fit(page, 'graph'); await fit(page, 'subtree');
    await page.mouse.move(160, 760); await page.mouse.down();
    await page.mouse.move(190, 790, { steps: 4 }); await page.mouse.up();
    await fit(page, 'graph'); await fit(page, 'subtree');
    await page.keyboard.press('Control+0');
    await expect(page.locator('#board')).toHaveAttribute('data-fit-mode', 'graph');
    await fit(page, 'graph');
    await page.getByRole('button', { name: 'Camera follow', exact: true }).click();
    await page.locator('#board').focus();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id', 'child-c');
    await fit(page, 'subtree'); await page.keyboard.press(']');
    await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'child-c');
    await fit(page, 'graph'); await fit(page, 'subtree'); await page.keyboard.press('[');
    await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'root'); await fit(page, 'graph');
  });
  test(`${renderer}: collapsed descendants stay hidden; editing does not trigger fit`, async ({ page }) => {
    await launch(page, renderer, { collapsed: true }); await page.keyboard.press('ArrowRight');
    await fit(page, 'graph'); await fit(page, 'subtree');
    await expect(page.locator('[data-render-key="node:grandchild-a1"]')).toHaveCount(0);
    await expectFits(page, ['child-a']); await page.keyboard.press('F2');
    await expect(page.getByRole('textbox', { name: 'Edit node label', exact: true })).toBeFocused();
    const before = (await geometry(page)).camera; await page.keyboard.press('Alt+KeyV');
    expect((await geometry(page)).camera).toEqual(before); await page.keyboard.press('Escape');
    await fit(page, 'graph-linear');
  });
  test(`${renderer}: hidden panel and unpainted selection are skipped`, async ({ page }) => {
    await launch(page, renderer, { surface: 'scatter' });
    await expect(page.locator('.linear-panel')).toBeHidden();
    await fit(page, 'graph'); await fit(page, 'subtree'); await fit(page, 'graph'); await fit(page, 'subtree', true);
  });
}

test('macOS physical Option+V, reverse, command fit and smaller viewport', async ({ page }) => {
  await launch(page, 'svg', { platform: 'MacIntel' });
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.locator('#board').focus();
  await fit(page, 'graph'); await expectFits(page);
  await fit(page, 'node', true); await expectFits(page, ['root']);
  await page.keyboard.press('Meta+0');
  await expect(page.locator('#board')).toHaveAttribute('data-fit-mode', 'graph');
  await fit(page, 'graph');
});
