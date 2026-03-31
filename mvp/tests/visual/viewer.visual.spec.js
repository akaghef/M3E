const { test, expect } = require("@playwright/test");

async function loadAndStabilize(page, buttonId) {
  await page.goto("/viewer.html");
  await page.click(buttonId);
  await expect(page.locator("#meta")).toContainText("nodes:");
  await page.click("#fit-all");
  await page.waitForTimeout(300);
}

async function getNodeCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/nodes:\s*(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse node count from meta: ${metaText}`);
  }
  return Number(match[1]);
}

// 目的: デフォルトサンプルを全体表示した状態で、描画の見た目が崩れていないかを比較する。
test("default sample visual baseline", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await expect(page.locator("#board")).toHaveScreenshot("default-sample.png");
});

// 目的: aircraft.mm 読み込み後に Body 周辺へフォーカスし、主要ラベルと枝の見た目を比較する。
test("aircraft mm visual baseline", async ({ page }) => {
  await loadAndStabilize(page, "#load-aircraft-mm");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#meta")).toContainText("selected: Body");
  await page.click("#focus-selected");
  await page.waitForTimeout(300);
  await expect(page.locator("#board")).toHaveScreenshot("aircraft-mm-body-focus.png");
});

// 目的: viewer UI で Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y が期待通りに undo/redo できることを検証する。
test("viewer keyboard undo redo", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await page.click("#board");

  const initialCount = await getNodeCount(page);

  await page.keyboard.press("Enter");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount + 1}`);
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  await page.keyboard.press("Control+z");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount}`);

  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount + 1}`);
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  await page.keyboard.press("Control+z");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount}`);

  await page.keyboard.press("Control+y");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount + 1}`);
  await expect(page.locator("#meta")).toContainText("selected: New Node");
});