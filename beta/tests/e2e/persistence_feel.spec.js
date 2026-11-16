// @ts-check
// Acceptance check for changes to how map edits are persisted.
//
// It drives the real viewer against the real server (temporary data directory)
// through the entry points a person or an agent uses: keyboard edits, a second
// tab, the MCP call route, and a page reload. A persistence change is accepted
// only if every case here still passes and the save round trip on the large map
// is not slower than the recorded baseline (see FEEL_BASELINE_MS below).
//
// Run: npm run build && npx playwright test --config playwright.e2e.config.js persistence_feel
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const METRICS_FILE = path.join(__dirname, "test-results", "persistence_feel_metrics.json");
// Median save round trip (ms) measured on the code before the change, on the
// same machine. Unset = record only.
const FEEL_BASELINE_MS = process.env.M3E_FEEL_BASELINE_MS ? Number(process.env.M3E_FEEL_BASELINE_MS) : null;

function node(id, parentId, children, text, extra = {}) {
  return { id, parentId, children, nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "", ...extra };
}

function smallState() {
  return {
    rootId: "root",
    nodes: {
      root: node("root", null, ["A", "B", "C"], "Feel Root"),
      A: node("A", "root", ["a1", "a2"], "Alpha"),
      a1: node("a1", "A", [], "Alpha one"),
      a2: node("a2", "A", [], "Alpha two"),
      B: node("B", "root", [], "Bravo"),
      C: node("C", "root", [], "Charlie"),
    },
  };
}

function largeState(groups, perGroup) {
  const nodes = { root: node("root", null, [], "Large Root") };
  for (let g = 0; g < groups; g += 1) {
    const gid = `g${g}`;
    nodes.root.children.push(gid);
    nodes[gid] = node(gid, "root", [], `Group ${g}`, { collapsed: true });
    for (let i = 0; i < perGroup; i += 1) {
      const id = `${gid}n${i}`;
      nodes[gid].children.push(id);
      nodes[id] = node(id, gid, [], `Item ${g}-${i}`, { details: "detail text for a realistic node payload" });
    }
  }
  return { rootId: "root", nodes };
}

async function seed(request, mapId, state) {
  const response = await request.post(`/api/maps/${encodeURIComponent(mapId)}`, {
    data: { version: 1, savedAt: new Date().toISOString(), state },
  });
  expect(response.status()).toBe(200);
}

async function stored(request, mapId) {
  const response = await request.get(`/api/maps/${encodeURIComponent(mapId)}`);
  expect(response.status()).toBe(200);
  return (await response.json()).state;
}

function uniqueMapId(tag) {
  return `feel-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function open(page, mapId) {
  await page.goto(`/viewer.html?localMapId=${encodeURIComponent(mapId)}&cloudMapId=${encodeURIComponent(mapId)}`);
  await expect(page.locator("#meta")).toContainText("nodes:", { timeout: 30_000 });
  // Focus, not click: on a large map the centre of the board is covered by nodes.
  await page.locator("#board").focus();
}

/** Records every whole-map save the page sends: duration and request size. */
function watchSaves(page, mapId) {
  const saves = [];
  const started = new Map();
  const isSave = (request) => request.method() === "POST" && new URL(request.url()).pathname === `/api/maps/${encodeURIComponent(mapId)}`;
  page.on("request", (request) => { if (isSave(request)) started.set(request, Date.now()); });
  page.on("response", async (response) => {
    const request = response.request();
    if (!started.has(request)) return;
    saves.push({ ms: Date.now() - started.get(request), status: response.status(), bytes: (request.postData() || "").length });
  });
  return saves;
}

async function nextSave(saves, action) {
  const before = saves.length;
  await action();
  await expect.poll(() => saves.length, { timeout: 20_000 }).toBeGreaterThan(before);
  expect(saves[saves.length - 1].status).toBe(200);
}

async function expectSelected(page, text) {
  await expect(page.locator("#meta")).toContainText(`selected: ${text}`, { timeout: 5_000 });
}

async function editSelected(page, text) {
  await page.keyboard.press("Enter");
  const editor = page.locator("textarea.inline-node-editor");
  await expect(editor).toBeVisible({ timeout: 3_000 });
  await editor.fill(text);
  await page.keyboard.press("Escape");
  await expectSelected(page, text);
}

test("keyboard edits are stored and survive a reload", async ({ page, request }) => {
  const mapId = uniqueMapId("edit");
  await seed(request, mapId, smallState());
  const saves = watchSaves(page, mapId);
  await open(page, mapId);

  await page.keyboard.press("ArrowRight");
  await expectSelected(page, "Alpha");

  // Add a child under Alpha and name it.
  await nextSave(saves, async () => {
    await page.keyboard.press("Tab");
    const editor = page.locator("textarea.inline-node-editor");
    await expect(editor).toBeVisible({ timeout: 3_000 });
    await editor.fill("Alpha three");
    await page.keyboard.press("Escape");
    await expect(page.locator("#meta")).toContainText("nodes: 7");
  });

  // Rename Bravo.
  await page.keyboard.press("ArrowLeft");
  await expectSelected(page, "Alpha");
  await page.keyboard.press("ArrowDown");
  await expectSelected(page, "Bravo");
  await nextSave(saves, () => editSelected(page, "Bravo renamed"));

  // Delete Charlie.
  await page.keyboard.press("ArrowDown");
  await expectSelected(page, "Charlie");
  await nextSave(saves, async () => {
    await page.keyboard.press("Delete");
    await expect(page.locator("#meta")).toContainText("nodes: 6");
  });

  const check = (state) => {
    expect(state.nodes.C).toBeUndefined();
    expect(state.nodes.root.children).toEqual(["A", "B"]);
    expect(state.nodes.B.text).toBe("Bravo renamed");
    expect(state.nodes.A.children).toHaveLength(3);
    expect(state.nodes.A.children.slice(0, 2)).toEqual(["a1", "a2"]);
    const added = state.nodes[state.nodes.A.children[2]];
    expect(added.text).toBe("Alpha three");
    expect(added.parentId).toBe("A");
  };
  check(await stored(request, mapId));

  await page.reload();
  await expect(page.locator("#meta")).toContainText("nodes: 6", { timeout: 30_000 });
  await expect(page.locator('text.label-node[data-node-id="B"]').first()).toContainText("Bravo renamed");
  check(await stored(request, mapId));
});

test("reorder, undo and reparent are stored", async ({ page, request }) => {
  const mapId = uniqueMapId("move");
  await seed(request, mapId, smallState());
  const saves = watchSaves(page, mapId);
  await open(page, mapId);
  const board = page.locator("#board");
  const selectBravo = async () => {
    await page.keyboard.press("ArrowLeft");
    await expectSelected(page, "Feel Root");
    await page.keyboard.press("ArrowRight");
    await expectSelected(page, "Alpha");
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, "Bravo");
  };

  // Reorder: hold M (Grab), move Bravo below Charlie, release.
  await selectBravo();
  await nextSave(saves, async () => {
    await page.keyboard.down("m");
    await expect(board).toHaveAttribute("data-keyboard-mode", "grab");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.up("m");
    await expect(board).toHaveAttribute("data-keyboard-mode", "navigate");
  });
  let state = await stored(request, mapId);
  expect(state.nodes.root.children).toEqual(["A", "C", "B"]);

  // Undo restores the order.
  await nextSave(saves, () => page.keyboard.press("ControlOrMeta+z"));
  state = await stored(request, mapId);
  expect(state.nodes.root.children).toEqual(["A", "B", "C"]);

  // Reparent: mark Bravo, select Charlie, paste under it.
  await selectBravo();
  await page.keyboard.press("ControlOrMeta+m");
  await page.keyboard.press("ArrowDown");
  await expectSelected(page, "Charlie");
  await nextSave(saves, () => page.keyboard.press("p"));
  state = await stored(request, mapId);
  expect(state.nodes.B.parentId).toBe("C");
  expect(state.nodes.C.children).toEqual(["B"]);
  expect(state.nodes.root.children).toEqual(["A", "C"]);
});

test("an edit in one tab reaches a second tab without a reload", async ({ context, request }) => {
  const mapId = uniqueMapId("tabs");
  await seed(request, mapId, smallState());
  const first = await context.newPage();
  const second = await context.newPage();
  const saves = watchSaves(first, mapId);
  await open(second, mapId);
  await open(first, mapId);

  await first.keyboard.press("ArrowRight");
  await expectSelected(first, "Alpha");
  await nextSave(saves, () => editSelected(first, "Alpha from tab one"));

  await expect(second.locator('text.label-node[data-node-id="A"]').first()).toContainText("Alpha from tab one", { timeout: 15_000 });
});

test("a write through the MCP route shows in the open viewer and is not overwritten by the next viewer edit", async ({ page, request }) => {
  const mapId = uniqueMapId("mcp");
  await seed(request, mapId, smallState());
  const saves = watchSaves(page, mapId);
  await open(page, mapId);

  const call = async (name, args) => {
    const response = await request.post("/api/mcp/call", { data: { name, arguments: args } });
    const body = await response.json();
    expect(body.ok, JSON.stringify(body)).toBe(true);
    return body;
  };
  const entered = await call("m3e_context", { action: "enter", target: `m3e://maps/${mapId}` });
  await call("m3e_update", {
    context_id: entered.context_id,
    kind: "content",
    target: `m3e://maps/${mapId}/nodes/B`,
    text: "Bravo from agent",
  });

  await expect(page.locator('text.label-node[data-node-id="B"]').first()).toContainText("Bravo from agent", { timeout: 15_000 });

  await page.locator("#board").focus();
  await page.keyboard.press("ArrowRight");
  await expectSelected(page, "Alpha");
  await nextSave(saves, () => editSelected(page, "Alpha after agent"));

  const state = await stored(request, mapId);
  expect(state.nodes.B.text).toBe("Bravo from agent");
  expect(state.nodes.A.text).toBe("Alpha after agent");
});

test("save round trip on a 20,000-node map", async ({ page, request }) => {
  test.setTimeout(240_000);
  const mapId = uniqueMapId("large");
  await seed(request, mapId, largeState(200, 99));
  const saves = watchSaves(page, mapId);
  await open(page, mapId);
  await expect(page.locator("#meta")).toContainText("nodes: 20001", { timeout: 60_000 });

  await page.keyboard.press("ArrowRight");
  await expectSelected(page, "Group 0");
  const interaction = [];
  for (let round = 0; round < 7; round += 1) {
    const text = `Group 0 edit ${round}`;
    const begun = Date.now();
    await nextSave(saves, () => editSelected(page, text));
    interaction.push(Date.now() - begun);
  }

  const state = await stored(request, mapId);
  expect(state.nodes.g0.text).toBe("Group 0 edit 6");
  expect(Object.keys(state.nodes)).toHaveLength(20001);

  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  // The first save includes warm-up; judge on the rest.
  const steady = saves.slice(1);
  const metrics = {
    nodes: 20001,
    saveRoundTripMs: steady.map((save) => save.ms),
    saveRoundTripMedianMs: median(steady.map((save) => save.ms)),
    saveRequestBytes: steady[steady.length - 1].bytes,
    editToStoredMs: interaction.slice(1),
    editToStoredMedianMs: median(interaction.slice(1)),
  };
  fs.mkdirSync(path.dirname(METRICS_FILE), { recursive: true });
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  console.log(`persistence feel metrics: ${JSON.stringify(metrics)}`);

  if (FEEL_BASELINE_MS !== null) {
    expect(metrics.saveRoundTripMedianMs).toBeLessThanOrEqual(FEEL_BASELINE_MS * 1.25);
  }
});
