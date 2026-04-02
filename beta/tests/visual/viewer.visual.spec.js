const { test, expect } = require("@playwright/test");

async function loadAndStabilize(page, buttonId) {
  await page.goto("/viewer.html");
  await page.click(buttonId);
  await expect(page.locator("#meta")).toContainText("nodes:");
  await page.click("#fit-all");
  await page.waitForTimeout(300);
}

async function getNodeCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/nodes:\s*(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse node count from meta: ${metaText}`);
  }
  return Number(match[1]);
}

async function getSelectedCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/selected:\s*.+\((\d+)\)/);
  if (!match) {
    throw new Error(`Unable to parse selected count from meta: ${metaText}`);
  }
  return Number(match[1]);
}

async function dragNodeLabel(page, sourceText, targetText) {
  const source = page.locator("text.label-node", { hasText: sourceText }).first();
  const target = page.locator("text.label-root", { hasText: targetText }).first();

  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Failed to get source/target bounds for drag operation.");
  }

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 12 });
  await page.mouse.up();
}

async function dragNodeToNode(page, sourceText, targetText) {
  const source = page.locator("text.label-node", { hasText: sourceText }).first();
  const target = page.locator("text.label-node", { hasText: targetText }).first();

  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Failed to get source/target bounds for node-to-node drag.");
  }

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 12 });
  await page.mouse.up();
}

// 目的: デフォルトサンプルを全体表示した状態で、描画の見た目が崩れていないかを比較する。
test("default sample visual baseline", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await expect(page.locator("#board")).toHaveScreenshot("default-sample.png");
});

// 目的: aircraft.mm 読み込み後に Body 周辺へフォーカスし、主要ラベルと枝の見た目を比較する。
test("aircraft mm visual baseline", async ({ page }) => {
  await loadAndStabilize(page, "#load-aircraft-mm");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#meta")).toContainText("selected: Body");
  await page.click("#focus-selected");
  await page.waitForTimeout(300);
  await expect(page.locator("#board")).toHaveScreenshot("aircraft-mm-body-focus.png");
});

// 目的: viewer UI で Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y が期待通りに undo/redo できることを検証する。
test("viewer keyboard undo redo", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await page.click("#board");

  const initialCount = await getNodeCount(page);

  await page.keyboard.press("Enter");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount + 1}`);
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  await page.keyboard.press("Control+z");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount}`);

  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount + 1}`);
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  await page.keyboard.press("Control+z");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount}`);

  await page.keyboard.press("Control+y");
  await expect(page.locator("#meta")).toContainText(`nodes: ${initialCount + 1}`);
  await expect(page.locator("#meta")).toContainText("selected: New Node");
});

// 目的: drag reparent で root ノードをターゲットにできることを再現確認する。
test("viewer drag reparent to root", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");

  await dragNodeLabel(page, "Background", "Research Root");
  await expect(page.locator("#status")).toContainText("Moved \"Background\" under \"Research Root\".");

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#meta")).toContainText("selected: Research Root");
});

// 目的: Shift範囲選択 -> Ctrl+M(マーク) -> target選択 -> p(一括reparent) が成立することを確認する。
test("viewer range select multi reparent", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await page.click("#board");

  // Ensure root is selected, then create a dedicated target node under root.
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#meta")).toContainText("selected: Research Root");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  // Range-select from Question to Hypothesis.
  const question = page.locator("text.label-node", { hasText: "Question" }).first();
  const hypothesis = page.locator("text.label-node", { hasText: "Hypothesis v2" }).first();
  await question.click({ force: true });
  await hypothesis.click({ modifiers: ["Shift"], force: true });

  // Mark selected roots.
  await page.keyboard.press("Control+m");

  // Select target node New Node and apply multi reparent.
  const target = page.locator("text.label-node", { hasText: "New Node" }).first();
  await target.click({ force: true });
  await expect(page.locator("#meta")).toContainText("selected: New Node");
  await page.keyboard.press("p");

  await expect(page.locator("#status")).toContainText("Moved 2 node(s).");
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  // Validate depth navigation into the newly moved subtree.
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#meta")).toContainText("selected: Question");
});

// 目的: 複数選択状態でドラッグした場合に、選択 root 全体が reparent されることを確認する。
test("viewer multi drag reparent", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await page.click("#board");

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#meta")).toContainText("selected: Research Root");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  const question = page.locator("text.label-node", { hasText: "Question" }).first();
  const hypothesis = page.locator("text.label-node", { hasText: "Hypothesis v2" }).first();
  await question.click({ force: true });
  await hypothesis.click({ modifiers: ["Control"], force: true });

  await dragNodeToNode(page, "Question", "New Node");

  await expect(page.locator("#status")).toContainText("Moved 2 node(s).");
  await expect(page.locator("#meta")).toContainText("selected: New Node");
});

// 目的: root を含む選択を reparent ソースにマークしても、非 root ノードは一括 reparent できることを確認する。
test("viewer multi reparent ignores root in marked sources", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await page.click("#board");

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#meta")).toContainText("selected: Research Root");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("#meta")).toContainText("selected: New Node");

  const question = page.locator("text.label-node", { hasText: "Question" }).first();
  const hypothesis = page.locator("text.label-node", { hasText: "Hypothesis v2" }).first();
  const root = page.locator("text.label-root", { hasText: "Research Root" }).first();
  const target = page.locator("text.label-node", { hasText: "New Node" }).first();

  await question.click({ force: true });
  await hypothesis.click({ modifiers: ["Control"], force: true });
  await root.click({ modifiers: ["Control"], force: true });

  await page.keyboard.press("Control+m");
  await target.click({ force: true });
  await page.keyboard.press("p");

  await expect(page.locator("#status")).toContainText("Moved 2 node(s).");
  await expect(page.locator("#meta")).toContainText("selected: New Node");
});

// 目的: Shift+ArrowUp/Down で可視順に選択が拡張されることを確認する。
test("viewer shift arrow expands selection", async ({ page }) => {
  await loadAndStabilize(page, "#load-default");
  await page.click("#board");

  await expect(page.locator("#meta")).toContainText("selected: Research Root (1)");
  const selectedBefore = await getSelectedCount(page);
  await page.keyboard.press("Shift+ArrowDown");
  const selectedAfterOneStep = await getSelectedCount(page);
  expect(selectedAfterOneStep).toBeGreaterThan(selectedBefore);

  await page.keyboard.press("Shift+ArrowDown");
  const selectedAfterTwoSteps = await getSelectedCount(page);
  expect(selectedAfterTwoSteps).toBeGreaterThan(selectedAfterOneStep);
});