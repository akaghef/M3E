// @ts-check
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let previewRoot;

test.beforeAll(() => {
  previewRoot = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-markdown-hover-"));
  fs.writeFileSync(
    path.join(previewRoot, "preview.md"),
    "# Hover Preview\n\nRead-only Markdown content.\n\n- first\n- second\n",
    "utf8",
  );
});

test.afterAll(() => {
  if (previewRoot) fs.rmSync(previewRoot, { recursive: true, force: true });
});

test("Markdown file node hover previews, panel hover preserves, click pins, and Escape closes", async ({ page }, testInfo) => {
  await page.goto(`/viewer.html?localFsRoot=${encodeURIComponent(previewRoot)}`);
  await expect(page.locator("#meta")).toContainText("nodes: 2", { timeout: 15_000 });
  await page.locator("#board").click({ position: { x: 500, y: 500 } });
  await page.keyboard.press("Alt+v");
  await page.waitForTimeout(300);

  const fileNode = page.locator('rect.node-hit[data-node-id="localfs:preview.md"]');
  const panel = page.locator("#markdown-preview-panel");
  await expect(fileNode).toBeVisible();

  await fileNode.hover();
  await expect(panel).toBeVisible({ timeout: 2_000 });
  await expect(panel).toHaveAttribute("data-preview-mode", "hover");
  await expect(panel.locator("h1")).toHaveText("Hover Preview");
  await expect(panel).toContainText("Read-only Markdown content.");

  await page.mouse.move(40, 700);
  await expect(panel).toBeHidden({ timeout: 2_000 });

  await fileNode.hover();
  await expect(panel).toBeVisible({ timeout: 2_000 });
  await panel.hover();
  await page.waitForTimeout(250);
  await expect(panel).toBeVisible();

  await fileNode.click({ force: true });
  await expect(panel).toHaveAttribute("data-preview-mode", "pinned");
  await expect(panel.locator(".markdown-preview-title")).toContainText("preview.md");

  await page.mouse.move(40, 700);
  await page.waitForTimeout(250);
  await expect(panel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("markdown-hover-preview.png") });

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
