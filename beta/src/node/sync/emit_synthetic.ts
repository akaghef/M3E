import fs from "node:fs";
import { FileDeliveryCursor } from "./cursor";
import { journalFile } from "./file_layout";
import { FileScopeJournalStore } from "./journal_store";
import { ScopeSyncPeer } from "./peer";

/**
 * テスト用の短い合成記録を一件だけ、指定した peerRoot の配置案へ足す。
 * map 本文は入れない。
 */
const peerRoot = process.argv[2];
if (!peerRoot) {
  throw new Error("peerRoot is required");
}

const peer = new ScopeSyncPeer(
  "peer-mac",
  "acct-synthetic",
  { accountId: "acct-synthetic", workspaceId: "ws-synthetic" },
  [{ scopeId: "scope-synthetic", capability: "write" }],
  new FileScopeJournalStore(peerRoot),
  new FileDeliveryCursor(peerRoot),
);

const record = peer.record({
  scopeId: "scope-synthetic",
  mapId: "map-synthetic",
  command: {
    intent: "rename",
    targetId: "node-synthetic",
    operation: { title: "synthetic-scope-record" },
  },
  recordedAt: "2026-11-11T00:00:00.000Z",
});

const file = journalFile(peerRoot, "scope-synthetic");
const lines = fs.readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "");
if (lines.length !== 1) {
  throw new Error(`expected one journal line, got ${lines.length}`);
}
process.stdout.write(`${JSON.stringify({ file, record, line: lines[0] })}\n`);
