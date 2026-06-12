// @ts-check
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const {
  launchViewer,
  focusBoard,
  pressKey,
  waitForRender,
  expectMetaContains,
} = require("../helpers/viewer_test_utils");

const FIXTURE_PATH = path.resolve(__dirname, "..", "fixtures", "shortcut_test.json");

function fixtureMap() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
}

async function drawStroke(page, points) {
  if (points.length < 2) throw new Error("drawStroke requires at least two points");
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
  }
  await page.mouse.up();
  await waitForRender(page);
}

test("saved pen annotations render as SVG paths", async ({ page }) => {
  const map = fixtureMap();
  map.state.annotations = {
    "anno-seed": {
      id: "anno-seed",
      kind: "pen",
      scopeId: "root",
      d: "M 280 180 Q 340 260 420 190",
      points: [
        { x: 280, y: 180 },
        { x: 340, y: 260 },
        { x: 420, y: 190 },
      ],
      stroke: "#242424",
      strokeWidth: 2,
      opacity: 0.95,
      createdAt: "2026-05-20T00:00:00.000Z",
    },
  };

  await launchViewer(page, map);

  await expect(page.locator("path.annotation-pen")).toHaveCount(1);
  await expect(page.locator("path.annotation-pen").first()).toHaveAttribute("data-annotation-id", "anno-seed");
  await expectMetaContains(page, "annotations: 1");
});

test("pen tool draws an SVG stroke and supports undo", async ({ page }) => {
  const map = fixtureMap();
  map.state.annotations = {};
  await launchViewer(page, map);
  await focusBoard(page);

  await page.click("#pen-tool");
  await expect(page.locator("#pen-tool")).toHaveAttribute("aria-pressed", "true");

  const boardBox = await page.locator("#board").boundingBox();
  if (!boardBox) throw new Error("Board not visible");
  await drawStroke(page, [
    { x: boardBox.x + 260, y: boardBox.y + 220 },
    { x: boardBox.x + 330, y: boardBox.y + 280 },
    { x: boardBox.x + 430, y: boardBox.y + 230 },
  ]);

  await expect(page.locator("path.annotation-pen:not(.annotation-pen-draft)")).toHaveCount(1);
  await expectMetaContains(page, "annotations: 1");

  await pressKey(page, "Control+z");
  await waitForRender(page);
  await expect(page.locator("path.annotation-pen:not(.annotation-pen-draft)")).toHaveCount(0);
  await expectMetaContains(page, "annotations: 0");
});

test("drawing toolbar controls pen style and date labels", async ({ page }) => {
  const map = fixtureMap();
  map.state.annotations = {};
  await launchViewer(page, map);
  await focusBoard(page);

  await expect(page.locator("#draw-toolbar")).toBeVisible();
  await page.click("#draw-pen");
  await expect(page.locator("#draw-pen")).toHaveClass(/is-active/);
  await page.click('[data-pen-color="#e64980"]');
  await page.locator("#pen-width").evaluate((el) => {
    const input = /** @type {HTMLInputElement} */ (el);
    input.value = "4";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const boardBox = await page.locator("#board").boundingBox();
  if (!boardBox) throw new Error("Board not visible");
  await drawStroke(page, [
    { x: boardBox.x + 250, y: boardBox.y + 200 },
    { x: boardBox.x + 330, y: boardBox.y + 250 },
  ]);

  const penPath = page.locator("path.annotation-pen:not(.annotation-pen-draft)").first();
  await expect(penPath).toHaveAttribute("stroke", "#e64980");
  await expect(penPath).toHaveAttribute("stroke-width", "4");

  page.once("dialog", async (dialog) => {
    await dialog.accept("4/26");
  });
  await page.click("#draw-date");
  await page.mouse.click(boardBox.x + 360, boardBox.y + 310);
  await waitForRender(page);
  await expect(page.locator("text.annotation-text-date")).toHaveText("4/26");
  await expectMetaContains(page, "annotations: 2");
});

test("graph links render as smooth curves", async ({ page }) => {
  const map = fixtureMap();
  map.state.links = {
    "link-a-c": {
      id: "link-a-c",
      sourceNodeId: "child-a",
      targetNodeId: "grandchild-c1",
      label: "dependency",
      direction: "none",
      style: "soft",
    },
  };

  await launchViewer(page, map);

  const graphLink = page.locator("path.graph-link").first();
  await expect(graphLink).toBeVisible();
  await expect(graphLink).toHaveAttribute("d", / C /);
});
