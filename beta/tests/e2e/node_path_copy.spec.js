// @ts-check
const { test, expect } = require("@playwright/test");
const { spawnSync } = require("node:child_process");

const TARGET_SCOPE_ID = "n_1785589333513_xiueid";

function mapPayload() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    state: {
      rootId: "n_1775394076217_d83f66",
      nodes: {
        n_1775394076217_d83f66: {
          id: "n_1775394076217_d83f66",
          parentId: null,
          children: [TARGET_SCOPE_ID],
          nodeType: "folder",
          text: "定例会",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        [TARGET_SCOPE_ID]: {
          id: TARGET_SCOPE_ID,
          parentId: "n_1775394076217_d83f66",
          children: [],
          nodeType: "folder",
          text: "8月",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
    },
  };
}

function readMacClipboard() {
  if (process.platform !== "darwin") return null;
  const env = { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8", LC_CTYPE: "UTF-8" };
  const result = spawnSync("pbpaste", [], { encoding: "utf8", env });
  if (result.status !== 0) throw new Error(result.stderr || "pbpaste failed");
  return result.stdout;
}

async function createAndOpenMap(page, request) {
  const mapId = `map-node-path-copy-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const response = await request.post(`/api/maps/${encodeURIComponent(mapId)}`, { data: mapPayload() });
  expect(response.status()).toBe(200);
  await page.goto(`/viewer.html?localMapId=${encodeURIComponent(mapId)}`);
  await expect(page.locator("#meta")).toContainText("nodes: 2", { timeout: 15_000 });
  await page.getByRole("button", { name: "Hide inspector" }).click();
  await page.locator("#board").click({ position: { x: 500, y: 500 } });
  await page.keyboard.press("Alt+v");
  await page.waitForTimeout(300);
}

async function invokeContextMenuCopy(page) {
  const scopeHit = page.locator(`rect.node-hit[data-node-id="${TARGET_SCOPE_ID}"]`);
  await expect(scopeHit).toBeVisible();
  await scopeHit.click({ button: "right", force: true });
  const copyItem = page.locator(".scope-context-menu-item", { hasText: "Copy path" });
  await expect(copyItem).toBeVisible();
  await copyItem.click();
}

test("scope context menu copies the reported node path through the system clipboard route", async ({ page, request }, testInfo) => {
  await createAndOpenMap(page, request);
  await invokeContextMenuCopy(page);

  const expected = "M:(定例会)> 8月";
  await expect(page.locator("#status")).toContainText(`Path copied: ${expected}`);
  if (process.platform === "darwin") expect(readMacClipboard()).toBe(expected);
  await page.screenshot({ path: testInfo.outputPath("node-path-copy-success.png") });
});

test("scope context menu reports failure when every clipboard route is unavailable", async ({ page, request }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("clipboard disabled for test")) },
    });
  });
  await page.route("**/api/system-clipboard/write", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "clipboard disabled for test" }),
    });
  });
  await createAndOpenMap(page, request);
  await invokeContextMenuCopy(page);

  await expect(page.locator("#status")).toContainText("Failed to copy node path to system clipboard.");
});
