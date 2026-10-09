// Synthetic transport on the isolated e2e server; no ordinary workspace or port 4173.
const { test, expect } = require('@playwright/test');

function observation(revision = '1') {
  const observedAt = `2026-09-22T00:00:0${revision}.000Z`;
  const provenance = { sourceId: 'synthetic', hostId: 'test-host', sourceRecordId: 'fixture', observedAt, revision };
  const actor = (id, name) => ({ id: `orrery:synthetic:test-host:${id}`, externalId: id, kind: 'ai', name, backend: 'codex', title: 'Synthetic task', message: revision === '1' ? 'Working' : 'Changed observation', rawState: 'thinking', lifecycleState: 'thinking', observationState: 'observed', lastActiveAt: observedAt, capabilities: [], provenance: { ...provenance, sourceRecordId: id } });
  return { schema: 'm3e.orrery.v1', revision, generatedAt: observedAt, sources: [{ id: 'synthetic', hostId: 'test-host', state: 'connected', observedAt, revision }], actors: [actor('alpha', 'Test Alpha'), actor('beta', 'Test Beta')], relations: [{ id: 'relation', sourceActorId: 'orrery:synthetic:test-host:alpha', targetActorId: 'orrery:synthetic:test-host:beta', type: 'handoff', evidenceIds: ['mail'], provenance }], evidence: [{ id: 'mail', sourceActorId: 'orrery:synthetic:test-host:alpha', targetActorId: 'orrery:synthetic:test-host:beta', sentAt: observedAt, subject: 'Synthetic evidence', body: 'Delivery is not completion.', deliveryState: 'submitted', provenance }], attention: [] };
}

async function setup(page, request) {
  const id = `orrery-${Date.now()}`;
  const node = (id, parentId, children, text) => ({ id, parentId, children, text, nodeType: 'text', collapsed: false, details: '', note: '', link: '', attributes: {} });
  const state = { rootId: 'root', nodes: { root: node('root', null, ['task'], 'Authoring root'), task: node('task', 'root', [], 'Human task') } };
  expect((await request.post(`/api/maps/${id}`, { data: { version: 1, savedAt: '2026-09-22T00:00:00.000Z', state } })).ok()).toBeTruthy();
  await page.route('**/api/orrery/runtime', route => route.fulfill({ json: observation() }));
  // Only runtime SSE is replaced; normal map save/watch routes remain real.
  await page.addInitScript(() => {
    const Original = window.EventSource;
    window.EventSource = class extends EventTarget {
      constructor(url, options) {
        super();
        if (!String(url).includes('/api/orrery/events')) return new Original(url, options);
        window.__orreryTestStream = this;
      }
      close() { this.closed = true; }
    };
  });
  await page.goto(`/viewer.html?localMapId=${id}&network=1`);
  await expect(page.locator('[data-orrery-node-id]')).toHaveCount(2);
  await page.locator('#orrery-network-panel summary').click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Fit map + NETWORK', exact: true }).click();
  return { id, before: await (await request.get(`/api/maps/${id}`)).json() };
}

test('NETWORK shares the Viewer canvas, protects authoring, updates evidence, and rolls back', async ({ page, request }, info) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const { id, before } = await setup(page, request);
  const cards = page.locator('#canvas [data-orrery-node-id]');
  await expect(cards).toHaveCount(2);
  await expect(page.locator('#canvas')).toContainText('Human task');
  await expect(page.getByRole('button', { name: 'Send instruction — unavailable' })).toBeDisabled();
  await cards.first().dispatchEvent('pointerdown', { pointerId: 11, button: 1 });
  await expect(page.locator('#orrery-network-detail')).toContainText('Test Alpha');
  await page.locator('#component-tabular-toggle').dispatchEvent('click');
  await expect(page.locator('#orrery-network-status')).toContainText('read-only runtime selection');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cards).toHaveCount(2);
  const link = page.locator('#canvas .graph-link-hit[data-link-id="orrery-relation:relation"]');
  await expect(link).toHaveCount(1);
  await link.dispatchEvent('pointerdown', { pointerId: 12, button: 1 });
  await expect(page.locator('#orrery-network-detail')).toContainText('Synthetic evidence');
  await page.evaluate(snapshot => window.__orreryTestStream.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify(snapshot) })), observation('2'));
  await expect(page.locator('#canvas')).toContainText('Changed observation');
  await page.evaluate(() => window.__orreryTestStream.onerror());
  await expect(page.locator('#orrery-network-status')).toContainText('disconnected');
  await expect(cards).toHaveCount(2);
  expect((await (await request.get(`/api/maps/${id}`)).json()).state).toEqual(before.state);
  await page.screenshot({ path: info.outputPath('network-viewer.png'), fullPage: true });
  await page.locator('#canvas .node-hit[data-node-id="task"]').click({ force: true });
  await page.locator('#component-tabular-toggle').dispatchEvent('click');
  await expect(page.locator('#component-tabular-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.wb-top-actions #orrery-network-toggle')).toBeVisible();
  await page.locator('#orrery-network-toggle').click();
  await expect(cards).toHaveCount(0);
  await expect(page.locator('#canvas')).toContainText('Human task');
  expect(await page.evaluate(() => window.__orreryTestStream.closed)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('runtime drag and tuning stay out of authoring persistence', async ({ page, request }) => {
  const { id, before } = await setup(page, request);
  const card = page.locator('[data-orrery-node-id]').first();
  const initial = await card.getAttribute('transform');
  // Dispatch to the real capture owner, with a browser-owned pointer for capture.
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 30, { steps: 3 });
  await page.mouse.up();
  await expect(card).not.toHaveAttribute('transform', initial);
  await page.getByLabel('NETWORK repulsion').evaluate(input => { input.value = '4000'; });
  await page.getByLabel('NETWORK repulsion').dispatchEvent('input');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect((await (await request.get(`/api/maps/${id}`)).json()).state).toEqual(before.state);
});

test('runtime input focus preserves native range keys without authoring undo or redo', async ({ page, request }) => {
  const { id } = await setup(page, request);
  const task = page.locator('#canvas .node-hit[data-node-id="task"]');
  const toggle = page.locator('#component-tabular-toggle');
  await task.click({ force: true });
  await toggle.dispatchEvent('click');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await (await request.get(`/api/maps/${id}`)).json()).state.nodes.task.attributes).not.toEqual({});
  const edited = (await (await request.get(`/api/maps/${id}`)).json()).state;
  const range = page.getByLabel('NETWORK repulsion');
  const selectRuntime = async () => {
    await page.locator('[data-orrery-node-id]').first().dispatchEvent('pointerdown', { pointerId: 31, button: 1 });
    await range.focus();
  };
  await selectRuntime();
  const initial = Number(await range.inputValue());
  await page.keyboard.press('ArrowRight');
  expect(Number(await range.inputValue())).toBeGreaterThan(initial);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Delete');
  await expect(task).toHaveCount(1);
  expect((await (await request.get(`/api/maps/${id}`)).json()).state).toEqual(edited);

  // Establish a real redo entry using the authoring selection, then ensure the
  // same input-focus boundary also blocks redo while a runtime card is selected.
  await task.click({ force: true });
  await page.locator('#board').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await selectRuntime();
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('drag release keeps the newest queued observation after an older arrival', async ({ page, request }) => {
  const { id, before } = await setup(page, request);
  const card = page.locator('[data-orrery-node-id]').first();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const newer = observation('3');
  newer.actors[0].message = 'Newest queued observation';
  const older = observation('2');
  older.actors[0].message = 'Delayed older observation';
  // The initial GET and SSE share this arrival boundary. Reproduce their
  // possible out-of-order arrival while the pointer owns a runtime drag.
  await page.evaluate(([newer, older]) => {
    for (const snapshot of [newer, older]) {
      window.__orreryTestStream.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify(snapshot) }));
    }
  }, [newer, older]);
  await expect(card).toContainText('Working');
  await page.mouse.up();
  await expect(card).toContainText('Newest queued observation');
  await expect(card).not.toContainText('Delayed older observation');
  expect((await (await request.get(`/api/maps/${id}`)).json()).state).toEqual(before.state);
});

test('configured live observation reaches the isolated Viewer without transport mocks', async ({ page, request }, info) => {
  test.skip(!process.env.M3E_ORRERY_SOURCES, 'Requires an explicitly configured local sanitized source');
  const response = await request.get('/api/orrery/runtime');
  expect(response.ok()).toBeTruthy();
  const snapshot = await response.json();
  expect(snapshot.schema).toBe('m3e.orrery.v1');
  expect(snapshot.sources.some(source => source.state === 'connected')).toBeTruthy();
  expect(snapshot.actors.length).toBeGreaterThan(0);
  const id = `orrery-live-${Date.now()}`;
  const state = { rootId: 'root', nodes: { root: { id: 'root', parentId: null, children: [], text: 'Isolated observation check', nodeType: 'text', collapsed: false, details: '', note: '', link: '', attributes: {} } } };
  expect((await request.post(`/api/maps/${id}`, { data: { version: 1, savedAt: '2026-09-22T00:00:00.000Z', state } })).ok()).toBeTruthy();
  const before = await (await request.get(`/api/maps/${id}`)).json();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/viewer.html?localMapId=${id}&network=1`);
  await expect.poll(() => page.locator('[data-orrery-node-id]').count()).toBeGreaterThan(0);
  await expect(page.locator('#orrery-network-status')).toContainText('connected');
  await page.locator('#orrery-network-panel summary').click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Fit map + NETWORK', exact: true }).click();
  expect((await (await request.get(`/api/maps/${id}`)).json()).state).toEqual(before.state);
  expect(errors).toEqual([]);
  // Private local artifact only; real observation labels must never enter Git.
  await page.screenshot({ path: info.outputPath('live-network-private.png'), fullPage: true });
});
