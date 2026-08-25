const { test, expect } = require("@playwright/test");
const { launchViewer } = require("../helpers/viewer_test_utils");

const directions = ["left/right", "left", "right", "up/down", "up", "down"];
const modes = [
  ["Tree", "tree"],
  ["Axial", "timeline"],
  ["Radial", "mindmap"],
  ["Disperse", "scatter"],
  ["System", "system"],
];

test("viewer renders every surface mode and direction through its live edge path", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await launchViewer(page);

  for (const [modeLabel, mode] of modes) {
    for (const direction of directions) {
      await page.evaluate(({ mode, direction }) => {
        window.dispatchEvent(new CustomEvent("m3e:set-surface-layout", { detail: { mode, direction } }));
      }, { mode, direction });
      await expect(page.locator("#canvas svg")).toBeAttached();
      await expect(page.locator("g.node-group").first()).toBeAttached();
      expect(pageErrors, `${modeLabel} ${direction}`).toEqual([]);
    }
  }

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("m3e:set-surface-layout", { detail: { mode: "timeline", direction: "left/right" } }));
  });
  await expect(page.locator("path.timeline-stem").first()).toBeAttached();
  expect(pageErrors).toEqual([]);
});
