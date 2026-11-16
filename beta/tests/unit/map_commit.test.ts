import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";
import { applyChanges, diffState, type MapCommand } from "../../src/shared/map_changes";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { commitMapCommand, readCommittedCommand } from "../../src/node/map_commit";

const dirs: string[] = [];

function tempDb(): { dir: string; dbPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-map-commit-"));
  dirs.push(dir);
  return { dir, dbPath: path.join(dir, "data.sqlite") };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function command(id: string, before: object, after: object, intent = "assert"): MapCommand {
  return {
    commandId: id,
    actor: { kind: "human", id: "tester" },
    intent,
    provenance: { tabId: "tester" },
    changes: diffState(before, after),
  };
}

function storedState(dbPath: string, mapId: string): object {
  return RapidMvpModel.loadSavedMapFromSqlite(dbPath, mapId).state;
}

describe("commitMapCommand", () => {
  test("replays the same command without applying it twice", () => {
    const { dbPath } = tempDb();
    const mapId = "replay";
    RapidMvpModel.createMap(dbPath, mapId, "Root");
    const before = storedState(dbPath, mapId);
    const model = RapidMvpModel.fromJSON(before as never);
    const child = model.addNode(model.state.rootId, "Child");
    const after = model.toJSON();
    const first = commitMapCommand(dbPath, mapId, command("same", before, after, "assert"));
    expect(first).toMatchObject({ ok: true, seq: 1, replayed: false });
    const second = commitMapCommand(dbPath, mapId, command("same", after, after, "assert"));
    expect(second).toMatchObject({ ok: true, replayed: true, seq: 1 });
    if (first.ok && second.ok) expect(second.savedAt).toBe(first.savedAt);
    expect(storedState(dbPath, mapId).nodes[child]!.text).toBe("Child");
    expect(Object.keys(storedState(dbPath, mapId).nodes)).toHaveLength(2);
    const log = new Database(dbPath, { readonly: true });
    expect((log.prepare("SELECT COUNT(*) AS n FROM command_log").get() as { n: number }).n).toBe(1);
    log.close();
  });

  test("writes nothing when a touched field conflicts or validation fails", () => {
    const { dbPath } = tempDb();
    const mapId = "reject";
    RapidMvpModel.createMap(dbPath, mapId, "Root");
    const before = storedState(dbPath, mapId);
    const childId = RapidMvpModel.fromJSON(before as never).addNode(
      (before as { rootId: string }).rootId,
      "Child",
    );
    // Persist the child through a command so the base is the stored map.
    const withChild = RapidMvpModel.loadFromSqlite(dbPath, mapId);
    // The addNode above was on a detached model. Build the stored child explicitly.
    const baseModel = RapidMvpModel.fromJSON(before as never);
    const id = baseModel.addNode(baseModel.state.rootId, "Child");
    expect(commitMapCommand(dbPath, mapId, command("add", before, baseModel.toJSON())).ok).toBe(true);
    const base = storedState(dbPath, mapId);
    const left = structuredClone(base) as typeof base & { nodes: Record<string, { text: string }> };
    const right = structuredClone(base) as typeof base & { nodes: Record<string, { text: string; parentId: string | null }> };
    left.nodes[id]!.text = "Left";
    right.nodes[id]!.text = "Right";
    expect(commitMapCommand(dbPath, mapId, command("left", base, left, "rename")).ok).toBe(true);
    const conflict = commitMapCommand(dbPath, mapId, command("right", base, right, "rename"));
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("CONFLICT");
    expect(storedState(dbPath, mapId).nodes[id]!.text).toBe("Left");

    const broken = structuredClone(storedState(dbPath, mapId)) as { rootId: string; nodes: Record<string, { parentId: string | null }> };
    broken.nodes[broken.rootId]!.parentId = id;
    const invalid = commitMapCommand(dbPath, mapId, command("cycle", storedState(dbPath, mapId), broken));
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe("INVALID_STATE");
    expect(storedState(dbPath, mapId).nodes[broken.rootId]!.parentId).toBeNull();
    const log = new Database(dbPath, { readonly: true });
    const rows = log.prepare("SELECT command_id FROM command_log ORDER BY seq").all() as Array<{ command_id: string }>;
    log.close();
    expect(rows.map((row) => row.command_id)).toEqual(["add", "left"]);
    expect(readCommittedCommand(dbPath, mapId, "right")).toBeNull();
    expect(readCommittedCommand(dbPath, mapId, "cycle")).toBeNull();
    expect(childId).toBeTruthy();
  });

  test("keeps command_log sequence continuous and replayable from the empty state", () => {
    const { dbPath } = tempDb();
    const mapId = "journal";
    RapidMvpModel.createMap(dbPath, mapId, "Root");
    const db = new Database(dbPath);
    db.prepare("UPDATE maps SET state_json = ? WHERE id = ?").run("{}", mapId);
    db.close();
    const empty = {};
    const model = new RapidMvpModel("Root");
    const child = model.addNode(model.state.rootId, "One");
    model.editNode(child, "One");
    const firstState = model.toJSON();
    const second = RapidMvpModel.fromJSON(firstState);
    second.editNode(child, "Two");
    const secondState = second.toJSON();
    const third = RapidMvpModel.fromJSON(secondState);
    third.addNode(child, "Nested");
    const thirdState = third.toJSON();
    expect(commitMapCommand(dbPath, mapId, command("a", empty, firstState)).ok).toBe(true);
    expect(commitMapCommand(dbPath, mapId, command("b", firstState, secondState, "rename")).ok).toBe(true);
    expect(commitMapCommand(dbPath, mapId, command("c", secondState, thirdState, "assert")).ok).toBe(true);
    const log = new Database(dbPath, { readonly: true });
    const rows = log.prepare("SELECT seq, changes FROM command_log WHERE map_id = ? ORDER BY seq").all(mapId) as Array<{ seq: number; changes: string }>;
    log.close();
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3]);
    let state: object = {};
    for (const row of rows) {
      const applied = applyChanges(state, JSON.parse(row.changes));
      expect(applied.ok).toBe(true);
      if (applied.ok) state = applied.state;
    }
    expect(state).toEqual(storedState(dbPath, mapId));
    expect(storedState(dbPath, mapId)).toEqual(thirdState);
  });
});
