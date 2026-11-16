import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, test } from "vitest";
import { applyChanges, diffState, invertChanges, type RecordChange } from "../../src/shared/map_changes";

const seedPath = path.resolve(__dirname, "../../../install/assets/seeds/core-seed.sqlite");

function loadSeedStates(): Array<{ id: string; state: Record<string, unknown> }> {
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "m3e-map-changes-")), "seed.sqlite");
  fs.copyFileSync(seedPath, copy);
  const db = new Database(copy, { readonly: true });
  const rows = db.prepare("SELECT id, state_json AS stateJson FROM maps").all() as Array<{ id: string; stateJson: string }>;
  db.close();
  return rows.map((row) => ({ id: row.id, state: JSON.parse(row.stateJson) as Record<string, unknown> }));
}

function roundTrip(before: object, after: object): void {
  const forward = diffState(before, after);
  const applied = applyChanges(before, forward);
  expect(applied.ok).toBe(true);
  if (applied.ok) expect(applied.state).toEqual(after);
  const inverse = applyChanges(after, invertChanges(forward));
  expect(inverse.ok).toBe(true);
  if (inverse.ok) expect(inverse.state).toEqual(before);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nodes(state: Record<string, unknown>): Record<string, Record<string, unknown>> {
  return state.nodes as Record<string, Record<string, unknown>>;
}

describe("map changes", () => {
  test("one text edit is one node change on a 20,001 node map", () => {
    const state: Record<string, unknown> = {
      rootId: "root",
      nodes: {
        root: { id: "root", parentId: null, children: [] as string[], text: "root", attributes: {}, link: "" },
      } as Record<string, unknown>,
      links: {},
    };
    const root = nodes(state).root!;
    for (let index = 0; index < 20000; index += 1) {
      const id = `n${index}`;
      (root.children as string[]).push(id);
      nodes(state)[id] = { id, parentId: "root", children: [], text: `Item ${index}`, attributes: {}, link: "" };
    }
    const edited = clone(state);
    nodes(edited).n0!.text = "Item 0 edited";
    const changes = diffState(state, edited);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "node", key: ["n0"], op: "update", before: { text: "Item 0" }, after: { text: "Item 0 edited" } });
    roundTrip(state, edited);
  });

  test("keeps undefined fields distinct from missing fields", () => {
    const before = { rootId: "r", nodes: { r: { id: "r", parentId: null, children: [], text: "a", attributes: {}, extra: undefined } }, links: {} };
    const after = { rootId: "r", nodes: { r: { id: "r", parentId: null, children: [], text: "a", attributes: {} } }, links: {} };
    roundTrip(before, after);
    const missingAttributes = { rootId: "r", nodes: { r: { id: "r", parentId: null, children: [], text: "a" } }, links: {} };
    const emptyAttributes = { rootId: "r", nodes: { r: { id: "r", parentId: null, children: [], text: "a", attributes: {} } }, links: {} };
    roundTrip(missingAttributes, emptyAttributes);
  });

  test("rejects only the touched field", () => {
    const before = { rootId: "r", nodes: { r: { id: "r", parentId: null, children: ["a"], text: "root", attributes: {} }, a: { id: "a", parentId: "r", children: [], text: "a", note: "same", attributes: {} } }, links: {} };
    const after = clone(before);
    nodes(after).a!.text = "edited";
    const current = clone(before);
    nodes(current).a!.text = "other";
    nodes(current).a!.note = "untouched difference";
    const rejected = applyChanges(current, diffState(before, after));
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.conflicts).toEqual([{ kind: "node", key: ["a"], field: "text" }]);
    nodes(current).a!.text = "a";
    const allowed = applyChanges(current, diffState(before, after));
    expect(allowed.ok).toBe(true);
  });

  test("round-trips every shipped seed map and random edits", () => {
    const states = loadSeedStates();
    expect(states.length).toBeGreaterThan(0);
    for (const { state } of states) {
      roundTrip(state, clone(state));
      for (const salt of [1, 2, 3, 4, 5]) roundTrip(state, mutate(clone(state), salt));
    }
  });
});

function mutate(state: Record<string, unknown>, seed: number): Record<string, unknown> {
  let cursor = seed;
  const next = () => {
    cursor = (cursor * 1664525 + 1013904223) % 4294967296;
    return cursor / 4294967296;
  };
  const pick = <T>(items: T[]): T => items[Math.floor(next() * items.length)]!;
  const tree = nodes(state);
  const ids = Object.keys(tree);
  const rootId = String(state.rootId);
  const nonRoot = ids.filter((id) => id !== rootId);
  if (!nonRoot.length) return state;
  const leaves = nonRoot.filter((id) => ((tree[id]!.children as string[]) ?? []).length === 0);
  const target = pick(leaves.length ? leaves : nonRoot);
  tree[target]!.text = `${tree[target]!.text ?? ""} #`;
  tree[target]!.customField = { n: Math.floor(next() * 5) };
  const attributes = (tree[target]!.attributes ?? {}) as Record<string, unknown>;
  tree[target]!.attributes = attributes;
  attributes["m3e:status"] = next() > 0.5 ? "done" : null;
  attributes["count"] = 3;
  const parentId = String(tree[target]!.parentId ?? rootId);
  const parent = tree[parentId]!;
  const children = [...(parent.children as string[])];
  const index = children.indexOf(target);
  if (children.length > 1 && index >= 0) {
    const swap = (index + 1) % children.length;
    const moved = children[index]!;
    children[index] = children[swap]!;
    children[swap] = moved;
    parent.children = children;
  }
  const otherParent = pick(ids.filter((id) => id !== target && !(tree[id]!.children as string[]).includes(target) && id !== parentId));
  if (otherParent && tree[otherParent]!.nodeType !== "alias") {
    parent.children = (parent.children as string[]).filter((id) => id !== target);
    tree[target]!.parentId = otherParent;
    (tree[otherParent]!.children as string[]).push(target);
  }
  const added = `added-${seed}`;
  tree[added] = { id: added, parentId: rootId, children: [], text: "Added", attributes: { fresh: "yes" }, link: "", nodeType: "text" };
  (tree[rootId]!.children as string[]).push(added);
  if (leaves.length > 1) {
    const removed = pick(leaves.filter((id) => id !== target));
    const removedParent = tree[String(tree[removed]!.parentId)]!;
    removedParent.children = (removedParent.children as string[]).filter((id) => id !== removed);
    delete tree[removed];
  }
  const links = (state.links ?? {}) as Record<string, Record<string, unknown>>;
  state.links = links;
  const linkTarget = pick(ids.filter((id) => id !== rootId));
  links[`link-${seed}`] = { id: `link-${seed}`, sourceNodeId: rootId, targetNodeId: linkTarget, label: "relates", attributes: { weight: "1" } };
  const notes = (state.linearNotesByScope ?? {}) as Record<string, string>;
  state.linearNotesByScope = notes;
  notes[rootId] = `linear ${seed}`;
  const surfaces = (state.surfaces ?? {}) as Record<string, Record<string, unknown>>;
  state.surfaces = surfaces;
  surfaces[`surface-${seed}`] = {
    id: `surface-${seed}`,
    scopeId: rootId,
    kind: "tree",
    layout: "tree",
    nodeViews: { [target]: { x: Math.floor(next() * 20), y: 4 } },
  };
  const scopes = (state.scopes ?? {}) as Record<string, Record<string, unknown>>;
  state.scopes = scopes;
  scopes[`scope:${rootId}`] = { id: `scope:${rootId}`, label: "Scope", rootNodeIds: [rootId], relationIds: [], primarySurfaceId: `surface-${seed}` };
  state.annotations = { [`ann-${seed}`]: { id: `ann-${seed}`, kind: "text", x: 1, y: 2, text: "note", fill: "#000", fontSize: 12 } };
  state.customTop = { keep: true, n: seed };
  return state;
}

test("random edits stay proportional to the touched node", () => {
  const [first] = loadSeedStates();
  expect(first).toBeTruthy();
  const edited = clone(first!.state);
  const id = Object.keys(nodes(edited)).find((key) => key !== edited.rootId)!;
  nodes(edited)[id]!.text = "only this";
  const changes = diffState(first!.state, edited);
  expect(changes.filter((change: RecordChange) => change.kind === "node")).toHaveLength(1);
  const applied = applyChanges(first!.state, changes);
  expect(applied.ok).toBe(true);
  if (applied.ok) expect(applied.state).toEqual(edited);
});
