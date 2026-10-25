const { test, expect } = require('@playwright/test');
test.use({ launchOptions: { args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] } });
const routes = [
  ['node/node-lab.html', '.card-cell'],
  ['node-draw/node-lab.html', '#sample'],
  ['viewer/viewer-panel-seam-lab.html', '#entity-list-tree'],
  ['force/force-lab.html', '#render-host canvas'],
  ['agent-orrery/agent-orrery-lab.html', '[data-testid="m3e-surface"]'],
  ['ot/routes/surface-overview.html', '#wrap .bay'],
  ['ot/routes/agent-detail.html', '#term'],
];
for (const [route, selector] of routes) {
  test(`daily application serves compiled ${route}`, async ({ page }, info) => {
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    await page.goto(`/src/labs/${route}`);
    await expect(page).toHaveURL(new RegExp(`/dist/browser/src/labs/${route.replaceAll('.', '\\.')}($|\\?)`));
    if (route.startsWith('viewer/')) await page.getByRole('checkbox', {name:'entity-list-panel',exact:true}).check();
    await expect(page.locator(selector).first()).toBeVisible();
    if (route.startsWith('force/')) {
      await expect(page.locator('#renderer-status')).toHaveText('WebGL2');
      expect(await page.evaluate(() => window.forceLab.renderer().active)).toBe(true);
      await page.locator('#tune-toggle').click();
      await expect(page.locator('#tuning')).toBeVisible();
      await page.locator('#close-tuning').click();
      await page.locator('#node-picker').selectOption({ index: 1 });
      await expect(page.locator('#selection')).toBeVisible();
      await page.locator('#pin').click();
      await expect(page.locator('#pin')).toHaveText('固定解除');
      await page.locator('#fit').click();
    }
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
    await page.screenshot({ path: info.outputPath('compiled-lab.png'), fullPage: true });
  });
}
