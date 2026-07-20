// @ts-check
"use strict";
import { test, expect, beforeEach } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  appendPerfLog,
  normalizeRoute,
  extractMapId,
  isSseRoute,
  buildClientTag,
  perfLogPath,
  resetPerfLogForTest,
} = require("../../dist/node/perf_log.js");

function makeTmpLogPath() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-perf-test-"));
  const logsDir = path.join(tmpDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, "api_perf.jsonl");
}

beforeEach(() => {
  resetPerfLogForTest();
});

test("normalizeRoute replaces map ids with :id", () => {
  expect(normalizeRoute("GET", "/api/maps/abc-123-def")).toBe("/api/maps/:id");
  expect(normalizeRoute("POST", "/api/maps/my-map-42/watch")).toBe("/api/maps/:id/watch");
  expect(normalizeRoute("GET", "/api/maps/aaa-bbb/audit")).toBe("/api/maps/:id/audit");
  expect(normalizeRoute("GET", "/api/maps/aaa-bbb/presence")).toBe("/api/maps/:id/presence");
});

test("normalizeRoute preserves known sub-routes like /new, /import-file", () => {
  expect(normalizeRoute("POST", "/api/maps/new")).toBe("/api/maps/new");
  expect(normalizeRoute("POST", "/api/maps/import-file")).toBe("/api/maps/import-file");
});

test("normalizeRoute collapses non-api paths to /static", () => {
  expect(normalizeRoute("GET", "/")).toBe("/static");
  expect(normalizeRoute("GET", "/viewer.html")).toBe("/static");
  expect(normalizeRoute("GET", "/assets/app.js")).toBe("/static");
});

test("normalizeRoute handles collab and flash routes", () => {
  expect(normalizeRoute("POST", "/api/collab/register")).toBe("/api/collab/register");
  expect(normalizeRoute("POST", "/api/flash/ingest")).toBe("/api/flash/ingest");
});

test("extractMapId returns map id for map routes", () => {
  expect(extractMapId("/api/maps/abc-123")).toBe("abc-123");
  expect(extractMapId("/api/maps/xyz-9/audit")).toBe("xyz-9");
});

test("extractMapId returns null for reserved sub-routes and non-map paths", () => {
  expect(extractMapId("/api/maps/new")).toBe(null);
  expect(extractMapId("/api/maps/import-file")).toBe(null);
  expect(extractMapId("/api/collab/register")).toBe(null);
  expect(extractMapId("/viewer.html")).toBe(null);
});

test("isSseRoute identifies SSE endpoints", () => {
  expect(isSseRoute("/api/maps/:id/watch")).toBe(true);
  expect(isSseRoute("/api/vault/watch")).toBe(true);
  expect(isSseRoute("/api/maps/:id")).toBe(false);
  expect(isSseRoute("/api/maps/:id/audit")).toBe(false);
});

test("buildClientTag prefers X-Client-Id over User-Agent", () => {
  expect(buildClientTag({ "x-client-id": "browser-main", "user-agent": "Mozilla/5.0" })).toBe("browser-main");
  expect(buildClientTag({ "user-agent": "Mozilla/5.0" })).toBe("Mozilla/5.0");
  expect(buildClientTag({})).toBe(null);
});

test("buildClientTag truncates to 64 chars", () => {
  const long = "x".repeat(128);
  expect(buildClientTag({ "user-agent": long }).length).toBe(64);
});

test("appendPerfLog writes one JSONL record to the resolved path", () => {
  const logFile = makeTmpLogPath();
  resetPerfLogForTest(logFile);

  appendPerfLog({
    ts: "2026-04-20T10:11:12.345Z",
    method: "POST",
    path: "/api/maps/m1",
    route: "/api/maps/:id",
    status: 200,
    duration_ms: 42,
    ttfb_ms: 40,
    req_bytes: 1823,
    res_bytes: 128,
    map_id: "m1",
    scope: null,
    client: "browser",
    sse: false,
    error_code: null,
  });

  const content = fs.readFileSync(logFile, "utf8");
  const lines = content.trim().split("\n");
  expect(lines.length).toBe(1);
  const parsed = JSON.parse(lines[0]);
  expect(parsed.method).toBe("POST");
  expect(parsed.route).toBe("/api/maps/:id");
  expect(parsed.status).toBe(200);
  expect(parsed.duration_ms).toBe(42);
  expect(parsed.map_id).toBe("m1");
});

test("appendPerfLog appends multiple entries without overwriting", () => {
  const logFile = makeTmpLogPath();
  resetPerfLogForTest(logFile);

  for (let i = 0; i < 3; i++) {
    appendPerfLog({
      ts: new Date().toISOString(),
      method: "GET",
      path: `/api/maps/m${i}`,
      route: "/api/maps/:id",
      status: 200,
      duration_ms: i,
      ttfb_ms: i,
      req_bytes: null,
      res_bytes: 10,
      map_id: `m${i}`,
      scope: null,
      client: null,
      sse: false,
      error_code: null,
    });
  }

  const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
  expect(lines.length).toBe(3);
  expect(JSON.parse(lines[0]).map_id).toBe("m0");
  expect(JSON.parse(lines[2]).map_id).toBe("m2");
});

test("appendPerfLog does not throw when the target directory cannot be created", () => {
  // Point to a path under a file (not a dir) so mkdirSync must fail.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-perf-fail-"));
  const blocker = path.join(tmpDir, "blocker");
  fs.writeFileSync(blocker, "x");
  const bogus = path.join(blocker, "logs", "api_perf.jsonl");
  resetPerfLogForTest(bogus);

  expect(() =>
    appendPerfLog({
      ts: "2026-04-20T10:11:12.345Z",
      method: "GET",
      path: "/x",
      route: "/static",
      status: 200,
      duration_ms: 1,
      ttfb_ms: 1,
      req_bytes: null,
      res_bytes: 0,
      map_id: null,
      scope: null,
      client: null,
      sse: false,
      error_code: null,
    }),
  ).not.toThrow();
});

test("perfLogPath resolves to {repo_root}/logs/api_perf.jsonl", () => {
  const p = perfLogPath();
  expect(p.endsWith(path.join("logs", "api_perf.jsonl"))).toBe(true);
});
