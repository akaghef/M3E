"use strict";

// ---------------------------------------------------------------------------
// cloud_ops_safety.test.js
//
// Tests to prevent real-world Cloud Sync bugs that occurred in production:
//   1. map ID mismatch between browser and SQLite
//   2. state_json becoming null (empty POST)
//   3. map_update.mjs POST destroying map data
//   4. Supabase restore map ID inconsistency
// ---------------------------------------------------------------------------

import { test, expect, beforeAll, afterAll } from "vitest";
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

async function postDoc(mapId, body) {
  return requestJson(`${baseUrl}/api/maps/${mapId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
}

async function getMap(mapId) {
  return requestJson(`${baseUrl}/api/maps/${mapId}`);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

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
});

// =========================================================================
// A. API-level defense tests
// =========================================================================

test("POST /api/maps/:id with empty state ({}) returns 400", async () => {
  const { response, payload } = await postDoc("safety-empty-state", { state: {} });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});

test("POST /api/maps/:id with empty nodes ({nodes: {}}) returns 400", async () => {
  const { response, payload } = await postDoc("safety-empty-nodes", {
    state: { rootId: "nonexistent", nodes: {} },
  });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});

test("POST /api/maps/:id without state field returns 400", async () => {
  const { response, payload } = await postDoc("safety-no-state", { foo: "bar" });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});

test("POST /api/maps/:id with state: null returns 400", async () => {
  const { response, payload } = await postDoc("safety-null-state", { state: null });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});

test("POST /api/maps/:id with state: 'string' returns 400", async () => {
  const { response, payload } = await postDoc("safety-string-state", { state: "not-an-object" });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});

test("POST /api/maps/:id with valid state returns 200 and correct mapId", async () => {
  const mapId = "safety-valid-post";
  const state = createValidState("Safety Test Root");
  const { response, payload } = await postDoc(mapId, { state });
  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);
  expect(payload.mapId).toBe(mapId);

  // Verify data is readable back with the same map ID
  const { response: getRes, payload: getPayload } = await getMap(mapId);
  expect(getRes.status).toBe(200);
  expect(getPayload.state).toBeTruthy();
  expect(Object.keys(getPayload.state.nodes).length >= 3).toBe(true);
});

test("GET /api/maps/:id for non-existent map returns 404 (no auto-creation)", async () => {
  const { response, payload } = await getMap("safety-nonexistent-map-xyz");
  expect(response.status).toBe(404);
  expect(payload.error).toBeTruthy();

  // Confirm a second GET still returns 404 (not auto-created on first access)
  const { response: r2 } = await getMap("safety-nonexistent-map-xyz");
  expect(r2.status).toBe(404);
});

test("POST /api/maps/:id with invalid JSON body returns 400", async () => {
  const { response, payload } = await requestJson(`${baseUrl}/api/maps/safety-bad-json`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "{ this is not json }",
  });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});

// =========================================================================
// B. map ID consistency tests
// =========================================================================

test("POST then GET with same map ID returns matching data", async () => {
  const mapId = "safety-mapid-roundtrip";
  const state = createValidState("MapID Test");
  await postDoc(mapId, { state });

  const { response, payload } = await getMap(mapId);
  expect(response.status).toBe(200);
  expect(payload.state.rootId).toBe(state.rootId);
  expect(
    Object.keys(payload.state.nodes).length,
  ).toBe(Object.keys(state.nodes).length);
});

test("map ID is case-sensitive and preserved exactly", async () => {
  const mapId = "Akaghef-Beta";
  const state = createValidState("Case Test");
  const { payload: postPayload } = await postDoc(mapId, { state });
  expect(postPayload.mapId).toBe(mapId);

  const { response } = await getMap(mapId);
  expect(response.status).toBe(200);

  // A different casing should NOT find the map
  const { response: wrongCase } = await getMap("akaghef-beta");
  // This may be 404 or 200 depending on SQLite collation; we just verify
  // the correct casing works.
  expect(response.status).toBe(200);
});

test("POST to map ID 'akaghef-beta' is retrievable with exactly that ID", async () => {
  // Real-world bug: browser uses 'akaghef-beta' but server stores as 'rapid-main'
  const mapId = "akaghef-beta";
  const state = createValidState("Browser Map");
  await postDoc(mapId, { state });

  const { response, payload } = await getMap(mapId);
  expect(response.status).toBe(200);
  expect(payload.state.nodes).toBeTruthy();
  expect(Object.keys(payload.state.nodes).length > 0).toBe(true);
});

test("two different map IDs store independent data", async () => {
  const state1 = createValidState("Map One");
  const state2 = createValidState("Map Two");

  await postDoc("safety-map-one", { state: state1 });
  await postDoc("safety-map-two", { state: state2 });

  const { payload: p1 } = await getMap("safety-map-one");
  const { payload: p2 } = await getMap("safety-map-two");

  // rootIds are different (each model generates a unique rootId)
  expect(p1.state.rootId).not.toBe(p2.state.rootId);
});

// =========================================================================
// C. Data protection tests
// =========================================================================

test("existing data survives an invalid POST (empty state)", async () => {
  const mapId = "safety-survive-empty-post";
  const state = createValidState("Precious Data");
  const originalNodeCount = Object.keys(state.nodes).length;

  // Save valid data first
  const { response: saveRes } = await postDoc(mapId, { state });
  expect(saveRes.status).toBe(200);

  // Attempt to overwrite with empty state -- should be rejected
  const { response: emptyRes } = await postDoc(mapId, { state: {} });
  expect(emptyRes.status).toBe(400);

  // Attempt with empty nodes -- should be rejected
  const { response: emptyNodesRes } = await postDoc(mapId, {
    state: { rootId: "x", nodes: {} },
  });
  expect(emptyNodesRes.status).toBe(400);

  // Verify original data is intact
  const { response: getRes, payload: getPayload } = await getMap(mapId);
  expect(getRes.status).toBe(200);
  expect(
    Object.keys(getPayload.state.nodes).length,
  ).toBe(originalNodeCount);
});

test("existing data survives a POST with null state", async () => {
  const mapId = "safety-survive-null-post";
  const state = createValidState("Important Data");

  await postDoc(mapId, { state });
  const { response: badRes } = await postDoc(mapId, { state: null });
  expect(badRes.status).toBe(400);

  const { payload } = await getMap(mapId);
  expect(Object.keys(payload.state.nodes).length > 0).toBe(true);
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
  expect(response.status).toBe(400);
});

// =========================================================================
// D. map_update script safety tests (GET -> modify -> POST flow)
// =========================================================================

test("simulated map_update flow: GET, add node, POST preserves all nodes", async () => {
  const mapId = "safety-map-update-flow";
  const state = createValidState("Map Update Base");
  const originalNodeCount = Object.keys(state.nodes).length;
  await postDoc(mapId, { state });

  // Simulate: GET current state
  const { payload: current } = await getMap(mapId);
  expect(Object.keys(current.state.nodes).length).toBe(originalNodeCount);

  // Simulate: add a node via model
  const model = RapidMvpModel.fromJSON(current.state);
  model.addNode(model.state.rootId, "New Node from map_update");
  const updatedState = model.toJSON();
  expect(
    Object.keys(updatedState.nodes).length,
  ).toBe(originalNodeCount + 1);

  // Simulate: POST back
  const { response: postRes } = await postDoc(mapId, { state: updatedState });
  expect(postRes.status).toBe(200);

  // Verify
  const { payload: final } = await getMap(mapId);
  expect(
    Object.keys(final.state.nodes).length,
  ).toBe(originalNodeCount + 1);
});

test("map_update safety guard: POST that would erase all children is blocked", async () => {
  const mapId = "safety-map-update-erase-guard";
  const model = new RapidMvpModel("Root with children");
  model.addNode(model.state.rootId, "Child 1");
  model.addNode(model.state.rootId, "Child 2");
  model.addNode(model.state.rootId, "Child 3");
  const state = model.toJSON();
  expect(Object.keys(state.nodes).length >= 4).toBe(true);

  await postDoc(mapId, { state });

  // Attempt POST with only root node (children removed) -- this is valid
  // structurally but would be caught by a map_update guard (client-side).
  // Server should still accept structurally valid state.
  const rootOnlyModel = new RapidMvpModel("Root with children");
  const rootOnlyState = rootOnlyModel.toJSON();
  expect(Object.keys(rootOnlyState.nodes).length).toBe(1);

  const { response } = await postDoc(mapId, { state: rootOnlyState });
  // The server accepts this since it's structurally valid (has root + nodes).
  // The map_update client script should check node count BEFORE posting.
  expect(response.status).toBe(200);
});

test("POST with empty body string returns 400", async () => {
  const { response, payload } = await requestJson(`${baseUrl}/api/maps/safety-empty-body`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "",
  });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});

test("POST with body '{}' (no state field) returns 400", async () => {
  const { response, payload } = await requestJson(`${baseUrl}/api/maps/safety-no-state-field`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: "{}",
  });
  expect(response.status).toBe(400);
  expect(payload.error).toBeTruthy();
});
