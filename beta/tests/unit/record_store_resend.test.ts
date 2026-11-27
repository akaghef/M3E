import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { pushCommands } from "../../src/node/sync/push";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { command } from "./record_store_helpers";
import { createTestStore, dropTestStores, type TestStore } from "./neo4j_test_store";

let handle: TestStore;
let store: RecordWorkspaceStore;
const edit = (id: string, before = "ready", after = "done", node = "a") => command([
  { kind: "node", key: [node], op: "update", before: { text: before }, after: { text: after } },
], "edit", id);
beforeEach(async () => {
  handle = await createTestStore(toSnapshot("workspace", ["a", "b"].map(id => ({ id, state: {
    rootId: id, nodes: { [id]: { id, parentId: null, children: [], nodeType: "text", text: "initial" } },
  } }))), { compactAfterLines: 0 });
  store = handle.store;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await dropTestStores();
});
function ready() { expect(store.commitMapCommand("a", edit("prepare", "initial", "ready"), "tester").ok).toBe(true); }

test("DD4: CONFLICT remains the exact first result after state changes, including across map rename", () => {
  const cmd = edit("rejected");
  const first = store.commitMapCommand("a", cmd, "tester");
  expect(first).toMatchObject({ ok: false, code: "CONFLICT" });
  ready();
  store.renameMapId("a", "renamed", "tester");
  const length = store.seq();
  expect(store.commitMapCommand("renamed", cmd, "tester")).toEqual(first);
  expect(store.seq()).toBe(length);
  expect(store.commitMapCommand("renamed", edit("rejected", "ready", "different"), "tester"))
    .toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
});

test("DD4: rejection survives reopen", async () => {
  const cmd = edit("durable");
  const first = store.commitMapCommand("a", cmd, "tester");
  ready();
  store = await handle.reopen();
  expect(store.commitMapCommand("a", cmd, "tester")).toEqual(first);
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
  store = await handle.reopen();
  expect(store.commitMapCommand("b", other, "tester")).toMatchObject({ ok: false, code: "SAME_ID_DIFFERENT_CONTENT" });
});

test.each([false, true])("push uses store's remembered rejection (fenced=%s)", async fenced => {
  const cmd = edit("push-refused");
  const payload = { mapId: "a", command: cmd, commandId: cmd.commandId, baseSeq: 0 };
  const first = pushCommands(store, "", [payload], "tester", fenced);
  expect(first.results[0].code).toBe("CONFLICT");
  ready();
  const copy = await handle.reopen();
  expect(pushCommands(copy, "", [payload], "tester", fenced)).toEqual(first);
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
  store = await handle.reopen();
  expect(store.commitMapCommand("a", cmd, "tester")).toMatchObject({ ok: true, replayed: false });
  expect(store.commitMapCommand("a", rejected, "tester")).toEqual(first);
});

test("no-op can be replayed after local rebase, including repeated reopen", async () => {
  ready();
  const cmd = edit("no-op", "initial", "ready");
  expect(store.commitSyncCommand({ mapId: "a", command: cmd }, "tester")).toMatchObject({ ok: true, noOp: true });
  store.resetRecords([], () => undefined, [{ mapId: "a", commandId: cmd.commandId }]);
  expect(store.commitMapCommand("a", edit("back", "ready", "initial"), "tester").ok).toBe(true);
  store = await handle.reopen();
  const replay = store.commitSyncCommand({ mapId: "a", command: cmd }, "tester");
  expect(replay).toMatchObject({ ok: true, replayed: false });
  expect(replay).not.toHaveProperty("noOp");
  store = await handle.reopen();
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
  store = await handle.reopen();
  expect(store.commitMapCommand("renamed", cmd, "tester")).toMatchObject({ ok: true, replayed: true });
});
