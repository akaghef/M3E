import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { exerciseViewerFields } from "./viewer_field_lifecycle";

test("every viewer field survives create, update and delete with viewer before values", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-fields-"));
  RecordWorkspaceStore.create(dir, toSnapshot("fields", []));
  const store = RecordWorkspaceStore.open(dir);
  try { exerciseViewerFields(store, "remote"); }
  finally { await store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
