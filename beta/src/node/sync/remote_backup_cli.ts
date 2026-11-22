import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { checkInvariants } from "../../shared/record_model/invariants";
import { parseSnapshot, serializeSnapshot } from "../../shared/record_model/jsonl";
import { recordRk } from "../../shared/record_model/steady";
import { fsyncDir } from "../record_store/journal_archive";
import { validateM3eApiUrl } from "../remote_access";

const GENERATION_NAME = /^remote-clone-\d{8}T\d{6}\.\d{3}Z-seq\d+\.jsonl$/;

export async function backupRemoteClone(remote: string, backupDir: string, keep = 48): Promise<string> {
  if (!Number.isSafeInteger(keep) || keep < 1) throw new Error("Generations to keep must be a positive integer.");
  const origin = validateM3eApiUrl(remote);
  const response = await fetch(`${origin}/api/sync/clone`, {
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Clone request failed (HTTP ${response.status}).`);
  const { snapshotSeq, records } = (await response.json() ?? {}) as { snapshotSeq?: unknown; records?: unknown };
  if (typeof snapshotSeq !== "number" || !Number.isSafeInteger(snapshotSeq) || snapshotSeq < 0) {
    throw new Error("Clone response is missing a valid snapshotSeq.");
  }
  if (!Array.isArray(records) || records.length === 0) throw new Error("Clone response has no records.");

  const snapshot = parseSnapshot(records.map((record) => JSON.stringify(record)).join("\n"));
  const header = snapshot[0];
  if (header.kind !== "snapshot" || typeof header.workspaceId !== "string" || !header.workspaceId.trim() || header.seq !== snapshotSeq) {
    throw new Error("Clone response has an invalid snapshot header or mismatched sequence.");
  }
  const problems = checkInvariants(snapshot);
  if (problems.length > 0) throw new Error(`Clone snapshot has ${problems.length} invariant problem(s).`);
  if (new Set(snapshot.map(recordRk)).size !== snapshot.length) throw new Error("Clone snapshot has duplicate record keys.");
  const content = serializeSnapshot(snapshot);

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[-:]/g, "");
  const file = path.join(backupDir, `remote-clone-${timestamp}-seq${snapshotSeq}.jsonl`);
  const temp = path.join(backupDir, `.remote-clone-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, content, { encoding: "utf8", flag: "wx", mode: 0o600, flush: true });
    fs.renameSync(temp, file);
    fsyncDir(backupDir);
  } finally {
    fs.rmSync(temp, { force: true });
  }

  // Timestamps are UTC and fixed-width, so lexicographic order is chronological.
  const generations = fs.readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && GENERATION_NAME.test(entry.name))
    .map((entry) => entry.name).sort().reverse();
  for (const old of generations.slice(keep)) fs.rmSync(path.join(backupDir, old), { force: true });
  return file;
}

async function main(args: string[]): Promise<void> {
  const [remote, backupDir, keep] = args;
  if (!remote || !backupDir || args.length > 3) {
    throw new Error("Usage: remote_backup_cli.js <remote URL> <backup directory> [generations to keep]");
  }
  const file = await backupRemoteClone(remote, backupDir, keep === undefined ? undefined : Number(keep));
  console.log(`Saved remote clone: ${file}`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
