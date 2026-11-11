import { describe, expect, test } from "vitest";
import type { AppState, TreeNode } from "../../../src/shared/types";
import { aliasRecordsToAppState, toAliasRecords } from "../../../src/cutover/alias/records";

function entity(partial: Pick<TreeNode, "id" | "parentId" | "children" | "text"> & Partial<TreeNode>): TreeNode {
  return {
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
    nodeType: "text",
    ...partial,
  };
}

function state(): AppState {
  const nodes: Record<string, TreeNode> = {
    root: entity({
      id: "root",
      parentId: null,
      children: ["scope", "canon"],
      text: "map",
      nodeType: "folder",
    }),
    scope: entity({
      id: "scope",
      parentId: "root",
      children: ["canon", "window-read", "window-write"],
      text: "局所",
      nodeType: "folder",
      details: "scope の本文ではない",
    }),
    canon: entity({
      id: "canon",
      parentId: "scope",
      children: [],
      text: "正本の本文",
      details: "固有の詳細",
      note: "固有の注",
      attributes: { "m3e:facet": "document" },
      link: "https://example.test/canon",
    }),
    "window-read": {
      id: "window-read",
      parentId: "scope",
      children: [],
      nodeType: "alias",
      text: "参照窓",
      collapsed: false,
      details: "写してはいけない",
      note: "写してはいけない",
      attributes: { leaked: "yes" },
      link: "https://example.test/leaked",
      targetNodeId: "canon",
      aliasLabel: "参照窓",
      access: "read",
      isBroken: false,
    },
    "window-write": {
      id: "window-write",
      parentId: "scope",
      children: [],
      nodeType: "alias",
      text: "",
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
      targetNodeId: "canon",
      access: "write",
      isBroken: false,
    },
  };
  return { rootId: "root", nodes };
}

function withoutAliases(source: AppState): AppState {
  const nodes: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(source.nodes)) {
    if (node.nodeType === "alias") continue;
    nodes[id] = {
      ...node,
      children: node.children.filter((childId) => source.nodes[childId]?.nodeType !== "alias"),
      attributes: { ...node.attributes },
    };
  }
  return { ...source, nodes };
}

describe("alias records", () => {
  test("参照が往復し、実体は複製されない", () => {
    const source = state();
    const records = toAliasRecords(source);
    expect(records.map((record) => record.targetNodeId)).toEqual(["canon", "canon"]);
    expect(records.map((record) => record.access)).toEqual(["read", "write"]);
    expect(records[0]).toMatchObject({
      id: "window-read",
      parentId: "scope",
      targetNodeId: "canon",
      aliasLabel: "参照窓",
      access: "read",
      isBroken: false,
    });
    expect(records[0]).not.toHaveProperty("text");
    expect(records[0]).not.toHaveProperty("details");
    expect(JSON.stringify(records)).not.toContain("正本の本文");
    expect(JSON.stringify(records)).not.toContain("固有の詳細");

    const restored = aliasRecordsToAppState(withoutAliases(source), records);
    expect(restored.nodes["window-read"]).toMatchObject({
      nodeType: "alias",
      parentId: "scope",
      children: [],
      targetNodeId: "canon",
      aliasLabel: "参照窓",
      access: "read",
      text: "参照窓",
      details: "",
      note: "",
      link: "",
      attributes: {},
    });
    expect(restored.nodes["window-write"]).toMatchObject({
      targetNodeId: "canon",
      access: "write",
      text: "",
      children: [],
    });
    expect(restored.nodes["window-write"]?.aliasLabel).toBeUndefined();
    expect(restored.nodes.canon).toMatchObject({
      text: "正本の本文",
      details: "固有の詳細",
      note: "固有の注",
      link: "https://example.test/canon",
      attributes: { "m3e:facet": "document" },
      nodeType: "text",
    });
    expect(restored.nodes.canon?.access).toBeUndefined();
    expect(restored.nodes.scope?.children).toEqual(["canon", "window-read", "window-write"]);
    expect(source.nodes["window-read"]?.details).toBe("写してはいけない");
    expect(source.nodes.scope?.children).toEqual(["canon", "window-read", "window-write"]);
  });

  test("同一 scope の実体も参照でき、権限は alias ごとに残る", () => {
    const source = state();
    source.nodes.canon = { ...source.nodes.canon!, access: "write" as unknown as TreeNode["access"] };
    const records = toAliasRecords(source);
    expect(records.find((record) => record.id === "window-read")?.access).toBe("read");
    expect(records.find((record) => record.id === "window-write")?.access).toBe("write");

    const restored = aliasRecordsToAppState(withoutAliases(source), records);
    expect(restored.nodes["window-read"]?.access).toBe("read");
    expect(restored.nodes["window-write"]?.access).toBe("write");
    expect(restored.nodes["window-read"]?.targetNodeId).toBe("canon");
  });

  test("alias から alias は拒否される", () => {
    const source = state();
    source.nodes["window-write"] = {
      ...source.nodes["window-write"]!,
      targetNodeId: "window-read",
    };

    expect(() => toAliasRecords(source)).toThrow(/Alias cannot target another alias/);

    const base = withoutAliases(state());
    const withAlias = state();
    expect(() => aliasRecordsToAppState(withAlias, [{
      id: "window-chain",
      parentId: "scope",
      targetNodeId: "window-read",
      access: "read",
      isBroken: false,
    }])).toThrow(/Alias cannot target another alias/);

    expect(() => aliasRecordsToAppState(base, [
      {
        id: "window-a",
        parentId: "scope",
        targetNodeId: "canon",
        access: "read",
        isBroken: false,
      },
      {
        id: "window-b",
        parentId: "scope",
        targetNodeId: "window-a",
        access: "write",
        isBroken: false,
      },
    ])).toThrow(/Alias cannot target another alias/);

    expect(() => aliasRecordsToAppState(base, [{
      id: "window-self",
      parentId: "scope",
      targetNodeId: "window-self",
      access: "read",
      isBroken: false,
    }])).toThrow(/Alias cannot target another alias/);

    expect(base.nodes["window-chain"]).toBeUndefined();
    expect(base.nodes.canon?.text).toBe("正本の本文");
  });
});
