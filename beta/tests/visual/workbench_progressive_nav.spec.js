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

async function nodeCount(page) {
  const metaText = await page.locator("#meta").textContent();
  const match = (metaText || "").match(/nodes:\s*(\d+)/);
  if (!match) throw new Error(`Node count missing from meta: ${metaText}`);
  return Number(match[1]);
}

function rapidFixture() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    state: {
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          parentId: null,
          children: ["question", "background", "hypothesis"],
          nodeType: "folder",
          text: "Research Root",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        question: {
          id: "question",
          parentId: "root",
          children: [],
          nodeType: "text",
          text: "Question",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        background: {
          id: "background",
          parentId: "root",
          children: [],
          nodeType: "text",
          text: "Background",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        hypothesis: {
          id: "hypothesis",
          parentId: "root",
          children: [],
          nodeType: "text",
          text: "Hypothesis",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
      links: {},
      annotations: {},
    },
  };
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

  test("Space opens active-node expand actions directly and N3-N6 generate", async ({ page }) => {
    const mapId = `pn-active-node-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const doc = rapidFixture();
    let savedAt = doc.savedAt;
    let sequence = 0;
    await page.route(`**/api/maps/${mapId}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Method not allowed." }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(doc) });
    });
    await page.route(`**/api/maps/${mapId}/rapid/mapify-oracle`, async (route) => {
      const payload = JSON.parse(route.request().postData() || "{}");
      const action = String(payload.action || "detail");
      const selectedNodeId = String(payload.selectedNodeId || doc.state.rootId);
      const labelsByAction = {
        detail: ["特徴", "背景", "論点"],
        examples: ["具体例A", "具体例B"],
        classify: ["分類A", "分類B"],
        related: ["関連topicA", "関連topicB"],
      };
      const parent = doc.state.nodes[selectedNodeId];
      const existing = new Set((parent.children || []).map((id) => doc.state.nodes[id]?.text).filter(Boolean));
      const added = [];
      for (const label of labelsByAction[action] || labelsByAction.detail) {
        if (existing.has(label)) continue;
        const id = `rapid-${action}-${sequence++}`;
        doc.state.nodes[id] = {
          id,
          parentId: selectedNodeId,
          children: [],
          nodeType: "text",
          text: label,
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        };
        parent.children.push(id);
        added.push({ id, parentId: selectedNodeId, label });
      }
      savedAt = new Date().toISOString();
      doc.savedAt = savedAt;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          savedAt,
          opId: "RF-test",
          action,
          source: "m3e_local_mf_h_fallback",
          fragment: added.map((node) => `# ${node.label}`).join("\n"),
          added,
          merged: [],
          diagnostics: [],
          oracle: { teacherLabels: [], teacherProximity: null },
        }),
      });
    });
    await page.goto(`/viewer.html?localMapId=${mapId}&cloudMapId=${mapId}`);
    await expect(page.locator("#meta")).toContainText("selected:");

    await page.keyboard.press("Space");
    await expect(page.locator('.wb-progressive-nav[data-pn-mode="active-node"].is-open')).toBeVisible();
    await expect(page.locator('[data-pn-node="rapid"]')).toHaveCount(0);
    await expect(page.locator('[data-pn-node="rapid-expand"]')).toContainText("N2 展開");

    await page.locator('[data-pn-node="rapid-expand"]').hover();
    await expect(page.locator('[data-pn-node="rapid-detail"]')).toContainText("N3 詳細化");
    await expect(page.locator('[data-pn-node="rapid-examples"]')).toContainText("N4 例を追加");
    await expect(page.locator('[data-pn-node="rapid-classify"]')).toContainText("N5 子分類を追加");
    await expect(page.locator('[data-pn-node="rapid-related"]')).toContainText("N6 関連topic追加");

    const actions = [
      ["rapid-detail", "N3 詳細化"],
      ["rapid-examples", "N4 例を追加"],
      ["rapid-classify", "N5 子分類を追加"],
      ["rapid-related", "N6 関連topic追加"],
    ];
    for (let index = 0; index < actions.length; index += 1) {
      const [nodeId, label] = actions[index];
      const beforeAction = await nodeCount(page);
      await page.locator('[data-pn-node="rapid-expand"]').hover();
      await page.locator(`[data-pn-node="${nodeId}"]`).click();
      await expect(page.locator("#status")).toContainText(label);
      await expect.poll(() => nodeCount(page)).toBeGreaterThan(beforeAction);
      await page.keyboard.press("Space");
    }
  });

  test("E toggles selected node collapse and expand", async ({ page }) => {
    await page.goto("/viewer.html?localMapId=pn-e-collapse&cloudMapId=pn-e-collapse");
    await expect(page.locator("#meta")).toContainText("selected:");

    await page.keyboard.press("E");
    await expect.poll(() => page.locator(".collapsed-badge").count()).toBeGreaterThan(0);

    await page.keyboard.press("E");
    await expect.poll(() => page.locator(".collapsed-badge").count()).toBe(0);
  });

  test("Space does not open active-node PN while typing", async ({ page }) => {
    await page.goto("/viewer.html?localMapId=pn-input-guard&cloudMapId=pn-input-guard");

    await page.locator('[aria-label="AI sidekick"]').click();
    await page.locator(".wb-ai-composer textarea").click();
    await page.keyboard.press("Space");

    await expect(page.locator('.wb-progressive-nav[data-pn-mode="active-node"].is-open')).toHaveCount(0);
  });
});
