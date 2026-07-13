// @ts-check
const { test, expect } = require("@playwright/test");

const ENTRY = "/src/labs/runtime-board/runtime-board.html";

async function openBoard(page) {
  await page.goto(ENTRY);
  await expect(page.getByTestId("runtime-board")).toBeVisible();
  await expect(page.getByTestId("graph-svg")).toBeVisible();
  await expect(page.getByTestId("playback-controls")).toBeVisible();
}

test.describe("runtime-board video repro", () => {
  test("loads dark board with graph, legend, minimap, and step overlay", async ({ page }) => {
    await openBoard(page);

    await expect(page.getByRole("heading", { name: /条件付き確率 生成パイプライン/ })).toBeVisible();
    await expect(page.getByTestId("legend")).toBeVisible();
    await expect(page.getByTestId("minimap")).toBeVisible();
    await expect(page.getByTestId("step-overlay")).toBeVisible();
    await expect(page.getByTestId("step-counter")).toContainText("1");
    await expect(page.getByTestId("step-title")).toHaveText("API リクエスト受信");

    // Dense graph: multiple category nodes present
    await expect(page.getByTestId("node-api-condition-rate")).toBeVisible();
    await expect(page.getByTestId("node-phase1")).toBeVisible();
    await expect(page.getByTestId("node-t-municipal")).toBeVisible();
    await expect(page.getByTestId("node-out-condition-rate")).toBeVisible();

    // Step 1: API endpoint is active
    await expect(page.getByTestId("node-api-condition-rate")).toHaveAttribute("data-active", "true");
  });

  test("manual step progression updates counter, title, and active states", async ({ page }) => {
    await openBoard(page);

    const activeBefore = await page.locator('[data-testid^="node-"][data-active="true"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid"))
    );
    expect(activeBefore).toContain("node-api-condition-rate");

    await page.getByTestId("btn-next").click();
    await expect(page.getByTestId("step-counter")).toContainText("2");
    await expect(page.getByTestId("step-badge")).toContainText("2/");
    await expect(page.getByTestId("step-title")).not.toHaveText("API リクエスト受信");

    const activeAfter = await page.locator('[data-testid^="node-"][data-active="true"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid"))
    );
    expect(activeAfter).not.toEqual(activeBefore);
    // Step 2 activates service + API
    await expect(page.getByTestId("node-condition-rate-service")).toHaveAttribute("data-active", "true");

    // Progress further to Phase 1 (step 5)
    await page.getByTestId("btn-next").click();
    await page.getByTestId("btn-next").click();
    await page.getByTestId("btn-next").click();
    await expect(page.getByTestId("step-counter")).toContainText("5");
    await expect(page.getByTestId("step-title")).toHaveText("Phase 1 基盤抽選");
    await expect(page.getByTestId("node-phase1")).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("node-t-age")).toHaveAttribute("data-active", "true");

    // Completed nodes remain marked after advancing past them
    await page.getByTestId("btn-next").click();
    await expect(page.getByTestId("step-counter")).toContainText("6");
    await expect(page.getByTestId("node-phase1")).toHaveAttribute("data-completed", "true");

    // Previous steps back
    await page.getByTestId("btn-prev").click();
    await expect(page.getByTestId("step-counter")).toContainText("5");
  });

  test("node click opens detail drawer with API-like content", async ({ page }) => {
    await openBoard(page);

    await expect(page.getByTestId("node-drawer")).toHaveAttribute("data-open", "false");

    await page.getByTestId("node-api-tables-id").click();
    await expect(page.getByTestId("node-drawer")).toHaveAttribute("data-open", "true");
    await expect(page.getByTestId("drawer-title")).toContainText("/v1/tables");
    await expect(page.getByTestId("drawer-overview")).toBeVisible();
    await expect(page.getByTestId("drawer-code")).toContainText("loadTable");
    await expect(page.getByTestId("drawer-source")).toContainText("handlers");

    await page.getByTestId("drawer-close").click();
    await expect(page.getByTestId("node-drawer")).toHaveAttribute("data-open", "false");

    // Second node: condition-rate API
    await page.getByTestId("node-api-condition-rate").click();
    await expect(page.getByTestId("node-drawer")).toHaveAttribute("data-open", "true");
    await expect(page.getByTestId("drawer-path")).toContainText("condition-rate");
    await expect(page.getByTestId("drawer-code")).toContainText("conditions");
  });

  test("play button advances steps over time", async ({ page }) => {
    await openBoard(page);
    await expect(page.getByTestId("step-counter")).toContainText("1");
    await page.getByTestId("btn-play").click();
    await expect(page.getByTestId("step-counter")).toContainText("2", { timeout: 4000 });
    await page.getByTestId("btn-play").click(); // pause
  });
});
