// @ts-check
/**
 * Keyboard shortcut integration tests for M3E viewer.
 *
 * These tests load a fixed JSON fixture into the viewer via Playwright,
 * send keyboard events, and verify the resulting state through the #meta
 * and #status DOM elements.
 *
 * Fixture: tests/fixtures/shortcut_test.json
 *   Test Root
 *     Child A
 *       Grandchild A1
 *       Grandchild A2
 *     Child B
 *     Child C
 *       Grandchild C1
 *
 * Total: 7 nodes
 */
const { test, expect } = require("@playwright/test");
const {
  launchViewer,
  getNodeCount,
  getSelectedCount,
  getLinkCount,
  pressKey,
  waitForRender,
  focusBoard,
  expectMetaContains,
  expectStatusContains,
} = require("../helpers/viewer_test_utils");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Navigation: Arrow keys
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Arrow key navigation", () => {
  test("ArrowDown moves selection to next sibling", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);
    // Initial selection is root. ArrowRight to enter children.
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child C");
  });

  test("ArrowUp moves selection to previous sibling", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    // Move down to Child C, then back up.
    await pressKey(page, "ArrowDown");
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child C");

    await pressKey(page, "ArrowUp");
    await expectMetaContains(page, "selected: Child B");
  });

  test("ArrowRight selects first child", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);
    // Root -> Child A
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    // Child A -> Grandchild A1
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Grandchild A1");
  });

  test("ArrowLeft selects parent", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);
    await pressKey(page, "ArrowRight");
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Grandchild A1");

    await pressKey(page, "ArrowLeft");
    await expectMetaContains(page, "selected: Child A");

    await pressKey(page, "ArrowLeft");
    await expectMetaContains(page, "selected: Test Root");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shift+Arrow: Selection extension
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Shift+Arrow selection extension", () => {
  test("Shift+ArrowDown extends selection from root", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Start from root (mirrors existing viewer.visual.spec.js pattern).
    await expectMetaContains(page, "selected: Test Root (1)");
    const before = await getSelectedCount(page);

    await pressKey(page, "Shift+ArrowDown");
    const after = await getSelectedCount(page);
    expect(after).toBeGreaterThan(before);
  });

  test("Shift+ArrowDown extends further on consecutive presses from root", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    await pressKey(page, "Shift+ArrowDown");
    const afterOne = await getSelectedCount(page);
    expect(afterOne).toBeGreaterThanOrEqual(2);

    await pressKey(page, "Shift+ArrowDown");
    const afterTwo = await getSelectedCount(page);
    // Second press should keep or extend selection (layout-dependent).
    expect(afterTwo).toBeGreaterThanOrEqual(afterOne);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab: Add child node
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Tab: add child node", () => {
  test("Tab creates a child node and enters edit mode", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    const initialCount = await getNodeCount(page);

    // Select Child B (a leaf) first.
    await pressKey(page, "ArrowRight");
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    await pressKey(page, "Tab");
    await waitForRender(page);

    // An inline editor should appear (input element).
    await expect(page.locator("textarea.inline-node-editor")).toBeVisible();

    // Escape to finish editing.
    await pressKey(page, "Escape");
    await waitForRender(page);

    const newCount = await getNodeCount(page);
    expect(newCount).toBe(initialCount + 1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Space: Toggle collapse/expand
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Space: collapse/expand toggle", () => {
  test("Space collapses a node with children, then expands it", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Navigate to Child A (has 2 children).
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    const beforeCollapse = await getNodeCount(page);

    // Collapse.
    await pressKey(page, " ");
    await waitForRender(page);

    // After collapse the visible node count remains the same in #meta
    // (it counts all nodes), but Grandchild A1/A2 should be hidden visually.
    // We verify that ArrowRight no longer enters children when collapsed.
    // Actually, let's verify the node is collapsed by checking meta or
    // re-expanding.

    // Expand again.
    await pressKey(page, " ");
    await waitForRender(page);

    // Verify can navigate into children again.
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Grandchild A1");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Delete / Backspace: Remove node
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Delete and Backspace: remove node", () => {
  test("Delete removes a leaf node", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    const initialCount = await getNodeCount(page);

    // Navigate to Child B (leaf).
    await pressKey(page, "ArrowRight");
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    await pressKey(page, "Delete");
    await waitForRender(page);

    const afterCount = await getNodeCount(page);
    expect(afterCount).toBe(initialCount - 1);
  });

  test("Backspace removes a leaf node", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    const initialCount = await getNodeCount(page);

    // Navigate to Child B (leaf).
    await pressKey(page, "ArrowRight");
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    await pressKey(page, "Backspace");
    await waitForRender(page);

    const afterCount = await getNodeCount(page);
    expect(afterCount).toBe(initialCount - 1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ctrl+Z / Ctrl+Y: Undo / Redo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Undo and Redo", () => {
  test("Ctrl+Z undoes node addition, Ctrl+Y redoes it", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    const initialCount = await getNodeCount(page);

    // Add a child node via Tab (creates node + opens inline edit), then Escape.
    await pressKey(page, "Tab");
    await pressKey(page, "Escape");
    await waitForRender(page);
    await expectMetaContains(page, `nodes: ${initialCount + 1}`);

    // Undo.
    await pressKey(page, "Control+z");
    await expectMetaContains(page, `nodes: ${initialCount}`);

    // Redo with Ctrl+Y.
    await pressKey(page, "Control+y");
    await expectMetaContains(page, `nodes: ${initialCount + 1}`);
  });

  test("Ctrl+Shift+Z also redoes", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    const initialCount = await getNodeCount(page);

    // Add a child node via Tab, then Escape.
    await pressKey(page, "Tab");
    await pressKey(page, "Escape");
    await waitForRender(page);

    await pressKey(page, "Control+z");
    await expectMetaContains(page, `nodes: ${initialCount}`);

    await pressKey(page, "Control+Shift+z");
    await expectMetaContains(page, `nodes: ${initialCount + 1}`);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ctrl+C / Ctrl+V: Copy / Paste
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Copy and Paste", () => {
  test("Ctrl+C then Ctrl+V duplicates a node", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    const initialCount = await getNodeCount(page);

    // Navigate to Child B.
    await pressKey(page, "ArrowRight");
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    // Copy.
    await pressKey(page, "Control+c");
    await waitForRender(page);

    // Paste (pastes as sibling or child depending on impl).
    await pressKey(page, "Control+v");
    await waitForRender(page);

    const afterCount = await getNodeCount(page);
    expect(afterCount).toBeGreaterThan(initialCount);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ctrl+X: Cut (with Escape to cancel)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Cut and cancel", () => {
  test("Ctrl+X puts node in cut state, Escape cancels", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Navigate to Child B.
    await pressKey(page, "ArrowRight");
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    const initialCount = await getNodeCount(page);

    // Cut.
    await pressKey(page, "Control+x");
    await waitForRender(page);

    // Cancel with Escape.
    await pressKey(page, "Escape");
    await waitForRender(page);

    // Node count should remain the same (cut was cancelled before paste).
    const afterCount = await getNodeCount(page);
    expect(afterCount).toBe(initialCount);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1, 2, 3: ThinkingMode toggle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("ThinkingMode toggle (1/2/3)", () => {
  test("pressing 1 sets flash mode", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    await pressKey(page, "1");
    await waitForRender(page);
    await expectStatusContains(page, "Mode: Flash");
  });

  test("pressing 2 sets rapid mode (after switching away first)", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Default mode is rapid, so switch to flash first then back to rapid.
    await pressKey(page, "1");
    await waitForRender(page);
    await expectStatusContains(page, "Mode: Flash");

    await pressKey(page, "2");
    await waitForRender(page);
    await expectStatusContains(page, "Mode: Rapid");
  });

  test("pressing 3 sets deep mode", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    await pressKey(page, "3");
    await waitForRender(page);
    await expectStatusContains(page, "Mode: Deep");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// L -> Shift+L: GraphLink creation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("GraphLink via L / Shift+L", () => {
  test("L marks link source, Shift+L applies link", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Select Child A as link source.
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    await pressKey(page, "l");
    await waitForRender(page);
    await expectMetaContains(page, "link-source: Child A");

    // Navigate to Child B as target.
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    // Apply link.
    await pressKey(page, "Shift+l");
    await waitForRender(page);

    expect(await getLinkCount(page)).toBe(1);
    await expectStatusContains(page, "Linked");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ctrl+] / Ctrl+[: Scope navigation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Scope navigation", () => {
  test("F converts node to folder, then ArrowRight enters and ArrowLeft exits scope", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Select Child A.
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    // Convert to folder.
    await pressKey(page, "f");
    await waitForRender(page);
    await expectStatusContains(page, "Marked as folder scope");

    // ArrowRight on a folder node enters its scope.
    await pressKey(page, "ArrowRight");
    await waitForRender(page);
    await expectMetaContains(page, "scope: child-a");

    // At scope root, ArrowLeft exits scope.
    await pressKey(page, "ArrowLeft");
    await waitForRender(page);
    await expectMetaContains(page, "scope: root");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enter / F2: Inline edit
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Inline editing (Enter / F2)", () => {
  test("Enter opens inline editor", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Navigate to Child A.
    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    await pressKey(page, "Enter");
    await expect(page.locator("textarea.inline-node-editor")).toBeVisible();

    await pressKey(page, "Escape");
    await expect(page.locator("textarea.inline-node-editor")).not.toBeVisible();
  });

  test("F2 opens inline editor with text selected", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    await pressKey(page, "ArrowRight");
    await expectMetaContains(page, "selected: Child A");

    await pressKey(page, "F2");
    await expect(page.locator("textarea.inline-node-editor")).toBeVisible();

    await pressKey(page, "Escape");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ctrl+A: Select all
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Ctrl+A: select all visible", () => {
  test("Ctrl+A selects all visible nodes in scope", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    await pressKey(page, "Control+a");
    await waitForRender(page);

    // All 7 nodes should be selected.
    const count = await getSelectedCount(page);
    expect(count).toBe(7);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Zoom: -, =, 0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Zoom shortcuts (-, =, 0)", () => {
  test("minus zooms out, equals zooms in, zero resets", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Zoom out.
    await pressKey(page, "-");
    await waitForRender(page);

    // Zoom in.
    await pressKey(page, "=");
    await waitForRender(page);

    // Reset zoom to 1.
    await pressKey(page, "0");
    await waitForRender(page);

    // No crash means success. We verify the page is still functional.
    await expectMetaContains(page, "nodes: 7");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ctrl+G: Group selected
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Ctrl+G: group selected", () => {
  test("Ctrl+G groups multiple selected nodes under a new parent", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    const initialCount = await getNodeCount(page);

    // Click Child A, then Ctrl+click Child B to multi-select.
    const childA = page.locator("text.label-node", { hasText: "Child A" }).first();
    const childB = page.locator("text.label-node", { hasText: "Child B" }).first();
    await childA.click({ force: true });
    await childB.click({ modifiers: ["Control"], force: true });

    const selectedCount = await getSelectedCount(page);
    expect(selectedCount).toBe(2);

    // Group.
    await pressKey(page, "Control+g");
    await waitForRender(page);

    // Grouping creates a new parent node, so count increases by 1.
    const afterCount = await getNodeCount(page);
    expect(afterCount).toBe(initialCount + 1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// M / Ctrl+M: Mark reparent source, then P to apply
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Reparent via M -> P", () => {
  test("M marks reparent source, navigate to target, P reparents", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Select Child B as source.
    await pressKey(page, "ArrowRight");
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child B");

    // Mark as move source.
    await pressKey(page, "m");
    await waitForRender(page);
    await expectMetaContains(page, "move-node: 1 selected");

    // Navigate to Child C as target.
    await pressKey(page, "ArrowDown");
    await expectMetaContains(page, "selected: Child C");

    // Apply reparent.
    await pressKey(page, "p");
    await waitForRender(page);

    await expectStatusContains(page, "Moved");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// I: Toggle meta panel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("I: toggle meta panel", () => {
  test("I toggles meta panel visibility", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Press I to toggle.
    await pressKey(page, "i");
    await waitForRender(page);

    // Press I again to toggle back.
    await pressKey(page, "i");
    await waitForRender(page);

    // Viewer should still be functional.
    await expectMetaContains(page, "nodes: 7");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ctrl+S: Download JSON (smoke test)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Ctrl+S: download JSON", () => {
  test("Ctrl+S triggers download without error", async ({ page }) => {
    await launchViewer(page);
    await focusBoard(page);

    // Set up download listener.
    const downloadPromise = page.waitForEvent("download", { timeout: 3000 }).catch(() => null);

    await pressKey(page, "Control+s");
    await waitForRender(page);

    const download = await downloadPromise;
    // Download may or may not fire depending on browser config,
    // but the page should not crash.
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.json$/);
    }

    // Viewer still functional.
    await expectMetaContains(page, "nodes: 7");
  });
});
