import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterEach, expect, test, vi } from "vitest";

// Execute the viewer's actual functions and event listeners without booting its UI.
const source = ts.createSourceFile("viewer.ts", fs.readFileSync(path.join(__dirname, "../../src/browser/viewer.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const names = ["setStatus", "updateLinearSaveStatus", "showLocalSaveFailure", "markLocalSaveSucceeded", "currentDocSnapshot", "cloneStateForSave", "saveDocToLocalDb", "scheduleAutosave"];
const functions = source.statements.filter(s => ts.isFunctionDeclaration(s) && names.includes(s.name?.text ?? ""));
const listeners = source.statements.filter(s => ts.isExpressionStatement(s) && /^linearTextEl\?\.addEventListener\("(input|keydown)"/.test(s.getText(source)));
const code = ts.transpileModule([...functions, ...listeners].map(s => s.getText(source)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;

function setup(fetch: ReturnType<typeof vi.fn>, snapshotError = false) {
  return new Function("fetch", "snapshotError", "showConflictPanel", `
    const map = { version: 1, savedAt: "initial", state: { rootId: "root", nodes: { root: { text: "Root" } } } };
    const statusEl = { textContent: "", style: {} }, linearMetaEl = { textContent: "" };
    const handlers = {}, linearTextEl = { value: "memo", addEventListener: (name, fn) => handlers[name] = fn };
    const linearNotesByScope = {}, linearApplyBtn = {}, linearResetBtn = {};
    let linearDirty = false, linearDisplayedScopeId = "root", statusTimer = null, autosaveTimer = null;
    let localSaveFailure = null, localSaveRevision = 0, localSavedRevision = -1;
    let lastServerSavedAt = "initial", lastServerBaseState = { original: true };
    const grabSession = null, collabEntityId = null, collabToken = null, cloudSyncEnabled = false;
    const LOCAL_MAP_ID = "test", TAB_ID = "test-tab", AUTOSAVE_DELAY_MS = 700;
    const lineSelection = { status: () => "Ready" };
    const isReadOnlyLink = () => false, currentLinearMemoScopeId = () => "root";
    const syncLinearNotesToDocState = () => { map.state.linearNotesByScope = { ...linearNotesByScope }; };
    const syncMapModelStateFromRuntime = () => {}, commitDispersePositions = () => {};
    const canonicalMapState = () => { if (snapshotError) throw new Error("snapshot failed"); return map.state; };
    const nowIso = () => "now", broadcastState = () => {}, scheduleRender = () => {};
    const buildLinearFromScope = () => ({ text: "template" }), renderLinearPanel = () => {};
    const isImeComposingEvent = () => false, primaryModifier = () => true;
    ${code}
    return { save: saveDocToLocalDb, schedule: scheduleAutosave, setStatus, statusEl, linearMetaEl, map,
      edit: (value) => { linearTextEl.value = value; handlers.input(); },
      enter: () => handlers.keydown({ key: "Enter", preventDefault() {} }),
      baseline: () => ({ lastServerSavedAt, lastServerBaseState }) };
  `)(fetch, snapshotError, vi.fn());
}

function response(status: number, payload: object = {}) {
  return { status, ok: status === 200, json: async () => payload };
}

afterEach(() => vi.useRealTimers());

for (const [failure, reason] of [
  [response(413, { error: "Request body too large." }), "too large"],
  [response(500, { error: "Unavailable" }), "server error"],
  [response(400, { error: "Invalid" }), "server error"],
  [new TypeError("Failed to fetch"), "network error"],
] as const) {
  test(`700 ms autosave exposes ${reason}, keeps edits and baseline, then retries successfully`, async () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    if (failure instanceof Error) fetch.mockRejectedValueOnce(failure);
    else fetch.mockResolvedValueOnce(failure);
    const viewer = setup(fetch);
    viewer.edit("unsaved memo");
    viewer.enter();
    expect(viewer.linearMetaEl.textContent).toContain("saving");
    expect(viewer.statusEl.textContent).not.toContain("saved");
    await vi.advanceTimersByTimeAsync(700);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(viewer.statusEl.textContent).toContain(reason);
    expect(viewer.linearMetaEl.textContent).toContain("Local save failed");
    expect(viewer.map.state.linearNotesByScope.root).toBe("unsaved memo");
    expect(viewer.baseline()).toEqual({ lastServerSavedAt: "initial", lastServerBaseState: { original: true } });
    viewer.setStatus("Another edit");
    await vi.advanceTimersByTimeAsync(5000);
    expect(viewer.statusEl.textContent).toContain(reason);
    fetch.mockResolvedValueOnce(response(200, { savedAt: "saved" }));
    viewer.edit("retry memo");
    expect(viewer.statusEl.textContent).toContain(reason);
    await vi.advanceTimersByTimeAsync(700);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(viewer.linearMetaEl.textContent).toContain(" | saved");
    expect(viewer.statusEl.textContent).toBe("Saved locally.");
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(Object.keys(body)).toEqual(["version", "savedAt", "state", "baseSavedAt", "baseState", "force"]);
    expect(body.state.linearNotesByScope.root).toBe("retry memo");
  });
}

test("snapshot exceptions are visible to autosave", async () => {
  vi.useFakeTimers();
  const viewer = setup(vi.fn(), true);
  viewer.schedule();
  await vi.advanceTimersByTimeAsync(700);
  expect(viewer.statusEl.textContent).toBe("Local save failed (save error).");
});

test("409 retains the existing conflict status and does not become a generic autosave failure", async () => {
  vi.useFakeTimers();
  const viewer = setup(vi.fn().mockResolvedValue(response(409, { error: "Conflict", code: "DOC_NODE_CONFLICT_Q", state: {} })));
  expect(await viewer.save(false)).toBe(false);
  expect(viewer.statusEl.textContent).toBe("Q conflict: same node changed differently. Choose a result.");
  await vi.advanceTimersByTimeAsync(2500);
  expect(viewer.statusEl.textContent).toBe("Ready");
});

test("an in-flight save cannot mark newer linear-text edits as saved", async () => {
  vi.useFakeTimers();
  let complete: (result: object) => void;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const viewer = setup(fetch);
  viewer.edit("first memo");
  await vi.advanceTimersByTimeAsync(700);
  viewer.edit("newer memo");
  complete!(response(200, { savedAt: "saved" }));
  await vi.advanceTimersByTimeAsync(0);
  expect(viewer.linearMetaEl.textContent).toContain(" | saving");
  expect(viewer.linearMetaEl.textContent).not.toContain(" | saved");
});


test("explicit save clears a previous autosave failure after success", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Offline"));
  const viewer = setup(fetch);
  viewer.edit("retry explicitly");
  await vi.advanceTimersByTimeAsync(700);
  expect(viewer.statusEl.textContent).toContain("network error");
  fetch.mockResolvedValueOnce(response(200, { savedAt: "saved" }));
  expect(await viewer.save(true)).toBe(true);
  expect(viewer.statusEl.textContent).toBe("Saved locally.");
  expect(viewer.linearMetaEl.textContent).toContain(" | saved");
  await vi.advanceTimersByTimeAsync(2500);
  expect(viewer.statusEl.textContent).toBe("Ready");
});
