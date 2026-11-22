// Sync entry: push, pull, clone, device outbox, connection issuer, minSeq.
// The server under test is a child process on a temporary store. This file does not
// import start_viewer (that would open dotenv and a live store).

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { diffState, type MapCommand } from "../../src/shared/map_changes";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import type { AppState } from "../../src/shared/types";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import type { EngineApplier } from "../../src/node/record_store/engine";
import { accountForConnection } from "../../src/node/sync/issuer";
import { MIN_SEQ_TIMEOUT_CODE, waitForAppliedSeq } from "../../src/node/sync/min_seq";
import { DeviceOutbox, pushOutboxFile } from "../../src/node/sync/outbox";

const BETA = path.resolve(__dirname, "..", "..");
const SERVER = path.join(BETA, "dist", "node", "start_viewer.js");
const CLI = path.join(BETA, "dist", "node", "sync", "outbox_cli.js");
const MAP = "sync-map";
const ACTOR = "liar-client";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port === 4173 ? freePort() : port));
    });
  });
}

function node(id: string, parentId: string | null, children: string[], text: string): Record<string, unknown> {
  return { id, parentId, children, nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "" };
}

function mapState(): Record<string, unknown> {
  return {
    rootId: "root",
    nodes: {
      root: node("root", null, ["alpha", "bravo"], "Root"),
      alpha: node("alpha", "root", [], "Alpha"),
      bravo: node("bravo", "root", [], "Bravo"),
    },
    links: {},
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function commandOf(before: Record<string, unknown>, after: Record<string, unknown>, commandId: string, actorId = ACTOR): MapCommand {
  return { commandId, actor: { kind: "human", id: actorId }, intent: "edit-text", changes: diffState(before, after) };
}

function envelope(command: MapCommand) {
  return { commandId: command.commandId, mapId: MAP, baseSeq: 0, command };
}

interface Running {
  base: string;
  child: ChildProcess;
  log: string[];
}

async function startServer(dataDir: string, storeDir: string): Promise<Running> {
  const port = await freePort();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    M3E_FORBID_LIVE_DATA: "1",
    M3E_PORT: String(port),
    M3E_DATA_DIR: dataDir,
    M3E_DB_FILE: "data.sqlite",
    M3E_STORE_DIR: storeDir,
    M3E_WORKSPACE_ID: "ws_sync",
    M3E_OPEN_BROWSER: "0",
    M3E_CLOUD_SYNC: "0",
    M3E_AUTO_SYNC: "0",
    M3E_MIN_SEQ_TIMEOUT_MS: "250",
  };
  delete env.M3E_NEO4J_BOLT;
  const child = spawn(process.execPath, [SERVER], { cwd: BETA, env, stdio: ["ignore", "pipe", "pipe"] });
  const log: string[] = [];
  child.stdout?.on("data", (chunk) => log.push(String(chunk)));
  child.stderr?.on("data", (chunk) => log.push(String(chunk)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}: ${log.join("")}`);
    try {
      if ((await fetch(`${base}/api/maps`)).status === 200) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error(`server did not start: ${log.join("")}`);
    await delay(50);
  }
  return { base, child, log };
}

function stopServer(server: Running | undefined): Promise<void> {
  if (!server || server.child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), 5_000);
    server.child.once("exit", () => { clearTimeout(timer); resolve(); });
    server.child.kill("SIGTERM");
  });
}

async function http(base: string, method: string, route: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  const response = await fetch(base + route, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try { parsed = text.length > 0 ? JSON.parse(text) : null; } catch { /* keep the text */ }
  return { status: response.status, body: parsed };
}

function holdingApplier(): EngineApplier & { startedAt: number | null; releaseNext: () => void; releaseAll: () => void } {
  const pending: Array<() => void> = [];
  return {
    startedAt: null,
    async start(source) {
      const seq = source.seq();
      this.startedAt = seq;
      return seq;
    },
    apply() {
      return new Promise<void>((resolve) => { pending.push(resolve); });
    },
    async close() { this.releaseAll(); },
    releaseNext() { pending.shift()?.(); },
    releaseAll() { while (pending.length > 0) pending.shift()?.(); },
  };
}

describe("minSeq waits for the engine", () => {
  test("a read waits until the engine applies the seq, then times out with ENGINE_BEHIND", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-sync-minseq-"));
    RecordWorkspaceStore.create(dir, toSnapshot("ws_min", [], { now: "2026-11-22T00:00:00.000Z" }));
    const gate = holdingApplier();
    const store = RecordWorkspaceStore.open(dir, { applier: gate, engineRetry: { firstMs: 60_000, maxMs: 60_000 } });
    try {
      const deadline = Date.now() + 2_000;
      while (gate.startedAt === null || store.engineStatus().appliedSeq !== gate.startedAt || store.seq() !== gate.startedAt) {
        if (Date.now() > deadline) throw new Error("the engine did not start");
        await delay(15);
      }
      const state = mapState() as unknown as AppState;
      const saved = store.saveWholeMap(MAP, state, "acct_system", "create");
      expect(saved.ok).toBe(true);
      const seq = store.seq();
      expect(store.engineStatus().appliedSeq).toBeLessThan(seq);

      const timedAt = Date.now();
      const timed = await waitForAppliedSeq(store, seq, 200);
      expect(timed).toEqual({ ok: false, code: MIN_SEQ_TIMEOUT_CODE });
      expect(Date.now() - timedAt).toBeGreaterThanOrEqual(150);

      let settled = false;
      const waiting = waitForAppliedSeq(store, seq, 2_000).then((result) => { settled = true; return result; });
      await delay(60);
      expect(settled).toBe(false);
      gate.releaseNext();
      expect(await waiting).toEqual({ ok: true });
      expect(store.engineStatus().appliedSeq).toBeGreaterThanOrEqual(seq);
    } finally {
      gate.releaseAll();
      await store.close();
    }
  });
});

describe("sync HTTP, issuer, and outbox", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-sync-entry-"));
  const storeDir = path.join(root, "store");
  const dataDir = path.join(root, "data");
  let running: Running;

  beforeAll(async () => {
    fs.mkdirSync(dataDir, { recursive: true });
    RecordWorkspaceStore.create(storeDir, toSnapshot("ws_sync", [], { now: "2026-11-22T00:00:00.000Z" }));
    running = await startServer(dataDir, storeDir);
  }, 30_000);

  afterAll(async () => {
    await stopServer(running);
    delete process.env.M3E_STORE_DIR;
  });

  function call(method: string, route: string, body?: unknown, headers?: Record<string, string>) {
    return http(running.base, method, route, body, headers);
  }

  test("push answers each commandId in order, retries the first result, and refuses a different body", async () => {
    const created = await call("POST", `/api/maps/${MAP}`, { version: 1, savedAt: "2026-11-22T00:00:00.000Z", state: mapState() });
    expect(created.status).toBe(200);
    const before = (await call("GET", `/api/maps/${MAP}`)).body.state as Record<string, any>;

    const alphaEdited = clone(before);
    alphaEdited.nodes.alpha.text = "Alpha-1";
    const alphaStale = clone(before);
    alphaStale.nodes.alpha.text = "Alpha-stale";
    const bravoEdited = clone(before);
    bravoEdited.nodes.bravo.text = "Bravo-1";
    const cmdA = commandOf(before, alphaEdited, "cmd-a");
    const cmdB = commandOf(before, alphaStale, "cmd-b");
    const cmdC = commandOf(before, bravoEdited, "cmd-c");

    const first = await call("POST", "/api/sync/push", { commands: [envelope(cmdA), envelope(cmdB), envelope(cmdC)] });
    expect(first.status).toBe(200);
    const results = first.body.results;
    expect(results.map((item: { commandId: string }) => item.commandId)).toEqual(["cmd-a", "cmd-b", "cmd-c"]);
    expect(results.map((item: { status: string }) => item.status)).toEqual(["committed", "rejected", "committed"]);
    expect(results[1].code).toBe("CONFLICT");
    expect(results[0].seq).toBeLessThan(results[2].seq);
    const tip = (await call("GET", `/api/sync/pull?after=${results[2].seq}`)).body.throughSeq;
    expect(tip).toBe(results[2].seq);

    const again = await call("POST", "/api/sync/push", { commands: [envelope(cmdA), envelope(cmdB), envelope(cmdC)] });
    expect(again.body.results.map((item: { status: string }) => item.status)).toEqual(["duplicate", "rejected", "duplicate"]);
    expect(again.body.results[0].seq).toBe(results[0].seq);
    expect(again.body.results[2].seq).toBe(results[2].seq);
    expect(again.body.results[1].code).toBe("CONFLICT");
    expect((await call("GET", `/api/sync/pull?after=${results[2].seq}`)).body.throughSeq).toBe(tip);

    const suffix = await call("GET", `/api/sync/pull?after=${results[0].seq}`);
    expect(suffix.body.reclone).toBeUndefined();
    expect(suffix.body.lines.map((line: { commandId?: string }) => line.commandId)).toEqual(["cmd-c"]);
    expect(suffix.body.lines.map((line: { seq: number }) => line.seq)).toEqual([results[2].seq]);
    expect(suffix.body.throughSeq).toBe(results[2].seq);
    const empty = await call("GET", `/api/sync/pull?after=${suffix.body.throughSeq}`);
    expect(empty.body).toMatchObject({ lines: [], throughSeq: suffix.body.throughSeq });
    const ahead = await call("GET", `/api/sync/pull?after=${suffix.body.throughSeq + 1}`);
    expect(ahead.body).toEqual({ reclone: true, snapshotSeq: suffix.body.throughSeq, workspaceId: suffix.body.workspaceId, historyId: suffix.body.historyId, epoch: suffix.body.epoch });
    expect(typeof suffix.body.historyId).toBe("string");
    const scoped = await call("GET", `/api/sync/pull?after=${results[0].seq}&scope=scope%3Aroot`);
    expect(scoped.body.lines.map((line: { commandId?: string }) => line.commandId)).toEqual(["cmd-c"]);

    const different = commandOf(before, bravoEdited, "cmd-a");
    const refused = await call("POST", "/api/sync/push", { commands: [envelope(different)] });
    expect(refused.body.results).toEqual([
      expect.objectContaining({ commandId: "cmd-a", status: "rejected", code: "SAME_ID_DIFFERENT_CONTENT" }),
    ]);
    const otherRefusal = commandOf(before, bravoEdited, "cmd-b");
    const refusedAgain = await call("POST", "/api/sync/push", { commands: [envelope(otherRefusal)] });
    expect(refusedAgain.body.results[0]).toMatchObject({ commandId: "cmd-b", status: "rejected", code: "SAME_ID_DIFFERENT_CONTENT" });

    const restored = clone(alphaEdited);
    restored.nodes.alpha.text = "Alpha";
    const restore = await call("POST", "/api/sync/push", { commands: [envelope(commandOf(alphaEdited, restored, "cmd-restore"))] });
    expect(restore.body.results[0].status).toBe("committed");
    const stillRefused = await call("POST", "/api/sync/push", { commands: [envelope(cmdB)] });
    expect(stillRefused.body.results[0]).toMatchObject({ commandId: "cmd-b", status: "rejected", code: "CONFLICT" });
    expect((await call("GET", `/api/maps/${MAP}`)).body.state.nodes.alpha.text).toBe("Alpha");
    expect((await call("GET", `/api/sync/pull?after=${tip}`)).body.throughSeq).toBeGreaterThan(tip);
  });

  test("the journal issuer is the account id the server chose", async () => {
    const pulled = await call("GET", "/api/sync/pull?after=0");
    const viewerLine = pulled.body.lines.find((line: { commandId?: string }) => line.commandId === "cmd-a");
    const viewerAccount = accountForConnection({ kind: "viewer" }).accountId;
    expect(viewerLine.issuer).toBe(viewerAccount);
    expect(viewerLine.actor.id).toBe(ACTOR);
    expect(viewerLine.issuer).not.toBe(ACTOR);
    expect(viewerLine.issuer).not.toBe(`human:${ACTOR}`);
    expect(String(viewerLine.issuer).startsWith("ai-agent:")).toBe(false);

    const state = (await call("GET", `/api/maps/${MAP}`)).body.state as Record<string, any>;
    const next = clone(state);
    next.nodes.root.text = "Root from mcp device";
    const mcpCommand = commandOf(state, next, "cmd-mcp-push", "also-a-liar");
    const mcpPush = await call("POST", "/api/sync/push", { commands: [envelope(mcpCommand)] }, {
      "x-m3e-connection": "mcp",
      "x-m3e-actor-instance": "inst-9",
    });
    expect(mcpPush.body.results[0].status).toBe("committed");
    const mcpAccount = accountForConnection({ kind: "mcp", instanceId: "inst-9" }).accountId;
    const afterMcp = await call("GET", `/api/sync/pull?after=${mcpPush.body.results[0].seq - 1}`);
    const mcpLine = afterMcp.body.lines.find((line: { commandId?: string }) => line.commandId === "cmd-mcp-push");
    expect(mcpLine.issuer).toBe(mcpAccount);
    expect(mcpLine.issuer).not.toBe("also-a-liar");
    expect(mcpLine.issuer).not.toBe("ai-agent:inst-9");

    const systemNext = clone(next);
    systemNext.nodes.root.text = "Root from system";
    const systemCommand = commandOf(next, systemNext, "cmd-system", "not-the-system");
    const systemPush = await call("POST", "/api/sync/push", { commands: [envelope(systemCommand)] }, { "x-m3e-connection": "system" });
    expect(systemPush.body.results[0].status).toBe("committed");
    const systemLines = await call("GET", `/api/sync/pull?after=${systemPush.body.results[0].seq - 1}`);
    const systemLine = systemLines.body.lines.find((line: { commandId?: string }) => line.commandId === "cmd-system");
    // A request cannot claim the server-internal system account through a header.
    expect(systemLine.issuer).toBe(accountForConnection({ kind: "viewer" }).accountId);
    expect(systemLine.issuer).not.toBe(accountForConnection({ kind: "system" }).accountId);
    expect(systemLine.issuer).not.toBe("not-the-system");
    expect(systemLine.issuer).not.toBe("system:not-the-system");

    const entered = await call("POST", "/api/mcp/call", { name: "m3e_context", arguments: { action: "enter", target: `m3e://maps/${MAP}` } });
    expect(entered.status).toBe(200);
    const contextId = entered.body.context_id as string;
    const createdNode = await call("POST", "/api/mcp/call", {
      name: "m3e_create",
      arguments: { kind: "node", context_id: contextId, text: "From the agent", command_id: "mcp-node-1" },
    });
    expect(createdNode.status).toBe(200);
    expect(createdNode.body.ok).toBe(true);
    const toolLines = await call("GET", "/api/sync/pull?after=0");
    const toolLine = toolLines.body.lines.find((line: { commandId?: string }) => line.commandId === "mcp-node-1");
    expect(toolLine.issuer).toBe(accountForConnection({ kind: "mcp", instanceId: contextId }).accountId);
    expect(toolLine.issuer).not.toBe(`ai-agent:${contextId}`);
    expect(toolLine.issuer).not.toBe(contextId);
  });

  test("m3e_get and the viewer map read wait for minSeq and time out with ENGINE_BEHIND", async () => {
    const current = (await call("GET", "/api/sync/pull?after=0")).body.throughSeq as number;
    const ready = await call("GET", `/api/maps/${MAP}?minSeq=${current}`);
    expect(ready.status).toBe(200);
    expect(ready.body.state.nodes.root.text).toBe("Root from system");

    const viewerAt = Date.now();
    const behind = await call("GET", `/api/maps/${MAP}?minSeq=${current + 100_000}`);
    expect(behind.status).toBe(503);
    expect(behind.body).toMatchObject({ ok: false, code: "ENGINE_BEHIND" });
    expect(Date.now() - viewerAt).toBeGreaterThanOrEqual(150);

    const bad = await call("GET", `/api/maps/${MAP}?minSeq=soon`);
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("INVALID_ARGUMENT");

    const got = await call("POST", "/api/mcp/call", {
      name: "m3e_get",
      arguments: { kind: "state", target: `m3e://maps/${MAP}`, minSeq: current },
    });
    expect(got.status).toBe(200);
    expect(got.body.ok).toBe(true);

    const mcpAt = Date.now();
    const late = await call("POST", "/api/mcp/call", {
      name: "m3e_get",
      arguments: { kind: "state", target: `m3e://maps/${MAP}`, minSeq: current + 100_000 },
    });
    expect(late.status).toBe(400);
    expect(late.body.error.code).toBe("ENGINE_BEHIND");
    expect(Date.now() - mcpAt).toBeGreaterThanOrEqual(150);

    const invalid = await call("POST", "/api/mcp/call", {
      name: "m3e_get",
      arguments: { kind: "state", target: `m3e://maps/${MAP}`, minSeq: -1 },
    });
    expect(invalid.body.error.code).toBe("INVALID_ARGUMENT");
  });

  test("the outbox survives a restart, drains in order, and reports rejections", async () => {
    const state = (await call("GET", `/api/maps/${MAP}`)).body.state as Record<string, any>;
    const step = clone(state);
    step.nodes.alpha.text = "Alpha-2";
    const done = clone(step);
    done.nodes.alpha.text = "Alpha-3";
    const old = mapState();
    const stale = clone(old);
    stale.nodes.bravo.text = "Bravo-nope";
    const file = path.join(root, "outbox.jsonl");
    const first = DeviceOutbox.open(file);
    first.append({ commandId: "out-1", baseSeq: 0, mapId: MAP, command: commandOf(state, step, "out-1") });
    first.append({ commandId: "out-2", baseSeq: 0, mapId: MAP, command: commandOf(step, done, "out-2") });
    first.append({ commandId: "out-3", baseSeq: 0, mapId: MAP, command: commandOf(old, stale, "out-3") });

    const reopened = DeviceOutbox.open(file);
    expect(reopened.list().map((entry) => entry.commandId)).toEqual(["out-1", "out-2", "out-3"]);
    expect(reopened.list()[0]).toMatchObject({ commandId: "out-1", baseSeq: 0, mapId: MAP });
    expect(typeof reopened.list()[0]?.createdAt).toBe("string");

    const report = await pushOutboxFile(file, running.base);
    expect(report.rejected.map((item) => item.entry.commandId)).toEqual(["out-3"]);
    expect(report.rejected[0]?.code).toBe("CONFLICT");
    expect(DeviceOutbox.open(file).list()).toEqual([]);
    expect((await call("GET", `/api/maps/${MAP}`)).body.state.nodes.alpha.text).toBe("Alpha-3");

    const later = (await call("GET", `/api/maps/${MAP}`)).body.state as Record<string, any>;
    const renamed = clone(later);
    renamed.nodes.bravo.text = "Bravo-2";
    DeviceOutbox.open(file).append({ commandId: "out-4", baseSeq: 0, mapId: MAP, command: commandOf(later, renamed, "out-4") });
    const child = spawn(process.execPath, [CLI, "push", "--outbox", file, "--server", running.base], { cwd: BETA, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    const exit = await new Promise<number>((resolve) => child.once("exit", (code) => resolve(code ?? 1)));
    expect(exit).toBe(0);
    expect(JSON.parse(stdout).rejected).toEqual([]);
    expect(DeviceOutbox.open(file).list()).toEqual([]);
    expect((await call("GET", `/api/maps/${MAP}`)).body.state.nodes.bravo.text).toBe("Bravo-2");
  });

  test("pull returns the archived suffix, and a seq older than the archive horizon asks for a reclone", async () => {
    const before = await call("GET", "/api/sync/pull?after=0");
    expect(before.body.lines.some((line: { commandId?: string }) => line.commandId === "cmd-a")).toBe(true);
    const cloneBody = await call("GET", "/api/sync/clone");
    expect(cloneBody.status).toBe(200);
    expect(cloneBody.body.snapshotSeq).toBe(before.body.throughSeq);
    expect(Array.isArray(cloneBody.body.records)).toBe(true);

    await stopServer(running);
    const compacted = RecordWorkspaceStore.open(storeDir);
    compacted.compact();
    await compacted.close();
    running = await startServer(dataDir, storeDir);
    const archived = await call("GET", "/api/sync/pull?after=0");
    expect(archived.body.reclone).toBeUndefined();
    expect(archived.body.lines.some((line: { commandId?: string }) => line.commandId === "cmd-a")).toBe(true);
    expect(archived.body.lines.some((line: { commandId?: string }) => line.commandId === "out-2")).toBe(true);

    await stopServer(running);
    const pruning = RecordWorkspaceStore.open(storeDir);
    const pruned = pruning.pruneArchive({ retentionMs: 0, now: "2099-01-01T00:00:00.000Z" });
    expect(pruned.problems).toEqual([]);
    expect(pruned.deleted.length).toBeGreaterThan(0);
    await pruning.close();
    running = await startServer(dataDir, storeDir);
    const tooOld = await call("GET", "/api/sync/pull?after=0");
    expect(tooOld.status).toBe(200);
    expect(tooOld.body.reclone).toBe(true);
    expect(typeof tooOld.body.snapshotSeq).toBe("number");
    expect(tooOld.body.lines).toBeUndefined();
  });
});
