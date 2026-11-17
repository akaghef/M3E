"use strict";
// Creates an empty record store for a store-mode run of the e2e specs.
//   node tests/e2e/make_record_store.js <new or empty directory> [workspace id]
// Then: M3E_STORE_DIR=<that directory> M3E_WORKSPACE_ID=<workspace id> M3E_PORT=... npx playwright test ...
// Needs `npm run build` first. Temporary directories only: never a directory of the personal workspace.
const path = require("path");
const { RecordWorkspaceStore } = require("../../dist/node/record_store/store");
const { toSnapshot } = require("../../dist/shared/record_model/to_snapshot");

const dir = process.argv[2];
const workspaceId = process.argv[3] || "ws_e2e_store";
if (!dir) {
  console.error("Usage: node tests/e2e/make_record_store.js <directory> [workspace id]");
  process.exit(2);
}
RecordWorkspaceStore.create(path.resolve(dir), toSnapshot(workspaceId, [], { now: new Date().toISOString() }));
console.log(`Record store created: ${path.resolve(dir)} (workspace ${workspaceId})`);
