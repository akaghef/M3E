const { test, expect } = require("@playwright/test");

async function openLab(page) {
  await page.goto("/src/labs/node/node-lab.html");
  await expect(page.locator("#sample")).toBeVisible();
}

async function expectStylesheetsLoaded(page) {
  const loaded = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("link[data-node-lab-stylesheet]")).map((link) => ({
      name: link.getAttribute("data-node-lab-stylesheet"),
      href: link.getAttribute("href"),
      loaded: Boolean(link.sheet),
    }));
  });
  expect(loaded).toEqual([
    expect.objectContaining({ name: "viewer", href: "/viewer.css", loaded: true }),
    expect.objectContaining({ name: "katex", href: "/katex/katex.min.css", loaded: true }),
  ]);
}

test.describe("node-lab", () => {
  test("renders samples through shared nodeDraw and loads product CSS plus KaTeX", async ({ page }) => {
    await openLab(page);
    await expectStylesheetsLoaded(page);
    await expect(page.locator("#surface")).toHaveText(/Tree[\s\S]*Axial[\s\S]*Radial[\s\S]*Disperse[\s\S]*System/);

    await page.locator("#sample").selectOption("katex");
    await expect(page.locator("foreignObject .latex-node-content")).toBeVisible();

    await page.locator("#sample").selectOption("collapsed");
    await expect(page.locator(".collapsed-badge-count")).toHaveText("12");

    await page.locator("#sample").selectOption("scope-locked");
    await expect(page.locator(".lock-icon-other")).toBeVisible();

    await page.locator("#sample").selectOption("alias-read");
    await expect(page.locator(".alias-badge-read")).toBeVisible();
    await page.locator("#sample").selectOption("alias-write");
    await expect(page.locator(".alias-badge-write")).toBeVisible();
    await page.locator("#sample").selectOption("alias-broken");
    await expect(page.locator(".alias-badge-broken")).toBeVisible();

    await page.locator("#sample").selectOption("status");
    await expect(page.locator(".status-badge-text")).toHaveText("review");
    await page.locator("#sample").selectOption("confidence");
    await expect(page.locator(".confidence-badge-text")).toHaveText("82%");

    await page.locator("#surface").selectOption("Disperse");
    await expect(page.locator(".scatter-node-circle")).toBeVisible();
    await expect(page.locator("path.edge, .graph-link, .flow-preview-edge")).toHaveCount(0);

    await expect(page).toHaveScreenshot("node-lab-first-ratchet.png");
  });
});
