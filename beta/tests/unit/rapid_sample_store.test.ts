// The sample generator (`node dist/node/rapid_mvp.js`, run by the Beta launcher) never writes into the
// record store of a migrated workspace, even when M3E_DATA_DIR points at one.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { NEO4J_STORE_FILE } from "../../src/node/record_store/active";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { dropTestStores, testStoreName, TEST_NEO4J } from "./neo4j_test_store";

test("the sample generator leaves a migrated workspace's record store untouched", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-sample-guard-"));
  const name = testStoreName();
  try {
    await RecordWorkspaceStore.createInNeo4j(TEST_NEO4J, name, toSnapshot("ws_sample_guard", []));
    fs.writeFileSync(path.join(dataDir, NEO4J_STORE_FILE), JSON.stringify({ store: name }));
    const before = await RecordWorkspaceStore.openNeo4j(TEST_NEO4J, name);
    const seq = before.seq();
    const maps = before.listMaps().length;
    await before.close();

    const entry = path.resolve(__dirname, "../../dist/node/rapid_mvp.js");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      M3E_DATA_DIR: dataDir,
      M3E_RECORD_STORE: name,
      M3E_NEO4J_BOLT: TEST_NEO4J.uri,
      M3E_NEO4J_USER: TEST_NEO4J.user ?? "",
      M3E_NEO4J_PASSWORD: TEST_NEO4J.password ?? "",
      M3E_NEO4J_PASSWORD_FILE: "",
      M3E_NEO4J_DATABASE: TEST_NEO4J.database ?? "",
    };
    const run = spawnSync(process.execPath, [entry], { env, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);

    const after = await RecordWorkspaceStore.openNeo4j(TEST_NEO4J, name);
    try {
      expect(after.seq()).toBe(seq);
      expect(after.listMaps().length).toBe(maps);
    } finally {
      await after.close();
    }
  } finally {
    await dropTestStores();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
