import { describe, expect, test } from "vitest";
import {
  assembleScopeSurface,
  extractScopeSurfaceRecords,
  type ScopeSurfaceRecords,
  type ScopeSurfaceState,
} from "../../../src/cutover/scope-surface/records";

const saved: ScopeSurfaceState = {
  scopes: {
    "scope:root": {
      id: "scope:root",
      label: "Root",
      rootNodeIds: ["root"],
      relationIds: [],
      primarySurfaceId: "surface:root:tree",
    },
    "scope:mammals": {
      id: "scope:mammals",
      label: "Mammals",
      rootNodeIds: ["mammals", "marker"],
      relationIds: ["link-whale-calf", "link-note"],
      primarySurfaceId: "surface:mammals:lane",
    },
    "scope:legacy": {
      id: "scope:legacy-id",
      label: "",
      rootNodeIds: ["whale"],
      relationIds: ["link-whale-calf"],
    },
  },
  surfaces: {
    "surface:root:tree": {
      id: "surface:root:tree",
      scopeId: "scope:root",
      kind: "tree",
      layout: "tree",
      surfaceView: { direction: "left/right", space: "normal" },
      nodeViews: {
        root: { x: 0, y: 12 },
        whale: { x: 40, y: 18, shape: "rounded" },
      },
    },
    "surface:mammals:lane": {
      id: "surface:mammals:lane",
      scopeId: "scope:mammals",
      kind: "lane",
      layout: "lane",
      surfaceView: { direction: "right", space: "tight" },
      nodeViews: {
        mammals: { flowCol: 0, flowRow: 1, shape: "rect" },
        whale: {},
      },
    },
    "surface:orphan:system": {
      id: "surface:orphan:system",
      scopeId: "scope:missing",
      kind: "system",
      layout: "flow-lr",
    },
  },
};

const tree = {
  rootId: "root",
  nodes: {
    root: { id: "root", parentId: null, children: ["mammals"] },
    mammals: { id: "mammals", parentId: "root", children: ["whale"] },
    whale: { id: "whale", parentId: "mammals", children: ["calf"] },
    calf: { id: "calf", parentId: "whale", children: [] },
    marker: { id: "marker", parentId: "calf", children: [] },
  },
};

describe("scope と surface の保存形", () => {
  test("scope と surface が保存形へ戻る", () => {
    const records = extractScopeSurfaceRecords(saved);
    const again = assembleScopeSurface(records);

    expect(again).toEqual(saved);
    expect(Object.keys(again.scopes ?? {})).toEqual(["scope:root", "scope:mammals", "scope:legacy"]);
    expect(Object.keys(again.surfaces ?? {})).toEqual([
      "surface:root:tree",
      "surface:mammals:lane",
      "surface:orphan:system",
    ]);
    expect(again.scopes?.["scope:mammals"]?.rootNodeIds).toEqual(["mammals", "marker"]);
    expect(again.scopes?.["scope:mammals"]?.relationIds).toEqual(["link-whale-calf", "link-note"]);
    expect(again.scopes?.["scope:legacy"]?.primarySurfaceId).toBeUndefined();
    expect(again.surfaces?.["surface:orphan:system"]?.surfaceView).toBeUndefined();
    expect(again.surfaces?.["surface:orphan:system"]?.nodeViews).toBeUndefined();
    expect(again.surfaces?.["surface:root:tree"]?.nodeViews?.root).toEqual({ x: 0, y: 12 });
    expect(again.surfaces?.["surface:mammals:lane"]?.nodeViews?.whale).toEqual({});
  });

  test("空の辞書と欠落は別の保存形として往復する", () => {
    expect(assembleScopeSurface(extractScopeSurfaceRecords({}))).toEqual({});
    expect(assembleScopeSurface(extractScopeSurfaceRecords({ scopes: {}, surfaces: {} }))).toEqual({
      scopes: {},
      surfaces: {},
    });
  });

  test("node の親子は scope と surface のレコードに入らない", () => {
    const mixed = {
      ...tree,
      scopes: saved.scopes,
      surfaces: saved.surfaces,
      links: {
        "link-whale-calf": { id: "link-whale-calf", sourceNodeId: "whale", targetNodeId: "calf" },
      },
    };
    const dirtyScope = {
      ...saved.scopes!["scope:mammals"]!,
      parentId: "root",
      children: ["whale", "calf"],
    };
    const dirtySurface = {
      ...saved.surfaces!["surface:root:tree"]!,
      parentId: "root",
      children: ["mammals"],
      nodeViews: {
        whale: { x: 40, y: 18, shape: "rounded" as const, parentId: "mammals", children: ["calf"] },
      },
    };
    const records = extractScopeSurfaceRecords({
      ...mixed,
      scopes: { ...saved.scopes, "scope:mammals": dirtyScope },
      surfaces: { ...saved.surfaces, "surface:root:tree": dirtySurface },
    });
    const packed = JSON.stringify(records);

    expect(packed).not.toContain("parentId");
    expect(packed).not.toContain("children");
    expect(records.scopeRoots.map((row) => row.nodeId)).not.toContain("calf");
    expect(records.surfaceNodeViews.map((row) => row.nodeId)).not.toContain("calf");
    expect(records.scopeRoots.map((row) => row.nodeId)).toEqual(["root", "mammals", "marker", "whale"]);
    expect(records.scopeRoots.every((row) => !("parentId" in row) && !("childId" in row))).toBe(true);
    expect(records.scopeRelations.every((row) => row.relationId.startsWith("link-"))).toBe(true);
    expect(records.surfaceNodeViews.find((row) => row.nodeId === "whale")).toEqual({
      surfaceKey: "surface:root:tree",
      nodeId: "whale",
      x: 40,
      y: 18,
      shape: "rounded",
    });

    const assembled = assembleScopeSurface(records);
    expect(Object.keys(assembled).sort()).toEqual(["scopes", "surfaces"]);
    expect(JSON.stringify(assembled)).not.toContain("parentId");
    expect(JSON.stringify(assembled)).not.toContain("children");
    expect(assembled.scopes?.["scope:mammals"]?.rootNodeIds).toEqual(["mammals", "marker"]);
    expect(tree.nodes.whale).toEqual({ id: "whale", parentId: "mammals", children: ["calf"] });
    expect(tree.nodes.mammals.children).toEqual(["whale"]);
  });

  test("親子の付け替えは scope の列挙を変えない", () => {
    const underMammals = extractScopeSurfaceRecords({
      ...saved,
      nodes: {
        whale: { parentId: "mammals", children: ["calf"] },
        calf: { parentId: "whale", children: [] },
      },
    });
    const underRoot = extractScopeSurfaceRecords({
      ...saved,
      nodes: {
        whale: { parentId: "root", children: [] },
        calf: { parentId: "root", children: ["whale"] },
      },
    });

    expect(underRoot).toEqual(underMammals);
    expect(underMammals.scopeRoots.some((row) => row.scopeKey === "scope:mammals" && row.nodeId === "whale")).toBe(false);
    expect(underMammals.scopeRoots.some((row) => row.scopeKey === "scope:legacy" && row.nodeId === "whale")).toBe(true);
  });

  test("列挙の順序は order で戻り、入力配列は残る", () => {
    const rootNodeIds = Object.freeze(["mammals", "marker"]);
    const records = extractScopeSurfaceRecords({
      scopes: {
        "scope:mammals": {
          id: "scope:mammals",
          label: "Mammals",
          rootNodeIds,
          relationIds: ["link-note", "link-whale-calf"],
        },
      },
    });
    const reversed: ScopeSurfaceRecords = {
      ...records,
      scopeRoots: [...records.scopeRoots].reverse().map((row, index) => ({ ...row, order: index })),
      scopeRelations: [...records.scopeRelations].reverse().map((row, index) => ({ ...row, order: index })),
    };
    const assembled = assembleScopeSurface(reversed);

    expect(rootNodeIds).toEqual(["mammals", "marker"]);
    expect(assembled.scopes?.["scope:mammals"]?.rootNodeIds).toEqual(["marker", "mammals"]);
    expect(assembled.scopes?.["scope:mammals"]?.relationIds).toEqual(["link-whale-calf", "link-note"]);
    expect(saved.scopes?.["scope:mammals"]?.relationIds).toEqual(["link-whale-calf", "link-note"]);
  });

  test("欠落した辞書へレコードを戻すことはできない", () => {
    const records = extractScopeSurfaceRecords(saved);
    expect(() => assembleScopeSurface({ ...records, scopesPresent: false })).toThrow(/scopes are absent/);
    expect(() => assembleScopeSurface({ ...records, surfacesPresent: false, scopesPresent: true, scopes: [], scopeRoots: [], scopeRelations: [] })).toThrow(/surfaces are absent/);
  });
});
