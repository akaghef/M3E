// Node certainty (Database_Spec 3.2, invariant 11, 7): the -1 default and the refusal of
// out-of-range values. The one-time move of a format 2 file into format 3 is gone with the files.

import { afterEach, describe, expect, it } from "vitest";
import type { RecordWorkspaceStore } from "../../src/node/record_store";
import type { CommitResult } from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { certaintyFromConfidence } from "../../src/shared/record_model/certainty";
import type { NodeRecord } from "../../src/shared/record_model/types";
import { ISSUER, clone, command, node, richState, snapshotOf, type Loose } from "./record_store_helpers";
import { createTestStore, dropTestStores } from "./neo4j_test_store";

afterEach(dropTestStores);

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 27, 0, 0, clock)).toISOString();
}

function nodeRecords(store: RecordWorkspaceStore): NodeRecord[] {
  return store.records().filter((record): record is NodeRecord => record.kind === "node");
}

function attempt(store: RecordWorkspaceStore, change: (state: Loose) => void): CommitResult {
  const before = store.getMapRow("map_a").state as unknown as Loose;
  const after = clone(before);
  change(after);
  return store.commitMapCommand("map_a", command(diffState(before, after)), ISSUER);
}

describe("certainty", () => {
  it("reads Flash ingest and word values of m3e:confidence", () => {
    expect(certaintyFromConfidence("0.7")).toBe(70);
    expect(certaintyFromConfidence(0.8)).toBe(80);
    expect(certaintyFromConfidence("high")).toBe(80);
    expect(certaintyFromConfidence("medium")).toBe(50);
    expect(certaintyFromConfidence("low")).toBe(20);
    expect(certaintyFromConfidence("sure")).toBe(-1);
    expect(certaintyFromConfidence("1.5")).toBe(-1);
  });

  it("writes -1 for a new node without a value, keeps a given value, and refuses one out of range", async () => {
    const handle = await createTestStore(snapshotOf([{ id: "map_a", state: richState() }]), { now: tick, compactAfterLines: 0 });
    const store = handle.store;
    const added = attempt(store, (state) => {
      const nodes = state.nodes as Record<string, Loose>;
      nodes.fresh = node("fresh", "root");
      nodes.sure = node("sure", "root", [], { certainty: 90 });
      (nodes.root.children as string[]).push("fresh", "sure");
    });
    expect(added.ok).toBe(true);
    const find = (text: string) => nodeRecords(store).find((record) => record.text === text)!;
    expect(find("text of fresh").certainty).toBe(-1);
    expect(find("text of sure").certainty).toBe(90);
    const state = store.getMapRow("map_a").state as unknown as Loose;
    const nodes = state.nodes as Record<string, Loose>;
    const sureId = Object.keys(nodes).find((id) => nodes[id].text === "text of sure")!;
    expect(nodes[sureId].certainty).toBe(90);

    for (const bad of [101, -2, 12.5]) {
      const result = attempt(store, (next) => { (next.nodes as Record<string, Loose>)[sureId].certainty = bad; });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message ?? "").toMatch(/certainty/);
    }
    expect(find("text of sure").certainty).toBe(90);
  });
});
