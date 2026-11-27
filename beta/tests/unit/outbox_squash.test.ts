import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DeviceOutbox, pushEnvelope } from "../../src/node/sync/outbox";
import { applyChanges, diffState, type RecordChange } from "../../src/shared/map_changes";

let dir: string;
let file: string;
let box: DeviceOutbox;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-squash-"));
  file = path.join(dir, "outbox.jsonl");
  box = DeviceOutbox.open(file);
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(dir, { recursive: true, force: true }); });
function append(id: string, changes: RecordChange[], issuer = "human") {
  return box.append({ commandId: id, mapId: "map", baseSeq: 0, issuer,
    command: { commandId: id, actor: { kind: "human", id: "actor" }, intent: "edit", changes } });
}
function update(id: string, before: string, after: string, issuer = "human") {
  return append(id, [{ kind: "node", key: ["n"], op: "update", before: { text: before }, after: { text: after } }], issuer);
}
async function sent() {
  let sent: any[] = [];
  await box.drain(async (entries) => { sent = entries; return { results: [] }; });
  return sent;
}
test("create then delete before push sends no Command or node contents", async () => {
  append("create", [{ kind: "node", key: ["n"], op: "create", after: { text: "private" } }]);
  append("delete", [{ kind: "node", key: ["n"], op: "delete", before: { text: "private" } }]);
  expect(await sent()).toEqual([]);
  expect(box.list()).toEqual([]);
});
test("three updates use a new commandId, first before and last after", async () => {
  update("a", "0", "1"); update("b", "1", "2"); update("c", "2", "3");
  const pending = await sent();
  expect(pending).toHaveLength(1);
  expect(pending[0].command.changes).toEqual([{ kind: "node", key: ["n"], op: "update", before: { text: "0" }, after: { text: "3" } }]);
  expect(["a", "b", "c"]).not.toContain(pending[0].commandId);
  expect(pending[0].command.commandId).toBe(pending[0].commandId);
  expect(pushEnvelope(box.list()[0])).not.toHaveProperty("attempted");
});
test("an attempted Command survives a lost reply and reopening without squashing", async () => {
  const first = update("a", "0", "1");
  await expect(box.drain(async () => { throw new Error("lost response"); })).rejects.toThrow("lost response");
  box = DeviceOutbox.open(file);
  expect(box.list()[0].attempted).toBe(true);
  update("b", "1", "2");
  expect((await sent()).map((entry) => entry.commandId)).toEqual(["a", "b"]);
  expect(box.list()[0].command).toEqual(first.command);
});
test("map rename and issuer changes separate squash runs", async () => {
  update("a", "0", "1"); update("a2", "1", "2");
  box.append({ commandId: "rename", baseSeq: 0, mapId: "map", mapOp: "rename", newMapId: "renamed",
    command: { commandId: "rename", actor: { kind: "human", id: "actor" }, intent: "rename", changes: [] } });
  update("b", "2", "3"); update("b2", "3", "4"); update("c", "4", "5", "other");
  const pending = await sent();
  expect(pending).toHaveLength(4);
  expect(pending[1].commandId).toBe("rename");
  expect(pending[0].command.changes[0]).toMatchObject({ before: { text: "0" }, after: { text: "2" } });
  expect(pending[2].command.changes[0]).toMatchObject({ before: { text: "2" }, after: { text: "4" } });
  expect(pending[3].commandId).toBe("c");
});
test("protected conflicts and blocked Commands, and legacy entries, remain exact", () => {
  update("a", "0", "1"); update("b", "1", "2"); update("c", "2", "3");
  const before = fs.readFileSync(file, "utf8");
  expect(box.squash(new Set(["b"]))).toBe(false);
  expect(fs.readFileSync(file, "utf8")).toBe(before);
  fs.writeFileSync(file, before.replaceAll(',"attempted":false', ""));
  expect(box.squash()).toBe(false);
});
test("a failed atomic rename leaves the complete old outbox and never sends", async () => {
  update("a", "0", "1"); update("b", "1", "2");
  const before = fs.readFileSync(file, "utf8");
  vi.spyOn(fs, "renameSync").mockImplementation(() => { throw new Error("crash before rename"); });
  const send = vi.fn();
  await expect(box.drain(send)).rejects.toThrow("crash before rename");
  expect(send).not.toHaveBeenCalled();
  expect(fs.readFileSync(file, "utf8")).toBe(before);
});
test("composes field additions/removals and dependent node/edge/attribute changes without changing state", async () => {
  const before: any = { rootId: "r", nodes: { r: { id: "r", text: "root", parentId: null, children: [], attributes: {} } }, links: {} };
  const one = structuredClone(before);
  one.nodes.r.children = ["n"];
  one.nodes.n = { id: "n", parentId: "r", children: [], text: "one", attributes: { x: 1 } };
  const two = structuredClone(one);
  two.nodes.n.text = "two"; two.nodes.n.attributes.x = 2;
  two.nodes.r.note = "added";
  const three = structuredClone(two);
  delete three.nodes.n; three.nodes.r.children = []; delete three.nodes.r.note;
  three.nodes.r.text = "last";
  append("a", diffState(before, one)); append("b", diffState(one, two)); append("c", diffState(two, three));
  const pending = await sent();
  expect(pending).toHaveLength(1);
  expect(applyChanges(before, pending[0].command.changes)).toEqual({ ok: true, state: three });
});
