const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

if (process.env.M3E_COLLAB !== "1") {
  test("collab_push: skipped (M3E_COLLAB not set)", () => {
    assert.ok(true, "Set M3E_COLLAB=1 to run collab push tests");
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

function seedDoc(docId) {
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

  model.saveToSqlite(sqlitePath, docId);
  collab.setDocVersion(1);
  return { rootId, folderId, child1Id, child2Id, outsideId };
}

test.before(() => {
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

test.after(() => {
  return new Promise((resolve) => {
    server.close(() => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      resolve();
    });
  });
});

test("push a new node into a scope succeeds and version increments", async () => {
  collab.resetCollab();
  const docId = "push-test-1";
  const ids = seedDoc(docId);

  // Register via API
  const reg = await request("POST", "/api/collab/register", { displayName: "human1", role: "human", capabilities: ["read", "write"] });
  const token = reg.json.token;
  const auth = { Authorization: `Bearer ${token}` };

  // Acquire lock
  const lockRes = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth);
  assert.equal(lockRes.json.ok, true);

  const newNodeId = "new_child_3";
  const res = await request("POST", `/api/collab/push/${docId}`, {
    scopeId: ids.folderId,
    lockId: lockRes.json.lockId,
    baseVersion: 1,
    changes: { nodes: { [newNodeId]: {
      id: newNodeId, parentId: ids.folderId, children: [], nodeType: "text",
      text: "Child 3", collapsed: false, details: "", note: "", attributes: {}, link: "",
    } } },
  }, auth);

  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.version, 2);
  assert.ok(res.json.applied.includes(newNodeId));
  assert.equal(res.json.rejected.length, 0);
});

test("push to a scope without lock is rejected (403)", async () => {
  collab.resetCollab();
  const docId = "push-test-2";
  seedDoc(docId);

  const reg = await request("POST", "/api/collab/register", { displayName: "human2", role: "human", capabilities: ["read", "write"] });
  const auth = { Authorization: `Bearer ${reg.json.token}` };

  const res = await request("POST", `/api/collab/push/${docId}`, {
    scopeId: "folder_a",
    lockId: "fake_lock_id",
    baseVersion: 1,
    changes: { nodes: { child_1: { id: "child_1", parentId: "folder_a", children: [], nodeType: "text", text: "Updated", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth);

  assert.equal(res.status, 403);
  assert.equal(res.json.ok, false);
});

test("push node outside scope is rejected", async () => {
  collab.resetCollab();
  const docId = "push-test-3";
  const ids = seedDoc(docId);

  const reg = await request("POST", "/api/collab/register", { displayName: "human3", role: "human", capabilities: ["read", "write"] });
  const auth = { Authorization: `Bearer ${reg.json.token}` };
  const lockRes = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth);

  const res = await request("POST", `/api/collab/push/${docId}`, {
    scopeId: ids.folderId,
    lockId: lockRes.json.lockId,
    baseVersion: 1,
    changes: { nodes: { [ids.outsideId]: { id: ids.outsideId, parentId: ids.rootId, children: [], nodeType: "text", text: "Hacked", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth);

  assert.equal(res.status, 200);
  assert.ok(res.json.rejected.includes(ids.outsideId));
  assert.equal(res.json.applied.length, 0);
});

test("two entities push non-overlapping nodes - both succeed", async () => {
  collab.resetCollab();
  const docId = "push-test-4";
  const ids = seedDoc(docId);

  const reg1 = await request("POST", "/api/collab/register", { displayName: "human4", role: "human", capabilities: ["read", "write"] });
  const auth1 = { Authorization: `Bearer ${reg1.json.token}` };
  const lock1 = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);

  const res1 = await request("POST", `/api/collab/push/${docId}`, {
    scopeId: ids.folderId, lockId: lock1.json.lockId, baseVersion: 1,
    changes: { nodes: { merge_a: { id: "merge_a", parentId: ids.folderId, children: [], nodeType: "text", text: "A", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth1);
  assert.equal(res1.json.ok, true);
  assert.equal(res1.json.version, 2);

  // Release lock1
  await request("DELETE", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);

  // Entity 2 locks root and pushes
  const reg2 = await request("POST", "/api/collab/register", { displayName: "ai1", role: "ai", capabilities: ["read", "write"] });
  const auth2 = { Authorization: `Bearer ${reg2.json.token}` };
  const lock2 = await request("POST", `/api/collab/scope/${ids.rootId}/lock`, null, auth2);

  const res2 = await request("POST", `/api/collab/push/${docId}`, {
    scopeId: ids.rootId, lockId: lock2.json.lockId, baseVersion: 2,
    changes: { nodes: { merge_b: { id: "merge_b", parentId: ids.rootId, children: [], nodeType: "text", text: "B", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth2);
  assert.equal(res2.json.ok, true);
  assert.equal(res2.json.version, 3);

  // Verify both nodes exist
  const model = RapidMvpModel.loadFromSqlite(sqlitePath, docId);
  assert.ok(model.state.nodes["merge_a"]);
  assert.ok(model.state.nodes["merge_b"]);
});

test("push with stale baseVersion still applies when priority allows", async () => {
  collab.resetCollab();
  const docId = "push-test-5";
  const ids = seedDoc(docId);

  // Human pushes to bump version
  const reg1 = await request("POST", "/api/collab/register", { displayName: "human5", role: "human", capabilities: ["read", "write"] });
  const auth1 = { Authorization: `Bearer ${reg1.json.token}` };
  const lock1 = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);
  await request("POST", `/api/collab/push/${docId}`, {
    scopeId: ids.folderId, lockId: lock1.json.lockId, baseVersion: 1,
    changes: { nodes: { [ids.child1Id]: { id: ids.child1Id, parentId: ids.folderId, children: [], nodeType: "text", text: "Human Edit", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth1);
  await request("DELETE", `/api/collab/scope/${ids.folderId}/lock`, null, auth1);

  // AI pushes with stale baseVersion=1
  const reg2 = await request("POST", "/api/collab/register", { displayName: "ai2", role: "ai", capabilities: ["read", "write"] });
  const auth2 = { Authorization: `Bearer ${reg2.json.token}` };
  const lock2 = await request("POST", `/api/collab/scope/${ids.folderId}/lock`, null, auth2);

  const res2 = await request("POST", `/api/collab/push/${docId}`, {
    scopeId: ids.folderId, lockId: lock2.json.lockId, baseVersion: 1,
    changes: { nodes: { [ids.child1Id]: { id: ids.child1Id, parentId: ids.folderId, children: [], nodeType: "text", text: "AI Edit", collapsed: false, details: "", note: "", attributes: {}, link: "" } } },
  }, auth2);

  assert.equal(res2.status, 200);
  assert.equal(res2.json.ok, true);
});

}
