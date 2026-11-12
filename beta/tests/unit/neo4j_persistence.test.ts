import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import type { AppState } from "../../src/shared/types";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { NEO4J_TEST_DATABASE, Neo4jMapStore } from "../../src/node/neo4j_map_store";
import { FileScopeJournalStore, MemoryDeliveryCursor, MemoryScopeJournalStore, ScopeSyncPeer } from "../../src/node/sync";

const BETA = path.resolve(__dirname, "../..");
const ROOT = "/tmp/m3e-beta-neo4j-test";
const PORT = 17687;
const URI = `bolt://127.0.0.1:${PORT}`;
// CI installs Neo4j elsewhere and points M3E_NEO4J_HOME at it.
const NEO4J_HOME = process.env.M3E_NEO4J_HOME || "/opt/homebrew/opt/neo4j";
const NEO4J_BIN = path.join(NEO4J_HOME, "bin", "neo4j");
const BREW_DATA = "/opt/homebrew/var/neo4j/data";
const ADDRESS = {
  workspaceId: "ws-beta-neo4j-test",
  accountId: "acct-beta-neo4j-test",
  mapId: "map-beta-neo4j-test",
};

let store: Neo4jMapStore | undefined;
let ownServer = false;

function neo4jEnv(): NodeJS.ProcessEnv {
  return { ...process.env, NEO4J_CONF: path.join(ROOT, "conf") };
}

function listenerPids(): string[] {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout.split(/\s+/).map((item) => item.trim()).filter((item) => item.length > 0);
}

function writeConfig(): void {
  for (const name of ["conf", "data", "logs", "run", "tx", "import"]) {
    fs.mkdirSync(path.join(ROOT, name), { recursive: true });
  }
  fs.writeFileSync(path.join(ROOT, "conf", "neo4j.conf"), [
    "db.query.default_language=CYPHER_5",
    "dbms.security.auth_enabled=false",
    "dbms.usage_report.enabled=false",
    `initial.dbms.default_database=${NEO4J_TEST_DATABASE}`,
    "server.default_listen_address=127.0.0.1",
    "server.bolt.enabled=true",
    `server.bolt.listen_address=127.0.0.1:${PORT}`,
    `server.bolt.advertised_address=127.0.0.1:${PORT}`,
    "server.bolt.tls_level=DISABLED",
    "server.http.enabled=false",
    "server.https.enabled=false",
    "server.memory.heap.initial_size=1g",
    "server.memory.heap.max_size=4g",
    "server.memory.pagecache.size=1g",
    `server.directories.data=${path.join(ROOT, "data")}`,
    `server.directories.logs=${path.join(ROOT, "logs")}`,
    `server.directories.run=${path.join(ROOT, "run")}`,
    `server.directories.transaction.logs.root=${path.join(ROOT, "tx")}`,
    `server.directories.import=${path.join(ROOT, "import")}`,
    "",
  ].join("\n"));
}

function waitForPort(timeoutMs: number): void {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (listenerPids().length > 0) return;
    spawnSync("sleep", ["0.5"]);
  }
  const logPath = path.join(ROOT, "logs", "neo4j.log");
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").slice(-2000) : "";
  throw new Error(`Temporary Neo4j did not listen on ${PORT}.\n${log}`);
}

function ensureServer(): void {
  if (fs.existsSync(BREW_DATA)) {
    throw new Error("Refusing to start: Homebrew Neo4j data directory exists.");
  }
  if (!fs.existsSync(NEO4J_BIN)) {
    throw new Error(`Neo4j is not installed at ${NEO4J_HOME}. The test stops instead of substituting another database.`);
  }
  const listeners = listenerPids();
  const pidFile = path.join(ROOT, "run", "neo4j.pid");
  const pid = fs.existsSync(pidFile) ? fs.readFileSync(pidFile, "utf8").trim() : "";
  if (listeners.length > 0) {
    if (!pid || !listeners.includes(pid)) {
      throw new Error(`Port ${PORT} is in use by a process that is not the temporary test Neo4j.`);
    }
    return;
  }
  writeConfig();
  const started = spawnSync(NEO4J_BIN, ["start"], { env: neo4jEnv(), encoding: "utf8" });
  const already = `${started.stdout}\n${started.stderr}`.includes("already running");
  if (started.status !== 0 && !already) {
    throw new Error(`neo4j start failed.\n${started.stdout}\n${started.stderr}`);
  }
  waitForPort(30000);
  if (fs.existsSync(BREW_DATA)) {
    spawnSync(NEO4J_BIN, ["stop"], { env: neo4jEnv(), encoding: "utf8" });
    throw new Error("Neo4j wrote the Homebrew data directory. Stopped it and refused the test.");
  }
}

function stopServer(): void {
  spawnSync(NEO4J_BIN, ["stop"], { env: neo4jEnv(), encoding: "utf8", timeout: 30000 });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && listenerPids().length > 0) spawnSync("sleep", ["0.5"]);
  if (listenerPids().length > 0) throw new Error("Temporary Neo4j did not stop.");
  fs.rmSync(ROOT, { recursive: true, force: true });
}

function compileStore(): void {
  const ts = require("typescript") as typeof import("typescript");
  const configPath = path.join(BETA, "tsconfig.node.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, BETA);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const emitted = program.emit();
  if (emitted.emitSkipped) {
    throw new Error("TypeScript emit was skipped.");
  }
}

function readInNewProcess(nodeId: string): {
  text: string | null;
  touch: Record<string, number>;
  state: {
    nodes: Record<string, { text: string; attributes: Record<string, string>; children: string[]; parentId: string | null }>;
    rootId: string;
    links: Record<string, { attributes?: Record<string, string> }>;
    scopes?: Record<string, { label: string; relationIds: string[]; rootNodeIds: string[] }>;
    linearNotesByScope?: Record<string, string>;
  };
} {
  const result = spawnSync(process.execPath, [path.join(BETA, "dist", "node", "neo4j_map_store.js")], {
    cwd: BETA,
    encoding: "utf8",
    timeout: 20000,
    env: {
      ...process.env,
      M3E_BETA_NEO4J_PROBE: "1",
      M3E_BETA_NEO4J_URI: URI,
      M3E_BETA_NEO4J_MAP_ID: ADDRESS.mapId,
      M3E_BETA_NEO4J_NODE_ID: nodeId,
    },
  });
  if (result.status !== 0) {
    throw new Error(`Reconnect probe failed.\n${result.stdout}\n${result.stderr}`);
  }
  const start = result.stdout.indexOf("{");
  const end = result.stdout.lastIndexOf("}");
  return JSON.parse(result.stdout.slice(start, end + 1)) as ReturnType<typeof readInNewProcess> extends infer T ? T : never;
}

describe("neo4j connection guard", () => {
  it("refuses a database other than the temporary test database", async () => {
    await expect(Neo4jMapStore.open({ uri: URI, database: "neo4j" })).rejects.toThrow(/m3ebetatest/);
  });

  it("refuses a non-loopback host", async () => {
    await expect(Neo4jMapStore.open({ uri: "bolt://db.example:7687", database: NEO4J_TEST_DATABASE })).rejects.toThrow(/loopback/);
  });
});

describe("neo4j map records", () => {
  beforeAll(async () => {
    process.env.M3E_BETA_NEO4J_URI = URI;
    ensureServer();
    ownServer = true;
    compileStore();
    store = await Neo4jMapStore.open({ uri: URI, database: NEO4J_TEST_DATABASE });
  }, 120000);

  afterAll(async () => {
    await store?.close();
    store = undefined;
    delete process.env.M3E_BETA_NEO4J_URI;
    if (ownServer) stopServer();
  }, 40000);

  it("saves a map as records, reads it back, and keeps one node edit after a new process connects", async () => {
    const current = store;
    if (!current) throw new Error("Neo4j store was not opened.");
    const databases = fs.readdirSync(path.join(ROOT, "data", "databases")).filter((name) => name !== "store_lock").sort();
    expect(databases).toEqual(["m3ebetatest", "system"]);

    const model = new RapidMvpModel("Root");
    const alpha = model.addNode(model.state.rootId, "Alpha");
    const beta = model.addNode(model.state.rootId, "Beta");
    model.state.nodes[alpha]!.attributes = { status: "open" };
    model.setScopeBoundary(beta, true);
    const gamma = model.addNode(beta, "Gamma");
    const linkId = model.addLink(alpha, beta, {
      relationType: "supports",
      label: "supports",
      attributes: { weight: "1" },
    });
    model.state.linearTextFontScale = 1.25;
    model.state.linearPanelWidth = 320;
    model.state.linearNotesByScope = { [beta]: "beta note" };
    model.state.scopes = {
      [`scope:${beta}`]: {
        id: `scope:${beta}`,
        label: "Beta scope",
        rootNodeIds: [beta],
        relationIds: [linkId],
      },
    };
    model.state.annotations = {
      pen1: { id: "pen1", kind: "pen", d: "M0 0", points: [{ x: 1, y: 2 }], stroke: "#111", strokeWidth: 2 },
    };
    const before = model.toJSON();
    const stacked = model.undoStack.length;

    await model.saveToNeo4j(current, ADDRESS);
    const loaded = await RapidMvpModel.loadFromNeo4j(current, ADDRESS.mapId);
    expect(loaded.toJSON()).toEqual(before);
    expect(loaded.state.scopes?.[`scope:${beta}`]).toMatchObject({
      label: "Beta scope",
      relationIds: [linkId],
      rootNodeIds: [beta],
    });
    expect(loaded.state.linearNotesByScope).toEqual({ [beta]: "beta note" });
    expect(await current.wholeMapBlobPaths(ADDRESS.mapId)).toEqual([]);
    expect((await current.edgeRecords(ADDRESS.mapId)).filter((edge) => edge.parentId === before.rootId).map((edge) => edge.childId)).toEqual([alpha, beta]);
    expect(await current.attributeRecords(ADDRESS.mapId)).toEqual([
      { ownerKind: "link", ownerId: linkId, attrKey: "weight", value: "1" },
      { ownerKind: "node", ownerId: alpha, attrKey: "status", value: "open" },
    ]);
    expect(await current.touchGenerations(ADDRESS.mapId)).toMatchObject({
      [before.rootId]: 1,
      [alpha]: 1,
      [beta]: 1,
      [gamma]: 1,
    });

    const edgesBeforeEdit = await current.edgeElementIds(ADDRESS.mapId);
    const memoryPeer = new ScopeSyncPeer(
      "device-memory",
      ADDRESS.accountId,
      { accountId: ADDRESS.accountId, workspaceId: ADDRESS.workspaceId },
      [],
      new MemoryScopeJournalStore(),
      new MemoryDeliveryCursor(),
    );
    const renamed = await model.editNodeTextInNeo4j(current, ADDRESS.mapId, gamma, "Gamma edited", memoryPeer);
    expect(memoryPeer.journal.readAll()).toHaveLength(1);
    expect(memoryPeer.journal.readScope(`scope:${beta}`)).toMatchObject([
      { mapId: ADDRESS.mapId, scopeId: `scope:${beta}`, command: { intent: "rename", targetId: gamma } },
    ]);
    expect(await current.edgeElementIds(ADDRESS.mapId)).toEqual(edgesBeforeEdit);
    expect((await current.loadTextJournal(ADDRESS.mapId))?.operations).toHaveLength(1);
    expect(model.undoStack).toHaveLength(stacked);
    expect(model.textJournal?.operations).toHaveLength(1);
    expect(model.textJournal?.operations[0]).toMatchObject({
      before: expect.objectContaining({ [gamma]: "Gamma" }),
      after: expect.objectContaining({ [gamma]: "Gamma edited" }),
    });
    expect(renamed).toMatchObject({
      intent: "rename",
      scopeId: `scope:${beta}`,
      nodeId: gamma,
      field: "text",
      previousText: "Gamma",
      nextText: "Gamma edited",
    });
    const betaChanges = await current.readScopeChanges(ADDRESS.mapId, `scope:${beta}`);
    expect(betaChanges.map((change) => change.intent)).toEqual(["assert", "rename"]);
    const rootChanges = await current.readScopeChanges(ADDRESS.mapId, `scope:${before.rootId}`);
    expect(rootChanges.map((change) => change.intent)).toEqual(["assert"]);
    expect(await current.touchGenerations(ADDRESS.mapId)).toMatchObject({
      [alpha]: 1,
      [beta]: 1,
      [gamma]: 2,
    });

    await current.close();
    store = undefined;
    const reconnected = readInNewProcess(gamma);
    expect(reconnected.text).toBe("Gamma edited");
    expect(reconnected.state.nodes[gamma]!.parentId).toBe(beta);
    expect(reconnected.state.nodes[before.rootId]!.children).toEqual([alpha, beta]);
    expect(reconnected.state.nodes[alpha]!.text).toBe("Alpha");
    expect(reconnected.state.nodes[alpha]!.attributes).toEqual({ status: "open" });
    expect(reconnected.state.links[linkId]!.attributes).toEqual({ weight: "1" });
    expect(reconnected.state.linearNotesByScope).toEqual({ [beta]: "beta note" });
    expect(reconnected.state.scopes?.[`scope:${beta}`]).toMatchObject({
      label: "Beta scope",
      relationIds: [linkId],
    });
    expect(reconnected.touch[gamma]).toBe(2);
    expect(reconnected.touch[alpha]).toBe(1);

    expect(await model.undoRecordedEdit(ADDRESS.mapId)).toBe(true);
    expect(model.state.nodes[gamma]!.text).toBe("Gamma");
    expect(model.undoStack).toHaveLength(stacked);
    expect(model.textJournal?.cursor).toBe(-1);
    const afterUndo = readInNewProcess(gamma);
    expect(afterUndo.text).toBe("Gamma");
    expect(model.state.nodes[gamma]!.text).toBe("Gamma");
  }, 60000);

  it("saves through the viewer entry without state_json and applies one text edit as a diff", async () => {
    const sqlitePath = path.join("/tmp", "m3e-beta-viewer-neo4j", "not-opened.sqlite");
    fs.rmSync(path.dirname(sqlitePath), { recursive: true, force: true });
    const model = new RapidMvpModel("Viewer root");
    const left = model.addNode(model.state.rootId, "Left");
    const right = model.addNode(model.state.rootId, "Right");
    model.state.nodes[left]!.attributes = { status: "open" };
    const linkId = model.addLink(left, right, { label: "sees", attributes: { weight: "1" } });
    const mapId = "map-viewer-diff";
    model.saveToSqlite(sqlitePath, mapId);
    expect(fs.existsSync(sqlitePath)).toBe(false);
    const loaded = RapidMvpModel.loadFromSqlite(sqlitePath, mapId);
    expect(loaded.state.nodes[left]!.text).toBe("Left");
    const open = await Neo4jMapStore.open({ uri: URI, database: NEO4J_TEST_DATABASE });
    try {
      const edges = await open.edgeElementIds(mapId);
      loaded.state.nodes[right]!.text = "Right renamed";
      loaded.saveToSqlite(sqlitePath, mapId);
      expect(await open.edgeElementIds(mapId)).toEqual(edges);
      expect((await open.touchGenerations(mapId))[left]).toBe(1);
      expect((await open.touchGenerations(mapId))[right]).toBe(2);
      loaded.state.nodes[model.state.rootId]!.children = [right, left];
      loaded.state.nodes[left]!.attributes = { status: "closed" };
      loaded.state.links![linkId]!.sourceNodeId = right;
      loaded.state.links![linkId]!.targetNodeId = left;
      loaded.saveToSqlite(sqlitePath, mapId);
      const again = RapidMvpModel.loadFromSqlite(sqlitePath, mapId);
      expect(again.state.nodes[model.state.rootId]!.children).toEqual([right, left]);
      expect(again.state.nodes[left]!.attributes).toEqual({ status: "closed" });
      expect(again.state.links![linkId]).toMatchObject({ sourceNodeId: right, targetNodeId: left });
      expect(await open.edgeElementIds(mapId)).toEqual(edges);
    } finally {
      await open.close();
    }
  }, 60000);

  it("records one text edit on one in-memory scope peer", async () => {
    const open = await Neo4jMapStore.open({ uri: URI, database: NEO4J_TEST_DATABASE });
    try {
      const model = new RapidMvpModel("Peer root");
      const child = model.addNode(model.state.rootId, "Child");
      const mapId = "map-scope-peer";
      await model.saveToNeo4j(open, { ...ADDRESS, mapId });
      const journal = new MemoryScopeJournalStore();
      const peer = new ScopeSyncPeer(
        "device-memory",
        ADDRESS.accountId,
        { accountId: ADDRESS.accountId, workspaceId: ADDRESS.workspaceId },
        [],
        journal,
        new MemoryDeliveryCursor(),
      );
      const edited = "Child renamed";
      await model.editNodeTextInNeo4j(open, mapId, child, edited, peer);
      const records = journal.readAll();
      expect(records).toHaveLength(1);
      expect(peer.journal.readScope(records[0]!.scopeId)).toHaveLength(1);
      expect(records[0]).toMatchObject({
        deviceId: "device-memory",
        workspaceId: ADDRESS.workspaceId,
        mapId,
        command: { intent: "rename", targetId: child, operation: { field: "text", text: edited } },
      });
      expect(records[0]!.scopeId.length).toBeGreaterThan(0);
    } finally {
      await open.close();
    }
  }, 60000);

  it("writes one text edit to a temporary file scope journal", async () => {
    const liveRoot = path.join(process.env.HOME || "", "Library", "Application Support", "M3E");
    const backupRoot = "/Users/akaghef/Backups/M3E";
    const peerRoot = fs.mkdtempSync(path.join("/tmp", "m3e-scope-journal-"));
    if (path.resolve(peerRoot).startsWith(liveRoot + path.sep) || path.resolve(peerRoot).startsWith(backupRoot + path.sep)) {
      throw new Error("Refusing to write the live or backup tree.");
    }
    const open = await Neo4jMapStore.open({ uri: URI, database: NEO4J_TEST_DATABASE });
    try {
      const model = new RapidMvpModel("File peer");
      const child = model.addNode(model.state.rootId, "Child");
      const scopeId = "scope-file-peer";
      model.state.scopes = {
        [`scope:${model.state.rootId}`]: {
          id: scopeId,
          label: "File scope",
          rootNodeIds: [model.state.rootId],
          relationIds: [],
        },
      };
      const mapId = "map-file-scope-peer";
      await model.saveToNeo4j(open, { ...ADDRESS, mapId });
      const peer = new ScopeSyncPeer(
        "device-file",
        ADDRESS.accountId,
        { accountId: ADDRESS.accountId, workspaceId: ADDRESS.workspaceId },
        [],
        new FileScopeJournalStore(peerRoot),
        new MemoryDeliveryCursor(),
      );
      await model.editNodeTextInNeo4j(open, mapId, child, "Child renamed", peer);
      const reloaded = new FileScopeJournalStore(peerRoot);
      const records = reloaded.readAll();
      expect(records).toHaveLength(1);
      expect(reloaded.readScope(scopeId)).toHaveLength(1);
      expect(records[0]).toMatchObject({
        deviceId: "device-file",
        workspaceId: ADDRESS.workspaceId,
        mapId,
        scopeId,
        command: { intent: "rename", targetId: child, operation: { field: "text" } },
      });
      expect(typeof records[0]!.command.operation.text).toBe("string");
    } finally {
      await open.close();
      fs.rmSync(peerRoot, { recursive: true, force: true });
    }
  }, 60000);

  it("saves the three core-seed maps whose nodes carry type", async () => {
    const sqlitePath = "/Users/akaghef/Backups/M3E/261111-pre-neo4j/m3e/seeds/core-seed.sqlite";
    const liveRoot = path.join(process.env.HOME || "", "Library", "Application Support", "M3E");
    if (path.resolve(sqlitePath).startsWith(liveRoot + path.sep)) {
      throw new Error("Refusing to open the live M3E database.");
    }
    const before = fs.statSync(sqlitePath);
    const ids = ["akaghef-beta", "sandbox-workspace", "main-workspace"];
    const open = await Neo4jMapStore.open({ uri: URI, database: NEO4J_TEST_DATABASE });
    const failed: Array<{ id: string; reason: string }> = [];
    try {
      const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
      try {
        for (const id of ids) {
          const row = db.prepare("SELECT state_json FROM maps WHERE id = ?").get(id) as { state_json: string } | undefined;
          if (!row) {
            failed.push({ id, reason: "Map not found." });
            continue;
          }
          const state = JSON.parse(row.state_json) as AppState;
          const mapId = `backup::core-type::${id}`;
          try {
            await open.saveMap({
              workspaceId: "ws-core-seed",
              accountId: "acct-backup-import",
              mapId,
              state,
            });
            const loaded = await open.loadMap(mapId);
            const typed = Object.values(loaded.state.nodes).filter((node) => typeof (node as { type?: unknown }).type === "string").length;
            expect(Object.keys(loaded.state.nodes).length).toBe(Object.keys(state.nodes).length);
            expect(typed).toBe(5);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            failed.push({ id, reason: reason.slice(0, 240) });
          }
        }
      } finally {
        db.close();
      }
      expect(failed).toEqual([]);
      expect(fs.statSync(sqlitePath).mtimeMs).toBe(before.mtimeMs);
      expect(fs.statSync(sqlitePath).size).toBe(before.size);
    } finally {
      await open.close();
    }
  }, 120000);
});
