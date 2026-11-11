import { describe, expect, test } from "vitest";
import { assembleViewerState, type NodeContentRecord } from "../../../src/cutover/viewer-state/assemble";

describe("assembleViewerState", () => {
  test("空のレコードは node を持たない state になる", () => {
    expect(assembleViewerState({
      nodes: [],
      edges: [],
      siblingOrders: [],
      attributes: [],
    })).toEqual({
      rootId: "",
      nodes: {},
    });
  });

  test("一本の木は親子 edge から rootId、parentId、children[] を組む", () => {
    const root = {
      id: "root",
      text: "動物",
      details: "界より上",
      parentId: "ignored",
      children: ["ghost"],
      attributes: { leaked: "yes" },
    };
    const state = assembleViewerState({
      nodes: [
        { id: "leaf", text: "Whale", note: "海洋" },
        root as unknown as NodeContentRecord,
        { id: "child", text: "Mammals", nodeType: "folder", link: "https://example.test/mammals" },
      ],
      edges: [
        { parentId: "child", childId: "leaf" },
        { parentId: "root", childId: "child" },
      ],
      siblingOrders: [],
      attributes: [],
    });

    expect(state.rootId).toBe("root");
    expect(state.nodes.root).toMatchObject({
      id: "root",
      parentId: null,
      children: ["child"],
      text: "動物",
      details: "界より上",
      note: "",
      link: "",
      nodeType: "text",
      collapsed: false,
      attributes: {},
    });
    expect(state.nodes.child).toMatchObject({
      parentId: "root",
      children: ["leaf"],
      text: "Mammals",
      nodeType: "folder",
      link: "https://example.test/mammals",
      attributes: {},
    });
    expect(state.nodes.leaf).toMatchObject({
      parentId: "child",
      children: [],
      text: "Whale",
      note: "海洋",
      attributes: {},
    });
    expect(state.links).toBeUndefined();
    expect(state.scopes).toBeUndefined();
    expect(state.surfaces).toBeUndefined();
  });

  test("兄弟順は親子 edge の並びより order を優先する", () => {
    const state = assembleViewerState({
      nodes: [
        { id: "root", text: "Root" },
        { id: "c", text: "C" },
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      edges: [
        { parentId: "root", childId: "c" },
        { parentId: "root", childId: "b" },
        { parentId: "root", childId: "a" },
      ],
      siblingOrders: [
        { parentId: "root", childId: "b", order: 5 },
        { parentId: "root", childId: "a", order: 0 },
        { parentId: "root", childId: "c", order: 2 },
        { parentId: "root", childId: "c", order: 1 },
      ],
      attributes: [],
    });

    expect(state.nodes.root?.children).toEqual(["a", "c", "b"]);
    expect(state.nodes.a?.parentId).toBe("root");
    expect(state.nodes.b?.parentId).toBe("root");
    expect(state.nodes.c?.parentId).toBe("root");
  });

  test("属性は node ごとの attributes に戻り、同じキーは後のレコードが残る", () => {
    const attributes = Object.freeze([
      Object.freeze({ nodeId: "root", key: "m3e:facet", value: "document" }),
      Object.freeze({ nodeId: "child", key: "m3e:display-role", value: "anchor" }),
      Object.freeze({ nodeId: "child", key: "m3e:synthetic", value: "anchor" }),
      Object.freeze({ nodeId: "child", key: "m3e:display-role", value: "stage" }),
    ]);
    const state = assembleViewerState({
      nodes: [
        { id: "root", text: "Root" },
        { id: "child", text: "Child" },
      ],
      edges: [{ parentId: "root", childId: "child" }],
      siblingOrders: [],
      attributes,
    });

    expect(state.nodes.root?.attributes).toEqual({ "m3e:facet": "document" });
    expect(state.nodes.child?.attributes).toEqual({
      "m3e:display-role": "stage",
      "m3e:synthetic": "anchor",
    });
    expect(state.nodes.root?.text).toBe("Root");
    expect(attributes).toHaveLength(4);
  });
});
