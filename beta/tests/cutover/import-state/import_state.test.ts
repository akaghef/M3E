import { expect, test } from "vitest";
import { childrenInOrder, validateTree } from "../../../src/cutover/tree/invariant";
import { importStateJson, siblingOrderKey } from "../../../src/cutover/import-state/import_state";

const stateJson = JSON.stringify({
  rootId: "root",
  selectedId: "a",
  linearTextFontScale: 1.2,
  linearNotesByScope: { root: "UNSTORED_BODY_linear" },
  nodes: {
    b: {
      id: "b",
      parentId: "root",
      children: [],
      text: "B",
      collapsed: true,
      details: "",
      note: "",
      attributes: {},
      link: "",
      extraField: "UNSTORED_BODY_extra",
    },
    root: {
      id: "root",
      parentId: null,
      children: ["a", "b"],
      nodeType: "folder",
      text: "Root",
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    },
    a: {
      id: "a",
      parentId: "root",
      children: [],
      scopeId: "scope:root",
      text: "A",
      collapsed: false,
      details: "",
      note: "",
      attributes: { status: "open" },
      link: "",
    },
  },
  links: {
    l1: {
      id: "l1",
      sourceNodeId: "a",
      targetNodeId: "b",
      label: "UNSTORED_BODY_link",
    },
  },
  scopes: {
    "scope:root": {
      id: "scope:root",
      label: "UNSTORED_BODY_scope",
      rootNodeIds: ["root"],
      relationIds: ["l1"],
      primarySurfaceId: "surface:root:tree",
    },
  },
});

test("三つの node と一つの属性が、元の木と同じ親子と順番のレコードになる", () => {
  const result = importStateJson(stateJson);

  expect(result.nodes.map((node) => node.id)).toEqual(["root", "a", "b"]);
  expect(result.nodes.map((node) => node.isRoot)).toEqual([true, false, false]);
  expect(result.attributes).toEqual([
    { ownerKind: "node", ownerId: "a", key: "status", value: "open" },
  ]);
  expect(result.edges).toEqual([
    { parentId: "root", childId: "a" },
    { parentId: "root", childId: "b" },
  ]);
  expect(result.siblingOrderKeys.map((row) => row.childId)).toEqual(["a", "b"]);
  expect(result.siblingOrderKeys.map((row) => row.orderKey)).toEqual(["a0", "a1"]);

  const tree = validateTree({
    nodeIds: result.nodes.map((node) => node.id),
    links: result.siblingOrderKeys.map((row) => ({
      parentId: row.parentId,
      childId: row.childId,
      orderKey: row.orderKey,
    })),
  });
  expect(tree.ok).toBe(true);
  if (tree.ok) expect(childrenInOrder(tree.tree, "root")).toEqual(["a", "b"]);

  expect(result.scopeMemberships).toEqual([
    { scopeId: "scope:root", nodeId: "root" },
    { scopeId: "scope:root", nodeId: "a" },
    { scopeId: "scope:root", nodeId: "b" },
  ]);
  expect(result.unstored).toEqual([
    "linearNotesByScope",
    "linearTextFontScale",
    "links",
    "links.id",
    "links.label",
    "links.sourceNodeId",
    "links.targetNodeId",
    "nodes.extraField",
    "scopes.label",
    "scopes.primarySurfaceId",
    "scopes.relationIds",
    "selectedId",
  ]);
  expect(JSON.stringify(result.unstored)).not.toContain("UNSTORED_BODY");
});

test("兄弟順キーは広い兄弟リストでも children の順に並ぶ", () => {
  const keys = Array.from({ length: 70 }, (_, index) => siblingOrderKey(index, 70));
  expect([...keys].sort()).toEqual(keys);
});

test("導出と違う scopeId も所属として残る", () => {
  const result = importStateJson({
    rootId: "root",
    nodes: {
      root: {
        id: "root",
        parentId: null,
        children: ["child"],
        text: "Root",
        collapsed: false,
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
      child: {
        id: "child",
        parentId: "root",
        children: [],
        scopeId: "scope:other",
        text: "Child",
        collapsed: false,
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
    },
  });

  expect(result.scopeMemberships).toEqual([
    { scopeId: "scope:root", nodeId: "root" },
    { scopeId: "scope:other", nodeId: "child" },
    { scopeId: "scope:root", nodeId: "child" },
  ]);
});
