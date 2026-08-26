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

async function webglClientPointForNode(page, nodeId) {
  return page.evaluate((id) => {
    const projection = window.__m3eWebGLProjection;
    const snapshot = projection.getSnapshot();
    const debug = projection.getDebugState();
    const node = snapshot.nodes.find((entry) => entry.id === id);
    const canvas = document.querySelector("#webgl-canvas");
    if (!node || !canvas) throw new Error("WebGL node " + id + " is unavailable.");
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + debug.camera.x + (node.x + node.width / 2) * debug.camera.zoom,
      y: rect.top + debug.camera.y + (node.y + node.height / 2) * debug.camera.zoom,
    };
  }, nodeId);
}

async function waitForWebGLActivation(page) {
  await expect.poll(() => page.evaluate(() => Boolean(window.__m3eWebGLProjection?.getDebugState()?.active)), { timeout: 2_000 })
    .toBe(true);
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

test("WebGL Disperse click selects without moving and drag commits through the existing path", async ({ page }) => {
  const active = await loadWebGLFixture(page);
  if (!active) {
    await expect(page.locator("#canvas")).toBeVisible();
    return test.skip(true, "This Chromium runtime does not expose WebGL2; SVG fallback is the expected result.");
  }

  await page.locator("#view-scatter").click();
  await expect(page.locator("#mode-meta")).toContainText("/ Disperse");
  await waitForWebGLActivation(page);

  const beforeClick = await page.evaluate(() => ({
    snapshot: window.__m3eWebGLProjection.getSnapshot(),
    debug: window.__m3eWebGLProjection.getDebugState(),
    meta: document.querySelector("#meta")?.textContent || "",
  }));
  const clickPoint = await webglClientPointForNode(page, "inside");
  await page.mouse.move(clickPoint.x, clickPoint.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__m3eWebGLProjection.getDebugState().selectedNodeIds), { timeout: 1_000 })
    .toEqual(["inside"]);
  const afterClick = await page.evaluate(() => window.__m3eWebGLProjection.getSnapshot());
  const beforeClickNode = beforeClick.snapshot.nodes.find((node) => node.id === "inside");
  const afterClickNode = afterClick.nodes.find((node) => node.id === "inside");
  expect(afterClickNode).toMatchObject({ x: beforeClickNode.x, y: beforeClickNode.y });

  const svgBeforeDrag = await page.locator("#canvas").evaluate((element) => element.innerHTML);
  const dragPoint = await webglClientPointForNode(page, "inside");
  const savedAtBeforeDrag = (await page.locator("#meta").textContent()).match(/savedAt: ([^|]+)/)?.[1];
  await page.mouse.move(dragPoint.x, dragPoint.y);
  await page.mouse.down();
  await page.mouse.move(dragPoint.x + 140, dragPoint.y + 70, { steps: 6 });
  const duringDrag = await page.evaluate(() => ({
    snapshot: window.__m3eWebGLProjection.getSnapshot(),
    svg: document.querySelector("#canvas")?.innerHTML || "",
  }));
  const duringDragNode = duringDrag.snapshot.nodes.find((node) => node.id === "inside");
  expect(duringDragNode.x).not.toBe(beforeClickNode.x);
  expect(duringDragNode.y).not.toBe(beforeClickNode.y);
  expect(duringDrag.svg).toBe(svgBeforeDrag);
  await page.mouse.up();

  await expect(page.locator("#status")).toContainText("Disperse position updated.");
  await waitForWebGLActivation(page);
  const afterDrag = await page.evaluate(() => window.__m3eWebGLProjection.getSnapshot());
  const afterDragNode = afterDrag.nodes.find((node) => node.id === "inside");
  expect(afterDragNode.x).toBe(duringDragNode.x);
  expect(afterDragNode.y).toBe(duringDragNode.y);
  const savedAtAfterDrag = (await page.locator("#meta").textContent()).match(/savedAt: ([^|]+)/)?.[1];
  expect(savedAtAfterDrag).toBeTruthy();
  expect(savedAtAfterDrag).not.toBe(savedAtBeforeDrag);
});

test("WebGL Disperse drag preserves SVG multi-selection roots", async ({ page }) => {
  const active = await loadWebGLFixture(page);
  if (!active) {
    await expect(page.locator("#canvas")).toBeVisible();
    return test.skip(true, "This Chromium runtime does not expose WebGL2; SVG fallback is the expected result.");
  }

  await page.locator("#view-scatter").click();
  await waitForWebGLActivation(page);
  const insidePoint = await webglClientPointForNode(page, "inside");
  await page.mouse.move(insidePoint.x, insidePoint.y);
  await page.mouse.click(insidePoint.x, insidePoint.y);
  await waitForWebGLActivation(page);

  const longPoint = await webglClientPointForNode(page, "long");
  await page.mouse.move(longPoint.x, longPoint.y);
  await page.keyboard.down("Control");
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up("Control");
  await expect.poll(() => page.evaluate(() => window.__m3eWebGLProjection.getDebugState().selectedNodeIds), { timeout: 1_000 })
    .toEqual(["inside", "long"]);
  await waitForWebGLActivation(page);

  const before = await page.evaluate(() => window.__m3eWebGLProjection.getSnapshot());
  const insideBefore = before.nodes.find((node) => node.id === "inside");
  const longBefore = before.nodes.find((node) => node.id === "long");
  const drag = await webglClientPointForNode(page, "inside");
  await page.mouse.move(drag.x, drag.y);
  await page.mouse.down();
  await page.mouse.move(drag.x + 100, drag.y + 40, { steps: 5 });
  const during = await page.evaluate(() => window.__m3eWebGLProjection.getSnapshot());
  const insideDuring = during.nodes.find((node) => node.id === "inside");
  const longDuring = during.nodes.find((node) => node.id === "long");
  expect(insideDuring.x - insideBefore.x).toBe(longDuring.x - longBefore.x);
  expect(insideDuring.y - insideBefore.y).toBe(longDuring.y - longBefore.y);
  await page.mouse.up();
  await expect(page.locator("#status")).toContainText("Disperse position updated.");
});

test("WebGL Disperse group boundaries remain outside node drag hit testing", async ({ page }) => {
  const active = await loadWebGLFixture(page);
  if (!active) {
    await expect(page.locator("#canvas")).toBeVisible();
    return test.skip(true, "This Chromium runtime does not expose WebGL2; SVG fallback is the expected result.");
  }

  await page.locator("#view-scatter").click();
  await waitForWebGLActivation(page);
  const boundaryPoint = await page.evaluate(() => {
    const projection = window.__m3eWebGLProjection;
    const snapshot = projection.getSnapshot();
    const debug = projection.getDebugState();
    const canvas = document.querySelector("#webgl-canvas");
    const group = snapshot.groups[0];
    if (!canvas || !group) throw new Error("WebGL Disperse group boundary is unavailable.");
    const candidates = [
      { x: group.x + group.width / 2, y: group.y + 2 },
      { x: group.x + group.width - 2, y: group.y + group.height / 2 },
      { x: group.x + 2, y: group.y + group.height / 2 },
      { x: group.x + group.width / 2, y: group.y + group.height - 2 },
    ];
    const clear = candidates.find((point) => !snapshot.nodes.some((node) =>
      point.x >= node.x && point.x <= node.x + node.width &&
      point.y >= node.y && point.y <= node.y + node.height
    ));
    if (!clear) throw new Error("No clear group-boundary probe point is available.");
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + debug.camera.x + clear.x * debug.camera.zoom,
      y: rect.top + debug.camera.y + clear.y * debug.camera.zoom,
    };
  });
  const before = await page.evaluate(() => ({
    snapshot: window.__m3eWebGLProjection.getSnapshot(),
    selected: window.__m3eWebGLProjection.getDebugState().selectedNodeIds,
  }));
  await page.mouse.move(boundaryPoint.x, boundaryPoint.y);
  await page.mouse.down();
  await page.mouse.move(boundaryPoint.x + 100, boundaryPoint.y + 50, { steps: 4 });
  await page.mouse.up();
  await waitForWebGLActivation(page);
  const after = await page.evaluate(() => ({
    snapshot: window.__m3eWebGLProjection.getSnapshot(),
    selected: window.__m3eWebGLProjection.getDebugState().selectedNodeIds,
  }));
  expect(after.selected).toEqual(before.selected);
  expect(after.snapshot.nodes.map((node) => [node.id, node.x, node.y]))
    .toEqual(before.snapshot.nodes.map((node) => [node.id, node.x, node.y]));
});
