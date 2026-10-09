const { test, expect } = require('@playwright/test');

test('Agent-only map uses the Viewer camera and Lab renderer without backend or persistence', async ({ page }, info) => {
  const api = [], failures = [], errors = [];
  page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) api.push(req.url()); });
  page.on('response', res => { if (res.status() >= 400 && res.url().startsWith('http://127.0.0.1:')) failures.push(`${res.status()} ${res.url()}`); });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__previewChannels = [];
    for (const name of ['EventSource', 'BroadcastChannel']) {
      const Original = window[name];
      window[name] = class extends Original {
        constructor(url, ...args) { window.__previewChannels.push(`${name}:${url}`); super(url, ...args); }
      };
    }
  });
  // A conflicting live query must not escape preview isolation.
  await page.goto('/viewer.html?preview=agent-nodes&network=1&map=existing-personal-map');
  const nodes = page.locator('#canvas [data-agent-node-id]');
  await expect(nodes).toHaveCount(10);
  await expect(page).toHaveTitle('M3E - Agent nodes');
  await expect(page.locator('#canvas .node-hit')).toHaveCount(0);
  await expect(page.locator('#canvas .graph-link')).toHaveCount(0);
  await page.getByLabel('Agent node display').selectOption('near');
  await expect(nodes.first()).toContainText('Mac');
  await expect(nodes.first()).toContainText('M3E');
  await expect(nodes.first().locator('animate')).not.toHaveCount(0);
  expect(await nodes.first().locator('.agent-card-surface').first().evaluate(el => getComputedStyle(el).fillOpacity)).toBe('0.1');
  const before = await nodes.first().getAttribute('transform');
  const box = await nodes.first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  await expect(nodes.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(nodes.first()).not.toHaveAttribute('transform', before);
  await page.getByRole('button', {name:'配置を戻す',exact:true}).click();
  await expect(nodes.first()).toHaveAttribute('transform', before);
  await page.getByLabel('Agent node display').selectOption('middle');
  await expect(nodes.first()).not.toContainText('Mac');
  await expect(nodes.first()).toContainText('Agent 01');
  await expect(nodes.first()).toContainText('SeamLab');
  await page.getByLabel('Icon animation').uncheck();
  await expect(nodes.locator('animate')).toHaveCount(0);
  await page.getByLabel('Icon animation').check();
  await expect(nodes.first().locator('animate')).not.toHaveCount(0);
  await page.getByLabel('Agent node display').selectOption('auto');
  const zoomBefore = await page.locator('.agent-map-controls output').textContent();
  await page.getByRole('button', {name:'Zoom out',exact:true}).click();
  await expect(page.locator('.agent-map-controls output')).not.toHaveText(zoomBefore);
  for (let i = 0; i < 8; i++) await page.getByRole('button', {name:'Zoom out',exact:true}).click();
  await expect(nodes.first()).toHaveAttribute('data-lod', 'far');
  await page.getByRole('button',{name:'全体表示',exact:true}).click();
  await expect(nodes.first()).not.toHaveAttribute('data-lod', 'far');
  // Existing canvas pan uses the same transform, and must not move map coordinates.
  const canvas = page.locator('#canvas');
  const transform = await canvas.getAttribute('style');
  const board = await page.locator("#board").boundingBox();
  const panX = board.x + board.width - 100, panY = board.y + board.height / 2;
  await page.mouse.move(panX, panY);
  await page.mouse.down();
  await page.mouse.move(panX - 60, panY + 30, {steps:4});
  await page.mouse.up();
  await expect(canvas).not.toHaveAttribute('style', transform);
  await page.getByRole('button',{name:'全体表示',exact:true}).click();
  await page.screenshot({path:info.outputPath('agent-node-map.png')});
  expect(api).toEqual([]);
  expect(await page.evaluate(() => window.__previewChannels)).toEqual([]);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
  await page.getByRole('link',{name:'Agent node Lab',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Agent node · Session Lab'})).toBeVisible();
  await page.getByRole('link',{name:'Agent node をマップで見る →'}).click();
  await expect(nodes).toHaveCount(10);
  await page.getByRole('link',{name:'M3E Seam Labs',exact:true}).click();
  await page.getByRole('link',{name:'Open Agent node map',exact:true}).click();
  await expect(nodes).toHaveCount(10);
});

test('normal Viewer still opens its requested map without the preview layer', async ({page}) => {
  const requests = [], errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget { close() {} };
  });
  await page.route('**/api/**', route => route.fulfill({ json: { enabled:false } }));
  await page.route('**/api/maps/ordinary-viewer-example', route => route.fulfill({ json: {
    version:1, savedAt:'2026-10-09T00:00:00Z', state:{rootId:'root',nodes:{root:{
      id:'root', parentId:null, children:[], text:'Ordinary map', nodeType:'text', collapsed:false,
      details:'', note:'', link:'', attributes:{}
    }}}
  }}));
  await page.goto('/viewer.html?map=ordinary-viewer-example');
  await expect(page.locator('#canvas')).toContainText('Ordinary map');
  await expect(page.locator('[data-agent-node-id]')).toHaveCount(0);
  await expect(page.locator('.agent-map-controls')).toHaveCount(0);
  await expect(page.locator('#orrery-network-toggle')).toBeVisible();
  expect(requests.some(url => url.endsWith('/api/maps/ordinary-viewer-example'))).toBeTruthy();
  expect(requests.some(url => /assets\/agent-map-preview-/.test(url))).toBeFalsy();
  expect(errors).toEqual([]);
});
