const { test, expect } = require("@playwright/test");
const { launchViewer } = require("../helpers/viewer_test_utils");

function xmindLikeFixture() {
  const nodes = {
    root: node("root", null, ["singularity", "bigtech", "abstraction", "markets", "education", "methods"], "数学の特異性とビッグテックの数学志向"),
    singularity: node("singularity", "root", ["singularity-a", "singularity-b"], "数学だけが持つ特異性"),
    "singularity-a": node("singularity-a", "singularity", [], "抽象構造が現実の複数領域に再利用される"),
    "singularity-b": node("singularity-b", "singularity", [], "証明可能性と形式化が知識の寿命を延ばす"),
    bigtech: node("bigtech", "root", ["bigtech-a", "bigtech-b"], "ビッグテックが数学へ向かう理由"),
    "bigtech-a": node("bigtech-a", "bigtech", [], "最適化・暗号・推薦・生成AIを同じ基盤で扱える"),
    "bigtech-b": node("bigtech-b", "bigtech", [], "人材評価で抽象化能力を測りやすい"),
    abstraction: node("abstraction", "root", ["abstraction-a", "abstraction-b"], "抽象化能力の価値"),
    "abstraction-a": node("abstraction-a", "abstraction", [], "対象を変えても保存される関係を見抜く"),
    "abstraction-b": node("abstraction-b", "abstraction", [], "問題設定そのものを再記述できる"),
    markets: node("markets", "root", ["markets-a", "markets-b"], "産業と市場への接続"),
    "markets-a": node("markets-a", "markets", [], "金融・広告・物流・創薬でモデル化が中核になる"),
    "markets-b": node("markets-b", "markets", [], "データ量が増えるほど数学的制約が重要になる"),
    education: node("education", "root", ["education-a"], "教育設計への示唆"),
    "education-a": node("education-a", "education", [], "計算手順より構造理解を先に置く"),
    methods: node("methods", "root", ["methods-a", "methods-b"], "学習と実装の方法論"),
    "methods-a": node("methods-a", "methods", [], "概念マップで依存関係を可視化する"),
    "methods-b": node("methods-b", "methods", [], "例外ケースから定義の強度を検査する"),
  };
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    state: { rootId: "root", nodes, links: {}, annotations: {} },
  };
}

function node(id, parentId, children, text) {
  return {
    id,
    parentId,
    children,
    nodeType: parentId ? "text" : "folder",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
  };
}

async function chooseProgressiveLayout(page, parentId, leafId) {
  await page.locator('[aria-label="[GUI] navigation root"]').evaluate((element) => {
    const nav = document.querySelector('[data-testid="progressive-navigation"]');
    if (!nav?.classList.contains("is-open")) {
      element.click();
    }
  });
  await page.locator('[data-pn-node="view"]').hover();
  await page.locator('[data-pn-node="view"]').evaluate((element) => element.click());
  await page.locator(`[data-pn-node="${parentId}"]`).hover();
  await page.locator(`[data-pn-node="${parentId}"]`).evaluate((element) => element.click());
  await page.locator(`[data-pn-node="${leafId}"]`).evaluate((element) => element.click());
  await page.waitForTimeout(650);
}

async function diagnose(page) {
  return page.evaluate(() => {
    const fn = window.__m3eDiagnoseLayout;
    if (typeof fn !== "function") {
      throw new Error("__m3eDiagnoseLayout is not available.");
    }
    return fn();
  });
}

async function expectLayoutClean(page) {
  const result = await diagnose(page);
  expect(result.ok, JSON.stringify(result.issues, null, 2)).toBe(true);
  expect(result.labelCount).toBe(18);
  expect(result.hitCount).toBe(18);
}

async function centerX(page, nodeId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`.node-hit[data-node-id="${id}"]`);
    if (!(el instanceof SVGGraphicsElement)) {
      throw new Error(`Missing node-hit for ${id}.`);
    }
    const box = el.getBBox();
    return box.x + box.width / 2;
  }, nodeId);
}

async function treeEdgePorts(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("path.edge-tree[data-source-node-id][data-target-node-id]"))
      .map((edge) => {
        return {
          sourceId: edge.getAttribute("data-source-node-id"),
          targetId: edge.getAttribute("data-target-node-id"),
          sourceSide: edge.getAttribute("data-source-port-side"),
          targetSide: edge.getAttribute("data-target-port-side"),
        };
      });
  });
}

test.describe("structured layout integrity", () => {
  test("Tree right edges attach to source and target side ports", async ({ page }) => {
    await launchViewer(page, xmindLikeFixture());
    await expect(page.locator("#mode-meta")).toContainText("/ Tree / Balanced / Right");
    await expectLayoutClean(page);

    const ports = await treeEdgePorts(page);
    expect(ports.length).toBe(17);
    for (const port of ports) {
      expect(port.sourceSide, JSON.stringify(port)).toBe("right");
      expect(port.targetSide, JSON.stringify(port)).toBe("left");
    }
  });

  test("Progressive Navigation layout choices do not collapse the imported XMind-like map", async ({ page }) => {
    await launchViewer(page, xmindLikeFixture());

    const cases = [
      { parent: "mindmap-surface", leaf: "mindmap-both", meta: "/ Mind Map / Balanced / Both" },
      { parent: "mindmap-surface", leaf: "mindmap-right", meta: "/ Mind Map / Balanced / Right" },
      { parent: "mindmap-surface", leaf: "mindmap-left", meta: "/ Mind Map / Balanced / Left" },
      { parent: "mindmap-surface", leaf: "mindmap-compact", meta: "/ Mind Map / Compact / Both" },
      { parent: "mindmap-surface", leaf: "mindmap-spacious", meta: "/ Mind Map / Spacious / Both" },
      { parent: "logic-chart-surface", leaf: "logic-chart-both", meta: "/ Logic Chart / Balanced / Both" },
      { parent: "logic-chart-surface", leaf: "logic-chart-right", meta: "/ Logic Chart / Balanced / Right" },
      { parent: "logic-chart-surface", leaf: "logic-chart-left", meta: "/ Logic Chart / Balanced / Left" },
    ];

    for (const item of cases) {
      await chooseProgressiveLayout(page, item.parent, item.leaf);
      await expect(page.locator("#mode-meta")).toContainText(item.meta);
      await expectLayoutClean(page);
    }
  });

  test("both-side and one-side depth directions are geometrically distinct", async ({ page }) => {
    await launchViewer(page, xmindLikeFixture());

    await chooseProgressiveLayout(page, "mindmap-surface", "mindmap-both");
    const bothRootX = await centerX(page, "root");
    expect(await centerX(page, "singularity")).toBeGreaterThan(bothRootX);
    expect(await centerX(page, "bigtech")).toBeLessThan(bothRootX);
    await expectLayoutClean(page);

    await chooseProgressiveLayout(page, "mindmap-surface", "mindmap-right");
    const rightRootX = await centerX(page, "root");
    for (const id of ["singularity", "bigtech", "abstraction", "markets", "education", "methods"]) {
      expect(await centerX(page, id)).toBeGreaterThan(rightRootX);
    }
    await expectLayoutClean(page);

    await chooseProgressiveLayout(page, "mindmap-surface", "mindmap-left");
    const leftRootX = await centerX(page, "root");
    for (const id of ["singularity", "bigtech", "abstraction", "markets", "education", "methods"]) {
      expect(await centerX(page, id)).toBeLessThan(leftRootX);
    }
    await expectLayoutClean(page);
  });
});
