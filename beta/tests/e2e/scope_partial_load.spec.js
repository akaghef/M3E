// @ts-check
// Scope view (viewer.html?...&scope=<id>&partial=1): the viewer loads and edits only the
// nodes that belong to one scope of a large map.
//
// Real viewer against the real server on temporary data (same bootstrapping as
// persistence_feel.spec.js). Synthetic 20,000-node map; the opened scope owns about 650.
//
// Run (default storage):  M3E_PORT=14195 npx playwright test --config playwright.e2e.config.js scope_partial_load
// Run (record store):     M3E_STORE_DIR=<empty temp dir> M3E_PORT=14195 npx playwright test --config playwright.e2e.config.js scope_partial_load
const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { largeScopedMap } = require("../fixtures/scope_view_large_map.js");

const STORAGE = process.env.M3E_STORE_DIR ? "record-store" : "sqlite";
const METRICS_FILE = path.join(__dirname, "test-results", `scope_partial_load_metrics.${STORAGE}.json`);
const SCOPE = "S";

function uniqueMapId(tag) {
  return `scopeview-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
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

/** Records every request the page makes to the map's own routes. */
function watchMapRequests(page, mapId) {
  const base = `/api/maps/${encodeURIComponent(mapId)}`;
  const log = { wholeGets: 0, scopeViewGets: [], wholePosts: 0, saves: [] };
  page.on("response", async (response) => {
    const request = response.request();
    const url = new URL(request.url());
    if (url.pathname === base && request.method() === "GET") {
      if (url.searchParams.get("view") === "scope") {
        const body = await response.body().catch(() => Buffer.alloc(0));
        let nodes = -1;
        try { nodes = Object.keys(JSON.parse(body.toString("utf8")).state.nodes).length; } catch { /* not a map */ }
        log.scopeViewGets.push({ status: response.status(), bytes: body.length, nodes });
      } else {
        log.wholeGets += 1;
        const body = await response.body().catch(() => Buffer.alloc(0));
        log.wholeBytes = body.length;
      }
    }
    if (url.pathname === base && request.method() === "POST") log.wholePosts += 1;
    if (url.pathname === `${base}/commands` && request.method() === "POST") {
      log.saves.push({ status: response.status(), bytes: (request.postData() || "").length, scopeViewHeader: request.headers()["x-m3e-scope-view"] ?? null });
    }
  });
  return log;
}

/** Long tasks and the time the board became ready, measured inside the page from navigation start. */
async function instrument(page) {
  await page.addInitScript(() => {
    const metrics = { longTaskMs: 0, longTasks: 0, readyAtMs: null };
    Object.assign(window, { __scopeViewMetrics: metrics });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.longTaskMs += entry.duration;
          metrics.longTasks += 1;
        }
      }).observe({ type: "longtask", buffered: true });
    } catch { /* long tasks not supported */ }
    const watch = () => {
      const board = document.getElementById("board");
      if (!board) { requestAnimationFrame(watch); return; }
      const check = () => {
        if (board.dataset.ready === "true" && metrics.readyAtMs === null) metrics.readyAtMs = performance.now();
      };
      new MutationObserver(check).observe(board, { attributes: true, attributeFilter: ["data-ready"] });
      check();
    };
    watch();
  });
}

async function open(page, mapId, { partial, scope = SCOPE }) {
  const query = `localMapId=${encodeURIComponent(mapId)}&cloudMapId=${encodeURIComponent(mapId)}&scope=${encodeURIComponent(scope)}${partial ? "&partial=1" : ""}`;
  await page.goto(`/viewer.html?${query}`);
  await expect(page.locator("#board")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.locator("#meta")).toContainText("nodes:", { timeout: 60_000 });
  await page.locator("#board").focus();
}

async function loadMetrics(page) {
  // Let the first draws finish before reading the long tasks.
  await page.waitForTimeout(2_000);
  const metrics = await page.evaluate(() => /** @type {any} */ (window).__scopeViewMetrics);
  return { timeToInteractiveMs: Math.round(metrics.readyAtMs), longTaskTotalMs: Math.round(metrics.longTaskMs), longTasks: metrics.longTasks };
}

async function expectSelected(page, text) {
  await expect(page.locator("#meta")).toContainText(`selected: ${text}`, { timeout: 5_000 });
}

async function nextSave(log, action) {
  const before = log.saves.length;
  await action();
  await expect.poll(() => log.saves.length, { timeout: 20_000 }).toBeGreaterThan(before);
  expect(log.saves[log.saves.length - 1].status).toBe(200);
}

async function editSelected(page, text) {
  await page.keyboard.press("Enter");
  const editor = page.locator("textarea.inline-node-editor");
  await expect(editor).toBeVisible({ timeout: 3_000 });
  await editor.fill(text);
  await page.keyboard.press("Escape");
  await expectSelected(page, text);
}

async function press(page, key, times) {
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

/** The whole map as the server holds it must equal `expected`, apart from records the viewer derives. */
function expectSameMap(actual, expected) {
  expect(Object.keys(actual.nodes).sort()).toEqual(Object.keys(expected.nodes).sort());
  for (const id of Object.keys(expected.nodes)) {
    const got = actual.nodes[id];
    const want = expected.nodes[id];
    if (got.parentId !== want.parentId || got.text !== want.text || got.nodeType !== want.nodeType
      || JSON.stringify(got.children) !== JSON.stringify(want.children)) {
      expect({ id, ...got }).toEqual({ id, ...want });
    }
  }
}

test("scope view loads only the scope and is faster than the whole map", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const mapId = uniqueMapId("load");
  const full = largeScopedMap();
  await seed(request, mapId, full);

  const measure = async (partial) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const log = watchMapRequests(page, mapId);
    await instrument(page);
    await open(page, mapId, { partial });
    const metrics = await loadMetrics(page);
    const meta = await page.locator("#meta").textContent();
    await context.close();
    return { ...metrics, log, meta };
  };

  // One throwaway load first, so neither side pays for the cold browser and server.
  await measure(false);
  // (a) scope view and (b) the same scope with the whole map loaded, alternating.
  const RUNS = 3;
  const partialRuns = [];
  const wholeRuns = [];
  for (let run = 0; run < RUNS; run += 1) {
    partialRuns.push(await measure(true));
    wholeRuns.push(await measure(false));
  }
  for (const partial of partialRuns) {
    expect(partial.log.wholeGets).toBe(0);
    expect(partial.log.scopeViewGets).toHaveLength(1);
    expect(partial.log.scopeViewGets[0].status).toBe(200);
    expect(partial.log.scopeViewGets[0].nodes).toBeGreaterThan(600);
    expect(partial.log.scopeViewGets[0].nodes).toBeLessThanOrEqual(700);
    // Both draw the same scope.
    expect(partial.meta).toContain("selected: Opened scope");
  }
  for (const whole of wholeRuns) {
    expect(whole.log.scopeViewGets).toHaveLength(0);
    expect(whole.log.wholeGets).toBeGreaterThanOrEqual(1);
    expect(whole.meta).toContain("selected: Opened scope");
  }

  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = (runs, nodesLoaded, responseBytes) => ({
    nodesLoaded,
    responseBytes,
    timeToInteractiveMs: runs.map((run) => run.timeToInteractiveMs),
    timeToInteractiveMedianMs: median(runs.map((run) => run.timeToInteractiveMs)),
    longTaskTotalMs: runs.map((run) => run.longTaskTotalMs),
    longTaskTotalMedianMs: median(runs.map((run) => run.longTaskTotalMs)),
  });
  // The server's share: the time one GET takes without a browser.
  const getMs = async (url) => {
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
      const begun = Date.now();
      await (await request.get(url)).body();
      samples.push(Date.now() - begun);
    }
    return median(samples);
  };
  const mapUrl = `/api/maps/${encodeURIComponent(mapId)}`;
  const metrics = {
    storage: STORAGE,
    mapNodes: Object.keys(full.nodes).length,
    mapJsonBytes: JSON.stringify(full).length,
    serverGetMedianMs: { partial: await getMs(`${mapUrl}?scope=${SCOPE}&view=scope`), whole: await getMs(mapUrl) },
    partial: summary(partialRuns, partialRuns[0].log.scopeViewGets[0].nodes, partialRuns[0].log.scopeViewGets[0].bytes),
    whole: summary(wholeRuns, Object.keys(full.nodes).length, wholeRuns[0].log.wholeBytes),
  };
  fs.mkdirSync(path.dirname(METRICS_FILE), { recursive: true });
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  console.log(`scope partial load metrics: ${JSON.stringify(metrics)}`);

  expect(metrics.partial.responseBytes).toBeLessThan(metrics.whole.responseBytes / 10);
  expect(metrics.partial.timeToInteractiveMedianMs).toBeLessThan(metrics.whole.timeToInteractiveMedianMs);
  expect(metrics.partial.longTaskTotalMedianMs).toBeLessThan(metrics.whole.longTaskTotalMedianMs);
});

test("edits in scope view reach the whole map and nothing is lost", async ({ page, request }) => {
  test.setTimeout(240_000);
  const mapId = uniqueMapId("edit");
  const expected = largeScopedMap();
  await seed(request, mapId, expected);
  const total = Object.keys(expected.nodes).length;
  const log = watchMapRequests(page, mapId);
  await open(page, mapId, { partial: true });
  await expectSelected(page, "Opened scope");
  await expect(page.locator("#scope-view-badge")).toContainText(`of ${total} nodes loaded`);

  // (c) edit a node's text
  await page.keyboard.press("ArrowRight");
  await expectSelected(page, "Own group 0");
  await nextSave(log, () => editSelected(page, "Own group 0 edited"));
  expected.nodes.s_g0.text = "Own group 0 edited";
  let state = await stored(request, mapId);
  expect(state.nodes.s_g0.text).toBe("Own group 0 edited");
  expect(Object.keys(state.nodes)).toHaveLength(total);
  expectSameMap(state, expected);

  // (d1) add a child
  await nextSave(log, async () => {
    await page.keyboard.press("Tab");
    const editor = page.locator("textarea.inline-node-editor");
    await expect(editor).toBeVisible({ timeout: 3_000 });
    await editor.fill("Added in scope view");
    await page.keyboard.press("Escape");
    await expectSelected(page, "Added in scope view");
  });
  state = await stored(request, mapId);
  const addedId = state.nodes.s_g0.children[state.nodes.s_g0.children.length - 1];
  expect(expected.nodes[addedId]).toBeUndefined();
  expected.nodes[addedId] = { ...state.nodes[addedId] };
  expect(expected.nodes[addedId].text).toBe("Added in scope view");
  expected.nodes.s_g0.children.push(addedId);
  expectSameMap(state, expected);

  // (d2) delete a leaf: the added node
  await nextSave(log, async () => {
    await page.keyboard.press("Delete");
    await expectSelected(page, "Own group 0 edited");
  });
  delete expected.nodes[addedId];
  expected.nodes.s_g0.children.pop();
  expectSameMap(await stored(request, mapId), expected);

  // (d3) reorder siblings: Grab moves "Own group 0" below "Own group 1"
  const board = page.locator("#board");
  await nextSave(log, async () => {
    await page.keyboard.down("m");
    await expect(board).toHaveAttribute("data-keyboard-mode", "grab");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.up("m");
    await expect(board).toHaveAttribute("data-keyboard-mode", "navigate");
  });
  expected.nodes.S.children.splice(0, 2, "s_g1", "s_g0");
  expectSameMap(await stored(request, mapId), expected);

  // (d4) move a node onto an entry (a nested scope whose contents are not loaded)
  await page.keyboard.press("ArrowDown");
  await expectSelected(page, "Own group 2");
  await page.keyboard.press("ControlOrMeta+m");
  await press(page, "ArrowDown", 23);
  await expectSelected(page, "Nested scope 0");
  const realChildren = expected.nodes.s_e0.children.length;
  expect(realChildren).toBeGreaterThan(100);
  await nextSave(log, () => page.keyboard.press("p"));
  expected.nodes.S.children = expected.nodes.S.children.filter((id) => id !== "s_g2");
  expected.nodes.s_g2.parentId = "s_e0";
  expected.nodes.s_e0.children.push("s_g2");
  state = await stored(request, mapId);
  expect(state.nodes.s_e0.children).toHaveLength(realChildren + 1);
  expect(state.nodes.s_e0.children[realChildren]).toBe("s_g2");
  expectSameMap(state, expected);

  // Deleting an entry is refused before anything is sent.
  await expectSelected(page, "Nested scope 0");
  const savesBeforeDelete = log.saves.length;
  await page.keyboard.press("Delete");
  await expect(page.locator("#status")).toContainText("Cannot delete in scope view");
  await page.waitForTimeout(1_500);
  expect(log.saves.length).toBe(savesBeforeDelete);
  expectSameMap(await stored(request, mapId), expected);

  // (e) the whole map was never fetched or posted, and every save named the scope.
  expect(log.wholeGets).toBe(0);
  expect(log.wholePosts).toBe(0);
  expect(log.saves.length).toBeGreaterThanOrEqual(5);
  for (const save of log.saves) {
    expect(save.scopeViewHeader).toBe(SCOPE);
    expect(save.bytes).toBeLessThan(20_000);
  }
  expect(Object.keys((await stored(request, mapId)).nodes)).toHaveLength(total);

  // A reload shows the edits (the moved node is now inside the entry, so it is not loaded).
  await page.reload();
  await expect(page.locator("#board")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.locator('text.label-node[data-node-id="s_g0"]').first()).toContainText("Own group 0 edited");
  expect(log.wholeGets).toBe(0);
});

test("a forced whole-map save is blocked in scope view", async ({ page, request }) => {
  test.setTimeout(240_000);
  const mapId = uniqueMapId("force");
  const expected = largeScopedMap();
  await seed(request, mapId, expected);
  // Keep the page from following the server, so its edit collides with the one below.
  await page.route(`**/api/maps/${encodeURIComponent(mapId)}/watch`, (route) => route.abort());
  const log = watchMapRequests(page, mapId);
  await open(page, mapId, { partial: true });
  await page.keyboard.press("ArrowRight");
  await expectSelected(page, "Own group 0");

  // Another writer renames the same node.
  const other = await request.post(`/api/maps/${encodeURIComponent(mapId)}/commands`, {
    data: {
      commandId: `cmd_other_${Date.now()}`,
      actor: { kind: "system", id: "scope-view-test" },
      intent: "assert",
      changes: [{ kind: "node", key: ["s_g0"], op: "update", before: { text: "Own group 0" }, after: { text: "Renamed by another writer" } }],
    },
  });
  expect(other.status()).toBe(200);
  expected.nodes.s_g0.text = "Renamed by another writer";

  // The viewer's own rename now conflicts.
  await editSelected(page, "Renamed in the viewer");
  await expect.poll(() => log.saves.length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(log.saves[log.saves.length - 1].status).toBe(409);
  await expect(page.locator("#conflict-panel")).toBeVisible();

  // (f) "Use Local" (the forced whole-map save) is disabled, and stays inert when forced.
  const useLocal = page.locator("#conflict-use-local");
  await expect(useLocal).toBeDisabled();
  await page.evaluate(() => {
    const button = /** @type {HTMLButtonElement} */ (document.getElementById("conflict-use-local"));
    button.disabled = false;
    button.click();
  });
  await page.waitForTimeout(1_500);
  expect(log.wholePosts).toBe(0);
  expectSameMap(await stored(request, mapId), expected);

  // The same request sent by hand, as a viewer in scope view would send it, is refused by the server.
  const view = await (await request.get(`/api/maps/${encodeURIComponent(mapId)}?scope=${SCOPE}&view=scope`)).json();
  for (const url of [`/api/maps/${encodeURIComponent(mapId)}`, `/api/maps/${encodeURIComponent(mapId)}?scope=${SCOPE}`]) {
    const forced = await request.post(url, {
      headers: { "X-M3E-Scope-View": SCOPE },
      data: { version: 1, savedAt: new Date().toISOString(), state: view.state, force: true },
    });
    expect(forced.status()).toBe(409);
    expect((await forced.json()).code).toBe("SCOPE_VIEW_WHOLE_SAVE");
  }
  const after = await stored(request, mapId);
  expect(Object.keys(after.nodes)).toHaveLength(Object.keys(expected.nodes).length);
  expectSameMap(after, expected);

  // Taking the server's version reloads the scope view, not the whole map.
  await page.locator("#conflict-use-remote").click();
  await expect(page.locator('text.label-node[data-node-id="s_g0"]').first()).toContainText("Renamed by another writer", { timeout: 15_000 });
  expect(log.wholeGets).toBe(0);
  expect(log.wholePosts).toBe(0);
});

test("entries open in the same page and an external change reloads the scope view", async ({ page, request }) => {
  test.setTimeout(240_000);
  const mapId = uniqueMapId("nav");
  const full = largeScopedMap();
  await seed(request, mapId, full);
  const log = watchMapRequests(page, mapId);
  await open(page, mapId, { partial: true });

  // An external change to a loaded node arrives through the watch stream and refetches the scope view.
  const other = await request.post(`/api/maps/${encodeURIComponent(mapId)}/commands`, {
    data: {
      commandId: `cmd_other_${Date.now()}`,
      actor: { kind: "system", id: "scope-view-test" },
      intent: "assert",
      changes: [{ kind: "node", key: ["s_g1"], op: "update", before: { text: "Own group 1" }, after: { text: "Changed elsewhere" } }],
    },
  });
  expect(other.status()).toBe(200);
  await expect(page.locator('text.label-node[data-node-id="s_g1"]').first()).toContainText("Changed elsewhere", { timeout: 15_000 });
  expect(log.scopeViewGets.length).toBeGreaterThanOrEqual(2);
  expect(log.wholeGets).toBe(0);

  // Entering an entry moves to that scope, still as a scope view, without loading the page again.
  await page.evaluate(() => { window.__samePage = true; });
  await page.keyboard.press("ArrowRight");
  await expectSelected(page, "Own group 0");
  await press(page, "ArrowDown", 25);
  await expectSelected(page, "Nested scope 0");
  await page.keyboard.press("]");
  await page.waitForURL((url) => url.searchParams.get("scope") === "s_e0" && url.searchParams.get("partial") === "1", { timeout: 30_000 });
  await expect(page.locator("#board")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expectSelected(page, "Nested scope 0");
  await expect(page.locator("#scope-view-badge")).toContainText(`${full.nodes.s_e0.children.length + 4} of ${Object.keys(full.nodes).length} nodes loaded`);

  // Leaving goes to the nearest ancestor scope, still as a scope view.
  await page.locator("#board").focus();
  await page.keyboard.press("[");
  await page.waitForURL((url) => url.searchParams.get("scope") === SCOPE && url.searchParams.get("partial") === "1", { timeout: 30_000 });
  await expect(page.locator("#board")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  // The entry the user came out of stays selected.
  await expectSelected(page, "Nested scope 0");
  expect(await page.evaluate(() => window.__samePage === true)).toBe(true);
  expect(log.wholeGets).toBe(0);
  expect(log.wholePosts).toBe(0);
});
