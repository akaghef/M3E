const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
function fixture(count = 12) {
  const rootId = 'root';
  const nodes = { root: { id: rootId, parentId: null, children: [], nodeType: 'folder', text: 'Force verification', collapsed: false, attributes: {}, details: '', note: '', link: '' } };
  for (let i = 0; i < count; i++) {
    const id = 'node' + i, parentId = i > 2 && i % 4 !== 0 ? 'node' + (i % 3) : rootId;
    nodes[id] = { id, parentId, children: [], nodeType: 'text', text: '課題の分岐と検証条件 ' + (i + 1), collapsed: false, attributes: {}, details: '', note: '', link: '' };
    nodes[parentId].children.push(id);
  }
  return { version: 1, savedAt: new Date().toISOString(), state: { rootId, nodes, links: {}, surfaces: {}, scopes: {}, annotations: {} } };
}
async function load(page, count) {
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.text().slice(0, 300)); });
  await page.goto('/viewer.html?ws=ws_disperse_acceptance&map=map_disperse_acceptance');
  await page.setInputFiles('#file-input', { name: 'force.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture(count))) });
  await page.locator('#view-scatter').dispatchEvent('click');
  await expect(page.locator('#webgl-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics()?.snapshot?.nodes.length)).toBe(count);
}
async function stop(page) {
  try {
    await expect.poll(() => page.evaluate(() => window.disperseDiagnostics()?.pendingFrame), { timeout: 30000 }).toBe(false);
  } catch (error) {
    console.log('Stop diagnostic', await page.evaluate(() => { const d = window.disperseDiagnostics(); return { ...d, snapshot: { ...d.snapshot, nodes: d.snapshot?.nodes.length, groups: d.snapshot?.groups.length } }; }));
    throw error;
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function download(page) {
  const event = page.waitForEvent('download'); await page.locator('#download-btn').dispatchEvent('click');
  const d = await event; return JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
}
async function point(page, id) {
  return page.evaluate(id => {
    const node = window.__m3eWebGLProjection.getSnapshot().nodes.find(n => n.id === id);
    const { camera } = window.__m3eWebGLProjection.getDebugState(), r = document.querySelector('#webgl-canvas').getBoundingClientRect();
    return { x: r.left + camera.x + (node.x + node.width / 2) * camera.zoom, y: r.top + camera.y + (node.y + node.height / 2) * camera.zoom };
  }, id);
}
test('ordinary Disperse reheats, stops, drags, saves and reloads the actual app database', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await load(page, 12); await stop(page);
  const initial = await page.evaluate(() => window.disperseDiagnostics());
  expect(initial.engine).toBe('ot-barnes-hut'); expect(initial.snapshot.status).not.toBe('running');
  const p = await point(page, 'node4');
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 45, p.y + 35, { steps: 4 });
  const held = await page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.find(n => n.id === 'node4'));
  await page.waitForTimeout(150);
  const heldAfter = await page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.find(n => n.id === 'node4'));
  expect(heldAfter.x).toBe(held.x); expect(heldAfter.y).toBe(held.y);
  await page.mouse.up(); await stop(page);
  const saved = await download(page), surface = Object.values(saved.state.surfaces).find(s => s.kind === 'scatter');
  expect(Object.keys(surface.nodeViews).length).toBeGreaterThanOrEqual(12);
  const positions = Object.fromEntries(Object.entries(surface.nodeViews).filter(([, p]) => Number.isFinite(p.x) && Number.isFinite(p.y)).map(([id, p]) => [id, { x: p.x, y: p.y }]));
  expect(Object.keys(positions)).toHaveLength(12);
  // Wait for real autosave, then reload through the normal server/SQLite path.
  await page.waitForTimeout(1600); await page.reload(); await stop(page);
  const restored = await download(page), rs = Object.values(restored.state.surfaces).find(s => s.kind === 'scatter');
  for (const id of Object.keys(positions)) expect(rs.nodeViews[id]).toMatchObject(positions[id]);
  await page.locator('#scatter-edge-length').evaluate(e => { e.value = '280'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics().snapshot.parameters.length)).toBe(280);
  await stop(page); expect(errors).toEqual([]);
  await page.screenshot({ path: 'tmp/disperse-ordinary.png' });
});
test('ordinary Disperse 400-node physics and rendering run together and stop', async ({ page }) => {
  await load(page, 400);
  await stop(page);
  const state = await page.evaluate(() => ({ ...window.disperseDiagnostics(), render: window.__m3eWebGLProjection.getDebugState() }));
  if (state.snapshot.violations) {
    fs.writeFileSync('tmp/disperse-400-diagnostic.json', JSON.stringify(state.snapshot));
    const all = [...state.snapshot.nodes.map(n => ({ ...n, x:n.x-n.w/2, y:n.y-n.h/2, members:[n.id] })), ...state.snapshot.groups];
    const bad = [];
    for (let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++) {
      const a=all[i],b=all[j];
      if (a.members.includes(b.id)||b.members.includes(a.id)) continue;
      const px=Math.min(a.x+a.w-b.x,b.x+b.w-a.x)+16,py=Math.min(a.y+a.h-b.y,b.y+b.h-a.y)+16;
      if(px>1e-5 && py>1e-5) bad.push({a:a.id,b:b.id,px,py});
    }
    console.log(JSON.stringify(bad.slice(0,15)));
  }
  expect(state.fastFrames).toBeGreaterThan(0);
  expect(state.snapshot.nodes).toHaveLength(400);
  expect(state.snapshot.violations).toBe(0); expect(state.render.active).toBe(true);
  console.log(JSON.stringify({ nodes: 400, steps: state.snapshot.steps, status: state.snapshot.status, violations: state.snapshot.violations, stepMs: state.stepMs, p95FrameMs: [...state.frameTimes].sort((a,b) => a-b)[Math.floor(state.frameTimes.length*.95)] }));
  expect(state.snapshot.steps).toBeGreaterThan(0); expect(state.pendingFrame).toBe(false);
  await page.screenshot({ path: 'tmp/disperse-400.png' });
});

test('edit, insert, collapse, Undo/Redo and scope navigation keep the shared force lifecycle', async ({ page }) => {
  await load(page, 12); await stop(page);
  const p = await point(page, 'node0'); await page.mouse.click(p.x, p.y);
  await page.keyboard.press('F2'); const editor = page.locator('textarea.inline-node-editor');
  await expect(editor).toBeFocused(); await editor.fill('更新したカテゴリと長い検証条件'); await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.find(n => n.id === 'node0')?.label)).toBe('更新したカテゴリと長い検証条件');
  await stop(page);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.find(n => n.id === 'node0')?.label)).toBe('課題の分岐と検証条件 1');
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.find(n => n.id === 'node0')?.label)).toBe('更新したカテゴリと長い検証条件');
  // Restore automatic force through the normal control after explicit Undo freeze.
  const animate = page.locator('#scatter-animate'); if ((await animate.getAttribute('aria-pressed')) !== 'true') await animate.dispatchEvent('click');
  await stop(page);
  const current = await point(page, 'node0'); await page.mouse.click(current.x, current.y);
  await page.locator('#scatter-collapse').dispatchEvent('click');
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.length)).toBeLessThan(12);
  await stop(page); await page.locator('#scatter-collapse').dispatchEvent('click');
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.length)).toBe(12);
  await stop(page);
  const selected = await point(page, 'node0'); await page.mouse.click(selected.x, selected.y);
  await page.keyboard.press('Tab'); await expect(editor).toBeFocused(); await editor.fill('追加した検証項目'); await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.disperseDiagnostics().snapshot.nodes.some(n => n.label === '追加した検証項目'))).toBe(true);
  await stop(page);
  // Enter the existing selected subtree scope via the standard command.
  await page.keyboard.press(']');
  await expect(page.locator('#meta')).not.toHaveAttribute('data-scope-id', 'root');
  await page.keyboard.press('['); await expect(page.locator('#meta')).toHaveAttribute('data-scope-id', 'root');
});

test('WebGL node and GraphLink authoring use the same canonical commands as SVG', async ({ page }) => {
  await load(page,12); await stop(page);
  await page.locator('#scatter-add-edge').dispatchEvent('click');
  let p=await point(page,'node4'); await page.mouse.click(p.x,p.y);
  p=await point(page,'node5'); await page.mouse.click(p.x,p.y);
  await expect.poll(()=>page.evaluate(()=>window.__m3eWebGLProjection.getSnapshot().graphLinks.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.disperseDiagnostics().snapshot.links.length)).toBe(1);
  await stop(page);
  await page.locator('#scatter-add-node').dispatchEvent('click');
  await page.mouse.click(900,600);
  await expect(page.locator('#meta')).toContainText('nodes: 14');
  await expect.poll(()=>page.evaluate(()=>window.disperseDiagnostics().snapshot.nodes.length)).toBe(13);
  await page.locator('#scatter-normal').dispatchEvent('click');
  await stop(page);
});
