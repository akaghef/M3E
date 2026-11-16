import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, expect, test } from "vitest";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { commitMapCommand } from "../../src/node/map_commit";
import { diffState } from "../../src/shared/map_changes";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-commit-revision-"));
  dirs.push(dir);
  const dbPath = path.join(dir, "data.sqlite");
  const model = new RapidMvpModel("Root");
  const a = model.addNode(model.state.rootId, "A");
  model.saveToSqlite(dbPath, "m");
  return { dbPath, a };
}

function logRows(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true });
  try { return (db.prepare("SELECT COUNT(*) AS n FROM command_log").get() as { n: number }).n; }
  finally { db.close(); }
}

test("a stale whole-map revision rejects the Command and writes neither the state nor the journal row", () => {
  const { dbPath, a } = fixture();
  const read = RapidMvpModel.loadSavedMapFromSqlite(dbPath, "m");
  const staleRevision = RapidMvpModel.savedRevision(read);

  // Another writer commits first, on a different node.
  const other = RapidMvpModel.fromJSON(read.state);
  other.addNode(other.state.rootId, "Other writer");
  other.saveToSqlite(dbPath, "m");
  const afterOther = RapidMvpModel.loadSavedMapFromSqlite(dbPath, "m");

  const edited = structuredClone(read.state);
  edited.nodes[a]!.text = "Mine";
  const command = { commandId: "c-stale", actor: { kind: "ai-agent" as const, id: "ctx" }, intent: "rename", changes: diffState(read.state, edited) };
  const result = commitMapCommand(dbPath, "m", command, staleRevision);

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe("CONFLICT");
  expect(RapidMvpModel.loadSavedMapFromSqlite(dbPath, "m")).toEqual(afterOther);
  expect(logRows(dbPath)).toBe(0);

  // The rejected commandId was not consumed: the same Command commits at the current revision.
  const retry = commitMapCommand(dbPath, "m", command, RapidMvpModel.savedRevision(afterOther));
  expect(retry.ok).toBe(true);
  const final = RapidMvpModel.loadSavedMapFromSqlite(dbPath, "m");
  expect(final.state.nodes[a]!.text).toBe("Mine");
  expect(Object.values(final.state.nodes).map((item) => item.text).sort()).toEqual(["Mine", "Other writer", "Root"]);
  expect(logRows(dbPath)).toBe(1);
});
