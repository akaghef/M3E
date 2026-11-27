// Node certainty (Database_Spec 3.2, invariant 11, 7): the format 3 migration, the -1 default,
// and the refusal of out-of-range values. Synthetic data in temporary directories only.

import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ARCHIVE_DIR, RecordWorkspaceStore, SNAPSHOT_FILE, type CommitResult } from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { certaintyFromConfidence } from "../../src/shared/record_model/certainty";
import { checkInvariants } from "../../src/shared/record_model/invariants";
import type { NodeRecord, SnapshotRecord } from "../../src/shared/record_model/types";
import { ISSUER, clone, command, node, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";

const open: RecordWorkspaceStore[] = [];

afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 27, 0, 0, clock)).toISOString();
}

function openStore(dir: string): RecordWorkspaceStore {
  const store = RecordWorkspaceStore.open(dir, { now: tick, compactAfterLines: 0 });
  open.push(store);
  return store;
}

function nodeRecords(store: RecordWorkspaceStore): NodeRecord[] {
  return store.records().filter((record): record is NodeRecord => record.kind === "node");
}

function attempt(store: RecordWorkspaceStore, change: (state: Loose) => void): CommitResult {
  const before = store.getMapRow("map_a").state as unknown as Loose;
  const after = clone(before);
  change(after);
  return store.commitMapCommand("map_a", command(diffState(before, after)), ISSUER);
}

/** A format 2 store: the records without `certainty`, two nodes with `m3e:confidence`. */
function format2Dir(name: string): string {
  const legacy: Record<string, Record<string, string>> = {
    leaf: { "m3e:confidence": "0.7", "m3e:band": "flash" },
    inner: { "m3e:confidence": "high" },
  };
  const records: SnapshotRecord[] = snapshotOf([{ id: "map_a", state: richState() }]).map((record) => {
    if (record.kind === "snapshot") return { ...record, format: 2 };
    if (record.kind !== "node") return record;
    const { certainty: _dropped, ...rest } = record;
    const extra = legacy[record.id];
    return (extra ? { ...rest, attributes: { ...(rest.attributes ?? {}), ...extra } } : rest) as unknown as SnapshotRecord;
  });
  const dir = path.join(tempDir(name), "store");
  RecordWorkspaceStore.create(dir, records);
  return dir;
}

describe("certainty", () => {
  it("reads Flash ingest and word values of m3e:confidence", () => {
    expect(certaintyFromConfidence("0.7")).toBe(70);
    expect(certaintyFromConfidence(0.8)).toBe(80);
    expect(certaintyFromConfidence("high")).toBe(80);
    expect(certaintyFromConfidence("medium")).toBe(50);
    expect(certaintyFromConfidence("low")).toBe(20);
    expect(certaintyFromConfidence("sure")).toBe(-1);
    expect(certaintyFromConfidence("1.5")).toBe(-1);
  });

  it("moves a format 2 store to format 3 once, carrying m3e:confidence into certainty", async () => {
    const dir = format2Dir("certainty-migrate");
    const format2 = fs.readFileSync(path.join(dir, SNAPSHOT_FILE), "utf8");
    const store = openStore(dir);
    expect(store.records()[0]).toMatchObject({ kind: "snapshot", format: 3 });
    const byText = new Map(nodeRecords(store).map((record) => [record.id, record]));
    const leaf = [...byText.values()].find((record) => record.attributes?.["m3e:band"] === "flash")!;
    expect(leaf.certainty).toBe(70);
    expect(leaf.attributes).toEqual({ "m3e:band": "flash" });
    expect(nodeRecords(store).filter((record) => record.certainty === 80)).toHaveLength(1);
    expect(nodeRecords(store).every((record) => !("m3e:confidence" in (record.attributes ?? {})))).toBe(true);
    expect(nodeRecords(store).filter((record) => record.certainty === -1).length).toBe(nodeRecords(store).length - 2);
    expect(checkInvariants(store.records()).filter((problem) => problem.rule === 11)).toEqual([]);
    expect(fs.readFileSync(path.join(dir, ARCHIVE_DIR, "snapshot.0.f2.jsonl"), "utf8")).toBe(format2);
    await store.close();
    const again = openStore(dir);
    expect(again.records()[0]).toMatchObject({ format: 3 });
    expect(fs.readdirSync(path.join(dir, ARCHIVE_DIR)).filter((name) => name.startsWith("snapshot."))).toEqual(["snapshot.0.f2.jsonl"]);
  });

  it("writes -1 for a new node without a value, keeps a given value, and refuses one out of range", () => {
    const dir = path.join(tempDir("certainty-commit"), "store");
    RecordWorkspaceStore.create(dir, snapshotOf([{ id: "map_a", state: richState() }]));
    const store = openStore(dir);
    const added = attempt(store, (state) => {
      const nodes = state.nodes as Record<string, Loose>;
      nodes.fresh = node("fresh", "root");
      nodes.sure = node("sure", "root", [], { certainty: 90 });
      (nodes.root.children as string[]).push("fresh", "sure");
    });
    expect(added.ok).toBe(true);
    const find = (text: string) => nodeRecords(store).find((record) => record.text === text)!;
    expect(find("text of fresh").certainty).toBe(-1);
    expect(find("text of sure").certainty).toBe(90);
    const state = store.getMapRow("map_a").state as unknown as Loose;
    const nodes = state.nodes as Record<string, Loose>;
    const sureId = Object.keys(nodes).find((id) => nodes[id].text === "text of sure")!;
    expect(nodes[sureId].certainty).toBe(90);

    for (const bad of [101, -2, 12.5]) {
      const result = attempt(store, (next) => { (next.nodes as Record<string, Loose>)[sureId].certainty = bad; });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message ?? "").toMatch(/certainty/);
    }
    expect(find("text of sure").certainty).toBe(90);
  });
});
