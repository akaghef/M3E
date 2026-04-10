// @ts-check
const { test, expect } = require("@playwright/test");

const BASE = process.env.M3E_PORT
  ? `http://127.0.0.1:${process.env.M3E_PORT}`
  : "http://127.0.0.1:14173";

/**
 * Helper: navigate to viewer.html with a unique doc ID to isolate each test.
 * Waits for the meta panel to show node count, indicating the document loaded.
 */
async function loadViewer(page) {
  const isolatedDocId = `e2e-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const qs = `localDocId=${encodeURIComponent(isolatedDocId)}&cloudDocId=${encodeURIComponent(isolatedDocId)}`;
  await page.goto(`/viewer.html?${qs}`);
  // Wait for the viewer to finish loading: the meta element should contain "nodes:".
  await expect(page.locator("#meta")).toContainText("nodes:", { timeout: 15_000 });
  return { docId: isolatedDocId };
}

/**
 * Helper: parse node count from the meta panel.
 */
async function getNodeCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/nodes:\s*(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse node count from meta: ${metaText}`);
  }
  return Number(match[1]);
}

// ---------------------------------------------------------------------------
// Test 1: Page load - viewer.html returns 200
// ---------------------------------------------------------------------------
test("viewer.html loads successfully with HTTP 200", async ({ page }) => {
  const response = await page.goto("/viewer.html");
  expect(response).not.toBeNull();
  expect(response.status()).toBe(200);

  // Verify essential page structure exists.
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator("#canvas")).toBeVisible();
  // Title is dynamic: "M3E" or "M3E - {root node text}".
  const title = await page.title();
  expect(title).toMatch(/^M3E/);
});

// ---------------------------------------------------------------------------
// Test 2: Root node displays after document load
// ---------------------------------------------------------------------------
test("root node is displayed after document load", async ({ page }) => {
  await loadViewer(page);

  // The meta panel should show at least 1 node.
  const nodeCount = await getNodeCount(page);
  expect(nodeCount).toBeGreaterThanOrEqual(1);

  // A root label element should be visible in the SVG canvas.
  const rootLabels = page.locator("text.label-root");
  await expect(rootLabels.first()).toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// Test 3: Add a child node via Tab key
// ---------------------------------------------------------------------------
test("Tab key adds a child node under the selected node", async ({ page }) => {
  await loadViewer(page);
  await page.click("#board");

  const initialCount = await getNodeCount(page);

  // Tab adds a child node under the currently selected node.
  await page.keyboard.press("Tab");

  // Wait for node count to increase.
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount + 1}`, { timeout: 5_000 });

  // The new node should be selected and an inline editor should appear.
  const editor = page.locator("textarea.inline-node-editor");
  await expect(editor).toBeVisible({ timeout: 3_000 });

  // Press Escape to cancel editing.
  await page.keyboard.press("Escape");
});

// ---------------------------------------------------------------------------
// Test 4: Double-click a node to edit its text
// ---------------------------------------------------------------------------
test("select a node and edit its text via Enter key", async ({ page }) => {
  await loadViewer(page);

  // First click the root node to select it, then use keyboard Enter to edit.
  // Direct dblclick on SVG elements is unreliable due to pointer intercept,
  // so we click-to-select then Enter (which triggers inline edit).
  const rootLabel = page.locator("text.label-root").first();
  await expect(rootLabel).toBeVisible();
  await rootLabel.click({ force: true });
  await page.keyboard.press("Enter");

  // An inline text editor (textarea) should appear.
  const editor = page.locator("textarea.inline-node-editor");
  await expect(editor).toBeVisible({ timeout: 3_000 });

  // Type new text and confirm with Escape (commit edit).
  await editor.fill("E2E Edited Root");
  await page.keyboard.press("Escape");

  // The meta panel should reflect the new text in the selection.
  await expect(page.locator("#meta")).toContainText("selected: E2E Edited Root", { timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// Test 5: API round-trip - POST /api/docs/:id then GET /api/docs/:id
// ---------------------------------------------------------------------------
test("API round-trip: POST a document then GET it back", async ({ request }) => {
  const testDocId = `e2e-api-${Date.now()}`;

  const docPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    state: {
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          parentId: null,
          children: ["child1"],
          nodeType: "text",
          text: "API Test Root",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        child1: {
          id: "child1",
          parentId: "root",
          children: [],
          nodeType: "text",
          text: "API Test Child",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
    },
  };

  // POST the document.
  const postResponse = await request.post(`/api/docs/${encodeURIComponent(testDocId)}`, {
    data: docPayload,
  });
  expect(postResponse.status()).toBe(200);
  const postBody = await postResponse.json();
  expect(postBody.ok).toBe(true);

  // GET the document back.
  const getResponse = await request.get(`/api/docs/${encodeURIComponent(testDocId)}`);
  expect(getResponse.status()).toBe(200);
  const getBody = await getResponse.json();
  expect(getBody.version).toBe(1);
  expect(getBody.state.rootId).toBe("root");
  expect(getBody.state.nodes.root.text).toBe("API Test Root");
  expect(getBody.state.nodes.child1.text).toBe("API Test Child");
  expect(getBody.state.nodes.root.children).toContain("child1");
});
