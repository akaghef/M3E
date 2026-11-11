import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import neo4j from "neo4j-driver";
import Database from "better-sqlite3";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { NEO4J_TEST_DATABASE, Neo4jMapStore, annotationToken, swarmSaveCommandId, type NodeCommandResult } from "../../src/node/neo4j_map_store";
import type { AppState, TreeNode } from "../../src/shared/types";

const BETA = path.resolve(__dirname, "../..");
const ROOT = "/tmp/m3e-beta-neo4j-swarm";
const PORT = 17688;
const URI = `bolt://127.0.0.1:${PORT}`;
const NEO4J_BIN = "/opt/homebrew/opt/neo4j/bin/neo4j";
const BREW_DATA = "/opt/homebrew/var/neo4j/data";
const ADDRESS = {
  workspaceId: "ws-beta-neo4j-swarm",
  accountId: "acct-beta-neo4j-swarm",
};

let store: Neo4jMapStore | undefined;
let ownServer = false;

function neo4jEnv(): NodeJS.ProcessEnv {
  return { ...process.env, NEO4J_CONF: path.join(ROOT, "conf") };
}

function listenerPids(): string[] {
  const result = spawnSync("/usr/sbin/lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
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
    "server.memory.heap.initial_size=256m",
    "server.memory.heap.max_size=512m",
    "server.memory.pagecache.size=256m",
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
    throw new Error("Neo4j is not installed at /opt/homebrew/opt/neo4j. The test stops instead of substituting another database.");
  }
  const listeners = listenerPids();
  const pidFile = path.join(ROOT, "run", "neo4j.pid");
  const pid = fs.existsSync(pidFile) ? fs.readFileSync(pidFile, "utf8").trim() : "";
  if (listeners.length > 0) {
    if (!pid || !listeners.includes(pid)) {
      throw new Error(`Port ${PORT} is in use by a process that is not the temporary swarm Neo4j.`);
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
  if (listenerPids().length > 0) throw new Error("Temporary swarm Neo4j did not stop.");
  fs.rmSync(ROOT, { recursive: true, force: true });
}

function compileStore(): void {
  const ts = require("typescript") as typeof import("typescript");
  const configPath = path.join(BETA, "tsconfig.node.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, BETA);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const emitted = program.emit();
  const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitted.diagnostics).filter((diagnostic) => {
    const fileName = diagnostic.file?.fileName ?? "";
    return fileName.endsWith("/neo4j_map_store.ts")
      || fileName.endsWith("/rapid_mvp.ts")
      || fileName.endsWith("/apply/command.ts")
      || fileName.endsWith("/scope_permission.ts");
  });
  if (emitted.emitSkipped || diagnostics.length > 0) {
    throw new Error(ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => BETA,
      getNewLine: () => "\n",
    }) || "TypeScript emit was skipped.");
  }
}

async function openStore(): Promise<Neo4jMapStore> {
  const deadline = Date.now() + 20000;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      return await Neo4jMapStore.open({ uri: URI, database: NEO4J_TEST_DATABASE });
    } catch (error) {
      last = error;
      spawnSync("sleep", ["0.5"]);
    }
  }
  throw last instanceof Error ? last : new Error("Neo4j open failed.");
}

function requireStore(): Neo4jMapStore {
  if (!store) throw new Error("Neo4j store was not opened.");
  return store;
}

interface SwarmMap {
  mapId: string;
  rootId: string;
  alpha: string;
  delta: string;
  epsilon: string;
  beta: string;
  gamma: string;
  hidden: string;
  secret: string;
  locked: string;
  glance: string;
}

async function buildMap(mapId: string): Promise<SwarmMap> {
  const current = requireStore();
  const model = new RapidMvpModel("Root");
  const alpha = model.addNode(model.state.rootId, "Alpha");
  const delta = model.addNode(model.state.rootId, "Delta");
  const epsilon = model.addNode(model.state.rootId, "Epsilon");
  const beta = model.addNode(model.state.rootId, "Beta");
  model.setScopeBoundary(beta, true);
  const gamma = model.addNode(beta, "Gamma");
  const hidden = model.addNode(model.state.rootId, "Hidden");
  model.setScopeBoundary(hidden, true);
  const secret = model.addNode(hidden, "Secret");
  const locked = model.addNode(model.state.rootId, "Locked");
  model.setScopeBoundary(locked, true);
  const glance = model.addNode(locked, "Glance");
  await model.saveToNeo4j(current, { ...ADDRESS, mapId });
  await current.replaceScopeGrants({
    mapId,
    actorAccountId: ADDRESS.accountId,
    grants: [
      { scopeId: `scope:${model.state.rootId}`, capability: "write" },
      { scopeId: `scope:${beta}`, capability: "write" },
      { scopeId: `scope:${locked}`, capability: "read" },
    ],
  });
  const built = { mapId, rootId: model.state.rootId, alpha, delta, epsilon, beta, gamma, hidden, secret, locked, glance };
  expect((await current.readNodeClaim(mapId, alpha))?.scopeId).toBe(`scope:${built.rootId}`);
  expect((await current.readNodeClaim(mapId, gamma))?.scopeId).toBe(`scope:${beta}`);
  expect((await current.readNodeClaim(mapId, secret))?.scopeId).toBe(`scope:${hidden}`);
  expect((await current.readNodeClaim(mapId, glance))?.scopeId).toBe(`scope:${locked}`);
  expect((await current.readNodeClaim(mapId, alpha))?.revision).toBe("0");
  return built;
}

function submitInProcess(body: Record<string, unknown>): Promise<NodeCommandResult & { ok?: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(BETA, "dist", "node", "neo4j_map_store.js")], {
      cwd: BETA,
      env: {
        ...process.env,
        M3E_BETA_NEO4J_SYNC: "1",
        M3E_BETA_NEO4J_PROBE: "",
        M3E_BETA_NEO4J_URI: URI,
      },
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), 20000);
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(out).toString("utf8");
      const stderr = Buffer.concat(err).toString("utf8");
      if (status !== 0) {
        reject(new Error(`submit process failed (${status}).\n${stderr}\n${stdout}`));
        return;
      }
      const start = stdout.indexOf("{");
      const end = stdout.lastIndexOf("}");
      if (start < 0 || end < start) {
        reject(new Error(`submit process returned no JSON.\n${stderr}`));
        return;
      }
      resolve(JSON.parse(stdout.slice(start, end + 1)) as NodeCommandResult & { ok?: boolean });
    });
    child.stdin.end(JSON.stringify(body));
  });
}

describe("neo4j swarm writes", () => {
  beforeAll(async () => {
    process.env.M3E_BETA_NEO4J_URI = URI;
    process.env.M3E_WORKSPACE_ID = ADDRESS.workspaceId;
    process.env.M3E_ACCOUNT_ID = ADDRESS.accountId;
    ensureServer();
    ownServer = true;
    compileStore();
    store = await openStore();
  }, 120000);

  afterAll(async () => {
    await store?.close();
    store = undefined;
    delete process.env.M3E_BETA_NEO4J_URI;
    delete process.env.M3E_WORKSPACE_ID;
    delete process.env.M3E_ACCOUNT_ID;
    if (ownServer) stopServer();
  }, 40000);

  it("二つの書き手が別 node を同時に改名しても両方残り、全体 JSON では上書きしない", async () => {
    const current = requireStore();
    const map = await buildMap("swarm-both");
    const beforeEdges = await current.edgeElementIds(map.mapId);
    const beforeCount = await current.countWithPrefix("swarm-both");
    const left = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    const right = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    const [alpha, delta, gamma, epsilon] = await Promise.all([
      submitInProcess({
        op: "submit",
        mapId: map.mapId,
        actorAccountId: ADDRESS.accountId,
        commandId: "cmd-alpha",
        baseRevision: "0",
        intent: "rename",
        nodeId: map.alpha,
        text: "Alpha from process",
      }),
      submitInProcess({
        op: "submit",
        mapId: map.mapId,
        actorAccountId: ADDRESS.accountId,
        commandId: "cmd-delta",
        baseRevision: "0",
        intent: "rename",
        nodeId: map.delta,
        text: "Delta from process",
      }),
      left.submitRenameInNeo4j(current, map.mapId, {
        actorAccountId: ADDRESS.accountId,
        commandId: "cmd-gamma",
        baseRevision: "0",
        nodeId: map.gamma,
        text: "Gamma from model",
      }),
      right.submitRenameInNeo4j(current, map.mapId, {
        actorAccountId: ADDRESS.accountId,
        commandId: "cmd-epsilon",
        baseRevision: "0",
        nodeId: map.epsilon,
        text: "Epsilon from model",
      }),
    ]);
    expect([alpha.outcome, delta.outcome, gamma.outcome, epsilon.outcome]).toEqual(["applied", "applied", "applied", "applied"]);
    const loaded = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    expect(loaded.state.nodes[map.alpha]!.text).toBe("Alpha from process");
    expect(loaded.state.nodes[map.delta]!.text).toBe("Delta from process");
    expect(loaded.state.nodes[map.gamma]!.text).toBe("Gamma from model");
    expect(loaded.state.nodes[map.epsilon]!.text).toBe("Epsilon from model");
    expect(loaded.state.nodes[map.secret]!.text).toBe("Secret");
    expect(loaded.state.nodes[map.glance]!.text).toBe("Glance");
    expect(loaded.state.nodes[map.rootId]!.children).toEqual(left.state.nodes[map.rootId]!.children);
    expect(await current.edgeElementIds(map.mapId)).toEqual(beforeEdges);
    expect(await current.wholeMapBlobPaths(map.mapId)).toEqual([]);
    expect(await current.countWithPrefix("swarm-both")).toEqual(beforeCount);
    expect((await current.readNodeClaim(map.mapId, map.alpha))?.revision).toBe("1");
    expect((await current.readNodeClaim(map.mapId, map.delta))?.revision).toBe("1");
    expect((await current.readNodeClaim(map.mapId, map.gamma))?.revision).toBe("1");
    expect((await current.readNodeClaim(map.mapId, map.secret))?.revision).toBe("0");
    const rootChanges = await current.readScopeChanges(map.mapId, `scope:${map.rootId}`);
    expect(rootChanges.filter((change) => change.intent === "rename").map((change) => change.nodeId).sort()).toEqual([map.alpha, map.delta, map.epsilon].sort());
    const betaChanges = await current.readScopeChanges(map.mapId, `scope:${map.beta}`);
    expect(betaChanges.filter((change) => change.intent === "rename").map((change) => change.nodeId)).toEqual([map.gamma]);
  }, 60000);

  it("同じ commandId の再送は一度だけ適用する", async () => {
    const current = requireStore();
    const map = await buildMap("swarm-once");
    const model = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    const first = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-once",
      baseRevision: "0",
      nodeId: map.alpha,
      text: "Alpha once",
    });
    expect(first.outcome).toBe("applied");
    const again = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-once",
      baseRevision: "0",
      nodeId: map.alpha,
      text: "Alpha twice",
    });
    expect(again.outcome).toBe("ignored");
    expect(again.outcome === "ignored" ? again.revision : "").toBe("1");
    expect((await current.readNodeClaim(map.mapId, map.alpha))?.text).toBe("Alpha once");
    expect((await current.readNodeClaim(map.mapId, map.alpha))?.revision).toBe("1");
    expect(model.state.nodes[map.alpha]!.text).toBe("Alpha once");
    expect(await current.hasAppliedCommand(map.mapId, "cmd-once")).toBe(true);
  }, 60000);

  it("古い revision は拒否し、その commandId は消費しない", async () => {
    const current = requireStore();
    const map = await buildMap("swarm-stale");
    const model = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    const first = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-current",
      baseRevision: "0",
      nodeId: map.alpha,
      text: "Alpha current",
    });
    expect(first.outcome).toBe("applied");
    const stale = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-stale",
      baseRevision: "0",
      nodeId: map.alpha,
      text: "Alpha stale",
    });
    expect(stale.outcome).toBe("rejected");
    if (stale.outcome === "rejected") expect(stale.reason).toBe("stale-revision");
    expect(await current.hasAppliedCommand(map.mapId, "cmd-stale")).toBe(false);
    expect((await current.readNodeClaim(map.mapId, map.alpha))?.text).toBe("Alpha current");
    expect(model.state.nodes[map.alpha]!.text).toBe("Alpha current");
    const retried = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-stale",
      baseRevision: "1",
      nodeId: map.alpha,
      text: "Alpha retried",
    });
    expect(retried.outcome).toBe("applied");
    expect((await current.readNodeClaim(map.mapId, map.alpha))?.text).toBe("Alpha retried");
    expect((await current.readNodeClaim(map.mapId, map.alpha))?.revision).toBe("2");
  }, 60000);

  it("権限の無い scope への書きは拒否し、commandId を消費しない", async () => {
    const current = requireStore();
    const map = await buildMap("swarm-deny");
    const model = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    const missing = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-secret",
      baseRevision: "0",
      nodeId: map.secret,
      text: "Secret edited",
    });
    const readonly = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-glance",
      baseRevision: "0",
      nodeId: map.glance,
      text: "Glance edited",
    });
    const outsider = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: "acct-other",
      commandId: "cmd-outsider",
      baseRevision: "0",
      nodeId: map.alpha,
      text: "Alpha outsider",
    });
    expect(missing.outcome).toBe("rejected");
    expect(readonly.outcome).toBe("rejected");
    expect(outsider.outcome).toBe("rejected");
    if (missing.outcome === "rejected") expect(missing.reason).toBe("scope-denied");
    if (readonly.outcome === "rejected") expect(readonly.reason).toBe("scope-denied");
    if (outsider.outcome === "rejected") expect(outsider.reason).toBe("scope-denied");
    expect(await current.hasAppliedCommand(map.mapId, "cmd-secret")).toBe(false);
    expect(await current.hasAppliedCommand(map.mapId, "cmd-glance")).toBe(false);
    expect(await current.hasAppliedCommand(map.mapId, "cmd-outsider")).toBe(false);
    expect((await current.readNodeClaim(map.mapId, map.secret))?.text).toBe("Secret");
    expect((await current.readNodeClaim(map.mapId, map.glance))?.text).toBe("Glance");
    expect((await current.readNodeClaim(map.mapId, map.alpha))?.text).toBe("Alpha");
    expect((await current.readNodeClaim(map.mapId, map.secret))?.revision).toBe("0");
    await expect(current.replaceScopeGrants({
      mapId: map.mapId,
      actorAccountId: "acct-other",
      grants: [],
    })).rejects.toThrow(/account boundary/);
    const stillDenied = await model.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: "cmd-secret-again",
      baseRevision: "0",
      nodeId: map.secret,
      text: "Secret edited again",
    });
    expect(stillDenied.outcome).toBe("rejected");
    if (stillDenied.outcome === "rejected") expect(stillDenied.reason).toBe("scope-denied");
  }, 60000);

  it("同じ node への同時編集は片方だけ残り、負けた commandId は消費されない", async () => {
    const current = requireStore();
    const map = await buildMap("swarm-race");
    const left = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    const right = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    const [first, second] = await Promise.all([
      left.submitRenameInNeo4j(current, map.mapId, {
        actorAccountId: ADDRESS.accountId,
        commandId: "cmd-race-left",
        baseRevision: "0",
        nodeId: map.epsilon,
        text: "Epsilon left",
      }),
      right.submitRenameInNeo4j(current, map.mapId, {
        actorAccountId: ADDRESS.accountId,
        commandId: "cmd-race-right",
        baseRevision: "0",
        nodeId: map.epsilon,
        text: "Epsilon right",
      }),
    ]);
    const outcomes = [first, second];
    const applied = outcomes.find((item) => item.outcome === "applied");
    const rejected = outcomes.find((item) => item.outcome === "rejected");
    expect(applied?.outcome).toBe("applied");
    expect(rejected?.outcome).toBe("rejected");
    if (rejected?.outcome !== "rejected" || applied?.outcome !== "applied") return;
    expect(rejected.reason).toBe("stale-revision");
    expect(await current.hasAppliedCommand(map.mapId, applied.commandId)).toBe(true);
    expect(await current.hasAppliedCommand(map.mapId, rejected.commandId)).toBe(false);
    const claim = await current.readNodeClaim(map.mapId, map.epsilon);
    expect(["Epsilon left", "Epsilon right"]).toContain(claim?.text);
    expect(claim?.revision).toBe("1");
    const winnerText = claim?.text;
    const retried = await left.submitRenameInNeo4j(current, map.mapId, {
      actorAccountId: ADDRESS.accountId,
      commandId: rejected.commandId,
      baseRevision: "1",
      nodeId: map.epsilon,
      text: "Epsilon retried",
    });
    expect(retried.outcome).toBe("applied");
    expect((await current.readNodeClaim(map.mapId, map.epsilon))?.text).toBe("Epsilon retried");
    expect(winnerText).not.toBe("Epsilon retried");
  }, 60000);

  it("editNodeTextInNeo4j と古い全体保存は、先に変わった text を戻さない", async () => {
    const current = requireStore();
    const writer = new RapidMvpModel("Root");
    const alpha = writer.addNode(writer.state.rootId, "Alpha");
    const delta = writer.addNode(writer.state.rootId, "Delta");
    const mapId = "swarm-stale-save";
    await writer.saveToNeo4j(current, { ...ADDRESS, mapId });
    const stale = await RapidMvpModel.loadFromNeo4j(current, mapId);
    await writer.editNodeTextInNeo4j(current, mapId, alpha, "Alpha live", undefined, {
      actorAccountId: ADDRESS.accountId,
      commandId: "live-alpha",
      baseRevision: "0",
    });
    await expect(stale.editNodeTextInNeo4j(current, mapId, alpha, "Alpha stale edit", undefined, {
      actorAccountId: ADDRESS.accountId,
      commandId: "stale-alpha-edit",
      baseRevision: stale.nodeBases[alpha] ?? "0",
    })).rejects.toThrow(/stale-revision/);
    expect(await current.hasAppliedCommand(mapId, "stale-alpha-edit")).toBe(false);
    expect((await current.readNodeClaim(mapId, alpha))?.text).toBe("Alpha live");
    stale.state.nodes[delta]!.text = "Delta from old save";
    const saved = await current.saveMap({
      ...ADDRESS,
      mapId,
      state: stale.toJSON(),
      nodeBases: stale.nodeBases,
      actorAccountId: ADDRESS.accountId,
    });
    const sqlitePath = "/tmp/m3e-beta-neo4j-swarm-save/not-opened.sqlite";
    stale.saveToSqlite(sqlitePath, mapId, { actorAccountId: ADDRESS.accountId });
    expect(saved.commands.map((command) => ({
      nodeId: command.nodeId,
      outcome: command.outcome,
      reason: command.outcome === "rejected" ? command.reason : "",
    }))).toEqual(expect.arrayContaining([
      { nodeId: alpha, outcome: "rejected", reason: "stale-revision" },
      { nodeId: delta, outcome: "applied", reason: "" },
    ]));
    const loaded = await RapidMvpModel.loadFromNeo4j(current, mapId);
    expect(loaded.state.nodes[alpha]!.text).toBe("Alpha live");
    expect(loaded.state.nodes[delta]!.text).toBe("Delta from old save");
    const revertedId = swarmSaveCommandId("rename", alpha, "0", JSON.stringify({ text: "Alpha" }));
    expect(await current.hasAppliedCommand(mapId, revertedId)).toBe(false);
    expect(loaded.state.nodes[writer.state.rootId]!.children).toEqual(writer.state.nodes[writer.state.rootId]!.children);
  }, 60000);

  it("追加、親変更、削除、属性も commandId と revision で採否する", async () => {
    const current = requireStore();
    const map = await buildMap("swarm-structure");
    const actorAccountId = ADDRESS.accountId;
    const parent = map.rootId;
    const [first, second] = await Promise.all([
      current.submitNodeCommand({
        mapId: map.mapId, actorAccountId, commandId: "add-left", baseRevision: "0",
        intent: "assert", nodeId: "node-left", parentId: parent, text: "Left added",
      }),
      current.submitNodeCommand({
        mapId: map.mapId, actorAccountId, commandId: "add-right", baseRevision: "0",
        intent: "assert", nodeId: "node-right", parentId: parent, text: "Right added",
      }),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(["applied", "applied"]);
    const again = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "add-left", baseRevision: "0",
      intent: "assert", nodeId: "node-left", parentId: parent, text: "Left replaced",
    });
    expect(again.outcome).toBe("ignored");
    expect((await current.readNodeClaim(map.mapId, "node-left"))?.text).toBe("Left added");
    const moved = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "move-gamma", baseRevision: "0",
      intent: "reparent", nodeId: map.gamma, parentId: parent,
    });
    expect(moved.outcome).toBe("applied");
    const staleMove = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "move-gamma-stale", baseRevision: "0",
      intent: "reparent", nodeId: map.gamma, parentId: map.beta,
    });
    expect(staleMove.outcome).toBe("rejected");
    if (staleMove.outcome === "rejected") expect(staleMove.reason).toBe("stale-revision");
    expect(await current.hasAppliedCommand(map.mapId, "move-gamma-stale")).toBe(false);
    const loaded = await RapidMvpModel.loadFromNeo4j(current, map.mapId);
    expect(loaded.state.nodes[map.gamma]!.parentId).toBe(parent);
    const marked = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "attr-alpha", baseRevision: "0",
      intent: "set-attribute", nodeId: map.alpha, attrKey: "status", attrValue: "open",
    });
    expect(marked.outcome).toBe("applied");
    const staleAttr = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "attr-stale", baseRevision: "0",
      intent: "set-attribute", nodeId: map.alpha, attrKey: "status", attrValue: "closed",
    });
    expect(staleAttr.outcome).toBe("rejected");
    expect(await current.hasAppliedCommand(map.mapId, "attr-stale")).toBe(false);
    expect((await current.attributeRecords(map.mapId)).some((row) => row.ownerId === map.alpha && row.value === "open")).toBe(true);
    const denied = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "delete-secret", baseRevision: "0",
      intent: "delete", nodeId: map.secret,
    });
    expect(denied.outcome).toBe("rejected");
    if (denied.outcome === "rejected") expect(denied.reason).toBe("scope-denied");
    expect(await current.hasAppliedCommand(map.mapId, "delete-secret")).toBe(false);
    expect((await current.readNodeClaim(map.mapId, map.secret))?.text).toBe("Secret");
    const removed = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "delete-right",
      baseRevision: second.outcome === "applied" ? second.revision : "0",
      intent: "delete", nodeId: "node-right",
    });
    expect(removed.outcome, JSON.stringify(removed)).toBe("applied");
    expect(await current.readNodeClaim(map.mapId, "node-right")).toBeNull();
    const removedAgain = await current.submitNodeCommand({
      mapId: map.mapId, actorAccountId, commandId: "delete-right", baseRevision: "0",
      intent: "delete", nodeId: "node-right",
    });
    expect(removedAgain.outcome).toBe("ignored");
  }, 60000);

  it("reorder、retarget、GraphLink の追加と削除は commandId と revision で採否する", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("Root");
    const left = model.addNode(model.state.rootId, "Left");
    const right = model.addNode(model.state.rootId, "Right");
    const linkId = model.addLink(left, right, { label: "sees" });
    const mapId = "swarm-links";
    await model.saveToNeo4j(current, { ...ADDRESS, mapId });
    const staleModel = await RapidMvpModel.loadFromNeo4j(current, mapId);
    const actorAccountId = ADDRESS.accountId;
    const reordered = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "order-1", baseRevision: model.nodeBases[model.state.rootId] ?? "0",
      intent: "reorder", nodeId: model.state.rootId, childIds: `${right},${left}`,
    });
    expect(reordered.outcome).toBe("applied");
    const staleOrder = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "order-stale", baseRevision: "0",
      intent: "reorder", nodeId: model.state.rootId, childIds: `${left},${right}`,
    });
    expect(staleOrder.outcome).toBe("rejected");
    if (staleOrder.outcome === "rejected") expect(staleOrder.reason).toBe("stale-revision");
    expect(await current.hasAppliedCommand(mapId, "order-stale")).toBe(false);
    expect((await RapidMvpModel.loadFromNeo4j(current, mapId)).state.nodes[model.state.rootId]!.children).toEqual([right, left]);
    const moved = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "retarget-1", baseRevision: "0",
      intent: "retarget", targetKind: "GraphLink", nodeId: linkId, sourceNodeId: right, targetNodeId: left,
    });
    expect(moved.outcome).toBe("applied");
    const staleLink = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "retarget-stale", baseRevision: "0",
      intent: "retarget", targetKind: "GraphLink", nodeId: linkId, sourceNodeId: left, targetNodeId: right,
    });
    expect(staleLink.outcome).toBe("rejected");
    expect(await current.hasAppliedCommand(mapId, "retarget-stale")).toBe(false);
    const afterRetarget = await RapidMvpModel.loadFromNeo4j(current, mapId);
    expect(afterRetarget.state.links?.[linkId]).toMatchObject({ sourceNodeId: right, targetNodeId: left });
    const [addedA, addedB] = await Promise.all([
      current.submitNodeCommand({
        mapId, actorAccountId, commandId: "link-a", baseRevision: "0", intent: "assert", targetKind: "GraphLink",
        nodeId: "link-a", sourceNodeId: left, targetNodeId: right,
      }),
      current.submitNodeCommand({
        mapId, actorAccountId, commandId: "link-b", baseRevision: "0", intent: "assert", targetKind: "GraphLink",
        nodeId: "link-b", sourceNodeId: right, targetNodeId: model.state.rootId,
      }),
    ]);
    expect([addedA.outcome, addedB.outcome].sort()).toEqual(["applied", "applied"]);
    const addedAgain = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "link-a", baseRevision: "0", intent: "assert", targetKind: "GraphLink",
      nodeId: "link-a", sourceNodeId: left, targetNodeId: model.state.rootId,
    });
    expect(addedAgain.outcome).toBe("ignored");
    expect((await RapidMvpModel.loadFromNeo4j(current, mapId)).state.links?.["link-a"]).toMatchObject({
      sourceNodeId: left, targetNodeId: right,
    });
    const staleDelete = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "delete-link-b", baseRevision: "0",
      intent: "delete", targetKind: "GraphLink", nodeId: "link-b",
    });
    expect(staleDelete.outcome).toBe("rejected");
    expect(await current.hasAppliedCommand(mapId, "delete-link-b")).toBe(false);
    const removed = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "delete-link-b",
      baseRevision: addedB.outcome === "applied" ? addedB.revision : "1",
      intent: "delete", targetKind: "GraphLink", nodeId: "link-b",
    });
    expect(removed.outcome).toBe("applied");
    expect((await RapidMvpModel.loadFromNeo4j(current, mapId)).state.links?.["link-b"]).toBeUndefined();
    await current.saveMap({
      ...ADDRESS, mapId, state: staleModel.toJSON(), nodeBases: staleModel.nodeBases, actorAccountId,
    });
    const kept = await RapidMvpModel.loadFromNeo4j(current, mapId);
    expect(kept.state.nodes[model.state.rootId]!.children).toEqual([right, left]);
    expect(kept.state.links?.[linkId]).toMatchObject({ sourceNodeId: right, targetNodeId: left });
  }, 60000);

  it("採否を通った undo だけが text を戻し、古い revision は戻さない", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("Root");
    const alpha = model.addNode(model.state.rootId, "Alpha");
    const mapId = "swarm-undo";
    await model.saveToNeo4j(current, { ...ADDRESS, mapId });
    await model.editNodeTextInNeo4j(current, mapId, alpha, "Alpha edited", undefined, {
      actorAccountId: ADDRESS.accountId,
      commandId: "edit-alpha",
      baseRevision: "0",
    });
    expect(await model.undoRecordedEdit(mapId)).toBe(true);
    expect(model.state.nodes[alpha]!.text).toBe("Alpha");
    expect((await current.readNodeClaim(mapId, alpha))?.text).toBe("Alpha");
    await model.editNodeTextInNeo4j(current, mapId, alpha, "Alpha again", undefined, {
      actorAccountId: ADDRESS.accountId,
      commandId: "edit-alpha-2",
      baseRevision: model.nodeBases[alpha] ?? "0",
    });
    const other = await RapidMvpModel.loadFromNeo4j(current, mapId);
    await other.editNodeTextInNeo4j(current, mapId, alpha, "Alpha other", undefined, {
      actorAccountId: ADDRESS.accountId,
      commandId: "edit-alpha-other",
      baseRevision: other.nodeBases[alpha] ?? "0",
    });
    expect(await model.undoRecordedEdit(mapId)).toBe(false);
    expect((await current.readNodeClaim(mapId, alpha))?.text).toBe("Alpha other");
    expect(model.state.nodes[alpha]!.text).toBe("Alpha again");
  }, 60000);

  it("注釈、線形テキスト、link の label と属性、details と note、surface 配置は古い revision を戻さない", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("Root");
    const left = model.addNode(model.state.rootId, "Left");
    const right = model.addNode(model.state.rootId, "Right");
    const linkId = model.addLink(left, right, { label: "sees" });
    const scopeId = `scope:${model.state.rootId}`;
    const mapId = "swarm-rest";
    await model.saveToNeo4j(current, { ...ADDRESS, mapId });
    const before = await RapidMvpModel.loadFromNeo4j(current, mapId);
    const actorAccountId = ADDRESS.accountId;
    const details = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "details-1", baseRevision: "0",
      intent: "set-attribute", nodeId: left, attrKey: "details", attrValue: "d1",
    });
    const note = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "note-1", baseRevision: "0",
      intent: "set-attribute", nodeId: left, attrKey: "note", attrValue: "n1",
    });
    const label = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "label-1", baseRevision: "0",
      intent: "set-attribute", targetKind: "GraphLink", nodeId: linkId, attrKey: "label", attrValue: "lab",
    });
    const weight = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "weight-stale", baseRevision: "0",
      intent: "set-attribute", targetKind: "GraphLink", nodeId: linkId, attrKey: "weight", attrValue: "9",
    });
    const annotation = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "ann-1", baseRevision: "0",
      intent: "assert", targetKind: "annotation", nodeId: "ann-1", scopeId, text: "ann",
    });
    const linear = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "lin-1", baseRevision: "0",
      intent: "assert", targetKind: "linear", nodeId: scopeId, scopeId, text: "lin",
    });
    const place = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "place-1", baseRevision: "0",
      intent: "set-attribute", targetKind: "surface", nodeId: "surface-main", scopeId,
      attrKey: left, attrValue: "3,4",
    });
    expect([details, note, label, annotation, linear, place].map((item) => item.outcome)).toEqual([
      "applied", "applied", "applied", "applied", "applied", "applied",
    ]);
    expect(weight.outcome).toBe("rejected");
    if (weight.outcome === "rejected") expect(weight.reason).toBe("stale-revision");
    expect(await current.hasAppliedCommand(mapId, "weight-stale")).toBe(false);
    const keptWeight = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "weight-1",
      baseRevision: label.outcome === "applied" ? label.revision : "1",
      intent: "set-attribute", targetKind: "GraphLink", nodeId: linkId, attrKey: "weight", attrValue: "2",
    });
    expect(keptWeight.outcome).toBe("applied");
    const staleDetails = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "details-stale", baseRevision: "0",
      intent: "set-attribute", nodeId: left, attrKey: "details", attrValue: "old",
    });
    expect(staleDetails.outcome).toBe("rejected");
    expect(await current.hasAppliedCommand(mapId, "details-stale")).toBe(false);
    const renamed = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "text-live", baseRevision: "0",
      intent: "rename", nodeId: left, text: "Left live",
    });
    expect(renamed.outcome).toBe("applied");
    await current.saveMap({
      ...ADDRESS, mapId, state: before.toJSON(), nodeBases: before.nodeBases, actorAccountId,
    });
    const loaded = await RapidMvpModel.loadFromNeo4j(current, mapId);
    expect(loaded.state.nodes[left]!.details).toBe("d1");
    expect(loaded.state.nodes[left]!.note).toBe("n1");
    expect(loaded.state.links?.[linkId]?.label).toBe("lab");
    expect(loaded.state.links?.[linkId]?.attributes).toEqual({ weight: "2" });
    expect(loaded.state.annotations?.["ann-1"]).toMatchObject({ text: "ann" });
    expect(loaded.state.linearNotesByScope?.[scopeId]).toBe("lin");
    expect(loaded.state.surfaces?.["surface-main"]?.nodeViews?.[left]).toMatchObject({ x: 3, y: 4 });
    const original = before.toJSON();
    await current.saveMap({ ...ADDRESS, mapId, state: original, nodeBases: before.nodeBases, actorAccountId });
    const again = await RapidMvpModel.loadFromNeo4j(current, mapId);
    expect(again.state.nodes[left]!.text).toBe("Left live");
    expect(again.state.nodes[left]!.details).toBe("d1");
    expect(Object.keys(again.state.nodes)).toEqual(Object.keys(loaded.state.nodes));
  }, 60000);

  it("collapsed、link、type は古い revision を戻さず、競合した一括作成は先の node を消さない", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("Root");
    const child = model.addNode(model.state.rootId, "Child");
    const mapId = "swarm-scalars";
    await model.saveToNeo4j(current, { ...ADDRESS, mapId });
    const before = await RapidMvpModel.loadFromNeo4j(current, mapId);
    const actorAccountId = ADDRESS.accountId;
    const collapsed = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "collapsed-1", baseRevision: "0",
      intent: "set-attribute", nodeId: child, attrKey: "collapsed", attrValue: "true",
    });
    const link = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "link-1", baseRevision: "0",
      intent: "set-attribute", nodeId: child, attrKey: "link", attrValue: "u1",
    });
    const typed = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "type-1", baseRevision: "0",
      intent: "set-attribute", nodeId: child, attrKey: "type", attrValue: "kind-a",
    });
    const nodeType = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "nodetype-1", baseRevision: "0",
      intent: "set-attribute", nodeId: child, attrKey: "nodeType", attrValue: "folder",
    });
    expect([collapsed, link, typed, nodeType].map((item) => item.outcome)).toEqual(["applied", "applied", "applied", "applied"]);
    const stale = await current.submitNodeCommand({
      mapId, actorAccountId, commandId: "collapsed-stale", baseRevision: "0",
      intent: "set-attribute", nodeId: child, attrKey: "collapsed", attrValue: "false",
    });
    expect(stale.outcome).toBe("rejected");
    if (stale.outcome === "rejected") expect(stale.reason).toBe("stale-revision");
    expect(await current.hasAppliedCommand(mapId, "collapsed-stale")).toBe(false);
    await current.saveMap({
      ...ADDRESS, mapId, state: before.toJSON(), nodeBases: before.nodeBases, actorAccountId,
    });
    const loaded = await RapidMvpModel.loadFromNeo4j(current, mapId);
    expect(loaded.state.nodes[child]!.collapsed).toBe(true);
    expect(loaded.state.nodes[child]!.link).toBe("u1");
    expect(loaded.state.nodes[child]!.nodeType).toBe("folder");
    expect((loaded.state.nodes[child] as { type?: string }).type).toBe("kind-a");

    const raceId = "swarm-race-create";
    const first = new RapidMvpModel("Root");
    const alpha = first.addNode(first.state.rootId, "Alpha");
    const second = new RapidMvpModel("Root");
    const beta = second.addNode(second.state.rootId, "Beta");
    await Promise.all([
      first.saveToNeo4j(current, { ...ADDRESS, mapId: raceId }),
      second.saveToNeo4j(current, { ...ADDRESS, mapId: raceId }),
    ]);
    const raced = await current.loadMap(raceId);
    const ids = new Set(Object.keys(raced.state.nodes));
    const firstKept = Object.keys(first.state.nodes).every((id) => ids.has(id));
    const secondKept = Object.keys(second.state.nodes).every((id) => ids.has(id));
    expect(firstKept || secondKept).toBe(true);
    const winnerChild = firstKept ? alpha : beta;
    expect(raced.state.nodes[winnerChild]!.text).toBe(firstKept ? "Alpha" : "Beta");

    const heldId = "swarm-later-create";
    const held = new RapidMvpModel("Root");
    const keptNode = held.addNode(held.state.rootId, "Kept");
    await held.saveToNeo4j(current, { ...ADDRESS, mapId: heldId });
    await current.submitNodeCommand({
      mapId: heldId, actorAccountId, commandId: "kept-text", baseRevision: "0",
      intent: "rename", nodeId: keptNode, text: "Kept live",
    });
    const later = new RapidMvpModel("Root");
    later.addNode(later.state.rootId, "Later");
    await later.saveToNeo4j(current, { ...ADDRESS, mapId: heldId });
    const afterLater = await current.loadMap(heldId);
    expect(afterLater.state.nodes[keptNode]!.text).toBe("Kept live");
    expect(afterLater.state.nodes[held.state.rootId]).toBeTruthy();
  }, 60000);

  it("退避で落ちた項目と mindmap は保存して読み戻る", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("r");
    const child = model.addNode(model.state.rootId, "c");
    const state = JSON.parse(JSON.stringify(model.toJSON())) as AppState & Record<string, unknown>;
    state.savedAt = "2026-01-02T00:00:00.000Z";
    state.exportedAt = "2026-01-03T00:00:00.000Z";
    state.sourceDb = "src";
    state.sourceDocSavedAt = "2026-01-04T00:00:00.000Z";
    state.scopeId = "scope-doc";
    state.selectedId = child;
    const node = state.nodes[child] as TreeNode & Record<string, unknown>;
    node.aliasOf = "alias-1";
    node.createdAt = "2026-01-05T00:00:00.000Z";
    node.notes = "n-1";
    node.updatedAt = "2026-01-06T00:00:00.000Z";
    state.surfaces = {
      surf: { id: "surf", scopeId: `scope:${state.rootId}`, kind: "mindmap", layout: "mindmap" },
    };
    const mapId = "swarm-carried";
    await current.saveMap({ ...ADDRESS, mapId, state: state as AppState });
    const loaded = await current.loadMap(mapId);
    const back = loaded.state as AppState & Record<string, unknown>;
    expect(back.savedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(back.exportedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(back.sourceDb).toBe("src");
    expect(back.sourceDocSavedAt).toBe("2026-01-04T00:00:00.000Z");
    expect(back.scopeId).toBe("scope-doc");
    expect(back.selectedId).toBeUndefined();
    const backNode = back.nodes[child] as TreeNode & Record<string, unknown>;
    expect(backNode.aliasOf).toBe("alias-1");
    expect(backNode.createdAt).toBe("2026-01-05T00:00:00.000Z");
    expect(backNode.notes).toBe("n-1");
    expect(backNode.updatedAt).toBe("2026-01-06T00:00:00.000Z");
    expect(back.surfaces && (back.surfaces as Record<string, { kind?: string; layout?: string }>).surf?.kind).toBe("mindmap");
    expect(back.surfaces && (back.surfaces as Record<string, { kind?: string; layout?: string }>).surf?.layout).toBe("mindmap");
    const driver = neo4j.driver(URI);
    const session = driver.session({ database: NEO4J_TEST_DATABASE });
    try {
      const selected = await session.run(
        "MATCH (m:Map {id: $id}) RETURN m.sessionSelectedId AS selectedId",
        { id: mapId },
      );
      expect(selected.records[0]?.get("selectedId")).toBe(child);
    } finally {
      await session.close();
      await driver.close();
    }

    const empty = JSON.parse(JSON.stringify(model.toJSON())) as AppState & Record<string, unknown>;
    empty.savedAt = null;
    await current.saveMap({ ...ADDRESS, mapId: "swarm-carried-null", state: empty as AppState });
    const nullLoaded = await current.loadMap("swarm-carried-null");
    expect((nullLoaded.state as AppState & { savedAt?: string | null }).savedAt).toBeNull();
    expect((nullLoaded.state as AppState & { selectedId?: string }).selectedId).toBeUndefined();
  }, 60000);

  it("退避項目は commandId と revision で採否し、古い全体保存は先の値を戻さない", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("r");
    const child = model.addNode(model.state.rootId, "c");
    const state = JSON.parse(JSON.stringify(model.toJSON())) as AppState & Record<string, unknown>;
    state.savedAt = "2026-01-02T00:00:00.000Z";
    state.exportedAt = "2026-01-03T00:00:00.000Z";
    state.sourceDb = "src-a";
    state.sourceDocSavedAt = "2026-01-04T00:00:00.000Z";
    state.scopeId = "scope-doc-a";
    const node = state.nodes[child] as TreeNode & Record<string, unknown>;
    node.aliasOf = "alias-1";
    node.createdAt = "2026-01-05T00:00:00.000Z";
    node.notes = "n-1";
    node.updatedAt = "2026-01-06T00:00:00.000Z";
    const mapId = "swarm-carry-gate";
    await current.saveMap({ ...ADDRESS, mapId, state: state as AppState });
    const opened = await current.loadMap(mapId);
    const bases = await current.readNodeRevisions(mapId);
    const live = JSON.parse(JSON.stringify(opened.state)) as AppState & Record<string, unknown>;
    live.savedAt = "2026-02-02T00:00:00.000Z";
    live.exportedAt = "2026-02-03T00:00:00.000Z";
    live.sourceDb = "src-b";
    live.sourceDocSavedAt = "2026-02-04T00:00:00.000Z";
    live.scopeId = "scope-doc-b";
    const liveNode = live.nodes[child] as TreeNode & Record<string, unknown>;
    liveNode.aliasOf = "alias-2";
    liveNode.createdAt = "2026-02-05T00:00:00.000Z";
    liveNode.notes = "n-2";
    liveNode.updatedAt = "2026-02-06T00:00:00.000Z";
    await current.saveMap({ ...ADDRESS, mapId, state: live as AppState, nodeBases: bases });
    await current.saveMap({ ...ADDRESS, mapId, state: opened.state, nodeBases: bases });
    const kept = await current.loadMap(mapId);
    const keptState = kept.state as AppState & Record<string, string>;
    const keptNode = kept.state.nodes[child] as TreeNode & Record<string, string>;
    expect(keptState.savedAt).toBe("2026-02-02T00:00:00.000Z");
    expect(keptState.exportedAt).toBe("2026-02-03T00:00:00.000Z");
    expect(keptState.sourceDb).toBe("src-b");
    expect(keptState.sourceDocSavedAt).toBe("2026-02-04T00:00:00.000Z");
    expect(keptState.scopeId).toBe("scope-doc-b");
    expect(keptNode.aliasOf).toBe("alias-2");
    expect(keptNode.createdAt).toBe("2026-02-05T00:00:00.000Z");
    expect(keptNode.notes).toBe("n-2");
    expect(keptNode.updatedAt).toBe("2026-02-06T00:00:00.000Z");
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("aliasOf", child, "0", "alias-1"))).toBe(false);
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("savedAt", opened.state.rootId, "0", "2026-01-02T00:00:00.000Z"))).toBe(false);
  }, 60000);

  it("link の向き、注釈の中身と削除、surface と scope は古い全体保存で生きている値を消さない", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("r");
    const child = model.addNode(model.state.rootId, "c");
    const state = JSON.parse(JSON.stringify(model.toJSON())) as AppState;
    const scopeKey = `scope:${state.rootId}`;
    state.links = {
      L: {
        id: "L", sourceNodeId: state.rootId, targetNodeId: child,
        direction: "forward", style: "dashed", color: "#111", sourcePort: "left", targetPort: "right", relationType: "rel-a",
      },
    };
    state.annotations = {
      ann: { id: "ann", kind: "text", scopeId: scopeKey, text: "ann", x: 1, y: 2, fill: "fill-a", fontSize: 12 },
    };
    state.scopes = {
      [scopeKey]: { id: scopeKey, label: "label-a", rootNodeIds: [state.rootId], relationIds: ["rel-a"] },
    };
    state.surfaces = {
      surf: {
        id: "surf", scopeId: scopeKey, kind: "mindmap", layout: "mindmap",
        surfaceView: { direction: "left", space: "tight" },
        nodeViews: { [child]: { x: 1, y: 2, flowCol: 3, flowRow: 4, shape: "diamond" } },
      },
    };
    const mapId = "swarm-chrome-gate";
    await current.saveMap({ ...ADDRESS, mapId, state });
    const opened = await current.loadMap(mapId);
    const bases = await current.readNodeRevisions(mapId);
    const live = JSON.parse(JSON.stringify(opened.state)) as AppState;
    const link = live.links?.L;
    if (!link) throw new Error("missing link");
    link.direction = "backward";
    link.style = "soft";
    link.color = "#222";
    link.sourcePort = "top";
    link.targetPort = "bottom";
    link.relationType = "rel-b";
    const annotation = live.annotations?.ann;
    if (!annotation || annotation.kind !== "text") throw new Error("missing annotation");
    annotation.fill = "fill-b";
    annotation.fontSize = 20;
    const scope = live.scopes?.[scopeKey];
    if (!scope) throw new Error("missing scope");
    scope.label = "label-b";
    scope.rootNodeIds = [child];
    scope.relationIds = ["rel-b"];
    const surface = live.surfaces?.surf;
    if (!surface) throw new Error("missing surface");
    surface.kind = "system";
    surface.layout = "flow-lr";
    surface.surfaceView = { direction: "right", space: "normal" };
    surface.nodeViews = { [child]: { x: 1, y: 2, flowCol: 9, flowRow: 8, shape: "rect" } };
    await current.saveMap({ ...ADDRESS, mapId, state: live, nodeBases: bases });
    const dropping = JSON.parse(JSON.stringify(live)) as AppState;
    delete dropping.annotations?.ann;
    await current.saveMap({ ...ADDRESS, mapId, state: opened.state, nodeBases: bases });
    await current.saveMap({ ...ADDRESS, mapId, state: dropping, nodeBases: bases });
    const kept = await current.loadMap(mapId);
    expect(kept.state.links?.L).toMatchObject({
      direction: "backward", style: "soft", color: "#222", sourcePort: "top", targetPort: "bottom", relationType: "rel-b",
    });
    expect(kept.state.annotations?.ann).toMatchObject({ text: "ann", fill: "fill-b", fontSize: 20 });
    expect(kept.state.scopes?.[scopeKey]).toMatchObject({ label: "label-b", rootNodeIds: [child], relationIds: ["rel-b"] });
    expect(kept.state.surfaces?.surf).toMatchObject({
      kind: "system", layout: "flow-lr", surfaceView: { direction: "right", space: "normal" },
    });
    expect(kept.state.surfaces?.surf?.nodeViews?.[child]).toMatchObject({ flowCol: 9, flowRow: 8, shape: "rect" });
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("direction", "L", "0", "forward"))).toBe(false);
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("annotation-delete", "ann", "0", ""))).toBe(false);
  }, 60000);

  it("pen の stroke と注釈の位置、fontWeight、variant、scopeId、createdAt は古い revision で消えない", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("r");
    model.addNode(model.state.rootId, "c");
    const state = JSON.parse(JSON.stringify(model.toJSON())) as AppState;
    const scopeKey = `scope:${state.rootId}`;
    state.annotations = {
      pen: {
        id: "pen", kind: "pen", scopeId: scopeKey, createdAt: "2026-03-01T00:00:00.000Z",
        d: "M0 0", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], stroke: "#111", strokeWidth: 2, opacity: 0.4,
      },
      tx: {
        id: "tx", kind: "text", text: "ann", x: 10, y: 20, fill: "fill-a", fontSize: 14,
        fontWeight: 400, variant: "label", scopeId: scopeKey, createdAt: "2026-03-02T00:00:00.000Z",
      },
    };
    const mapId = "swarm-ann-fields";
    await current.saveMap({ ...ADDRESS, mapId, state });
    const opened = await current.loadMap(mapId);
    expect(opened.state.annotations?.pen).toMatchObject({
      d: "M0 0", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], stroke: "#111", strokeWidth: 2, opacity: 0.4,
      scopeId: scopeKey, createdAt: "2026-03-01T00:00:00.000Z",
    });
    expect(opened.state.annotations?.tx).toMatchObject({
      x: 10, y: 20, fontWeight: 400, variant: "label", scopeId: scopeKey, createdAt: "2026-03-02T00:00:00.000Z",
    });
    const bases = await current.readNodeRevisions(mapId);
    const live = JSON.parse(JSON.stringify(opened.state)) as AppState;
    const pen = live.annotations?.pen;
    const text = live.annotations?.tx;
    if (!pen || pen.kind !== "pen" || !text || text.kind !== "text") throw new Error("missing annotation");
    pen.d = "M9 9";
    pen.points = [{ x: 5, y: 6 }];
    pen.stroke = "#222";
    pen.strokeWidth = 5;
    pen.opacity = 0.8;
    pen.createdAt = "2026-04-01T00:00:00.000Z";
    text.x = 11;
    text.y = 21;
    text.fontWeight = 700;
    text.variant = "date";
    text.createdAt = "2026-04-02T00:00:00.000Z";
    const accepted = await current.saveMap({ ...ADDRESS, mapId, state: live, nodeBases: bases });
    expect(accepted.commands.filter((command) => command.outcome === "applied").length).toBeGreaterThan(0);
    const stale = await current.saveMap({ ...ADDRESS, mapId, state: opened.state, nodeBases: bases });
    const staleAnn = stale.commands.filter((command) => command.nodeId === "pen" || command.nodeId === "tx");
    expect(staleAnn.map((command) => command.outcome)).toEqual(["rejected", "rejected"]);
    for (const command of staleAnn) {
      if (command.outcome === "rejected") expect(command.reason).toBe("stale-revision");
    }
    const kept = await current.loadMap(mapId);
    expect(kept.state.annotations?.pen).toMatchObject({
      d: "M9 9", points: [{ x: 5, y: 6 }], stroke: "#222", strokeWidth: 5, opacity: 0.8,
      scopeId: scopeKey, createdAt: "2026-04-01T00:00:00.000Z",
    });
    expect(kept.state.annotations?.tx).toMatchObject({
      x: 11, y: 21, fontWeight: 700, variant: "date", scopeId: scopeKey, createdAt: "2026-04-02T00:00:00.000Z",
    });
    const openedPen = opened.state.annotations?.pen;
    const openedText = opened.state.annotations?.tx;
    if (!openedPen || !openedText) throw new Error("missing opened annotation");
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("annotation-body", "pen", "0", annotationToken(openedPen)))).toBe(false);
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("annotation-body", "tx", "0", annotationToken(openedText)))).toBe(false);
  }, 60000);

  it("node.scopeId と scope の primarySurfaceId は再保存でも revision で採否する", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("r");
    const child = model.addNode(model.state.rootId, "c");
    const state = JSON.parse(JSON.stringify(model.toJSON())) as AppState;
    const scopeKey = `scope:${state.rootId}`;
    state.nodes[child]!.scopeId = scopeKey;
    state.scopes = {
      [scopeKey]: { id: scopeKey, label: "label-a", rootNodeIds: [state.rootId], relationIds: [], primarySurfaceId: "surf-a" },
    };
    const mapId = "swarm-scope-resave";
    await current.saveMap({ ...ADDRESS, mapId, state });
    const opened = await current.loadMap(mapId);
    expect(opened.state.nodes[child]?.scopeId).toBe(scopeKey);
    expect(opened.state.scopes?.[scopeKey]?.primarySurfaceId).toBe("surf-a");
    const bases = await current.readNodeRevisions(mapId);
    const live = JSON.parse(JSON.stringify(opened.state)) as AppState;
    live.nodes[child]!.scopeId = "scope-node-b";
    const liveScope = live.scopes?.[scopeKey];
    if (!liveScope) throw new Error("missing scope");
    liveScope.primarySurfaceId = "surf-b";
    const accepted = await current.saveMap({ ...ADDRESS, mapId, state: live, nodeBases: bases });
    expect(accepted.commands.filter((command) => command.outcome === "applied").map((command) => command.nodeId)).toEqual(expect.arrayContaining([child, scopeKey]));
    const stale = await current.saveMap({ ...ADDRESS, mapId, state: opened.state, nodeBases: bases });
    const staleScope = stale.commands.filter((command) => command.nodeId === child || command.nodeId === scopeKey);
    expect(staleScope.length).toBeGreaterThan(0);
    for (const command of staleScope) {
      expect(command.outcome).toBe("rejected");
      if (command.outcome === "rejected") expect(command.reason).toBe("stale-revision");
    }
    const kept = await current.loadMap(mapId);
    expect(kept.state.nodes[child]?.scopeId).toBe("scope-node-b");
    expect(kept.state.scopes?.[scopeKey]?.primarySurfaceId).toBe("surf-b");
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("scopeId", child, "0", scopeKey))).toBe(false);
    expect(await current.hasAppliedCommand(mapId, swarmSaveCommandId("primarySurfaceId", scopeKey, "0", "surf-a"))).toBe(false);
  }, 60000);

  it("派生と同じ node.scopeId を読み戻す", async () => {
    const current = requireStore();
    const model = new RapidMvpModel("r");
    const child = model.addNode(model.state.rootId, "c");
    const state = JSON.parse(JSON.stringify(model.toJSON())) as AppState;
    const scopeId = `scope:${state.rootId}`;
    state.nodes[child]!.scopeId = scopeId;
    const mapId = "swarm-explicit-scope";
    await current.saveMap({ ...ADDRESS, mapId, state });
    const loaded = await current.loadMap(mapId);
    expect(loaded.state.nodes[child]?.scopeId).toBe(scopeId);
  }, 60000);

  it("退避の 8 map だけを一時 Neo4j に取り込む", async () => {
    const current = requireStore();
    const root = "/Users/akaghef/Backups/M3E/261111-pre-neo4j/m3e/workspaces";
    const maps: Array<[string, string]> = [
      ["ws_A98E70JM9GAXCVXVMQBW7N0YGZ", "map_10226A7F0MEKDVNMEXC7HH4GNV"],
      ["ws_A98E70JM9GAXCVXVMQBW7N0YGZ", "map_1782530973015_o4urek"],
      ["ws_REMH1Z5TFA7S93R3HA0XK58JNR", "alglibmove"],
      ["ws_REMH1Z5TFA7S93R3HA0XK58JNR", "map_1776759461174_2jkvil"],
      ["ws_REMH1Z5TFA7S93R3HA0XK58JNR", "codex-pn-verify-5"],
      ["ws_REMH1Z5TFA7S93R3HA0XK58JNR", "BIO-RF1-ANIMALS-EXPAND-001-live"],
      ["ws_team_swingby", "map_team_swingby_monthly_2604"],
      ["ws_team_swingby", "map_1780820992756_uycajc"],
    ];
    const failures: Array<{ id: string; name: string }> = [];
    const scratch = fs.mkdtempSync(path.join("/tmp", "m3e-backup-read-"));
    const copies = new Map<string, string>();
    try {
      for (const [workspaceId, mapId] of maps) {
        const dbPath = path.join(root, workspaceId, "data.sqlite");
        let db: Database.Database | undefined;
        try {
          let copyPath = copies.get(workspaceId);
          if (!copyPath) {
            copyPath = path.join(scratch, `${workspaceId}.sqlite`);
            fs.copyFileSync(dbPath, copyPath);
            copies.set(workspaceId, copyPath);
          }
          db = new Database(copyPath, { readonly: true, fileMustExist: true });
          const row = db.prepare("SELECT state_json FROM maps WHERE id = ?").get(mapId) as { state_json: string } | undefined;
          if (!row) {
            failures.push({ id: mapId, name: "MissingMap" });
            continue;
          }
          const state = JSON.parse(row.state_json) as AppState;
          await current.saveMap({ workspaceId, accountId: "acct-backup-reimport", mapId, state });
          const loaded = await current.loadMap(mapId);
          if (!loaded.state.nodes[loaded.state.rootId]) failures.push({ id: mapId, name: "MissingRoot" });
        } catch (error) {
          failures.push({ id: mapId, name: error instanceof Error ? error.name : "Unknown" });
        } finally {
          db?.close();
        }
      }
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    expect(failures).toEqual([]);
  }, 360000);
});
