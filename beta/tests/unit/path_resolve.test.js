import { test, expect } from "vitest";

const { parseMapPath, resolveNodePath } = require("../../dist/shared/path_resolve.js");

function makeState() {
  return {
    rootId: "root",
    nodes: {
      root: { id: "root", text: "Root", parentId: null, children: ["a"] },
      a: { id: "a", text: "A", parentId: "root", children: ["b"] },
      b: { id: "b", text: "B", parentId: "a", children: ["c"] },
      c: { id: "c", text: "C", parentId: "b", children: ["d"] },
      d: { id: "d", text: "D", parentId: "c", children: ["e"] },
      e: { id: "e", text: "E", parentId: "d", children: [] },
    },
    links: {},
  };
}

test("parseMapPath accepts M display paths with scope separators", () => {
  const parsed = parseMapPath("M:(開発)> A > B >> C >D >> E");
  expect(parsed).toEqual({
    segments: ["A", "B", "C", "D", "E"],
    hadMapPrefix: true,
    mapLabel: "開発",
  });
});

test("resolveNodePath resolves parsed M display paths", () => {
  const parsed = parseMapPath("M:(開発)> A > B >> C >D >> E");
  const result = resolveNodePath(makeState(), parsed.segments);
  expect(result).toEqual({
    ok: true,
    nodeId: "e",
    matched: ["Root", "A", "B", "C", "D", "E"],
  });
});

test("parseMapPath keeps legacy Map colon slash paths", () => {
  const parsed = parseMapPath("Map:Root/A/B");
  expect(parsed).toEqual({
    segments: ["Root", "A", "B"],
    hadMapPrefix: true,
  });
});
