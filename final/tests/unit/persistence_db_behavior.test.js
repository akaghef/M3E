import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeTempPath(...segments) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-db-test-"));
  return { base, filePath: path.join(base, ...segments) };
}

test("saveToFile creates missing directories and writes versioned map", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  model.addNode(rootId, "Child");

  const { base, filePath } = makeTempPath("nested", "deep", "map.json");

  model.saveToFile(filePath);

  expect(fs.existsSync(filePath)).toBe(true);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  expect(parsed.version).toBe(1);
  expect(typeof parsed.savedAt).toBe("string");
  expect(parsed.state).toEqual(model.toJSON());

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects unsupported version", () => {
  const { base, filePath } = makeTempPath("bad-version.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify({ version: 999, savedAt: new Date().toISOString(), state: {} }),
    "utf8",
  );

  expect(() => RapidMvpModel.loadFromFile(filePath)).toThrow(
    "Unsupported or invalid save format.",
  );

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects when state is missing", () => {
  const { base, filePath } = makeTempPath("missing-state.json");
  fs.writeFileSync(filePath, JSON.stringify({ version: 1 }), "utf8");

  expect(() => RapidMvpModel.loadFromFile(filePath)).toThrow(
    "Unsupported or invalid save format.",
  );

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects structurally invalid graph", () => {
  const invalidState = {
    rootId: "root",
    selectedId: "root",
    nodes: {
      root: {
        id: "root",
        parentId: null,
        children: ["ghost"],
        text: "Root",
        collapsed: false,
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
    },
  };

  const { base, filePath } = makeTempPath("invalid-graph.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: invalidState }),
    "utf8",
  );

  expect(() => RapidMvpModel.loadFromFile(filePath)).toThrow(/Invalid model after load:/);

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects malformed JSON", () => {
  const { base, filePath } = makeTempPath("malformed.json");
  fs.writeFileSync(filePath, "{ this is not valid json", "utf8");

  expect(() => RapidMvpModel.loadFromFile(filePath)).toThrow();

  fs.rmSync(base, { recursive: true, force: true });
});

test("saveToSqlite and loadFromSqlite round-trip", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const child = model.addNode(rootId, "Child");
  const sibling = model.addNode(rootId, "Sibling");
  model.editNode(child, "Child Updated");
  model.addAlias(rootId, child, { aliasLabel: "Child Alias", access: "write" });
  model.addLink(child, sibling, { direction: "forward", style: "soft" });
  model.state.linearNotesByScope = {
    [rootId]: "Root memo",
    [child]: "Child memo",
  };

  const { base, filePath } = makeTempPath("nested", "rapid.sqlite");
  model.saveToSqlite(filePath, "map-a");

  const loaded = RapidMvpModel.loadFromSqlite(filePath, "map-a");
  expect(loaded.toJSON()).toEqual(model.toJSON());

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects graph link with missing endpoint", () => {
  const invalidState = {
    rootId: "root",
    nodes: {
      root: {
        id: "root",
        parentId: null,
        children: [],
        nodeType: "text",
        text: "Root",
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
    },
    links: {
      "link-1": {
        id: "link-1",
        sourceNodeId: "root",
        targetNodeId: "ghost",
      },
    },
  };

  const { base, filePath } = makeTempPath("invalid-link.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: invalidState }),
    "utf8",
  );

  expect(() => RapidMvpModel.loadFromFile(filePath)).toThrow(/missing target node/);

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile accepts broken alias with snapshot label", () => {
  const brokenState = {
    rootId: "root",
    nodes: {
      root: {
        id: "root",
        parentId: null,
        children: ["alias-1"],
        nodeType: "text",
        text: "Root",
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
      "alias-1": {
        id: "alias-1",
        parentId: "root",
        children: [],
        nodeType: "alias",
        text: "Lost Node (deleted)",
        details: "",
        note: "",
        attributes: {},
        link: "",
        targetNodeId: "missing-node",
        access: "read",
        targetSnapshotLabel: "Lost Node",
        isBroken: true,
      },
    },
  };

  const { base, filePath } = makeTempPath("broken-alias.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: brokenState }),
    "utf8",
  );

  const loaded = RapidMvpModel.loadFromFile(filePath);
  expect(loaded.state.nodes["alias-1"].isBroken).toBe(true);
  expect(loaded.state.nodes["alias-1"].targetSnapshotLabel).toBe("Lost Node");

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromSqlite rejects unsupported version", () => {
  const { base, filePath } = makeTempPath("unsupported.sqlite");
  const db = new Database(filePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    )
  `);
  db.prepare(
    "INSERT INTO maps (id, version, saved_at, state_json) VALUES (?, ?, ?, ?)",
  ).run("map-bad", 2, new Date().toISOString(), JSON.stringify({}));
  db.close();

  expect(() => RapidMvpModel.loadFromSqlite(filePath, "map-bad")).toThrow(
    "Unsupported or invalid save format.",
  );

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromSqlite rejects invalid graph state", () => {
  const { base, filePath } = makeTempPath("invalid.sqlite");
  const invalidState = {
    rootId: "root",
    selectedId: "root",
    nodes: {
      root: {
        id: "root",
        parentId: null,
        children: ["ghost"],
        text: "Root",
        collapsed: false,
        details: "",
        note: "",
        attributes: {},
        link: "",
      },
    },
  };

  const db = new Database(filePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    )
  `);
  db.prepare(
    "INSERT INTO maps (id, version, saved_at, state_json) VALUES (?, ?, ?, ?)",
  ).run("map-invalid", 1, new Date().toISOString(), JSON.stringify(invalidState));
  db.close();

  expect(() => RapidMvpModel.loadFromSqlite(filePath, "map-invalid")).toThrow(/Invalid model after load:/);

  fs.rmSync(base, { recursive: true, force: true });
});
