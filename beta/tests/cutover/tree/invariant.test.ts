import { expect, it } from "vitest";
import {
  changeParent,
  childrenInOrder,
  detachParent,
  parentsOf,
  reorderSibling,
  validateTree,
  type TreeState,
} from "../../../src/cutover/tree/invariant";

const line: TreeState = {
  nodeIds: ["a", "b", "c"],
  links: [
    { parentId: "a", childId: "b", orderKey: "a0" },
    { parentId: "b", childId: "c", orderKey: "a0" },
  ],
};

it("循環を拒否する", () => {
  const direct = validateTree({
    nodeIds: ["a", "b"],
    links: [
      { parentId: "b", childId: "a", orderKey: "a0" },
      { parentId: "a", childId: "b", orderKey: "a0" },
    ],
  });
  expect(direct.ok).toBe(false);
  if (!direct.ok) expect(direct.issues.map((issue) => issue.code)).toContain("cycle");

  const self = changeParent(line, "b", "b", "a1");
  expect(self.ok).toBe(false);
  if (!self.ok) expect(self.issues.map((issue) => issue.code)).toContain("cycle");

  const before = line.links.map((link) => ({ ...link }));
  const movedUnderDescendant = changeParent(line, "a", "c", "a1");
  expect(movedUnderDescendant.ok).toBe(false);
  if (!movedUnderDescendant.ok) {
    expect(movedUnderDescendant.issues.map((issue) => issue.code)).toContain("cycle");
    expect("tree" in movedUnderDescendant).toBe(false);
  }
  expect(line.links).toEqual(before);
});

it("兄弟の順番が保たれる", () => {
  const tree: TreeState = {
    nodeIds: ["root", "a", "b", "c", "d"],
    links: [
      { parentId: "root", childId: "b", orderKey: "a1" },
      { parentId: "root", childId: "a", orderKey: "a0" },
      { parentId: "root", childId: "c", orderKey: "a2" },
      { parentId: "root", childId: "d", orderKey: "a0V" },
    ],
  };

  expect(childrenInOrder(tree, "root")).toEqual(["a", "d", "b", "c"]);

  const reordered = reorderSibling(tree, "b", "a0A");
  expect(reordered.ok).toBe(true);
  if (reordered.ok) {
    expect(childrenInOrder(reordered.tree, "root")).toEqual(["a", "b", "d", "c"]);
    const order = childrenInOrder(reordered.tree, "root");
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("d"));
    expect(order.indexOf("d")).toBeLessThan(order.indexOf("c"));
  }

  const collision = reorderSibling(tree, "b", "a0");
  expect(collision.ok).toBe(false);
  if (!collision.ok) expect(collision.issues.map((issue) => issue.code)).toContain("duplicate-order-key");
  expect(childrenInOrder(tree, "root")).toEqual(["a", "d", "b", "c"]);
});

it("親を外しても単一親のまま", () => {
  const tree: TreeState = {
    nodeIds: ["a", "b", "c", "d"],
    links: [
      { parentId: "a", childId: "b", orderKey: "a0" },
      { parentId: "b", childId: "c", orderKey: "a0" },
      { parentId: "b", childId: "d", orderKey: "a1" },
    ],
  };

  const detached = detachParent(tree, "b");
  expect(detached.ok).toBe(true);
  if (!detached.ok) return;

  expect(parentsOf(detached.tree, "b")).toEqual([]);
  expect(parentsOf(detached.tree, "c")).toEqual(["b"]);
  expect(parentsOf(detached.tree, "d")).toEqual(["b"]);
  expect(childrenInOrder(detached.tree, "b")).toEqual(["c", "d"]);
  for (const nodeId of detached.tree.nodeIds) {
    expect(parentsOf(detached.tree, nodeId).length).toBeLessThanOrEqual(1);
  }

  const checked = validateTree(detached.tree);
  expect(checked.ok).toBe(true);

  const twoParents = validateTree({
    nodeIds: ["a", "b", "c"],
    links: [
      { parentId: "a", childId: "c", orderKey: "a0" },
      { parentId: "b", childId: "c", orderKey: "a1" },
    ],
  });
  expect(twoParents.ok).toBe(false);
  if (!twoParents.ok) expect(twoParents.issues.map((issue) => issue.code)).toContain("multiple-parents");
});
