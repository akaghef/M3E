import { test, expect, beforeAll, afterAll } from "vitest";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-local-fs-data-"));
process.env.M3E_DATA_DIR = tempDataDir;

const { createAppServer } = require("../../dist/node/start_viewer.js");

let server;
let baseUrl;
let rootDir;

async function request(url) {
  const response = await fetch(url);
  const text = await response.text();
  let payload = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { _raw: text };
    }
  }
  return { response, payload };
}

function localFsUrl(action, params) {
  const url = new URL(`${baseUrl}/api/local-fs/${action}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

beforeAll(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-local-fs-root-"));
  fs.mkdirSync(path.join(rootDir, "01_Vision"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "03_Spec"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, ".git"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "node_modules", "pkg"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, "README.md"), "# Root\n", "utf8");
  fs.writeFileSync(path.join(rootDir, "03_Spec", "Local.md"), "# Local\nbody\n", "utf8");
  fs.writeFileSync(path.join(rootDir, ".git", "hidden.md"), "hidden\n", "utf8");
  fs.writeFileSync(path.join(rootDir, "node_modules", "pkg", "index.js"), "module.exports = 1;\n", "utf8");

  server = createAppServer();
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
  fs.rmSync(tempDataDir, { recursive: true, force: true });
  fs.rmSync(rootDir, { recursive: true, force: true });
});

test("lists a local filesystem directory with directories first", async () => {
  const res = await request(localFsUrl("list", { rootPath: rootDir }));
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);
  expect(res.payload.rootPath).toBe(rootDir);
  expect(res.payload.entries.map((entry) => entry.name)).toEqual(["01_Vision", "03_Spec", "README.md"]);
  expect(res.payload.entries[0].kind).toBe("directory");
  expect(res.payload.entries[2].kind).toBe("file");
});

test("lists a nested directory by relativePath", async () => {
  const res = await request(localFsUrl("list", { rootPath: rootDir, relativePath: "03_Spec" }));
  expect(res.response.status).toBe(200);
  expect(res.payload.relativePath).toBe("03_Spec");
  expect(res.payload.entries.map((entry) => entry.relativePath)).toEqual(["03_Spec/Local.md"]);
});

test("reads a local text file preview", async () => {
  const res = await request(localFsUrl("read", { rootPath: rootDir, relativePath: "03_Spec/Local.md" }));
  expect(res.response.status).toBe(200);
  expect(res.payload.ok).toBe(true);
  expect(res.payload.content).toContain("# Local");
  expect(res.payload.truncated).toBe(false);
});

test("rejects traversal outside the root", async () => {
  const res = await request(localFsUrl("list", { rootPath: rootDir, relativePath: ".." }));
  expect(res.response.status).toBe(400);
  expect(res.payload.error.code).toBe("LOCAL_FS_INVALID_REQUEST");
});

test("rejects a nonexistent root", async () => {
  const missingRoot = path.join(rootDir, "missing");
  const res = await request(localFsUrl("list", { rootPath: missingRoot }));
  expect(res.response.status).toBe(400);
  expect(res.payload.error.code).toBe("LOCAL_FS_INVALID_REQUEST");
});
