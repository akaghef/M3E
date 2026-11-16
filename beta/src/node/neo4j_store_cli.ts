// Neo4j store CLI.
//   node dist/node/neo4j_store_cli.js --load <jsonl path> --bolt <uri> [--batch <rows>] [--database <name>]
//   node dist/node/neo4j_store_cli.js --dump <jsonl path> --bolt <uri> [--database <name>]
// --bolt has no default. --load refuses a database that already holds records.
// Credentials, when the server needs them, come from M3E_NEO4J_USER / M3E_NEO4J_PASSWORD.
// Exit code 1 means the load or dump failed, 2 means bad usage or a refusal.

import fs from "fs";
import os from "os";
import path from "path";
import neo4j from "neo4j-driver";
import { parseSnapshot, serializeSnapshot } from "../shared/record_model/jsonl";
import { compareStrings, type SnapshotRecord } from "../shared/record_model/types";
import { dump, load, type StoreOptions } from "./neo4j_store/store";

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = "Usage: --load <jsonl path> --bolt <uri> [--batch <rows>] [--database <name>] | --dump <jsonl path> --bolt <uri> [--database <name>]";

function assertNotLiveM3e(filePath: string): void {
  if (process.env.M3E_FORBID_LIVE_DATA !== "1") return;
  const live = path.join(os.homedir(), "Library", "Application Support", "M3E");
  const resolved = path.resolve(filePath);
  if (resolved === live || resolved.startsWith(live + path.sep)) {
    throw new Error("Refusing to touch the live M3E data directory.");
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

function countByKind(records: SnapshotRecord[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => compareStrings(a[0], b[0]));
}

function seconds(startedAt: number): string {
  return ((Date.now() - startedAt) / 1000).toFixed(2);
}

export async function main(argv: string[], io: CliIo = { out: console.log, err: console.error }): Promise<number> {
  let loadPath: string | undefined;
  let dumpPath: string | undefined;
  let bolt: string;
  const options: StoreOptions = {};
  try {
    const args = parseArgs(argv);
    loadPath = args.get("load");
    dumpPath = args.get("dump");
    const boltArg = args.get("bolt");
    if ((loadPath === undefined) === (dumpPath === undefined) || boltArg === undefined) throw new Error(USAGE);
    bolt = boltArg;
    const batch = args.get("batch");
    if (batch !== undefined) {
      options.batchSize = Number(batch);
      if (!Number.isInteger(options.batchSize) || options.batchSize < 1) throw new Error(`Bad --batch: ${batch}`);
    }
    options.database = args.get("database");
    assertNotLiveM3e(loadPath ?? dumpPath ?? "");
  } catch (error) {
    io.err((error as Error).message);
    return 2;
  }

  const user = process.env.M3E_NEO4J_USER;
  const auth = user ? neo4j.auth.basic(user, process.env.M3E_NEO4J_PASSWORD ?? "") : undefined;
  const driver = neo4j.driver(bolt, auth);
  const startedAt = Date.now();
  try {
    if (loadPath !== undefined) {
      const records = parseSnapshot(fs.readFileSync(loadPath, "utf8"));
      io.out(`read ${records.length} records from ${loadPath} (${seconds(startedAt)} s)`);
      const loadStartedAt = Date.now();
      const result = await load(driver, records, options);
      for (const [kind, count] of Object.entries(result.recordCounts)) io.out(`${kind}: ${count}`);
      for (const [type, count] of Object.entries(result.relationshipCounts)) io.out(`[:${type}]: ${count}`);
      io.out(`loaded records: ${result.records}, relationships: ${result.relationships}`);
      io.out(`load elapsed: ${seconds(loadStartedAt)} s (total ${seconds(startedAt)} s)`);
    } else if (dumpPath !== undefined) {
      const records = await dump(driver, options);
      const readSeconds = seconds(startedAt);
      const text = serializeSnapshot(records);
      fs.mkdirSync(path.dirname(path.resolve(dumpPath)), { recursive: true });
      fs.writeFileSync(dumpPath, text, "utf8");
      for (const [kind, count] of countByKind(records)) io.out(`${kind}: ${count}`);
      io.out(`dumped records: ${records.length}, bytes: ${Buffer.byteLength(text, "utf8")}`);
      io.out(`dump elapsed: ${seconds(startedAt)} s (read from Neo4j ${readSeconds} s)`);
    }
    return 0;
  } catch (error) {
    const message = (error as Error).message;
    io.err(message);
    return message.startsWith("Refusing to load") ? 2 : 1;
  } finally {
    await driver.close();
  }
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
