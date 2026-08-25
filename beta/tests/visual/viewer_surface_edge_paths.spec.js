const { test, expect } = require("@playwright/test");
const { launchViewer } = require("../helpers/viewer_test_utils");

const directions = ["left/right", "left", "right", "up/down", "up", "down"];
const modes = [
  ["Tree", "tree", true],
  ["Timeline", "timeline", true],
  ["Mind Map", "mindmap", true],
  ["Scatter", "scatter", false],
  ["System", "system"],
];

test("viewer renders every surface mode and direction through its live edge path", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await launchViewer(page);

  for (const [modeLabel, mode, hasStructuredLayoutMeta = false] of modes) {
    for (const direction of directions) {
      await page.evaluate(({ mode, direction }) => {
        window.dispatchEvent(new CustomEvent("m3e:set-surface-layout", { detail: { mode, direction } }));
      }, { mode, direction });
      await expect(page.locator("#canvas")).toBeAttached();
      await expect(page.locator("g.node-group").first()).toBeAttached();
      await expect(page.locator("#mode-meta")).toContainText(`/ ${modeLabel}`);
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.surfaceLayoutDirection)).toBe(direction);
      if (hasStructuredLayoutMeta) {
        await expect(page.locator("#mode-meta")).toContainText(`/ Normal / ${direction}`);
      }
      expect(pageErrors, `${modeLabel} ${direction}`).toEqual([]);
    }
  }

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("m3e:set-surface-layout", { detail: { mode: "timeline", direction: "left/right" } }));
  });
  await expect(page.locator("#mode-meta")).toContainText("/ Timeline / Normal / left/right");
  await expect(page.locator("path.timeline-stem").first()).toBeAttached();
  expect(pageErrors).toEqual([]);
});
