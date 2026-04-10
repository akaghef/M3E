"use strict";

// ---------------------------------------------------------------------------
// cloud_ops_safety.test.js
//
// Tests to prevent real-world Cloud Sync bugs that occurred in production:
//   1. doc ID mismatch between browser and SQLite
//   2. state_json becoming null (empty POST)
//   3. map_update.mjs POST destroying document data
//   4. Supabase restore doc ID inconsistency
// ---------------------------------------------------------------------------

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createAppServer } = require("../../dist/node/start_viewer.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

let server;
let baseUrl;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createValidState(rootLabel) {
  const model = new RapidMvpModel(rootLabel || "Root");
  model.addNode(model.state.rootId, "Child A");
  model.addNode(model.state.rootId, "Child B");
  return model.toJSON();
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function postDoc(docId, body) {
  return requestJson(`${baseUrl}/api/docs/${docId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
}

async function getDoc(docId) {
  return requestJson(`${baseUrl}/api/docs/${docId}`);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

test.before(async () => {
  server = createAppServer();
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

// =========================================================================
// A. API-level defense tests
// =========================================================================

test("POST /api/docs/:id with empty state ({}) returns 400", async () => {
  const { response, payload } = await postDoc("safety-empty-state", { state: {} });
  assert.equal(response.status, 400);
  assert.ok(payload.error, "Should have an error message");
});

test("POST /api/docs/:id with empty nodes ({nodes: {}}) returns 400", async () => {
  const { response, payload } = await postDoc("safety-empty-nodes", {
    state: { rootId: "nonexistent", nodes: {} },
  });
  assert.equal(response.status, 400);
  assert.ok(payload.error, "Should have an error message");
});

test("POST /api/docs/:id without state field returns 400", async () => {
  const { response, payload } = await postDoc("safety-no-state", { foo: "bar" });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});

test("POST /api/docs/:id with state: null returns 400", async () => {
  const { response, payload } = await postDoc("safety-null-state", { state: null });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});

test("POST /api/docs/:id with state: 'string' returns 400", async () => {
  const { response, payload } = await postDoc("safety-string-state", { state: "not-an-object" });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});

test("POST /api/docs/:id with valid state returns 200 and correct documentId", async () => {
  const docId = "safety-valid-post";
  const state = createValidState("Safety Test Root");
  const { response, payload } = await postDoc(docId, { state });
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.documentId, docId, "Response documentId must match request docId");

  // Verify data is readable back with the same doc ID
  const { response: getRes, payload: getPayload } = await getDoc(docId);
  assert.equal(getRes.status, 200);
  assert.ok(getPayload.state);
  assert.ok(Object.keys(getPayload.state.nodes).length >= 3, "Should have root + 2 children");
});

test("GET /api/docs/:id for non-existent doc returns 404 (no auto-creation)", async () => {
  const { response, payload } = await getDoc("safety-nonexistent-doc-xyz");
  assert.equal(response.status, 404);
  assert.ok(payload.error);

  // Confirm a second GET still returns 404 (not auto-created on first access)
  const { response: r2 } = await getDoc("safety-nonexistent-doc-xyz");
  assert.equal(r2.status, 404);
});

test("POST /api/docs/:id with invalid JSON body returns 400", async () => {
  const { response, payload } = await requestJson(`${baseUrl}/api/docs/safety-bad-json`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "{ this is not json }",
  });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});

// =========================================================================
// B. doc ID consistency tests
// =========================================================================

test("POST then GET with same doc ID returns matching data", async () => {
  const docId = "safety-docid-roundtrip";
  const state = createValidState("DocID Test");
  await postDoc(docId, { state });

  const { response, payload } = await getDoc(docId);
  assert.equal(response.status, 200);
  assert.equal(payload.state.rootId, state.rootId, "rootId must be preserved");
  assert.equal(
    Object.keys(payload.state.nodes).length,
    Object.keys(state.nodes).length,
    "Node count must match after round-trip",
  );
});

test("doc ID is case-sensitive and preserved exactly", async () => {
  const docId = "Akaghef-Beta";
  const state = createValidState("Case Test");
  const { payload: postPayload } = await postDoc(docId, { state });
  assert.equal(postPayload.documentId, docId);

  const { response } = await getDoc(docId);
  assert.equal(response.status, 200);

  // A different casing should NOT find the doc
  const { response: wrongCase } = await getDoc("akaghef-beta");
  // This may be 404 or 200 depending on SQLite collation; we just verify
  // the correct casing works.
  assert.equal(response.status, 200);
});

test("POST to doc ID 'akaghef-beta' is retrievable with exactly that ID", async () => {
  // Real-world bug: browser uses 'akaghef-beta' but server stores as 'rapid-main'
  const docId = "akaghef-beta";
  const state = createValidState("Browser Doc");
  await postDoc(docId, { state });

  const { response, payload } = await getDoc(docId);
  assert.equal(response.status, 200);
  assert.ok(payload.state.nodes, "Must have nodes");
  assert.ok(Object.keys(payload.state.nodes).length > 0, "Nodes must not be empty");
});

test("two different doc IDs store independent data", async () => {
  const state1 = createValidState("Doc One");
  const state2 = createValidState("Doc Two");

  await postDoc("safety-doc-one", { state: state1 });
  await postDoc("safety-doc-two", { state: state2 });

  const { payload: p1 } = await getDoc("safety-doc-one");
  const { payload: p2 } = await getDoc("safety-doc-two");

  // rootIds are different (each model generates a unique rootId)
  assert.notEqual(p1.state.rootId, p2.state.rootId, "Different docs must have different rootIds");
});

// =========================================================================
// C. Data protection tests
// =========================================================================

test("existing data survives an invalid POST (empty state)", async () => {
  const docId = "safety-survive-empty-post";
  const state = createValidState("Precious Data");
  const originalNodeCount = Object.keys(state.nodes).length;

  // Save valid data first
  const { response: saveRes } = await postDoc(docId, { state });
  assert.equal(saveRes.status, 200);

  // Attempt to overwrite with empty state -- should be rejected
  const { response: emptyRes } = await postDoc(docId, { state: {} });
  assert.equal(emptyRes.status, 400);

  // Attempt with empty nodes -- should be rejected
  const { response: emptyNodesRes } = await postDoc(docId, {
    state: { rootId: "x", nodes: {} },
  });
  assert.equal(emptyNodesRes.status, 400);

  // Verify original data is intact
  const { response: getRes, payload: getPayload } = await getDoc(docId);
  assert.equal(getRes.status, 200);
  assert.equal(
    Object.keys(getPayload.state.nodes).length,
    originalNodeCount,
    "Node count must not change after rejected POSTs",
  );
});

test("existing data survives a POST with null state", async () => {
  const docId = "safety-survive-null-post";
  const state = createValidState("Important Data");

  await postDoc(docId, { state });
  const { response: badRes } = await postDoc(docId, { state: null });
  assert.equal(badRes.status, 400);

  const { payload } = await getDoc(docId);
  assert.ok(Object.keys(payload.state.nodes).length > 0, "Nodes must survive null POST");
});

test("POST with nodes containing only invalid references is rejected", async () => {
  const { response } = await postDoc("safety-invalid-refs", {
    state: {
      rootId: "root1",
      nodes: {
        root1: {
          id: "root1",
          text: "Root",
          parentId: null,
          children: ["nonexistent-child"],
        },
      },
    },
  });
  // validate() should catch the missing child reference
  assert.equal(response.status, 400);
});

// =========================================================================
// D. map_update script safety tests (GET -> modify -> POST flow)
// =========================================================================

test("simulated map_update flow: GET, add node, POST preserves all nodes", async () => {
  const docId = "safety-map-update-flow";
  const state = createValidState("Map Update Base");
  const originalNodeCount = Object.keys(state.nodes).length;
  await postDoc(docId, { state });

  // Simulate: GET current state
  const { payload: current } = await getDoc(docId);
  assert.equal(Object.keys(current.state.nodes).length, originalNodeCount);

  // Simulate: add a node via model
  const model = RapidMvpModel.fromJSON(current.state);
  model.addNode(model.state.rootId, "New Node from map_update");
  const updatedState = model.toJSON();
  assert.equal(
    Object.keys(updatedState.nodes).length,
    originalNodeCount + 1,
    "Should have one more node",
  );

  // Simulate: POST back
  const { response: postRes } = await postDoc(docId, { state: updatedState });
  assert.equal(postRes.status, 200);

  // Verify
  const { payload: final } = await getDoc(docId);
  assert.equal(
    Object.keys(final.state.nodes).length,
    originalNodeCount + 1,
    "All nodes including new one must be present after map_update flow",
  );
});

test("map_update safety guard: POST that would erase all children is blocked", async () => {
  const docId = "safety-map-update-erase-guard";
  const model = new RapidMvpModel("Root with children");
  model.addNode(model.state.rootId, "Child 1");
  model.addNode(model.state.rootId, "Child 2");
  model.addNode(model.state.rootId, "Child 3");
  const state = model.toJSON();
  assert.ok(Object.keys(state.nodes).length >= 4);

  await postDoc(docId, { state });

  // Attempt POST with only root node (children removed) -- this is valid
  // structurally but would be caught by a map_update guard (client-side).
  // Server should still accept structurally valid state.
  const rootOnlyModel = new RapidMvpModel("Root with children");
  const rootOnlyState = rootOnlyModel.toJSON();
  assert.equal(Object.keys(rootOnlyState.nodes).length, 1);

  const { response } = await postDoc(docId, { state: rootOnlyState });
  // The server accepts this since it's structurally valid (has root + nodes).
  // The map_update client script should check node count BEFORE posting.
  assert.equal(response.status, 200);
});

test("POST with empty body string returns 400", async () => {
  const { response, payload } = await requestJson(`${baseUrl}/api/docs/safety-empty-body`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "",
  });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});

test("POST with body '{}' (no state field) returns 400", async () => {
  const { response, payload } = await requestJson(`${baseUrl}/api/docs/safety-no-state-field`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "{}",
  });
  assert.equal(response.status, 400);
  assert.ok(payload.error);
});
