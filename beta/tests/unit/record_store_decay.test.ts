// Decay accumulator, extensionDef default/ref, and the local invariant check.
// Synthetic records in temporary directories only. The formula below is inlined
// so a change to the store's arithmetic fails here.

import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { diffState } from "../../src/shared/map_changes";
import { decodeRecord, encodeRecord } from "../../src/node/neo4j_store/encoding";
import {
  JOURNAL_FILE,
  RecordWorkspaceStore,
  SNAPSHOT_FILE,
  type CommitResult,
} from "../../src/node/record_store";
import { checkInvariants, type InvariantProblem } from "../../src/shared/record_model/invariants";
import { parseSnapshot, sortRecords } from "../../src/shared/record_model/jsonl";
import { NeighbourhoodIndex, type NeighbourOp } from "../../src/shared/record_model/neighbourhood";
import { recordRk } from "../../src/shared/record_model/steady";
import type {
  EdgeConnectionRecord,
  ExtensionDefRecord,
  NodeRecord,
  ScopeRecord,
  SnapshotRecord,
} from "../../src/shared/record_model/types";
import {
  ISSUER,
  WS,
  bigState,
  clone,
  command,
  richState,
  snapshotOf,
  tempDir,
  type Loose,
} from "./record_store_helpers";

const SCALES = [6, 10, 16, 20, 24];
const T0 = "2026-01-01T00:00:00.000Z";
const TPOS = "2026-01-01T00:01:04.000Z";
const T1 = "2026-01-01T00:02:08.000Z";
const T2 = "2026-01-01T00:04:16.000Z";
const TASK = "m3e:nodeType:task@1";
const PERSON = "m3e:nodeType:person@1";

const openStores: RecordWorkspaceStore[] = [];

afterEach(async () => {
  for (const store of openStores.splice(0)) await store.close();
});

let now = T0;

function newDir(name: string, state: Loose = richState(), mapId = "m"): string {
  const dir = path.join(tempDir(name), "store");
  RecordWorkspaceStore.create(dir, snapshotOf([{ id: mapId, state }], WS));
  return dir;
}

function openStore(dir: string): RecordWorkspaceStore {
  const store = RecordWorkspaceStore.open(dir, { now: () => now, compactAfterLines: 0 });
  openStores.push(store);
  return store;
}

function nodesOf(state: Loose): Record<string, Loose> {
  return state.nodes as Record<string, Loose>;
}

function attempt(store: RecordWorkspaceStore, change: (state: Loose) => void, mapId = "m"): CommitResult {
  const before = store.getMapRow(mapId).state as unknown as Loose;
  const after = clone(before);
  change(after);
  const changes = diffState(before, after);
  expect(changes.length).toBeGreaterThan(0);
  return store.commitMapCommand(mapId, command(changes), ISSUER);
}

function commit(store: RecordWorkspaceStore, change: (state: Loose) => void, mapId = "m"): Extract<CommitResult, { ok: true }> {
  const result = attempt(store, change, mapId);
  if (!result.ok) throw new Error(`commit failed: ${result.code} ${result.message ?? ""}`);
  return result;
}

/** v_k(now) = v_k(t) * 2^(-(now-t)/2^k seconds) + 1. A missing previous value is 0. */
function committedValue(previous: readonly number[] | undefined, previousT: string | undefined, at: string): number[] {
  const dt = previousT === undefined ? 0 : (Date.parse(at) - Date.parse(previousT)) / 1000;
  return SCALES.map((k, index) => (previous?.[index] ?? 0) * (dt > 0 ? 2 ** (-dt / 2 ** k) : 1) + 1);
}

/** A read multiplies once and does not add. */
function readValue(stored: readonly number[], storedT: string, at: string): number[] {
  const dt = (Date.parse(at) - Date.parse(storedT)) / 1000;
  return SCALES.map((k, index) => (stored[index] ?? 0) * (dt > 0 ? 2 ** (-dt / 2 ** k) : 1));
}

function decayOf(store: RecordWorkspaceStore, target: string): Extract<SnapshotRecord, { kind: "decay" }> {
  const record = store.records().find((item) => item.kind === "decay" && item.target === target);
  if (!record || record.kind !== "decay") throw new Error(`no decay for ${target}`);
  return record;
}

function replay(snapshotText: string, journalText: string): SnapshotRecord[] {
  const records = parseSnapshot(snapshotText);
  const header = records[0];
  if (header.kind !== "snapshot") throw new Error("missing header");
  const all = new Map<string, SnapshotRecord>();
  for (const record of records.slice(1)) all.set(recordRk(record), record);
  let seq = header.seq;
  for (const lineText of journalText.split("\n")) {
    if (lineText.trim() === "") continue;
    const line = JSON.parse(lineText) as {
      seq: number;
      committedAt: string;
      issuer: string;
      ops: Array<{ op: string; rk: string; record?: SnapshotRecord }>;
    };
    for (const op of line.ops) {
      if (op.op === "delete") all.delete(op.rk);
      else all.set(op.rk, op.record as SnapshotRecord);
    }
    const commitRecord: SnapshotRecord = { kind: "commit", seq: line.seq, committedAt: line.committedAt, issuer: line.issuer };
    all.set(recordRk(commitRecord), commitRecord);
    seq = line.seq;
  }
  return sortRecords([{ kind: "snapshot", format: 2, workspaceId: header.workspaceId, seq }, ...all.values()]);
}

function taskDef(fields: ExtensionDefRecord["fields"]): ExtensionDefRecord {
  return { kind: "extensionDef", name: "m3e:nodeType:task", version: 1, target: "node", fields, rev: 0 };
}

describe("decay accumulator", () => {
  it("stores the formula at committedAt and multiplies once on read", () => {
    now = T0;
    const store = openStore(newDir("formula"));
    commit(store, (state) => {
      nodesOf(state).leaf.text = "one";
      nodesOf(state).img.text = "two";
    });
    const edge = store.records().find((record) => record.kind === "connection" && record.type === "edge" && record.target === "leaf");
    if (!edge || edge.kind !== "connection") throw new Error("leaf has no parent edge");
    const scopeTarget = `scope|${edge.scopeId}`;
    const ones = committedValue(undefined, undefined, T0);
    expect(ones).toEqual([1, 1, 1, 1, 1]);
    for (const target of [`node|leaf`, `node|img`, scopeTarget]) {
      const record = decayOf(store, target);
      expect(record.v).toEqual(ones);
      expect(record.t).toBe(T0);
      expect(store.activityAt(target, T0)).toEqual(readValue(record.v, record.t, T0));
    }
    expect(store.activityAt("node|f1", T0)).toBeUndefined();
    const beforePosition = store.records().filter((record) => record.kind === "decay");

    now = TPOS;
    commit(store, (state) => {
      const surface = Object.values(state.surfaces as Record<string, Loose>).find((item) => item.kind === "scatter");
      const views = surface?.nodeViews as Record<string, Loose>;
      views.leaf = { ...(views.leaf ?? {}), x: 9 };
    });
    expect(store.records().filter((record) => record.kind === "decay")).toEqual(beforePosition);

    now = T1;
    commit(store, (state) => { nodesOf(state).leaf.text = "three"; });
    const leaf = decayOf(store, "node|leaf");
    const scope = decayOf(store, scopeTarget);
    const img = decayOf(store, "node|img");
    const stepped = committedValue(ones, T0, T1);
    expect(leaf.v).toEqual(stepped);
    expect(leaf.t).toBe(T1);
    expect(scope.v).toEqual(stepped);
    expect(scope.t).toBe(T1);
    expect(img.v).toEqual(ones);
    expect(img.t).toBe(T0);
    expect(store.activityAt("node|leaf", T2)).toEqual(readValue(leaf.v, leaf.t, T2));
    expect(store.activityAt(scopeTarget, T2)).toEqual(readValue(scope.v, scope.t, T2));
    expect(store.activityAt("node|img", T2)).toEqual(readValue(img.v, img.t, T2));
  });

  it("survives snapshot replay, compaction and Neo4j encode/decode", async () => {
    now = T0;
    const dir = newDir("roundtrip");
    const store = openStore(dir);
    commit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    now = T1;
    commit(store, (state) => { nodesOf(state).leaf.text = "two"; });
    const live = store.records();
    const rebuilt = replay(
      fs.readFileSync(path.join(dir, SNAPSHOT_FILE), "utf8"),
      fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8"),
    );
    expect(rebuilt).toEqual(live);
    const decay = live.find((record) => record.kind === "decay" && record.target === "node|leaf");
    if (!decay) throw new Error("missing decay");
    expect(decay.v).toEqual(committedValue(committedValue(undefined, undefined, T0), T0, T1));
    const encoded = encodeRecord(decay);
    expect(encoded.labels).toContain("Decay");
    expect(decodeRecord(encoded.props)).toEqual(decay);

    const kept = live.filter((record) => record.kind === "decay");
    store.compact();
    await store.close();
    now = T2;
    const again = openStore(dir);
    expect(again.records().filter((record) => record.kind === "decay")).toEqual(kept);
    const stored = decayOf(again, "node|leaf");
    expect(again.activityAt("node|leaf", T2)).toEqual(readValue(stored.v, stored.t, T2));
    expect(fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8")).toBe("");
  });
});

describe("extensionDef default and ref", () => {
  it("fills a required default inside the command that attaches the extension", () => {
    now = T0;
    const store = openStore(newDir("default"));
    const defined = commit(store, (state) => {
      state.extensionDefs = [taskDef([{ name: "status", type: "enum", required: true, values: ["open", "done"], default: "open" }])];
      nodesOf(state).leaf.extensions = [TASK];
    });
    const leaf = store.records().find((record) => record.kind === "node" && record.id === "leaf");
    expect(leaf).toMatchObject({
      extensions: [TASK],
      attributes: { "m3e:nodeType:task/status": "open" },
      rev: defined.seq,
    });
    expect(nodesOf(store.getMapRow("m").state as unknown as Loose).leaf.attributes).toMatchObject({
      "m3e:nodeType:task/status": "open",
    });
  });

  it("rejects a ref whose node exists without the extension and allows a missing node", () => {
    now = T0;
    const store = openStore(newDir("ref"));
    commit(store, (state) => {
      state.extensionDefs = [
        { kind: "extensionDef", name: "m3e:nodeType:person", version: 1, target: "node", fields: [], rev: 0 },
        taskDef([
          { name: "who", type: "nodeRef", ref: PERSON },
          { name: "team", type: "list<nodeRef>", ref: "m3e:nodeType:person" },
          { name: "note", type: "nodeRef", ref: "node" },
        ]),
      ];
    });
    const refused = attempt(store, (state) => {
      const leaf = nodesOf(state).leaf;
      leaf.extensions = [TASK];
      leaf.attributes = { "m3e:nodeType:task/who": "img" };
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe("INVALID_STATE");
      expect(refused.message ?? "").toMatch(/lacks extension m3e:nodeType:person@1/);
    }
    expect(store.records().some((record) => record.kind === "node" && record.id === "leaf" && record.extensions?.includes(TASK))).toBe(false);

    commit(store, (state) => { nodesOf(state).img.extensions = [PERSON]; });
    const accepted = commit(store, (state) => {
      const leaf = nodesOf(state).leaf;
      leaf.extensions = [TASK];
      leaf.attributes = { "m3e:nodeType:task/who": "img", "m3e:nodeType:task/note": "img" };
    });
    expect(accepted.ok).toBe(true);
    const missing = commit(store, (state) => {
      (nodesOf(state).leaf.attributes as Loose)["m3e:nodeType:task/who"] = "no-such-node";
    });
    expect(missing.ok).toBe(true);

    const badList = attempt(store, (state) => {
      (nodesOf(state).leaf.attributes as Loose)["m3e:nodeType:task/team"] = ["img", "leaf"];
    });
    expect(badList.ok).toBe(false);
    if (!badList.ok) expect(badList.message ?? "").toMatch(/field team references node leaf which lacks extension m3e:nodeType:person/);
    const brokenList = commit(store, (state) => {
      (nodesOf(state).leaf.attributes as Loose)["m3e:nodeType:task/team"] = ["img", "no-such-node"];
    });
    expect(brokenList.ok).toBe(true);
  });
});

type Bag = Map<string, SnapshotRecord>;

function bagOf(records: readonly SnapshotRecord[]): Bag {
  const bag: Bag = new Map();
  for (const record of records) {
    if (record.kind === "snapshot") continue;
    bag.set(recordRk(record), record);
  }
  return bag;
}

function edgesOf(bag: Bag): EdgeConnectionRecord[] {
  return [...bag.values()].filter((record): record is EdgeConnectionRecord => record.kind === "connection" && record.type === "edge");
}

function nodeRecords(bag: Bag): NodeRecord[] {
  return [...bag.values()].filter((record): record is NodeRecord => record.kind === "node");
}

function scopesOf(bag: Bag): ScopeRecord[] {
  return [...bag.values()].filter((record): record is ScopeRecord => record.kind === "scope");
}

function parentsOf(bag: Bag): Map<string, string> {
  const parents = new Map<string, string>();
  for (const edge of edgesOf(bag)) if (!parents.has(edge.target)) parents.set(edge.target, edge.source);
  return parents;
}

function isDescendant(bag: Bag, id: string, ancestor: string): boolean {
  const parents = parentsOf(bag);
  const seen = new Set<string>();
  let at: string | undefined = id;
  while (at !== undefined && !seen.has(at)) {
    if (at === ancestor) return true;
    seen.add(at);
    at = parents.get(at);
  }
  return false;
}

function withRecord(bag: Bag, record: SnapshotRecord): Bag {
  const next = new Map(bag);
  next.set(recordRk(record), record);
  return next;
}

function without(bag: Bag, rk: string): Bag {
  const next = new Map(bag);
  next.delete(rk);
  return next;
}

function sameScopeSources(bag: Bag, edge: EdgeConnectionRecord): string[] {
  const scope = scopesOf(bag).find((record) => record.id === edge.scopeId);
  const found = new Set<string>();
  if (scope) found.add(scope.rootNodeId);
  for (const other of edgesOf(bag)) {
    if (other.scopeId !== edge.scopeId) continue;
    found.add(other.source);
    found.add(other.target);
  }
  return [...found].filter((id) => id !== edge.source && id !== edge.target && !isDescendant(bag, id, edge.target));
}

function reparent(bag: Bag, step: number): Bag | undefined {
  const edges = edgesOf(bag);
  if (edges.length === 0) return undefined;
  const edge = edges[step % edges.length];
  if (step % 3 === 2) return withRecord(bag, { ...edge, source: edge.target });
  const choices = sameScopeSources(bag, edge);
  if (choices.length === 0) return withRecord(bag, { ...edge, source: edge.target });
  return withRecord(bag, { ...edge, source: choices[step % choices.length] });
}

function cycle(bag: Bag, step: number): Bag | undefined {
  const edges = edgesOf(bag);
  if (edges.length === 0) return undefined;
  const first = edges[step % edges.length];
  const second = edges[(step + 1) % edges.length];
  if (first.id === second.id) return withRecord(bag, { ...first, source: first.target });
  // Both reparents are in this one command. The check runs on the state after both.
  const moved = withRecord(bag, { ...first, source: second.target });
  return withRecord(moved, { ...second, source: first.target });
}

function duplicateOrd(bag: Bag, step: number): Bag | undefined {
  const groups = new Map<string, EdgeConnectionRecord[]>();
  for (const edge of edgesOf(bag)) {
    const group = groups.get(edge.source) ?? [];
    group.push(edge);
    groups.set(edge.source, group);
  }
  const ready = [...groups.values()].filter((group) => group.length >= 2 && group[0].ord !== group[1].ord);
  if (ready.length === 0) return undefined;
  const group = ready[step % ready.length];
  return withRecord(bag, { ...group[1], ord: group[0].ord });
}

function aliasEdit(bag: Bag, step: number): Bag | undefined {
  const nodes = nodeRecords(bag);
  const aliases = nodes.filter((node) => node.nodeType === "alias" || node.alias !== undefined);
  if (aliases.length === 0) return undefined;
  const alias = aliases[step % aliases.length];
  const plain = nodes.filter((node) => node.nodeType !== "alias" && node.alias === undefined);
  const mode = step % 4;
  if (mode === 0 && plain.length > 0) {
    const target = plain[step % plain.length].id;
    if (alias.alias?.target === target) return undefined;
    return withRecord(bag, { ...alias, alias: { ...(alias.alias ?? {}), target } });
  }
  if (mode === 1) return withRecord(bag, { ...alias, alias: { ...(alias.alias ?? {}), target: alias.id } });
  if (mode === 2 && alias.alias?.target) return without(bag, `node|${alias.alias.target}`);
  return withRecord(bag, { ...alias, alias: { ...(alias.alias ?? {}), target: "missing-alias-target" } });
}

function deleteRecord(bag: Bag, step: number): Bag | undefined {
  const edges = edgesOf(bag);
  const root = [...bag.values()].find((record) => record.kind === "map")?.rootNodeId;
  const nodes = nodeRecords(bag).filter((node) => node.id !== root);
  if (step % 2 === 0 && edges.length > 0) return without(bag, recordRk(edges[step % edges.length]));
  if (nodes.length === 0) return undefined;
  return without(bag, recordRk(nodes[step % nodes.length]));
}

function editText(bag: Bag, step: number): Bag | undefined {
  const nodes = nodeRecords(bag);
  if (nodes.length === 0) return undefined;
  const node = nodes[step % nodes.length];
  return withRecord(bag, { ...node, text: `t${step}` });
}

function extensionEdit(bag: Bag, step: number): Bag | undefined {
  const def: ExtensionDefRecord = {
    kind: "extensionDef",
    name: "m3e:nodeType:task",
    version: 1,
    target: "node",
    fields: [
      { name: "status", type: "enum", required: true, values: ["open", "done"] },
      { name: "who", type: "nodeRef", ref: PERSON },
    ],
    rev: 0,
  };
  const next = withRecord(bag, def);
  const nodes = nodeRecords(bag).filter((node) => node.nodeType !== "alias" && node.alias === undefined);
  if (nodes.length === 0) return undefined;
  const node = nodes[step % nodes.length];
  const other = nodes.find((item) => item.id !== node.id) ?? node;
  if (step % 2 === 0) {
    return withRecord(next, {
      ...node,
      extensions: [TASK],
      attributes: { ...(node.attributes ?? {}), "m3e:nodeType:task/who": other.id },
    });
  }
  return withRecord(next, {
    ...node,
    extensions: [TASK],
    attributes: { ...(node.attributes ?? {}), "m3e:nodeType:task/status": "open" },
  });
}

const MUTATIONS = {
  reparent,
  cycle,
  ord: duplicateOrd,
  alias: aliasEdit,
  delete: deleteRecord,
  edit: editText,
  extension: extensionEdit,
} as const;

type MutationKind = keyof typeof MUTATIONS;

function opsBetween(before: Bag, after: Bag): NeighbourOp[] {
  const ops: NeighbourOp[] = [];
  for (const rk of before.keys()) if (!after.has(rk)) ops.push({ op: "delete", rk });
  for (const [rk, record] of after) {
    const prior = before.get(rk);
    if (!prior || JSON.stringify(prior) !== JSON.stringify(record)) ops.push({ op: "put", rk, record });
  }
  return ops;
}

function defsOf(bag: Bag): Map<string, ExtensionDefRecord> {
  const defs = new Map<string, ExtensionDefRecord>();
  for (const record of bag.values()) {
    if (record.kind === "extensionDef") defs.set(`${record.name}@${record.version}`, record);
  }
  return defs;
}

function judge(before: Bag, after: Bag): { local: InvariantProblem[]; full: InvariantProblem[] } {
  const ops = opsBetween(before, after);
  const index = NeighbourhoodIndex.fromRecords(before.values());
  index.apply(ops, (rk) => before.get(rk));
  const local = index.check((rk) => after.get(rk), ops, (rk) => before.get(rk), defsOf(after));
  return { local: local.problems, full: checkInvariants([...after.values()]) };
}

describe("local invariant check", () => {
  it("accepts and rejects the same commands as the full check", () => {
    const bag0 = bagOf(snapshotOf([{ id: "m", state: richState() }]));
    expect(checkInvariants([...bag0.values()])).toEqual([]);
    let bag = bag0;
    const counts: Record<MutationKind, number> = { reparent: 0, cycle: 0, ord: 0, alias: 0, delete: 0, edit: 0, extension: 0 };
    const order = Object.keys(MUTATIONS) as MutationKind[];
    let accepted = 0;
    let rejected = 0;
    let step = 0;
    let guard = 0;
    while (accepted + rejected < 500 && guard < 8000) {
      guard += 1;
      const kind = order[step % order.length];
      step += 1;
      const next = MUTATIONS[kind](bag, step);
      if (!next || opsBetween(bag, next).length === 0) continue;
      const verdict = judge(bag, next);
      const localFail = verdict.local.length > 0;
      const fullFail = verdict.full.length > 0;
      if (localFail !== fullFail) {
        expect({
          kind,
          step,
          local: verdict.local.slice(0, 4),
          full: verdict.full.slice(0, 4),
        }).toEqual({ kind, step, local: [], full: [] });
      }
      counts[kind] += 1;
      if (localFail) rejected += 1;
      else {
        accepted += 1;
        bag = next;
      }
    }
    console.log(`local-vs-full commands=${accepted + rejected} accepted=${accepted} rejected=${rejected} ${JSON.stringify(counts)}`);
    expect(accepted + rejected).toBeGreaterThanOrEqual(500);
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    expect(counts.reparent).toBeGreaterThan(0);
    expect(counts.cycle).toBeGreaterThan(0);
    expect(counts.ord).toBeGreaterThan(0);
    expect(counts.alias).toBeGreaterThan(0);
    expect(counts.delete).toBeGreaterThan(0);
    expect(checkInvariants([...bag.values()])).toEqual([]);
  });

  it("commits a reparent on a 40000-node map without a whole-map invariant scan", { timeout: 120000 }, () => {
    now = T0;
    const state = bigState(200, 200);
    const nodeCount = Object.keys(state.nodes as Loose).length;
    const dir = newDir("big", state, "big");
    const store = openStore(dir);
    const before = store.getMapRow("big").state as unknown as Loose;
    const after = clone(before);
    const nodes = nodesOf(after);
    const id = "bg0000n0000";
    nodes[id].parentId = "bg0001";
    nodes.bg0000.children = (nodes.bg0000.children as string[]).filter((child) => child !== id);
    (nodes.bg0001.children as string[]).push(id);
    const changes = diffState(before, after);
    const started = performance.now();
    const result = store.commitMapCommand("big", command(changes), ISSUER);
    const commitMs = performance.now() - started;
    expect(result.ok).toBe(true);
    const checkStarted = performance.now();
    const problems = checkInvariants(store.records());
    const fullCheckMs = performance.now() - checkStarted;
    expect(problems).toEqual([]);
    const indexed = store.records().filter((record) => record.kind !== "snapshot" && record.kind !== "commit");
    const byRk = new Map(indexed.map((record) => [recordRk(record), record]));
    const index = NeighbourhoodIndex.fromRecords(indexed);
    const moved = indexed.find((record) => record.kind === "connection" && record.type === "edge" && record.target === id);
    if (!moved || moved.kind !== "connection" || moved.type !== "edge") throw new Error("missing reparented edge");
    const ops: NeighbourOp[] = [{ op: "put", rk: recordRk(moved), record: moved }];
    const localStarted = performance.now();
    index.apply(ops, (rk) => byRk.get(rk));
    index.check((rk) => byRk.get(rk), ops, (rk) => byRk.get(rk), new Map());
    const localCheckMs = performance.now() - localStarted;
    console.log(`format2-decay 40k nodes=${nodeCount} commitMs=${commitMs.toFixed(1)} fullCheckMs=${fullCheckMs.toFixed(1)} localCheckMs=${localCheckMs.toFixed(1)}`);
    expect(nodeCount).toBe(40201);
  });
});
