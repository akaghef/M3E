const { test, expect } = require("@playwright/test");

function scatterFixture() {
  const rootId = "root";
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    state: {
      rootId,
      nodes: {
        root: {
          id: "root",
          parentId: null,
          children: ["alpha", "beta"],
          nodeType: "folder",
          text: "Scatter Root",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        alpha: {
          id: "alpha",
          parentId: "root",
          children: ["alpha-child"],
          nodeType: "text",
          text: "Alpha",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        "alpha-child": {
          id: "alpha-child",
          parentId: "alpha",
          children: [],
          nodeType: "text",
          text: "Alpha Child",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        beta: {
          id: "beta",
          parentId: "root",
          children: [],
          nodeType: "text",
          text: "Beta",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
      links: {},
      annotations: {},
    },
  };
}

async function loadFixture(page) {
  const docId = `scatter-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  await page.goto(`/viewer.html?localMapId=${docId}&cloudMapId=${docId}`);
  await page.setInputFiles("#file-input", {
    name: "scatter-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(scatterFixture()), "utf8"),
  });
  await expect(page.locator("#meta")).toContainText("nodes: 4");
}

async function clickLegacy(page, selector) {
  await page.locator(selector).evaluate((element) => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await page.waitForTimeout(300);
}

test("scatter surface renders descendants and edits visible edges", async ({ page }) => {
  await loadFixture(page);
  await expect(page.locator("#mode-meta")).toContainText("/ Tree");

  await clickLegacy(page, "#view-system");
  await expect(page.locator("#mode-meta")).toContainText("/ System");
  await clickLegacy(page, "#view-scatter");
  await expect(page.locator("#mode-meta")).toContainText("/ Scatter");
  await expect(page.locator("#scatter-toolbar")).toBeVisible();

  await expect(page.locator("text.label-root", { hasText: "Scatter Root" })).toBeVisible();
  await expect(page.locator('text.label-node[data-node-id="alpha"]')).toContainText("Alpha");
  await expect(page.locator('text.label-node[data-node-id="alpha-child"]')).toContainText("Alpha Child");
  await expect(page.locator("path.edge")).toHaveCount(0);

  const alphaBefore = await page.locator('[data-node-id="alpha"].node-hit').boundingBox();
  if (!alphaBefore) throw new Error("Alpha node was not rendered.");
  await page.mouse.move(alphaBefore.x + alphaBefore.width / 2, alphaBefore.y + alphaBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(alphaBefore.x + alphaBefore.width / 2 + 150, alphaBefore.y + alphaBefore.height / 2 + 70, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const alphaMoved = await page.locator('[data-node-id="alpha"].node-hit').boundingBox();
  expect(alphaMoved.x).toBeGreaterThan(alphaBefore.x + 80);

  await page.waitForTimeout(1500);
  await page.reload();
  if (!((await page.locator("#mode-meta").textContent()) || "").includes("/ Scatter")) {
    await clickLegacy(page, "#view-scatter");
  }
  await expect(page.locator("#mode-meta")).toContainText("/ Scatter");
  const alphaReloaded = await page.locator('[data-node-id="alpha"].node-hit').boundingBox();
  expect(alphaReloaded.x).toBeGreaterThan(alphaBefore.x + 80);

  await clickLegacy(page, "#scatter-add-node");
  await page.mouse.click(820, 600);
  await expect(page.locator("#meta")).toContainText("nodes: 5");
  await expect(page.locator("text.label-node", { hasText: "New Node" })).toBeVisible();

  await clickLegacy(page, "#scatter-add-edge");
  const alpha = await page.locator('[data-node-id="alpha"].node-hit').boundingBox();
  const beta = await page.locator('[data-node-id="beta"].node-hit').boundingBox();
  if (!alpha || !beta) throw new Error("Scatter edge endpoints were not rendered.");
  await page.mouse.click(alpha.x + alpha.width / 2, alpha.y + alpha.height / 2);
  await page.mouse.click(beta.x + beta.width / 2, beta.y + beta.height / 2);
  await expect(page.locator("path.graph-link.scatter-edge")).toHaveCount(1);

  await clickLegacy(page, "#view-tree");
  await expect(page.locator("#mode-meta")).toContainText("/ Tree");
});
