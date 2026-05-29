// @ts-check
const { test, expect } = require("@playwright/test");

async function progressiveNavGeometry(page, fromSelector, toSelector, pathSelector) {
  return page.evaluate(({ fromSelector, toSelector, pathSelector }) => {
    const nav = document.querySelector(".wb-progressive-nav");
    const from = document.querySelector(fromSelector);
    const to = document.querySelector(toSelector);
    const path = document.querySelector(pathSelector);
    if (!nav || !from || !to || !path) {
      throw new Error("Progressive navigation geometry target missing.");
    }
    const parse = (d) => {
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      return {
        sx: nums[0],
        sy: nums[1],
        tx: nums[nums.length - 2],
        ty: nums[nums.length - 1],
      };
    };
    const rel = (el) => {
      const nr = nav.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return {
        left: r.left - nr.left,
        right: r.right - nr.left,
        top: r.top - nr.top,
        bottom: r.bottom - nr.top,
        cx: r.left - nr.left + r.width / 2,
        cy: r.top - nr.top + r.height / 2,
      };
    };
    return {
      endpoints: parse(path.getAttribute("d") || ""),
      fromRect: rel(from),
      toRect: rel(to),
      pathCount: document.querySelectorAll(".wb-progressive-edges path").length,
      activePathCount: document.querySelectorAll(".wb-progressive-edges path.is-active-edge").length,
    };
  }, { fromSelector, toSelector, pathSelector });
}

test.describe("Workbench progressive navigation", () => {
  test("root edges attach to DOM rect boundaries", async ({ page }) => {
    await page.goto("/viewer.html?localMapId=pn-edge-root&cloudMapId=pn-edge-root");

    await page.locator('[aria-label="[GUI] navigation root"]').hover();
    await page.waitForTimeout(250);

    const geometry = await progressiveNavGeometry(
      page,
      '[aria-label="[GUI] navigation root"]',
      '[data-pn-node="board"]',
      '.wb-progressive-edges path',
    );

    expect(geometry.pathCount).toBeGreaterThanOrEqual(6);
    expect(geometry.endpoints.sx).toBeCloseTo(geometry.fromRect.right, 1);
    expect(geometry.endpoints.sy).toBeCloseTo(geometry.fromRect.cy, 1);
    expect(geometry.endpoints.tx).toBeCloseTo(geometry.toRect.left, 1);
    expect(geometry.endpoints.ty).toBeCloseTo(geometry.toRect.cy, 1);
  });

  test("child edges attach to DOM rect boundaries", async ({ page }) => {
    await page.goto("/viewer.html?localMapId=pn-edge-child&cloudMapId=pn-edge-child");

    await page.locator('[aria-label="[GUI] navigation root"]').hover();
    await page.waitForTimeout(150);
    await page.locator('[data-pn-node="board"]').hover();
    await page.waitForTimeout(250);

    const geometry = await progressiveNavGeometry(
      page,
      '[data-pn-node="board"]',
      '[data-pn-node="import"]',
      '.wb-progressive-edges path.is-active-edge',
    );

    expect(geometry.activePathCount).toBeGreaterThanOrEqual(4);
    expect(geometry.endpoints.sx).toBeCloseTo(geometry.fromRect.right, 1);
    expect(geometry.endpoints.sy).toBeCloseTo(geometry.fromRect.cy, 1);
    expect(geometry.endpoints.tx).toBeCloseTo(geometry.toRect.left, 1);
    expect(geometry.endpoints.ty).toBeCloseTo(geometry.toRect.cy, 1);
  });
});
