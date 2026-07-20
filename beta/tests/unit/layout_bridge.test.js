"use strict";

import { test, expect } from "vitest";

const { m3eLayout } = require("../../dist/shared/layout_bridge.js");

test("m3eLayout exposes the canonical layout port through the compatibility bridge", () => {
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

  const result = m3eLayout(graph, boxSizes, "mindmap", {
    displayRootId: "root",
    structuredMode: "mindmap",
    branchDirection: "right",
    depthAlign: "aligned",
    direction: "right",
  });

  expect(result.order).toEqual(["root", "a", "a1", "b"]);
  expect(result.pos.a.x).toBeGreaterThan(result.pos.root.x);
  expect(result.pos.a1.x).toBeGreaterThan(result.pos.a.x);
});
