import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, expect, test, vi } from "vitest";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { MapRecordChanges } from "../../src/node/record_store/map_changes";
import { handleMapRecordsHttp, mapRecordChangeFrame } from "../../src/node/record_store/map_changes_http";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { command, node } from "./record_store_helpers";

const dirs: string[] = [], stores: RecordWorkspaceStore[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) await store.close();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
function fixture(count = 50) {
  const nodes: any = { root: node("root", null) };
  for (let i = 0; i < count; i++) { nodes[`n${i}`] = node(`n${i}`, "root"); nodes.root.children.push(`n${i}`); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "map-record-changes-")); dirs.push(dir);
  RecordWorkspaceStore.create(dir, toSnapshot("workspace", [{ id: "m", state: { rootId: "root", nodes } },
    { id: "other", state: { rootId: "other-root", nodes: { "other-root": node("other-root", null) } } }]));
  const store = RecordWorkspaceStore.open(dir); stores.push(store);
  // Indexes are built at load, not at notification/read time.
  store.getMapRow("m");
  return { store, dir };
}
function edit(store: RecordWorkspaceStore, before = "text of n1", after = "changed") {
  const cmd = command([{ kind: "node", key: ["n1"], op: "update", before: { text: before }, after: { text: after } }]);
  expect(store.commitMapCommand("m", cmd, "human")).toMatchObject({ ok: true });
  return cmd;
}
function httpRead(store: RecordWorkspaceStore | null, route: string, method = "GET") {
  let body: any;
  const res = { statusCode: 0, setHeader() {}, end(text: string) { body = JSON.parse(text); } };
  expect(handleMapRecordsHttp({ url: route, method } as IncomingMessage, res as unknown as ServerResponse, store)).toBe(true);
  return { status: res.statusCode, body };
}

test("50 and 20000 nodes: notification and HTTP delta read visit only changed records", async () => {
  const counts: number[] = [], lookupCounts: number[] = [];
  for (const count of [50, 20000]) {
    const { store } = fixture(count);
    const baseline = httpRead(store, "/api/maps/m/records");
    expect(baseline.status).toBe(200);
    const events: any[] = [];
    const unsubscribe = store.mapChanges.subscribe(event => events.push(event));
    const all = (store as any).all as Map<string, unknown>;
    const lookups = vi.spyOn(all, "get");
    let iteratedRecords = 0;
    // Creating an iterator reads no records; count next() consumption, not values() calls.
    for (const method of ["values", "entries", Symbol.iterator] as const) {
      const original = all[method].bind(all);
      vi.spyOn(all, method).mockImplementation(function* () {
        for (const item of original()) { iteratedRecords++; yield item; }
      } as any);
    }
    const originalForEach = all.forEach.bind(all);
    vi.spyOn(all, "forEach").mockImplementation((callback, thisArg) => originalForEach((value, key, map) => {
      iteratedRecords++; callback.call(thisArg, value, key, map);
    }));
    const read = vi.spyOn(store, "record");
    const whole = vi.spyOn(store, "getMapRow");
    const cmd = edit(store);
    await Promise.resolve();
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.previousRevision).toBe(baseline.body.revision);
    expect(event.seq).toBe(store.seq());
    expect(event.recordKeys).toContain("node|n1");
    expect(read).toHaveBeenCalledTimes(0); // notification never loads a record body
    const response = httpRead(store, `/api/maps/m/records?since=${encodeURIComponent(baseline.body.revision)}`);
    expect(response.status).toBe(200);
    expect(response.body.full).toBe(false);
    expect(response.body.revision).toBe(event.revision);
    expect(response.body.records.find((item: any) => item.rk === "node|n1").record.text).toBe("changed");
    expect(response.body.records.map((item: any) => item.rk).sort()).toEqual([...event.recordKeys].sort());
    expect(read).toHaveBeenCalledTimes(event.recordKeys.length);
    expect(whole).not.toHaveBeenCalled();
    counts.push(read.mock.calls.length);
    lookupCounts.push(lookups.mock.calls.length);
    expect(iteratedRecords).toBe(0);
    const frame = mapRecordChangeFrame({ ...event, sourceTabId: null });
    expect(frame).toContain('event: map_updated\n');
    expect(JSON.parse(frame.split("data: ")[1])).toMatchObject(event);
    expect(store.commitMapCommand("m", cmd, "human")).toMatchObject({ ok: true, replayed: true });
    await Promise.resolve(); expect(events).toHaveLength(1);
    unsubscribe();
  }
  expect(counts[0]).toBeGreaterThan(0);
  expect(counts[1]).toBe(counts[0]);
  expect(lookupCounts[1]).toBe(lookupCounts[0]);
  process.stdout.write(`map record delta reads, 50 / 20000 nodes: ${counts.join(" / ")}; total commit/notify/read lookups: ${lookupCounts.join(" / ")}\n`);
});

test("interleaved maps and multiple commits coalesce by key; unchanged reads fetch no records", () => {
  const { store } = fixture();
  const cursor = store.mapChanges.cursor("m", store.seq()).revision;
  edit(store);
  expect(store.commitMapCommand("other", command([{ kind: "node", key: ["other-root"], op: "update", before: { text: "text of other-root" }, after: { text: "elsewhere" } }]), "human").ok).toBe(true);
  edit(store, "changed", "twice");
  const read = vi.spyOn(store, "record");
  const delta = store.readMapRecords("m", cursor)!;
  expect(delta.records.find(item => item.rk === "node|n1")?.record).toMatchObject({ text: "twice" });
  expect(delta.records.some(item => item.rk === "node|other-root")).toBe(false);
  expect(read).toHaveBeenCalledTimes(new Set(delta.records.map(item => item.rk)).size);
  read.mockClear();
  expect(store.readMapRecords("m", delta.revision)?.records).toEqual([]);
  expect(read).not.toHaveBeenCalled();
});

test("unknown, evicted and reopened cursors require a full read, without record reads", async () => {
  const feed = new MapRecordChanges(2);
  const first = feed.cursor("m", 0).revision;
  feed.append("m", 1, "now", new Set(["a", "b"]));
  const next = feed.cursor("m", 1).revision;
  feed.append("m", 3, "later", new Set(["c"]));
  expect(feed.since("m", first, 3)).toBeNull();
  expect(feed.since("m", next, 3)?.recordKeys).toEqual(["c"]);
  const { store, dir } = fixture();
  const cursor = store.readMapRecords("m")!.revision;
  edit(store);
  await store.close(); stores.splice(stores.indexOf(store), 1);
  const reopened = RecordWorkspaceStore.open(dir); stores.push(reopened);
  const read = vi.spyOn(reopened, "record");
  expect(httpRead(reopened, `/api/maps/m/records?since=${cursor}`)).toMatchObject({ status: 409, body: { fullReadRequired: true } });
  expect(read).not.toHaveBeenCalled();
  const full = httpRead(reopened, "/api/maps/m/records");
  expect(full).toMatchObject({ status: 200, body: { full: true, deleted: false, header: { kind: "snapshot" } } });
  expect(full.body.records.find((item: any) => item.rk === "node|n1").record.text).toBe("changed");
  expect(httpRead(reopened, "/api/maps/missing/records").status).toBe(404);
  expect(httpRead(reopened, "/api/maps/m/records", "POST").status).toBe(405);
  expect(httpRead(null, "/api/maps/m/records")).toMatchObject({ status: 409, body: { fullReadRequired: true } });
});

test("local rebase and deleted records are observable; a rejected commit publishes nothing", async () => {
  const { store } = fixture();
  const initial = store.record("node|n1")!;
  edit(store);
  const baseline = store.readMapRecords("m")!;
  const events: any[] = []; store.mapChanges.subscribe(event => events.push(event));
  store.resetRecords(["node|n1"], () => initial, []);
  await Promise.resolve();
  expect(events).toHaveLength(1);
  const reset = store.readMapRecords("m", baseline.revision)!;
  expect(reset.records).toEqual([{ rk: "node|n1", record: initial }]);
  expect(store.getMapRow("m").state.nodes.n1.text).toBe("text of n1");
  expect(store.commitMapCommand("m", command([{ kind: "node", key: ["n1"], op: "update", before: { text: "wrong" }, after: { text: "bad" } }]), "human")).toMatchObject({ ok: false });
  await Promise.resolve(); expect(events).toHaveLength(1);
  store.deleteMap("m", "human");
  await Promise.resolve();
  const deleted = store.readMapRecords("m", reset.revision)!;
  expect(deleted.deleted).toBe(true);
  expect(deleted.records.find(item => item.rk === "node|n1")).toEqual({ rk: "node|n1", record: null });
});

test("failed fsync leaves the cursor and notification unchanged", async () => {
  const { store } = fixture();
  const baseline = store.readMapRecords("m")!;
  const events: any[] = []; store.mapChanges.subscribe(event => events.push(event));
  const fsync = vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => { throw new Error("synthetic fsync failure"); });
  expect(() => edit(store)).toThrow("synthetic fsync failure"); fsync.mockRestore();
  await Promise.resolve();
  expect(events).toEqual([]);
  expect(store.readMapRecords("m", baseline.revision)).toMatchObject({ revision: baseline.revision, records: [] });
});

test("map columns and rename change cursors and do not expose another map's moved records", () => {
  const { store } = fixture();
  const before = store.readMapRecords("m")!;
  store.setMapColumns("m", { pinned: true }, "human");
  const columns = store.readMapRecords("m", before.revision)!;
  expect(columns.revision).not.toBe(before.revision);
  expect(columns.records).toEqual([expect.objectContaining({ rk: "map|m", record: expect.objectContaining({ pinned: true }) })]);
  store.renameMapId("m", "renamed", "human");
  const renamed = store.readMapRecords("m", columns.revision)!;
  expect(renamed.deleted).toBe(true);
  expect(renamed.records.every(item => item.record === null)).toBe(true);
  expect(store.readMapRecords("renamed")?.records.some(item => item.record?.kind === "node")).toBe(true);
});
