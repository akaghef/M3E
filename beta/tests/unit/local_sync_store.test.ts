import { randomUUID } from "node:crypto";
import fs from "node:fs";
import type http from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { closeActiveRecordStore, activeRecordStore, startLocalMode } from "../../src/node/record_store/active";
import { Neo4jDurability } from "../../src/node/record_store/neo4j_durability";
import { RecordWorkspaceStore, type JournalLine } from "../../src/node/record_store/store";
import { handleRecordSyncHttp } from "../../src/node/sync/http";
import { aiAgentAccountId } from "../../src/node/sync/issuer";
import { deviceStoreNames, dropDevicesUnder, LocalSync } from "../../src/node/sync/local";
import { DeviceOutbox, outboxIO, pushEnvelope } from "../../src/node/sync/outbox";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import type { AppState } from "../../src/shared/types";
import { TEST_NEO4J } from "./neo4j_test_store";

const ORIGIN = "http://127.0.0.1";
const WORKSPACE = "workspace";

let temp: string;
let devices: LocalSync[];
let transform: (url: URL, response: any) => unknown;
let online: boolean;
let remoteName: string;
let remoteStore: RecordWorkspaceStore;

function appState(text = "Root"): AppState {
  return {
    rootId: "root",
    nodes: { root: { id: "root", parentId: null, children: [], collapsed: false, nodeType: "text", text } },
    links: {},
  };
}

function remote() { return activeRecordStore()!; }

function entries(name: string) {
  return DeviceOutbox.open(deviceStoreNames(WORKSPACE, path.join(temp, name)).outbox, TEST_NEO4J).list();
}

async function confirmedLines(name: string, after: number) {
  const store = await RecordWorkspaceStore.openNeo4j(TEST_NEO4J, deviceStoreNames(WORKSPACE, path.join(temp, name)).confirmed, { warm: false });
  try { return await store.readJournalAfter(after); }
  finally { await store.close(); }
}

async function client(name = "local"): Promise<LocalSync> {
  const device = await LocalSync.open(path.join(temp, name), ORIGIN, TEST_NEO4J);
  devices.push(device);
  return device;
}

function change(store: RecordWorkspaceStore, text: string, map = "map"): void {
  const next = store.getMapRow(map).state;
  next.nodes[next.rootId].text = text;
  expect(store.saveWholeMap(map, next, "human")).toMatchObject({ ok: true });
}

function mapText(store: RecordWorkspaceStore, map = "map"): string {
  const { state } = store.getMapRow(map);
  return state.nodes[state.rootId].text;
}

function responseFor(
  url: URL, options: RequestInit,
  dispatch: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  rewrite: (url: URL, response: any) => unknown = (_url, body) => body,
  raw = false,
): Promise<Response> {
  const req = Object.assign(Readable.from(options.body ? [Buffer.from(String(options.body))] : []), {
    url: url.pathname + url.search, method: options.method ?? "GET", headers: { host: url.host, ...options.headers }, socket: { remoteAddress: "127.0.0.1" },
  });
  const headers = new Headers();
  return new Promise<Response>((resolve) => {
    const res = {
      req, statusCode: 200, headersSent: false, writableEnded: false,
      setHeader(key: string, value: string) { headers.set(key, value); },
      getHeader(key: string) { return headers.get(key) ?? undefined; },
      end(value: string | Buffer) {
        this.writableEnded = true;
        if (raw) { resolve(new Response(value, { status: this.statusCode, headers })); return; }
        const body = rewrite(url, JSON.parse(String(value)));
        resolve(new Response(JSON.stringify(body), { status: this.statusCode, headers }));
      },
    };
    dispatch(req as unknown as http.IncomingMessage, res as unknown as http.ServerResponse);
  });
}

async function serve(url: URL, options: RequestInit = {}): Promise<Response> {
  if (!online) throw new TypeError("Disconnected test transport");
  return responseFor(url, options, (req, res) => void handleRecordSyncHttp(req, res), transform);
}

beforeEach(async () => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-local-sync-store-"));
  devices = [];
  online = true;
  transform = (_url, response) => response;
  const store = path.join(temp, "remote");
  vi.stubEnv("M3E_STORE_DIR", store);
  vi.stubEnv("M3E_FORBID_LIVE_DATA", "1");
  vi.stubEnv("M3E_NEO4J_BOLT", "");
  vi.stubGlobal("fetch", serve);
  // The server still opens its store synchronously and reads the journal synchronously.
  // The store lives in Neo4j; this process keeps the lines of the commits it writes.
  remoteName = `remote:${randomUUID()}`;
  await RecordWorkspaceStore.createInNeo4j(TEST_NEO4J, remoteName, toSnapshot("workspace", [{ id: "map", state: appState() }]));
  remoteStore = await RecordWorkspaceStore.openNeo4j(TEST_NEO4J, remoteName);
  const lines: JournalLine[] = [];
  remoteStore.setCommitListener((line) => { lines.push(line); });
  (remoteStore as unknown as { journalLinesAfter(after: number): JournalLine[] }).journalLinesAfter = (after: number) => lines.filter((line) => line.seq > after);
  (RecordWorkspaceStore as unknown as { open(): RecordWorkspaceStore }).open = () => remoteStore;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(devices.map((device) => device.close()));
  await closeActiveRecordStore();
  await remoteStore.close();
  await Neo4jDurability.drop(TEST_NEO4J, remoteName);
  await dropDevicesUnder(TEST_NEO4J, temp);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(temp, { recursive: true, force: true });
});

test("transport A1: pushes and confirms a single Command above the batch and former request caps", async () => {
  const a = await client();
  const text = "大".repeat(3_000_000); // 9 MB UTF-8, beyond the former 8 MB request cap.
  change(a.store(), text);
  a.store().setMapColumns("map", { tags: ["after-large"] }, "human");
  const waiting = entries("local");
  const requests: number[] = [];
  vi.stubGlobal("fetch", (url: URL, options: RequestInit = {}) => {
    if (url.pathname === "/api/sync/push") requests.push(JSON.parse(String(options.body)).commands.length);
    return serve(url, options);
  });
  expect(await a.push(() => {})).toMatchObject({ sent: 2, committed: 2, conflicts: 0 });
  expect(requests).toEqual([1, 1]);
  expect(entries("local")).toEqual([]);
  expect(mapText(remote())).toBe(text);
  expect(remote().journalLinesAfter(waiting[0].baseSeq)!.map((line) => line.commandId)).toEqual(waiting.map((entry) => entry.commandId));
  expect((await a.status()).unsent).toBe(0);
});

test("transport A2: reports PUSH_COMMAND_TOO_LARGE, preserves order and retains blocked status after restart", async () => {
  const a = await client();
  // Keep the map's human-readable name small; the oversized value is a node detail.
  const state = a.store().getMapRow("map").state;
  state.nodes.root.details = "x".repeat(32_000_000);
  expect(a.store().saveWholeMap("map", state, "human")).toMatchObject({ ok: true });
  a.store().setMapColumns("map", { tags: ["must-wait"] }, "human");
  const waiting = entries("local");
  await expect(a.push(() => {})).rejects.toMatchObject({ status: 413, code: "PUSH_COMMAND_TOO_LARGE" });
  const expected = {
    unsent: 2, push: { state: "blocked", commandId: waiting[0].commandId,
      mapName: waiting[0].mapName, intent: waiting[0].command.intent,
      code: "PUSH_COMMAND_TOO_LARGE", limitBytes: 32_000_000, reason: expect.any(String) },
  };
  expect(await a.status()).toMatchObject(expected);
  expect(entries("local")).toEqual(waiting.map((entry) => ({ ...entry, attempted: true })));
  expect(remote().journalLinesAfter(waiting[0].baseSeq)).toEqual([]);
  await a.close();
  devices.splice(devices.indexOf(a), 1);
  const restarted = await client();
  expect(await restarted.status()).toMatchObject(expected);
}, 60_000);

test("transport retries smaller batches after a proxy 413 and clears blocked status only after settlement", async () => {
  const a = await client();
  change(a.store(), "First");
  const state = a.store().getMapRow("map").state;
  state.nodes.root.details = "x".repeat(3_000);
  // Distinct actor labels keep these Commands separate; both use the local human connection.
  expect(a.store().saveWholeMap("map", state, "human-second")).toMatchObject({ ok: true });
  a.store().setMapColumns("map", { tags: ["last"] }, "human");
  const waiting = entries("local");
  let limited = true;
  const accepted: string[] = [];
  vi.stubGlobal("fetch", async (url: URL, options: RequestInit = {}) => {
    if (url.pathname === "/api/sync/push") {
      if (limited && Buffer.byteLength(String(options.body)) > 2_000) return new Response("Too large", { status: 413 });
      accepted.push(...JSON.parse(String(options.body)).commands.map((entry: any) => entry.commandId));
    }
    return serve(url, options);
  });
  await expect(a.push(() => {})).rejects.toMatchObject({ code: "PUSH_COMMAND_TOO_LARGE" });
  expect(accepted).toEqual([waiting[0].commandId]);
  expect(await a.status()).toMatchObject({ unsent: 2, push: { state: "blocked", commandId: waiting[1].commandId } });
  await expect(a.push(() => {})).rejects.toMatchObject({ code: "PUSH_COMMAND_TOO_LARGE" });
  expect(accepted).toEqual([waiting[0].commandId]);
  limited = false;
  expect(await a.push(() => {})).toMatchObject({ committed: 2 });
  expect(accepted).toEqual(waiting.map((entry) => entry.commandId));
  expect(await a.status()).toMatchObject({ unsent: 0, push: { state: "idle" } });
});

async function rawMapResponse(acceptEncoding?: string) {
  vi.stubEnv("M3E_DATA_DIR", path.join(temp, "viewer"));
  vi.stubEnv("M3E_TAILSCALE_USERS", undefined);
  const { createAppServer } = await import("../../src/node/start_viewer");
  const app = createAppServer();
  return responseFor(new URL("/api/maps/map", ORIGIN), {
    headers: acceptEncoding === undefined ? {} : { "accept-encoding": acceptEncoding },
  }, (req, res) => { app.emit("request", req, res); }, (_url, body) => body, true);
}

test("transport B1: map load negotiates gzip and decompresses to the exact uncompressed response", async () => {
  remote().saveWholeMap("map", appState("Root".repeat(300_000)), "human");
  const plain = await rawMapResponse();
  const compressed = await rawMapResponse("gzip");
  expect(compressed.status).toBe(200);
  expect(compressed.headers.get("content-encoding")).toBe("gzip");
  expect(compressed.headers.get("vary")).toContain("Accept-Encoding");
  const bytes = Buffer.from(await compressed.arrayBuffer());
  const original = Buffer.from(await plain.arrayBuffer());
  expect(bytes.length).toBeLessThan(original.length);
  expect(gunzipSync(bytes)).toEqual(original);
});

test("transport B2: map load without Accept-Encoding keeps the original JSON body", async () => {
  const plain = await rawMapResponse();
  expect(plain.status).toBe(200);
  expect(plain.headers.get("content-encoding")).toBeNull();
  expect(plain.headers.get("content-type")).toBe("application/json; charset=utf-8");
  const body = await plain.text();
  const doc = JSON.parse(body);
  expect(body).toBe(JSON.stringify(doc));
  expect(doc.state.nodes.root.text).toBe("Root");
  for (const encoding of ["gzip;q=0", "br", "gzip;q=0, *;q=1"]) {
    const refused = await rawMapResponse(encoding);
    expect(refused.headers.get("content-encoding")).toBeNull();
    expect(await refused.text()).toBe(body);
  }
});

test("local content and map operations enter the outbox and converge through the remote push and pull handlers", async () => {
  const source = remote();
  expect(source.saveWholeMap("map", appState("Remote edit"), "remote")).toMatchObject({ ok: true });
  const a = await client("a");
  const b = await client("b");
  const baseSeq = source.seq();
  expect(a.store().getMapRow("map")).toEqual(source.getMapRow("map"));
  change(a.store(), "Local edit");
  expect(a.store().saveWholeMap("new", appState("Created"), "human")).toMatchObject({ ok: true });
  a.store().setMapColumns("new", { tags: ["tag"] }, "human");
  a.store().renameMapId("new", "renamed", "human");
  a.store().setMapColumns("map", { archived: 1 }, "human");
  a.store().deleteMap("map", "human");

  const waiting = entries("a");
  expect(waiting.map((entry) => entry.mapOp)).toEqual([undefined, "create", "columns", "rename", "columns", "delete"]);
  expect(waiting.every((entry) => entry.baseSeq === baseSeq)).toBe(true);
  expect(waiting[0].command.changes).toEqual([{
    kind: "node", key: ["root"], op: "update", before: { text: "Remote edit" }, after: { text: "Local edit" },
  }]);
  expect(source.seq()).toBe(baseSeq);
  expect(source.hasMap("new")).toBe(false);
  expect(await a.push(() => {})).toMatchObject({ committed: 6, sent: 6, conflicts: 0, pulled: 6, confirmedSeq: baseSeq + 6 });
  expect(entries("a")).toEqual([]);
  const notify = vi.fn();
  await b.pull(notify);
  expect(notify).toHaveBeenCalledWith(expect.arrayContaining(["map", "renamed"]));
  for (const store of [source, a.store(), b.store()]) {
    expect(store.hasMap("map")).toBe(false);
    expect(store.hasMap("new")).toBe(false);
    expect(store.getMapRow("renamed").tags).toEqual(["tag"]);
    expect(mapText(store, "renamed")).toBe("Created");
  }
});

test("an offline edit survives reopening and a missing acknowledgement does not duplicate a remote commit", async () => {
  let a = await client();
  const base = remote().seq();
  online = false;
  change(a.store(), "Offline");
  const waiting = entries("local");
  expect(await a.status()).toMatchObject({ remote: { state: "unreachable" }, unsent: 1, confirmedSeq: base });
  await a.close();
  a = await client();
  expect(mapText(a.store())).toBe("Offline");
  expect(entries("local")).toEqual(waiting);
  online = true;
  transform = (url, body) => url.pathname === "/api/sync/push" ? { ...body, results: [] } : body;
  expect(await a.push(() => {})).toMatchObject({ sent: 1, committed: 0, pulled: 1 });
  expect(entries("local")).toEqual(waiting.map((entry) => ({ ...entry, attempted: true })));
  expect(a.conflictList()).toEqual([]);
  transform = (_url, body) => body;
  expect(await a.push(() => {})).toMatchObject({ sent: 1, committed: 1, pulled: 0 });
  expect(remote().seq()).toBe(base + 1);
  expect(entries("local")).toEqual([]);
});

test("no-op and rejected commands settle independently and a conflict retains the original before and after", async () => {
  const a = await client("a");
  const b = await client("b");
  const base = remote().seq();
  change(a.store(), "A");
  change(b.store(), "A");
  await a.push(() => {});
  expect(await b.push(() => {})).toMatchObject({ noOp: 1, conflicts: 0, confirmedSeq: base + 1 });
  expect(entries("b")).toEqual([]);
  change(a.store(), "A again");
  change(b.store(), "Losing edit");
  const [loser] = entries("b");
  await a.push(() => {});
  expect(await b.push(() => {})).toMatchObject({ committed: 0, conflicts: 1 });
  expect(mapText(b.store())).toBe("A again");
  expect(entries("b")).toEqual([]);
  expect(b.conflictList()).toMatchObject([{ entry: loser, code: "CONFLICT", reason: expect.any(String), at: expect.any(String) }]);
  await b.close();
  expect((await client("b")).conflictList()).toMatchObject([{ entry: loser }]);
});

test("resend decisions: a remote refusal stays out of replay after rebase, restart and restoration of its before value", async () => {
  let device = await client();
  change(device.store(), "pending");
  const [original] = entries("local");
  change(remote(), "other");
  expect(await device.push(() => {})).toMatchObject({ conflicts: 1 });
  expect(entries("local")).toEqual([]);
  change(remote(), "Root"); // The original Command would now be valid against the current state.
  await device.pull(() => {});
  await device.close();
  device = await client();
  expect(device.conflictList()).toMatchObject([{ entry: original, code: "CONFLICT" }]);
  expect(await device.push(() => {})).toMatchObject({ sent: 0, committed: 0 });
  expect(mapText(device.store())).toBe("Root");
  const envelope = pushEnvelope(original);
  const result = await serve(new URL("/api/sync/push", ORIGIN), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    ...remote().syncIdentity(), commands: [envelope],
  }) });
  expect(await result.json()).toMatchObject({ results: [{ code: "CONFLICT" }] });
  expect(mapText(remote())).toBe("Root");
});

test("an invalid suffix keeps the working store intact, an interrupted rebase recovers by a rebuild, and replay failures remain inspectable", async () => {
  const a = await client();
  const target = a.storeDir();
  const base = remote().seq();
  change(a.store(), "Pending");
  change(remote(), "Remote one");
  change(remote(), "Remote two");
  transform = (url, body) => url.pathname === "/api/sync/pull" && body.lines?.length > 0
    ? { ...body, lines: [body.lines[0], { ...body.lines[1], seq: base + 3 }] }
    : body;
  await expect(a.pull(() => {})).rejects.toThrow("contiguous suffix");
  expect(await confirmedLines("local", base)).toEqual([]);
  expect(mapText(a.store())).toBe("Pending");
  expect(a.storeDir()).toBe(target);
  transform = (_url, body) => body;

  // A rebase interrupted after its reset: the next pull rebuilds the working store from the confirmed one.
  const commit = RecordWorkspaceStore.prototype.commitSyncCommand;
  const fail = vi.spyOn(RecordWorkspaceStore.prototype, "commitSyncCommand").mockImplementation(function (this: RecordWorkspaceStore, ...args) {
    if (this === a.store()) throw new Error("Rebase interrupted");
    return commit.apply(this, args);
  });
  await expect(a.pull(() => {})).rejects.toThrow("Rebase interrupted");
  expect(entries("local")).toHaveLength(1);
  fail.mockRestore();
  await a.pull(() => {});
  expect(a.storeDir()).not.toBe(target);
  expect(mapText(a.store())).toBe("Remote two");
  expect(a.conflictList()).toMatchObject([{ code: "CONFLICT" }]);
  expect(entries("local")).toEqual([]);
  const exact = await (await serve(new URL(`/api/sync/pull?after=${base}`, ORIGIN))).json();
  expect(await confirmedLines("local", base)).toEqual(exact.lines);
});

test("fences the complete request and refuses a wrong response before entering the next sync", async () => {
  const a = await client();
  const identity = remote().syncIdentity();
  expect(identity.epoch).toBe(1);
  const seq = remote().seq();
  change(a.store(), "Pending");
  const [entry] = entries("local");
  const wrong = await serve(new URL("/api/sync/push", ORIGIN), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...identity, epoch: identity.epoch + 1, commands: [pushEnvelope(entry)] }),
  });
  expect(wrong.status).toBe(409);
  expect(await wrong.json()).toMatchObject({ code: "FENCED" });
  expect(remote().seq()).toBe(seq);
  const fencedPull = await serve(new URL(`/api/sync/pull?after=${seq}&historyId=unknown`, ORIGIN));
  expect(fencedPull.status).toBe(409);

  transform = (_url, body) => ({ ...body, historyId: "other" });
  await expect(a.pull(() => {})).rejects.toMatchObject({ code: "FENCED" });
  transform = (_url, body) => body;
  await expect(a.push(() => {})).rejects.toMatchObject({ code: "FENCED" });
  expect(await a.status()).toMatchObject({ unsent: 1, remote: { state: "refused" }, confirmedSeq: seq });
  expect(entries("local")).toEqual([entry]);
  expect(mapText(a.store())).toBe("Pending");
  await closeActiveRecordStore();
  expect(remote().syncIdentity()).toEqual(identity);
});

test("reclone keeps pending edits and sends the same fence on the replacement clone", async () => {
  const a = await client();
  change(a.store(), "Pending");
  expect(remote().saveWholeMap("other", appState("Remote"), "remote")).toMatchObject({ ok: true });
  const [waiting] = entries("local");
  const identity = remote().syncIdentity();
  const snapshotSeq = remote().seq();
  const cloned = vi.fn();
  transform = (url, body) => {
    if (url.pathname === "/api/sync/pull") return { ...identity, reclone: true, snapshotSeq };
    if (url.pathname === "/api/sync/clone") cloned(Object.fromEntries(url.searchParams));
    return body;
  };
  expect(await a.pull(() => {})).toMatchObject({ confirmedSeq: snapshotSeq, recloned: true });
  expect(cloned).toHaveBeenCalledWith({ ...identity, epoch: String(identity.epoch), index: "1" });
  expect(entries("local")).toEqual([waiting]);
  expect(mapText(a.store())).toBe("Pending");
  expect(mapText(a.store(), "other")).toBe("Remote");
});

test("the viewer app routes MCP, home writes and reads through the active local store", async () => {
  vi.stubEnv("M3E_DATA_DIR", path.join(temp, "viewer"));
  vi.stubEnv("M3E_SYNC_REMOTE", ORIGIN);
  vi.stubEnv("M3E_TAILSCALE_USERS", undefined);
  const { createAppServer } = await import("../../src/node/start_viewer");
  const source = remote();
  vi.stubEnv("M3E_NEO4J_BOLT", TEST_NEO4J.uri);
  if (TEST_NEO4J.user !== undefined) {
    vi.stubEnv("M3E_NEO4J_USER", TEST_NEO4J.user);
    vi.stubEnv("M3E_NEO4J_PASSWORD", TEST_NEO4J.password ?? "");
  }
  source.saveWholeMap("archived", appState("Archived"), "remote");
  source.setMapColumns("archived", { archived: 1 }, "remote");
  const app = createAppServer();
  const request = async (route: string, method = "GET", body?: unknown) => {
    const response = await responseFor(new URL(route, ORIGIN), {
      method, headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, (req, res) => { app.emit("request", req, res); });
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    return result;
  };
  expect(await request("/api/sync/local/status")).toEqual({ mode: "remote" });
  await startLocalMode();
  online = false;
  const mcp = (name: string, args: object) => request("/api/mcp/call", "POST", { name, arguments: args });
  const context = await mcp("m3e_context", { action: "enter", target: "m3e://maps/map" });
  await mcp("m3e_update", { kind: "content", context_id: context.context_id, target: "m3e://maps/map/nodes/root", text: "Changed" });
  await mcp("m3e_create", { kind: "node", context_id: context.context_id, text: "Added" });
  const created = await request("/api/maps/new", "POST", { label: "New local map" });
  await request("/api/maps/archived", "DELETE");
  const localMap = await request("/api/maps/map");
  expect(localMap.state.nodes.root.text).toBe("Changed");
  expect(Object.values(localMap.state.nodes)).toEqual(expect.arrayContaining([expect.objectContaining({ text: "Added" })]));
  expect((await request("/api/maps?includeArchived=true")).maps.map((map: { id: string }) => map.id)).toEqual(
    expect.arrayContaining(["map", created.id]),
  );
  expect(activeRecordStore()!.hasMap("archived")).toBe(false);
  expect(entries("viewer").map((entry) => entry.mapOp)).toEqual([undefined, undefined, "create", "delete"]);
  expect(await request("/api/sync/local/status")).toMatchObject({ mode: "local", remote: { state: "unreachable" }, unsent: 4 });
  expect(mapText(source)).toBe("Root");
  expect(source.hasMap("archived")).toBe(true);
});

test("a local write made while a push response is pending remains in the outbox", async () => {
  const a = await client();
  change(a.store(), "Sent");
  transform = (url, body) => {
    if (url.pathname === "/api/sync/push") change(a.store(), "Saved while push was in flight");
    return body;
  };
  expect(await a.push(() => {})).toMatchObject({ sent: 1, committed: 1 });
  expect(mapText(remote())).toBe("Sent");
  expect(mapText(a.store())).toBe("Saved while push was in flight");
  expect(entries("local")).toHaveLength(1);
});

test("a failed outbox fsync cannot publish a successful working commit", async () => {
  const a = await client();
  const real = outboxIO.run;
  const fsync = vi.spyOn(outboxIO, "run").mockImplementation((connection, write, statements) => {
    if (write) throw new Error("Outbox disk is full");
    return real.call(outboxIO, connection, write, statements);
  });
  expect(() => change(a.store(), "Must retry")).toThrow("Outbox disk is full");
  fsync.mockRestore();
  expect(mapText(a.store())).toBe("Root");
  expect(entries("local")).toEqual([]);
  change(a.store(), "Retry succeeded");
  expect(entries("local")).toHaveLength(1);
  expect(mapText(a.store())).toBe("Retry succeeded");
});

test("a pull rebases in proportion to the delta and the pending Commands, not to the size of the workspace", async () => {
  // The same delta (one remote edit, one pending edit) against workspaces of two sizes.
  function grow(count: number): void {
    const state = appState("Big");
    for (let i = 0; i < count; i += 1) {
      const id = `n${i}`;
      state.nodes[id] = { id, parentId: "root", children: [], collapsed: false, nodeType: "text", text: `Node ${i}` };
      state.nodes.root.children.push(id);
    }
    expect(remote().saveWholeMap("big", state, "remote")).toMatchObject({ ok: true });
  }
  async function rebaseOps(name: string): Promise<number> {
    const device = await client(name);
    const directory = device.storeDir();
    change(device.store(), `Pending ${name}`);
    const floor = device.store().seq();
    change(remote(), `Remote ${name}`);
    expect(await device.pull(() => {})).toMatchObject({ pulled: 1 });
    expect(device.storeDir()).toBe(directory);
    expect(device.conflictList()).toMatchObject([{ code: "CONFLICT" }]);
    expect(mapText(device.store())).toBe(`Remote ${name}`);
    const lines = await device.store().readJournalAfter(floor - 1);
    const rebases = (lines ?? []).filter((line) => line.intent === "local-rebase");
    expect(rebases).toHaveLength(1);
    return rebases[0]!.ops.length;
  }
  grow(10);
  const small = await rebaseOps("small");
  grow(5000);
  const large = await rebaseOps("large");
  expect(small).toBeGreaterThan(0);
  expect(large).toBe(small);
});

test("a start resumes the working store without rebuilding it, and rebases what arrived while it was stopped", async () => {
  const device = await client("resume");
  const directory = device.storeDir();
  change(device.store(), "Pending before stop");
  await device.close();
  devices.splice(devices.indexOf(device), 1);
  const again = await client("resume");
  expect(again.storeDir()).toBe(directory);
  expect(mapText(again.store())).toBe("Pending before stop");
  expect(entries("resume")).toHaveLength(1);
  await again.push(() => {});
  expect(mapText(remote())).toBe("Pending before stop");
  expect(again.storeDir()).toBe(directory);
  expect(entries("resume")).toHaveLength(0);
});

test("a start resumes past a pending Command that left no commit because it was a no-op", async () => {
  const device = await client("noop");
  const directory = device.storeDir();
  // An empty update, as a viewer can send: it reaches the outbox and commits nothing.
  DeviceOutbox.open(deviceStoreNames(WORKSPACE, path.join(temp, "noop")).outbox, TEST_NEO4J).append({
    commandId: "noop-1", mapId: "map", baseSeq: remote().seq(),
    command: { commandId: "noop-1", intent: "assert", actor: { kind: "human", id: "test" }, changes: [{ kind: "node", key: ["root"], op: "update", before: {}, after: {} }] },
  });
  change(device.store(), "After the no-op");
  await device.close();
  devices.splice(devices.indexOf(device), 1);
  const again = await client("noop");
  expect(again.storeDir()).toBe(directory);
  expect(mapText(again.store())).toBe("After the no-op");
  expect(entries("noop").map((entry) => entry.commandId)).toContain("noop-1");
});


test("pull uses the store index without rereading the journal or snapshot", async () => {
  const source = remote();
  for (let i = 0; i < 10; i += 1) change(source, `edit ${i}`);
  const read = vi.spyOn(fs, "readFileSync");
  const after = source.seq() - 1;
  const response = await serve(new URL(`/api/sync/pull?after=${after}&scope=any`, ORIGIN));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.lines).toHaveLength(1);
  expect(body.throughSeq).toBe(source.seq());
  expect(read.mock.calls.filter(([file]) => String(file).endsWith(".jsonl"))).toHaveLength(0);
  const future = await serve(new URL(`/api/sync/pull?after=${source.seq() + 1}`, ORIGIN));
  expect(await future.json()).toMatchObject({ reclone: true, snapshotSeq: source.seq() });
});

test("empty viewer-shaped updates never enter the working journal or outbox", async () => {
  const device = await client();
  const store = device.store();
  const seq = store.seq();
  const result = store.commitMapCommand("map", {
    commandId: "empty-rename", actor: { kind: "human", id: "viewer" }, intent: "rename",
    changes: [{ kind: "node", key: ["root"], op: "update", before: {}, after: {} }],
  }, "human");
  expect(result).toMatchObject({ ok: true, noOp: true });
  expect(store.seq()).toBe(seq);
  expect(entries("local")).toEqual([]);
});

test("every viewer field also survives the local working store and outbox path", async () => {
  const { exerciseViewerFields } = await import("./viewer_field_lifecycle");
  const device = await client();
  exerciseViewerFields(device.store(), "local");
  await device.push(() => {});
  expect((await device.status()).conflicts).toBe(0);
});

test("offline moves of the same node use remote confirmation order and converge after rebase", async () => {
  const { diffState } = await import("../../src/shared/map_changes");
  const { command, node } = await import("./record_store_helpers");
  const initial = appState();
  for (const id of ["a", "b", "child"]) { initial.nodes[id] = node(id, "root"); initial.nodes.root.children.push(id); }
  expect(remote().saveWholeMap("map", initial, "human").ok).toBe(true);
  const a = await client("a"), b = await client("b");
  for (const [device, parent] of [[a, "a"], [b, "b"]] as const) {
    const before = device.store().getMapRow("map").state;
    const after = JSON.parse(JSON.stringify(before));
    after.nodes.root.children = after.nodes.root.children.filter((id: string) => id !== "child");
    after.nodes.child.parentId = parent; after.nodes[parent].children.push("child");
    expect(device.store().commitMapCommand("map", command(diffState(before, after)), "human").ok).toBe(true);
  }
  expect(await a.push(() => {})).toMatchObject({ conflicts: 0, committed: 1 });
  const baseline = a.store().readMapRecords("map")!;
  expect(await b.push(() => {})).toMatchObject({ conflicts: 0, committed: 1 });
  await a.pull(() => {});
  for (const store of [remote(), a.store(), b.store()]) expect(store.getMapRow("map").state.nodes.child.parentId).toBe("b");
  const delta = a.store().readMapRecords("map", baseline.revision);
  expect(delta).not.toBeNull();
  expect(delta!.records.some(item => item.record?.kind === "connection")).toBe(true);
  expect(entries("a")).toEqual([]); expect(entries("b")).toEqual([]);
});

test("squash: local push drops a created/deleted node without touching working state", async () => {
  const a = await client();
  const initial = a.store().getMapRow("map").state;
  const next = structuredClone(initial);
  next.nodes.root.children.push("temporary");
  next.nodes.temporary = { id: "temporary", parentId: "root", children: [], text: "private", nodeType: "text", collapsed: false };
  expect(a.store().saveWholeMap("map", next, "human")).toMatchObject({ ok: true });
  expect(a.store().saveWholeMap("map", initial, "human")).toMatchObject({ ok: true });
  const working = a.store().getMapRow("map").state;
  const seq = remote().seq();
  expect(await a.push(() => {})).toMatchObject({ sent: 0, committed: 0 });
  expect(remote().seq()).toBe(seq);
  expect(entries("local")).toEqual([]);
  expect(a.store().getMapRow("map").state).toEqual(working);
});

test("squash: three updates push one first-before last-after Command and preserve state", async () => {
  const a = await client();
  change(a.store(), "one"); change(a.store(), "two"); change(a.store(), "three");
  const oldIds = entries("local").map((entry) => entry.commandId);
  const state = a.store().getMapRow("map").state;
  let pushed: any[] = [];
  vi.stubGlobal("fetch", (url: URL, options: RequestInit = {}) => {
    if (url.pathname === "/api/sync/push") pushed = JSON.parse(String(options.body)).commands;
    return serve(url, options);
  });
  expect(await a.push(() => {})).toMatchObject({ sent: 1, committed: 1 });
  expect(pushed).toHaveLength(1);
  expect(oldIds).not.toContain(pushed[0].commandId);
  expect(pushed[0].command.changes[0]).toMatchObject({ before: { text: "Root" }, after: { text: "three" } });
  expect(a.store().getMapRow("map").state).toEqual(state);
  expect(mapText(remote())).toBe("three");
});

test("squash: lost response survives restart using delta rebase, without a workspace read", async () => {
  const a = await client();
  change(a.store(), "one"); change(a.store(), "two");
  vi.stubGlobal("fetch", async (url: URL, options: RequestInit = {}) => {
    const result = await serve(url, options);
    if (url.pathname === "/api/sync/push") throw new Error("lost response");
    return result;
  });
  await expect(a.push(() => {})).rejects.toMatchObject({ code: "REMOTE_UNREACHABLE" });
  const pending = entries("local");
  expect(pending).toHaveLength(1);
  await a.close(); devices = [];
  const fullRead = vi.spyOn(RecordWorkspaceStore.prototype, "records");
  vi.stubGlobal("fetch", serve);
  const restarted = await client();
  expect(fullRead).not.toHaveBeenCalled();
  expect(mapText(restarted.store())).toBe("two");
  expect(entries("local")[0].commandId).toBe(pending[0].commandId);
  expect(await restarted.push(() => {})).toMatchObject({ committed: 1 });
  expect(remote().journalLinesAfter(0)!.filter((line) => line.commandId === pending[0].commandId)).toHaveLength(1);
});

test.each([["viewer", "beta@example.test"], ["mcp", aiAgentAccountId("client-instance")]])("verified login: %s push records %s as issuer, preserving actor", async (kind, expected) => {
  vi.stubEnv("M3E_TAILSCALE_USERS", "beta@example.test");
  vi.stubEnv("M3E_SYNC_REMOTE", undefined);
  const response = await serve(new URL("/api/sync/push", ORIGIN), {
    method: "POST", headers: { "content-type": "application/json", "tailscale-user-login": "beta@example.test", "x-m3e-connection": kind, "x-m3e-actor-instance": "client-instance" },
    body: JSON.stringify({ ...remote().syncIdentity(), commands: [{ mapId: "map", commandId: "login-command", baseSeq: 0,
      command: { commandId: "login-command", actor: { kind: "ai-agent", id: "untrusted-label" }, intent: "edit", changes: [{ kind: "node", key: ["root"], op: "update", before: { text: "Root" }, after: { text: "edited" } }] } }] }),
  });
  expect(await response.json()).toMatchObject({ results: [{ status: "committed" }] });
  expect(remote().journalLinesAfter(0)!.at(-1)).toMatchObject({ issuer: expected, actor: { kind: "ai-agent", id: "untrusted-label" } });
});

test("verified login: direct viewer and MCP Commands inherit only their own checked request login", async () => {
  vi.stubEnv("M3E_DATA_DIR", path.join(temp, "viewer"));
  vi.stubEnv("M3E_SYNC_REMOTE", undefined);
  vi.stubEnv("M3E_TAILSCALE_USERS", "beta@example.test,other@example.test");
  const { createAppServer } = await import("../../src/node/start_viewer");
  const app = createAppServer();
  const call = async (route: string, body: object, login = "beta@example.test") => {
    const response = await responseFor(new URL(route, ORIGIN), {
      method: "POST", headers: { "content-type": "application/json", "tailscale-user-login": login }, body: JSON.stringify(body),
    }, (req, res) => { app.emit("request", req, res); });
    const bodyResult = await response.json();
    expect(response.status, JSON.stringify(bodyResult)).toBe(200);
    return bodyResult;
  };
  await call("/api/maps/map/commands", { commandId: "viewer-login", actor: { kind: "human", id: "actor" }, intent: "edit", changes: [{ kind: "node", key: ["root"], op: "update", before: { text: "Root" }, after: { text: "viewer" } }] });
  const context = await call("/api/mcp/call", { name: "m3e_context", arguments: { action: "enter", target: "m3e://maps/map" } });
  await call("/api/mcp/call", { name: "m3e_update", arguments: { kind: "content", context_id: context.context_id, target: "m3e://maps/map/nodes/root", text: "mcp" } }, "other@example.test");
  // The viewer Command carries the human's login; the MCP Command stays its AI agent's account.
  const [viewerIssuer, mcpIssuer] = remote().journalLinesAfter(0)!.map((line) => line.issuer);
  expect(viewerIssuer).toBe("beta@example.test");
  expect(mcpIssuer).toMatch(/^acct_ai_/);
});
