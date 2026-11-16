import path from "path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { applyChanges, diffState, invertChanges } from "../../src/shared/map_changes";

// Acceptance check for the record-change module (phase1-command-commit.md, 不変条件 1-4).
// Owned by the Director: an implementer proposes changes to this file, it does not edit it.

type Bag = Record<string, any>;

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function node(id: string, parentId: string | null, text: string): Bag {
  return { id, parentId, children: [], nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "" };
}

function baseState(): Bag {
  const state: Bag = { rootId: "root", nodes: { root: node("root", null, "Root") } };
  let counter = 0;
  const add = (parent: string, depth: number) => {
    for (let i = 0; i < 4; i += 1) {
      const id = `n${counter += 1}`;
      state.nodes[id] = node(id, parent, `text ${id}`);
      state.nodes[parent].children.push(id);
      if (depth < 2) add(id, depth + 1);
    }
  };
  add("root", 0);
  state.nodes.n1.attributes = { status: "todo", "m3e:edge-label": "because" };
  state.nodes.n2.customUnknownField = { nested: [1, 2, 3] };
  state.links = { l1: { id: "l1", sourceNodeId: "n1", targetNodeId: "n2", relationType: "supports", attributes: { weight: "1" } } };
  state.linearNotesByScope = { "scope:root": "first line\nsecond line" };
  state.scopes = { "scope:root": { id: "scope:root", rootNodeIds: ["root"], primarySurfaceId: "s1" } };
  state.surfaces = { s1: { id: "s1", kind: "tree", layout: "tree", nodeViews: { n1: { x: 10, y: 20 }, n3: {} } } };
  state.annotations = [{ id: "a1", kind: "text", text: "note", x: 1, y: 2 }];
  state.linearTextFontScale = 1.2;
  state.unknownTopLevel = { keep: true };
  return state;
}

function descendants(state: Bag, id: string, out = new Set<string>()): Set<string> {
  out.add(id);
  for (const child of state.nodes[id].children) descendants(state, child, out);
  return out;
}

function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

/** One random edit of the kinds the viewer and MCP make. */
function mutate(state: Bag, random: () => number, step: number): void {
  const ids = Object.keys(state.nodes);
  const nonRoot = ids.filter((id) => id !== state.rootId);
  const kind = Math.floor(random() * 14);
  if (kind === 0 || nonRoot.length < 3) {
    const parent = pick(random, ids);
    const id = `new${step}`;
    if (state.nodes[id]) return;
    state.nodes[id] = node(id, parent, `added ${step}`);
    const list = state.nodes[parent].children;
    list.splice(Math.floor(random() * (list.length + 1)), 0, id);
  } else if (kind === 1) {
    const id = pick(random, nonRoot);
    const gone = descendants(state, id);
    const parent = state.nodes[id].parentId;
    state.nodes[parent].children = state.nodes[parent].children.filter((child: string) => child !== id);
    for (const dead of gone) delete state.nodes[dead];
    for (const [linkId, link] of Object.entries<Bag>(state.links ?? {})) {
      if (gone.has(link.sourceNodeId) || gone.has(link.targetNodeId)) delete state.links[linkId];
    }
    for (const surface of Object.values<Bag>(state.surfaces ?? {})) {
      for (const dead of gone) delete surface.nodeViews?.[dead];
    }
  } else if (kind === 2) {
    state.nodes[pick(random, ids)].text = `renamed ${step}`;
  } else if (kind === 3) {
    const id = pick(random, nonRoot);
    const blocked = descendants(state, id);
    const targets = ids.filter((candidate) => !blocked.has(candidate));
    const target = pick(random, targets);
    const from = state.nodes[id].parentId;
    state.nodes[from].children = state.nodes[from].children.filter((child: string) => child !== id);
    const list = state.nodes[target].children;
    list.splice(Math.floor(random() * (list.length + 1)), 0, id);
    state.nodes[id].parentId = target;
  } else if (kind === 4) {
    const parents = ids.filter((id) => state.nodes[id].children.length > 1);
    if (!parents.length) return;
    const list = state.nodes[pick(random, parents)].children;
    const from = Math.floor(random() * list.length);
    const [moved] = list.splice(from, 1);
    list.splice(Math.floor(random() * (list.length + 1)), 0, moved);
  } else if (kind === 5) {
    const list = state.nodes[pick(random, ids)].children;
    list.reverse();
  } else if (kind === 6) {
    state.nodes[pick(random, ids)].attributes[`key${Math.floor(random() * 3)}`] = `value ${step}`;
  } else if (kind === 7) {
    const target = state.nodes[pick(random, ids)];
    const keys = Object.keys(target.attributes);
    if (keys.length) delete target.attributes[pick(random, keys)];
  } else if (kind === 8) {
    const target = state.nodes[pick(random, ids)];
    target.collapsed = !target.collapsed;
    target.details = `details ${step}`;
    if (random() < 0.5) target.nodeType = target.nodeType === "folder" ? "text" : "folder";
  } else if (kind === 9) {
    state.links ??= {};
    const source = pick(random, ids);
    const target = pick(random, ids.filter((id) => id !== source));
    state.links[`link${step}`] = { id: `link${step}`, sourceNodeId: source, targetNodeId: target, relationType: "relates", attributes: {} };
  } else if (kind === 10) {
    const linkIds = Object.keys(state.links ?? {});
    if (!linkIds.length) return;
    const link = state.links[pick(random, linkIds)];
    if (random() < 0.3) delete state.links[link.id];
    else if (random() < 0.5) link.label = `label ${step}`;
    else link.attributes[`w${step % 2}`] = String(step);
  } else if (kind === 11) {
    state.linearNotesByScope ??= {};
    const key = random() < 0.5 ? "scope:root" : `scope:${pick(random, ids)}`;
    if (random() < 0.2) delete state.linearNotesByScope[key];
    else state.linearNotesByScope[key] = `linear text ${step}`;
  } else if (kind === 12) {
    const surface = state.surfaces.s1;
    const id = pick(random, ids);
    if (random() < 0.3) delete surface.nodeViews[id];
    else surface.nodeViews[id] = { x: step, y: step * 2 };
    if (random() < 0.2) surface.layout = surface.layout === "tree" ? "flow-lr" : "tree";
  } else {
    if (random() < 0.5) state.linearTextFontScale = 1 + step / 100;
    else state.nodes[pick(random, ids)].customUnknownField = { step };
    if (random() < 0.2) state.annotations.push({ id: `ann${step}`, kind: "text", text: `annotation ${step}`, x: step, y: 0 });
    else if (state.annotations.length && random() < 0.2) state.annotations.splice(0, 1);
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as object)) deepFreeze(item);
  }
  return value;
}

/** Inputs are frozen, so any in-place write by the module throws. */
function expectRoundTrip(source: Bag, target: Bag): void {
  const before = deepFreeze(structuredClone(source));
  const after = deepFreeze(structuredClone(target));
  const changes = deepFreeze(diffState(before, after));
  const forward = applyChanges(before, changes);
  expect(forward.ok, JSON.stringify(forward).slice(0, 600)).toBe(true);
  if (forward.ok) expect(forward.state).toEqual(after);
  const backward = applyChanges(after, invertChanges(changes));
  expect(backward.ok, JSON.stringify(backward).slice(0, 600)).toBe(true);
  if (backward.ok) expect(backward.state).toEqual(before);
}

describe("record changes: fidelity and inverse", () => {
  it("round-trips a pure sibling reorder", () => {
    const before = baseState();
    const after = structuredClone(before);
    after.nodes.root.children = ["n1", "n43", "n22", "n64"];
    expect(after.nodes.root.children.slice().sort()).toEqual(before.nodes.root.children.slice().sort());
    expectRoundTrip(before, after);
  });

  it("round-trips random single edits", () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = mulberry(seed);
      const before = baseState();
      for (let warm = 0; warm < seed % 7; warm += 1) mutate(before, random, 1000 + warm);
      const after = structuredClone(before);
      mutate(after, random, seed);
      expectRoundTrip(before, after);
    }
  });

  it("round-trips random batches of edits", () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const random = mulberry(seed * 7919);
      const before = baseState();
      const after = structuredClone(before);
      for (let step = 0; step < 12; step += 1) mutate(after, random, step);
      expectRoundTrip(before, after);
    }
  });

  it("does not mutate its inputs", () => {
    const before = baseState();
    const after = structuredClone(before);
    const random = mulberry(42);
    for (let step = 0; step < 10; step += 1) mutate(after, random, step);
    const frozenBefore = structuredClone(before);
    const changes = diffState(before, after);
    const frozenChanges = structuredClone(changes);
    applyChanges(before, changes);
    expect(before).toEqual(frozenBefore);
    expect(changes).toEqual(frozenChanges);
  });

  it("round-trips every map in the seed database, to an empty map and with random edits", () => {
    const seedPath = path.resolve(__dirname, "../../../install/assets/seeds/core-seed.sqlite");
    const db = new Database(seedPath, { readonly: true, fileMustExist: true });
    const rows = db.prepare("SELECT id, state_json AS stateJson FROM maps").all() as Array<{ id: string; stateJson: string }>;
    db.close();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const state = JSON.parse(row.stateJson) as Bag;
      const root = state.nodes[state.rootId];
      const empty: Bag = { rootId: state.rootId, nodes: { [state.rootId]: { ...structuredClone(root), children: [] } } };
      expectRoundTrip(empty, state);
      const random = mulberry(row.id.length * 131 + rows.indexOf(row));
      const edited = structuredClone(state);
      edited.links ??= {};
      edited.surfaces ??= {};
      edited.surfaces.s1 ??= { id: "s1", kind: "tree", layout: "tree", nodeViews: {} };
      edited.surfaces.s1.nodeViews ??= {};
      edited.annotations ??= [];
      if (!Array.isArray(edited.annotations)) continue;
      const prepared = structuredClone(edited);
      for (let step = 0; step < 15; step += 1) mutate(edited, random, step);
      expectRoundTrip(prepared, edited);
    }
  });
});

describe("record changes: conflicts and size", () => {
  it("rejects a change whose touched field differs in the current state and names it", () => {
    const base = baseState();
    const mine = structuredClone(base);
    mine.nodes.n2.text = "mine";
    const theirs = structuredClone(base);
    theirs.nodes.n2.text = "theirs";
    const result = applyChanges(theirs, diffState(base, mine));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(JSON.stringify(result.conflicts)).toContain("n2");
      expect(JSON.stringify(result.conflicts)).toContain("text");
    }
    expect(theirs.nodes.n2.text).toBe("theirs");
  });

  it("applies a change on top of unrelated changes by another writer", () => {
    const base = baseState();
    const mine = structuredClone(base);
    mine.nodes.n2.text = "mine";
    mine.nodes.n3.attributes.owner = "me";
    const theirs = structuredClone(base);
    theirs.nodes.n5.text = "theirs";
    theirs.nodes.n2.details = "their details on the same node";
    theirs.linearNotesByScope["scope:root"] = "their linear text";
    theirs.links.l1.label = "their label";
    const result = applyChanges(theirs, diffState(base, mine));
    expect(result.ok, JSON.stringify(result).slice(0, 400)).toBe(true);
    if (result.ok) {
      expect(result.state.nodes.n2.text).toBe("mine");
      expect(result.state.nodes.n2.details).toBe("their details on the same node");
      expect(result.state.nodes.n3.attributes.owner).toBe("me");
      expect(result.state.nodes.n5.text).toBe("theirs");
      expect(result.state.linearNotesByScope["scope:root"]).toBe("their linear text");
      expect(result.state.links.l1.label).toBe("their label");
    }
  });

  it("rejects editing a node another writer deleted", () => {
    const base = baseState();
    const mine = structuredClone(base);
    mine.nodes.n3.text = "mine";
    const theirs = structuredClone(base);
    theirs.nodes.n2.children = theirs.nodes.n2.children.filter((id: string) => id !== "n3");
    delete theirs.nodes.n3;
    expect(applyChanges(theirs, diffState(base, mine)).ok).toBe(false);
  });

  it("emits one change for one renamed node in a 20,001-node map", () => {
    const state: Bag = { rootId: "root", nodes: { root: node("root", null, "Root") } };
    for (let g = 0; g < 200; g += 1) {
      const gid = `g${g}`;
      state.nodes[gid] = node(gid, "root", `Group ${g}`);
      state.nodes.root.children.push(gid);
      for (let i = 0; i < 99; i += 1) {
        const id = `${gid}n${i}`;
        state.nodes[id] = node(id, gid, `Item ${g}-${i}`);
        state.nodes[gid].children.push(id);
      }
    }
    const after = structuredClone(state);
    after.nodes.g7n3.text = "renamed";
    const changes = diffState(state, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "node", key: ["g7n3"], op: "update", before: { text: "Item 7-3" }, after: { text: "renamed" } });
    expect(JSON.stringify(changes).length).toBeLessThan(400);
  });
});
