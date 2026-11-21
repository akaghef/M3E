// Bands, projection, write-back, link-to-entity, promotion, named snapshots and retention.
// Synthetic maps only. Removing a feature fails the case that names it.

import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { M3eMcpService } from "../../src/node/mcp_service";
import { decodeRecord, encodeRecord } from "../../src/node/neo4j_store/encoding";
import { diffState } from "../../src/shared/map_changes";
import { readBand } from "../../src/shared/record_model/scope_fields";
import type { SnapshotRecord } from "../../src/shared/record_model/types";
import type { AppState } from "../../src/shared/types";
import {
  ARCHIVE_DIR,
  ARCHIVE_INDEX_FILE,
  ARCHIVE_RETENTION_MS,
  JOURNAL_FILE,
  RecordWorkspaceStore,
  snapshotArchiveName,
  type CommitResult,
} from "../../src/node/record_store";
import { activeRecordStore, closeActiveRecordStore } from "../../src/node/record_store/active";
import { applyDelete, commitTimeRefusal } from "../../src/node/record_store/operations";
import { ISSUER, node, snapshotOf, tempDir, type Loose } from "./record_store_helpers";

const MAP = "map_a";
const DAY = 24 * 60 * 60 * 1000;
const openStores: RecordWorkspaceStore[] = [];

afterEach(async () => {
  for (const store of openStores.splice(0)) await store.close();
});

function planeTree(withVia: boolean): Loose {
  const homeChildren = withVia ? ["a", "b", "c", "via"] : ["a", "b", "c"];
  const nodes: Record<string, Loose> = {
    root: node("root", null, ["home", "other"]),
    home: node("home", "root", homeChildren, { nodeType: "folder" }),
    a: node("a", "home", ["d"]),
    d: node("d", "a"),
    b: node("b", "home"),
    c: node("c", "home"),
    other: node("other", "root"),
  };
  if (withVia) nodes.via = node("via", "home", [], { nodeType: "alias", targetNodeId: "d", access: "write" });
  return { rootId: "root", nodes };
}

function relationTree(): Loose {
  return {
    rootId: "root",
    nodes: {
      root: node("root", null, ["A", "B", "C", "D", "aliasA"]),
      A: node("A", "root"),
      B: node("B", "root"),
      C: node("C", "root"),
      D: node("D", "root"),
      aliasA: node("aliasA", "root", [], { nodeType: "alias", targetNodeId: "A", access: "write" }),
    },
    links: {
      ab: { id: "ab", sourceNodeId: "A", targetNodeId: "B", relationType: "m3e:consist-of" },
      ac: { id: "ac", sourceNodeId: "A", targetNodeId: "C", relationType: "m3e:consist-of" },
      bc: { id: "bc", sourceNodeId: "B", targetNodeId: "C", relationType: "m3e:consist-of" },
    },
  };
}

function promoteTree(): Loose {
  return {
    rootId: "root",
    nodes: {
      root: node("root", null, ["home", "other"]),
      home: node("home", "root", ["a", "b", "via"], { nodeType: "folder" }),
      a: node("a", "home"),
      b: node("b", "home"),
      via: node("via", "home", [], { nodeType: "alias", targetNodeId: "other", access: "write" }),
      other: node("other", "root"),
    },
  };
}

function makeStore(name: string, state: Loose): { dir: string; store: RecordWorkspaceStore } {
  const dir = path.join(tempDir(name), "store");
  RecordWorkspaceStore.create(dir, snapshotOf([{ id: MAP, state }]));
  const store = RecordWorkspaceStore.open(dir);
  openStores.push(store);
  return { dir, store };
}

function stateOf(store: RecordWorkspaceStore): Loose {
  return store.getMapRow(MAP).state as unknown as Loose;
}

function nodesOf(state: Loose): Record<string, Loose> {
  return state.nodes as Record<string, Loose>;
}

function accepted(result: CommitResult): Extract<CommitResult, { ok: true }> {
  if (!result.ok) throw new Error(`${result.code} ${result.message ?? ""}`);
  return result;
}

function refused(result: CommitResult, code: "INVALID_STATE" | "INVALID_COMMAND" | "CONFLICT" | "NOT_FOUND", pattern: RegExp): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe(code);
  expect(result.message ?? "").toMatch(pattern);
}

function commit(store: RecordWorkspaceStore, intent: string, change: (state: Loose) => void): CommitResult {
  const before = stateOf(store);
  const after = JSON.parse(JSON.stringify(before)) as Loose;
  change(after);
  return store.commitMapCommand(MAP, {
    commandId: `cmd-${intent}-${store.seq() + 1}`,
    actor: { kind: "human", id: "tester" },
    intent,
    changes: diffState(before, after),
  }, ISSUER);
}

function move(state: Loose, id: string, parentId: string): void {
  const nodes = nodesOf(state);
  const item = nodes[id];
  const old = nodes[String(item.parentId)];
  old.children = (old.children as string[]).filter((child) => child !== id);
  item.parentId = parentId;
  (nodes[parentId].children as string[]).push(id);
}

function childTargets(state: Loose, id: string): string[] {
  const nodes = nodesOf(state);
  return ((nodes[id]?.children as string[]) ?? []).map((child) => String(nodes[child]?.targetNodeId ?? child));
}

function inside(nodes: Record<string, Loose>, id: string, folderId: string): boolean {
  const seen = new Set<string>();
  let at: string | null = id;
  while (at && !seen.has(at)) {
    if (at === folderId) return true;
    seen.add(at);
    const parent = nodes[at]?.parentId;
    at = typeof parent === "string" ? parent : null;
  }
  return false;
}

function aliasId(state: Loose, entity: string, parentEntity: string | null): string {
  const nodes = nodesOf(state);
  const folders = Object.values((state.scopes ?? {}) as Record<string, Loose>)
    .filter((scope) => (scope.projection as Loose | undefined)?.mode === "work")
    .map((scope) => (scope.rootNodeIds as string[] | undefined)?.[0])
    .filter((id): id is string => typeof id === "string");
  const matches = Object.values(nodes).filter((item) => {
    if (item.nodeType !== "alias" || item.targetNodeId !== entity) return false;
    const parent = item.parentId ? nodes[String(item.parentId)] : undefined;
    if (parentEntity === null) return parent?.nodeType !== "alias";
    return parent?.nodeType === "alias" && parent.targetNodeId === parentEntity;
  });
  const onPlane = matches.filter((item) => folders.some((folder) => inside(nodes, String(item.id), folder)));
  const found = (onPlane.length ? onPlane : matches)[0];
  if (!found) throw new Error(`no alias of ${entity} under ${parentEntity ?? "the plane"}`);
  return String(found.id);
}

function work(state: Loose, label: string): { key: string; scope: Loose; folderId: string } {
  const scopes = (state.scopes ?? {}) as Record<string, Loose>;
  const key = Object.keys(scopes).find((id) => (scopes[id]?.projection as Loose | undefined)?.mode === "work" && scopes[id]?.label === label);
  if (!key) throw new Error(`no work plane ${label}`);
  const scope = scopes[key]!;
  return { key, scope, folderId: (scope.rootNodeIds as string[])[0]! };
}

function scopeByRoot(store: RecordWorkspaceStore, rootNodeId: string): Extract<SnapshotRecord, { kind: "scope" }> {
  const found = store.records().find((record) => record.kind === "scope" && record.rootNodeId === rootNodeId && !record.projection);
  if (!found || found.kind !== "scope") throw new Error(`no scope rooted at ${rootNodeId}`);
  return found;
}

function edgeCount(store: RecordWorkspaceStore): number {
  return store.records().filter((record) => record.kind === "connection" && record.type === "edge").length;
}

function linkPairs(state: Loose): string[] {
  return Object.values((state.links ?? {}) as Record<string, Loose>)
    .map((link) => `${String(link.sourceNodeId)}|${String(link.relationType)}|${String(link.targetNodeId)}`)
    .sort();
}

function archiveIndex(dir: string): { entries: Array<{ file: string; retain?: true; archivedAt: string }> } {
  return JSON.parse(fs.readFileSync(path.join(dir, ARCHIVE_DIR, ARCHIVE_INDEX_FILE), "utf8")) as { entries: Array<{ file: string; retain?: true; archivedAt: string }> };
}

function assertNoAliasTarget(state: Loose, folderId: string): void {
  const nodes = nodesOf(state);
  const walk = (id: string): void => {
    const item = nodes[id];
    if (!item) return;
    if (item.nodeType === "alias") {
      const target = nodes[String(item.targetNodeId)];
      expect(target).toBeTruthy();
      expect(target?.nodeType).not.toBe("alias");
    }
    for (const child of (item.children as string[]) ?? []) walk(child);
  };
  walk(folderId);
}

describe("scope band", () => {
  it("reads an absent band as rapid and refuses a projected or uncommanded deep band", () => {
    const { store } = makeStore("band", planeTree(false));
    const home = scopeByRoot(store, "home");
    expect(home.band).toBeUndefined();
    expect(readBand(undefined)).toBe("rapid");
    expect(readBand(home.band)).toBe("rapid");

    accepted(store.setBand(MAP, ISSUER, { scopeKey: "home", band: "rapid" }));
    expect(scopeByRoot(store, "home").band).toBe("rapid");
    expect(scopeByRoot(store, "root").band).toBeUndefined();

    refused(store.setBand(MAP, ISSUER, { scopeKey: "home", band: "deep" }), "INVALID_COMMAND", /promotion Command/);
    refused(commit(store, "edit", (state) => {
      ((state.scopes as Record<string, Loose>)["scope:home"]!).band = "deep";
    }), "INVALID_STATE", /explicit Command/);

    const projected = accepted(store.project(MAP, ISSUER, { mode: "work", root: "home", label: "Band plane" }));
    const plane = work(stateOf(store), "Band plane");
    expect((plane.scope.projection as Loose).baseSeq).toBe(projected.seq);
    expect(plane.scope.band).toBe("rapid");
    refused(store.setBand(MAP, ISSUER, { scopeKey: plane.folderId, band: "deep" }), "INVALID_COMMAND", /cannot become deep/);
    refused(store.promote(MAP, ISSUER, { scopeKey: plane.folderId, nodes: {}, reason: "no" }), "INVALID_COMMAND", /cannot become deep/);
    refused(commit(store, "edit", (state) => {
      ((state.scopes as Record<string, Loose>)[plane.key]!).band = "deep";
    }), "INVALID_STATE", /cannot become deep/);
  });

  it("shortens retention only when confirmed, and an explicit window can only lengthen the 90-day pass", () => {
    const { dir, store } = makeStore("retention", planeTree(false));
    refused(store.setBand(MAP, ISSUER, { scopeKey: "home", retentionMs: 10 * DAY }), "INVALID_STATE", /Shortening a scope's retention/);
    expect(scopeByRoot(store, "home").retention).toBeUndefined();
    accepted(store.setBand(MAP, ISSUER, { scopeKey: "home", retentionMs: 10 * DAY, confirm: true }));
    expect(scopeByRoot(store, "home").retention).toEqual({ ms: 10 * DAY });
    accepted(store.setBand(MAP, ISSUER, { scopeKey: "home", retentionMs: 40 * DAY, retentionBytes: 1000 }));
    expect(scopeByRoot(store, "home").retention).toEqual({ ms: 40 * DAY, bytes: 1000 });

    const { dir: longDir, store: longStore } = makeStore("retention-long", planeTree(false));
    accepted(longStore.setBand(MAP, ISSUER, { scopeKey: "home", retentionMs: 200 * DAY }));
    longStore.compact();
    const archivedAt = Date.parse(archiveIndex(longDir).entries[0]!.archivedAt);
    expect(longStore.pruneArchive({ now: new Date(archivedAt + ARCHIVE_RETENTION_MS).toISOString() }).deleted).toEqual([]);
    const due = longStore.pruneArchive({ now: new Date(archivedAt + 200 * DAY).toISOString() });
    expect(due.problems).toEqual([]);
    expect(due.deleted.length).toBeGreaterThan(0);
    expect(dir).not.toBe(longDir);
  });
});

describe("work projection", () => {
  it("projects a plane: aliases, parent edges, source order, one alias per parent, no alias-to-alias", () => {
    const { store } = makeStore("plane", planeTree(true));
    const before = Object.keys(nodesOf(stateOf(store))).length;
    accepted(store.project(MAP, ISSUER, { mode: "work", root: "home", label: "Plane" }));
    const state = stateOf(store);
    const plane = work(state, "Plane");
    const homeAlias = aliasId(state, "home", null);
    expect(nodesOf(state)[plane.folderId]?.parentId).toBe("root");
    expect(childTargets(state, homeAlias)).toEqual(["a", "b", "c", "d"]);
    expect(childTargets(state, aliasId(state, "a", "home"))).toEqual(["d"]);
    expect(aliasId(state, "d", "home")).not.toBe(aliasId(state, "d", "a"));
    assertNoAliasTarget(state, plane.folderId);
    expect(Object.values(nodesOf(state)).some((item) => item.targetNodeId === "via")).toBe(false);
    expect(Object.keys(nodesOf(state)).length).toBe(before + 1 + 6);
    const record = store.records().find((item) => item.kind === "scope" && item.rootNodeId === plane.folderId);
    expect(record?.kind).toBe("scope");
    if (record?.kind === "scope") {
      expect(record.band).toBe("rapid");
      expect(record.projection?.mode).toBe("work");
      expect(record.projection?.from).toEqual({ scopeId: scopeByRoot(store, "home").id });
      expect(record.projection?.baseSeq).toBe((plane.scope.projection as Loose).baseSeq);
    }

    accepted(store.project(MAP, ISSUER, { mode: "work", root: "home", depth: 0, label: "Only" }));
    const only = work(stateOf(store), "Only");
    expect(childTargets(stateOf(store), only.folderId)).toEqual(["home"]);

    accepted(store.project(MAP, ISSUER, { mode: "work", root: plane.folderId, label: "Again" }));
    assertNoAliasTarget(stateOf(store), work(stateOf(store), "Again").folderId);
  });

  it("projects a relationType: id order, an alias per parent, and an alias in range points at the entity", () => {
    const { store } = makeStore("relation-project", relationTree());
    accepted(store.project(MAP, ISSUER, { mode: "work", relationType: "m3e:consist-of", entities: ["aliasA", "B", "C"], label: "Parents" }));
    const state = stateOf(store);
    const plane = work(state, "Parents");
    assertNoAliasTarget(state, plane.folderId);
    expect(Object.values(nodesOf(state)).some((item) => item.targetNodeId === "aliasA")).toBe(false);
    const cAliases = Object.values(nodesOf(state)).filter((item) => item.nodeType === "alias" && item.targetNodeId === "C");
    expect(cAliases).toHaveLength(2);
    const parents = cAliases.map((item) => String(nodesOf(state)[String(item.parentId)]?.targetNodeId)).sort();
    expect(parents).toEqual(["A", "B"]);
    const record = store.records().find((item) => item.kind === "scope" && item.projection?.mode === "work" && item.rootNodeId === plane.folderId);
    expect(record?.kind === "scope" && record.projection?.from).toEqual({ relationType: "m3e:consist-of" });
  });
});

describe("observe projection", () => {
  it("stores no alias or parent edge, computes the view, and refuses structural edits and write-back", () => {
    const { store } = makeStore("observe", planeTree(true));
    const nodesBefore = Object.keys(nodesOf(stateOf(store))).length;
    const edgesBefore = edgeCount(store);
    accepted(store.project(MAP, ISSUER, { mode: "observe", root: "home", label: "Watch" }));
    expect(Object.keys(nodesOf(stateOf(store))).length).toBe(nodesBefore);
    expect(edgeCount(store)).toBe(edgesBefore);
    const seen = observeKey(stateOf(store));
    const record = store.records().find((item) => item.kind === "scope" && item.projection?.mode === "observe");
    expect(record?.kind).toBe("scope");
    if (record?.kind !== "scope" || !record.projection) throw new Error("observe scope missing");
    expect(record.projection.baseSeq).toBeUndefined();
    expect(record.projection).not.toHaveProperty("baseSeq");
    const first = store.readProjection(MAP, seen);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.occurrences.map((item) => `${item.parent ?? "-"}>${item.entity}`).sort()).toEqual(
      ["->home", "a>d", "home>a", "home>b", "home>c", "home>d"].sort(),
    );

    accepted(commit(store, "edit", (state) => move(state, "d", "b")));
    const second = store.readProjection(MAP, seen);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.occurrences.some((item) => item.entity === "d" && item.parent === "a")).toBe(false);
    expect(second.occurrences.some((item) => item.entity === "d" && item.parent === "b")).toBe(true);
    refused(store.writeBack(MAP, ISSUER, { scopeKey: seen, reason: "no" }), "INVALID_COMMAND", /work projection/);

    const edge = {
      kind: "connection" as const, type: "edge" as const, id: "e-obs", mapId: MAP,
      source: "a", target: "d", ord: "a0", scopeId: record.id, rev: 1,
    };
    expect(commitTimeRefusal({
      intent: "edit",
      committedAt: "2026-11-22T00:00:00.000Z",
      mapId: MAP,
      ops: [{ op: "put", rk: "connection|e-obs", record: edge }],
      before: () => undefined,
      preimage: [record],
    })).toMatch(/observe projection stores no alias or parent edge/);
  });
});

function observeKey(state: Loose): string {
  const scopes = (state.scopes ?? {}) as Record<string, Loose>;
  const key = Object.keys(scopes).find((id) => (scopes[id]?.projection as Loose | undefined)?.mode === "observe");
  if (!key) throw new Error("no observe projection");
  return key;
}

describe("write-back", () => {
  it("applies the plane mapping, advances baseSeq, and keeps the plane", () => {
    const { store } = makeStore("write-plane", planeTree(false));
    const projected = accepted(store.project(MAP, ISSUER, { mode: "work", root: "home", label: "Work" }));
    let state = stateOf(store);
    const plane = work(state, "Work");
    const homeAlias = aliasId(state, "home", null);
    const aAlias = aliasId(state, "a", "home");
    const bAlias = aliasId(state, "b", "home");
    const cAlias = aliasId(state, "c", "home");
    const dAlias = aliasId(state, "d", "a");
    accepted(commit(store, "edit", (draft) => {
      move(draft, dAlias, bAlias);
      const nodes = nodesOf(draft);
      const siblings = [...(nodes[homeAlias]!.children as string[])];
      nodes[homeAlias]!.children = [siblings[2], siblings[0], siblings[1]];
      nodes.note1 = node("note1", aAlias, [], { text: "note" });
      nodes.note2 = node("note2", aAlias, [], { text: "held" });
      (nodes[aAlias]!.children as string[]).push("note1", "note2");
      nodes.extra = node("extra", aAlias, [], { nodeType: "alias", targetNodeId: "other", access: "write" });
      (nodes[aAlias]!.children as string[]).push("extra");
    }));
    const wrote = accepted(store.writeBack(MAP, ISSUER, {
      scopeKey: plane.folderId,
      reason: "apply the table",
      nodes: { note1: { target: "c" }, note2: "new" },
    }));
    state = stateOf(store);
    expect(nodesOf(state).d?.parentId).toBe("b");
    expect(nodesOf(state).home?.children).toEqual(["c", "a", "b"]);
    expect(nodesOf(state).other?.parentId).toBe("a");
    expect(nodesOf(state).a?.children).toEqual(["other"]);
    expect(nodesOf(state).note1?.nodeType).toBe("alias");
    expect(nodesOf(state).note1?.targetNodeId).toBe("c");
    expect(nodesOf(state).note2?.nodeType).toBe("text");
    expect(nodesOf(state).note2?.parentId).toBe(aAlias);
    expect((work(state, "Work").scope.projection as Loose).baseSeq).toBe(wrote.seq);
    expect(wrote.seq).not.toBe(projected.seq);
    expect(nodesOf(state)[plane.folderId]).toBeTruthy();
    expect(store.records().some((record) => record.kind === "namedSnapshot" && record.reason === "apply the table")).toBe(true);

    accepted(commit(store, "oc1", (draft) => {
      const applied = applyDelete(draft as unknown as AppState, "oc1", cAlias);
      if (!applied.ok) throw new Error(applied.message);
    }));
    accepted(store.writeBack(MAP, ISSUER, { scopeKey: plane.folderId, reason: "removed occurrence" }));
    expect(nodesOf(stateOf(store)).c?.parentId).toBe("home");
    expect((nodesOf(stateOf(store)).home?.children as string[])).toContain("c");

    accepted(commit(store, "oc2", (draft) => {
      const applied = applyDelete(draft as unknown as AppState, "oc2", dAlias);
      if (!applied.ok) throw new Error(applied.message);
    }));
    const dissolved = work(stateOf(store), "Work").scope.projection as Loose;
    expect(dissolved.dissolved).toEqual([{ parent: "b", child: "d" }]);
    const back = accepted(store.writeBack(MAP, ISSUER, { scopeKey: plane.folderId, reason: "dissolve d" }));
    state = stateOf(store);
    expect(nodesOf(state).d?.parentId).toBe("home");
    expect((nodesOf(state).home?.children as string[])).toContain("d");
    expect((nodesOf(state).b?.children as string[]) ?? []).not.toContain("d");
    const after = work(state, "Work").scope.projection as Loose;
    expect(after.dissolved).toBeUndefined();
    expect(after.baseSeq).toBe(back.seq);
    expect(nodesOf(state)[plane.folderId]).toBeTruthy();
  });

  it("applies the relation mapping and does not write sibling order back", () => {
    const { store } = makeStore("write-relation", relationTree());
    accepted(store.project(MAP, ISSUER, { mode: "work", relationType: "m3e:consist-of", root: "A", depth: 1, label: "Rel" }));
    let state = stateOf(store);
    const plane = work(state, "Rel");
    const aAlias = aliasId(state, "A", null);
    expect(childTargets(state, aAlias)).toEqual(["B", "C"]);
    const linksBefore = linkPairs(state);
    const linkIds = Object.keys((state.links ?? {}) as object).sort();
    accepted(commit(store, "edit", (draft) => {
      const children = [...(nodesOf(draft)[aAlias]!.children as string[])];
      nodesOf(draft)[aAlias]!.children = [children[1], children[0]];
    }));
    accepted(store.writeBack(MAP, ISSUER, { scopeKey: plane.folderId, reason: "reorder" }));
    expect(linkPairs(stateOf(store))).toEqual(linksBefore);
    expect(Object.keys((stateOf(store).links ?? {}) as object).sort()).toEqual(linkIds);

    state = stateOf(store);
    const parent = aliasId(state, "A", null);
    accepted(commit(store, "edit", (draft) => {
      const nodes = nodesOf(draft);
      nodes.aliasD = node("aliasD", parent, [], { nodeType: "alias", targetNodeId: "D", access: "write" });
      (nodes[parent]!.children as string[]).push("aliasD");
    }));
    accepted(store.writeBack(MAP, ISSUER, { scopeKey: plane.folderId, reason: "add D" }));
    expect(linkPairs(stateOf(store))).toContain("A|m3e:consist-of|D");

    state = stateOf(store);
    const cAlias = aliasId(state, "C", "A");
    accepted(commit(store, "oc2", (draft) => {
      const applied = applyDelete(draft as unknown as AppState, "oc2", cAlias);
      if (!applied.ok) throw new Error(applied.message);
    }));
    accepted(store.writeBack(MAP, ISSUER, { scopeKey: plane.folderId, reason: "dissolve C" }));
    state = stateOf(store);
    expect(linkPairs(state)).not.toContain("A|m3e:consist-of|C");
    expect(linkPairs(state)).toContain("B|m3e:consist-of|C");
    expect(nodesOf(state).C?.parentId).toBe("root");

    const bAlias = aliasId(state, "B", "A");
    const dAlias = aliasId(state, "D", "A");
    accepted(commit(store, "edit", (draft) => move(draft, bAlias, dAlias)));
    accepted(store.writeBack(MAP, ISSUER, { scopeKey: plane.folderId, reason: "reparent B" }));
    state = stateOf(store);
    expect(linkPairs(state)).not.toContain("A|m3e:consist-of|B");
    expect(linkPairs(state)).toContain("D|m3e:consist-of|B");
    expect(nodesOf(state).B?.parentId).toBe("root");
    expect(nodesOf(state)[plane.folderId]).toBeTruthy();
  });

  it("refuses the whole command when the source changed after baseSeq and keeps the plane edit", () => {
    const { store } = makeStore("conflict", planeTree(false));
    const projected = accepted(store.project(MAP, ISSUER, { mode: "work", root: "home", label: "Work" }));
    const baseSeq = (work(stateOf(store), "Work").scope.projection as Loose).baseSeq;
    expect(baseSeq).toBe(projected.seq);
    accepted(commit(store, "edit", (draft) => move(draft, "d", "b")));
    const dAlias = aliasId(stateOf(store), "d", "a");
    const cAlias = aliasId(stateOf(store), "c", "home");
    accepted(commit(store, "edit", (draft) => move(draft, dAlias, cAlias)));
    refused(store.writeBack(MAP, ISSUER, { scopeKey: work(stateOf(store), "Work").folderId, reason: "too late" }), "CONFLICT", /CONFLICT/);
    const state = stateOf(store);
    expect((work(state, "Work").scope.projection as Loose).baseSeq).toBe(baseSeq);
    expect(nodesOf(state)[dAlias]?.parentId).toBe(cAlias);
    expect(nodesOf(state).d?.parentId).toBe("b");
    expect(nodesOf(state)[work(state, "Work").folderId]).toBeTruthy();
  });
});

describe("link and promotion", () => {
  it("turns a node into an alias of an existing entity and does not write a binding record", () => {
    const { store } = makeStore("link", planeTree(false));
    const kinds = new Set(store.records().map((record) => record.kind));
    const linked = accepted(store.linkToEntity(MAP, ISSUER, { nodeId: "b", targetId: "other" }));
    expect(nodesOf(stateOf(store)).b?.nodeType).toBe("alias");
    expect(nodesOf(stateOf(store)).b?.targetNodeId).toBe("other");
    expect(new Set(store.records().map((record) => record.kind))).toEqual(kinds);
    const again = accepted(store.linkToEntity(MAP, ISSUER, { nodeId: "b", targetId: "other" }));
    expect(again.seq).toBe(linked.seq);
    refused(store.linkToEntity(MAP, ISSUER, { nodeId: "b", targetId: "a" }), "INVALID_COMMAND", /different entity/);
  });

  it("refuses promotion without a choice for every node, then promotes and requires the choice on a later deep create", () => {
    const { dir, store } = makeStore("promote", promoteTree());
    const members = { home: "new" as const, a: "new" as const, b: "new" as const, via: "new" as const };
    refused(store.promote(MAP, ISSUER, { scopeKey: "home", nodes: { a: "new", b: "new", via: "new" }, reason: "missing root" }), "INVALID_COMMAND", /choice for every node/);
    refused(store.promote(MAP, ISSUER, { scopeKey: "home", nodes: { ...members, b: "hold" }, reason: "hold" }), "INVALID_COMMAND", /not committed/);
    refused(store.promote(MAP, ISSUER, { scopeKey: "home", nodes: { ...members, other: "new" }, reason: "extra" }), "INVALID_COMMAND", /not on the scope/);
    refused(store.promote(MAP, ISSUER, { scopeKey: "home", nodes: { ...members, via: { target: "a" } }, reason: "retarget" }), "INVALID_COMMAND", /different entity/);
    const count = Object.keys(nodesOf(stateOf(store))).length;
    const promoted = accepted(store.promote(MAP, ISSUER, { scopeKey: "home", nodes: members, reason: "promote home" }));
    expect(scopeByRoot(store, "home").band).toBe("deep");
    expect(nodesOf(stateOf(store)).via?.nodeType).toBe("alias");
    expect(nodesOf(stateOf(store)).via?.targetNodeId).toBe("other");
    expect(Object.keys(nodesOf(stateOf(store))).length).toBe(count);
    const snap = store.records().find((record) => record.kind === "namedSnapshot");
    expect(snap?.kind).toBe("namedSnapshot");
    if (snap?.kind === "namedSnapshot") {
      expect(snap.seq).toBe(promoted.seq);
      expect(snap.scopeId).toBe(scopeByRoot(store, "home").id);
      const file = snapshotArchiveName(promoted.seq, 2);
      expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, file))).toBe(true);
      expect(archiveIndex(dir).entries.find((entry) => entry.file === file)?.retain).toBe(true);
    }
    refused(store.promote(MAP, ISSUER, { scopeKey: "home", nodes: members, reason: "again" }), "INVALID_COMMAND", /rapid scope/);
    refused(commit(store, "edit", (state) => {
      const nodes = nodesOf(state);
      nodes.n2 = node("n2", "a");
      (nodes.a!.children as string[]).push("n2");
    }), "INVALID_STATE", /new Deep entity or an existing Deep entity/);
    accepted(commit(store, "create-deep", (state) => {
      const nodes = nodesOf(state);
      nodes.n3 = node("n3", "a");
      (nodes.a!.children as string[]).push("n3");
    }));
    accepted(commit(store, "edit", (state) => {
      const nodes = nodesOf(state);
      nodes.al2 = node("al2", "a", [], { nodeType: "alias", targetNodeId: "other", access: "write" });
      (nodes.a!.children as string[]).push("al2");
    }));
    expect(nodesOf(stateOf(store)).al2?.targetNodeId).toBe("other");
  });
});

describe("named snapshot and replay", () => {
  it("keeps a marked file across compaction and the 90-day pass, then drops the mark when the record is deleted", async () => {
    const { dir, store } = makeStore("named", planeTree(false));
    accepted(store.setBand(MAP, ISSUER, { scopeKey: "home", band: "rapid", retentionMs: 40 * DAY, retentionBytes: 2048 }));
    const projected = accepted(store.project(MAP, ISSUER, { mode: "work", root: "home", label: "Work" }));
    const dAlias = aliasId(stateOf(store), "d", "a");
    accepted(commit(store, "oc2", (draft) => {
      const applied = applyDelete(draft as unknown as AppState, "oc2", dAlias);
      if (!applied.ok) throw new Error(applied.message);
    }));
    const named = accepted(store.createNamedSnapshot(MAP, ISSUER, { scopeKey: "home", name: "keep", reason: "retain" }));
    const file = snapshotArchiveName(named.seq, 2);
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, file))).toBe(true);
    expect(archiveIndex(dir).entries.find((entry) => entry.file === file)?.retain).toBe(true);

    const beforeClose = store.records();
    await store.close();
    const replayed = RecordWorkspaceStore.open(dir);
    openStores.push(replayed);
    expect(JSON.stringify(replayed.records())).toBe(JSON.stringify(beforeClose));
    const scope = replayed.records().find((record) => record.kind === "scope" && record.projection?.mode === "work");
    const snap = replayed.records().find((record) => record.kind === "namedSnapshot");
    const home = replayed.records().find((record) => record.kind === "scope" && record.rootNodeId === "home" && !record.projection);
    expect(scope?.kind).toBe("scope");
    expect(home?.kind).toBe("scope");
    if (scope?.kind === "scope") {
      expect(scope.band).toBe("rapid");
      expect(scope.projection?.dissolved).toEqual([{ parent: "a", child: "d" }]);
      expect(scope.projection?.baseSeq).toBe(projected.seq);
    }
    if (home?.kind === "scope") expect(home.retention).toEqual({ ms: 40 * DAY, bytes: 2048 });
    expect(snap?.kind).toBe("namedSnapshot");
    if (snap?.kind === "namedSnapshot") {
      expect(snap).toMatchObject({ name: "keep", seq: named.seq, reason: "retain", mapId: MAP });
      expect(encodeRecord(snap).labels).toContain("NamedSnapshot");
    }
    for (const record of [scope, snap, home]) {
      expect(record).toBeTruthy();
      expect(JSON.stringify(decodeRecord(encodeRecord(record!).props))).toBe(JSON.stringify(record));
    }

    replayed.compact();
    accepted(commit(replayed, "edit", (draft) => { nodesOf(draft).c!.text = "changed"; }));
    replayed.compact();
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, file))).toBe(true);
    expect(archiveIndex(dir).entries.find((entry) => entry.file === file)?.retain).toBe(true);
    const latest = Math.max(...archiveIndex(dir).entries.map((entry) => Date.parse(entry.archivedAt)));
    const dueAt = new Date(latest + ARCHIVE_RETENTION_MS).toISOString();
    const pruned = replayed.pruneArchive({ now: dueAt });
    expect(pruned.problems).toEqual([]);
    expect(pruned.deleted).not.toContain(file);
    expect(pruned.deleted.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, file))).toBe(true);

    const id = snap?.kind === "namedSnapshot" ? snap.id : "";
    refused(replayed.deleteNamedSnapshot(MAP, ISSUER, { id }), "INVALID_STATE", /explicit confirmed Command/);
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, file))).toBe(true);
    accepted(replayed.deleteNamedSnapshot(MAP, ISSUER, { id, confirm: true }));
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, file))).toBe(true);
    expect(archiveIndex(dir).entries.find((entry) => entry.file === file)?.retain).toBeUndefined();
    const dropped = replayed.pruneArchive({ now: dueAt });
    expect(dropped.problems).toEqual([]);
    expect(dropped.deleted).toContain(file);
    expect(fs.existsSync(path.join(dir, ARCHIVE_DIR, file))).toBe(false);
  });
});

describe("mcp entry", () => {
  const saved = { dir: process.env.M3E_STORE_DIR, forbid: process.env.M3E_FORBID_LIVE_DATA };

  afterEach(async () => {
    await closeActiveRecordStore();
    if (saved.dir === undefined) delete process.env.M3E_STORE_DIR;
    else process.env.M3E_STORE_DIR = saved.dir;
    if (saved.forbid === undefined) delete process.env.M3E_FORBID_LIVE_DATA;
    else process.env.M3E_FORBID_LIVE_DATA = saved.forbid;
  });

  it("runs projection, write-back, link, band, promotion and namedSnapshot on the record store", () => {
    process.env.M3E_FORBID_LIVE_DATA = "1";
    const dir = path.join(tempDir("mcp-bands"), "store");
    RecordWorkspaceStore.create(dir, snapshotOf([]));
    process.env.M3E_STORE_DIR = dir;
    const model = new RapidMvpModel("Root");
    const home = model.addNode(model.state.rootId, "home");
    model.setScopeBoundary(home, true);
    const a = model.addNode(home, "a");
    const d = model.addNode(a, "d");
    const b = model.addNode(home, "b");
    const other = model.addNode(model.state.rootId, "other");
    model.saveToSqlite("unused.sqlite", MAP);
    const service = new M3eMcpService({ dbPath: () => "unused.sqlite", feedbackDir: () => path.join(dir, "..", "feedback") });
    const uri = (id: string): string => `m3e://maps/${MAP}/nodes/${encodeURIComponent(id)}`;
    const ctx = service.call("m3e_context", { action: "enter", target: `m3e://maps/${MAP}` });
    expect(ctx.ok).toBe(true);
    const contextId = ctx.context_id as string;

    const projected = service.call("m3e_update", { kind: "project", mode: "work", context_id: contextId, target: uri(home), text: "MCP plane" });
    expect(projected.ok).toBe(true);
    const store = activeRecordStore();
    expect(store).toBeTruthy();
    const state = store!.getMapRow(MAP).state as unknown as Loose;
    const plane = work(state, "MCP plane");
    const dAlias = aliasId(state, d, a);
    const removed = service.call("m3e_delete", { context_id: contextId, target: uri(dAlias), operation: "oc2" });
    expect(removed.ok).toBe(true);
    expect((work(store!.getMapRow(MAP).state as unknown as Loose, "MCP plane").scope.projection as Loose).dissolved).toEqual([{ parent: a, child: d }]);

    const wrote = service.call("m3e_update", { kind: "write-back", context_id: contextId, target: uri(plane.folderId), reason: "from mcp" });
    expect(wrote.ok).toBe(true);
    expect((store!.getMapRow(MAP).state.nodes[d]!).parentId).toBe(home);

    const linked = service.call("m3e_update", { kind: "link-entity", context_id: contextId, target: uri(other), entity: uri(a) });
    expect(linked.ok).toBe(true);
    expect(store!.getMapRow(MAP).state.nodes[other]?.nodeType).toBe("alias");
    expect(store!.getMapRow(MAP).state.nodes[other]?.targetNodeId).toBe(a);

    const deep = service.call("m3e_update", { kind: "set-band", context_id: contextId, target: uri(plane.folderId), band: "deep" });
    expect(deep.ok).toBe(false);
    expect(deep.error.code).toBe("INVALID_OPERATION");

    const missing = service.call("m3e_update", { kind: "promote", context_id: contextId, target: uri(b), reason: "missing", nodes: { [b]: "new" } });
    expect(missing.ok).toBe(false);

    const named = service.call("m3e_update", { kind: "named-snapshot", context_id: contextId, target: uri(home), name: "mcp", reason: "from mcp" });
    expect(named.ok).toBe(true);
    const snap = store!.records().find((record) => record.kind === "namedSnapshot" && record.name === "mcp");
    expect(snap?.kind).toBe("namedSnapshot");
    const unconfirmed = service.call("m3e_update", {
      kind: "delete-named-snapshot", context_id: contextId, target: uri(home), snapshot_id: snap?.kind === "namedSnapshot" ? snap.id : "",
    });
    expect(unconfirmed.ok).toBe(false);
    expect(unconfirmed.error.message).toMatch(/confirmed/);

    const created = service.call("m3e_create", { kind: "node", context_id: contextId, target: uri(home), text: "Fresh", deep: "new" });
    expect(created.ok).toBe(true);
    const line = fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8").trim().split("\n").at(-1) ?? "{}";
    expect(JSON.parse(line).intent).toBe("create-deep");
    const asAlias = service.call("m3e_create", { kind: "node", context_id: contextId, target: uri(home), text: "Alias", deep: { target: uri(a) } });
    expect(asAlias.ok).toBe(true);
    const alias = Object.values(store!.getMapRow(MAP).state.nodes).find((item) => item.text === "Alias");
    expect(alias?.nodeType).toBe("alias");
    expect(alias?.targetNodeId).toBe(a);
  });

  it("refuses the new kinds when the record store is off", () => {
    delete process.env.M3E_STORE_DIR;
    process.env.M3E_FORBID_LIVE_DATA = "1";
    const dir = tempDir("mcp-off");
    const sqlite = path.join(dir, "map.sqlite");
    const model = new RapidMvpModel("Root");
    const child = model.addNode(model.state.rootId, "Child");
    model.saveToSqlite(sqlite, MAP);
    const service = new M3eMcpService({ dbPath: () => sqlite, feedbackDir: () => path.join(dir, "feedback") });
    const ctx = service.call("m3e_context", { action: "enter", target: `m3e://maps/${MAP}` });
    const result = service.call("m3e_update", {
      kind: "project", mode: "work", context_id: ctx.context_id, target: `m3e://maps/${MAP}/nodes/${encodeURIComponent(child)}`,
    });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("INVALID_STATE");
    expect(result.error.message).toMatch(/record store/);
  });
});
