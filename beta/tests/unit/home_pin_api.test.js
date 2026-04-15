import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-home-pin-api-"));
process.env.M3E_DATA_DIR = tempDataDir;

const { createAppServer } = require("../../dist/node/start_viewer.js");

let server;
let baseUrl;

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
  const { response, payload } = await request(`${baseUrl}/api/maps/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(label ? { label } : {}),
  });
  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);
  return payload.id;
}

async function listDocs(includeArchived = false) {
  const qs = includeArchived ? "?includeArchived=true" : "";
  const { payload } = await request(`${baseUrl}/api/maps${qs}`);
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
});

test("PATCH /api/maps/:id/pin with pinned=true marks the doc pinned", async () => {
  const id = await createBlankDoc("pin-a");
  const res = await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: true }),
  });
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);
  expect(res.payload.pinned).toBe(true);

  const docs = await listDocs();
  const doc = docs.find((d) => d.id === id);
  expect(doc).toBeTruthy();
  expect(doc.pinned).toBe(true);
});

test("PATCH /api/maps/:id/pin with pinned=false un-pins", async () => {
  const id = await createBlankDoc("pin-b");
  await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: true }),
  });
  const res = await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: false }),
  });
  expect(res.response.status).toBe(200);
  expect(res.payload.pinned).toBe(false);

  const docs = await listDocs();
  const doc = docs.find((d) => d.id === id);
  expect(doc.pinned).toBe(false);
});

test("POST /api/maps/:id/pin also works", async () => {
  const id = await createBlankDoc("pin-post");
  const res = await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: true }),
  });
  expect(res.response.status).toBe(200);
  expect(res.payload.pinned).toBe(true);
});

test("pin on nonexistent doc returns 404 MAP_NOT_FOUND", async () => {
  const res = await request(`${baseUrl}/api/maps/does-not-exist/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: true }),
  });
  expect(res.response.status).toBe(404);
  expect(res.payload.ok).toBe(false);
  expect(res.payload.error.code).toBe("MAP_NOT_FOUND");
});

test("pin with non-boolean body returns 400 INVALID_BODY", async () => {
  const id = await createBlankDoc("pin-bad-body");
  const res = await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: "yes" }),
  });
  expect(res.response.status).toBe(400);
  expect(res.payload.ok).toBe(false);
  expect(res.payload.error.code).toBe("INVALID_BODY");
});

test("pin with invalid JSON body returns 400 INVALID_BODY", async () => {
  const id = await createBlankDoc("pin-bad-json");
  const res = await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  expect(res.response.status).toBe(400);
  expect(res.payload.error.code).toBe("INVALID_BODY");
});

test("pin with missing pinned field returns 400", async () => {
  const id = await createBlankDoc("pin-missing");
  const res = await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.response.status).toBe(400);
  expect(res.payload.error.code).toBe("INVALID_BODY");
});

test("pin state survives across multiple list calls", async () => {
  const id = await createBlankDoc("pin-idem");
  await request(`${baseUrl}/api/maps/${id}/pin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned: true }),
  });
  const list1 = await listDocs();
  const list2 = await listDocs();
  const d1 = list1.find((d) => d.id === id);
  const d2 = list2.find((d) => d.id === id);
  expect(d1.pinned).toBe(true);
  expect(d2.pinned).toBe(true);
});
