import { initialKeys } from "../../src/shared/record_model/order_key";
// Synthetic data for the record store tests. Nothing here comes from a real workspace.

import fs from "fs";
import os from "os";
import path from "path";
import type { MapCommand, RecordChange } from "../../src/shared/map_changes";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import type { SnapshotRecord, SnapshotRow } from "../../src/shared/record_model/types";

export const WS = "ws_record_store";
export const NOW = "2026-11-17T00:00:00.000Z";
export const ISSUER = "acct_tester";
export type Loose = Record<string, unknown>;

export function node(id: string, parentId: string | null, children: string[] = [], more: Loose = {}): Loose {
  return { id, parentId, children, nodeType: "text", text: `text of ${id}`, collapsed: false, details: "", note: "", attributes: {}, link: "", ...more };
}

/** Expected initial parent-edge metadata exposed by a fresh record-store read. */
export function withOrderKeys<T extends Loose>(state: T): T {
  const nodes = state.nodes as Record<string, Loose>;
  for (const parent of Object.values(nodes)) {
    const children = parent.children as string[];
    const keys = initialKeys(children.length);
    children.forEach((id, i) => { if (nodes[id] && nodes[id].edgeOrder === undefined) nodes[id].edgeOrder = keys[i]; });
  }
  return state;
}

/** A state already in the shape the reverse conversion gives (surface ids aside). */
export function richState(prefix = ""): Loose {
  const p = (id: string): string => prefix + id;
  return withOrderKeys({
    rootId: p("root"),
    futureTopLevel: [1, 2],
    linearTextFontScale: 1.1,
    linearPanelWidth: 300,
    nodes: {
      [p("root")]: node(p("root"), null, [p("f1"), p("leaf"), p("img")], { collapsed: true, details: "d", note: "n", link: "l" }),
      [p("f1")]: node(p("f1"), p("root"), [p("inner"), p("al")], { nodeType: "folder", attributes: { k: "v", empty: "", "m3e:edge-label": "into f1" } }),
      [p("leaf")]: node(p("leaf"), p("root"), [], { createdAt: "2026-01-01", type: "legacy" }),
      [p("img")]: node(p("img"), p("root"), [], { nodeType: "image" }),
      [p("inner")]: node(p("inner"), p("f1")),
      [p("al")]: node(p("al"), p("f1"), [], { nodeType: "alias", targetNodeId: p("leaf"), aliasLabel: "L", access: "write", targetSnapshotLabel: "s" }),
    },
    links: {
      [p("l1")]: { id: p("l1"), sourceNodeId: p("leaf"), targetNodeId: p("inner"), relationType: "detail", label: "x", direction: "both", style: "soft", color: "#0f0", sourcePort: "left", targetPort: "bottom", attributes: { a: "1" }, future: true },
      [p("l2")]: { id: p("l2"), sourceNodeId: p("img"), targetNodeId: p("inner") },
    },
    annotations: {
      [p("a1")]: { id: p("a1"), kind: "pen", scopeId: p("f1"), d: "M0 0", points: [{ x: 0, y: 1 }], stroke: "#000", strokeWidth: 1, opacity: 0.3, createdAt: "t" },
      [p("a2")]: { id: p("a2"), kind: "text", scopeId: p("leaf"), x: 1, y: 2, text: "t", fill: "#fff", fontSize: 10, fontWeight: 600, variant: "label", custom: "c" },
    },
    scopes: {
      [`scope:${p("root")}`]: { id: `scope:${p("root")}`, label: `text of ${p("root")}`, rootNodeIds: [p("root")], relationIds: [], primarySurfaceId: p("sf1") },
      [`scope:${p("f1")}`]: { id: `scope:${p("f1")}`, label: `text of ${p("f1")}`, rootNodeIds: [p("f1")], relationIds: [] },
    },
    surfaces: {
      [p("sf1")]: { id: p("sf1"), scopeId: `scope:${p("root")}`, kind: "scatter", layout: "scatter", surfaceView: { direction: "left", space: "tight" }, nodeViews: { [p("leaf")]: { x: 1, y: 2 }, [p("f1")]: { flowCol: 0, flowRow: 3, shape: "rounded" } } },
      [p("sf2")]: { id: p("sf2"), scopeId: `scope:${p("f1")}`, kind: "tree", layout: "tree" },
    },
    linearNotesByScope: { [p("root")]: "root text", [p("f1")]: "f1 text", [p("leaf")]: "kept", "no such": "kept too" },
  });
}

/** A map of `groups` folders with `perGroup` leaves each (plus the root). */
export function bigState(groups: number, perGroup: number, prefix = "b"): Loose {
  const nodes: Loose = {};
  const groupIds: string[] = [];
  for (let g = 0; g < groups; g += 1) {
    const groupId = `${prefix}g${String(g).padStart(4, "0")}`;
    groupIds.push(groupId);
    const children: string[] = [];
    for (let i = 0; i < perGroup; i += 1) {
      const id = `${groupId}n${String(i).padStart(4, "0")}`;
      children.push(id);
      nodes[id] = node(id, groupId, [], i % 7 === 0 ? { details: `details of ${id}`, attributes: { "m3e:status": "open" } } : {});
    }
    nodes[groupId] = node(groupId, `${prefix}root`, children);
  }
  nodes[`${prefix}root`] = node(`${prefix}root`, null, groupIds);
  return { rootId: `${prefix}root`, nodes };
}

export function snapshotOf(rows: SnapshotRow[], workspaceId = WS): SnapshotRecord[] {
  return toSnapshot(workspaceId, rows, { now: NOW });
}

export function tempDir(name: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `m3e-record-store-${name}-`));
}

let commandCounter = 0;

export function command(changes: RecordChange[], intent = "test", commandId?: string): MapCommand {
  commandCounter += 1;
  return { commandId: commandId ?? `cmd-${commandCounter}`, actor: { kind: "human", id: "tester" }, intent, changes };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** One random, valid edit of a map state, in place. */
export function randomEdit(state: Loose, random: () => number, counter: { n: number }): void {
  const nodes = state.nodes as Record<string, Loose>;
  const ids = Object.keys(nodes);
  const pick = (): string => ids[Math.floor(random() * ids.length)];
  const nonRoot = (): string | undefined => ids.filter((id) => id !== state.rootId)[Math.floor(random() * (ids.length - 1))];
  const descends = (id: string, ancestor: string): boolean => {
    for (let at: unknown = id; typeof at === "string"; at = nodes[at]?.parentId) if (at === ancestor) return true;
    return false;
  };
  const choice = Math.floor(random() * 12);
  if (choice === 0) nodes[pick()].text = `t${counter.n++}`;
  else if (choice === 1) nodes[pick()].details = random() < 0.5 ? "" : `d${counter.n++}`;
  else if (choice === 2) {
    const id = `x${counter.n++}`;
    const parent = pick();
    if (nodes[parent].nodeType === "alias") return;
    nodes[id] = node(id, parent);
    const children = nodes[parent].children as string[];
    children.splice(Math.floor(random() * (children.length + 1)), 0, id);
  } else if (choice === 3) {
    const id = nonRoot();
    const parent = pick();
    if (!id || descends(parent, id) || nodes[parent].nodeType === "alias") return;
    const old = nodes[nodes[id].parentId as string];
    old.children = (old.children as string[]).filter((child) => child !== id);
    const children = nodes[parent].children as string[];
    children.splice(Math.floor(random() * (children.length + 1)), 0, id);
    nodes[id].parentId = parent;
  } else if (choice === 4) {
    const id = nonRoot();
    if (!id || (nodes[id].children as string[]).length > 0) return;
    const old = nodes[nodes[id].parentId as string];
    old.children = (old.children as string[]).filter((child) => child !== id);
    delete nodes[id];
  } else if (choice === 5) {
    const id = pick();
    if (nodes[id].nodeType === "alias" || nodes[id].nodeType === "image") return;
    nodes[id].nodeType = nodes[id].nodeType === "folder" ? "text" : "folder";
  } else if (choice === 6) {
    const id = pick();
    const attributes = { ...(nodes[id].attributes as Loose) };
    if (random() < 0.5) attributes["m3e:edge-label"] = `label${counter.n++}`;
    else if (random() < 0.5) delete attributes["m3e:edge-label"];
    else attributes[`k${Math.floor(random() * 3)}`] = `v${counter.n++}`;
    nodes[id].attributes = attributes;
  } else if (choice === 7) {
    const surfaces = (state.surfaces ??= {}) as Record<string, Loose>;
    const surface = (surfaces.sf1 ??= { id: "sf1", scopeId: `scope:${String(state.rootId)}`, kind: "scatter", layout: "scatter" });
    surface.nodeViews = { ...((surface.nodeViews as Loose) ?? {}), [pick()]: { x: counter.n++, y: 1 } };
  } else if (choice === 8) {
    const children = [...(nodes[pick()].children as string[])];
    if (children.length < 2) return;
    children.push(children.shift() as string);
    nodes[nodes[children[0]].parentId as string].children = children;
  } else if (choice === 9) {
    const notes = { ...((state.linearNotesByScope as Loose) ?? {}) };
    notes[pick()] = random() < 0.3 ? "" : `note${counter.n++}`;
    state.linearNotesByScope = notes;
  } else if (choice === 10) {
    const links = { ...((state.links as Loose) ?? {}) };
    const id = `link${Math.floor(random() * 4)}`;
    if (links[id] && random() < 0.5) delete links[id];
    else links[id] = { id, sourceNodeId: pick(), targetNodeId: pick(), label: `l${counter.n++}` };
    state.links = links;
  } else if (random() < 0.5) {
    // Put a child of a scope root outside that scope, or back inside (record-schema DA59).
    const id = nonRoot();
    const parent = id ? nodes[nodes[id].parentId as string] : undefined;
    if (!id || !parent || parent.nodeType !== "folder") return;
    if (nodes[id].edgeOutsideScope === true) delete nodes[id].edgeOutsideScope;
    else nodes[id].edgeOutsideScope = true;
  } else {
    state.linearPanelWidth = 200 + counter.n++;
  }
}

/** Deterministic pseudo-random numbers in [0, 1). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

