// Commit latency on a synthetic 20,000-node map. The numbers are printed; the assertions are loose
// upper bounds so that a slow machine does not fail the suite.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RecordWorkspaceStore } from "../../src/node/record_store";
import { applyChanges, diffState } from "../../src/shared/map_changes";
import type { AppState } from "../../src/shared/types";
import { ISSUER, bigState, clone, command, node, snapshotOf, type Loose } from "./record_store_helpers";
import { createTestStore, dropTestStores } from "./neo4j_test_store";

function timed<T>(run: () => T): { ms: number; value: T } {
  const started = process.hrtime.bigint();
  const value = run();
  return { ms: Number(process.hrtime.bigint() - started) / 1e6, value };
}

describe("record store commit latency (20,000 nodes)", () => {
  let store: RecordWorkspaceStore;
  const lines: string[] = [];

  beforeAll(async () => {
    const started = process.hrtime.bigint();
    const handle = await createTestStore(snapshotOf([{ id: "big", state: bigState(200, 100) }]));
    store = handle.store;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    lines.push(`open (20,201 nodes, builds the state): ${ms.toFixed(1)} ms`);
  }, 120000);

  afterAll(async () => {
    console.log(`\n[record store latency]\n${lines.join("\n")}\n`);
    await dropTestStores();
  });

  function measure(label: string, edit: (state: Loose) => void, repeat = 5): number {
    const samples: number[] = [];
    for (let i = 0; i < repeat; i += 1) {
      const before = store.getMapRow("big").state as unknown as Loose;
      const after = clone(before);
      edit(after);
      const changes = diffState(before, after);
      const result = timed(() => store.commitMapCommand("big", command(changes, label), ISSUER));
      expect(result.value).toMatchObject({ ok: true, replayed: false });
      samples.push(result.ms);
      const expected = applyChanges(before, changes);
      if (i === 0) expect(store.getMapRow("big").state).toEqual((expected as { state: AppState }).state);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    lines.push(`${label}: median ${median.toFixed(1)} ms, max ${samples[samples.length - 1].toFixed(1)} ms (${repeat} commits)`);
    return median;
  }

  it("commits a single text edit well under 100 ms", () => {
    let n = 0;
    const median = measure("single text edit", (state) => {
      n += 1;
      ((state.nodes as Loose).bg0100n0050 as Loose).text = `edited ${n}`;
    });
    expect(median).toBeLessThan(100);
  });

  it("commits adding a node", () => {
    let n = 0;
    const median = measure("add node", (state) => {
      n += 1;
      const nodes = state.nodes as Loose;
      const id = `added_${n}`;
      nodes[id] = node(id, "bg0050");
      ((nodes.bg0050 as Loose).children as string[]).splice(3, 0, id);
    });
    expect(median).toBeLessThan(250);
  });

  it("commits moving a node to another parent", () => {
    let n = 0;
    const median = measure("move node", (state) => {
      const nodes = state.nodes as Loose;
      const id = `bg0010n${String(n).padStart(4, "0")}`;
      n += 1;
      const from = nodes.bg0010 as Loose;
      const to = nodes.bg0020 as Loose;
      from.children = (from.children as string[]).filter((child) => child !== id);
      (to.children as string[]).splice(1, 0, id);
      (nodes[id] as Loose).parentId = "bg0020";
    });
    expect(median).toBeLessThan(250);
  });

  it("commits deleting a 100-node subtree", () => {
    let n = 100;
    const median = measure("delete 100-node subtree (101 nodes)", (state) => {
      const nodes = state.nodes as Loose;
      const groupId = `bg${String(n).padStart(4, "0")}`;
      n += 1;
      const group = nodes[groupId] as Loose;
      for (const child of group.children as string[]) delete nodes[child];
      delete nodes[groupId];
      const root = nodes.broot as Loose;
      root.children = (root.children as string[]).filter((child) => child !== groupId);
    }, 3);
    expect(median).toBeLessThan(2000);
  });
});
