import { describe, expect, test } from "vitest";
import {
  applyLayoutRecords,
  layoutRecordsFromAppState,
  type NodePlacementRecord,
} from "../../../src/cutover/layout/records";
import type { AppState, MapSurface, TreeNode } from "../../../src/shared/types";

/**
 * 合成データだけ。個人 map は使わない。
 * Disperse の保存 kind は scatter。Tree は kind tree。
 */

const scatterId = "surface:root:scatter";
const treeId = "surface:root:tree";

function node(id: string, attributes: Record<string, string> = {}): TreeNode {
  return {
    id,
    parentId: id === "root" ? null : "root",
    children: id === "root" ? ["placed", "empty", "origin", "flow"] : [],
    text: id,
    collapsed: false,
    details: "",
    note: "",
    attributes,
    link: "",
  };
}

function surface(id: string, kind: MapSurface["kind"], layout: MapSurface["layout"], nodeViews: MapSurface["nodeViews"]): MapSurface {
  return { id, scopeId: "scope:root", kind, layout, nodeViews };
}

function syntheticState(): AppState {
  return {
    rootId: "root",
    nodes: {
      root: node("root"),
      placed: node("placed"),
      empty: node("empty"),
      origin: node("origin"),
      flow: node("flow"),
      painted: node("painted", { "m3e:style": JSON.stringify({ fill: "#ff0000", text: "#111111" }), "m3e:bg": "#00ff00" }),
      cleared: node("cleared", { "m3e:style": "{}", "m3e:facet": "document" }),
      broken: node("broken", { "m3e:style": "not-json" }),
      legacy: node("legacy", { "m3e:bg": "#0000ff" }),
    },
    surfaces: {
      [scatterId]: surface(scatterId, "scatter", "scatter", {
        placed: { x: 12, y: 34 },
        empty: {},
        origin: { x: 0, y: 0 },
        flow: { flowCol: 2, flowRow: 1, shape: "diamond" },
        missing: { x: 99, y: 88 },
        blank: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      }),
      [treeId]: surface(treeId, "tree", "tree", {
        placed: { x: 8, y: 9, shape: "rounded" },
        empty: {},
      }),
    },
  };
}

describe("layout records", () => {
  test("座標がある node だけ往復し、空の配置は消える", () => {
    const state = syntheticState();
    const records = layoutRecordsFromAppState(state);
    const placements = records.placements.filter((record) => record.surfaceId === scatterId || record.surfaceId === treeId);

    expect(placements).toEqual<NodePlacementRecord[]>([
      { surfaceId: scatterId, nodeId: "placed", x: 12, y: 34 },
      { surfaceId: scatterId, nodeId: "origin", x: 0, y: 0 },
      { surfaceId: scatterId, nodeId: "flow", flowCol: 2, flowRow: 1, shape: "diamond" },
      { surfaceId: treeId, nodeId: "placed", x: 8, y: 9, shape: "rounded" },
    ]);
    expect(placements.some((record) => record.nodeId === "empty")).toBe(false);
    expect(placements.some((record) => record.nodeId === "missing")).toBe(false);

    const restored = applyLayoutRecords(state, records);
    expect(restored.surfaces?.[scatterId]?.nodeViews).toEqual({
      placed: { x: 12, y: 34 },
      origin: { x: 0, y: 0 },
      flow: { flowCol: 2, flowRow: 1, shape: "diamond" },
    });
    expect(restored.surfaces?.[treeId]?.nodeViews).toEqual({
      placed: { x: 8, y: 9, shape: "rounded" },
    });
    expect(state.surfaces?.[scatterId]?.nodeViews?.empty).toEqual({});
    expect(restored.nodes.placed).toMatchObject({ parentId: "root", text: "placed" });
    expect(restored.rootId).toBe("root");
  });

  test("空の配置レコードを渡しても nodeViews には戻らない", () => {
    const state = syntheticState();
    const restored = applyLayoutRecords(state, {
      placements: [
        { surfaceId: scatterId, nodeId: "placed", x: 3, y: 4 },
        { surfaceId: scatterId, nodeId: "empty" },
        { surfaceId: scatterId, nodeId: "placed" },
      ],
      styles: [],
    });
    expect(restored.surfaces?.[scatterId]?.nodeViews).toEqual({});
    expect(restored.surfaces?.[treeId]?.nodeViews).toEqual({});
  });

  test("空の Style は消え、値がある m3e:style だけ往復する", () => {
    const state = syntheticState();
    const records = layoutRecordsFromAppState(state);
    expect(records.styles).toEqual([
      { nodeId: "painted", style: { fill: "#ff0000", text: "#111111" } },
    ]);

    const restored = applyLayoutRecords(state, records);
    expect(JSON.parse(restored.nodes.painted?.attributes["m3e:style"] ?? "")).toEqual({
      fill: "#ff0000",
      text: "#111111",
    });
    expect(restored.nodes.painted?.attributes["m3e:bg"]).toBe("#00ff00");
    expect(restored.nodes.cleared?.attributes["m3e:style"]).toBeUndefined();
    expect(restored.nodes.cleared?.attributes["m3e:facet"]).toBe("document");
    expect(restored.nodes.broken?.attributes["m3e:style"]).toBeUndefined();
    expect(restored.nodes.legacy?.attributes).toEqual({ "m3e:bg": "#0000ff" });
    expect(state.nodes.cleared?.attributes["m3e:style"]).toBe("{}");
  });
});
