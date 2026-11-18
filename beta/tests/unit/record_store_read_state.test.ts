// Record store: reading one scope out of a map without copying the whole map. Synthetic data only.

import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { RecordWorkspaceStore } from "../../src/node/record_store";
import { extractScopeView } from "../../src/shared/scope_view";
import type { AppState } from "../../src/shared/types";
import { bigState, richState, snapshotOf, tempDir } from "./record_store_helpers";

const open: RecordWorkspaceStore[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

function storeWith(name: string, state: Record<string, unknown>): RecordWorkspaceStore {
  const dir = path.join(tempDir(name), "store");
  RecordWorkspaceStore.create(dir, snapshotOf([{ id: "m1", state }]));
  const store = RecordWorkspaceStore.open(dir, {});
  open.push(store);
  return store;
}

describe("record store readState", () => {
  it("gives the same scope view as the copied whole state, and leaves the held state unchanged", () => {
    const store = storeWith("read-state-rich", richState());
    const whole = store.getMapRow("m1").state as AppState;
    const before = JSON.stringify(whole);
    const viaCopy = extractScopeView(whole, "f1");
    const direct = store.readState("m1", (held) => extractScopeView(held, "f1"));
    expect(direct).not.toBeNull();
    expect(JSON.parse(JSON.stringify(direct))).toEqual(JSON.parse(JSON.stringify(viaCopy)));
    // What was returned shares nothing the caller could change in the store.
    (direct!.state.nodes.f1 as unknown as { text: string }).text = "changed by the caller";
    expect(JSON.stringify(store.getMapRow("m1").state)).toBe(before);
  });

  it("reads a scope of a 20,000-node map without the cost of copying the map", () => {
    const state = bigState(200, 99);
    const scopeId = "bg0000";
    (state.nodes as Record<string, { nodeType: string }>)[scopeId]!.nodeType = "folder";
    const store = storeWith("read-state-big", state);
    store.readState("m1", (held) => extractScopeView(held, scopeId)); // warm
    const timed = (run: () => unknown): number => { const t = performance.now(); for (let i = 0; i < 5; i += 1) run(); return (performance.now() - t) / 5; };
    const direct = timed(() => store.readState("m1", (held) => extractScopeView(held, scopeId)));
    const copied = timed(() => extractScopeView(store.getMapRow("m1").state as AppState, scopeId));
    expect(direct).toBeLessThan(copied);
  });
});
