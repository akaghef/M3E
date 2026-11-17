// extractScopeView and scopeViewChanges on synthetic maps.
import { describe, expect, test } from "vitest";
import { applyChanges, diffState } from "../../src/shared/map_changes";
import { extractScopeView, isScopeRoot, scopeViewChanges, ScopeViewError } from "../../src/shared/scope_view";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import type { AppState } from "../../src/shared/types";
import { node, randomMap, scopeRootIds } from "./scope_view_fixture";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { largeScopedMap } = require("../fixtures/scope_view_large_map.js") as { largeScopedMap: () => AppState };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

function owningScope(state: AppState, nodeId: string): string {
  let cursor: string | null = nodeId;
  while (cursor) {
    if (isScopeRoot(state, cursor)) return cursor;
    cursor = state.nodes[cursor]!.parentId;
  }
  return state.rootId;
}

/** Validation errors that only say "an alias points outside the view". The view records those targets. */
function validationErrors(state: AppState, externalTargets: Record<string, unknown> = {}): string[] {
  return RapidMvpModel.fromJSON(state).validate()
    .filter((error) => !Object.keys(externalTargets).some((id) => error.endsWith(`points to missing target: ${id}`)));
}

describe("extractScopeView", () => {
  test.each(SEEDS)("seed %i: every scope of a random map gives a consistent view", (seed) => {
    const full = randomMap(seed);
    const frozen = JSON.stringify(full);
    const fullErrors = validationErrors(full).length;
    for (const scopeRootId of scopeRootIds(full)) {
      const { state, view } = extractScopeView(full, scopeRootId);
      const ancestorIds = view.ancestors.map((ancestor) => ancestor.nodeId);

      expect(state.rootId).toBe(full.rootId);
      expect(view.scopeRootId).toBe(scopeRootId);
      expect(view.totalNodeCount).toBe(Object.keys(full.nodes).length);
      expect(view.loadedNodeCount).toBe(Object.keys(state.nodes).length);

      for (const [id, item] of Object.entries(state.nodes)) {
        const real = full.nodes[id]!;
        if (view.entries[id]) {
          // A nested scope root: its own fields, no contents.
          expect(item).toEqual({ ...real, children: [] });
          expect(view.entries[id]!.childCount).toBe(real.children.length);
          expect(owningScope(full, real.parentId!)).toBe(scopeRootId);
        } else if (ancestorIds.includes(id)) {
          const next = ancestorIds[ancestorIds.indexOf(id) + 1] ?? scopeRootId;
          expect(item).toEqual({ ...real, children: [next] });
          expect(real.children[view.ancestors[ancestorIds.indexOf(id)]!.pathChildIndex]).toBe(next);
        } else {
          // An own node: unchanged, with all its real children present.
          expect(item).toEqual(real);
          expect(owningScope(full, id)).toBe(scopeRootId);
          for (const childId of real.children) expect(state.nodes[childId]).toBeDefined();
        }
      }
      // Nothing that belongs to the scope is missing.
      for (const id of Object.keys(full.nodes)) {
        if (owningScope(full, id) === scopeRootId) expect(state.nodes[id]).toBeDefined();
      }
      // Ancestors run from the map root to the parent of the scope root.
      if (scopeRootId === full.rootId) expect(ancestorIds).toEqual([]);
      else {
        expect(ancestorIds[0]).toBe(full.rootId);
        expect(ancestorIds[ancestorIds.length - 1]).toBe(full.nodes[scopeRootId]!.parentId);
      }

      // Counts are the real ones.
      const descendants = (id: string): number => full.nodes[id]!.children.reduce((sum, child) => sum + 1 + descendants(child), 0);
      expect(view.scopeDescendantCount).toBe(descendants(scopeRootId));
      for (const [id, entry] of Object.entries(view.entries)) expect(entry.descendantCount).toBe(descendants(id));
      for (const ancestor of view.ancestors) {
        expect(ancestor.descendantCount).toBe(descendants(ancestor.nodeId));
        expect(ancestor.childCount).toBe(full.nodes[ancestor.nodeId]!.children.length);
        expect(ancestor.isScope).toBe(isScopeRoot(full, ancestor.nodeId));
      }

      // GraphLinks: both endpoints loaded, the others counted.
      const kept = Object.keys(state.links ?? {});
      for (const id of kept) {
        expect(state.nodes[state.links![id]!.sourceNodeId]).toBeDefined();
        expect(state.nodes[state.links![id]!.targetNodeId]).toBeDefined();
      }
      expect(kept.length + view.omittedLinks).toBe(Object.keys(full.links ?? {}).length);
      for (const link of Object.values(full.links ?? {})) {
        if (state.nodes[link.sourceNodeId] && state.nodes[link.targetNodeId]) expect(state.links![link.id]).toEqual(link);
      }

      // Alias targets outside the view are recorded with their label; outside references too.
      for (const item of Object.values(state.nodes)) {
        if (item.nodeType !== "alias" || state.nodes[item.targetNodeId!]) continue;
        expect(view.externalAliasTargets[item.targetNodeId!]).toEqual({ text: full.nodes[item.targetNodeId!]!.text });
      }
      for (const item of Object.values(full.nodes)) {
        if (item.nodeType === "alias" && !state.nodes[item.id] && state.nodes[item.targetNodeId!]) {
          expect(view.outsideReferences[item.targetNodeId!]!.aliases).toBeGreaterThan(0);
        }
      }
      for (const link of Object.values(full.links ?? {})) {
        if (state.links![link.id]) continue;
        for (const end of [link.sourceNodeId, link.targetNodeId]) {
          if (state.nodes[end]) expect(view.outsideReferences[end]!.links).toBeGreaterThan(0);
        }
      }

      // Scope settings, Surface View, linear-text and annotations of this scope only.
      expect(Object.keys(state.scopes ?? {})).toEqual([`scope:${scopeRootId}`]);
      expect(Object.keys(state.surfaces ?? {})).toEqual([`surface:${scopeRootId}:tree`]);
      for (const id of Object.keys(state.surfaces![`surface:${scopeRootId}:tree`]!.nodeViews ?? {})) expect(state.nodes[id]).toBeDefined();
      expect(state.linearNotesByScope).toEqual({ [scopeRootId]: `memo of ${scopeRootId}` });
      expect(Object.keys(state.annotations ?? {})).toEqual([`an_${scopeRootId}`]);
      expect(state.linearTextFontScale).toBe(1);

      // Valid as a map on its own, and extracting again changes nothing.
      expect(validationErrors(state, view.externalAliasTargets).length).toBeLessThanOrEqual(fullErrors);
      expect(extractScopeView(state, scopeRootId).state).toEqual(state);
    }
    expect(JSON.stringify(full)).toBe(frozen);
  });

  test("a structured field that the map does not have stays absent", () => {
    const full: AppState = { rootId: "r", nodes: { r: node("r", null, "R") } };
    expect(Object.keys(extractScopeView(full, "r").state)).toEqual(["rootId", "nodes"]);
  });

  test("an unknown node and a node that is not a scope root are told apart", () => {
    const full = randomMap(1);
    const plain = Object.values(full.nodes).find((item) => item.nodeType === "text" && item.id !== "root")!.id;
    expect(() => extractScopeView(full, "missing")).toThrowError(ScopeViewError);
    try { extractScopeView(full, "missing"); } catch (err) { expect((err as ScopeViewError).code).toBe("NODE_NOT_FOUND"); }
    try { extractScopeView(full, plain); } catch (err) { expect((err as ScopeViewError).code).toBe("NOT_A_SCOPE"); }
    expect.assertions(3);
  });

  test("the 20,000-node map: the opened scope loads about 650 nodes", () => {
    const full = largeScopedMap();
    const { state, view } = extractScopeView(full, "S");
    expect(view.totalNodeCount).toBe(20000);
    expect(view.loadedNodeCount).toBe(Object.keys(state.nodes).length);
    expect(view.loadedNodeCount).toBeGreaterThan(600);
    expect(view.loadedNodeCount).toBeLessThanOrEqual(700);
    expect(Object.keys(view.entries)).toHaveLength(30);
  });
});

/** What a viewer in scope view sends for `edit`, applied to the whole map. */
function saveThroughView(full: AppState, scopeRootId: string, edit: (state: AppState) => void): { state: AppState } | { refused: string } | { conflict: true } {
  const { state: base, view } = extractScopeView(full, scopeRootId);
  const edited = clone(base);
  edit(edited);
  const mapped = scopeViewChanges(diffState(base, edited), view, base, edited);
  if (!mapped.ok) return { refused: mapped.reason };
  const applied = applyChanges(full, mapped.changes);
  if (!applied.ok) return { conflict: true };
  expect(RapidMvpModel.fromJSON(applied.state as AppState).validate()).toEqual([]);
  return { state: applied.state as AppState };
}

function scopedMap(): AppState {
  const nodes = {
    root: node("root", null, "Root"),
    before: node("before", "root", "Before"),
    S: node("S", "root", "Scope", { nodeType: "folder" }),
    after: node("after", "root", "After"),
    a: node("a", "S", "A"),
    b: node("b", "S", "B"),
    c: node("c", "S", "C"),
    E: node("E", "S", "Nested", { nodeType: "folder" }),
    e1: node("e1", "E", "E one"),
    e2: node("e2", "E", "E two"),
    e3: node("e3", "E", "E three"),
    far: node("far", "after", "Far"),
    farAlias: node("farAlias", "after", "B", { nodeType: "alias", targetNodeId: "b", access: "read", isBroken: false }),
  };
  nodes.root.children = ["before", "S", "after"];
  nodes.S.children = ["a", "b", "c", "E"];
  nodes.E.children = ["e1", "e2", "e3"];
  nodes.after.children = ["far", "farAlias"];
  return {
    rootId: "root",
    nodes,
    links: { out: { id: "out", sourceNodeId: "c", targetNodeId: "far", direction: "forward", style: "default", attributes: {} } },
    scopes: {
      "scope:root": { id: "scope:root", label: "Root", rootNodeIds: ["root"], relationIds: ["out"] },
      "scope:S": { id: "scope:S", label: "Scope", rootNodeIds: ["S"], relationIds: ["out"], primarySurfaceId: "surface:S:tree" },
    },
    surfaces: { "surface:S:tree": { id: "surface:S:tree", scopeId: "scope:S", kind: "tree", layout: "tree", nodeViews: {} } },
  };
}

describe("scopeViewChanges", () => {
  test("edits of loaded nodes reach the whole map and nothing else changes", () => {
    const full = scopedMap();
    const expected = clone(full);
    expected.nodes.a!.text = "A edited";
    expected.nodes.new1 = node("new1", "S", "New");
    const clean = saveThroughView(full, "S", (state) => {
      state.nodes.a!.text = "A edited";
      state.nodes.new1 = node("new1", "S", "New");
      state.nodes.S!.children = ["new1", "c", "b", "a", "E"];
    });
    expected.nodes.S!.children = ["new1", "c", "b", "a", "E"];
    expect(clean).toEqual({ state: expected });
  });

  test("a node moved onto an entry is appended after the entry's real children", () => {
    const full = scopedMap();
    const result = saveThroughView(full, "S", (state) => {
      state.nodes.S!.children = ["b", "c", "E"];
      state.nodes.a!.parentId = "E";
      state.nodes.E!.children = ["a"];
    });
    const expected = clone(full);
    expected.nodes.S!.children = ["b", "c", "E"];
    expected.nodes.a!.parentId = "E";
    expected.nodes.E!.children = ["e1", "e2", "e3", "a"];
    expect(result).toEqual({ state: expected });
  });

  test("a node moved onto an entry keeps its place when its old index equals its index in the trimmed entry", () => {
    // "a" is child 0 of S and becomes child 0 of the trimmed E: without the real child count
    // the Command would carry no index at all and "a" would land among E's first children.
    const full = scopedMap();
    const { state: base, view } = extractScopeView(full, "S");
    const edited = clone(base);
    edited.nodes.S!.children = ["b", "c", "E"];
    edited.nodes.a!.parentId = "E";
    edited.nodes.E!.children = ["a"];
    const mapped = scopeViewChanges(diffState(base, edited), view, base, edited);
    expect(mapped.ok).toBe(true);
    const edge = (mapped as { changes: ReturnType<typeof diffState> }).changes.find((change) => change.kind === "edge" && change.key[0] === "a")!;
    expect(edge.before).toEqual({ parentId: "S", index: 0 });
    expect(edge.after).toEqual({ parentId: "E", index: 3 });
  });

  test("two nodes moved onto an entry, then one moved back out, stay consistent with the map", () => {
    let full = scopedMap();
    const { state: base, view } = extractScopeView(full, "S");
    const send = (before: AppState, after: AppState): void => {
      const mapped = scopeViewChanges(diffState(before, after), view, before, after);
      if (!mapped.ok) throw new Error(mapped.reason);
      const applied = applyChanges(full, mapped.changes);
      if (!applied.ok) throw new Error(`conflict: ${JSON.stringify(applied.conflicts)}`);
      full = applied.state as AppState;
    };
    const first = clone(base);
    first.nodes.S!.children = ["c", "E"];
    first.nodes.a!.parentId = "E";
    first.nodes.b!.parentId = "E";
    first.nodes.E!.children = ["a", "b"];
    send(base, first);
    expect(full.nodes.E!.children).toEqual(["e1", "e2", "e3", "a", "b"]);

    const second = clone(first);
    second.nodes.E!.children = ["b"];
    second.nodes.a!.parentId = "S";
    second.nodes.S!.children = ["a", "c", "E"];
    send(first, second);
    expect(full.nodes.E!.children).toEqual(["e1", "e2", "e3", "b"]);
    expect(full.nodes.S!.children).toEqual(["a", "c", "E"]);
    expect(RapidMvpModel.fromJSON(full).validate()).toEqual([]);
  });

  test("deleting an entry, the opened scope, or a node referenced from outside is refused", () => {
    const full = scopedMap();
    const remove = (id: string) => (state: AppState): void => {
      const parent = state.nodes[state.nodes[id]!.parentId!]!;
      parent.children = parent.children.filter((child) => child !== id);
      delete state.nodes[id];
    };
    expect(saveThroughView(full, "S", remove("E"))).toEqual({ refused: expect.stringContaining("nested scope") });
    expect(saveThroughView(full, "S", remove("b"))).toEqual({ refused: expect.stringContaining("outside the loaded scope") });
    expect(saveThroughView(full, "S", (state) => {
      state.nodes.c!.attributes = {};
      delete state.links!.out;
      remove("c")(state);
    })).toEqual({ refused: expect.stringContaining("outside the loaded scope") });
    expect(saveThroughView(full, "S", remove("S"))).toEqual({ refused: expect.stringContaining("opened scope") });
    // A leaf nobody outside points at can go.
    const result = saveThroughView(full, "S", remove("a"));
    const expected = clone(full);
    delete expected.nodes.a;
    expected.nodes.S!.children = ["b", "c", "E"];
    expect(result).toEqual({ state: expected });
  });

  test("moving a node under an ancestor is refused", () => {
    const full = scopedMap();
    expect(saveThroughView(full, "S", (state) => {
      state.nodes.S!.children = ["b", "c", "E"];
      state.nodes.a!.parentId = "root";
      state.nodes.root!.children = ["S", "a"];
    })).toEqual({ refused: expect.stringContaining("ancestor") });
  });

  test("records the viewer derives for scopes that are not loaded are not sent", () => {
    const full = scopedMap();
    const result = saveThroughView(full, "S", (state) => {
      // What the viewer's own normalisation does on a scope view: records for every loaded
      // scope root, and relationIds counted from the loaded GraphLinks only.
      state.scopes!["scope:root"] = { id: "scope:root", label: "Root", rootNodeIds: ["root"], relationIds: [] };
      state.scopes!["scope:E"] = { id: "scope:E", label: "Nested", rootNodeIds: ["E"], relationIds: [], primarySurfaceId: "surface:E:tree" };
      state.surfaces!["surface:E:tree"] = { id: "surface:E:tree", scopeId: "scope:E", kind: "tree", layout: "tree", nodeViews: {} };
      state.scopes!["scope:S"]!.relationIds = [];
      state.scopes!["scope:S"]!.label = "Scope renamed";
      state.surfaces!["surface:S:tree"]!.kind = "timeline";
    });
    const expected = clone(full);
    expected.scopes!["scope:S"]!.label = "Scope renamed";
    expected.surfaces!["surface:S:tree"]!.kind = "timeline";
    expect(result).toEqual({ state: expected });
  });
});
