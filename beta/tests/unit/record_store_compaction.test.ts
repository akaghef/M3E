// The journal envelope of a commit: which records changed, and how. Compaction and the archive
// are gone; this file keeps the envelope the store derives for a commit.

import { afterEach, describe, expect, it } from "vitest";
import type { RecordWorkspaceStore } from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { ISSUER, clone, command, node, richState, snapshotOf, type Loose } from "./record_store_helpers";
import { createTestStore, dropTestStores } from "./neo4j_test_store";

afterEach(dropTestStores);

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 19, 0, 0, clock)).toISOString();
}

async function openStore(): Promise<RecordWorkspaceStore> {
  const handle = await createTestStore(snapshotOf([{ id: "map_a", state: richState() }, { id: "map_b", state: richState("b_") }]), { now: tick, compactAfterLines: 0 });
  return handle.store;
}

function nodesOf(store: RecordWorkspaceStore, mapId = "map_a"): Record<string, Loose> {
  return (store.getMapRow(mapId).state as unknown as Loose).nodes as Record<string, Loose>;
}

function edit(store: RecordWorkspaceStore, change: (state: Loose) => void, mapId = "map_a"): void {
  const before = store.getMapRow(mapId).state as unknown as Loose;
  const after = clone(before);
  change(after);
  const result = store.commitMapCommand(mapId, command(diffState(before, after)), ISSUER);
  if (!result.ok) throw new Error(`commit failed: ${result.code} ${result.message ?? ""}`);
}

describe("journal envelope: touched", () => {
  it("lists the records a commit changed, with the kinds of change, derived by the store", async () => {
    const store = await openStore();
    edit(store, (state) => { (state.nodes as Record<string, Loose>).leaf.text = "changed"; });
    edit(store, (state) => { ((state.nodes as Record<string, Loose>).inner.attributes as Loose).k = "v"; });
    edit(store, (state) => {
      const nodes = state.nodes as Record<string, Loose>;
      nodes.n1 = node("n1", "f1");
      (nodes.f1.children as string[]).push("n1");
    });
    const lines = await store.readJournalAfter(0);
    const contentTouched = (lines![0].touched as Array<{ rk: string; ev: string[] }>).filter((entry) => !entry.rk.startsWith("decay|"));
    const attributeTouched = (lines![1].touched as Array<{ rk: string; ev: string[] }>).filter((entry) => !entry.rk.startsWith("decay|"));
    expect(contentTouched).toEqual([{ rk: "node|leaf", ev: ["m3e:content"] }]);
    expect(attributeTouched).toEqual([{ rk: "node|inner", ev: ["m3e:attribute"] }]);
    const created = lines![2].touched as Array<{ rk: string; ev: string[] }>;
    expect(created.map((entry) => entry.rk)).toEqual([...created.map((entry) => entry.rk)].sort());
    expect(created.find((entry) => entry.rk === "node|n1")).toEqual({ rk: "node|n1", ev: ["m3e:create"] });
    expect(created.some((entry) => entry.rk.startsWith("connection|") && entry.ev.includes("m3e:create"))).toBe(true);
    expect(nodesOf(store).n1.text).toBe("text of n1");
  });
});
