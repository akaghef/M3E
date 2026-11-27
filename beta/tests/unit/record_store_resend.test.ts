import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { pushCommands } from "../../src/node/sync/push";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { command } from "./record_store_helpers";

let dir: string;
let store: RecordWorkspaceStore;
const edit = (id: string, before = "ready", after = "done", node = "a") => command([
  { kind: "node", key: [node], op: "update", before: { text: before }, after: { text: after } },
], "edit", id);
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-resend-"));
  RecordWorkspaceStore.create(dir, toSnapshot("workspace", ["a", "b"].map(id => ({ id, state: {
    rootId: id, nodes: { [id]: { id, parentId: null, children: [], nodeType: "text", text: "initial" } },
  } }))));
  store = RecordWorkspaceStore.open(dir, { compactAfterLines: 0 });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
function ready() { expect(store.commitMapCommand("a", edit("prepare", "initial", "ready"), "tester").ok).toBe(true); }

test("DD4: CONFLICT remains the exact first result after state changes, including across map rename", () => {
  const cmd = edit("rejected");
  const first = store.commitMapCommand("a", cmd, "tester");
  expect(first).toMatchObject({ ok: false, code: "CONFLICT" });
  ready();
  store.renameMapId("a", "renamed", "tester");
  const length = store.journalLength();
  expect(store.commitMapCommand("renamed", cmd, "tester")).toEqual(first);
  expect(store.journalLength()).toBe(length);
  expect(store.commitMapCommand("renamed", edit("rejected", "ready", "different"), "tester"))
    .toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
});

test.each([false, true])("DD4: rejection survives reopen and backup (compact=%s)", async compact => {
  const cmd = edit("durable");
  const first = store.commitMapCommand("a", cmd, "tester");
  ready();
  if (compact) store.compact();
  await store.close();
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitMapCommand("a", cmd, "tester")).toEqual(first);
  const backup = path.join(dir, "copy");
  expect(store.backupTo(backup)).toContain("sync-rejections.jsonl");
  const copy = RecordWorkspaceStore.open(backup);
  try { expect(copy.commitMapCommand("a", cmd, "tester")).toEqual(first); }
  finally { await copy.close(); }
});

test("DD4: INVALID_COMMAND is remembered with its original state and cannot be replaced by other changes", () => {
  const cmd = { ...edit("invalid"), intent: "" };
  const first = store.commitMapCommand("a", cmd, "tester");
  expect(first).toMatchObject({ ok: false, code: "INVALID_COMMAND" });
  ready();
  expect(store.commitMapCommand("a", cmd, "tester")).toEqual(first);
  expect(store.commitMapCommand("a", edit("invalid", "ready", "other"), "tester"))
    .toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
});

test("DD4: INVALID_STATE remains refused after the missing endpoint is created", () => {
  const cmd = command([{ kind: "graph-link", key: ["link"], op: "create", after: {
    sourceNodeId: "a", targetNodeId: "child", relationType: "misc:test",
  } }], "link", "bad-state");
  const first = store.commitMapCommand("a", cmd, "tester");
  expect(first).toMatchObject({ ok: false, code: "INVALID_STATE" });
  const state = store.getMapRow("a").state;
  state.nodes.a.children.push("child");
  state.nodes.child = { id: "child", parentId: "a", children: [], text: "child", nodeType: "text", collapsed: false };
  expect(store.saveWholeMap("a", state, "tester").ok).toBe(true);
  expect(store.commitMapCommand("a", cmd, "tester")).toEqual(first);
  expect(store.commitMapCommand("a", { ...cmd, commandId: "fresh-link" }, "tester").ok).toBe(true);
});

test("DD5: one id across maps, including across commitMapCommand and commitSyncCommand", async () => {
  const cmd = edit("shared", "initial", "changed");
  expect(store.commitMapCommand("a", cmd, "tester").ok).toBe(true);
  const other = edit("shared", "initial", "changed", "b");
  expect(store.commitMapCommand("b", other, "tester")).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
  expect(store.commitSyncCommand({ mapId: "b", command: other }, "tester")).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
  store.compact();
  await store.close();
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitMapCommand("b", other, "tester")).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
});

test("DD5: legacy duplicate ids across maps keep both maps' data and report the collision", async () => {
  const first = edit("legacy", "initial", "one");
  expect(store.commitMapCommand("a", first, "tester").ok).toBe(true);
  expect(store.commitMapCommand("b", edit("separate", "initial", "two", "b"), "tester").ok).toBe(true);
  await store.close();
  const file = path.join(dir, "journal.jsonl");
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").map(line => JSON.parse(line));
  lines[1].commandId = "legacy";
  fs.writeFileSync(file, lines.map(line => JSON.stringify(line) + "\n").join(""));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  store = RecordWorkspaceStore.open(dir);
  expect(store.getMapRow("a").state.nodes.a.text).toBe("one");
  expect(store.getMapRow("b").state.nodes.b.text).toBe("two");
  expect(store.commitMapCommand("a", first, "tester")).toMatchObject({ ok: true, seq: 1, replayed: true });
  expect(store.commitMapCommand("b", edit("legacy", "initial", "two", "b"), "tester"))
    .toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
  expect(warning.mock.calls.flat().join(" ")).toMatch(/collision.*1/i);
});

test.each([false, true])("push uses store's remembered rejection (fenced=%s)", async fenced => {
  const cmd = edit("push-refused");
  const payload = { mapId: "a", command: cmd, commandId: cmd.commandId, baseSeq: 0 };
  const first = pushCommands(store, dir, [payload], "tester", fenced);
  expect(first.results[0].code).toBe("CONFLICT");
  ready();
  const backup = path.join(dir, "push-copy");
  store.backupTo(backup);
  const copy = RecordWorkspaceStore.open(backup);
  try { expect(pushCommands(copy, backup, [payload], "tester", fenced)).toEqual(first); }
  finally { await copy.close(); }
});

test("local rebase forgets tentative success durably, but retains deterministic rejection", async () => {
  const initial = new Map(store.records().map(row => [row.kind === "node" ? `node|${row.id}` : "unused", row]));
  const cmd = edit("tentative", "initial", "one");
  expect(store.commitMapCommand("a", cmd, "tester").ok).toBe(true);
  const rejected = edit("refused", "absent", "two");
  const first = store.commitMapCommand("a", rejected, "tester");
  store.resetRecords(["node|a"], rk => initial.get(rk), [
    { mapId: "a", commandId: "tentative" }, { mapId: "a", commandId: "refused" },
  ]);
  await store.close();
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitMapCommand("a", cmd, "tester")).toMatchObject({ ok: true, replayed: false });
  expect(store.commitMapCommand("a", rejected, "tester")).toEqual(first);
});

test("no-op can be replayed after local rebase, including repeated reopen and compaction", async () => {
  ready();
  const cmd = edit("no-op", "initial", "ready");
  expect(store.commitSyncCommand({ mapId: "a", command: cmd }, "tester")).toMatchObject({ ok: true, noOp: true });
  store.resetRecords([], () => undefined, [{ mapId: "a", commandId: cmd.commandId }]);
  expect(store.commitMapCommand("a", edit("back", "ready", "initial"), "tester").ok).toBe(true);
  await store.close();
  store = RecordWorkspaceStore.open(dir);
  const replay = store.commitSyncCommand({ mapId: "a", command: cmd }, "tester");
  expect(replay).toMatchObject({ ok: true, replayed: false });
  expect(replay).not.toHaveProperty("noOp");
  store.compact();
  await store.close();
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitSyncCommand({ mapId: "a", command: cmd }, "tester")).toMatchObject({ ok: true, seq: replay.ok && replay.seq, replayed: true });
});

test("rename does not enumerate remembered Commands and preserves the touched-map set", async () => {
  const cmd = edit("keep", "initial", "one");
  expect(store.commitMapCommand("a", cmd, "tester").ok).toBe(true);
  const table = (store as any).commands as Map<string, unknown>;
  const scan = vi.spyOn(table, Symbol.iterator).mockImplementation(() => { throw new Error("Command table scan"); });
  const renamed = store.commitSyncCommand({ mapId: "a", mapOp: "rename", newMapId: "renamed", command: command([], "rename", "rename-id") }, "tester");
  expect(renamed.ok).toBe(true);
  expect(store.commitMapCommand("renamed", cmd, "tester")).toMatchObject({ ok: true, replayed: true });
  scan.mockRestore();
  store.compact();
  const index = JSON.parse(fs.readFileSync(path.join(dir, "commit-index.json"), "utf8"));
  expect(index.commandResults.find(([id]: [string]) => id === "rename-id")[1].mapIds.sort()).toEqual(["a", "renamed"]);
  await store.close();
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitMapCommand("renamed", cmd, "tester")).toMatchObject({ ok: true, replayed: true });
});

test("legacy push rejection is read by the store and included in backup", async () => {
  await store.close();
  const cmd = command([], "legacy", "old-refused");
  fs.writeFileSync(path.join(dir, "sync-rejections.jsonl"), JSON.stringify({
    commandId: cmd.commandId, hash: createHash("sha256").update("[]").digest("hex"),
    result: { commandId: cmd.commandId, status: "rejected", code: "INVALID_COMMAND", message: "old refusal" },
  }) + "\n");
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitMapCommand("a", cmd, "tester")).toMatchObject({ ok: false, code: "INVALID_COMMAND", message: "old refusal" });
  const copyDir = path.join(dir, "legacy-backup");
  store.backupTo(copyDir);
  const copy = RecordWorkspaceStore.open(copyDir);
  try { expect(pushCommands(copy, copyDir, [{ mapId: "a", command: cmd, commandId: cmd.commandId, baseSeq: 0 }], "tester").results[0])
    .toMatchObject({ code: "INVALID_COMMAND", message: "old refusal" }); }
  finally { await copy.close(); }
});

test("a failed rejection fsync publishes no remembered result, and a torn tail is repaired on open", async () => {
  const cmd = edit("retry-after-io");
  const fail = vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => { throw new Error("disk failure"); });
  expect(() => store.commitMapCommand("a", cmd, "tester")).toThrow("disk failure");
  fail.mockRestore();
  ready();
  expect(store.commitMapCommand("a", cmd, "tester")).toMatchObject({ ok: true, replayed: false });
  const rejected = edit("durable-before-tail", "missing");
  const first = store.commitMapCommand("a", rejected, "tester");
  await store.close();
  fs.appendFileSync(path.join(dir, "sync-rejections.jsonl"), '{"afterSeq":');
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitMapCommand("a", rejected, "tester")).toEqual(first);
});

test("legacy commit index merges map and sync receipts and reports cross-map collisions", async () => {
  const cmd = edit("old-index", "initial", "one");
  expect(store.commitSyncCommand({ mapId: "a", command: cmd }, "tester").ok).toBe(true);
  expect(store.commitMapCommand("b", edit("other-index", "initial", "two", "b"), "tester").ok).toBe(true);
  const line = store.committedCommand("a", cmd.commandId)!;
  store.compact();
  await store.close();
  const file = path.join(dir, "commit-index.json");
  const index = JSON.parse(fs.readFileSync(file, "utf8"));
  delete index.commandResults;
  index.commands = [["", cmd.commandId, 1, line.syncHash], ["a", cmd.commandId, 1, line.changesHash], ["b", cmd.commandId, 2, "different"]];
  fs.writeFileSync(file, JSON.stringify(index));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  store = RecordWorkspaceStore.open(dir);
  expect(store.commitMapCommand("a", cmd, "tester")).toMatchObject({ ok: true, seq: 1, replayed: true });
  expect(store.commitSyncCommand({ mapId: "a", command: cmd }, "tester")).toMatchObject({ ok: true, seq: 1, replayed: true });
  expect(warning.mock.calls.flat().join(" ")).toMatch(/collision.*1/i);
});

test.each([false, true])("interrupted compaction cannot resurrect a forgotten tentative receipt (old snapshot=%s)", async oldSnapshot => {
  const snapshotFile = path.join(dir, "snapshot.jsonl");
  const snapshot = fs.readFileSync(snapshotFile);
  const initial = store.record("node|a");
  const cmd = edit("rebased", "initial", "one");
  expect(store.commitMapCommand("a", cmd, "tester").ok).toBe(true);
  store.resetRecords(["node|a"], () => initial, [{ mapId: "a", commandId: cmd.commandId }]);
  const replay = store.commitMapCommand("a", cmd, "tester");
  expect(replay).toMatchObject({ ok: true, seq: 3, replayed: false });
  const journalFile = path.join(dir, "journal.jsonl");
  const journal = fs.readFileSync(journalFile);
  store.compact();
  await store.close();
  // The durable index was installed; the process stopped before replacing the journal
  // (and, in one case, before replacing the snapshot).
  fs.writeFileSync(journalFile, journal);
  if (oldSnapshot) fs.writeFileSync(snapshotFile, snapshot);
  store = RecordWorkspaceStore.open(dir, { compactAfterLines: 0 });
  expect(store.commitMapCommand("a", cmd, "tester")).toMatchObject({ ok: true, seq: 3, replayed: true });
});
