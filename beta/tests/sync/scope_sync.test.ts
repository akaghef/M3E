import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { ScopeChangeSequence, ScopeGrant, WorkspaceAccount } from "../../src/cutover/scope-permission";
import {
  FileDeliveryCursor,
  FileScopeJournalStore,
  MemoryDeliveryCursor,
  MemoryScopeJournalStore,
  ScopeSyncPeer,
  journalFile,
  type ScopeJournalRecord,
  type ScopeSyncTransport,
} from "../../src/node/sync";

const workspace: WorkspaceAccount = { accountId: "acct-fixture", workspaceId: "ws-fixture" };
const grantsA: readonly ScopeGrant[] = [
  { scopeId: "scope-open", capability: "write" },
  { scopeId: "scope-secret", capability: "read" },
];
const grantsB: readonly ScopeGrant[] = [
  { scopeId: "scope-open", capability: "write" },
];

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function command(intent: string, targetId: string, title: string) {
  return { intent, targetId, operation: { title } };
}

function link(remote: ScopeSyncPeer, online: () => boolean): ScopeSyncTransport {
  return {
    async send(sequences: readonly ScopeChangeSequence<ScopeJournalRecord>[]) {
      if (!online()) return { ok: false, reason: "unreachable" };
      const report = remote.receiveSequences(sequences);
      const acceptedIds = sequences.flatMap((sequence) => sequence.changes.map((record) => record.recordId));
      expect(report.duplicateIds).toEqual([]);
      return { ok: true, acceptedIds };
    },
  };
}

interface PeerPair {
  a: ScopeSyncPeer;
  b: ScopeSyncPeer;
  reopen: () => PeerPair;
}

function memoryPair(): PeerPair {
  const open = (): PeerPair => {
    const pair: PeerPair = {
      a: new ScopeSyncPeer("peer-a", workspace.accountId, workspace, grantsA, new MemoryScopeJournalStore(), new MemoryDeliveryCursor()),
      b: new ScopeSyncPeer("peer-b", workspace.accountId, workspace, grantsB, new MemoryScopeJournalStore(), new MemoryDeliveryCursor()),
      reopen: () => pair,
    };
    return pair;
  };
  return open();
}

function filePair(): PeerPair {
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-scope-sync-a-"));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-scope-sync-b-"));
  dirs.push(dirA, dirB);
  const open = (): PeerPair => ({
    a: new ScopeSyncPeer("peer-a", workspace.accountId, workspace, grantsA, new FileScopeJournalStore(dirA), new FileDeliveryCursor(dirA)),
    b: new ScopeSyncPeer("peer-b", workspace.accountId, workspace, grantsB, new FileScopeJournalStore(dirB), new FileDeliveryCursor(dirB)),
    reopen: open,
  });
  return open();
}

function ids(records: readonly { recordId: string }[]): string[] {
  return records.map((record) => record.recordId);
}

function scenarios(title: string, makePair: () => PeerPair): void {
  describe(title, () => {
    test("片方だけ変更", async () => {
      const { a, b } = makePair();
      const online = { value: true };
      const written = a.record({
        scopeId: "scope-open",
        mapId: "map-fixture",
        command: command("rename", "node-fixture-1", "alpha"),
        recordedAt: "2026-01-01T00:00:00.000Z",
      });
      const sent = await a.push("peer-b", link(b, () => online.value));
      expect(sent.ok).toBe(true);
      expect(sent.accountAdmitted).toBe(true);
      expect(sent.sentRecordIds).toEqual([written.recordId]);
      const back = await b.push("peer-a", link(a, () => online.value));
      expect(back.sentRecordIds).toEqual([]);
      expect(ids(a.replay("scope-open"))).toEqual([written.recordId]);
      expect(ids(b.replay("scope-open"))).toEqual([written.recordId]);
      expect(b.journal.readScope("scope-secret")).toEqual([]);
    });

    test("両方変更", async () => {
      const { a, b } = makePair();
      const online = { value: true };
      const fromA = a.record({
        scopeId: "scope-open",
        mapId: "map-fixture",
        command: command("rename", "node-fixture-1", "alpha"),
        recordedAt: "2026-01-01T00:00:00.000Z",
      });
      const fromB = b.record({
        scopeId: "scope-open",
        mapId: "map-fixture",
        command: command("update", "node-fixture-2", "beta"),
        recordedAt: "2026-01-01T00:00:01.000Z",
      });
      expect((await a.push("peer-b", link(b, () => online.value))).sentRecordIds).toEqual([fromA.recordId]);
      expect((await b.push("peer-a", link(a, () => online.value))).sentRecordIds).toEqual([fromB.recordId]);
      expect(ids(a.replay("scope-open"))).toEqual([fromA.recordId, fromB.recordId]);
      expect(ids(b.replay("scope-open"))).toEqual([fromA.recordId, fromB.recordId]);
      const again = a.receive([fromA, fromB]);
      expect(again.applied).toEqual([]);
      expect(again.duplicateIds).toEqual([fromA.recordId, fromB.recordId]);
      expect(a.journal.readScope("scope-open")).toHaveLength(2);
      expect(b.journal.readScope("scope-open")).toHaveLength(2);
    });

    test("相手を切ってから戻す", async () => {
      const opened = makePair();
      let { a, b } = opened;
      const online = { value: false };
      const first = a.record({
        scopeId: "scope-open",
        mapId: "map-fixture",
        command: command("rename", "node-fixture-1", "alpha"),
        recordedAt: "2026-01-01T00:00:00.000Z",
      });
      const second = a.record({
        scopeId: "scope-open",
        mapId: "map-fixture",
        command: command("update", "node-fixture-1", "alpha-2"),
        recordedAt: "2026-01-01T00:00:02.000Z",
      });
      expect(second.causalParentIds).toEqual([first.recordId]);
      const down = await a.push("peer-b", link(b, () => online.value));
      expect(down.ok).toBe(false);
      expect(down.reason).toBe("unreachable");
      expect(down.sentRecordIds).toEqual([]);
      expect(b.journal.readAll()).toEqual([]);
      const reopened = opened.reopen();
      a = reopened.a;
      b = reopened.b;
      expect(ids(a.journal.readScope("scope-open"))).toEqual([first.recordId, second.recordId]);
      online.value = true;
      const up = await a.push("peer-b", link(b, () => online.value));
      expect(up.ok).toBe(true);
      expect(up.sentRecordIds).toEqual([first.recordId, second.recordId]);
      expect(ids(b.replay("scope-open"))).toEqual([first.recordId, second.recordId]);
      const quiet = await a.push("peer-b", link(b, () => online.value));
      expect(quiet.sentRecordIds).toEqual([]);
      const replayed = b.receive([first, second]);
      expect(replayed.applied).toEqual([]);
      expect(replayed.duplicateIds).toEqual([first.recordId, second.recordId]);
      expect(b.journal.readScope("scope-open")).toHaveLength(2);
    });

    test("権限のない scope は渡らない", async () => {
      const { a, b } = makePair();
      const online = { value: true };
      const open = a.record({
        scopeId: "scope-open",
        mapId: "map-fixture",
        command: command("rename", "node-fixture-1", "alpha"),
        recordedAt: "2026-01-01T00:00:00.000Z",
      });
      const secret = a.record({
        scopeId: "scope-secret",
        mapId: "map-fixture",
        command: command("rename", "node-fixture-secret", "hidden"),
        recordedAt: "2026-01-01T00:00:01.000Z",
      });
      const unread = a.record({
        scopeId: "scope-none",
        mapId: "map-fixture",
        command: command("rename", "node-fixture-none", "missing"),
        recordedAt: "2026-01-01T00:00:02.000Z",
      });
      const sent = await a.push("peer-b", link(b, () => online.value));
      expect(sent.accountAdmitted).toBe(true);
      expect(sent.sentRecordIds).toEqual([open.recordId]);
      expect(sent.withheldScopeIds).toEqual(["scope-none", "scope-secret"]);
      expect(ids(b.journal.readAll())).toEqual([open.recordId]);
      expect(b.journal.readScope("scope-secret")).toEqual([]);
      expect(b.journal.readScope("scope-none")).toEqual([]);
      expect(ids(a.journal.readScope("scope-secret"))).toEqual([secret.recordId]);
      expect(ids(a.journal.readScope("scope-none"))).toEqual([unread.recordId]);

      const outsider = new ScopeSyncPeer(
        "peer-out",
        "acct-other",
        workspace,
        [{ scopeId: "scope-open", capability: "write" }],
        new MemoryScopeJournalStore(),
        new MemoryDeliveryCursor(),
      );
      const foreign = outsider.record({
        scopeId: "scope-open",
        mapId: "map-fixture",
        command: command("update", "node-fixture-1", "foreign"),
        recordedAt: "2026-01-01T00:00:03.000Z",
      });
      const refused = await outsider.push("peer-b", link(b, () => online.value));
      expect(refused.accountAdmitted).toBe(false);
      expect(refused.reason).toBe("empty");
      expect(refused.sentRecordIds).toEqual([]);
      expect(refused.withheldScopeIds).toEqual(["scope-open"]);
      expect(ids(b.journal.readAll())).toEqual([open.recordId]);
      expect(outsider.journal.readAll().map((record) => record.recordId)).toEqual([foreign.recordId]);
    });
  });
}

scenarios("メモリの二ピア", memoryPair);
scenarios("一時ディレクトリの二ピア", filePair);

test("ファイル journal は再送しても行を増やさない", async () => {
  const { a, b } = filePair();
  const online = { value: true };
  const written = a.record({
    scopeId: "scope-open",
    mapId: "map-fixture",
    command: command("rename", "node-fixture-1", "alpha"),
    recordedAt: "2026-01-01T00:00:00.000Z",
  });
  await a.push("peer-b", link(b, () => online.value));
  b.receive([written]);
  const file = journalFile(dirs[dirs.length - 1], "scope-open");
  const lines = fs.readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "");
  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0]).recordId).toBe(written.recordId);
});
