// Record store CLI.
//   node dist/node/record_store_cli.js --create <dir> --from-snapshot <jsonl>
//   node dist/node/record_store_cli.js --verify <dir> [--bolt <uri>] [--database <name>]
//   node dist/node/record_store_cli.js --export <dir> --out <jsonl>
// --create writes snapshot.jsonl and an empty journal.jsonl into an empty (or new) directory.
// --verify opens the store from its files, checks the invariants, and with --bolt compares the
//   Neo4j dump with the records of the store byte for byte. It does not write to Neo4j.
// --export writes the current record set as a portable snapshot.
// Credentials, when the server needs them, come from M3E_NEO4J_USER / M3E_NEO4J_PASSWORD.
// Exit code 0: done, nothing wrong. 1: verification found a problem, or the run failed. 2: bad usage or a refusal.

import fs from "fs";
import os from "os";
import path from "path";
import neo4j from "neo4j-driver";
import { checkInvariants } from "../shared/record_model/invariants";
import { parseSnapshot, serializeSnapshot } from "../shared/record_model/jsonl";
import { dump } from "./neo4j_store/store";
import { RecordWorkspaceStore } from "./record_store/store";

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = "Usage: --create <dir> --from-snapshot <jsonl> | --verify <dir> [--bolt <uri>] [--database <name>] | --export <dir> --out <jsonl>";

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

function firstDifference(a: string, b: string): string {
  const left = a.split("\n");
  const right = b.split("\n");
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) {
      return `line ${i + 1}: store ${(left[i] ?? "(none)").slice(0, 200)} / neo4j ${(right[i] ?? "(none)").slice(0, 200)}`;
    }
  }
  return "no difference";
}

export async function main(argv: string[], io: CliIo = { out: console.log, err: console.error }): Promise<number> {
  let args: Map<string, string>;
  let mode: "create" | "verify" | "export";
  try {
    args = parseArgs(argv);
    const modes = (["create", "verify", "export"] as const).filter((name) => args.has(name));
    if (modes.length !== 1) throw new Error("Give exactly one of --create, --verify, --export.");
    mode = modes[0];
    if (mode === "create" && !args.has("from-snapshot")) throw new Error("--create needs --from-snapshot.");
    if (mode === "export" && !args.has("out")) throw new Error("--export needs --out.");
    for (const name of ["create", "verify", "export", "from-snapshot", "out"]) {
      const value = args.get(name);
      if (value !== undefined) assertNotLiveM3e(value);
    }
  } catch (error) {
    io.err((error as Error).message);
    io.err(USAGE);
    return 2;
  }

  try {
    if (mode === "create") {
      const dir = args.get("create")!;
      const records = parseSnapshot(fs.readFileSync(args.get("from-snapshot")!, "utf8"));
      try {
        RecordWorkspaceStore.create(dir, records);
      } catch (error) {
        io.err((error as Error).message);
        return 2;
      }
      io.out(`created ${dir}: ${records.length} records`);
      return 0;
    }

    if (mode === "export") {
      const store = RecordWorkspaceStore.open(args.get("export")!, { warm: false });
      try {
        const records = store.records();
        fs.writeFileSync(args.get("out")!, serializeSnapshot(records), "utf8");
        io.out(`exported ${records.length} records at commit ${store.seq()} to ${args.get("out")!}`);
      } finally {
        await store.close();
      }
      return 0;
    }

    const store = RecordWorkspaceStore.open(args.get("verify")!, { warm: false });
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

      const bolt = args.get("bolt");
      if (bolt !== undefined) {
        const user = process.env.M3E_NEO4J_USER;
        const auth = user ? neo4j.auth.basic(user, process.env.M3E_NEO4J_PASSWORD ?? "") : undefined;
        const driver = neo4j.driver(bolt, auth);
        try {
          const expected = serializeSnapshot(records);
          const actual = serializeSnapshot(await dump(driver, { database: args.get("database") }));
          if (expected === actual) {
            io.out(`neo4j dump: identical (${Buffer.byteLength(expected, "utf8")} bytes)`);
          } else {
            failed = true;
            io.err(`neo4j dump differs from the store: ${firstDifference(expected, actual)}`);
          }
        } finally {
          await driver.close();
        }
      }
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
