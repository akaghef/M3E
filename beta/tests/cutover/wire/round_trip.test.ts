import { describe, expect, test } from "vitest";
import { importStateJson } from "../../../src/cutover/import-state";
import { roundTrip } from "../../../src/cutover/wire/round_trip";

/**
 * 合成データだけ。生きている map は使わない。
 * 兄弟の並びは id 順ではない。window が whale より前、mammal が bird より前。
 */

function synthetic() {
  return {
    version: 1,
    savedAt: "2026-11-11T00:00:00.000Z",
    mapVersion: 3,
    tags: ["synthetic"],
    archived: false,
    pinned: true,
    source: { kind: "obsidian" as const, path: "/synthetic/vault" },
    state: {
      rootId: "root",
      selectedId: "whale",
      linearNotesByScope: { "scope:root": "本文は混ざらない" },
      linearTextFontScale: 1.25,
      linearPanelWidth: 480,
      nodes: {
        root: {
          id: "root",
          parentId: null,
          children: ["mammal", "bird"],
          nodeType: "folder",
          text: "合成",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
          extraField: "keep-me",
        },
        mammal: {
          id: "mammal",
          parentId: "root",
          children: ["window", "whale"],
          nodeType: "folder",
          text: "哺乳類",
          collapsed: true,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        window: {
          id: "window",
          parentId: "mammal",
          children: [],
          nodeType: "alias",
          text: "鯨の窓",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
          targetNodeId: "whale",
          aliasLabel: "鯨の窓",
          access: "read" as const,
          isBroken: false,
        },
        whale: {
          id: "whale",
          parentId: "mammal",
          children: [],
          nodeType: "text",
          text: "鯨",
          collapsed: false,
          details: "本体",
          note: "海洋",
          attributes: {
            "m3e:style": JSON.stringify({ fill: "#112233", text: "#010101" }),
            "m3e:bg": "#abcdef",
          },
          link: "",
        },
        bird: {
          id: "bird",
          parentId: "root",
          children: [],
          nodeType: "text",
          text: "鳥",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
      links: {
        "gl-food": {
          id: "gl-food",
          sourceNodeId: "whale",
          targetNodeId: "bird",
          label: "食物",
          direction: "forward" as const,
          attributes: { "m3e:synthetic": "yes" },
          marker: "keep-link",
        },
      },
      scopes: {
        "scope:root": {
          id: "scope:root",
          label: "合成境界",
          rootNodeIds: ["root"],
          relationIds: ["gl-food"],
          primarySurfaceId: "surface:root:tree",
        },
      },
      surfaces: {
        "surface:root:tree": {
          id: "surface:root:tree",
          scopeId: "scope:root",
          kind: "tree" as const,
          layout: "tree" as const,
          surfaceView: { direction: "left/right" as const, space: "normal" as const },
          nodeViews: {
            whale: { x: 12, y: 34 },
            bird: {},
          },
        },
      },
      annotations: {
        "pen-1": {
          id: "pen-1",
          kind: "pen" as const,
          scopeId: "scope:root",
          d: "M0 0 L1 1",
          points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
          stroke: "#000000",
          strokeWidth: 2,
          opacity: 0.5,
          createdAt: "2026-11-11T00:00:00.000Z",
        },
        "text-1": {
          id: "text-1",
          kind: "text" as const,
          scopeId: "scope:root",
          x: 10,
          y: 20,
          text: "日付",
          fill: "#222222",
          fontSize: 14,
          fontWeight: 700,
          variant: "date" as const,
          createdAt: "2026-11-11T00:00:00.000Z",
        },
      },
    },
  };
}

describe("取込から組み立てへの一周", () => {
  test("合成 state は node・親子・兄弟順・GraphLink・linear-text・配置と style・scope・annotation・alias・外側を往復する", () => {
    const fixture = synthetic();
    const before = structuredClone(fixture);
    const result = roundTrip(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fixture).toEqual(before);
    expect(result.unstored).toEqual(importStateJson(fixture).unstored);
    expect(result.scopeMemberships).toEqual(importStateJson(fixture).scopeMemberships);
    expect(result.pendingAttributes).toEqual([]);

    expect(result.state.rootId).toBe("root");
    expect(result.state.nodes.root?.children).toEqual(["mammal", "bird"]);
    expect(result.state.nodes.mammal?.children).toEqual(["window", "whale"]);
    expect(result.state.nodes.mammal).toMatchObject({ parentId: "root", text: "哺乳類", collapsed: true, nodeType: "folder" });
    expect(result.state.nodes.whale).toMatchObject({ parentId: "mammal", text: "鯨", details: "本体", note: "海洋" });
    expect(result.state.nodes.bird).toMatchObject({ parentId: "root", text: "鳥", children: [] });
    expect(result.state.nodes.window).toMatchObject({
      nodeType: "alias",
      parentId: "mammal",
      children: [],
      text: "鯨の窓",
      details: "",
      targetNodeId: "whale",
      aliasLabel: "鯨の窓",
      access: "read",
    });
    expect(JSON.stringify(result.state.nodes.window)).not.toContain("本体");

    expect(result.state.links?.["gl-food"]).toMatchObject({
      id: "gl-food",
      sourceNodeId: "whale",
      targetNodeId: "bird",
      label: "食物",
      direction: "forward",
      attributes: { "m3e:synthetic": "yes" },
      marker: "keep-link",
    });
    expect(result.state.links?.["root"]).toBeUndefined();

    expect(result.state.linearNotesByScope).toEqual({ "scope:root": "本文は混ざらない" });
    expect(result.state.linearTextFontScale).toBe(1.25);
    expect(result.state.linearPanelWidth).toBe(480);

    expect(result.state.scopes?.["scope:root"]).toMatchObject({
      label: "合成境界",
      relationIds: ["gl-food"],
      rootNodeIds: ["root"],
      primarySurfaceId: "surface:root:tree",
    });
    expect(result.state.surfaces?.["surface:root:tree"]).toMatchObject({
      scopeId: "scope:root",
      kind: "tree",
      layout: "tree",
      surfaceView: { direction: "left/right", space: "normal" },
    });
    expect(result.state.surfaces?.["surface:root:tree"]?.nodeViews).toEqual({
      whale: { x: 12, y: 34 },
      bird: {},
    });
    expect(JSON.parse(result.state.nodes.whale?.attributes["m3e:style"] ?? "")).toEqual({
      fill: "#112233",
      text: "#010101",
    });
    expect(result.state.nodes.whale?.attributes["m3e:bg"]).toBe("#abcdef");
    expect(result.state.annotations).toEqual(fixture.state.annotations);

    expect(result.document).toMatchObject({
      version: 1,
      savedAt: "2026-11-11T00:00:00.000Z",
      mapVersion: 3,
      tags: ["synthetic"],
      archived: false,
      pinned: true,
      source: { kind: "obsidian", path: "/synthetic/vault" },
    });
    expect(result.document?.state).toBe(result.state);

    expect(result.unstored).toEqual(expect.arrayContaining([
      "links",
      "links.label",
      "linearNotesByScope",
      "scopes.label",
      "scopes.relationIds",
      "selectedId",
      "nodes.extraField",
      "links.marker",
    ]));
    expect(result.held).toEqual([
      { name: "links.marker", value: { "gl-food": "keep-link" } },
      { name: "nodes.extraField", value: { root: "keep-me" } },
      { name: "selectedId", value: "whale" },
    ]);
    expect(result.state.nodes.root).toMatchObject({ extraField: "keep-me" });
    expect((result.state as { selectedId?: string }).selectedId).toBe("whale");
  });

  test("apply の Command で node を改名し、組み直した状態に改名が残る", () => {
    const result = roundTrip(synthetic(), {
      commandId: "rename-bird",
      nodeId: "bird",
      text: "鳥類",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.nodes.bird?.text).toBe("鳥類");
    expect(result.state.nodes.whale?.text).toBe("鯨");
    expect(result.state.nodes.root?.children).toEqual(["mammal", "bird"]);
    expect(result.state.nodes.bird?.parentId).toBe("root");
    expect(result.state.links?.["gl-food"]?.label).toBe("食物");
    expect(result.state.scopes?.["scope:root"]?.label).toBe("合成境界");
    expect(result.state.scopes?.["scope:root"]?.relationIds).toEqual(["gl-food"]);
    expect(result.state.linearNotesByScope?.["scope:root"]).toBe("本文は混ざらない");
    expect(result.state.nodes.root).toMatchObject({ extraField: "keep-me" });
    expect(result.document?.savedAt).toBe("2026-11-11T00:00:00.000Z");
  });

  test("空の commandId は apply が拒否し、改名しない", () => {
    const result = roundTrip(synthetic(), { commandId: "", nodeId: "bird", text: "鳥類" });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "rename") return;
    expect(result.rejection).toBe("empty-command-id");
  });

  test("木の不変量は循環を拒否する", () => {
    const result = roundTrip({
      rootId: "a",
      nodes: {
        a: {
          id: "a",
          parentId: null,
          children: ["b"],
          text: "A",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
        b: {
          id: "b",
          parentId: "a",
          children: ["a"],
          text: "B",
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "tree") return;
    expect(result.issues.map((issue) => issue.code)).toContain("cycle");
  });
});
