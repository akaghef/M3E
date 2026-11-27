import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { diffState } from "../../src/shared/map_changes";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { command, node, clone } from "./record_store_helpers";
import { SaveStateTracker } from "../../src/browser/save_command";
const open: RecordWorkspaceStore[] = [];
const dirs: string[] = [];
afterEach(async () => { for (const store of open.splice(0)) await store.close(); for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function store(count = 30) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-parent-command-")); dirs.push(dir);
  const nodes: any = { root: node("root", null, []), dest: node("dest", "root") };
  nodes.root.children.push("dest");
  for (let i = 0; i < count; i++) { const id = `n${i}`; nodes[id] = node(id, "root"); nodes.root.children.push(id); }
  RecordWorkspaceStore.create(dir, toSnapshot("parent-commands", [{ id: "m", state: { rootId: "root", nodes } }]));
  const s = RecordWorkspaceStore.open(dir); open.push(s); return { s, dir };
}
function move(state: any, id: string, parent: string, index = 0) {
  const old = state.nodes[state.nodes[id].parentId]; old.children = old.children.filter((child: string) => child !== id);
  state.nodes[id].parentId = parent; state.nodes[parent].children.splice(index, 0, id);
}
test("move, insert and reorder carry only the changed parent edge, independent of sibling count", () => {
  for (const count of [10, 20000]) {
    const { s } = store(count);
    const before = s.getMapRow("m").state;
    for (const mutate of [
      (next: any) => move(next, "n1", "dest"),
      (next: any) => move(next, "n1", "root", count - 1),
      (next: any) => { next.nodes.added = node("added", "root"); next.nodes.root.children.splice(2, 0, "added"); },
    ]) {
      const next = clone(before); mutate(next);
      const edges = diffState(before, next).filter(c => c.kind === "edge");
      expect(edges).toHaveLength(1);
      expect(JSON.stringify(edges)).not.toContain('"index"');
    }
  }
});
test("concurrent moves of the same node are LWW in confirmed seq order", () => {
  const { s } = store();
  const before = s.getMapRow("m").state;
  const a = clone(before), b = clone(before), stale = clone(before);
  move(a, "n1", "dest"); move(b, "n2", "dest"); move(stale, "n1", "root", 20);
  expect(s.commitMapCommand("m", command(diffState(before, a)), "human").ok).toBe(true);
  // Different nodes can choose different positions in the same destination.
  move(b, "n2", "root", 25);
  expect(s.commitMapCommand("m", command(diffState(before, b)), "human").ok).toBe(true);
  const last = s.commitMapCommand("m", command(diffState(before, stale)), "human");
  expect(last).toMatchObject({ ok: true });
  const actual = s.getMapRow("m").state;
  expect(actual.nodes.n1.parentId).toBe("root");
  expect(actual.nodes.root.children.indexOf("n1")).toBeGreaterThan(actual.nodes.root.children.indexOf("n19"));
  expect(actual.nodes.dest.children).not.toContain("n1");
});
test("legacy index Commands retain simultaneous index semantics across reopen", async () => {
  const { s, dir } = store(3);
  const before = s.getMapRow("m").state;
  const legacy = command([
    { kind: "edge", key: ["n0"], op: "update", before: { index: 1 }, after: { index: 3 } },
    { kind: "edge", key: ["n1"], op: "update", before: { index: 2 }, after: { index: 1 } },
    { kind: "edge", key: ["n2"], op: "update", before: { index: 3 }, after: { index: 2 } },
  ]);
  expect(s.commitMapCommand("m", legacy, "human").ok).toBe(true);
  expect(s.getMapRow("m").state.nodes.root.children).toEqual(["dest", "n1", "n2", "n0"]);
  await s.close(); open.splice(open.indexOf(s), 1);
  const reopened = RecordWorkspaceStore.open(dir); open.push(reopened);
  expect(reopened.getMapRow("m").state.nodes.root.children).toEqual(["dest", "n1", "n2", "n0"]);
  expect(before.nodes.root.children).toEqual(["dest", "n0", "n1", "n2"]);
});
test("a viewer can save two consecutive reorders without readback or self-conflict", () => {
  const { s } = store();
  const base = s.getMapRow("m").state, live = clone(base);
  const tracker = new SaveStateTracker(base, live);
  for (const index of [20, 2, 15]) {
    move(live, "n1", "root", index); tracker.mark({ nodes: ["root", "n1"] });
    const captured = tracker.capture();
    expect(s.commitMapCommand("m", command(captured.changes), "human").ok).toBe(true); captured.accept();
    expect(s.getMapRow("m").state.nodes.root.children).toEqual(live.nodes.root.children);
  }
});

test("legacy requests write keyed journals and outbox entries and retain retry identity after compaction", async () => {
  const { s, dir } = store(3);
  const captured: any[] = []; s.setCapture(payload => captured.push(payload));
  const legacy = command([
    { kind: "edge", key: ["n0"], op: "update", before: { index: 1 }, after: { index: 3 } },
    { kind: "edge", key: ["n1"], op: "update", before: { index: 2 }, after: { index: 1 } },
    { kind: "edge", key: ["n2"], op: "update", before: { index: 3 }, after: { index: 2 } },
  ]);
  expect(s.commitMapCommand("m", legacy, "human").ok).toBe(true);
  expect(JSON.stringify(s.committedCommand("m", legacy.commandId)?.changes)).not.toContain('"index"');
  expect(JSON.stringify(captured[0].command.changes)).not.toContain('"index"');
  expect(captured[0].command.changes).toHaveLength(1);
  for (const cmd of [legacy, captured[0].command]) expect(s.commitMapCommand("m", cmd, "human")).toMatchObject({ ok: true, replayed: true });
  s.compact(); await s.close(); open.splice(open.indexOf(s), 1);
  const again = RecordWorkspaceStore.open(dir); open.push(again);
  for (const cmd of [legacy, captured[0].command]) expect(again.commitMapCommand("m", cmd, "human")).toMatchObject({ ok: true, replayed: true });
});

test("LWW keeps content CAS and rejects a stale move that would now make a cycle", () => {
  const { s } = store();
  const before = s.getMapRow("m").state;
  const first = clone(before); move(first, "dest", "n1"); first.nodes.n1.text = "other writer";
  expect(s.commitMapCommand("m", command(diffState(before, first)), "human").ok).toBe(true);
  const cycle = clone(before); move(cycle, "n1", "dest");
  expect(s.commitMapCommand("m", command(diffState(before, cycle)), "human")).toMatchObject({ ok: false, code: "INVALID_STATE" });
  const content = clone(before); move(content, "n1", "root", 20); content.nodes.n1.text = "stale writer";
  expect(s.commitMapCommand("m", command(diffState(before, content)), "human")).toMatchObject({ ok: false, code: "CONFLICT" });
  expect(s.getMapRow("m").state.nodes.n1.text).toBe("other writer");
});
test("projection write-back retains position CAS", () => {
  const { s } = store();
  const before = s.getMapRow("m").state, a = clone(before), b = clone(before);
  move(a, "n1", "dest"); move(b, "n1", "root", 20);
  expect(s.commitMapCommand("m", command(diffState(before, a)), "human").ok).toBe(true);
  expect(s.commitMapCommand("m", { ...command(diffState(before, b)), intent: "write-back" }, "human")).toMatchObject({ ok: false, code: "CONFLICT" });
});
