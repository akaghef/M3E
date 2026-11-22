import { execFile } from "node:child_process";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { activeRecordStore, closeActiveRecordStore } from "../../src/node/record_store/active";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { main as recordStoreCli } from "../../src/node/record_store_cli";
import { handleRecordSyncHttp } from "../../src/node/sync/http";
import { backupRemoteClone } from "../../src/node/sync/remote_backup_cli";
import { serializeSnapshot } from "../../src/shared/record_model/jsonl";
import { richState, snapshotOf } from "./record_store_helpers";

let root: string;
let backupDir: string;
let server: Server;
let url: string;
let override: { body: unknown; status?: number } | undefined;

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-remote-backup-"));
  backupDir = path.join(root, "backups");
  const storeDir = path.join(root, "store");
  vi.stubEnv("M3E_STORE_DIR", storeDir);
  vi.stubEnv("M3E_NEO4J_BOLT", undefined);
  RecordWorkspaceStore.create(storeDir, snapshotOf([{ id: "map_a", state: richState() }]));
  override = undefined;
  server = createServer(async (req, res) => {
    if (override && req.url === "/api/sync/clone") {
      res.writeHead(override.status ?? 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(override.body));
    } else if (!await handleRecordSyncHttp(req, res)) {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await closeActiveRecordStore();
  vi.unstubAllEnvs();
  fs.rmSync(root, { recursive: true, force: true });
});

it("writes a restorable clone using the built CLI and prunes to the newest K generations", async () => {
  fs.mkdirSync(backupDir);
  const old = "remote-clone-20000101T000000.000Z-seq3.jsonl";
  const newer = "remote-clone-20010101T000000.000Z-seq2.jsonl";
  const unrelated = "remote-clone-unrelated.jsonl";
  for (const file of [old, newer, unrelated]) fs.writeFileSync(path.join(backupDir, file), "keep or prune\n");

  const cli = path.resolve(__dirname, "../../dist/node/sync/remote_backup_cli.js");
  const { stdout } = await promisify(execFile)(process.execPath, [cli, url, backupDir, "2"]);
  const file = stdout.trim().replace(/^Saved remote clone: /, "");
  expect(path.basename(file)).toMatch(/^remote-clone-\d{8}T\d{6}\.\d{3}Z-seq0\.jsonl$/);
  expect(fs.readFileSync(file, "utf8")).toBe(serializeSnapshot(activeRecordStore()!.records()));
  expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  expect(fs.readdirSync(backupDir).sort()).toEqual([newer, path.basename(file), unrelated].sort());

  const restoredDir = path.join(root, "restored");
  expect(await recordStoreCli(["--create", restoredDir, "--from-snapshot", file])).toBe(0);
  expect(await recordStoreCli(["--verify", restoredDir])).toBe(0);
});

it("keeps 48 generations by default", async () => {
  fs.mkdirSync(backupDir);
  for (let index = 0; index < 50; index++) {
    const seq = String(index).padStart(3, "0");
    fs.writeFileSync(path.join(backupDir, `remote-clone-20000101T000000.${seq}Z-seq0.jsonl`), "older\n");
  }
  await backupRemoteClone(url, backupDir);
  expect(fs.readdirSync(backupDir)).toHaveLength(48);
  expect(fs.readdirSync(backupDir).sort()[0]).toBe("remote-clone-20000101T000000.003Z-seq0.jsonl");
});

it("rejects failed or invalid clone responses without writing or pruning", async () => {
  const existing = await backupRemoteClone(url, backupDir);
  const records = activeRecordStore()!.records();
  const invalidRecords = records.filter((record) => !(record.kind === "node" && record.id === "inner"));
  for (const [reply, error] of [
    [{ status: 403, body: { ok: false } }, /HTTP 403/],
    [{ body: { records } }, /snapshotSeq/],
    [{ body: { snapshotSeq: 0, records: [] } }, /no records/],
    [{ body: { snapshotSeq: 1, records } }, /mismatched sequence/],
    [{ body: { snapshotSeq: 0, records: invalidRecords } }, /invariant problem/],
  ] as const) {
    override = reply;
    await expect(backupRemoteClone(url, backupDir, 1)).rejects.toThrow(error);
  }
  expect(fs.readdirSync(backupDir)).toEqual([path.basename(existing)]);
});
