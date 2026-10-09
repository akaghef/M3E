const { test, expect } = require('@playwright/test');
const example = require('../../src/labs/node/fixtures/current-session.json');

async function setup(page, request) {
  const id = `agent-node-${Date.now()}`;
  const makeNode = (id, parentId, children, text) => ({ id, parentId, children, text, nodeType: 'text', collapsed: false, details: '', note: '', link: '', attributes: {} });
  const root = makeNode('root', null, ['agent', 'plain'], 'Agent nodes');
  const agent = makeNode('agent', 'root', [], 'Editable Agent title');
  agent.details = 'Saved display example';
  agent.attributes['m3e:agent'] = JSON.stringify({ ...example, version: 1 });
  const surfaceId = 'surface:root:scatter';
  const state = { rootId: 'root', nodes: { root, agent, plain: makeNode('plain', 'root', [], 'Ordinary node') }, links: {},
    scopes: { 'scope:root': { id: 'scope:root', label: 'Agent nodes', rootNodeIds: ['root'], relationIds: [], primarySurfaceId: surfaceId } },
    surfaces: { [surfaceId]: { id: surfaceId, scopeId: 'scope:root', kind: 'scatter', layout: 'scatter', nodeViews: { agent: { x: 300, y: 220 }, plain: { x: 720, y: 220 } } } } };
  expect((await request.post(`/api/maps/${id}`, { data: { version: 1, savedAt: new Date().toISOString(), state } })).ok()).toBeTruthy();
  await page.goto(`/viewer.html?map=${id}`);
  await expect(page.locator('[data-agent-node-id="agent"]')).toBeVisible();
  return { id, surfaceId, read: async () => (await (await request.get(`/api/maps/${id}`)).json()).state };
}

test('ordinary saved map renders, edits, moves, undoes and reloads Agent nodes without runtime or preview UI', async ({ page, request }, info) => {
  const errors = [], runtimeRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (/\/api\/orrery\/(runtime|events)/.test(req.url())) runtimeRequests.push(req.url()); });
  const { read, surfaceId } = await setup(page, request);
  const node = page.locator('[data-agent-node-id="agent"]');
  const hit = node.locator('.node-hit');
  await expect(page.locator('.agent-map-controls')).toHaveCount(0);
  await expect(page.locator('#readonly-banner')).not.toBeVisible();
  await expect(page.locator('#canvas')).toContainText('Ordinary node');
  await hit.click();
  await expect(hit).toHaveClass(/selected/);
  await page.keyboard.press('Enter');
  const editor = page.locator('textarea.inline-node-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Cancelled change');
  await page.keyboard.press('Escape');
  await expect(node).toContainText('Editable Agent title');
  await page.keyboard.press('Enter');
  await editor.fill('Persisted Agent title');
  await page.locator('#board').click({ position: { x: 550, y: 500 } });
  await expect.poll(async () => (await read()).nodes.agent.text).toBe('Persisted Agent title');
  const before = (await read()).surfaces[surfaceId].nodeViews.agent;
  const box = await hit.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await read()).surfaces[surfaceId].nodeViews.agent).not.toEqual(before);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await read()).surfaces[surfaceId].nodeViews.agent).toEqual(before);
  await page.reload();
  await expect(node).toContainText('Persisted Agent title');
  await expect(page.locator('body')).toHaveClass(/scatter-surface-active/);
  expect((await read()).scopes['scope:root'].primarySurfaceId).toBe(surfaceId);
  expect((await read()).nodes.agent.attributes['m3e:agent']).toBeTruthy();
  expect(runtimeRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('agent-node-normal-map.png'), fullPage: true });
});

test('standard zoom changes Agent detail and the verified icon keeps playing', async ({ page, request }, info) => {
  await setup(page, request);
  const node = page.locator('[data-agent-node-id="agent"]');
  await expect(node).toHaveAttribute('data-lod', 'middle');
  await expect(node.locator('[data-field]')).toHaveCount(3);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(node).toHaveAttribute('data-lod', 'near');
  await expect(node).toContainText('Mac');
  await expect(node).toContainText('M3E');
  const animationPhase = () => node.locator('[data-sprite-frame]').evaluateAll(frames => frames.map(frame => getComputedStyle(frame).opacity).join(','));
  const phase = await animationPhase();
  await expect.poll(animationPhase).not.toBe(phase);
  expect(await node.locator('.agent-card-surface').evaluate(el => getComputedStyle(el).fillOpacity)).toBe('0.1');
  await page.screenshot({ path: info.outputPath('agent-node-near.png'), fullPage: true });
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(node).toHaveAttribute('data-lod', 'far');
  await expect(node.locator('[data-field]')).toHaveCount(0);
  await expect(node.locator('.agent-card-pet')).toHaveCount(1);
});
