// Record store CLI. The store is in Neo4j. An export file is not a store.
//   node dist/node/record_store_cli.js --create <name> --from-export <jsonl> [--new-history]
//   node dist/node/record_store_cli.js --inspect <name>
//   node dist/node/record_store_cli.js --drop <name>
// The connection is M3E_NEO4J_BOLT / M3E_NEO4J_USER / M3E_NEO4J_PASSWORD / M3E_NEO4J_DATABASE.
// Exit code 0: done, nothing wrong. 1: inspection found a problem, or the run failed. 2: bad usage or a refusal.

import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { checkInvariants } from "../shared/record_model/invariants";
import { parseSnapshot } from "../shared/record_model/jsonl";
import { Neo4jDurability, neo4jConnectionFromEnv } from "./record_store/neo4j_durability";
import { RecordWorkspaceStore } from "./record_store/store";

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = "Usage: --create <name> --from-export <jsonl> [--new-history] | --inspect <name> | --drop <name>";

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
    if (name === "--new-history") {
      args.set("new-history", "true");
      continue;
    }
    const value = argv[i + 1];
    if (!name.startsWith("--") || value === undefined || value.startsWith("--")) throw new Error(`Bad argument: ${name}`);
    args.set(name.slice(2), value);
    i += 1;
  }
  return args;
}

export async function main(argv: string[], io: CliIo = { out: console.log, err: console.error }): Promise<number> {
  let args: Map<string, string>;
  let mode: "create" | "inspect" | "drop";
  try {
    args = parseArgs(argv);
    const modes = (["create", "inspect", "drop"] as const).filter((name) => args.has(name));
    if (modes.length !== 1) throw new Error("Give exactly one of --create, --inspect, --drop.");
    mode = modes[0];
    if (mode !== "create" && args.has("new-history")) throw new Error("--new-history requires --create.");
    if (mode === "create" && !args.has("from-export")) throw new Error("--create needs --from-export.");
    const removed = ["from-snapshot", "verify", "export", "bolt", "database", "out"].filter((name) => args.has(name));
    if (removed.length > 0) throw new Error(`The store is in Neo4j. --${removed[0]} is not used.`);
    const exportPath = args.get("from-export");
    if (exportPath !== undefined) assertNotLiveM3e(exportPath);
  } catch (error) {
    io.err((error as Error).message);
    io.err(USAGE);
    return 2;
  }

  try {
    const connection = neo4jConnectionFromEnv();
    if (!connection) throw new Error("M3E_NEO4J_BOLT is not set.");
    if (mode === "create") {
      const name = args.get("create")!;
      const records = parseSnapshot(fs.readFileSync(args.get("from-export")!, "utf8"));
      try {
        if (args.has("new-history")) {
          const header = records[0];
          if (header.kind !== "snapshot") throw new Error("Snapshot is missing its header.");
          const epoch = header.epoch ?? 1;
          if (!Number.isSafeInteger(epoch) || epoch < 1 || epoch >= Number.MAX_SAFE_INTEGER) throw new Error("Invalid snapshot epoch.");
          header.historyId = randomUUID();
          header.epoch = epoch + 1;
        }
        await RecordWorkspaceStore.createInNeo4j(connection, name, records);
      } catch (error) {
        io.err((error as Error).message);
        return 2;
      }
      io.out(`created ${name}: ${records.length} records`);
      return 0;
    }

    if (mode === "drop") {
      const name = args.get("drop")!;
      await Neo4jDurability.drop(connection, name);
      io.out(`dropped ${name}`);
      return 0;
    }

    const store = await RecordWorkspaceStore.openNeo4j(connection, args.get("inspect")!, { warm: false });
    let failed = false;
    try {
      const records = store.records();
      io.out(`workspace ${store.workspaceId}: ${records.length} records at commit ${store.seq()}, ${store.listMaps().length} maps`);
      const problems = checkInvariants(records);
      io.out(`invariant problems: ${problems.length}`);
      for (const problem of problems.slice(0, 50)) {
        io.err(`rule ${problem.rule}: ${problem.kind} ${problem.key}: ${problem.message}`);
      }
      if (problems.length > 0) failed = true;
    } finally {
      await store.close();
    }
    return failed ? 1 : 0;
  } catch (error) {
    io.err((error as Error).message);
    return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
