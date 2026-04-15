import { test, expect, beforeAll, afterAll } from "vitest";
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

if (process.env.M3E_COLLAB !== "1") {
  test("collab_push: skipped (M3E_COLLAB not set)", () => {
    expect(true).toBe(true);
  });
} else {

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-collab-push-"));
const sqlitePath = path.join(tmpDir, "rapid-mvp.sqlite");
process.env.M3E_DATA_DIR = tmpDir;

const collab = require("../../dist/node/collab.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");
const { createAppServer } = require("../../dist/node/start_viewer.js");

let server;
let baseUrl;

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function seedDoc(mapId) {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;

  const folderId = "folder_a";
  const child1Id = "child_1";
  const child2Id = "child_2";
  const outsideId = "outside_node";

  model.state.nodes[folderId] = {
    id: folderId, parentId: rootId, children: [child1Id, child2Id], nodeType: "folder",
    text: "Folder A", collapsed: false, details: "", note: "", attributes: {}, link: "",
  };
  model.state.nodes[child1Id] = {
    id: child1Id, parentId: folderId, children: [], nodeType: "text",
    text: "Child 1", collapsed: false, details: "", note: "", attributes: {}, link: "",
  };
  model.state.nodes[child2Id] = {
    id: child2Id, parentId: folderId, children: [], nodeType: "text",
    text: "Child 2", collapsed: false, details: "", note: "", attributes: {}, link: "",
  };
  model.state.nodes[outsideId] = {
    id: outsideId, parentId: rootId, children: [], nodeType: "text",
    text: "Outside Node", collapsed: false, details: "", note: "", attributes: {}, link: "",
  };
  model.state.nodes[rootId].children = [folderId, outsideId];

  model.saveToSqlite(sqlitePath, mapId);
  collab.setDocVersion(1);
  return { rootId, folderId, child1Id, child2Id, outsideId };
}

beforeAll(() => {
  return new Promise((resolve) => {
    collab.resetCollab();
    server = createAppServer();
    server.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise((resolve) => {
    server.close(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      resolve();
    });
  });
});

test("push a new node into a scope succeeds and version increments", async () => {
  collab.resetCollab();
  const mapId = "push-test-1";
  const ids = seedDoc(mapId);

  // Register via API
  const reg = await request("POST", "/api/collab/register", { displayName: "human1", role: "human", capabilities: ["read", "write"] });
  const token = reg.json.token;
  const auth = { Authorization: `Bearer ${token}` };

  // Acquire lock
  const lockRes = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth);
  expect(lockRes.json.ok).toBe(true);

  const newNodeId = "new_child_3";
  const res = await request("POST", `/api/collab/push/${mapId}`, {
    scopeId: ids.folderId,
    lockId: lockRes.json.lockId,
    baseVersion: 1,
    changes: { nodes: { [newNodeId]: {
      id: newNodeId, parentId: ids.folderId, children: [], nodeType: "text",
      text: "Child 3", collapsed: false, details: "", note: "", attributes: {}, link: "",
    } } },
  }, auth);

  expect(res.status).toBe(200);
  expect(res.json.ok).toBe(true);
  expect(res.json.version).toBe(2);
  expect(res.json.applied.includes(newNodeId)).toBe(true);
  expect(res.json.rejected.length).toBe(0);
});

test("push to a scope without lock is rejected (403)", async () => {
  collab.resetCollab();
  const mapId = "push-test-2";
  seedDoc(mapId);

  const reg = await request("POST", "/api/collab/register", { displayName: "human2", role: "human", capabilities: ["read", "write"] });
  const auth = { Authorization: `Bearer ${reg.json.token}` };

  const res = await request("POST", `/api/collab/push/${mapId}`, {
    scopeId: "folder_a",
    lockId: "fake_lock_id",
    baseVersion: 1,
    changes: { nodes: { child_1: { id: "child_1", parentId: "folder_a", children: [], nodeType: "text", text: "Updated", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth);

  expect(res.status).toBe(403);
  expect(res.json.ok).toBe(false);
});

test("push node outside scope is rejected", async () => {
  collab.resetCollab();
  const mapId = "push-test-3";
  const ids = seedDoc(mapId);

  const reg = await request("POST", "/api/collab/register", { displayName: "human3", role: "human", capabilities: ["read", "write"] });
  const auth = { Authorization: `Bearer ${reg.json.token}` };
  const lockRes = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth);

  const res = await request("POST", `/api/collab/push/${mapId}`, {
    scopeId: ids.folderId,
    lockId: lockRes.json.lockId,
    baseVersion: 1,
    changes: { nodes: { [ids.outsideId]: { id: ids.outsideId, parentId: ids.rootId, children: [], nodeType: "text", text: "Hacked", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth);

  expect(res.status).toBe(200);
  expect(res.json.rejected.includes(ids.outsideId)).toBe(true);
  expect(res.json.applied.length).toBe(0);
});

test("two entities push non-overlapping nodes - both succeed", async () => {
  collab.resetCollab();
  const mapId = "push-test-4";
  const ids = seedDoc(mapId);

  const reg1 = await request("POST", "/api/collab/register", { displayName: "human4", role: "human", capabilities: ["read", "write"] });
  const auth1 = { Authorization: `Bearer ${reg1.json.token}` };
  const lock1 = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);

  const res1 = await request("POST", `/api/collab/push/${mapId}`, {
    scopeId: ids.folderId, lockId: lock1.json.lockId, baseVersion: 1,
    changes: { nodes: { merge_a: { id: "merge_a", parentId: ids.folderId, children: [], nodeType: "text", text: "A", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth1);
  expect(res1.json.ok).toBe(true);
  expect(res1.json.version).toBe(2);

  // Release lock1
  await request("DELETE", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);

  // Entity 2 locks root and pushes
  const reg2 = await request("POST", "/api/collab/register", { displayName: "ai1", role: "ai", capabilities: ["read", "write"] });
  const auth2 = { Authorization: `Bearer ${reg2.json.token}` };
  const lock2 = await request("POST", `/api/collab/scope/${ids.rootId}/lock`, null, auth2);

  const res2 = await request("POST", `/api/collab/push/${mapId}`, {
    scopeId: ids.rootId, lockId: lock2.json.lockId, baseVersion: 2,
    changes: { nodes: { merge_b: { id: "merge_b", parentId: ids.rootId, children: [], nodeType: "text", text: "B", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth2);
  expect(res2.json.ok).toBe(true);
  expect(res2.json.version).toBe(3);

  // Verify both nodes exist
  const model = RapidMvpModel.loadFromSqlite(sqlitePath, mapId);
  expect(model.state.nodes["merge_a"]).toBeTruthy();
  expect(model.state.nodes["merge_b"]).toBeTruthy();
});

test("push with stale baseVersion still applies when priority allows", async () => {
  collab.resetCollab();
  const mapId = "push-test-5";
  const ids = seedDoc(mapId);

  // Human pushes to bump version
  const reg1 = await request("POST", "/api/collab/register", { displayName: "human5", role: "human", capabilities: ["read", "write"] });
  const auth1 = { Authorization: `Bearer ${reg1.json.token}` };
  const lock1 = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);
  await request("POST", `/api/collab/push/${mapId}`, {
    scopeId: ids.folderId, lockId: lock1.json.lockId, baseVersion: 1,
    changes: { nodes: { [ids.child1Id]: { id: ids.child1Id, parentId: ids.folderId, children: [], nodeType: "text", text: "Human Edit", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth1);
  await request("DELETE", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);

  // AI pushes with stale baseVersion=1
  const reg2 = await request("POST", "/api/collab/register", { displayName: "ai2", role: "ai", capabilities: ["read", "write"] });
  const auth2 = { Authorization: `Bearer ${reg2.json.token}` };
  const lock2 = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth2);

  const res2 = await request("POST", `/api/collab/push/${mapId}`, {
    scopeId: ids.folderId, lockId: lock2.json.lockId, baseVersion: 1,
    changes: { nodes: { [ids.child1Id]: { id: ids.child1Id, parentId: ids.folderId, children: [], nodeType: "text", text: "AI Edit", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth2);

  expect(res2.status).toBe(200);
  expect(res2.json.ok).toBe(true);
});

}
