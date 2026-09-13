const { test, expect } = require("@playwright/test");

function observe(page) {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", r => errors.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on("request", r => {
    if (new URL(r.url()).pathname.startsWith('/api/')) errors.push(`Live API request: ${r.url()}`);
  });
  return errors;
}
async function evidence(page, testInfo, name) {
  await testInfo.attach(`${name}-dom`, { body: await page.locator('#ot-lab-root').innerHTML(), contentType: 'text/html' });
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test("surface-overview renders cards and graph; controls change upstream state", async ({ page }, testInfo) => {
  const errors = observe(page);
  await page.goto('/src/labs/ot/routes/surface-overview.html');
  await expect(page.locator('#wrap .bay')).toHaveCount(2);
  await expect(page.locator('#wrap .bay').first()).toBeVisible();
  await expect(page.locator('#wrap')).toContainText('Ada Lovelace');
  await expect(page.locator('iframe')).toHaveCount(0);
  await evidence(page, testInfo, 'surface-deck');
  await page.locator('#history [data-history="all"]').click();
  await expect(page.locator('#history [data-history="all"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#wrap .bay')).toHaveCount(3);
  await page.locator('#v-net').click();
  await expect(page.locator('body')).toHaveAttribute('data-view','net');
  await expect(page.locator('#gsvg .node')).toHaveCount(3);
  await expect(page.locator('#gsvg .node').first()).toBeVisible();
  await expect(page.locator('#netinfo')).toContainText('3 nodes · 1 links · 1 spawn');
  const slider = page.getByRole('slider', { name: 'Node size', exact: true });
  await slider.fill('25');
  await expect(page.locator('#gsvg .node').first()).toHaveAttribute('transform', /scale\(1\.923\)/);
  await page.locator('#nc-reset').click();
  await expect(slider).toHaveValue('13');
  await expect(page.locator('#gsvg .node').first()).not.toHaveAttribute('transform', /scale/);
  await page.locator('#winall').click();
  await expect(page.locator('#winlabel')).toHaveText('ALL');
  await expect(page.locator('#gsvg .node')).toHaveCount(3);
  // Hover/click via actual pointers; force layout may still be settling.
  const node = page.locator('#gsvg .node').first();
  await node.locator('.pimg').hover({ force: true });
  await expect(page.locator('#gtip')).toHaveClass(/on/);
  await page.locator('#selToggle').click();
  await node.locator('.pimg').click({ force: true });
  await expect(page.locator('#gsvg .selnode')).toHaveCount(1);
  await expect(page.locator('#selbarNum')).toHaveText('1');
  await evidence(page, testInfo, 'surface-network');
  await page.locator('#v-deck').click();
  await expect(page.locator('#wrap .bay')).toHaveCount(3);
  await expect(page.locator('#wrap .bay').first()).toBeVisible();
  await expect(page.locator('#gsvg .selnode')).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
  console.log('surface-overview: 2 live cards → 3 history cards; 3 graph nodes, 1 link, 1 spawn; tuning/Reset, window, hover, selection, view switch passed; no console/page errors.');
});

test("agent-detail renders one fixture without a surface and supports panel controls", async ({ page }, testInfo) => {
  const errors = observe(page);
  await page.goto('/src/labs/ot/routes/agent-detail.html');
  await expect(page.locator('#term')).toBeVisible();
  await expect(page.locator('#tm-nm')).toHaveText('Ada Lovelace');
  await expect(page.locator('#tm-meta')).toContainText('fixture-model');
  await expect(page.locator('#tm-summary .ts-row')).not.toHaveCount(0);
  await expect(page.locator('#tm-summary')).toContainText('Trace the signal path');
  await expect(page.locator('#tm-summary')).toContainText('28% used');
  await expect(page.locator('#tm-hist .msg')).toHaveCount(2);
  await expect(page.locator('#sp-svg .ev')).toHaveCount(3);
  await expect(page.locator('#wrap, #gsvg, iframe')).toHaveCount(0);
  await page.locator('#sp-svg .ev-hit').first().hover();
  await expect(page.locator('#sp-tip')).toHaveAttribute('aria-hidden', 'false');
  await evidence(page, testInfo, 'agent-detail-history');
  await page.locator('#tm-tabs [data-tab="deliv"]').click();
  await expect(page.locator('#tm-deliv')).toContainText('Signal trace report');
  await expect(page.locator('#tm-deliv')).toBeVisible();
  await page.locator('.an-chip[data-r="reviewer"]').click();
  await expect(page.locator('#an-role')).toHaveValue('reviewer');
  await page.locator('#an-set').click();
  await expect(page.locator('.an-cur')).toHaveText('FAILED');
  await page.locator('#tm-open').click();
  await expect(page.locator('#toast')).toContainText('OT fixture refuses live writes');
  const blocked = await page.evaluate(async () => {
    const response = await fetch(new Request(location.origin + '/api/spawn', { method: 'POST' }));
    return { status: response.status, body: await response.json() };
  });
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('OT_LAB_WRITE_ATTEMPT');
  await page.locator('#tm-x').click();
  await expect(page.locator('#term')).not.toBeVisible();
  await page.locator('#ot-open-detail').click();
  await expect(page.locator('#term')).toBeVisible();
  await expect(page.locator('#tm-nm')).toHaveText('Ada Lovelace');
  await expect(page.locator('#tm-hist .msg')).toHaveCount(2);
  expect(errors, errors.join('\n')).toEqual([]);
  console.log('agent-detail: Ada Lovelace, model/task/context summary, 3 sparkline events, 2 transcript messages, output report; role preset, write blocking and reopen passed; no console/page errors.');
});
