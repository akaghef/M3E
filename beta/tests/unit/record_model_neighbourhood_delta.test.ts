import { describe, expect, it } from "vitest";
import { NeighbourhoodIndex } from "../../src/shared/record_model/neighbourhood";
import { recordRk } from "../../src/shared/record_model/steady";
import type { EdgeConnectionRecord, SnapshotRecord } from "../../src/shared/record_model/types";
import { initialKeys } from "../../src/shared/record_model/order_key";

function fixture(count: number) {
  const records = new Map<string, SnapshotRecord>();
  const put = (record: SnapshotRecord) => records.set(recordRk(record), record);
  put({ kind: "map", id: "m", rootNodeId: "root", rev: 0 });
  put({ kind: "node", id: "root", mapId: "m", text: "root", rev: 0 });
  put({ kind: "scope", id: "s", mapId: "m", rootNodeId: "root", rev: 0 });
  const keys = initialKeys(count);
  for (let i = 0; i < count; i += 1) {
    put({ kind: "node", id: `n${i}`, mapId: "m", text: "node", rev: 0 });
    put({ kind: "connection", id: `e${i}`, mapId: "m", type: "edge", source: "root", target: `n${i}`, scopeId: "s", ord: keys[i], rev: 0 });
  }
  return { records, index: NeighbourhoodIndex.fromRecords(records.values()) };
}

describe("incremental sibling order validation", () => {
  it("checks the changed order buckets without reading other siblings", () => {
    const { records, index } = fixture(1000);
    const prior = records.get("connection|e0") as EdgeConnectionRecord;
    const changed = { ...prior, label: "updated", rev: 1 };
    const ops = [{ op: "put" as const, rk: "connection|e0", record: changed }];
    const before = (rk: string) => rk === "connection|e0" ? prior : undefined;
    const undo = index.apply(ops, before);
    records.set("connection|e0", changed);
    let reads = 0;
    const result = index.check((rk) => { reads += 1; return records.get(rk); }, ops, before, new Map());
    expect(result.problems).toEqual([]);
    expect(reads).toBeLessThan(30);
    undo();
  });

  it("detects collisions, repairs their old buckets, and restores indexes after refusal", () => {
    const { records, index } = fixture(4);
    const prior = records.get("connection|e0") as EdgeConnectionRecord;
    const second = records.get("connection|e1") as EdgeConnectionRecord;
    const duplicate = { ...prior, ord: second.ord };
    const ops = [{ op: "put" as const, rk: "connection|e0", record: duplicate }];
    const before = (rk: string) => rk === "connection|e0" ? prior : undefined;
    const undo = index.apply(ops, before);
    records.set("connection|e0", duplicate);
    expect(index.check((rk) => records.get(rk), ops, before, new Map()).problems).toEqual([
      expect.objectContaining({ rule: 9, key: "e0", message: `duplicate ord ${JSON.stringify(second.ord)} under parent root` }),
    ]);
    undo();
    records.set("connection|e0", prior);
    const repeatUndo = index.apply([{ ...ops[0], record: prior }], before);
    expect(index.check((rk) => records.get(rk), [{ ...ops[0], record: prior }], before, new Map()).problems).toEqual([]);
    repeatUndo();
  });
});
