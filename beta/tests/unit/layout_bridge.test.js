"use strict";

import { test, expect } from "vitest";

const { m3eLayout } = require("../../dist/shared/layout_bridge.js");

test("m3eLayout exposes a Node-importable mindmap layout bridge", () => {
  const childrenById = new Map([
    ["root", ["a", "b"]],
    ["a", ["a1"]],
    ["b", []],
    ["a1", []],
  ]);
  const graph = {
    nodeIds: ["root", "a", "a1", "b"],
    childrenOf: (id) => childrenById.get(id) || [],
    graphLinks: [],
  };
  const boxSizes = {
    root: { w: 360, h: 118 },
    a: { w: 300, h: 112 },
    a1: { w: 300, h: 112 },
    b: { w: 300, h: 112 },
  };

  const layout = m3eLayout(graph, boxSizes, "mindmap", {
    displayRootId: "root",
    structuredMode: "mindmap",
    branchDirection: "right",
    depthAlign: "aligned",
    direction: "right",
  });

  expect(layout.order).toEqual(["root", "a", "a1", "b"]);
  expect(layout.pos.root.depth).toBe(0);
  expect(layout.pos.a.depth).toBe(1);
  expect(layout.pos.a1.depth).toBe(2);
  expect(layout.pos.a.x).toBeGreaterThan(layout.pos.root.x);
  expect(layout.pos.a1.x).toBeGreaterThan(layout.pos.a.x);
  expect(layout.totalWidth).toBeGreaterThanOrEqual(1400);
  expect(layout.totalHeight).toBeGreaterThanOrEqual(760);
});
