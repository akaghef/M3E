import { afterEach, expect, test, vi } from "vitest";
import { SaveStateTracker } from "../../src/browser/save_command";
import { commandForChanges, postSaveCommand } from "../../src/browser/save_command";
import { diffState } from "../../src/shared/map_changes";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const node = (id: string, parentId: string | null, children: string[] = []) =>
  ({ id, parentId, children, text: id, nodeType: "text", attributes: {} });
const fixture = () => ({ rootId: "root", nodes: {
  root: node("root", null, ["a", "b", "c"]), a: node("a", "root"),
  b: node("b", "root"), c: node("c", "root"),
}, links: {} } as Record<string, any>);
afterEach(() => vi.unstubAllGlobals());
const wire = (before: object, after: object) => commandForChanges(diffState(before, after), "tab").changes;

test("an edit path without ids sends ALL edits, even following a marked edit", async () => {
  const base = fixture(), live = copy(base), original = copy(base);
  const tracker = new SaveStateTracker(base, live);
  live.nodes.a.text = "known";
  tracker.mark({ nodes: ["a"] });
  live.nodes.b.text = "unreported";
  live.links.edge = { id: "edge", sourceNodeId: "a", targetNodeId: "b" };
  live.linearPanelWidth = 600;
  tracker.mark(); // touchDocument()/scheduleAutosave() with no write set.
  const captured = tracker.capture();
  const fetch = vi.fn(async () => new Response('{"savedAt":"t1"}', { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await postSaveCommand("/api/maps/m", "tab", base, live, "t0", () => "whole", captured.changes);
  const body = JSON.parse(String((fetch.mock.calls as any)[0][1].body));
  expect(body.changes).toEqual(wire(original, live));
  expect(body.changes.some((c: any) => c.key[0] === "b")).toBe(true);
  captured.accept();
  expect(base).toEqual(live);
});

test("small edits neither enumerate nor read untouched nodes on capture or acknowledgement", () => {
  const base = fixture(), live = copy(base);
  // A real unrelated entry whose read fails is stronger than a wall-clock budget.
  for (const state of [base, live]) Object.defineProperty(state.nodes, "unrelated", {
    enumerable: true, get() { throw new Error("unrelated node read"); },
  });
  const tracker = new SaveStateTracker(base, live);
  live.nodes.a.nodeType = "folder";
  tracker.mark({ nodes: ["a"] });
  const captured = tracker.capture();
  expect(captured.changes).toEqual([
    { kind: "node", key: ["a"], op: "update", before: { nodeType: "text" }, after: { nodeType: "folder" } },
  ]);
  captured.accept();
  expect(base.nodes.a.nodeType).toBe("folder");
  expect(tracker.state).toBe(live);
});

test("marked edits retain the same record changes for topology, attributes and collections", () => {
  const base = fixture(), live = copy(base);
  const tracker = new SaveStateTracker(base, live);
  live.nodes.root.children = ["b", "a"];
  delete live.nodes.c;
  live.nodes.a.children = ["d"];
  live.nodes.d = node("d", "a");
  live.nodes.a.attributes = { status: "changed" };
  live.links.edge = { id: "edge", sourceNodeId: "a", targetNodeId: "b", attributes: { color: "red" } };
  live.scopes = { scope: { id: "scope", rootNodeIds: ["a"] } };
  live.surfaces = { surface: { scopeId: "scope", nodeViews: { a: { x: 1 } } } };
  live.linearNotesByScope = { a: "note" };
  live.annotations = { ink: { x: 2, y: 3 } };
  live.linearPanelWidth = 500;
  tracker.mark({ nodes: ["root", "a", "c", "d"], links: ["edge"], scopes: ["scope"],
    surfaces: ["surface"], linearNotesByScope: ["a"], annotations: ["ink"], $map: ["linearPanelWidth"] });
  const captured = tracker.capture();
  expect(captured.changes).toEqual(diffState(base, live));
  expect(captured.materialize()).toEqual(live);
  captured.accept();
  expect(base).toEqual(live);
});

test("a 404 whole-map fallback sends the captured version, including untouched entries", async () => {
  const base = fixture(), live = copy(base);
  const tracker = new SaveStateTracker(base, live);
  live.nodes.a.text = "submitted";
  tracker.mark({ nodes: ["a"] });
  const captured = tracker.capture();
  const submitted = copy(live);
  const fetch = vi.fn().mockImplementationOnce(async () => {
    live.nodes.a.text = "typed while awaiting";
    live.nodes.b.text = "also later";
    tracker.mark({ nodes: ["a", "b"] });
    return new Response("{}", { status: 404 });
  }).mockResolvedValueOnce(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await postSaveCommand("/api/maps/m", "tab", base, live, "t0",
    () => JSON.stringify(captured.materialize()), captured.changes);
  expect(JSON.parse(String(fetch.mock.calls[1][1].body))).toEqual(submitted);
  captured.accept();
  expect(base).toEqual(submitted);
  expect(tracker.capture().changes).toEqual(diffState(submitted, live));
});

test("retry after rejection preserves both submitted and subsequently edited ids", () => {
  const base = fixture(), live = copy(base);
  const tracker = new SaveStateTracker(base, live);
  live.nodes.a.text = "first";
  tracker.mark({ nodes: ["a"] });
  const sent = tracker.capture();
  live.nodes.b.text = "later";
  tracker.mark({ nodes: ["b"] });
  sent.retry();
  expect(tracker.capture().changes).toEqual(diffState(base, live));
});

test("whole-state undo fallback acknowledges only its captured version", () => {
  const base = fixture(), live = copy(base);
  live.nodes.a.text = "undo";
  const tracker = new SaveStateTracker(base, live);
  tracker.mark();
  const sent = tracker.capture(), submitted = copy(live);
  live.nodes.b.text = "later";
  tracker.mark({ nodes: ["b"] });
  sent.accept();
  expect(base).toEqual(submitted);
  expect(tracker.capture().changes).toEqual(diffState(submitted, live));
});

test("array annotations use the whole diff and preserve shape and deletion", () => {
  const base = fixture(), live = copy(base);
  live.annotations = [{ x: 2 }, { x: 3 }];
  const tracker = new SaveStateTracker(base, live);
  tracker.mark({ annotations: ["0", "1"] });
  const sent = tracker.capture();
  expect(sent.changes).toEqual(diffState(base, live));
  sent.accept();
  expect(base).toEqual(live);
});
