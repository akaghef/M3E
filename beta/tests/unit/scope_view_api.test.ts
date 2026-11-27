// The scope view route and the write guard on the real server, in both storage modes.
//
// Two server processes are started from dist/ on temporary data: SQLite (default) and the
// record store in the disposable test Neo4j. The same checks run against both. Synthetic data only.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { extractScopeView } from "../../src/shared/scope_view";
import { dropTestStores, testStoreName, TEST_NEO4J } from "./neo4j_test_store";
import type { AppState } from "../../src/shared/types";
import { node } from "./scope_view_fixture";

const BETA = path.resolve(__dirname, "..", "..");
const SERVER = path.join(BETA, "dist", "node", "start_viewer.js");
const WORKSPACE = "ws_scope_view";

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

interface Running { base: string; child: ChildProcess; log: string[] }

function neo4jChildEnv(): NodeJS.ProcessEnv {
  return {
    M3E_NEO4J_BOLT: TEST_NEO4J.uri,
    M3E_NEO4J_USER: TEST_NEO4J.user ?? "",
    M3E_NEO4J_PASSWORD: TEST_NEO4J.password ?? "",
    M3E_NEO4J_PASSWORD_FILE: "",
    M3E_NEO4J_DATABASE: TEST_NEO4J.database ?? "",
  };
}

async function startServer(dataDir: string, storeName: string | null): Promise<Running> {
  const port = await freePort();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    M3E_FORBID_LIVE_DATA: "1",
    M3E_PORT: String(port),
    M3E_DATA_DIR: dataDir,
    M3E_DB_FILE: "data.sqlite",
    M3E_WORKSPACE_ID: WORKSPACE,
    M3E_OPEN_BROWSER: "0",
    M3E_CLOUD_SYNC: "0",
    M3E_AUTO_SYNC: "0",
    M3E_RECORD_STORE: "",
    M3E_SYNC_REMOTE: "",
    M3E_NEO4J_BOLT: "",
    M3E_NEO4J_USER: "",
    M3E_NEO4J_PASSWORD: "",
    M3E_NEO4J_PASSWORD_FILE: "",
    M3E_NEO4J_DATABASE: "",
  };
  if (storeName !== null) {
    env.M3E_RECORD_STORE = storeName;
    Object.assign(env, neo4jChildEnv());
  }
  const child = spawn(process.execPath, [SERVER], { cwd: BETA, env, stdio: ["ignore", "pipe", "pipe"] });
  const log: string[] = [];
  child.stdout?.on("data", (chunk) => log.push(String(chunk)));
  child.stderr?.on("data", (chunk) => log.push(String(chunk)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}: ${log.join("")}`);
    try {
      if ((await fetch(`${base}/api/maps`)).status === 200) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) throw new Error(`server did not start: ${log.join("")}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return { base, child, log };
}

function stopServer(server: Running | undefined): Promise<void> {
  if (!server || server.child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    server.child.once("exit", () => resolve());
    server.child.kill("SIGTERM");
  });
}

async function call(base: string, method: string, route: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  const response = await fetch(base + route, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try { parsed = text.length > 0 ? JSON.parse(text) : null; } catch { /* keep the text */ }
  return { status: response.status, body: parsed };
}

function initialState(): AppState {
  const nodes = {
    root: node("root", null, "Root"),
    S: node("S", "root", "Scope", { nodeType: "folder" }),
    other: node("other", "root", "Other"),
    a: node("a", "S", "A"),
    b: node("b", "S", "B"),
    E: node("E", "S", "Nested", { nodeType: "folder" }),
    e1: node("e1", "E", "E one"),
    e2: node("e2", "E", "E two"),
    far: node("far", "other", "Far"),
  };
  nodes.root.children = ["S", "other"];
  nodes.S.children = ["a", "b", "E"];
  nodes.E.children = ["e1", "e2"];
  nodes.other.children = ["far"];
  return {
    rootId: "root",
    nodes,
    links: { out: { id: "out", sourceNodeId: "a", targetNodeId: "far", direction: "forward", style: "default", attributes: {} } },
  };
}

const servers: Record<string, Running> = {};
let root: string;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-scope-view-"));
  const storeName = testStoreName();
  await RecordWorkspaceStore.createInNeo4j(TEST_NEO4J, storeName, toSnapshot(WORKSPACE, [], { now: "2026-11-17T00:00:00.000Z" }));
  servers.sqlite = await startServer(path.join(root, "data-sqlite"), null);
  servers["record store"] = await startServer(path.join(root, "data-store"), storeName);
}, 90_000);

afterAll(async () => {
  await Promise.all(Object.values(servers).map((server) => stopServer(server)));
  await dropTestStores();
  fs.rmSync(root, { recursive: true, force: true });
});

describe.each(["sqlite", "record store"])("scope view over HTTP (%s)", (mode) => {
  const MAP = "scope-view-a";
  const base = (): string => servers[mode]!.base;
  const whole = async (): Promise<{ savedAt: string; state: AppState }> => (await call(base(), "GET", `/api/maps/${MAP}`)).body;
  const command = (changes: unknown[], id: string) => ({ commandId: id, actor: { kind: "human", id: "tab-1" }, intent: "assert", changes });

  test("GET ?scope=<id>&view=scope returns the scope view of the stored map", async () => {
    const seeded = await call(base(), "POST", `/api/maps/${MAP}`, { version: 1, savedAt: "2026-11-17T00:00:00.000Z", state: initialState() });
    expect(seeded.status).toBe(200);
    const stored = await whole();

    const response = await call(base(), "GET", `/api/maps/${MAP}?scope=S&view=scope`);
    expect(response.status).toBe(200);
    const expected = extractScopeView(stored.state, "S");
    expect(response.body).toEqual({ version: 1, savedAt: stored.savedAt, state: expected.state, scopeView: expected.view });
    expect(Object.keys(response.body.state.nodes).sort()).toEqual(["E", "S", "a", "b", "root"]);
    expect(response.body.state.nodes.E.children).toEqual([]);
    expect(response.body.scopeView.entries).toEqual({ E: { childCount: 2, descendantCount: 2 } });
    expect(response.body.scopeView.totalNodeCount).toBe(9);
    expect(response.body.scopeView.omittedLinks).toBe(1);

    // The map root is a scope root too.
    const rootView = await call(base(), "GET", `/api/maps/${MAP}?scope=root&view=scope`);
    expect(rootView.status).toBe(200);
    expect(Object.keys(rootView.body.state.nodes).sort()).toEqual(["S", "far", "other", "root"]);

    // Without view=scope the existing subtree read is unchanged.
    const subtree = await call(base(), "GET", `/api/maps/${MAP}?scope=S`);
    expect(subtree.status).toBe(200);
    expect(subtree.body.scope.nodeCount).toBe(6);
    expect(subtree.body.scopeView).toBeUndefined();
  });

  test("404 for a node that does not exist, 400 for a node that is not a scope root, 404 for an unknown map", async () => {
    const missing = await call(base(), "GET", `/api/maps/${MAP}?scope=nope&view=scope`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("SCOPE_NOT_FOUND");
    const plain = await call(base(), "GET", `/api/maps/${MAP}?scope=a&view=scope`);
    expect(plain.status).toBe(400);
    expect(plain.body.error.code).toBe("SCOPE_INVALID");
    expect((await call(base(), "GET", `/api/maps/no-such-map?scope=S&view=scope`)).status).toBe(404);
  });

  test("a write that names a scope view is refused on the whole-map route and on the scoped-write route", async () => {
    const before = await whole();
    const view = (await call(base(), "GET", `/api/maps/${MAP}?scope=S&view=scope`)).body;
    const headers = { "X-M3E-Scope-View": "S" };
    for (const body of [
      { version: 1, savedAt: before.savedAt, state: view.state, baseSavedAt: before.savedAt },
      { version: 1, savedAt: before.savedAt, state: view.state, force: true },
    ]) {
      const refused = await call(base(), "POST", `/api/maps/${MAP}`, body, headers);
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe("SCOPE_VIEW_WHOLE_SAVE");
    }
    const scoped = await call(base(), "POST", `/api/maps/${MAP}?scope=S`, { state: { ...view.state, rootId: "S" } }, headers);
    expect(scoped.status).toBe(409);
    expect(scoped.body.code).toBe("SCOPE_VIEW_WHOLE_SAVE");
    // A map that does not exist yet is not created from a scope view either.
    expect((await call(base(), "POST", `/api/maps/scope-view-new`, { version: 1, state: view.state }, headers)).status).toBe(409);
    expect((await call(base(), "GET", `/api/maps/scope-view-new`)).status).toBe(404);
    expect(await whole()).toEqual(before);
  });

  test("a Command that deletes a nested scope root without its contents fails validation and changes nothing", async () => {
    const before = await whole();
    const edge = before.state.nodes.E!;
    const response = await call(base(), "POST", `/api/maps/${MAP}/commands`, command([
      { kind: "edge", key: ["E"], op: "delete", before: { parentId: "S", index: 2 } },
      { kind: "node", key: ["E"], op: "delete", before: { ...edge, children: undefined, parentId: undefined, edgeOrder: undefined, attributes: {} } },
    ].map((change) => JSON.parse(JSON.stringify(change))), "cmd-delete-entry"), { "X-M3E-Scope-View": "S" });
    // Not a conflict (409): the Command applies, and the result is refused because e1 and e2 would have no parent.
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid model before save.");
    expect(await whole()).toEqual(before);
  });

  test("a Command from a scope view is applied to the whole map", async () => {
    const before = await whole();
    const response = await call(base(), "POST", `/api/maps/${MAP}/commands`, command([
      { kind: "node", key: ["a"], op: "update", before: { text: "A" }, after: { text: "A edited" } },
      // "b" moved onto the entry E: appended after its two real children.
      { kind: "edge", key: ["b"], op: "update", before: { parentId: "S", index: 1 }, after: { parentId: "E", index: 2 } },
      { kind: "edge", key: ["E"], op: "update", before: { index: 2 }, after: { index: 1 } },
    ], "cmd-edit"), { "X-M3E-Scope-View": "S" });
    expect(response.status).toBe(200);
    const after = await whole();
    const expected = JSON.parse(JSON.stringify(before.state)) as AppState;
    expected.nodes.a!.text = "A edited";
    expected.nodes.b!.parentId = "E";
    if (before.state.nodes.b!.edgeOrder !== undefined) expected.nodes.b!.edgeOrder = "a2";
    expected.nodes.S!.children = ["a", "E"];
    expected.nodes.E!.children = ["e1", "e2", "b"];
    expect(after.state).toEqual(expected);
  });

  test("a conflict answers a scope view with the scope view of the current state, not the whole map", async () => {
    const stale = command([{ kind: "node", key: ["a"], op: "update", before: { text: "A" }, after: { text: "A again" } }], "cmd-stale");
    const partial = await call(base(), "POST", `/api/maps/${MAP}/commands`, stale, { "X-M3E-Scope-View": "S" });
    expect(partial.status).toBe(409);
    const current = await whole();
    const expected = extractScopeView(current.state, "S");
    expect(partial.body.state).toEqual(expected.state);
    expect(partial.body.scopeView).toEqual(expected.view);
    expect(partial.body.savedAt).toBe(current.savedAt);
    // Without the header the answer is the whole state, as before.
    const full = await call(base(), "POST", `/api/maps/${MAP}/commands`, { ...stale, commandId: "cmd-stale-2" });
    expect(full.status).toBe(409);
    expect(full.body.state).toEqual(current.state);
    expect(full.body.scopeView).toBeUndefined();
  });
});

test("record-store map watch delivers tab and remote sync deltas through the real HTTP server", async () => {
  const base = servers["record store"].base, mapId = "record-watch";
  const route = `/api/maps/${mapId}`;
  expect((await call(base, "POST", route, { version: 1, state: {
    rootId: "root", nodes: { root: node("root", null, "Watch root") },
  } })).status).toBe(200);
  const abort = new AbortController();
  const response = await fetch(base + route + "/watch", { signal: abort.signal });
  const reader = response.body!.getReader();
  let buffer = "";
  const nextEvent = async (name: string): Promise<any> => {
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      for (;;) {
        const end = buffer.indexOf("\n\n");
        if (end >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (frame.startsWith(`event: ${name}\n`)) return JSON.parse(frame.split("data: ")[1]);
          continue;
        }
        const chunk = await reader.read();
        if (chunk.done) throw new Error("SSE ended before change");
        buffer += new TextDecoder().decode(chunk.value);
      }
    } finally { clearTimeout(timer); }
  };
  try {
    const ready = await nextEvent("map_watch_ready");
    expect(ready).toMatchObject({ mapId, fullReadRequired: true });
    let baseline = (await call(base, "GET", route + "/records")).body;
    expect(baseline.revision).toBe(ready.revision);
    const rootKey = baseline.records.find((item: any) => item.record?.kind === "node" && item.record.text === "Watch root").rk;
    for (const [i, text] of ["Other tab", "Other device"].entries()) {
      const cmd = { commandId: `watch-${i}`, actor: { kind: "human", id: "tab" }, intent: "rename", changes: [
        { kind: "node", key: ["root"], op: "update", before: { text: i === 0 ? "Watch root" : "Other tab" }, after: { text } },
      ] };
      const saved = i === 0
        ? await call(base, "POST", route + "/commands", cmd, { "X-M3E-Tab-Id": "writer" })
        : await call(base, "POST", "/api/sync/push", { commands: [{ commandId: cmd.commandId, mapId, baseSeq: baseline.seq, command: cmd }] });
      expect(saved.status).toBe(200);
      if (i === 1) expect(saved.body.results[0].status).toBe("committed");
      const event = await nextEvent("map_updated");
      expect(event).toMatchObject({ mapId, previousRevision: baseline.revision });
      expect(event.recordKeys).toContain(rootKey);
      const delta = await call(base, "GET", route + `/records?since=${encodeURIComponent(baseline.revision)}`);
      expect(delta.status).toBe(200);
      expect(delta.body).toMatchObject({ full: false, revision: event.revision });
      expect(delta.body.records.find((item: any) => item.rk === rootKey).record.text).toBe(text);
      baseline = delta.body;
    }
    expect((await call(base, "GET", route + "/records?since=lost-revision"))).toMatchObject({ status: 409, body: { fullReadRequired: true } });
    const full = await call(base, "GET", route + "/records");
    expect(full.body).toMatchObject({ full: true, revision: baseline.revision });
    expect((await call(base, "GET", route)).body.state.nodes.root.text).toBe("Other device");
  } finally { abort.abort(); await reader.cancel().catch(() => {}); }
}, 30000);
