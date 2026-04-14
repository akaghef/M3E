import { test, expect, beforeAll, afterAll } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let server;
let baseUrl;
let dataDir;
let vaultDir;
let RapidMvpModel;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-vault-watch-"));
}

function writeFile(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

beforeAll(async () => {
  dataDir = tmpDir();
  vaultDir = tmpDir();
  writeFile(vaultDir, "index.md", "# Start\n\nLink to [[notes/alpha]].");
  writeFile(vaultDir, "notes/alpha.md", "# Alpha\n\nOriginal body.");

  process.env.M3E_DATA_DIR = dataDir;
  process.env.M3E_DB_FILE = "watch.sqlite";

  const startViewerPath = require.resolve("../../dist/node/start_viewer.js");
  delete require.cache[startViewerPath];
  const { createAppServer } = require(startViewerPath);
  ({ RapidMvpModel } = require("../../dist/node/rapid_mvp.js"));

  server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  await fetch(`${baseUrl}/api/vault/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      vaultPath: vaultDir,
      documentId: "vault-watch-doc",
      options: { skipAiTransform: true },
    }),
  }).then((response) => response.text());
});

afterAll(async () => {
  delete process.env.M3E_DATA_DIR;
  delete process.env.M3E_DB_FILE;
  if (server) {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
  if (vaultDir) fs.rmSync(vaultDir, { recursive: true, force: true });
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

test("watch start/status/stop lifecycle works", async () => {
  const started = await requestJson(`${baseUrl}/api/vault/watch/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      documentId: "vault-watch-doc",
      vaultPath: vaultDir,
      debounceMs: 300,
      importOptions: { skipAiTransform: true },
      exportOptions: { skipAiTransform: true },
    }),
  });
  expect(started.response.status).toBe(200);
  expect(started.payload.running).toBe(true);

  const status = await requestJson(`${baseUrl}/api/vault/status?documentId=vault-watch-doc`);
  expect(status.response.status).toBe(200);
  expect(status.payload.running).toBe(true);

  const dbPath = path.join(dataDir, "watch.sqlite");
  const model = RapidMvpModel.loadFromSqlite(dbPath, "vault-watch-doc");
  const fileNode = Object.values(model.state.nodes).find((node) => node.attributes["vault:path"] === "notes/alpha.md");
  fileNode.details = "Changed from doc save.";

  const saved = await requestJson(`${baseUrl}/api/docs/vault-watch-doc`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: model.toJSON() }),
  });
  expect(saved.response.status).toBe(200);

  await new Promise((resolve) => setTimeout(resolve, 2500));
  const exported = fs.readFileSync(path.join(vaultDir, "notes", "alpha.md"), "utf8");
  expect(exported).toContain("Changed from doc save.");

  fs.rmSync(path.join(vaultDir, "notes", "alpha.md"));
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const afterDelete = RapidMvpModel.loadFromSqlite(dbPath, "vault-watch-doc");
  const deletedNode = Object.values(afterDelete.state.nodes).find((node) => node.attributes["vault:path"] === "notes/alpha.md");
  expect(deletedNode).toBeTruthy();
  expect(deletedNode.attributes["vault:status"]).toBe("missing");
  const brokenAlias = Object.values(afterDelete.state.nodes).find((node) => node.nodeType === "alias");
  expect(brokenAlias).toBeTruthy();
  expect(brokenAlias.isBroken).toBe(true);

  const stopped = await requestJson(`${baseUrl}/api/vault/watch`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ documentId: "vault-watch-doc" }),
  });
  expect(stopped.response.status).toBe(200);
  expect(stopped.payload.running).toBe(false);
});
