// @ts-check
/**
 * Camera follow (auto-fit) integration tests.
 *
 * Verifies:
 *   - toolbar toggle reflects in DOM state
 *   - scope change fits the viewport when follow=on
 *   - scope change does NOT fit when follow=off
 *
 * Fixture: tests/fixtures/camera_follow_test.json
 *   root (folder)
 *     folder-a (folder)
 *       inside-a1
 *       inside-a2
 *     leaf-b
 */
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const {
  launchViewer,
  focusBoard,
  pressKey,
  expectStatusContains,
  expectMetaContains,
} = require("../helpers/viewer_test_utils");

const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "..", "fixtures", "camera_follow_test.json"),
    "utf-8",
  ),
);

/**
 * Read the canvas transform as {x, y, scale}. Returns null if no transform applied yet.
 * @param {import("@playwright/test").Page} page
 */
async function readCanvasTransform(page) {
  return await page.evaluate(() => {
    const el = document.getElementById("canvas");
    if (!el) return null;
    const t = el.style.transform || "";
    const match = t.match(/translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)\s*scale\(([-0-9.]+)\)/);
    if (!match) return null;
    return { x: parseFloat(match[1]), y: parseFloat(match[2]), scale: parseFloat(match[3]) };
  });
}

function sameTransform(a, b, tol = 0.01) {
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < tol &&
    Math.abs(a.y - b.y) < tol &&
    Math.abs(a.scale - b.scale) < tol
  );
}

test.describe("Camera follow toolbar toggle", () => {
  test("button exists with is-active default", async ({ page }) => {
    await launchViewer(page, FIXTURE);
    const btn = page.locator("#camera-follow-btn");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/is-active/);
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  test("click toggles off and on", async ({ page }) => {
    await launchViewer(page, FIXTURE);
    const btn = page.locator("#camera-follow-btn");

    await btn.click();
    await expect(btn).not.toHaveClass(/is-active/);
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await expectStatusContains(page, "Camera follow: off");

    await btn.click();
    await expect(btn).toHaveClass(/is-active/);
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expectStatusContains(page, "Camera follow: on");
  });
});

test.describe("Camera follow scope behavior", () => {
  test("scope enter re-fits the viewport when follow is on", async ({ page }) => {
    await launchViewer(page, FIXTURE);
    await focusBoard(page);

    // Navigate to folder-a: ArrowRight from root selects first child (folder-a).
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Folder A");

    // Record transform at root scope.
    const before = await readCanvasTransform(page);
    expect(before).not.toBeNull();

    // Enter scope (Ctrl+]).
    await pressKey(page, "Control+]");
    await page.waitForTimeout(80);
    // Wait one more frame for the rAF-scheduled second fit.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const after = await readCanvasTransform(page);
    expect(after).not.toBeNull();
    // The viewport should have re-fit: at least one of (scale, x, y) must have changed.
    expect(sameTransform(before, after)).toBe(false);
  });

  test("scope enter does NOT re-fit when follow is off", async ({ page }) => {
    await launchViewer(page, FIXTURE);
    await focusBoard(page);

    // Turn follow off.
    await page.locator("#camera-follow-btn").click();
    await expectStatusContains(page, "Camera follow: off");

    // Re-focus board for keyboard input.
    await focusBoard(page);

    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Folder A");

    const before = await readCanvasTransform(page);
    expect(before).not.toBeNull();

    await pressKey(page, "Control+]");
    await page.waitForTimeout(80);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const after = await readCanvasTransform(page);
    expect(after).not.toBeNull();
    // Transform must be unchanged since auto-fit was suppressed.
    expect(sameTransform(before, after)).toBe(true);
  });
});
