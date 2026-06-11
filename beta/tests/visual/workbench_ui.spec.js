// @ts-check
const { test, expect } = require("@playwright/test");
const { launchViewer, waitForRender } = require("../helpers/viewer_test_utils");

test.describe("M3E Mindmap Workbench UI", () => {
  test("renders Miro-style workbench chrome without changing the canvas surface", async ({ page }) => {
    await launchViewer(page);
    await waitForRender(page, 300);

    await expect(page.getByTestId("workbench-topbar")).toBeVisible();
    await expect(page.getByTestId("workbench-left-rail")).toBeVisible();
    await expect(page.getByTestId("workbench-right-panel")).toBeVisible();
    await expect(page.getByTestId("workbench-bottom-controls")).toBeVisible();

    await expect(page.locator("#canvas")).toBeVisible();
    await expect(page.locator("#meta")).toContainText("nodes:");
    await expect(page.locator("svg text").filter({ hasText: "Test Root" }).first()).toBeVisible();

    const rail = page.getByTestId("workbench-left-rail");
    await expect(rail.getByRole("button", { name: "Pen" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Highlighter" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Eraser" })).toBeVisible();
    await expect(page.getByTestId("workbench-right-panel").getByText("Selected node")).toBeVisible();

    await expect(page.getByText("Sticky", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Jira", { exact: false })).toHaveCount(0);
    await expect(page.getByText("iFrame", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Prototype", { exact: false })).toHaveCount(0);
  });

  test("connects visible workbench controls to existing viewer functions", async ({ page }) => {
    await launchViewer(page);
    await waitForRender(page, 300);

    const rail = page.getByTestId("workbench-left-rail");
    await rail.getByRole("button", { name: "Pen" }).click();
    await expect(page.locator("#board")).toHaveClass(/pen-mode/);

    await rail.getByRole("button", { name: "Highlighter" }).click();
    await expect(page.locator("#status")).toContainText("Highlighter");

    await page.getByTestId("workbench-bottom-controls").getByRole("button", { name: "Zoom in" }).click();
    await expect(page.locator("#status")).toContainText("Zoom");

    await page.getByRole("button", { name: "Settings" }).first().click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Profile settings" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Advanced permissions" })).toBeDisabled();
  });

  test("toggles the inspector panel without hiding the canvas surface", async ({ page }) => {
    await launchViewer(page);
    await waitForRender(page, 300);

    const panel = page.getByTestId("workbench-right-panel");
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Hide inspector" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show inspector" })).toBeVisible();
    await expect(page.locator("#canvas")).toBeVisible();
    await expect(page.locator("svg text").filter({ hasText: "Test Root" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Show inspector" }).click();
    await expect(page.getByTestId("workbench-right-panel")).toBeVisible();
  });
});
