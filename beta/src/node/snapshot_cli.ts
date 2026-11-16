// Snapshot CLI.
//   node dist/node/snapshot_cli.js --db <sqlite path> --workspace <id> --out <jsonl path> [--now <iso time>]
//   node dist/node/snapshot_cli.js --restore <jsonl path> --out-json <path>
// The database is opened read-only. Exit code 1 means the invariants failed, 2 means bad usage or a refusal.

import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { fromSnapshot } from "../shared/record_model/from_snapshot";
import { checkInvariants } from "../shared/record_model/invariants";
import { parseSnapshot, serializeSnapshot } from "../shared/record_model/jsonl";
import { toSnapshot } from "../shared/record_model/to_snapshot";
import { compareStrings, type SnapshotRecord, type SnapshotRow } from "../shared/record_model/types";

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const ROW_COLUMNS = ["id", "version", "saved_at", "state_json", "tags", "archived", "pinned", "source"];
const PROBLEM_PRINT_LIMIT = 50;

function assertNotLiveM3e(dbPath: string): void {
  if (process.env.M3E_FORBID_LIVE_DATA !== "1") return;
  const live = path.join(os.homedir(), "Library", "Application Support", "M3E");
  const resolved = path.resolve(dbPath);
  if (resolved === live || resolved.startsWith(live + path.sep)) {
    throw new Error("Refusing to open the live M3E database.");
  }
}

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i];
    const value = argv[i + 1];
    if (!name.startsWith("--") || value === undefined) throw new Error(`Bad argument: ${name}`);
    args.set(name.slice(2), value);
    i += 1;
  }
  return args;
}

export function readMapRows(dbPath: string): SnapshotRow[] {
  assertNotLiveM3e(dbPath);
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const existing = new Set((db.prepare("PRAGMA table_info(maps)").all() as Array<{ name: string }>).map((c) => c.name));
    if (!existing.has("id") || !existing.has("state_json")) throw new Error("Table maps with id and state_json not found.");
    const columns = ROW_COLUMNS.filter((column) => existing.has(column));
    const raw = db.prepare(`SELECT ${columns.join(", ")} FROM maps ORDER BY id`).all() as Array<Record<string, unknown>>;
    return raw.map((row) => {
      const { state_json: stateJson, ...rest } = row;
      return { ...rest, id: String(row.id), state: JSON.parse(String(stateJson)) } as SnapshotRow;
    });
  } finally {
    db.close();
  }
}

function countByKind(records: SnapshotRecord[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => compareStrings(a[0], b[0]));
}

function writeFile(target: string, text: string): void {
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.writeFileSync(target, text, "utf8");
}

export function main(argv: string[], io: CliIo = { out: console.log, err: console.error }): number {
  let args: Map<string, string>;
  try {
    args = parseArgs(argv);
  } catch (error) {
    io.err((error as Error).message);
    return 2;
  }
  try {
    const restore = args.get("restore");
    if (restore !== undefined) {
      const outJson = args.get("out-json");
      if (outJson === undefined) throw new Error("--restore needs --out-json <path>.");
      const result = fromSnapshot(parseSnapshot(fs.readFileSync(restore, "utf8")));
      writeFile(outJson, JSON.stringify(result, null, 2) + "\n");
      io.out(`restored maps: ${result.rows.length}`);
      return 0;
    }

    const dbPath = args.get("db");
    const workspaceId = args.get("workspace");
    const out = args.get("out");
    if (dbPath === undefined || workspaceId === undefined || out === undefined) {
      throw new Error("Usage: --db <sqlite path> --workspace <id> --out <jsonl path> | --restore <jsonl path> --out-json <path>");
    }
    const records = toSnapshot(workspaceId, readMapRows(dbPath), { now: args.get("now") });
    writeFile(out, serializeSnapshot(records));
    for (const [kind, count] of countByKind(records)) io.out(`${kind}: ${count}`);
    const problems = checkInvariants(records);
    io.out(`invariant problems: ${problems.length}`);
    for (const problem of problems.slice(0, PROBLEM_PRINT_LIMIT)) {
      io.err(`  [${problem.rule}] ${problem.kind} ${problem.key}: ${problem.message}`);
    }
    if (problems.length > PROBLEM_PRINT_LIMIT) io.err(`  ... ${problems.length - PROBLEM_PRINT_LIMIT} more`);
    return problems.length > 0 ? 1 : 0;
  } catch (error) {
    io.err((error as Error).message);
    return 2;
  }
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
