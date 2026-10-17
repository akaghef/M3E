const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let RapidMvpModel;
const previousDataDir = process.env.M3E_DATA_DIR;
const previousDbFile = process.env.M3E_DB_FILE;

test.beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-link-attributes-browser-"));
  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "attributes.sqlite";
  const { createAppServer } = require("../../dist/node/start_viewer.js");
  ({ RapidMvpModel } = require("../../dist/node/rapid_mvp.js"));
  server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (previousDataDir === undefined) delete process.env.M3E_DATA_DIR;
  else process.env.M3E_DATA_DIR = previousDataDir;
  if (previousDbFile === undefined) delete process.env.M3E_DB_FILE;
  else process.env.M3E_DB_FILE = previousDbFile;
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

async function openMap(page) {
  const model = new RapidMvpModel("Attributes diagram");
  const source = model.addNode(model.state.rootId, "Source");
  const target = model.addNode(model.state.rootId, "Target");
  const unrelated = model.addNode(model.state.rootId, "Unrelated node");
  const mapId = `attributes-${crypto.randomUUID()}`;
  const mapUrl = `${baseUrl}/api/maps/${mapId}`;
  const created = await page.request.post(mapUrl, { data: { state: model.toJSON() } });
  expect(created.status()).toBe(200);
  const linked = await page.request.post(`${mapUrl}/links`, {
    data: { sourceNodeId: source, targetNodeId: target, attributes: { confidence: "declared" }, style: "dashed" },
  });
  expect(linked.status()).toBe(200);
  const { link } = await linked.json();
  await page.goto(`${baseUrl}/viewer.html?map=${encodeURIComponent(mapId)}&renderer=svg`);
  await expect(page.locator("#board")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(`.node-hit[data-node-id="${unrelated}"]`)).toBeVisible();
  return { mapUrl, linkId: link.id, unrelated };
}

async function exportJson(page) {
  // Workbench intentionally hides the legacy toolbar. Exercise its public
  // Surface PN action with normal pointer input, preserving actionability checks.
  const navigation = page.getByTestId("progressive-navigation");
  await page.getByRole("button", { name: "Surface PN root", exact: true }).click();
  await expect(navigation).toHaveClass(/\bis-open\b/);
  await page.locator('[data-pn-node="board"]').hover();
  await expect(navigation).toHaveAttribute("data-active-pn-node", "board");
  const exportAction = page.locator('[data-pn-node="export-json"]');
  await expect(exportAction).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await exportAction.click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function importJson(page, payload) {
  const rootId = payload.state.rootId;
  const otherId = Object.keys(payload.state.nodes).find((id) => id !== rootId);
  await page.locator(`.node-hit[data-node-id="${otherId}"]`).click();
  await expect(page.locator(`.node-hit[data-node-id="${otherId}"]`)).toHaveClass(/\bselected\b/);
  await page.setInputFiles("#file-input", {
    name: "attributes.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload)),
  });
  // Import resets selection to the root, so repeated imports cannot pass early
  // just because the preceding import left the same status text behind.
  await expect(page.locator(`.node-hit[data-node-id="${rootId}"]`)).toHaveClass(/\bselected\b/);
  await expect(page.locator("#status")).toHaveText("Loaded.");
}

test("viewer keeps API-created attributes after unrelated node edit, save and reload", async ({ page }) => {
  const { mapUrl, linkId, unrelated } = await openMap(page);
  await page.locator(`.node-hit[data-node-id="${unrelated}"]`).click();
  await page.keyboard.press("F2");
  await page.locator("textarea.inline-node-editor").fill("Unrelated node edited");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await (await page.request.get(mapUrl)).json()).state.nodes[unrelated].text)
    .toBe("Unrelated node edited");
  const persisted = await (await page.request.get(mapUrl)).json();
  expect(persisted.state.links[linkId].attributes).toEqual({ confidence: "declared" });
  await page.reload();
  await expect(page.locator("#board")).toHaveAttribute("data-ready", "true");
  const exported = await exportJson(page);
  expect(exported.state.links[linkId].attributes).toEqual({ confidence: "declared" });
  expect(exported.state.links[linkId].style).toBe("dashed");
});

test("JSON export, import and export preserve GraphLink attributes", async ({ page }) => {
  const { linkId } = await openMap(page);
  const exported = await exportJson(page);
  expect(exported.state.links[linkId].attributes).toEqual({ confidence: "declared" });
  await importJson(page, exported);
  expect((await exportJson(page)).state.links[linkId].attributes).toEqual({ confidence: "declared" });
});

test("viewer JSON read retains only string attribute values", async ({ page }) => {
  const { mapUrl, linkId } = await openMap(page);
  const payload = await (await page.request.get(mapUrl)).json();
  payload.state.links[linkId].attributes = { confidence: "declared", count: 4, nested: {}, empty: "" };
  await importJson(page, payload);
  expect((await exportJson(page)).state.links[linkId].attributes).toEqual({ confidence: "declared", empty: "" });
  for (const value of [null, [], "invalid"]) {
    payload.state.links[linkId].attributes = value;
    await importJson(page, payload);
    expect((await exportJson(page)).state.links[linkId]).not.toHaveProperty("attributes");
  }
});
