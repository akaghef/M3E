import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../../src/node/snapshot_cli";

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) } };
}

function writeDb(file: string, maps: Array<{ id: string; state: unknown }>, legacyColumns = false): void {
  const db = new Database(file);
  db.exec(legacyColumns
    ? "CREATE TABLE maps (id TEXT PRIMARY KEY, version INTEGER NOT NULL, saved_at TEXT NOT NULL, state_json TEXT NOT NULL)"
    : "CREATE TABLE maps (id TEXT PRIMARY KEY, version INTEGER NOT NULL, saved_at TEXT NOT NULL, state_json TEXT NOT NULL, tags TEXT, archived INTEGER, pinned INTEGER, source TEXT)");
  const insert = legacyColumns
    ? db.prepare("INSERT INTO maps (id, version, saved_at, state_json) VALUES (?, 1, '2026-10-01T00:00:00.000Z', ?)")
    : db.prepare("INSERT INTO maps (id, version, saved_at, state_json, tags, archived, pinned, source) VALUES (?, 1, '2026-10-01T00:00:00.000Z', ?, '[\"t\"]', 0, 1, NULL)");
  for (const map of maps) insert.run(map.id, JSON.stringify(map.state));
  db.close();
}

const node = (id: string, parentId: string | null, children: string[] = []) =>
  ({ id, parentId, children, text: id, collapsed: false, details: "", note: "", attributes: {}, link: "" });
const goodState = { rootId: "root", nodes: { root: node("root", null, ["a"]), a: node("a", "root") } };

describe("snapshot CLI", () => {
  let dir = "";
  const saved = { HOME: process.env.HOME, guard: process.env.M3E_FORBID_LIVE_DATA };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-snapshot-cli-"));
    process.env.M3E_FORBID_LIVE_DATA = "1";
  });

  afterEach(() => {
    if (saved.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = saved.HOME;
    if (saved.guard === undefined) delete process.env.M3E_FORBID_LIVE_DATA;
    else process.env.M3E_FORBID_LIVE_DATA = saved.guard;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes the snapshot, prints counts, and restores it as JSON", () => {
    const db = path.join(dir, "data.sqlite");
    const out = path.join(dir, "out", "snapshot.jsonl");
    writeDb(db, [{ id: "m2", state: goodState }, { id: "m1", state: goodState }]);
    const before = fs.readFileSync(db);
    const run = io();
    expect(main(["--db", db, "--workspace", "ws", "--out", out, "--now", "2026-11-17T00:00:00.000Z"], run.io)).toBe(0);
    expect(fs.readFileSync(db).equals(before)).toBe(true);
    expect(run.out).toContain("map: 2");
    expect(run.out).toContain("node: 4");
    expect(run.out).toContain("idMap: 2");
    expect(run.out).toContain("invariant problems: 0");
    const lines = fs.readFileSync(out, "utf8").trimEnd().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toEqual({ kind: "snapshot", format: 1, workspaceId: "ws", seq: 0 });
    expect(lines.find((l) => l.kind === "map" && l.id === "m1")).toEqual({
      kind: "map", id: "m1", rootNodeId: "root", tags: '["t"]', archived: 0, pinned: 1, legacyVersion: 1,
      legacySavedAt: "2026-10-01T00:00:00.000Z", rev: 0,
    });

    const again = path.join(dir, "again.jsonl");
    expect(main(["--db", db, "--workspace", "ws", "--out", again, "--now", "2026-11-17T00:00:00.000Z"], io().io)).toBe(0);
    expect(fs.readFileSync(again, "utf8")).toBe(fs.readFileSync(out, "utf8"));

    const json = path.join(dir, "restored.json");
    expect(main(["--restore", out, "--out-json", json], io().io)).toBe(0);
    const restored = JSON.parse(fs.readFileSync(json, "utf8"));
    expect(restored.workspaceId).toBe("ws");
    expect(restored.rows.map((r: { id: string }) => r.id)).toEqual(["m1", "m2"]);
    expect(restored.rows[0].state.nodes.root.children).toEqual(["a"]);
  });

  it("reads a database that predates the tags / archived / pinned / source columns", () => {
    const db = path.join(dir, "old.sqlite");
    writeDb(db, [{ id: "m1", state: goodState }], true);
    expect(main(["--db", db, "--workspace", "ws", "--out", path.join(dir, "o.jsonl")], io().io)).toBe(0);
  });

  it("exits 1 when the invariants fail, after writing the file", () => {
    const db = path.join(dir, "bad.sqlite");
    const out = path.join(dir, "bad.jsonl");
    writeDb(db, [{ id: "m1", state: { rootId: "root", nodes: { root: node("root", null), lost: node("lost", "nowhere") } } }]);
    const run = io();
    expect(main(["--db", db, "--workspace", "ws", "--out", out], run.io)).toBe(1);
    // the lost edge has no parent and reaches no scope
    expect(run.out).toContain("invariant problems: 2");
    expect(fs.existsSync(out)).toBe(true);
  });

  it("refuses the personal workspace while the guard is set, and bad usage", () => {
    const home = path.join(dir, "home");
    const live = path.join(home, "Library", "Application Support", "M3E", "workspaces", "w");
    fs.mkdirSync(live, { recursive: true });
    const db = path.join(live, "data.sqlite");
    writeDb(db, [{ id: "m1", state: goodState }]);
    process.env.HOME = home;
    expect(os.homedir()).toBe(home);
    const out = path.join(dir, "refused.jsonl");
    const run = io();
    expect(main(["--db", db, "--workspace", "ws", "--out", out], run.io)).toBe(2);
    expect(run.err.join("\n")).toMatch(/Refusing/);
    expect(fs.existsSync(out)).toBe(false);

    expect(main(["--db", path.join(dir, "missing.sqlite"), "--workspace", "ws", "--out", out], io().io)).toBe(2);
    expect(main(["--workspace", "ws"], io().io)).toBe(2);
    expect(main(["--restore", out], io().io)).toBe(2);
    expect(main(["stray"], io().io)).toBe(2);
  });
});
