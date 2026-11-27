import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NEO4J_STORE_FILE } from "../../src/node/record_store/active";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { deviceStoreNames, dropDevicesUnder, LocalSync } from "../../src/node/sync/local";
import { DeviceOutbox } from "../../src/node/sync/outbox";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import type { AppState } from "../../src/shared/types";
import { dropTestStores, testStoreName, TEST_NEO4J } from "./neo4j_test_store";

const BETA = path.resolve(__dirname, "../..");
const SERVER = path.join(BETA, "dist/node/start_viewer.js");
const MAIN = "sync-map";
const ARCHIVED = "archived";
const WORKSPACE = "sync-workspace";

function storeToken(dir: string): string {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "sync", "remote.json"), "utf8")) as { workspaceId: string; workingGeneration?: number };
  return `${deviceStoreNames(meta.workspaceId, dir).working}#${meta.workingGeneration ?? 0}`;
}

async function confirmedLines(dir: string, after: number) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "sync", "remote.json"), "utf8")) as { workspaceId: string };
  const store = await RecordWorkspaceStore.openNeo4j(TEST_NEO4J, deviceStoreNames(meta.workspaceId, dir).confirmed, { warm: false });
  try { return await store.readJournalAfter(after); }
  finally { await store.close(); }
}

function neo4jEnv(): NodeJS.ProcessEnv {
  return {
    M3E_NEO4J_BOLT: TEST_NEO4J.uri,
    M3E_NEO4J_USER: TEST_NEO4J.user ?? "",
    M3E_NEO4J_PASSWORD: TEST_NEO4J.password ?? "",
    M3E_NEO4J_PASSWORD_FILE: "",
    M3E_NEO4J_DATABASE: TEST_NEO4J.database ?? "",
  };
}

let temp: string;
let children: ChildProcess[];
let proxies: http.Server[];

beforeEach(() => {
  vi.stubEnv("M3E_FORBID_LIVE_DATA", "1");
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-local-mode-"));
  children = [];
  proxies = [];
});
afterEach(async () => {
  await Promise.all(children.map(stop));
  await Promise.all(proxies.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await dropDevicesUnder(TEST_NEO4J, temp);
  await dropTestStores();
  fs.rmSync(temp, { force: true, recursive: true });
  vi.unstubAllEnvs();
});

function initialState(prefix: string): AppState {
  const rootId = prefix + "-root";
  const childId = prefix + "-child";
  return {
    rootId,
    nodes: {
      [rootId]: { id: rootId, parentId: null, children: [childId], nodeType: "text", text: "Root", collapsed: false },
      [childId]: { id: childId, parentId: rootId, children: [], nodeType: "text", text: "Child", collapsed: false },
    },
    links: {},
  };
}

async function seed(name: string, workspace = WORKSPACE): Promise<string> {
  const dir = path.join(temp, name);
  fs.mkdirSync(dir, { recursive: true });
  const store = testStoreName();
  const now = new Date().toISOString();
  await RecordWorkspaceStore.createInNeo4j(TEST_NEO4J, store, toSnapshot(workspace, [
    { id: MAIN, state: initialState("main"), savedAt: now },
    { id: ARCHIVED, state: initialState("archived"), savedAt: now, archived: 1 },
  ], { now }));
  fs.writeFileSync(path.join(dir, NEO4J_STORE_FILE), JSON.stringify({ store }));
  return dir;
}

async function viewer(dir: string, remote?: string, port = 0): Promise<{ origin: string; port: number; process: ChildProcess }> {
  const env = {
    ...process.env,
    M3E_DATA_DIR: dir, M3E_WORKSPACE_ID: WORKSPACE, M3E_FORBID_LIVE_DATA: "1", M3E_PORT: String(port),
    M3E_HOST: "127.0.0.1", M3E_OPEN_BROWSER: "0", M3E_CLOUD_SYNC: "0", M3E_AUTO_SYNC: "0", M3E_SKIP_SAMPLE_GENERATION: "1",
  } as NodeJS.ProcessEnv;
  env.M3E_RECORD_STORE = "";
  env.M3E_SYNC_REMOTE = "";
  env.M3E_NEO4J_BOLT = "";
  env.M3E_NEO4J_USER = "";
  env.M3E_NEO4J_PASSWORD = "";
  env.M3E_NEO4J_PASSWORD_FILE = "";
  env.M3E_NEO4J_DATABASE = "";
  delete env.M3E_TAILSCALE_USERS;
  if (remote) env.M3E_SYNC_REMOTE = remote;
  if (remote || fs.existsSync(path.join(dir, NEO4J_STORE_FILE))) Object.assign(env, neo4jEnv());
  const child = spawn(process.execPath, [SERVER], { cwd: BETA, env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  const actualPort = await new Promise<number>((resolve, reject) => {
    let log = "";
    child.stdout.on("data", (buffer) => {
      log += String(buffer);
      const match = /Viewer ready: http:\/\/localhost:(\d+)/.exec(log);
      if (match) resolve(Number(match[1]));
    });
    child.stderr.on("data", (buffer) => { log += String(buffer); });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Server exited with ${code}: ${log}`)));
  });
  return { origin: `http://127.0.0.1:${actualPort}`, port: actualPort, process: child };
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}

async function call(origin: string, route: string, method = "GET", body?: unknown) {
  const response = await fetch(origin + route, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function ok(origin: string, route: string, method = "GET", body?: unknown) {
  const result = await call(origin, route, method, body);
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body;
}

function status(origin: string) { return ok(origin, "/api/sync/local/status"); }
function pull(origin: string) { return ok(origin, "/api/sync/local/pull", "POST"); }
function push(origin: string) { return ok(origin, "/api/sync/local/push", "POST"); }

function mcp(origin: string, name: string, args: object) {
  return ok(origin, "/api/mcp/call", "POST", { name, arguments: args });
}

async function edit(origin: string, nodeId: string, text: string): Promise<void> {
  const context = await mcp(origin, "m3e_context", { action: "enter", target: `m3e://maps/${MAIN}` });
  await mcp(origin, "m3e_update", { kind: "content", context_id: context.context_id, target: `m3e://maps/${MAIN}/nodes/${nodeId}`, text });
}

async function mapText(origin: string, id = "main-root"): Promise<string> {
  const map = await ok(origin, `/api/maps/${MAIN}`);
  return map.state.nodes[id].text;
}

function outbox(dir: string) { return DeviceOutbox.open(deviceStoreNames(WORKSPACE, dir).outbox, TEST_NEO4J).list(); }

async function relay(origin: string, transform: (url: URL, body: any, headers: http.IncomingHttpHeaders) => any) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, origin);
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = Buffer.concat(chunks);
      const response = await fetch(url, {
        method: req.method,
        body: request.length ? request : undefined,
        headers: {
          ...(request.length ? { "content-type": "application/json" } : {}),
          ...Object.fromEntries(Object.entries(req.headers).filter(([name]) => name.startsWith("x-m3e-")) as Array<[string, string]>),
        },
      });
      const body = transform(url, await response.json(), req.headers);
      res.writeHead(response.status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    } catch {
      res.writeHead(502);
      res.end();
    }
  });
  proxies.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("local sync with isolated viewer processes", () => {
  test("clones, commits through MCP, and preserves conflicting edits while independent edits converge", async () => {
    const remote = await viewer(await seed("remote"));
    const dirA = path.join(temp, "a");
    const a = (await viewer(dirA, remote.origin)).origin;
    const b = (await viewer(path.join(temp, "b"), remote.origin)).origin;
    expect(await status(remote.origin)).toEqual({ mode: "remote" });
    const maps = await ok(remote.origin, "/api/maps?includeArchived=true");
    expect(await ok(a, "/api/maps?includeArchived=true")).toEqual(maps);
    expect(await ok(b, "/api/maps?includeArchived=true")).toEqual(maps);
    const start = (await status(a)).confirmedSeq;

    await edit(a, "main-root", "From A");
    await edit(b, "main-root", "From B");
    await edit(b, "main-child", "Independent B");
    const [entry] = outbox(dirA);
    expect(entry).toMatchObject({ baseSeq: start, command: { changes: expect.arrayContaining([
      expect.objectContaining({ before: expect.objectContaining({ text: "Root" }), after: expect.objectContaining({ text: "From A" }) }),
    ]) } });
    expect(await mapText(a)).toBe("From A");
    expect(await mapText(remote.origin)).toBe("Root");
    expect((await status(a)).confirmedSeq).toBe(start);

    expect(await push(a)).toMatchObject({ sent: 1, committed: 1, conflicts: 0 });
    expect(await push(b)).toMatchObject({ sent: 2, committed: 1, conflicts: 1 });
    await pull(a);
    for (const origin of [a, b, remote.origin]) {
      expect(await mapText(origin)).toBe("From A");
      expect(await mapText(origin, "main-child")).toBe("Independent B");
    }
    for (const origin of [a, b]) expect(await status(origin)).toMatchObject({ unsent: 0, confirmedSeq: start + 2 });
    const conflicts = (await ok(b, "/api/sync/local/conflicts")).conflicts;
    expect(conflicts).toEqual([expect.objectContaining({
      code: "CONFLICT", intent: expect.any(String), mapName: expect.any(String), reason: expect.any(String), at: expect.any(String),
      entry: expect.objectContaining({ command: expect.objectContaining({ changes: expect.arrayContaining([
        expect.objectContaining({ after: expect.objectContaining({ text: "From B" }) }),
      ]) }) }),
    })]);
  });

  test("pushes a run of Commands from one issuer in one request, in order, answered per Command", async () => {
    const remote = await viewer(await seed("batch-remote"));
    const requests: number[] = [];
    const gateway = await relay(remote.origin, (url, body) => {
      if (url.pathname === "/api/sync/push") requests.push(body.results.length);
      return body;
    });
    const dir = path.join(temp, "batch-local");
    const local = await viewer(dir, gateway);
    const created = (await ok(local.origin, "/api/maps/new", "POST", { label: "Batch map" })).id;
    await ok(local.origin, `/api/maps/${created}/tags`, "POST", { tags: ["one"] });
    await ok(local.origin, `/api/maps/${created}/tags`, "POST", { tags: ["two"] });
    expect(outbox(dir)).toHaveLength(3);
    expect(await push(local.origin)).toMatchObject({ sent: 3, committed: 3, conflicts: 0 });
    expect(requests).toEqual([3]);
    expect((await ok(remote.origin, "/api/maps")).maps.find((map: { id: string }) => map.id === created)).toMatchObject({ tags: ["two"] });
  });

  test("splits a push where the issuer changes, so each Command keeps its issuer", async () => {
    const remote = await viewer(await seed("issuer-remote"));
    const requests: Array<[string, number]> = [];
    const gateway = await relay(remote.origin, (url, body, headers) => {
      if (url.pathname === "/api/sync/push") requests.push([String(headers["x-m3e-connection"] ?? "viewer"), body.results.length]);
      return body;
    });
    const local = await viewer(path.join(temp, "issuer-local"), gateway);
    const created = (await ok(local.origin, "/api/maps/new", "POST", { label: "Issuer map" })).id;
    await edit(local.origin, "main-root", "By an AI agent");
    await ok(local.origin, `/api/maps/${created}/tags`, "POST", { tags: ["human"] });
    expect(await push(local.origin)).toMatchObject({ sent: 3, committed: 3 });
    expect(requests).toEqual([["viewer", 1], ["mcp", 1], ["viewer", 1]]);
  });

  test("a gateway answering 502 while the remote is down reads as unreachable, not refused", async () => {
    // tailscale serve (or any reverse proxy) in front of a stopped remote answers 502.
    const remote = await viewer(await seed("gateway-remote"));
    const gateway = await relay(remote.origin, (_url, body) => body);
    const local = await viewer(path.join(temp, "gateway-local"), gateway);
    await stop(remote.process);
    await edit(local.origin, "main-root", "Behind a gateway");
    await call(local.origin, "/api/sync/local/push", "POST");
    expect(await status(local.origin)).toMatchObject({ remote: { state: "unreachable" }, unsent: 1 });
  });

  test("commits with the remote stopped and replays a non-empty outbox after a cold restart", async () => {
    const dir = await seed("remote");
    let remote = await viewer(dir);
    const localDir = path.join(temp, "local");
    let local = await viewer(localDir, remote.origin);
    const start = (await status(local.origin)).confirmedSeq;
    await stop(remote.process);
    const context = await mcp(local.origin, "m3e_context", { action: "enter", target: `m3e://maps/${MAIN}` });
    await mcp(local.origin, "m3e_create", { kind: "node", context_id: context.context_id, text: "Works offline" });
    expect(await status(local.origin)).toMatchObject({ remote: { state: "unreachable" }, unsent: 1, confirmedSeq: start });
    const waiting = outbox(localDir);
    await stop(local.process);
    local = await viewer(localDir, remote.origin);
    expect(outbox(localDir)).toEqual(waiting);
    expect(JSON.stringify((await ok(local.origin, `/api/maps/${MAIN}`)).state)).toContain("Works offline");
    remote = await viewer(dir, undefined, remote.port);
    expect(await push(local.origin)).toMatchObject({ committed: 1, confirmedSeq: start + 1 });
    expect(JSON.stringify((await ok(remote.origin, `/api/maps/${MAIN}`)).state)).toContain("Works offline");
  });

  test("captures map create, delete, columns and rename, then replicates map contents and row columns", async () => {
    const remote = await viewer(await seed("remote"));
    const dir = path.join(temp, "local");
    const a = await viewer(dir, remote.origin);
    const b = await viewer(path.join(temp, "b"), remote.origin);
    const created = (await ok(a.origin, "/api/maps/new", "POST", { label: "Offline map" })).id;
    await ok(a.origin, `/api/maps/${created}/tags`, "POST", { tags: ["offline"] });
    await ok(a.origin, `/api/maps/${ARCHIVED}`, "DELETE");
    expect(outbox(dir).map((entry) => entry.mapOp)).toEqual(["create", "columns", "delete"]);
    expect(outbox(dir)[0].command.changes.length).toBeGreaterThan(0);
    expect(await push(a.origin)).toMatchObject({ committed: 3 });
    await pull(b.origin);
    expect(await call(b.origin, `/api/maps/${ARCHIVED}`)).toMatchObject({ status: 404 });
    const list = (await ok(b.origin, "/api/maps")).maps;
    expect(list.find((map: { id: string }) => map.id === created)).toMatchObject({ tags: ["offline"] });
    expect((await ok(b.origin, `/api/maps/${created}`)).state).toEqual((await ok(remote.origin, `/api/maps/${created}`)).state);

    const directDir = path.join(temp, "direct");
    const direct = await LocalSync.open(directDir, remote.origin, TEST_NEO4J);
    try {
      direct.store().renameMapId(MAIN, "renamed", "local");
      expect(outbox(directDir)).toMatchObject([{ mapId: MAIN, mapOp: "rename", newMapId: "renamed" }]);
      expect(await direct.push(() => {})).toMatchObject({ committed: 1 });
      expect(await call(remote.origin, `/api/maps/${MAIN}`)).toMatchObject({ status: 404 });
      expect((await ok(remote.origin, "/api/maps/renamed")).state.nodes["main-root"].text).toBe("Root");
    } finally {
      await direct.close();
    }
  });

  test("fences mismatched requests and responses, preserving both confirmed state and outbox", async () => {
    const remote = await viewer(await seed("remote"));
    const clone = await ok(remote.origin, "/api/sync/clone");
    const { workspaceId, historyId, epoch, snapshotSeq } = clone;
    expect(clone.records[0]).toMatchObject({ workspaceId, historyId, epoch: 1 });
    const wrong = `after=${snapshotSeq}&workspaceId=${workspaceId}&historyId=${historyId}&epoch=${epoch + 1}`;
    expect(await call(remote.origin, `/api/sync/pull?${wrong}`)).toMatchObject({ status: 409, body: { code: "FENCED" } });
    expect(await call(remote.origin, "/api/sync/push", "POST", { workspaceId, historyId: "another", epoch, commands: [] }))
      .toMatchObject({ status: 409, body: { code: "FENCED" } });

    const dir = path.join(temp, "local");
    let local = await viewer(dir, remote.origin);
    await edit(local.origin, "main-root", "Pending");
    const waiting = outbox(dir);
    await stop(local.process);
    const other = await viewer(await seed("other"));
    const otherClone = await ok(other.origin, "/api/sync/clone");
    expect(otherClone.historyId).not.toBe(historyId);
    local = await viewer(dir, other.origin);
    for (const action of ["push", "pull"]) {
      expect(await call(local.origin, `/api/sync/local/${action}`, "POST"))
        .toMatchObject({ status: 409, body: { code: "FENCED" } });
    }
    expect(await status(local.origin)).toMatchObject({ remote: { state: "refused" }, unsent: 1, confirmedSeq: snapshotSeq });
    expect(outbox(dir)).toEqual(waiting);
    expect(await mapText(other.origin)).toBe("Root");
    expect(await mapText(local.origin)).toBe("Pending");
    await stop(local.process);
    const altered = await relay(remote.origin, (_url, body) => ({ ...body, historyId: "different response" }));
    local = await viewer(dir, altered);
    expect(await call(local.origin, "/api/sync/local/pull", "POST"))
      .toMatchObject({ status: 409, body: { code: "FENCED" } });
    expect(outbox(dir)).toEqual(waiting);
  });

  test("leaves an unacknowledged push pending, retries with its Command ID, and handles a durable no-op", async () => {
    const remote = await viewer(await seed("remote"));
    let hideResult = true;
    const proxied = await relay(remote.origin, (url, body) => {
      if (hideResult && url.pathname === "/api/sync/push") return { ...body, results: [] };
      return body;
    });
    const dir = path.join(temp, "local");
    const local = (await viewer(dir, proxied)).origin;
    const start = (await status(local)).confirmedSeq;
    await edit(local, "main-root", "Accepted but unknown");
    const pending = outbox(dir);
    expect(await push(local)).toMatchObject({ sent: 1, committed: 0, confirmedSeq: start + 1 });
    expect(outbox(dir)).toEqual(pending.map((entry) => ({ ...entry, attempted: true })));
    expect((await status(local)).unsent).toBe(1);
    hideResult = false;
    expect(await push(local)).toMatchObject({ sent: 1, committed: 1, confirmedSeq: start + 1 });
    expect(outbox(dir)).toEqual([]);

    const b = (await viewer(path.join(temp, "b"), remote.origin)).origin;
    await edit(local, "main-root", "Same");
    await edit(b, "main-root", "Same");
    await push(local);
    expect(await push(b)).toMatchObject({ sent: 1, noOp: 1, conflicts: 0, confirmedSeq: start + 2 });
    expect(await status(b)).toMatchObject({ unsent: 0 });
    const journal = await ok(remote.origin, `/api/sync/pull?after=${start}`);
    expect(journal.lines).toHaveLength(2);
    expect(journal.lines[0].commandId).toBe(pending[0].commandId);
  });

  test("rejects a broken suffix before appending, then rebases the working store in place and preserves failed replay", async () => {
    const remote = await viewer(await seed("remote"));
    const a = (await viewer(path.join(temp, "a"), remote.origin)).origin;
    let corrupt = false;
    const proxied = await relay(remote.origin, (url, body) => {
      if (corrupt && url.pathname === "/api/sync/pull" && body.lines?.length) {
        return { ...body, lines: body.lines.map((line: any, i: number) => i === 0 ? line : { ...line, seq: line.seq + 1 }) };
      }
      return body;
    });
    const dir = path.join(temp, "b");
    const b = (await viewer(dir, proxied)).origin;
    const before = (await status(b)).confirmedSeq;
    await edit(b, "main-root", "Conflicting draft");
    await edit(b, "main-child", "Independent draft");
    const active = storeToken(dir);
    await edit(a, "main-root", "Authoritative");
    await edit(a, "main-root", "Authoritative again");
    await push(a);
    corrupt = true;
    expect(await call(b, "/api/sync/local/pull", "POST")).toMatchObject({ status: 502, body: { code: "SYNC_FAILED" } });
    expect((await status(b)).confirmedSeq).toBe(before);
    expect(await confirmedLines(dir, before)).toEqual([]);
    expect(storeToken(dir)).toBe(active);
    expect(await mapText(b)).toBe("Conflicting draft");
    corrupt = false;
    expect(await pull(b)).toMatchObject({ confirmedSeq: before + 2, pulled: 2 });
    // Rebased in place: the pull touched the delta and the pending Commands, not a copy of the workspace.
    expect(storeToken(dir)).toBe(active);
    expect(await mapText(b)).toBe("Authoritative again");
    expect(await mapText(b, "main-child")).toBe("Independent draft");
    expect(await status(b)).toMatchObject({ unsent: 1, conflicts: 1 });
    const exact = (await ok(remote.origin, `/api/sync/pull?after=${before}`)).lines;
    expect(await confirmedLines(dir, before)).toEqual(exact);
  });
});
