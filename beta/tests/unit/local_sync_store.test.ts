import fs from "node:fs";
import type http from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { closeActiveRecordStore, activeRecordStore, startLocalMode } from "../../src/node/record_store/active";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { handleRecordSyncHttp } from "../../src/node/sync/http";
import { LocalSync } from "../../src/node/sync/local";
import { DeviceOutbox, pushEnvelope } from "../../src/node/sync/outbox";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import type { AppState } from "../../src/shared/types";

const ORIGIN = "http://127.0.0.1";
function activeDirectory(dir: string): string {
  return process.platform === "win32"
    ? path.resolve(path.dirname(dir), fs.readFileSync(path.join(dir, "CURRENT"), "utf8").trim())
    : fs.realpathSync(dir);
}

let temp: string;
let devices: LocalSync[];
let transform: (url: URL, response: any) => unknown;
let online: boolean;

function appState(text = "Root"): AppState {
  return {
    rootId: "root",
    nodes: { root: { id: "root", parentId: null, children: [], collapsed: false, nodeType: "text", text } },
    links: {},
  };
}

function remote() { return activeRecordStore()!; }

function entries(name: string) {
  return DeviceOutbox.open(path.join(temp, name, "sync/outbox.jsonl")).list();
}

async function client(name = "local"): Promise<LocalSync> {
  const device = await LocalSync.open(path.join(temp, name), ORIGIN);
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
): Promise<Response> {
  const req = Object.assign(Readable.from(options.body ? [Buffer.from(String(options.body))] : []), {
    url: url.pathname + url.search, method: options.method ?? "GET", headers: { host: url.host, ...options.headers }, socket: { remoteAddress: "127.0.0.1" },
  });
  const headers = new Headers();
  return new Promise<Response>((resolve) => {
    const res = {
      statusCode: 200, headersSent: false, writableEnded: false,
      setHeader(key: string, value: string) { headers.set(key, value); },
      end(value: string) {
        this.writableEnded = true;
        const body = rewrite(url, JSON.parse(value));
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

beforeEach(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-local-sync-store-"));
  devices = [];
  online = true;
  transform = (_url, response) => response;
  const store = path.join(temp, "remote");
  vi.stubEnv("M3E_STORE_DIR", store);
  vi.stubEnv("M3E_FORBID_LIVE_DATA", "1");
  vi.stubEnv("M3E_NEO4J_BOLT", "");
  vi.stubGlobal("fetch", serve);
  RecordWorkspaceStore.create(store, toSnapshot("workspace", [{ id: "map", state: appState() }]));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(devices.map((device) => device.close()));
  await closeActiveRecordStore();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(temp, { recursive: true, force: true });
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
  expect(entries("local")).toEqual(waiting);
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

test("an invalid suffix keeps the working store intact, an interrupted rebase recovers by a rebuild, and replay failures remain inspectable", async () => {
  const a = await client();
  const working = path.join(temp, "local/store");
  const target = activeDirectory(working);
  const base = remote().seq();
  change(a.store(), "Pending");
  change(remote(), "Remote one");
  change(remote(), "Remote two");
  transform = (url, body) => url.pathname === "/api/sync/pull" && body.lines?.length > 0
    ? { ...body, lines: [body.lines[0], { ...body.lines[1], seq: base + 3 }] }
    : body;
  await expect(a.pull(() => {})).rejects.toThrow("contiguous suffix");
  expect(fs.readFileSync(path.join(activeDirectory(path.join(temp, "local/sync/confirmed")), "journal.jsonl"), "utf8")).toBe("");
  expect(mapText(a.store())).toBe("Pending");
  expect(activeDirectory(working)).toBe(target);
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
  expect(activeDirectory(working)).not.toBe(target);
  expect(mapText(a.store())).toBe("Remote two");
  expect(a.conflictList()).toMatchObject([{ code: "CONFLICT" }]);
  expect(entries("local")).toEqual([]);
  const exact = await (await serve(new URL(`/api/sync/pull?after=${base}`, ORIGIN))).json();
  const confirmed = fs.readFileSync(path.join(activeDirectory(path.join(temp, "local/sync/confirmed")), "journal.jsonl"), "utf8");
  expect(confirmed.trim().split("\n").map((line) => JSON.parse(line))).toEqual(exact.lines);
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
  const fsync = vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => { throw new Error("Outbox disk is full"); });
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
    const working = path.join(temp, name, "store");
    const directory = activeDirectory(working);
    change(device.store(), `Pending ${name}`);
    change(remote(), `Remote ${name}`);
    expect(await device.pull(() => {})).toMatchObject({ pulled: 1 });
    expect(activeDirectory(working)).toBe(directory);
    expect(device.conflictList()).toMatchObject([{ code: "CONFLICT" }]);
    expect(mapText(device.store())).toBe(`Remote ${name}`);
    const lines = fs.readFileSync(path.join(directory, "journal.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const rebases = lines.filter((line) => line.intent === "local-rebase");
    expect(rebases).toHaveLength(1);
    return rebases[0].ops.length;
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
  const working = path.join(temp, "resume", "store");
  const directory = activeDirectory(working);
  change(device.store(), "Pending before stop");
  await device.close();
  devices.splice(devices.indexOf(device), 1);
  const again = await client("resume");
  expect(activeDirectory(working)).toBe(directory);
  expect(mapText(again.store())).toBe("Pending before stop");
  expect(entries("resume")).toHaveLength(1);
  await again.push(() => {});
  expect(mapText(remote())).toBe("Pending before stop");
  expect(activeDirectory(working)).toBe(directory);
  expect(entries("resume")).toHaveLength(0);
});

test("a start resumes past a pending Command that left no commit because it was a no-op", async () => {
  const device = await client("noop");
  const working = path.join(temp, "noop", "store");
  const directory = activeDirectory(working);
  // An empty update, as a viewer can send: it reaches the outbox and commits nothing.
  DeviceOutbox.open(path.join(temp, "noop", "sync/outbox.jsonl")).append({
    commandId: "noop-1", mapId: "map", baseSeq: remote().seq(),
    command: { commandId: "noop-1", intent: "assert", actor: { kind: "human", id: "test" }, changes: [{ kind: "node", key: ["root"], op: "update", before: {}, after: {} }] },
  });
  change(device.store(), "After the no-op");
  await device.close();
  devices.splice(devices.indexOf(device), 1);
  const again = await client("noop");
  expect(activeDirectory(working)).toBe(directory);
  expect(mapText(again.store())).toBe("After the no-op");
  expect(entries("noop").map((entry) => entry.commandId)).toContain("noop-1");
});
