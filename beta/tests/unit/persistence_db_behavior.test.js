const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function makeTempPath(...segments) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-db-test-"));
  return { base, filePath: path.join(base, ...segments) };
}

test("saveToFile creates missing directories and writes versioned document", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  model.addNode(rootId, "Child");

  const { base, filePath } = makeTempPath("nested", "deep", "doc.json");

  model.saveToFile(filePath);

  assert.equal(fs.existsSync(filePath), true);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  assert.equal(parsed.version, 1);
  assert.equal(typeof parsed.savedAt, "string");
  assert.deepEqual(parsed.state, model.toJSON());

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects unsupported version", () => {
  const { base, filePath } = makeTempPath("bad-version.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify({ version: 999, savedAt: new Date().toISOString(), state: {} }),
    "utf8",
  );

  assert.throws(() => RapidMvpModel.loadFromFile(filePath), {
    message: "Unsupported or invalid save format.",
  });

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects when state is missing", () => {
  const { base, filePath } = makeTempPath("missing-state.json");
  fs.writeFileSync(filePath, JSON.stringify({ version: 1 }), "utf8");

  assert.throws(() => RapidMvpModel.loadFromFile(filePath), {
    message: "Unsupported or invalid save format.",
  });

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

  assert.throws(() => RapidMvpModel.loadFromFile(filePath), /Invalid model after load:/);

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromFile rejects malformed JSON", () => {
  const { base, filePath } = makeTempPath("malformed.json");
  fs.writeFileSync(filePath, "{ this is not valid json", "utf8");

  assert.throws(() => RapidMvpModel.loadFromFile(filePath), SyntaxError);

  fs.rmSync(base, { recursive: true, force: true });
});

test("saveToSqlite and loadFromSqlite round-trip", () => {
  const model = new RapidMvpModel("Root");
  const rootId = model.state.rootId;
  const child = model.addNode(rootId, "Child");
  model.editNode(child, "Child Updated");

  const { base, filePath } = makeTempPath("nested", "rapid.sqlite");
  model.saveToSqlite(filePath, "doc-a");

  const loaded = RapidMvpModel.loadFromSqlite(filePath, "doc-a");
  assert.deepEqual(loaded.toJSON(), model.toJSON());

  fs.rmSync(base, { recursive: true, force: true });
});

test("loadFromSqlite rejects unsupported version", () => {
  const { base, filePath } = makeTempPath("unsupported.sqlite");
  const db = new Database(filePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    )
  `);
  db.prepare(
    "INSERT INTO documents (id, version, saved_at, state_json) VALUES (?, ?, ?, ?)",
  ).run("doc-bad", 2, new Date().toISOString(), JSON.stringify({}));
  db.close();

  assert.throws(() => RapidMvpModel.loadFromSqlite(filePath, "doc-bad"), {
    message: "Unsupported or invalid save format.",
  });

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
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    )
  `);
  db.prepare(
    "INSERT INTO documents (id, version, saved_at, state_json) VALUES (?, ?, ?, ?)",
  ).run("doc-invalid", 1, new Date().toISOString(), JSON.stringify(invalidState));
  db.close();

  assert.throws(() => RapidMvpModel.loadFromSqlite(filePath, "doc-invalid"), /Invalid model after load:/);

  fs.rmSync(base, { recursive: true, force: true });
});
