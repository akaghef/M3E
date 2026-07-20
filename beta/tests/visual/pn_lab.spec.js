const { test, expect } = require("@playwright/test");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = 14275;
const BETA_ROOT = path.resolve(__dirname, "../..");
let server;

async function waitForLab() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/src/labs/pn/pn-lab.html`);
      if (res.ok) return;
    } catch (_err) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("PN lab Vite server did not become ready.");
}

test.beforeAll(async () => {
  server = spawn("npm", ["run", "lab:pn", "--", "--strictPort"], {
    cwd: BETA_ROOT,
    stdio: "ignore",
  });
  await waitForLab();
});

test.afterAll(() => {
  if (server) server.kill();
});

async function openLab(page) {
  await page.goto(`http://127.0.0.1:${PORT}/src/labs/pn/pn-lab.html`);
  await expect(page.locator("#sample")).toBeVisible();
}

test.describe("pn-lab", () => {
  test("loads product styles, renders 3rd-level, and exposes EdgePort side metadata", async ({ page }) => {
    await openLab(page);
    const loaded = await page.evaluate(() => Array.from(document.querySelectorAll("link[data-pn-lab-stylesheet]")).map((link) => ({
      name: link.getAttribute("data-pn-lab-stylesheet"),
      loaded: Boolean(link.sheet),
    })));
    expect(loaded).toEqual([
      expect.objectContaining({ name: "viewer", loaded: true }),
      expect.objectContaining({ name: "workbench-ui", loaded: true }),
    ]);

    await expect(page.locator('[data-pn-node="layout-direction"]')).toContainText("Direction");
    await expect(page.locator('[data-pn-node="layout-direction-right"]')).toContainText("Right");
    await expect(page.locator('[data-pn-edge="layout-layout-direction"]')).toHaveAttribute("data-source-side", "right");
    await expect(page.locator('[data-pn-edge="layout-layout-direction"]')).toHaveAttribute("data-target-side", "left");
  });

  test("safe-zone collision preserves rightward placement", async ({ page }) => {
    await openLab(page);
    await page.locator("#sample").selectOption("safe-zone-collision");
    const nav = page.locator('[data-testid="progressive-navigation"]');
    await expect(nav).toHaveAttribute("data-pn-placement", "right-of-anchor");
    await expect(nav).toHaveAttribute("data-pn-canvas-overlap", /[1-9]/);
  });

  test("keyboard/search keeps active path visible and overflow is explicit", async ({ page }) => {
    await openLab(page);
    await page.locator("#sample").selectOption("search-filter-keeps-path");
    await page.locator("#search").fill("Right");
    await expect(page.locator('[data-pn-node="layout"]')).toBeVisible();
    await expect(page.locator('[data-pn-node="layout-direction-right"]')).toBeVisible();

    await page.locator('[data-testid="pn-lab-stage"]').focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[data-testid="progressive-navigation"]')).toHaveAttribute("data-active-pn-node", /.+/);

    await page.locator("#sample").selectOption("overflow-narrow");
    await expect(page.locator('[data-testid="progressive-navigation"]')).toHaveAttribute("data-pn-overflow", /scroll|compact|side-panel/);
  });
});
