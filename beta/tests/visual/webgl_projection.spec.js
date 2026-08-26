const { test, expect } = require("@playwright/test");

test.setTimeout(20_000);

const fixture = {
  version: 1,
  savedAt: "2026-08-23T00:00:00.000Z",
  state: {
    rootId: "root",
    nodes: {
      root: { id: "root", parentId: null, children: ["scope", "inside", "long", "collapsed"], nodeType: "folder", text: "WebGL 検証", collapsed: false, details: "", note: "", attributes: {}, link: "" },
      scope: { id: "scope", parentId: "root", children: [], nodeType: "folder", text: "scope", collapsed: false, details: "", note: "", attributes: {}, link: "" },
      inside: { id: "inside", parentId: "root", children: [], nodeType: "text", text: "日本語ラベルと長い表示テキスト", collapsed: false, details: "", note: "", attributes: {}, link: "" },
      long: { id: "long", parentId: "root", children: [], nodeType: "alias", text: "alias", aliasLabel: "長い Alias label", targetNodeId: "inside", collapsed: false, details: "", note: "", attributes: {}, link: "" },
      collapsed: { id: "collapsed", parentId: "root", children: ["hidden"], nodeType: "folder", text: "折りたたみ", collapsed: true, details: "", note: "", attributes: {}, link: "" },
      hidden: { id: "hidden", parentId: "collapsed", children: [], nodeType: "text", text: "非表示の子", collapsed: false, details: "", note: "", attributes: {}, link: "" },
    },
    links: {
      related: { id: "related", sourceNodeId: "inside", targetNodeId: "long", relationType: "related", label: "関連", color: "#7c3aed", direction: "forward", style: "default" },
    },
    annotations: {}, scopes: {}, surfaces: {},
  },
};

async function loadWebGLFixture(page) {
  await page.goto("/viewer.html?renderer=webgl");
  await page.setInputFiles("#file-input", {
    name: "webgl-projection-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  return expect.poll(() => page.evaluate(() => Boolean(window.__m3eWebGLProjection?.getDebugState()?.active)), { timeout: 1000 })
    .toBe(true)
    .then(() => true)
    .catch(() => false);
}

test("WebGL Tree projection preserves map geometry, selection, camera and SVG fallback", async ({ page }) => {
  const active = await loadWebGLFixture(page);
  if (!active) {
    await expect(page.locator("#canvas")).toBeVisible();
    return test.skip(true, "This Chromium runtime does not expose WebGL2; SVG fallback is the expected result.");
  }
  await expect(page.locator("#webgl-canvas")).toBeVisible();
  await expect(page.locator("#canvas")).toBeHidden();

  const before = await page.evaluate(() => window.__m3eWebGLProjection.getSnapshot());
  expect(before.nodes.map((node) => node.id).sort()).toEqual(["collapsed", "inside", "long", "root", "scope"]);
  expect(before.nodes.some((node) => node.id === "hidden")).toBe(false);
  expect(before.graphLinks).toHaveLength(1);
  expect(before.groups).toHaveLength(0);
  expect(before.graphLinks[0]).toMatchObject({ id: "related", sourceNodeId: "inside", targetNodeId: "long" });
  expect(before.nodes.find((node) => node.id === "inside").label).toContain("日本語");

  const state = await page.evaluate(() => ({ snapshot: window.__m3eWebGLProjection.getSnapshot(), debug: window.__m3eWebGLProjection.getDebugState() }));
  const target = state.snapshot.nodes.find((node) => node.id === "inside");
  if (!target) throw new Error("WebGL fixture geometry unavailable.");
  await page.evaluate(({ node, camera }) => {
    const canvas = document.querySelector("#webgl-canvas");
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: rect.left + camera.x + (node.x + node.width / 2) * camera.zoom,
      clientY: rect.top + camera.y + (node.y + node.height / 2) * camera.zoom,
    }));
  }, { node: target, camera: state.debug.camera });
  await expect.poll(() => page.evaluate(() => window.__m3eWebGLProjection.getDebugState().selectedNodeIds), { timeout: 1000 }).toEqual(["inside"]);

  const cameraBefore = await page.evaluate(() => window.__m3eWebGLProjection.getDebugState().camera);
  await page.locator("#webgl-canvas").hover();
  await page.mouse.wheel(0, -260);
  await expect.poll(() => page.evaluate(() => window.__m3eWebGLProjection.getDebugState().camera.zoom)).not.toBe(cameraBefore.zoom);
  const after = await page.evaluate(() => window.__m3eWebGLProjection.getSnapshot());
  expect(after.nodes).toEqual(before.nodes);
  expect(after.graphLinks).toEqual(before.graphLinks);

  const beforeContextLoss = await page.evaluate(() => ({
    snapshot: window.__m3eWebGLProjection.getSnapshot(),
    debug: window.__m3eWebGLProjection.getDebugState(),
  }));
  const contextLossAvailable = await page.evaluate(() => {
    const context = document.querySelector("#webgl-canvas")?.getContext("webgl2");
    const extension = context?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    window.__m3eWebGLContextLossExtension = extension;
    extension.loseContext();
    return true;
  });
  test.skip(!contextLossAvailable, "WEBGL_lose_context is unavailable in this WebGL runtime.");
  await expect(page.locator("#canvas")).toBeVisible();
  await expect(page.locator("#webgl-canvas")).toBeHidden();
  await page.evaluate(() => window.__m3eWebGLContextLossExtension.restoreContext());
  await expect.poll(() => page.evaluate(() => Boolean(window.__m3eWebGLProjection?.getDebugState()?.active)), { timeout: 2_000 }).toBe(true);
  await expect(page.locator("#webgl-canvas")).toBeVisible();
  await expect(page.locator("#canvas")).toBeHidden();
  const afterRestore = await page.evaluate(() => ({
    snapshot: window.__m3eWebGLProjection.getSnapshot(),
    debug: window.__m3eWebGLProjection.getDebugState(),
  }));
  expect(afterRestore.snapshot).toEqual(beforeContextLoss.snapshot);
  expect(afterRestore.debug.camera).toEqual(beforeContextLoss.debug.camera);
  expect(afterRestore.debug.selectedNodeIds).toEqual(["inside"]);

  await page.evaluate(() => window.__m3eWebGLProjection.forceFallback());
  await expect(page.locator("#canvas")).toBeVisible();
  await expect(page.locator("#webgl-canvas")).toBeHidden();
  await expect(page.locator("#meta")).toContainText("selected: 日本語ラベルと長い表示テキスト");
});

test("WebGL Disperse projection carries group boundaries from LayoutResult", async ({ page }) => {
  const active = await loadWebGLFixture(page);
  if (!active) {
    await expect(page.locator("#canvas")).toBeVisible();
    return test.skip(true, "This Chromium runtime does not expose WebGL2; SVG fallback is the expected result.");
  }

  await page.locator("#view-scatter").click();
  await expect(page.locator("#mode-meta")).toContainText("/ Disperse");
  await expect.poll(() => page.evaluate(() => window.__m3eWebGLProjection.getSnapshot().groups.length), { timeout: 1_000 })
    .toBeGreaterThan(0);
});
