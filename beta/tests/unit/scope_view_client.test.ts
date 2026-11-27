// The viewer side of scope view: a save is a Command or a failed save, never the whole map.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { scopeView, SAVE_BLOCKED_HEADER } from "../../src/browser/scope_view_client";
import { SaveStateTracker } from "../../src/browser/save_command";
import { extractScopeView } from "../../src/shared/scope_view";
import type { AppState } from "../../src/shared/types";
import { node } from "./scope_view_fixture";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function fullState(): AppState {
  const nodes = {
    root: node("root", null, "Root"),
    mid: node("mid", "root", "Mid"),
    S: node("S", "mid", "Scope", { nodeType: "folder" }),
    a: node("a", "S", "A"),
    E: node("E", "S", "Nested", { nodeType: "folder" }),
    e1: node("e1", "E", "E one"),
    e2: node("e2", "e1", "E two"),
    other: node("other", "root", "Other"),
    alias: node("alias", "S", "Other", { nodeType: "alias", targetNodeId: "other", access: "read", isBroken: false }),
  };
  nodes.root.children = ["mid", "other"];
  nodes.mid.children = ["S"];
  nodes.S.children = ["a", "E", "alias"];
  nodes.E.children = ["e1"];
  nodes.e1.children = ["e2"];
  return { rootId: "root", nodes };
}

const status = vi.fn();
const flush = vi.fn(async () => true);
let payload: { version: 1; savedAt: string; state: AppState; scopeView: unknown };

beforeEach(() => {
  status.mockClear();
  flush.mockClear();
  scopeView.configure("?map=m&scope=S&partial=1");
  scopeView.init({ setStatus: status, currentScopeId: () => "S", resetScope: vi.fn(), flush });
  const extracted = extractScopeView(fullState(), "S");
  payload = { version: 1, savedAt: "t0", state: extracted.state, scopeView: extracted.view };
});

afterEach(() => {
  vi.unstubAllGlobals();
  scopeView.configure("");
});

test("scope view is on only with both scope and partial=1", () => {
  for (const [search, active] of [
    ["?map=m&scope=S&partial=1", true],
    ["?map=m&scopeId=S&partial=1", true],
    ["?map=m&scope=S", false],
    ["?map=m&partial=1", false],
    ["?map=m&scope=S&partial=0", false],
    ["?localFsRoot=/tmp/x&scope=S&partial=1", false],
  ] as const) {
    scopeView.configure(search);
    expect(scopeView.active()).toBe(active);
  }
});

test("off: nothing is blocked and every payload is accepted", () => {
  scopeView.configure("?map=m&scope=S");
  expect(scopeView.adopt({ state: fullState() })).toBe(true);
  expect(scopeView.blocks("Export")).toBe(false);
  expect(scopeView.unloadedBelow("E")).toBe(0);
  expect(scopeView.homeScopeId("root")).toBe("root");
  expect(status).not.toHaveBeenCalled();
});

test("only a scope view of the requested scope can be loaded", () => {
  expect(scopeView.adopt({ version: 1, savedAt: "t", state: fullState() })).toBe(false);
  expect(scopeView.adopt({ ...payload, scopeView: { ...(payload.scopeView as object), scopeRootId: "E" } })).toBe(false);
  expect(scopeView.info()).toBeNull();
  expect(scopeView.adopt(payload)).toBe(true);
  expect(scopeView.info()?.scopeRootId).toBe("S");
  expect(scopeView.homeScopeId("root")).toBe("S");
  // "mid" is a plain node: leaving the scope goes to the nearest scope root above.
  expect(scopeView.homeHistory()).toEqual(["root"]);
});

test("a save sends a Command with the scope view header and never the whole map", async () => {
  scopeView.adopt(payload);
  const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, savedAt: "t1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const edited = clone(payload.state);
  edited.nodes.a!.text = "A edited";
  const response = await scopeView.save("/api/maps/m", "tab", payload.state, edited, "t0");
  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/maps/m/commands");
  expect((init.headers as Record<string, string>)["X-M3E-Scope-View"]).toBe("S");
  expect(JSON.parse(String(init.body)).changes).toEqual([{ kind: "node", key: ["a"], op: "update", before: { text: "A" }, after: { text: "A edited" } }]);
});

test("no changes sends nothing", async () => {
  scopeView.adopt(payload);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await scopeView.save("/api/maps/m", "tab", payload.state, clone(payload.state), "t0");
  expect(await response.json()).toEqual({ ok: true, savedAt: "t0" });
  expect(fetch).not.toHaveBeenCalled();
});

test("every route to a whole-map save answers as a failed save without a request to the whole-map route", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "Map not found." }), { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  const edited = clone(payload.state);
  edited.nodes.a!.text = "A edited";

  // The scope view is not loaded yet.
  expect((await scopeView.save("/api/maps/m", "tab", payload.state, edited, "t0")).status).toBe(422);
  scopeView.adopt(payload);
  // No base (a forced save, "Use Local").
  const forced = await scopeView.save("/api/maps/m", "tab", null, edited, "t0");
  expect(forced.status).toBe(422);
  expect(forced.ok).toBe(false);
  expect(forced.headers.get(SAVE_BLOCKED_HEADER)).toContain("whole-map save");
  expect(fetch).not.toHaveBeenCalled();
  // The Command route answers 404 ("use the whole-map route": no row yet, or a live vault map).
  const fallback = await scopeView.save("/api/maps/m", "tab", payload.state, edited, "t0");
  expect(fallback.status).toBe(422);
  expect(fallback.headers.get(SAVE_BLOCKED_HEADER)).toContain("whole-map route");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("/api/maps/m/commands");
  // An edit that needs nodes that are not loaded.
  const withoutEntry = clone(payload.state);
  withoutEntry.nodes.S!.children = ["a", "alias"];
  delete withoutEntry.nodes.E;
  const refused = await scopeView.save("/api/maps/m", "tab", payload.state, withoutEntry, "t0");
  expect(refused.status).toBe(422);
  expect(refused.headers.get(SAVE_BLOCKED_HEADER)).toContain("nested scope");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("counts, alias targets and deletes know about the nodes that are not loaded", () => {
  scopeView.adopt(payload);
  expect(scopeView.entryChildCount("E")).toBe(1);
  expect(scopeView.entryChildCount("a")).toBeUndefined();
  expect(scopeView.unloadedBelow("E")).toBe(2);
  expect(scopeView.unloadedBelow("a")).toBe(0);
  // root has mid, S and its 5 descendants below "mid", plus "other": only "other" is not on the path.
  expect(scopeView.unloadedBelow("root")).toBe(1);
  expect(scopeView.unloadedBelow("mid")).toBe(0);
  expect(scopeView.isExternalTarget("other")).toBe(true);
  expect(scopeView.isExternalTarget("a")).toBe(false);
  expect(scopeView.refusesDelete(["a"], payload.state.nodes)).toBe(false);
  expect(status).not.toHaveBeenCalled();
  expect(scopeView.refusesDelete(["E"], payload.state.nodes)).toBe(true);
  expect(scopeView.refusesDelete(["S"], payload.state.nodes)).toBe(true);
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining("Cannot delete in scope view"), true);
  expect(scopeView.blocks("Export")).toBe(true);
  expect(status).toHaveBeenLastCalledWith(expect.stringContaining("Export is unavailable in scope view"), true);
});

test("another scope opens as its own page: scope view for a scope root, the whole map otherwise", () => {
  scopeView.adopt(payload);
  const here = "http://127.0.0.1:1/viewer.html?map=m&scope=S&partial=1";
  expect(scopeView.hrefFor("E", here)).toBe("http://127.0.0.1:1/viewer.html?map=m&scope=E&partial=1");
  expect(scopeView.hrefFor("root", here)).toBe("http://127.0.0.1:1/viewer.html?map=m&scope=root&partial=1");
  expect(scopeView.hrefFor("mid", here)).toBe("http://127.0.0.1:1/viewer.html?map=m&scope=mid");
});


test("precomputed delta saves use the same scope mapping and keep whole-map fallback blocked", async () => {
  expect(scopeView.adopt(payload)).toBe(true);
  const base = clone(payload.state), state = clone(base);
  const tracker = new SaveStateTracker(base, state);
  state.nodes.a.text = "delta edit";
  tracker.mark({ nodes: ["a"] });
  const delta = tracker.capture();
  const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await scopeView.save("/api/maps/m", "tab", base, state, "t0");
  await scopeView.save("/api/maps/m", "tab", base, state, "t0", delta.changes);
  const calls = fetch.mock.calls as unknown as [string, RequestInit][];
  expect(JSON.parse(String(calls[1][1].body)).changes).toEqual(JSON.parse(String(calls[0][1].body)).changes);
  fetch.mockClear();
  fetch.mockResolvedValue(new Response("{}", { status: 404 }));
  expect((await scopeView.save("/api/maps/m", "tab", base, state, "t0", delta.changes)).status).toBe(422);
  expect(fetch).toHaveBeenCalledTimes(1);
});
