import { translateState } from "../../src/node/record_store/id_alias";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect } from "vitest";
import { diffState, PARENT_EDGE_FIELDS, type RecordChange } from "../../src/shared/map_changes";
import { NODE_FIELDS, LINK_FIELDS, NODE_VIEW_FIELDS } from "../../src/shared/record_model/field_tables";
import { NODE_FIELDS as MIGRATION_NODE_FIELDS } from "../../src/shared/record_model/to_snapshot";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { command, node } from "./record_store_helpers";

// Interface members supplement projection tables: a new viewer field must be covered even
// before its author adds it to the projector. TypeScript parses the actual production source.
const source = ts.createSourceFile("types.ts", fs.readFileSync(path.resolve(import.meta.dirname, "../../src/shared/types.ts"), "utf8"), ts.ScriptTarget.Latest, true);
function fields(name: string): string[] {
  const declaration = source.statements.find(s => ts.isInterfaceDeclaration(s) && s.name.text === name) as ts.InterfaceDeclaration;
  return declaration.members.map(member => member.name!.getText(source));
}
export const viewerFields = {
  node: [...new Set([...NODE_FIELDS, ...MIGRATION_NODE_FIELDS, ...fields("TreeNode")])],
  link: [...new Set([...LINK_FIELDS, ...fields("GraphLink")])],
  scope: fields("MapScope"), surface: fields("MapSurface"), view: [...new Set([...NODE_VIEW_FIELDS, ...fields("SurfaceNodeView")])],
  edge: [...PARENT_EDGE_FIELDS],
};
type Bag = Record<string, any>;
const values: Record<string, Record<string, [any, any]>> = {
  node: {
    id: ["probe", "probe"], parentId: ["folder", "root"], children: [[], ["child"]], edgeOrder: ["a0", "a1"],
    nodeType: [undefined, "image"], scopeId: [undefined, "scope:folder"], edgeOutsideScope: [undefined, true],
    text: ["", "changed"], collapsed: [false, true], details: ["", "body"], note: ["", "note"], link: ["", "https://example.test"],
    attributes: [{}, { a: "value" }], targetNodeId: ["target", "root"], aliasLabel: ["", "alias"], access: ["read", "write"],
    targetSnapshotLabel: ["", "snapshot"], isBroken: [false, true], aliasOf: [undefined, "target"],
    extensions: [[], ["test:nodeType:example@1"]], edgeRelationType: ["", "detail"], edgeAttributes: [{}, { a: "b" }],
    edgeExtensions: [[], ["test:parentEdge:example@1"]], valid: [{}, { from: "2026-01-01" }],
    copyOf: [undefined, { source: "target", seq: 0, mode: "deep", ids: {} }],
  },
  link: {
    id: ["relation", "relation"], sourceNodeId: ["root", "folder"], targetNodeId: ["target", "folder"],
    relationType: [undefined, "detail"], label: ["", "label"], direction: ["none", "both"], style: ["default", "dashed"],
    color: [undefined, "#123456"], sourcePort: ["auto", "left"], targetPort: ["auto", "right"], attributes: [{}, { a: "value" }],
    extensions: [[], ["test:relationEdge:example@1"]],
  },
  scope: { id: ["scope:probe", "scope:probe"], label: ["", "derived"], rootNodeIds: [["probe"], ["probe"]], relationIds: [[], []],
    primarySurfaceId: [undefined, "surface"], band: ["rapid", "rapid"], retention: [{}, { ms: 2592000000 }],
    projection: [undefined, { mode: "work", from: { scopeId: "scope:root" }, range: { root: "root" }, baseSeq: 0, dissolved: [] }],
  },
  surface: { id: ["surface", "surface"], scopeId: ["scope:root", "scope:folder"], kind: ["tree", "scatter"], layout: ["tree", "scatter"],
    surfaceView: [undefined, { direction: "right", space: "normal" }], nodeViews: [{}, { target: { x: 5 } }],
  },
  view: { x: [0, 42], y: [0, 31], flowCol: [0, 2], flowRow: [0, 3], shape: ["rect", "rounded"] },
  edge: { parentId: ["folder", "root"], ord: ["a0", "a1"] },
};
function base(): Bag {
  return { rootId: "root", nodes: { root: node("root", null, ["folder", "target"]), folder: node("folder", "root", [], { nodeType: "folder" }), target: node("target", "root") }, links: {},
    scopes: { "scope:root": { id: "scope:root", label: "text of root", rootNodeIds: ["root"], relationIds: [] }, "scope:folder": { id: "scope:folder", label: "text of folder", rootNodeIds: ["folder"], relationIds: [] } },
    extensionDefs: ["nodeType", "parentEdge", "relationEdge"].map(kind => ({ kind: "extensionDef", name: `test:${kind}:example`, version: 1, target: kind === "nodeType" ? "node" : kind, fields: [] })) };
}
function shaped(kind: keyof typeof viewerFields, field: string, value: any): Bag {
  const state = base();
  if (kind === "node" || kind === "edge" || kind === "scope") {
    const n = state.nodes.probe = node("probe", "folder"); state.nodes.folder.children.push("probe");
    if (kind === "scope") {
      n.nodeType = "folder";
      state.scopes = { ...state.scopes, "scope:probe": { id: "scope:probe", label: n.text, rootNodeIds: ["probe"], relationIds: [], [field]: value } };
      state.surfaces = { surface: { id: "surface", scopeId: "scope:probe", kind: "tree", layout: "tree" } };
    } else {
      n[field === "ord" ? "edgeOrder" : field] = value;
      if (field === "parentId" && value === "root") { state.nodes.folder.children = []; state.nodes.root.children.push("probe"); }
      if (field === "children" && value.length) state.nodes.child = node("child", "probe");
      if (["targetNodeId", "aliasLabel", "access", "targetSnapshotLabel", "isBroken"].includes(field)) {
        n.nodeType = "alias"; n.targetNodeId ??= "target";
        if (field === "isBroken" && value) { n.targetNodeId = "missing"; n.targetSnapshotLabel = "target"; }

      }
    }
  } else if (kind === "link") state.links.relation = { id: "relation", sourceNodeId: "root", targetNodeId: "target", [field]: value };
  else {
    const surface = { id: "surface", scopeId: "scope:root", kind: "tree", layout: "tree" } as Bag;
    state.surfaces = { surface };
    if (kind === "surface") surface[field] = value;
    else surface.nodeViews = { target: { [field]: value } };
  }
  return state;
}
export function exerciseViewerFields(store: RecordWorkspaceStore, prefix: string): void {
  for (const [kind, list] of Object.entries(viewerFields)) for (const field of list) {
    const samples = values[kind]?.[field];
    expect(samples, `Unhandled viewer field ${kind}.${field}: add default/non-default lifecycle coverage`).toBeDefined();
    const mapId = `${prefix}-${kind}-${field}`;
    const rename = (id: string): string => `${mapId}-${id}`;
    const unique = (state: Bag): Bag => translateState(state, { node: rename, graphlink: rename, annotation: rename, surface: rename });
    const seed = unique(base());
    const seeded = store.saveWholeMap(mapId, seed as any, "human");
    expect(seeded, JSON.stringify(seeded)).toMatchObject({ ok: true });
    let before = seed;
    for (const after of [unique(shaped(kind as any, field, samples[0])), unique(shaped(kind as any, field, samples[1])), seed]) {
      const changes: RecordChange[] = diffState(before, after);
      const result = store.commitMapCommand(mapId, command(changes), "human");
      expect.soft(result, `${kind}.${field}: ${JSON.stringify(changes)} -> ${JSON.stringify(result)}`).toMatchObject({ ok: true });
      before = after; // Deliberately NOT store.getMapRow(): this is the viewer's own previous value.
    }
  }
}
