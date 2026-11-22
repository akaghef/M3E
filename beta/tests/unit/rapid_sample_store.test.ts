// The sample generator (`node dist/node/rapid_mvp.js`, run by the Beta launcher) never writes into the
// record store of a migrated workspace, even when M3E_DATA_DIR points at one.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";

test("the sample generator leaves a migrated workspace's record store untouched", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-sample-guard-"));
  const storeDir = path.join(dataDir, "store");
  RecordWorkspaceStore.create(storeDir, toSnapshot("ws_sample_guard", []));
  const before = RecordWorkspaceStore.open(storeDir);
  const seq = before.seq();
  const maps = before.listMaps().length;
  await before.close();

  const entry = path.resolve(__dirname, "../../dist/node/rapid_mvp.js");
  const env = { ...process.env, M3E_DATA_DIR: dataDir };
  delete env.M3E_STORE_DIR;
  const run = spawnSync(process.execPath, [entry], { env, encoding: "utf8" });
  expect(run.status, run.stderr).toBe(0);

  const after = RecordWorkspaceStore.open(storeDir);
  expect(after.seq()).toBe(seq);
  expect(after.listMaps().length).toBe(maps);
  await after.close();
});
