const { test, expect } = require("@playwright/test");

test("tracks the RG1 payment issue through assignments, chat, evidence, and release", async ({ page }) => {
  await page.goto("/src/labs/agent-orrery/agent-orrery-lab.html");
  await expect(page.getByRole("heading", { name: "Duplicate charge incident" })).toBeVisible();
  await expect(page.getByTestId("issue-row-PAY-4827")).toContainText("1 click created 2 charges");
  await expect(page.getByTestId("m3e-map-path")).toHaveText("ws:demo / map:Payments / scope:CASE-0914");
  await expect(page.getByTestId("surface-mode")).toContainText("Disperse · static Orrery reference");
  await expect(page.getByTestId("m3e-surface").locator("[data-scope-boundary]")).toHaveCount(3);
  await expect(page.getByTestId("m3e-surface").locator('[data-node-kind="folder"]')).toHaveCount(1);
  await expect(page.getByTestId("m3e-surface").locator('[data-node-kind="alias"]')).toHaveCount(1);
  await expect(page.getByTestId("m3e-surface").locator('[data-node-kind="agent"]')).toHaveCount(6);
  await expect(page.getByTestId("m3e-surface").locator("[data-link-class='edge']")).not.toHaveCount(0);
  await expect(page.getByTestId("m3e-surface").locator("[data-link-class='GraphLink'][data-relation='assigned-to']")).toHaveCount(6);
  await expect(page.getByTestId("m3e-surface").locator("[data-link-class='GraphLink'][data-relation='produces']")).toHaveCount(6);

  await page.getByTestId("task-task-fix").click();
  await expect(page.getByTestId("task-task-fix")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("agent-ivory")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("m3e-inspector")).toContainText("GraphLinks");
  await expect(page.getByTestId("chat-panel")).toContainText("payment identity");

  await page.getByRole("button", { name: "Jump to release" }).click();
  await expect(page.getByTestId("issue-status")).toHaveText("Resolved");
  await expect(page.getByTestId("release-gate")).toContainText("Released");
  await expect(page.getByTestId("timeline-current")).toContainText("Issue resolved");
});

test("supports keyboard selection and compact viewport without hiding core tracing", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/src/labs/agent-orrery/agent-orrery-lab.html");
  await page.getByTestId("agent-copper").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("agent-copper")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("task-task-impact")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("chat-panel")).toContainText("production payment records");
  await expect(page.getByTestId("issue-list")).toBeVisible();
  await expect(page.getByTestId("case-board")).toBeVisible();
});
