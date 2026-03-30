const { test, expect } = require("@playwright/test");

async function loadAndStabilize(page, buttonId) {
  await page.goto("/viewer.html");
  await page.click(buttonId);
  await expect(page.locator("#meta")).toContainText("nodes:");
  await page.click("#fit-all");
  await page.waitForTimeout(300);
}

test("default sample visual baseline", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await expect(page.locator("#board")).toHaveScreenshot("default-sample.png");
});

test("aircraft mm visual baseline", async ({ page }) => {
  await loadAndStabilize(page, "#load-aircraft-mm");
  await page.getByText("Body", { exact: true }).first().click();
  await page.click("#focus-selected");
  await page.waitForTimeout(300);
  await expect(page.locator("#board")).toHaveScreenshot("aircraft-mm-body-focus.png");
});