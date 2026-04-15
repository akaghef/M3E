import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-home-vault-api-"));
process.env.M3E_DATA_DIR = tempDataDir;

const { createAppServer } = require("../../dist/node/start_viewer.js");

let server;
let baseUrl;
const tmpDirs = [];

function mkTmpDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

async function request(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { _raw: text };
    }
  }
  return { response, payload };
}

async function createBlankDoc(label) {
  const { payload } = await request(`${baseUrl}/api/maps/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(label ? { label } : {}),
  });
  return payload.id;
}

async function listDocs() {
  const { payload } = await request(`${baseUrl}/api/maps?includeArchived=true`);
  return payload.docs;
}

beforeAll(async () => {
  server = createAppServer();
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  fs.rmSync(tempDataDir, { recursive: true, force: true });
  for (const d of tmpDirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
    }
  }
});

test("bind-vault with a valid directory sets source", async () => {
  const vaultDir = mkTmpDir("m3e-vault-ok-");
  const id = await createBlankDoc("bv-1");
  const res = await request(`${baseUrl}/api/maps/${id}/bind-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultPath: vaultDir }),
  });
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);

  const docs = await listDocs();
  const doc = docs.find((d) => d.id === id);
  expect(doc.source).toEqual({ kind: "obsidian", path: vaultDir });
});

test("bind-vault with empty vaultPath returns 400", async () => {
  const id = await createBlankDoc("bv-2");
  const res = await request(`${baseUrl}/api/maps/${id}/bind-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultPath: "   " }),
  });
  expect(res.response.status).toBe(400);
  expect(res.payload.error.code).toBe("INVALID_BODY");
});

test("bind-vault on nonexistent doc returns 404", async () => {
  const vaultDir = mkTmpDir("m3e-vault-404-");
  const res = await request(`${baseUrl}/api/maps/ghost/bind-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultPath: vaultDir }),
  });
  expect(res.response.status).toBe(404);
  expect(res.payload.error.code).toBe("MAP_NOT_FOUND");
});

test("bind-vault currently accepts a nonexistent path", async () => {
  const id = await createBlankDoc("bv-nopath");
  const res = await request(`${baseUrl}/api/maps/${id}/bind-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultPath: "/definitely/not/there/xyz123" }),
  });
  expect(res.response.status).toBe(200);
});

test("unbind-vault clears source", async () => {
  const vaultDir = mkTmpDir("m3e-vault-unbind-");
  const id = await createBlankDoc("ub-1");
  await request(`${baseUrl}/api/maps/${id}/bind-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultPath: vaultDir }),
  });
  const res = await request(`${baseUrl}/api/maps/${id}/unbind-vault`, {
    method: "POST",
  });
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);

  const docs = await listDocs();
  const doc = docs.find((d) => d.id === id);
  expect(doc.source).toBeUndefined();
});

test("import-file with .md creates a new doc", async () => {
  const beforeDocs = await listDocs();
  const beforeIds = new Set(beforeDocs.map((d) => d.id));

  const res = await request(`${baseUrl}/api/maps/import-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "notes.md",
      content: "# My Notes\n\nSome body text.",
    }),
  });
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);
  expect(beforeIds.has(res.payload.id)).toBe(false);

  const after = await listDocs();
  const fresh = after.find((d) => d.id === res.payload.id);
  expect(fresh).toBeTruthy();
});

test("import-file with invalid JSON content returns 400", async () => {
  const res = await request(`${baseUrl}/api/maps/import-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "bad.json", content: "{not a json" }),
  });
  expect(res.response.status).toBe(400);
  expect(res.payload.error.code).toBe("INVALID_BODY");
});

test("import-vault with a directory containing .md files imports + sets source", async () => {
  const vault = mkTmpDir("m3e-import-vault-ok-");
  fs.writeFileSync(path.join(vault, "a.md"), "# A\n\nalpha body");
  fs.writeFileSync(path.join(vault, "b.markdown"), "# B\n\nbravo body");
  fs.writeFileSync(path.join(vault, "ignore.txt"), "not md");

  const res = await request(`${baseUrl}/api/maps/import-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultPath: vault }),
  });
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);

  const docs = await listDocs();
  const fresh = docs.find((d) => d.id === res.payload.id);
  expect(fresh).toBeTruthy();
  expect(fresh.source).toEqual({ kind: "obsidian", path: vault });
  expect(fresh.nodeCount).toBe(3);
});

test("import-vault with nonexistent path returns 400", async () => {
  const res = await request(`${baseUrl}/api/maps/import-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultPath: "/nope/nonexistent/xyz-123" }),
  });
  expect(res.response.status).toBe(400);
  expect(res.payload.error.code).toBe("INVALID_BODY");
});
