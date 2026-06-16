import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

test("addNode updates parent children", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;

  const childId = model.addNode(rootId, "Child A");

  expect(model.state.nodes[rootId].children).toEqual([childId]);
  expect(model.state.nodes[childId].parentId).toBe(rootId);
  expect(model.state.nodes[childId].text).toBe("Child A");
});

test("addSibling on root throws", () => {
  const model = new RapidMvpModel("Root");

  expect(() => model.addSibling(model.state.rootId, "S")).toThrow(
    "Root node cannot have siblings.",
  );
});

test("deleteNode removes subtree", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(a, "B");

  model.deleteNode(a);

  expect(model.state.nodes[a]).toBeUndefined();
  expect(model.state.nodes[b]).toBeUndefined();
  expect(model.state.nodes[rootId].children).toEqual([]);
});

test("deleteNode keeps alias as broken reference", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const targetId = model.addNode(rootId, "Target");
  const aliasId = model.addAlias(rootId, targetId);

  model.deleteNode(targetId);

  expect(model.state.nodes[targetId]).toBeUndefined();
  expect(model.state.nodes[aliasId].nodeType).toBe("alias");
  expect(model.state.nodes[aliasId].isBroken).toBe(true);
  expect(model.state.nodes[aliasId].targetSnapshotLabel).toBe("Target");
  expect(model.state.nodes[aliasId].text).toBe("Target (deleted)");
});

test("addAlias stores access and label", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const targetId = model.addNode(rootId, "Shared");
  const aliasId = model.addAlias(rootId, targetId, {
    aliasLabel: "Shortcut",
    access: "write",
  });

  expect(model.state.nodes[aliasId].targetNodeId).toBe(targetId);
  expect(model.state.nodes[aliasId].aliasLabel).toBe("Shortcut");
  expect(model.state.nodes[aliasId].access).toBe("write");
  expect(model.state.nodes[aliasId].text).toBe("Shortcut");
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

  expect(model.state.links[linkId].sourceNodeId).toBe(a);
  expect(model.state.links[linkId].targetNodeId).toBe(b);
  expect(model.state.links[linkId].direction).toBe("forward");
  expect(model.state.links[linkId].style).toBe("dashed");
});

test("addLink throws when endpoint nodes are missing", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");

  expect(() => model.addLink(a, "missing-id")).toThrow();
  expect(() => model.addLink(a, a)).toThrow(/cannot connect a node to itself/);
});

test("addLink lazily initializes state.links when undefined", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  delete model.state.links;

  const linkId = model.addLink(a, b);

  expect(model.state.links[linkId].sourceNodeId).toBe(a);
});

test("removeLink deletes the specified link", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const l1 = model.addLink(a, b);
  const l2 = model.addLink(b, a);

  model.removeLink(l1);

  expect(model.state.links[l1]).toBeUndefined();
  expect(model.state.links[l2]).toBeDefined();
});

test("removeLink throws for unknown link id", () => {
  const model = new RapidMvpModel("Root");

  expect(() => model.removeLink("missing-link")).toThrow(/Link not found/);
});

test("addLink allows duplicate links between same pair (tentative policy)", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");

  const l1 = model.addLink(a, b);
  const l2 = model.addLink(a, b);

  expect(l1).not.toBe(l2);
  expect(Object.keys(model.state.links)).toContain(l1);
  expect(Object.keys(model.state.links)).toContain(l2);
});

test("deleteNode removes graph links touching deleted nodes", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const linkId = model.addLink(a, b);

  model.deleteNode(a);

  expect(model.state.links[linkId]).toBeUndefined();
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

  expect(model.validate().join(" | ")).toMatch(/cannot target alias node/);
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

  expect(model.validate().join(" | ")).toMatch(/cannot use alias source node/);
});

test("reparentNode rejects cycle", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(a, "B");

  expect(() => model.reparentNode(a, b)).toThrow(
    "Cycle detected: cannot move node under its descendant.",
  );
});

test("undo and redo restore previous state", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");

  model.editNode(a, "A2");
  expect(model.state.nodes[a].text).toBe("A2");

  expect(model.undo()).toBe(true);
  expect(model.state.nodes[a].text).toBe("A");

  expect(model.redo()).toBe(true);
  expect(model.state.nodes[a].text).toBe("A2");
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

  expect(loaded.toJSON()).toEqual(model.toJSON());
});

test("queryNodes returns only subtree under scope", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");

  const scoped = model.queryNodes(a).map((node) => node.id);

  expect(scoped).toEqual([a, a1]);
  expect(scoped.includes(b)).toBe(false);
});

test("queryNodes with unknown scope throws", () => {
  const model = new RapidMvpModel("Root");

  expect(() => model.queryNodes("missing")).toThrow(
    "Node not found: missing",
  );
});

test("fromJSON handles missing nodes gracefully", () => {
  const model = RapidMvpModel.fromJSON({ rootId: "r", nodes: undefined, links: {} });
  expect(model.state.nodes).toEqual({});
});

test("fromJSON handles missing links gracefully", () => {
  const base = new RapidMvpModel("Root");
  const json = base.toJSON();
  delete json.links;
  const restored = RapidMvpModel.fromJSON(json);
  expect(restored.state.links).toEqual({});
});

test("reparent updates scope-root query results without any node-level scope cascade", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const a = model.addNode(rootId, "A");
  const b = model.addNode(rootId, "B");
  const a1 = model.addNode(a, "A1");

  expect(model.queryNodeIds(a)).toEqual([a, a1]);
  expect(model.queryNodeIds(b)).toEqual([b]);

  model.reparentNode(a1, b);

  expect(model.queryNodeIds(a)).toEqual([a]);
  expect(model.queryNodeIds(b)).toEqual([b, a1]);
});
