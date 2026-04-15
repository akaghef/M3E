import { test, expect, beforeAll } from "vitest";
const fs = require("node:fs");
const path = require("node:path");

const homeJsPath = path.resolve(__dirname, "../../dist/browser/home.js");

let matchesSearch;
let sortByUpdatedDesc;
let relTime;

function extractFunction(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) throw new Error(`Could not find function ${name} in home.js`);
  const start = m.index;
  const openIdx = src.indexOf("{", m.index + m[0].length);
  if (openIdx < 0) throw new Error(`No body for ${name}`);
  let depth = 0;
  let i = openIdx;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
  }
  return src.slice(start, i);
}

beforeAll(() => {
  const src = fs.readFileSync(homeJsPath, "utf8");
  const body = [
    extractFunction(src, "matchesSearch"),
    extractFunction(src, "sortByUpdatedDesc"),
    extractFunction(src, "relTime"),
    "return { matchesSearch, sortByUpdatedDesc, relTime };",
  ].join("\n");
  const mod = new Function(body)();
  matchesSearch = mod.matchesSearch;
  sortByUpdatedDesc = mod.sortByUpdatedDesc;
  relTime = mod.relTime;
});

function doc(partial) {
  return {
    id: partial.id ?? "x",
    label: partial.label ?? "Label",
    savedAt: partial.savedAt ?? new Date().toISOString(),
    nodeCount: 1,
    charCount: 0,
    tags: partial.tags ?? [],
    archived: false,
    pinned: false,
  };
}

test("matchesSearch: empty query matches everything", () => {
  expect(matchesSearch(doc({ label: "Anything" }), "")).toBe(true);
});

test("matchesSearch: label substring match (case insensitive)", () => {
  expect(matchesSearch(doc({ label: "Research Notes" }), "resea")).toBe(true);
  expect(matchesSearch(doc({ label: "Research Notes" }), "RESEA")).toBe(true);
});

test("matchesSearch: no match", () => {
  expect(matchesSearch(doc({ label: "Research" }), "zzz")).toBe(false);
});

test("matchesSearch: tag substring match", () => {
  expect(matchesSearch(doc({ label: "Foo", tags: ["urgent", "work"] }), "urg")).toBe(true);
});

test("matchesSearch: leading # is stripped", () => {
  expect(matchesSearch(doc({ label: "Foo", tags: ["work"] }), "#work")).toBe(true);
});

test("sortByUpdatedDesc: newest first", () => {
  const older = doc({ id: "a", savedAt: "2026-01-01T00:00:00Z" });
  const newer = doc({ id: "b", savedAt: "2026-04-01T00:00:00Z" });
  const sorted = sortByUpdatedDesc([older, newer]);
  expect(sorted.map((d) => d.id)).toEqual(["b", "a"]);
});

test("sortByUpdatedDesc: does not mutate input", () => {
  const d1 = doc({ id: "a", savedAt: "2026-01-01T00:00:00Z" });
  const d2 = doc({ id: "b", savedAt: "2026-04-01T00:00:00Z" });
  const input = [d1, d2];
  sortByUpdatedDesc(input);
  expect(input[0].id).toBe("a");
  expect(input[1].id).toBe("b");
});

test("sortByUpdatedDesc: handles invalid savedAt gracefully", () => {
  const bad = doc({ id: "bad", savedAt: "not-a-date" });
  const good = doc({ id: "good", savedAt: "2026-04-01T00:00:00Z" });
  const sorted = sortByUpdatedDesc([bad, good]);
  expect(sorted[0].id).toBe("good");
});

test("relTime: under 60s returns 'just now'", () => {
  const iso = new Date(Date.now() - 10_000).toISOString();
  expect(relTime(iso)).toBe("just now");
});

test("relTime: months", () => {
  const iso = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  expect(relTime(iso)).toBe("1mo ago");
});

test("relTime: unparseable input is returned as-is", () => {
  expect(relTime("not-a-date")).toBe("not-a-date");
});
