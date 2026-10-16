const { test, expect } = require('@playwright/test');
const fixture = require('../fixtures/shortcut_test.json');
test.use({ reducedMotion: 'reduce', viewport: { width: 1600, height: 1000 },
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

for (const renderer of ['svg', 'webgl']) {
  test(`${renderer}: inspector reports real updates without causing scene redraws`, async ({ page }) => {
    await page.route(/\/api\/maps\/[^/?]+$/, route => {
      if (route.request().method() !== 'GET') throw new Error('Unexpected map write');
      return route.fulfill({ json: fixture });
    });
    await page.goto(`/viewer.html?renderer=${renderer}&map=render-metrics-fixture`);
    await expect(page.locator('#board')).toHaveAttribute('data-ready', 'true');
    const panel = page.getByTestId('render-updates');
    const inspector = page.getByTestId('workbench-right-panel');
    await expect(panel).toBeVisible();
    await expect(inspector.getByText('Node actions', { exact: true })).toHaveCount(0);
    await expect(inspector.getByRole('button', { name: 'Add child', exact: true })).toHaveCount(0);
    await expect(panel).toContainText(renderer === 'webgl' ? 'WebGL' : 'SVG');
    const count = key => panel.locator(`[data-metric="${key}"] [data-value="count"]`);
    await expect.poll(async () => Number(await count('render').textContent())).toBeGreaterThan(0);
    if (renderer === 'webgl') await expect.poll(async () => Number(await count('draw').textContent())).toBeGreaterThan(0);
    const revision = await page.locator('#board').getAttribute('data-render-revision');
    await panel.getByRole('button', { name: '描画計測をリセット' }).click();
    await expect(count('render')).toHaveText('0');
    await page.locator('#board').focus();
    await page.keyboard.press('=');
    await expect.poll(async () => Number(await count('applyZoom').textContent())).toBeGreaterThan(0);
    if (renderer === 'webgl') {
      await expect.poll(async () => Number(await count('setCamera').textContent())).toBeGreaterThan(0);
      await expect.poll(async () => Number(await count('draw').textContent())).toBeGreaterThan(0);
    }
    await expect(count('render')).toHaveText('0');
    await expect(count('projection')).toHaveText('0');
    // Once idle, sampling itself must not advance camera/draw counters or render revision.
    await expect(panel.locator('[data-metric="applyZoom"] [data-value="rate"]')).toHaveText('0.0');
    const idle = await panel.locator('[data-value="count"]').allTextContents();
    await page.waitForTimeout(1200);
    expect(await panel.locator('[data-value="count"]').allTextContents()).toEqual(idle);
    await expect(page.locator('#board')).toHaveAttribute('data-render-revision', revision);
    await page.reload();
    await expect(page.locator('#board')).toHaveAttribute('data-ready', 'true');
    await expect(panel).toBeVisible();
    await expect.poll(async () => Number(await count('render').textContent())).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath(`inspector-${renderer}.png`) });
  });
}
