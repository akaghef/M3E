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

test("deleteNode keeps alias as broken reference", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const targetId = model.addNode(rootId, "Target");
  const aliasId = model.addAlias(rootId, targetId);

  model.deleteNode(targetId);

  assert.equal(model.state.nodes[targetId], undefined);
  assert.equal(model.state.nodes[aliasId].nodeType, "alias");
  assert.equal(model.state.nodes[aliasId].isBroken, true);
  assert.equal(model.state.nodes[aliasId].targetSnapshotLabel, "Target");
  assert.equal(model.state.nodes[aliasId].text, "Target (deleted)");
});

test("addAlias stores access and label", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const targetId = model.addNode(rootId, "Shared");
  const aliasId = model.addAlias(rootId, targetId, {
    aliasLabel: "Shortcut",
    access: "write",
  });

  assert.equal(model.state.nodes[aliasId].targetNodeId, targetId);
  assert.equal(model.state.nodes[aliasId].aliasLabel, "Shortcut");
  assert.equal(model.state.nodes[aliasId].access, "write");
  assert.equal(model.state.nodes[aliasId].text, "Shortcut");
});

test("addLink stores graph link in state", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");

  const linkId = model.addLink(a, b, {
    relationType: "reference",
    label: "see also",
    direction: "forward",
    style: "dashed",
  });

  assert.equal(model.state.links[linkId].sourceNodeId, a);
  assert.equal(model.state.links[linkId].targetNodeId, b);
  assert.equal(model.state.links[linkId].direction, "forward");
  assert.equal(model.state.links[linkId].style, "dashed");
});

test("deleteNode removes graph links touching deleted nodes", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const linkId = model.addLink(a, b);

  model.deleteNode(a);

  assert.equal(model.state.links[linkId], undefined);
});

test("validate rejects alias targeting alias", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const targetId = model.addNode(rootId, "Shared");
  const aliasId = model.addAlias(rootId, targetId);
  const badAliasId = model.addNode(rootId, "Bad Alias");

  model.state.nodes[badAliasId].nodeType = "alias";
  model.state.nodes[badAliasId].targetNodeId = aliasId;
  model.state.nodes[badAliasId].access = "read";
  model.state.nodes[badAliasId].children = [];

  assert.match(model.validate().join(" | "), /cannot target alias node/);
});

test("validate rejects graph link with alias endpoint", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const targetId = model.addNode(rootId, "Target");
  const aliasId = model.addAlias(rootId, targetId);
  const badNodeId = model.addNode(rootId, "Bad");
  const linkId = "link_bad";

  model.state.links = {
    [linkId]: {
      id: linkId,
      sourceNodeId: aliasId,
      targetNodeId: badNodeId,
    },
  };

  assert.match(model.validate().join(" | "), /cannot use alias source node/);
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
