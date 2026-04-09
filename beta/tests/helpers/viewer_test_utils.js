// @ts-check
/**
 * Shared test utilities for M3E viewer Playwright tests.
 *
 * Provides helpers to launch the viewer with a fixed JSON document,
 * query DOM state (#meta, #status, node elements), and send keyboard
 * events in a consistent way.
 */
const { expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const FIXTURE_PATH = path.resolve(__dirname, "..", "fixtures", "shortcut_test.json");

/**
 * Load a JSON document into the viewer using the file-input mechanism.
 * If no doc is given, loads the standard shortcut_test.json fixture.
 *
 * @param {import("@playwright/test").Page} page
 * @param {object} [doc] - Optional JSON document object. Falls back to fixture file.
 * @returns {Promise<void>}
 */
async function launchViewer(page, doc) {
  const isolatedDocId = `shortcut-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const qs = `localDocId=${encodeURIComponent(isolatedDocId)}&cloudDocId=${encodeURIComponent(isolatedDocId)}`;
  await page.goto(`/viewer.html?${qs}`);

  const payload = doc || JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));

  await page.setInputFiles("#file-input", {
    name: "shortcut-test.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload), "utf8"),
  });

  await expect(page.locator("#meta")).toContainText("nodes:");
  // Use Alt+V to fit document (no #fit-all button in current UI).
  await page.click("#board");
  await page.keyboard.press("Alt+v");
  await page.waitForTimeout(300);
}

/**
 * Parse the selected node label from #meta text.
 * The meta format includes: `selected: <label> (<count>)`
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<string>} selected node label
 */
async function getSelectedNodeLabel(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/selected:\s*(.+?)\s*\(\d+\)/);
  if (!match) {
    throw new Error(`Unable to parse selected label from meta: ${metaText}`);
  }
  return match[1].trim();
}

/**
 * Get the currently selected node ID by evaluating the viewer's internal state.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<string>} selected node ID
 */
async function getSelectedNodeId(page) {
  // The meta element contains a scope field with an ID-like string.
  // However, to get the actual selected node ID, we look at the SVG element
  // with the `selected` class.
  const id = await page.locator("g.node-group.selected").first().getAttribute("data-node-id");
  if (!id) {
    throw new Error("No selected node found in SVG");
  }
  return id;
}

/**
 * Get the text content of a specific node by its data-node-id.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} nodeId
 * @returns {Promise<string>}
 */
async function getNodeText(page, nodeId) {
  const textEl = page.locator(`text[data-node-id="${nodeId}"]`).first();
  return (await textEl.textContent()) || "";
}

/**
 * Get the total node count from #meta.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<number>}
 */
async function getNodeCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/nodes:\s*(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse node count from meta: ${metaText}`);
  }
  return Number(match[1]);
}

/**
 * Get the selected count from #meta.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<number>}
 */
async function getSelectedCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/selected:\s*.+\((\d+)\)/);
  if (!match) {
    throw new Error(`Unable to parse selected count from meta: ${metaText}`);
  }
  return Number(match[1]);
}

/**
 * Get the link count from #meta.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<number>}
 */
async function getLinkCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/links:\s*(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse link count from meta: ${metaText}`);
  }
  return Number(match[1]);
}

/**
 * Get the status bar text.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<string>}
 */
async function getStatusText(page) {
  return (await page.locator("#status").textContent()) || "";
}

/**
 * Press a key combination on the page.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} key - Playwright key descriptor (e.g. "Tab", "Control+z", "Shift+ArrowDown")
 * @returns {Promise<void>}
 */
async function pressKey(page, key) {
  await page.keyboard.press(key);
}

/**
 * Wait for the viewer to finish a render cycle.
 * Uses a short timeout that matches the viewer's animation/debounce timing.
 *
 * @param {import("@playwright/test").Page} page
 * @param {number} [ms=200]
 * @returns {Promise<void>}
 */
async function waitForRender(page, ms = 200) {
  await page.waitForTimeout(ms);
}

/**
 * Click on the SVG board to ensure keyboard focus is on the viewer.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<void>}
 */
async function focusBoard(page) {
  await page.click("#board");
}

/**
 * Check whether the meta text contains a given substring.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} text
 * @returns {Promise<void>}
 */
async function expectMetaContains(page, text) {
  await expect(page.locator("#meta")).toContainText(text);
}

/**
 * Check whether the status text contains a given substring.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} text
 * @returns {Promise<void>}
 */
async function expectStatusContains(page, text) {
  await expect(page.locator("#status")).toContainText(text);
}

module.exports = {
  launchViewer,
  getSelectedNodeLabel,
  getSelectedNodeId,
  getNodeText,
  getNodeCount,
  getSelectedCount,
  getLinkCount,
  getStatusText,
  pressKey,
  waitForRender,
  focusBoard,
  expectMetaContains,
  expectStatusContains,
};
