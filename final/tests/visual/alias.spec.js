// @ts-check
const { test, expect } = require("@playwright/test");
const {
  launchViewer,
  pressKey,
  waitForRender,
  focusBoard,
  expectMetaContains,
  expectStatusContains,
} = require("../helpers/viewer_test_utils");

const aliasJumpMap = {
  version: 1,
  rootId: "root",
  nodes: {
    root: {
      id: "root",
      parentId: null,
      children: ["folder", "alias"],
      nodeType: "folder",
      text: "Alias Jump Scope Test",
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    },
    folder: {
      id: "folder",
      parentId: "root",
      children: ["target"],
      nodeType: "folder",
      text: "Target Scope",
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    },
    target: {
      id: "target",
      parentId: "folder",
      children: [],
      text: "Inside Target",
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    },
    alias: {
      id: "alias",
      parentId: "root",
      children: [],
      nodeType: "alias",
      text: "Alias to Inside Target",
      targetNodeId: "target",
      aliasLabel: "Alias to Inside Target",
      access: "read",
      isBroken: false,
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    },
  },
  links: {},
};

test.describe("Alias shortcuts", () => {
  test("Alt+J jumps from an alias to a target inside another scope", async ({ page }) => {
    await launchViewer(page, aliasJumpMap);
    await focusBoard(page);

    await page.locator('rect.node-hit[data-node-id="alias"]').dispatchEvent("pointerdown", { pointerId: 1, button: 0, buttons: 1, clientX: 10, clientY: 10 });
    await page.locator('rect.node-hit[data-node-id="alias"]').dispatchEvent("pointerup", { pointerId: 1, button: 0, buttons: 0, clientX: 10, clientY: 10 });
    await waitForRender(page);
    await expectMetaContains(page, "selected: Alias to Inside Target");
    await expect(page.locator('text.primary-selected[data-node-id="alias"]')).toBeVisible();

    await pressKey(page, "Alt+J");
    await waitForRender(page, 300);

    await expectMetaContains(page, "selected: Inside Target");
    await expectStatusContains(page, "Jumped to target: Inside Target");
    await expect(page.locator('text.primary-selected[data-node-id="target"]')).toBeVisible();
    await expect(page.locator('text[data-node-id="folder"]').first()).toContainText("Target Scope");
    expect(new URL(page.url()).searchParams.get("scope")).toBe("folder");
  });
});
