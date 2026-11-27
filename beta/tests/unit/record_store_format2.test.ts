// Format 2 commits, invariants 3, 9 and 10. The store is Neo4j. Synthetic records only.

import { afterEach, describe, expect, it } from "vitest";
import { RecordWorkspaceStore, type CommitResult } from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { checkInvariants } from "../../src/shared/record_model/invariants";
import { parseSnapshot, serializeSnapshot, sortRecords } from "../../src/shared/record_model/jsonl";
import { recordRk } from "../../src/shared/record_model/steady";
import type { SnapshotRecord } from "../../src/shared/record_model/types";
import { ISSUER, WS, clone, command, node, richState, snapshotOf, type Loose } from "./record_store_helpers";
import { createTestStore, dropTestStores, type TestStore } from "./neo4j_test_store";

afterEach(dropTestStores);

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 22, 0, 0, clock)).toISOString();
}

function seedRows() {
  return [{ id: "map_a", state: richState() }, { id: "map_b", state: richState("b_") }];
}

async function openStore(records: SnapshotRecord[] = snapshotOf(seedRows())): Promise<TestStore> {
  return createTestStore(records, { now: tick, compactAfterLines: 0 });
}

function stateOf(store: RecordWorkspaceStore, mapId = "map_a"): Loose {
  return store.getMapRow(mapId).state as unknown as Loose;
}

function nodesOf(state: Loose): Record<string, Loose> {
  return state.nodes as Record<string, Loose>;
}

function attempt(store: RecordWorkspaceStore, change: (state: Loose) => void, mapId = "map_a"): CommitResult {
  const before = stateOf(store, mapId);
  const after = clone(before);
  change(after);
  const changes = diffState(before, after);
  expect(changes.length).toBeGreaterThan(0);
  return store.commitMapCommand(mapId, command(changes), ISSUER);
}

function commit(store: RecordWorkspaceStore, change: (state: Loose) => void, mapId = "map_a"): Extract<CommitResult, { ok: true }> {
  const result = attempt(store, change, mapId);
  if (!result.ok) throw new Error(`commit failed: ${result.code} ${result.message ?? ""}`);
  return result;
}

function refused(result: CommitResult, code: string, message: RegExp): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe(code);
  expect(result.message ?? "").toMatch(message);
}

const TASK = "m3e:nodeType:task@1";
const MOOD = "misc:nodeType:mood@2";

function taskDef(more: Loose = {}): Loose {
  return {
    kind: "extensionDef",
    name: "m3e:nodeType:task",
    version: 1,
    target: "node",
    label: "task",
    description: "a task",
    fields: [
      { name: "status", type: "enum", required: true, values: ["open", "done"], default: "open" },
      { name: "title", type: "string" },
      { name: "count", type: "int" },
      { name: "score", type: "float" },
      { name: "flag", type: "bool" },
      { name: "due", type: "time" },
      { name: "scale", type: "timeExp" },
      { name: "who", type: "nodeRef", ref: "node" },
      { name: "owner", type: "accountRef" },
      { name: "tags", type: "list<string>" },
    ],
    render: { attributes: ["m3e:nodeType:task/status"], size: "text" },
    rev: 0,
    ...more,
  };
}

function validTaskAttributes(): Loose {
  return {
    "m3e:nodeType:task/status": "open",
    "m3e:nodeType:task/title": "hello",
    "m3e:nodeType:task/count": Number.MAX_SAFE_INTEGER,
    "m3e:nodeType:task/score": 1.5,
    "m3e:nodeType:task/flag": true,
    "m3e:nodeType:task/due": "2026-11-22T00:00:00.000Z",
    "m3e:nodeType:task/scale": -3,
    "m3e:nodeType:task/who": "no-such-node",
    "m3e:nodeType:task/owner": "acct_missing",
    "m3e:nodeType:task/tags": ["a", "b"],
    "m3e:nodeType:task/extra": 1,
    plain: { nested: true },
  };
}

/** Applies journal ops onto the base snapshot the way an open replays them. */
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
  // The header carries the workspace and its history (workspaceId, historyId, epoch) through a rebuild.
  return sortRecords([{ ...header, format: 3, seq }, ...all.values()]);
}

describe("format 2 replay", () => {
  it("rebuilds the live records from the base snapshot and the journal suffix", async () => {
    const store = (await openStore()).store;
    const base = serializeSnapshot(store.records());
    commit(store, (state) => { nodesOf(state).leaf.text = "one"; });
    commit(store, (state) => {
      const nodes = nodesOf(state);
      nodes.added = node("added", "f1", [], { details: "new" });
      (nodes.f1.children as string[]).push("added");
    });
    commit(store, (state) => {
      const children = [...(nodesOf(state).root.children as string[])];
      children.push(children.shift() as string);
      nodesOf(state).root.children = children;
    });
    commit(store, (state) => {
      const links = state.links as Record<string, Loose>;
      links.extra = { id: "extra", sourceNodeId: "leaf", targetNodeId: "img", extensions: [MOOD.replace("nodeType", "relationEdge")] };
    });
    commit(store, (state) => {
      nodesOf(state).inner.edgeRelationType = "m3e:detail";
      nodesOf(state).inner.edgeAttributes = { "m3e:weight": 2 };
      nodesOf(state).leaf.extensions = [MOOD];
    });
    commit(store, (state) => {
      const nodes = nodesOf(state);
      delete nodes.added;
      nodes.f1.children = (nodes.f1.children as string[]).filter((id) => id !== "added");
    });
    const lines = await store.readJournalAfter(0);
    const rebuilt = replay(base, (lines ?? []).map((line) => JSON.stringify(line)).join("\n"));
    expect(rebuilt).toEqual(store.records());
    expect((rebuilt[0] as { seq: number }).seq).toBe(store.seq());
  });
});

describe("format 2 invariants at commit", () => {
  it("accepts an alias with a child and rejects an alias whose target is an alias", async () => {
    const store = (await openStore()).store;
    const accepted = commit(store, (state) => {
      const nodes = nodesOf(state);
      nodes.kid = node("kid", "al", [], { text: "under alias" });
      nodes.al.children = ["kid"];
    });
    expect(accepted.ok).toBe(true);
    const edge = store.records().find((record) => record.kind === "connection" && record.type === "edge" && record.target === "kid");
    expect(edge).toMatchObject({ source: "al" });
    expect(checkInvariants(store.records()).map((problem) => problem.rule)).not.toContain(3);
    refused(attempt(store, (state) => {
      const nodes = nodesOf(state);
      nodes.al2 = node("al2", "f1", [], { nodeType: "alias", targetNodeId: "leaf", access: "read" });
      (nodes.f1.children as string[]).push("al2");
      nodes.al.targetNodeId = "al2";
    }), "INVALID_STATE", /rule 3/);
  });

  it("rejects a duplicate parent-edge ord under one parent and keeps the same ord under another", () => {
    const records: SnapshotRecord[] = [
      { kind: "snapshot", format: 3, workspaceId: WS, seq: 0 },
      { kind: "map", id: "m", rootNodeId: "root", rev: 0 },
      { kind: "node", id: "root", mapId: "m", text: "root", certainty: -1, rev: 0 },
      { kind: "node", id: "a", mapId: "m", text: "a", certainty: -1, rev: 0 },
      { kind: "node", id: "b", mapId: "m", text: "b", certainty: -1, rev: 0 },
      { kind: "node", id: "c", mapId: "m", text: "c", certainty: -1, rev: 0 },
      { kind: "connection", id: "e_a", mapId: "m", type: "edge", source: "root", target: "a", ord: "a0", scopeId: "s", rev: 0 },
      { kind: "connection", id: "e_b", mapId: "m", type: "edge", source: "root", target: "b", ord: "a0", scopeId: "s", rev: 0 },
      { kind: "connection", id: "e_c", mapId: "m", type: "edge", source: "a", target: "c", ord: "a0", scopeId: "s", rev: 0 },
      { kind: "scope", id: "s", mapId: "m", rootNodeId: "root", rev: 0 },
    ];
    const problems = checkInvariants(records);
    expect(problems.map((problem) => problem.rule)).toEqual([9]);
    expect(problems[0].message).toMatch(/duplicate ord "a0" under parent root/);
    const shared = records.map((record) => record.kind === "connection" && record.id === "e_b" ? { ...record, ord: "a1" } : record);
    expect(checkInvariants(shared)).toEqual([]);
  });

  it("checks extension fields whose definition exists and keeps an unknown extension", async () => {
    const store = (await openStore()).store;
    const defined = commit(store, (state) => { state.extensionDefs = [taskDef()]; });
    const storedDef = store.records().find((record) => record.kind === "extensionDef");
    expect(storedDef).toMatchObject({ ...taskDef(), rev: defined.seq });
    expect(stateOf(store, "map_b").extensionDefs).toEqual([storedDef]);

    const filled = commit(store, (state) => {
      nodesOf(state).leaf.extensions = [TASK];
    });
    const filledLeaf = store.records().find((record) => record.kind === "node" && record.id === "leaf");
    expect(filledLeaf).toMatchObject({
      extensions: [TASK],
      attributes: { "m3e:nodeType:task/status": "open" },
      rev: filled.seq,
    });
    expect(nodesOf(stateOf(store)).leaf.attributes).toMatchObject({ "m3e:nodeType:task/status": "open" });

    const granted = commit(store, (state) => {
      const leaf = nodesOf(state).leaf;
      leaf.extensions = [MOOD, TASK];
      leaf.attributes = validTaskAttributes();
    });
    expect(granted.ok).toBe(true);
    const leaf = store.records().find((record) => record.kind === "node" && record.id === "leaf");
    expect(leaf).toMatchObject({ extensions: [TASK, MOOD], attributes: validTaskAttributes() });

    const wrong: Array<[string, unknown]> = [
      ["title", 1],
      ["count", 1.5],
      ["count", Number.MAX_SAFE_INTEGER + 1],
      ["score", "not-a-number"],
      ["flag", "true"],
      ["status", "nope"],
      ["due", "2026-11-22T00:00:00Z"],
      ["scale", 1.5],
      ["who", 1],
      ["owner", true],
      ["tags", "nope"],
      ["tags", ["a", 1]],
    ];
    for (const [field, value] of wrong) {
      refused(attempt(store, (state) => {
        (nodesOf(state).leaf.attributes as Loose)[`m3e:nodeType:task/${field}`] = value;
      }), "INVALID_STATE", new RegExp(`rule 10:.*field ${field}`));
    }

    const nonFinite = store.records().map((record) => (
      record.kind === "node" && record.id === "leaf"
        ? { ...record, attributes: { ...record.attributes, "m3e:nodeType:task/score": Number.POSITIVE_INFINITY } }
        : record
    ));
    expect(checkInvariants(nonFinite).some((problem) => problem.rule === 10 && problem.message.includes("field score"))).toBe(true);

    refused(attempt(store, (state) => {
      nodesOf(state).leaf.extensions = [TASK, "m3e:nodeType:task@2"];
    }), "INVALID_STATE", /rule 10:.*more than once/);

    const polarity = {
      kind: "extensionDef",
      name: "m3e:parentEdge:polarity",
      version: 1,
      target: "parentEdge",
      fields: [{ name: "value", type: "enum", required: true, values: ["preserve", "invert"] }],
      rev: 0,
    };
    commit(store, (state) => { state.extensionDefs = [taskDef(), polarity]; });
    refused(attempt(store, (state) => {
      nodesOf(state).inner.edgeExtensions = ["m3e:parentEdge:polarity@1"];
    }), "INVALID_STATE", /rule 10:.*missing required field value/);
    commit(store, (state) => {
      const inner = nodesOf(state).inner;
      inner.edgeExtensions = ["m3e:parentEdge:polarity@1"];
      inner.edgeAttributes = { "m3e:parentEdge:polarity/value": "invert" };
    });
  });

  it("rejects the same extensionDef key with different content, including misc:", async () => {
    const store = (await openStore()).store;
    commit(store, (state) => { state.extensionDefs = [taskDef()]; });
    refused(attempt(store, (state) => {
      state.extensionDefs = [taskDef({ description: "changed" })];
    }), "CONFLICT", /extensionDef m3e:nodeType:task@1/);
    commit(store, (state) => { nodesOf(state).leaf.text = "still"; });
    const mood = {
      kind: "extensionDef",
      name: "misc:nodeType:mood",
      version: 1,
      target: "node",
      fields: [{ name: "value", type: "string" }],
      rev: 0,
    };
    commit(store, (state) => { state.extensionDefs = [taskDef(), mood]; });
    refused(attempt(store, (state) => {
      state.extensionDefs = [taskDef(), { ...mood, label: "other" }];
    }), "CONFLICT", /extensionDef misc:nodeType:mood@1/);
    refused(attempt(store, (state) => {
      state.extensionDefs = [{ ...taskDef(), name: "not-a-name" }];
    }), "INVALID_STATE", /prefix:class:name/);
    refused(attempt(store, (state) => {
      const bad = taskDef();
      (bad.fields as Loose[])[0] = { name: "nested", type: "list<list<string>>" };
      state.extensionDefs = [bad];
    }), "INVALID_STATE", /unknown type/);
  });
});

describe("format 2 AppState round trip", () => {
  it("keeps extensions, parent-edge fields, extensionDef records and unknown fields", async () => {
    const handle = await openStore();
    const store = handle.store;
    const defined = commit(store, (state) => { state.extensionDefs = [taskDef()]; });
    commit(store, (state) => {
      const nodes = nodesOf(state);
      const leaf = nodes.leaf;
      leaf.extensions = [MOOD, TASK];
      leaf.attributes = validTaskAttributes();
      leaf.keptExtra = { n: 1 };
      const inner = nodes.inner;
      inner.edgeRelationType = "m3e:detail";
      inner.edgeAttributes = { "m3e:weight": 2, "m3e:note": "x" };
      inner.edgeExtensions = ["misc:parentEdge:mark@1"];
      (state.links as Record<string, Loose>).l1.extensions = ["misc:relationEdge:cites@3"];
    });
    const expectState = (state: Loose): void => {
      const nodes = nodesOf(state);
      expect(nodes.leaf.extensions).toEqual([TASK, MOOD]);
      expect(nodes.leaf.attributes).toEqual(validTaskAttributes());
      expect(nodes.leaf.keptExtra).toEqual({ n: 1 });
      expect(nodes.inner.edgeRelationType).toBe("m3e:detail");
      expect(nodes.inner.edgeAttributes).toEqual({ "m3e:weight": 2, "m3e:note": "x" });
      expect(nodes.inner.edgeExtensions).toEqual(["misc:parentEdge:mark@1"]);
      expect((state.links as Record<string, Loose>).l1.extensions).toEqual(["misc:relationEdge:cites@3"]);
      expect(state.extensionDefs).toEqual([{ ...taskDef(), rev: defined.seq }]);
    };
    expectState(stateOf(store));
    const edge = store.records().find((record) => record.kind === "connection" && record.type === "edge" && record.target === "inner");
    expect(edge).toMatchObject({
      relationType: "m3e:detail",
      attributes: { "m3e:weight": 2, "m3e:note": "x" },
      extensions: ["misc:parentEdge:mark@1"],
    });
    expectState(stateOf(await handle.reopen()));
  });
});
