const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

test("addNode updates parent children", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;

  const childId = model.addNode(rootId, "Child A");

  assert.deepEqual(model.state.nodes[rootId].children, [childId]);
  assert.equal(model.state.nodes[childId].parentId, rootId);
  assert.equal(model.state.nodes[childId].text, "Child A");
});

test("addSibling on root throws", () => {
  const model = new RapidMvpModel("Root");

  assert.throws(() => model.addSibling(model.state.rootId, "S"), {
    message: "Root node cannot have siblings.",
  });
});

test("deleteNode removes subtree", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(a, "B");

  model.deleteNode(a);

  assert.equal(model.state.nodes[a], undefined);
  assert.equal(model.state.nodes[b], undefined);
  assert.deepEqual(model.state.nodes[rootId].children, []);
});

test("reparentNode rejects cycle", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(a, "B");

  assert.throws(() => model.reparentNode(a, b), {
    message: "Cycle detected: cannot move node under its descendant.",
  });
});

test("undo and redo restore previous state", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");

  model.editNode(a, "A2");
  assert.equal(model.state.nodes[a].text, "A2");

  assert.equal(model.undo(), true);
  assert.equal(model.state.nodes[a].text, "A");

  assert.equal(model.redo(), true);
  assert.equal(model.state.nodes[a].text, "A2");
});

test("saveToFile and loadFromFile round-trip", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const child = model.addNode(rootId, "Child");
  model.editNode(child, "Child Updated");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-rapid-"));
  const savePath = path.join(tmpDir, "sample.json");

  model.saveToFile(savePath);
  const loaded = RapidMvpModel.loadFromFile(savePath);

  assert.deepEqual(loaded.toJSON(), model.toJSON());
});

test("queryNodes returns only subtree under scope", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");

  const scoped = model.queryNodes(a).map((node) => node.id);

  assert.deepEqual(scoped, [a, a1]);
  assert.equal(scoped.includes(b), false);
});

test("queryNodes with unknown scope throws", () => {
  const model = new RapidMvpModel("Root");

  assert.throws(() => model.queryNodes("missing"), {
    message: "Node not found: missing",
  });
});
