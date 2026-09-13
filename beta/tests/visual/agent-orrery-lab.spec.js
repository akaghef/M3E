const { test, expect } = require("@playwright/test");

test("renders the isolated Agent Orrery node mock contract", async ({ page }) => {
  await page.goto("/src/labs/agent-orrery/agent-orrery-lab.html");
  await expect(page.getByTestId("breadcrumb")).toHaveText("Disperse / Force / Orrery");
  await expect(page.locator('[data-node-kind="text"]')).toHaveCount(1);
  await expect(page.locator('[data-node-kind="image"]')).toHaveCount(1);
  await expect(page.locator('[data-node-kind="folder"]')).toHaveCount(1);
  await expect(page.locator('[data-node-kind="alias"]')).toHaveCount(1);
  await expect(page.locator('[data-node-kind="agent"]')).toHaveCount(4);
  for (const state of ["working", "waiting", "attention", "finished"]) {
    await expect(page.locator(`.agent-node.state-${state}`)).toHaveCount(1);
  }
  await expect(page.locator("animate, animateTransform, [data-animation]")).toHaveCount(0);
});
