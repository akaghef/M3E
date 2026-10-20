const { test, expect } = require("@playwright/test");
const { surfaceAction } = require("./lane_helpers");

test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

const node = (id, parentId, children, text, attributes = {}) => ({
  id, parentId, children, text, attributes, nodeType: "text",
  collapsed: false, details: "", note: "", link: "",
});
const fixture = {
  version: 1,
  state: {
    rootId: "root",
    nodes: {
      root: node("root", null, ["a", "b"], "Theme map"),
      a: node("a", "root", ["a1"], "Alpha", { "m3e:edge-label": "Parent edge" }),
      b: node("b", "root", ["b1"], "Beta"),
      a1: node("a1", "a", [], "Item A"),
      b1: node("b1", "b", [], "Item B"),
    },
    links: {
      related: { id: "related", sourceNodeId: "a", targetNodeId: "b",
        relationType: "related", label: "Relation", direction: "forward", style: "default" },
    },
    annotations: {
      date: { id: "date", kind: "text", scopeId: "root", variant: "date",
        text: "10/20", x: 100, y: 100, fontSize: 24 },
    },
    scopes: {}, surfaces: {},
  },
};

async function load(page, renderer) {
  await page.addInitScript(() => localStorage.setItem("m3e:viewer-theme", "light"));
  await page.goto(`/viewer.html?renderer=${renderer}&testRun=theme-${renderer}-${Date.now()}`);
  await page.setInputFiles("#file-input", {
    name: "theme.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.locator('#canvas .label-node[data-node-id="a"]')).toHaveText("Alpha");
}

// Expected colors are the existing viewer.css contract, independent of the
// renderer snapshot. A CSS-only assertion cannot detect stale WebGL paint.
const colors = {
  light: { Alpha: "rgb(35, 35, 35)", "Parent edge": "rgb(102, 102, 102)",
    Relation: "rgb(85, 85, 85)", "10/20": "rgb(36, 36, 36)" },
  dark: { Alpha: "rgb(248, 250, 252)", "Parent edge": "rgb(196, 181, 253)",
    Relation: "rgb(196, 181, 253)", "10/20": "rgb(248, 250, 252)" },
};

for (const renderer of ["webgl", "svg"]) {
  test(`${renderer} surface text changes light → dark → light without reload`, async ({ page }) => {
    await load(page, renderer);
    if (renderer === "webgl") {
      // Do not skip or silently accept SVG fallback.
      await expect.poll(() => page.evaluate(() =>
        window.__m3eWebGLProjection?.getDebugState().active)).toBe(true);
      await expect(page.locator("#webgl-canvas")).toBeVisible();
      await expect(page.locator("#canvas")).toBeHidden();
    } else {
      await expect(page.locator("#canvas")).toBeVisible();
      await expect(page.locator("#webgl-canvas")).toBeHidden();
    }
    const readColors = () => page.evaluate((renderer) => {
      const texts = ["Alpha", "Parent edge", "Relation", "10/20"];
      if (renderer === "webgl") {
        const commands = window.__m3eWebGLProjection.getSnapshot().paintScene.commands;
        return Object.fromEntries(texts.map(text => [text,
          commands.find(command => command.kind === "text" && command.text === text)?.style.fill]));
      }
      return Object.fromEntries(texts.map(text => [text,
        [...document.querySelectorAll("#canvas text")].filter(el => el.textContent === text)
          .map(el => getComputedStyle(el).fill)[0]]));
    }, renderer);
    await expect.poll(readColors).toEqual(colors.light);
    const geometry = () => page.locator("#canvas .node-hit").evaluateAll(elements =>
      elements.map(el => ["x", "y", "width", "height"].map(name => el.getAttribute(name))));
    const beforeGeometry = await geometry();
    const documentHandle = await page.evaluateHandle(() => document);
    for (const theme of ["dark", "light"]) {
      const uploads = renderer === "webgl" ? await page.evaluate(() =>
        window.__m3eWebGLProjection.getDebugState().textureUploads) : 0;
      await page.getByRole("button", { name: `Switch to ${theme} mode`, exact: true }).click();
      await expect.poll(readColors).toEqual(colors[theme]);
      if (renderer === "webgl") {
        await expect.poll(() => page.evaluate(() =>
          window.__m3eWebGLProjection.getDebugState().textureUploads)).toBeGreaterThan(uploads);
        await expect.poll(() => page.evaluate(() =>
          window.__m3eWebGLProjection.getSnapshot().nodes.find(node => node.id === "a").textColor))
          .toBe(colors[theme].Alpha);
      }
      expect(await geometry()).toEqual(beforeGeometry);
      expect(await documentHandle.evaluate(original => original === document)).toBe(true);
    }
  });
}

test("Lane heading, names and counts use theme tokens live in both directions", async ({ page }) => {
  await load(page, "svg");
  await surfaceAction(page, "view", "lane-surface", "lane-direction", "lane-direction-right");
  await expect(page.locator(".lane-title").first()).toBeVisible();
  const read = () => page.locator("#canvas").evaluate(canvas => {
    const fill = selector => getComputedStyle(canvas.querySelector(selector)).fill;
    return { heading: fill(".lane-heading"), name: fill(".lane-title"), count: fill(".lane-count") };
  });
  const light = await read();
  const selected = await page.locator("#canvas").evaluate(canvas => ({
    heading: canvas.querySelector(".lane-heading").classList.contains("selected"),
    name: canvas.querySelector(".lane-title").classList.contains("selected"),
  }));
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await expect.poll(read).toEqual({
    heading: selected.heading ? "rgb(167, 139, 250)" : "rgb(229, 231, 235)",
    name: selected.name ? "rgb(167, 139, 250)" : "rgb(229, 231, 235)",
    count: "rgb(203, 213, 225)",
  });
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await expect.poll(read).toEqual(light);
});
