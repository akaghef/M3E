const { test, expect } = require('@playwright/test');
const { getNodeCount } = require('../helpers/viewer_test_utils');
const fixture = require('../fixtures/shortcut_test.json');
test.use({ reducedMotion:'reduce', viewport:{width:1600,height:1000} });
const LONG = 'これは長い文章を入力したときの表示を確認するためのテスト用テキストです。ノードの幅や高さ、文章の折り返し、編集中のカーソル位置、周囲のノードとの間隔がどのように変化するかを確認します。日本語のひらがな、カタカナ、漢字に加えて、英数字 ABCDEFG abcdefg 0123456789 や句読点、括弧（サンプル）も含めています。文章がさらに長くなった場合でも、入力した内容が途中で欠けず、編集を確定したあとに正しく表示されることを確認できるよう、最後まで続けて入力しています。ここが長文テストの末尾です。';
const label = p => p.locator('text.label-node[data-node-id="child-b"]');
const hit = p => p.locator('rect.node-hit[data-node-id="child-b"]');
async function camera(page) {
  return page.locator('#canvas').evaluate(el => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return { x:m.e, y:m.f, z:m.a }; });
}
async function launch(page, long = false) {
  let saved = structuredClone(fixture);
  if (long) saved.state.nodes['child-b'].text = LONG;
  await page.route(/\/api\/maps\/[^/?]+$/, async route => {
    if (route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { ok:true, savedAt:new Date().toISOString() } });
    } else await route.fulfill({ json:saved });
  });
  await page.goto('/viewer.html?map=surface-width-test');
  await expect(page.locator('#meta')).toContainText('nodes: 7');
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+v');
  await expect(page.locator('#canvas')).toHaveCSS('transform', /matrix/);
  return () => saved;
}
async function selectTarget(page) {
  const b = await hit(page).boundingBox();
  await page.mouse.click(b.x+b.width/2, b.y+b.height/2);
  await expect(page.locator('#meta')).toHaveAttribute('data-selected-node-id','child-b');
}
async function resize(page, delta) {
  const handle = page.getByRole('button', { name: 'Resize node width' });
  await expect(handle).toBeVisible();
  const b = await handle.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width/2+delta,b.y+b.height/2, { steps:8 });
  await page.mouse.up();
}

test('long labels wrap; corner resize reflows, undo/redo and reload retain width and text', async ({page}) => {
  await launch(page, true);
  await selectTarget(page);
  const original = Number(await hit(page).getAttribute('width'));
  const lines = await label(page).locator('tspan').count();
  expect(lines).toBeGreaterThan(5);
  expect(await label(page).textContent()).toBe(LONG);
  await resize(page, -100);
  const resized = Number(await hit(page).getAttribute('width'));
  expect(resized).toBeLessThan(original-50);
  expect(await label(page).locator('tspan').count()).toBeGreaterThan(lines);
  await page.keyboard.press('Control+z');
  await expect(hit(page)).toHaveAttribute('width', String(original));
  const savedResponse = page.waitForResponse(r => r.url().includes('/api/maps/') && r.request().method() === 'POST');
  await page.keyboard.press('Control+y');
  await expect(hit(page)).toHaveAttribute('width', String(resized));
  await page.keyboard.press('F2');
  const editor = page.getByRole('textbox', { name:'Edit node label', exact:true });
  await expect(editor).toHaveValue(LONG);
  const editorWidth = await editor.evaluate(el => parseFloat(el.style.width));
  expect(editorWidth).toBeCloseTo(resized-36-20, 0);
  await page.keyboard.press('Escape');
  // Wait for autosave before reloading; verify persistence through rendered UI.
  await savedResponse;
  await page.reload();
  await expect(hit(page)).toHaveAttribute('width', String(resized));
  expect(await label(page).textContent()).toBe(LONG);
});

test('30 additions keep native scroll at zero, camera scale stable and pointer zoom anchored', async ({page}) => {
  test.setTimeout(60_000);
  await launch(page);
  await selectTarget(page);
  const start = await camera(page);
  const panel = await page.getByTestId('workbench-right-panel').boundingBox();
  const topbar = await page.getByTestId('workbench-topbar').boundingBox();
  for (let i=0; i<30; i++) {
    await page.keyboard.press('Tab');
    const editor = page.getByRole('textbox', {name:'Edit node label',exact:true});
    await expect(editor).toBeFocused();
    await editor.fill(`追加 ${i}：${'長い文章の折り返しを確認します。'.repeat(3)}`);
    // Blur commits without creating another sibling.
    await page.getByRole('button',{name:'Camera follow',exact:true}).click();
    await expect(editor).toHaveCount(0);
    await page.locator('#board').focus();
    const scroll = await page.locator('#board').evaluate(el => [el.scrollLeft,el.scrollTop]);
    expect(scroll).toEqual([0,0]);
  }
  expect(await getNodeCount(page)).toBe(37);
  expect((await camera(page)).z).toBeCloseTo(start.z,5);
  const currentPanel = await page.getByTestId('workbench-right-panel').boundingBox();
  expect({x:currentPanel.x,y:currentPanel.y,width:currentPanel.width}).toEqual({x:panel.x,y:panel.y,width:panel.width});
  expect(await page.getByTestId('workbench-topbar').boundingBox()).toEqual(topbar);
  const before = await camera(page);
  const point = {x:450,y:350};
  await page.mouse.move(point.x,point.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0,-120);
  await page.keyboard.up('Control');
  await expect.poll(async()=> (await camera(page)).z).toBeGreaterThan(before.z);
  const after = await camera(page);
  // CSS matrix serialization rounds large translations; measure visual error in screen pixels.
  expect(Math.abs((point.x-before.x)/before.z * after.z + after.x-point.x)).toBeLessThan(0.5);
  expect(Math.abs((point.y-before.y)/before.z * after.z + after.y-point.y)).toBeLessThan(0.5);
  expect(await page.getByTestId('workbench-right-panel').boundingBox()).toEqual(currentPanel);
});

test('default wrapping preference persists and does not override manually resized nodes', async ({page}) => {
  await launch(page,true);
  await selectTarget(page);
  await resize(page,-80);
  const width = await hit(page).getAttribute('width');
  const savedResponse = page.waitForResponse(r => r.url().includes('/api/maps/') && r.request().method() === 'POST');
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  await page.getByRole('spinbutton',{name:'Initial node width (full-width characters)'}).fill('12');
  await page.locator('.wb-settings-modal header button').click();
  await expect(hit(page)).toHaveAttribute('width',width);
  await savedResponse;
  await page.reload();
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  await expect(page.getByRole('spinbutton',{name:'Initial node width (full-width characters)'})).toHaveValue('12');
  await expect(hit(page)).toHaveAttribute('width',width);
});
