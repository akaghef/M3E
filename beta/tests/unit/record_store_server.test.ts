// The real server on the record store (M3E_STORE_DIR) against the same server on SQLite.
//
// Two server processes are started from dist/ on temporary data: one in the default mode, one in
// store mode. The same sequence of HTTP calls runs against both, and every status and body must be
// the same once the values that legitimately differ are taken out (times, commit sequence numbers,
// generated ids). Then the store-mode server is stopped and started again on the same directory.
// Synthetic data only.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { diffState } from "../../src/shared/map_changes";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { RecordWorkspaceStore } from "../../src/node/record_store/store";
import { activeRecordStore, closeActiveRecordStore } from "../../src/node/record_store/active";
import { RapidMvpModel } from "../../src/node/rapid_mvp";

type Json = Record<string, any>;
type Step = [label: string, status: number, body: unknown];

const BETA = path.resolve(__dirname, "..", "..");
const SERVER = path.join(BETA, "dist", "node", "start_viewer.js");
const MAP = "parity-a";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    // Bound the way the server binds (all interfaces), so the port is free there too.
    probe.listen(0, () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port));
    });
  });
}

interface Running {
  base: string;
  child: ChildProcess;
  log: string[];
}

async function startServer(dataDir: string, storeDir: string | null, bolt?: string, more: NodeJS.ProcessEnv = {}): Promise<Running> {
  const port = await freePort();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    M3E_FORBID_LIVE_DATA: "1",
    M3E_PORT: String(port),
    M3E_DATA_DIR: dataDir,
    M3E_DB_FILE: "data.sqlite",
    M3E_WORKSPACE_ID: "ws_parity",
    M3E_OPEN_BROWSER: "0",
    M3E_CLOUD_SYNC: "0",
    M3E_AUTO_SYNC: "0",
  };
  delete env.M3E_STORE_DIR;
  delete env.M3E_NEO4J_BOLT;
  delete env.M3E_ENGINE_BACKLOG_LIMIT;
  Object.assign(env, more);
  if (storeDir !== null) env.M3E_STORE_DIR = storeDir;
  if (bolt !== undefined) env.M3E_NEO4J_BOLT = bolt;
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

async function call(base: string, method: string, route: string, body?: unknown): Promise<{ status: number; body: any }> {
  const response = await fetch(base + route, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try { parsed = text.length > 0 ? JSON.parse(text) : null; } catch { /* keep the text */ }
  return { status: response.status, body: parsed };
}

function node(id: string, parentId: string | null, children: string[], text: string, more: Json = {}): Json {
  return { id, parentId, children, nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "", ...more };
}

function initialState(): Json {
  return {
    rootId: "pa_root",
    nodes: {
      pa_root: node("pa_root", null, ["pa_A", "pa_B", "pa_C"], "Parity Root"),
      pa_A: node("pa_A", "pa_root", ["pa_a1", "pa_a2"], "Alpha", { details: "alpha details", attributes: { k: "v" } }),
      pa_a1: node("pa_a1", "pa_A", [], "Alpha one"),
      pa_a2: node("pa_a2", "pa_A", [], "Alpha two", { note: "a note" }),
      pa_B: node("pa_B", "pa_root", [], "Bravo"),
      pa_C: node("pa_C", "pa_root", [], "Charlie"),
    },
    links: {},
  };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const COLLECTIONS = ["links", "annotations", "scopes", "surfaces", "linearNotesByScope"];

/**
 * The record store gives a map state back in the normal form of its records. Three things differ
 * from the text SQLite stores, none of them content:
 *   - an empty collection (`links: {}` ...) is left out;
 *   - a GraphLink port "auto" (the default) is left out;
 *   - the scope of the map root is always listed (`scopes["scope:<root>"]` with its label and root).
 * Both sides are brought to that form before they are compared.
 */
function normalForm(state: Json): Json {
  const out: Json = { ...state };
  if (out.links) {
    out.links = Object.fromEntries(Object.entries(out.links as Json).map(([id, link]) => {
      const copy: Json = { ...(link as Json) };
      if (copy.sourcePort === "auto") delete copy.sourcePort;
      if (copy.targetPort === "auto") delete copy.targetPort;
      return [id, copy];
    }));
  }
  const rootScope = `scope:${out.rootId}`;
  const scope = out.scopes?.[rootScope] as Json | undefined;
  if (scope && scope.primarySurfaceId === undefined && Array.isArray(scope.relationIds) && scope.relationIds.length === 0) {
    out.scopes = { ...out.scopes };
    delete out.scopes[rootScope];
  }
  for (const name of COLLECTIONS) {
    if (out[name] && typeof out[name] === "object" && Object.keys(out[name]).length === 0) delete out[name];
  }
  return out;
}

/** Key order does not matter; times and commit numbers differ by nature; generated ids get a fixed name. */
function tidy(value: unknown, generated: Map<string, string>): unknown {
  if (typeof value === "string") {
    let text = value;
    for (const [id, name] of generated) text = text.split(id).join(name);
    return text;
  }
  if (Array.isArray(value)) return value.map((item) => tidy(item, generated));
  if (typeof value !== "object" || value === null) return value;
  const source = typeof (value as Json).rootId === "string" && typeof (value as Json).nodes === "object" ? normalForm(value as Json) : (value as Json);
  const out: Json = {};
  for (const key of Object.keys(source).sort()) {
    const item = source[key];
    if (key === "savedAt" || key === "createdAt") out[key] = typeof item === "string" ? "<time>" : item;
    // Where the maps are kept is the one thing the two modes must answer differently; it is checked on its own.
    else if (key === "sourceOfTruth" && (item === "sqlite" || item === "records")) out[key] = "<the store of this mode>";
    else if (key === "seq") out[key] = typeof item === "number" ? "<seq>" : item;
    else out[generated.get(key) ?? key] = tidy(item, generated);
  }
  return out;
}

/** A map state without its ids: the tree by content, and the GraphLinks by the texts of their ends. */
function shape(state: Json): unknown {
  const tree = (id: string): unknown => {
    const item = state.nodes[id];
    return { text: item.text, nodeType: item.nodeType ?? "text", details: item.details, note: item.note, attributes: item.attributes, children: item.children.map(tree) };
  };
  const links = Object.values((state.links ?? {}) as Json)
    .map((link: any) => `${state.nodes[link.sourceNodeId].text} -> ${state.nodes[link.targetNodeId].text} (${link.label ?? ""})`)
    .sort();
  const notes = Object.entries((state.linearNotesByScope ?? {}) as Json).map(([key, text]) => `${state.nodes[key]?.text ?? key}: ${text}`).sort();
  return { tree: tree(state.rootId), links, notes };
}

function summary(maps: Json[]): unknown {
  return maps
    .map((map) => ({ label: map.label, nodeCount: map.nodeCount, charCount: map.charCount, tags: map.tags, archived: map.archived, pinned: map.pinned, source: map.source ?? null }))
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : a.nodeCount - b.nodeCount));
}

interface Outcome {
  steps: Step[];
  finalState: Json;
  duplicateIds: string[];
  sourceIds: string[];
  finalList: unknown;
  /** Every `sourceOfTruth` an answer carried. */
  sources: string[];
}

async function scenario(base: string): Promise<Outcome> {
  const steps: Step[] = [];
  const generated = new Map<string, string>();
  const sources = new Set<string>();
  const record = (label: string, result: { status: number; body: any }, body: unknown = result.body): void => {
    if (result.body && typeof result.body === "object" && typeof result.body.sourceOfTruth === "string") sources.add(result.body.sourceOfTruth);
    steps.push([label, result.status, tidy(body, generated)]);
  };
  const state = async (mapId = MAP): Promise<Json> => (await call(base, "GET", `/api/maps/${mapId}`)).body.state as Json;
  let commandCount = 0;
  const commandFor = (before: Json, after: Json, intent: string): Json => {
    commandCount += 1;
    return { commandId: `parity-cmd-${commandCount}`, actor: { kind: "human", id: "parity" }, intent, changes: diffState(before, after) };
  };
  const commit = (command: Json, mapId = MAP) => call(base, "POST", `/api/maps/${mapId}/commands`, command);

  // List and load.
  let result = await call(base, "GET", "/api/maps");
  record("list at start", result, summary(result.body.maps));
  result = await call(base, "POST", `/api/maps/${MAP}`, { version: 1, savedAt: new Date().toISOString(), state: initialState() });
  record("whole-map POST creates the map", result);
  result = await call(base, "GET", `/api/maps/${MAP}`);
  record("load map", result);
  record("load missing map", await call(base, "GET", "/api/maps/parity-missing"));
  record("scoped read", await call(base, "GET", `/api/maps/${MAP}?scope=pa_A`));
  record("layout snapshot", await call(base, "GET", `/api/maps/${MAP}/layout-snapshot`), null);

  // Commands: create, edit, move, delete.
  const atStart = await state();
  let before = await state();
  let after = clone(before);
  after.nodes.pa_new = node("pa_new", "pa_A", [], "Alpha new");
  after.nodes.pa_A.children.push("pa_new");
  record("command: create node", await commit(commandFor(before, after, "create-node")));

  before = await state();
  after = clone(before);
  after.nodes.pa_B.text = "Bravo edited";
  record("command: edit text", await commit(commandFor(before, after, "edit-text")));

  before = await state();
  after = clone(before);
  after.nodes.pa_root.children = ["pa_A", "pa_C"];
  after.nodes.pa_C.children = ["pa_B"];
  after.nodes.pa_B.parentId = "pa_C";
  record("command: move", await commit(commandFor(before, after, "move-node")));

  before = await state();
  after = clone(before);
  delete after.nodes.pa_a1;
  after.nodes.pa_A.children = after.nodes.pa_A.children.filter((id: string) => id !== "pa_a1");
  const deleteCommand = commandFor(before, after, "delete-node");
  record("command: delete", await commit(deleteCommand));
  record("command: retry of the same command", await commit(deleteCommand));

  // A stale command: built on the state before the edit of Bravo.
  const staleAfter = clone(atStart);
  staleAfter.nodes.pa_B.text = "Bravo from a stale tab";
  record("command: stale", await commit(commandFor(atStart, staleAfter, "edit-text")));
  record("command: unknown map", await commit(commandFor(atStart, staleAfter, "edit-text"), "parity-missing"));
  record("command: no actor", await commit({ commandId: "parity-bad", intent: "x", changes: [] }));
  record("state after commands", await call(base, "GET", `/api/maps/${MAP}`));

  // Whole-map POST: current base, stale base without and with a base state.
  let current = (await call(base, "GET", `/api/maps/${MAP}`)).body as Json;
  const staleBase = clone(current);
  let next = clone(current.state);
  next.nodes.pa_C.text = "Charlie whole";
  record("whole-map POST on the current base", await call(base, "POST", `/api/maps/${MAP}`, { state: next, baseSavedAt: current.savedAt }));
  // The saved-at time has millisecond resolution: let it move before the stale saves.
  await new Promise((resolve) => setTimeout(resolve, 5));
  next = clone(staleBase.state);
  next.nodes.pa_A.text = "Alpha stale";
  record("whole-map POST on a stale base", await call(base, "POST", `/api/maps/${MAP}`, { state: next, baseSavedAt: staleBase.savedAt }));
  record("whole-map POST on a stale base with its base state", await call(base, "POST", `/api/maps/${MAP}`, { state: next, baseSavedAt: staleBase.savedAt, baseState: staleBase.state }));
  record("whole-map POST without nodes", await call(base, "POST", `/api/maps/${MAP}`, { state: { rootId: "x", nodes: {} } }));
  record("state after whole-map saves", await call(base, "GET", `/api/maps/${MAP}`));

  // Linear text.
  record("linear PUT", await call(base, "PUT", `/api/maps/${MAP}/linear/pa_A`, { text: "linear text of Alpha" }));
  record("linear GET", await call(base, "GET", `/api/maps/${MAP}/linear/pa_A`));
  record("linear PUT on a missing scope", await call(base, "PUT", `/api/maps/${MAP}/linear/pa_nope`, { text: "x" }));
  record("state with linear text", await call(base, "GET", `/api/maps/${MAP}`));
  record("linear DELETE", await call(base, "DELETE", `/api/maps/${MAP}/linear/pa_A`));
  record("linear DELETE again", await call(base, "DELETE", `/api/maps/${MAP}/linear/pa_A`));

  // GraphLink.
  result = await call(base, "POST", `/api/maps/${MAP}/links`, { sourceNodeId: "pa_A", targetNodeId: "pa_C", label: "relates", direction: "forward" });
  const linkId = result.body?.link?.id as string;
  generated.set(linkId, "<link>");
  record("link POST", result);
  record("state with link", await call(base, "GET", `/api/maps/${MAP}`));
  result = await call(base, "POST", `/api/maps/${MAP}/links`, { sourceNodeId: "pa_A", targetNodeId: "pa_C", label: "kept" });
  generated.set(result.body?.link?.id as string, "<kept link>");
  record("second link POST", result);
  record("link POST to a missing node", await call(base, "POST", `/api/maps/${MAP}/links`, { sourceNodeId: "pa_A", targetNodeId: "pa_nope" }));
  record("link DELETE", await call(base, "DELETE", `/api/maps/${MAP}/links/${linkId}`));
  record("link DELETE again", await call(base, "DELETE", `/api/maps/${MAP}/links/${linkId}`));

  // MCP route: one read and one mutate, and the same mutate again under its command id.
  const mcp = (name: string, args: Json) => call(base, "POST", "/api/mcp/call", { name, arguments: args });
  const mcpView = (body: Json): unknown => ({ ok: body.ok, error: body.error ?? null, changed: body.changed ?? null, replayed: body.replayed ?? null, nodes: (body.nodes ?? []).map((item: Json) => item.text ?? item.label ?? null) });
  result = await mcp("m3e_context", { action: "enter", target: `m3e://maps/${MAP}` });
  const contextId = result.body.context_id as string;
  record("mcp enter", result, mcpView(result.body));
  result = await mcp("m3e_get", { kind: "state", context_id: contextId, target: `m3e://maps/${MAP}/nodes/pa_A` });
  record("mcp read", result, mcpView(result.body));
  const update = { context_id: contextId, kind: "content", target: `m3e://maps/${MAP}/nodes/pa_a2`, text: "Alpha two from agent", command_id: "parity-mcp-1" };
  result = await mcp("m3e_update", update);
  record("mcp update", result, mcpView(result.body));
  result = await mcp("m3e_update", update);
  record("mcp update again under the same command id", result, mcpView(result.body));
  record("state after mcp", await call(base, "GET", `/api/maps/${MAP}`));

  // Map-level operations.
  result = await call(base, "POST", "/api/maps/new", { label: "Parity new" });
  const newId = result.body.id as string;
  generated.set(newId, "<new map>");
  record("new map", result);
  result = await call(base, "GET", `/api/maps/${newId}`);
  record("new map state", result, shape(result.body.state));

  const beforeColumns = (await call(base, "GET", `/api/maps/${MAP}`)).body as Json;
  result = await call(base, "POST", `/api/maps/${MAP}/tags`, { tags: ["x", " y ", "x"] });
  record("tags", result);
  record("pin the map", await call(base, "PATCH", `/api/maps/${MAP}/pin`, { pinned: true }));
  // Tags and pin are not content: the map still has the saved-at time read before them, and a
  // whole-map save built on that time is not a conflict.
  const afterColumns = (await call(base, "GET", `/api/maps/${MAP}`)).body as Json;
  record("saved-at time is the same after tags and pin", { status: 200, body: null }, afterColumns.savedAt === beforeColumns.savedAt);
  next = clone(beforeColumns.state);
  next.nodes.pa_C.text = "Charlie after the tag change";
  record("whole-map POST on the base read before tags and pin", await call(base, "POST", `/api/maps/${MAP}`, { state: next, baseSavedAt: beforeColumns.savedAt }));
  record("unpin the map", await call(base, "PATCH", `/api/maps/${MAP}/pin`, { pinned: false }));
  result = await call(base, "POST", `/api/maps/${MAP}/duplicate`);
  const copyId = result.body.id as string;
  generated.set(copyId, "<copy>");
  record("duplicate", result);
  record("duplicate of a missing map", await call(base, "POST", "/api/maps/parity-missing/duplicate"));
  result = await call(base, "GET", `/api/maps/${copyId}`);
  const copyState = result.body.state as Json;
  record("copy state", result, shape(copyState));
  const sourceState = await state();
  record("source state as shape", { status: 200, body: null }, shape(sourceState));

  record("rename", await call(base, "POST", `/api/maps/${copyId}/rename`, { label: "Parity copy renamed" }));
  record("rename a missing map", await call(base, "POST", "/api/maps/parity-missing/rename", { label: "x" }));
  record("rename to nothing", await call(base, "POST", `/api/maps/${copyId}/rename`, { label: "  " }));
  record("tags on a missing map", await call(base, "POST", "/api/maps/parity-missing/tags", { tags: [] }));
  record("pin", await call(base, "PATCH", `/api/maps/${copyId}/pin`, { pinned: true }));
  record("pin a missing map", await call(base, "PATCH", "/api/maps/parity-missing/pin", { pinned: true }));
  record("delete before archive", await call(base, "DELETE", `/api/maps/${copyId}`));
  record("archive", await call(base, "POST", `/api/maps/${copyId}/archive`));
  record("archive a missing map", await call(base, "POST", "/api/maps/parity-missing/archive"));
  result = await call(base, "GET", "/api/maps");
  record("list without archived", result, summary(result.body.maps));
  result = await call(base, "GET", "/api/maps?includeArchived=true");
  record("list with archived", result, summary(result.body.maps));
  record("restore", await call(base, "POST", `/api/maps/${copyId}/restore`));
  record("unpin", await call(base, "PATCH", `/api/maps/${copyId}/pin`, { pinned: false }));
  record("archive the new map", await call(base, "POST", `/api/maps/${newId}/archive`));
  record("delete the archived map", await call(base, "DELETE", `/api/maps/${newId}`));
  record("load the deleted map", await call(base, "GET", `/api/maps/${newId}`));
  record("delete a missing map", await call(base, "DELETE", "/api/maps/parity-missing"));

  result = await call(base, "GET", "/api/maps?includeArchived=true");
  const finalList = summary(result.body.maps);
  record("list at the end", result, finalList);
  return { steps, finalState: await state(), duplicateIds: Object.keys(copyState.nodes), sourceIds: Object.keys(sourceState.nodes), finalList, sources: [...sources].sort() };
}

describe("the server on the record store answers like the server on SQLite", () => {
  let root: string;
  let storeDir: string;
  let sqliteServer: Running | undefined;
  let storeServer: Running | undefined;
  let sqliteRun: Outcome;
  let storeRun: Outcome;

  beforeAll(async () => {
    expect(fs.existsSync(SERVER), "dist/node/start_viewer.js is built (npm run build:node)").toBe(true);
    root = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-record-store-server-"));
    storeDir = path.join(root, "store");
    RecordWorkspaceStore.create(storeDir, toSnapshot("ws_parity", [], { now: "2026-11-17T00:00:00.000Z" }));
    sqliteServer = await startServer(path.join(root, "data-sqlite"), null);
    storeServer = await startServer(path.join(root, "data-store"), storeDir);
    sqliteRun = await scenario(sqliteServer.base);
    storeRun = await scenario(storeServer.base);
  }, 120_000);

  afterAll(async () => {
    await stopServer(sqliteServer);
    await stopServer(storeServer);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("the store-mode server keeps its maps in the store directory and not in SQLite", () => {
    expect(fs.statSync(path.join(storeDir, "journal.jsonl")).size).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(root, "data-store", "data.sqlite"))).toBe(false);
    expect(fs.existsSync(path.join(root, "data-sqlite", "data.sqlite"))).toBe(true);
  });

  test("every step has the same status and body in both modes", () => {
    expect(storeRun.steps.map((step) => step[0])).toEqual(sqliteRun.steps.map((step) => step[0]));
    for (let i = 0; i < sqliteRun.steps.length; i += 1) {
      expect(storeRun.steps[i], sqliteRun.steps[i][0]).toEqual(sqliteRun.steps[i]);
    }
  });

  test("the steps gave the statuses the routes promise", () => {
    const status = new Map(storeRun.steps.map((step) => [step[0], step[1]]));
    expect(status.get("command: create node")).toBe(200);
    expect(status.get("command: retry of the same command")).toBe(200);
    expect(status.get("command: stale")).toBe(409);
    expect(status.get("command: unknown map")).toBe(404);
    expect(status.get("command: no actor")).toBe(400);
    expect(status.get("whole-map POST on a stale base")).toBe(409);
    expect(status.get("whole-map POST on a stale base with its base state")).toBe(200);
    expect(status.get("load missing map")).toBe(404);
    expect(status.get("delete before archive")).toBe(409);
    expect(status.get("delete the archived map")).toBe(200);
    expect(status.get("link DELETE again")).toBe(404);
    expect(status.get("whole-map POST on the base read before tags and pin")).toBe(200);
    const body = new Map(storeRun.steps.map((step) => [step[0], step[2] as Json]));
    expect(body.get("command: stale").code).toBe("DOC_NODE_CONFLICT_Q");
    expect(body.get("mcp update").ok).toBe(true);
    expect(body.get("mcp read").ok).toBe(true);
    expect(body.get("mcp read").nodes).toContain("Alpha two");
    expect(body.get("mcp update").changed).toEqual({ created: 0, updated: 1, deleted: 0 });
    expect(body.get("state after mcp").state.nodes.pa_a2.text).toBe("Alpha two from agent");
    expect(body.get("mcp update again under the same command id").ok).toBe(true);
    expect(body.get("saved-at time is the same after tags and pin")).toBe(true);
  });

  test("each mode names its own store as the source of truth", () => {
    expect(sqliteRun.sources).toEqual(["sqlite"]);
    expect(storeRun.sources).toEqual(["records"]);
  });

  test("a copy of a map answers with the ids of its source in both modes", () => {
    // (In the store the copy has stored ids of its own: tests/unit/record_store_fixes.test.ts.)
    expect([...sqliteRun.duplicateIds].sort()).toEqual([...sqliteRun.sourceIds].sort());
    expect([...storeRun.duplicateIds].sort()).toEqual([...storeRun.sourceIds].sort());
  });

  test("the state is still there after the store-mode server starts again", async () => {
    await stopServer(storeServer);
    storeServer = await startServer(path.join(root, "data-store"), storeDir);
    const loaded = await call(storeServer.base, "GET", `/api/maps/${MAP}`);
    expect(loaded.status).toBe(200);
    expect(loaded.body.state).toEqual(storeRun.finalState);
    const list = await call(storeServer.base, "GET", "/api/maps?includeArchived=true");
    expect(summary(list.body.maps)).toEqual(storeRun.finalList);
    expect(fs.existsSync(path.join(root, "data-store", "data.sqlite"))).toBe(false);
  }, 60_000);

  // The two answers below exist in store mode only.
  test("a command id that comes again with other changes is a conflict (409)", async () => {
    const base = storeServer!.base;
    const before = (await call(base, "GET", `/api/maps/${MAP}`)).body.state as Json;
    const first = clone(before);
    first.nodes.pa_C.text = "Charlie first";
    const second = clone(before);
    second.nodes.pa_C.text = "Charlie second";
    const command = (after: Json): Json => ({ commandId: "parity-same-id", actor: { kind: "human", id: "parity" }, intent: "edit-text", changes: diffState(before, after) });
    expect((await call(base, "POST", `/api/maps/${MAP}/commands`, command(first))).status).toBe(200);
    const again = await call(base, "POST", `/api/maps/${MAP}/commands`, command(second));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("DOC_NODE_CONFLICT_Q");
    expect(again.body.state.nodes.pa_C.text).toBe("Charlie first");
  });

  test("maps seeded with the same ids are all created, read back with those ids, and edited apart", async () => {
    const base = storeServer!.base;
    const feel = (): Json => ({
      rootId: "root",
      nodes: {
        root: node("root", null, ["A", "B", "C"], "Feel Root"),
        A: node("A", "root", ["a1", "a2"], "Alpha"),
        a1: node("a1", "A", [], "Alpha one"),
        a2: node("a2", "A", [], "Alpha two"),
        B: node("B", "root", [], "Bravo"),
        C: node("C", "root", [], "Charlie"),
      },
    });
    for (const mapId of ["feel-1", "feel-2", "feel-3"]) {
      const seeded = await call(base, "POST", `/api/maps/${mapId}`, { version: 1, savedAt: new Date().toISOString(), state: feel() });
      expect(seeded.status, JSON.stringify(seeded.body)).toBe(200);
      expect((await call(base, "GET", `/api/maps/${mapId}`)).body.state.nodes).toEqual(feel().nodes);
    }
    // A Command, a whole-map save and an MCP write on the second map, all with the ids it was seeded with.
    const before = (await call(base, "GET", "/api/maps/feel-2")).body as Json;
    const after = clone(before.state);
    after.nodes.A.text = "Alpha of the second map";
    after.nodes.a3 = node("a3", "A", [], "Alpha three");
    after.nodes.A.children.push("a3");
    const command = { commandId: "feel-2-cmd", actor: { kind: "human", id: "parity" }, intent: "edit", changes: diffState(before.state, after) };
    expect((await call(base, "POST", "/api/maps/feel-2/commands", command)).status).toBe(200);
    let current = (await call(base, "GET", "/api/maps/feel-2")).body as Json;
    expect(current.state.nodes).toEqual(after.nodes);
    const whole = clone(current.state);
    whole.nodes.C.text = "Charlie of the second map";
    expect((await call(base, "POST", "/api/maps/feel-2", { state: whole, baseSavedAt: current.savedAt })).status).toBe(200);
    const entered = await call(base, "POST", "/api/mcp/call", { name: "m3e_context", arguments: { action: "enter", target: "m3e://maps/feel-2" } });
    const updated = await call(base, "POST", "/api/mcp/call", { name: "m3e_update", arguments: { context_id: entered.body.context_id, kind: "content", target: "m3e://maps/feel-2/nodes/B", text: "Bravo from agent" } });
    expect(updated.body.ok, JSON.stringify(updated.body)).toBe(true);
    current = (await call(base, "GET", "/api/maps/feel-2")).body as Json;
    expect(Object.keys(current.state.nodes).sort()).toEqual(["A", "B", "C", "a1", "a2", "a3", "root"]);
    expect([current.state.nodes.A.text, current.state.nodes.B.text, current.state.nodes.C.text]).toEqual(["Alpha of the second map", "Bravo from agent", "Charlie of the second map"]);
    expect(current.state.nodes.A.children).toEqual(["a1", "a2", "a3"]);
    // The other two maps are as they were seeded.
    expect((await call(base, "GET", "/api/maps/feel-1")).body.state.nodes).toEqual(feel().nodes);
    expect((await call(base, "GET", "/api/maps/feel-3")).body.state.nodes).toEqual(feel().nodes);
  });

  test("with the storage engine down commands are still stored; past the backlog limit they are answered 503 and nothing is written", async () => {
    const dir = path.join(root, "store-behind");
    RecordWorkspaceStore.create(dir, toSnapshot("ws_parity", [], { now: "2026-11-17T00:00:00.000Z" }));
    // Nothing listens on this port: the Neo4j applier fails and keeps retrying; the journal takes
    // the commits until the engine is 6 commits behind.
    const limit = 6;
    const server = await startServer(path.join(root, "data-behind"), dir, `bolt://127.0.0.1:${await freePort()}`, { M3E_ENGINE_BACKLOG_LIMIT: String(limit) });
    try {
      const mapId = (await call(server.base, "GET", "/api/maps")).body.maps[0].id as string;
      const before = (await call(server.base, "GET", `/api/maps/${mapId}`)).body.state as Json;
      const after = clone(before);
      after.nodes[after.rootId].text = "never stored";
      const statuses: number[] = [];
      let answer = { status: 0, body: null as any };
      let lastStored = "";
      for (let attempt = 0; attempt < limit + 2 && answer.status !== 503; attempt += 1) {
        const current = (await call(server.base, "GET", `/api/maps/${mapId}`)).body.state as Json;
        const next = clone(current);
        next.nodes[next.rootId].text = `try ${attempt}`;
        answer = await call(server.base, "POST", `/api/maps/${mapId}/commands`, { commandId: `behind-${attempt}`, actor: { kind: "human", id: "parity" }, intent: "edit-text", changes: diffState(current, next) });
        statuses.push(answer.status);
        if (answer.status === 200) lastStored = `try ${attempt}`;
      }
      // Some commits went through with no engine to take them, then the limit was reached.
      expect(statuses.length).toBeGreaterThan(1);
      expect(statuses.length).toBeLessThanOrEqual(limit + 1);
      expect(statuses.slice(0, -1).every((status) => status === 200)).toBe(true);
      expect(answer.status).toBe(503);
      expect(answer.body).toEqual({ ok: false, code: "ENGINE_BEHIND", error: "The storage engine is behind. Retry later." });
      const stored = (await call(server.base, "GET", `/api/maps/${mapId}`)).body.state as Json;
      expect(stored.nodes[stored.rootId].text).toBe(lastStored);
      const whole = await call(server.base, "POST", `/api/maps/${mapId}`, { state: after });
      expect(whole.status).toBe(400);
      expect(String(whole.body.error)).toMatch(/^ENGINE_BEHIND/);
      expect((await call(server.base, "GET", `/api/maps/${mapId}`)).body.state).toEqual(stored);
    } finally {
      await stopServer(server);
    }
  }, 90_000);
});

describe("the switch", () => {
  const saved = { dir: process.env.M3E_STORE_DIR, forbid: process.env.M3E_FORBID_LIVE_DATA };
  afterAll(async () => {
    await closeActiveRecordStore();
    if (saved.dir === undefined) delete process.env.M3E_STORE_DIR; else process.env.M3E_STORE_DIR = saved.dir;
    process.env.M3E_FORBID_LIVE_DATA = saved.forbid;
  });

  test("without M3E_STORE_DIR there is no store and maps go to SQLite", () => {
    delete process.env.M3E_STORE_DIR;
    expect(activeRecordStore()).toBeNull();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-record-store-switch-"));
    try {
      const dbPath = path.join(dir, "data.sqlite");
      new RapidMvpModel("Switch off").saveToSqlite(dbPath, "m");
      expect(fs.existsSync(dbPath)).toBe(true);
      expect(RapidMvpModel.mapExists(dbPath, "m")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("with M3E_STORE_DIR the same calls go to one store, whatever database path they name", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-record-store-switch-"));
    try {
      const storeDir = path.join(dir, "store");
      RecordWorkspaceStore.create(storeDir, toSnapshot("ws_switch", [], { now: "2026-11-17T00:00:00.000Z" }));
      process.env.M3E_STORE_DIR = storeDir;
      const store = activeRecordStore();
      expect(store).not.toBeNull();
      expect(activeRecordStore()).toBe(store);
      const dbPath = path.join(dir, "data.sqlite");
      const model = new RapidMvpModel("Switch on");
      model.saveToSqlite(dbPath, "m");
      expect(fs.existsSync(dbPath)).toBe(false);
      expect(store!.hasMap("m")).toBe(true);
      expect(RapidMvpModel.mapExists(path.join(dir, "other.sqlite"), "m")).toBe(true);
      const loaded = RapidMvpModel.loadSavedMapFromSqlite(dbPath, "m");
      expect(loaded.version).toBe(1);
      expect(loaded.state.nodes[loaded.state.rootId].text).toBe("Switch on");
      // The conditional save: the revision the caller read, then a revision that is no longer current.
      const revision = RapidMvpModel.savedRevision(loaded);
      model.editNode(model.state.rootId, "Switch on, edited");
      expect(model.saveToSqliteIfUnchanged(dbPath, "m", revision).state.nodes[model.state.rootId].text).toBe("Switch on, edited");
      expect(() => model.saveToSqliteIfUnchanged(dbPath, "m", revision)).toThrow("REVISION_CONFLICT");
      expect(() => RapidMvpModel.loadSavedMapFromSqlite(dbPath, "none")).toThrow("Map not found.");
      await closeActiveRecordStore();
      delete process.env.M3E_STORE_DIR;
      expect(activeRecordStore()).toBeNull();
    } finally {
      await closeActiveRecordStore();
      delete process.env.M3E_STORE_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a store directory inside the live M3E data directory is refused while M3E_FORBID_LIVE_DATA=1", () => {
    process.env.M3E_FORBID_LIVE_DATA = "1";
    // Refused by name; nothing in that directory is touched.
    process.env.M3E_STORE_DIR = path.join(os.homedir(), "Library", "Application Support", "M3E", "record-store-test-never-created");
    try {
      expect(() => activeRecordStore()).toThrow(/live M3E data directory/);
      expect(() => RapidMvpModel.mapExists("unused.sqlite", "m")).toThrow(/live M3E data directory/);
    } finally {
      delete process.env.M3E_STORE_DIR;
    }
  });
});
