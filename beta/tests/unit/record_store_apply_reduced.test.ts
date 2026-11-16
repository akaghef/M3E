// applyChangesReduced must give exactly what applyChanges gives on the full state.

import { describe, expect, it } from "vitest";
import { applyChangesReduced } from "../../src/node/record_store/apply_reduced";
import { applyChanges, diffState, invertChanges, type RecordChange } from "../../src/shared/map_changes";
import { bigState, clone, node, randomEdit, richState, rng, type Loose } from "./record_store_helpers";

function both(state: Loose, changes: RecordChange[]): void {
  const full = applyChanges(clone(state), changes);
  const reduced = applyChangesReduced(state, changes);
  expect(reduced).toEqual(full);
}

describe("applyChangesReduced", () => {
  it("matches applyChanges over random edits, their inverses and stale commands", () => {
    for (const seed of [11, 12, 13, 14]) {
      const random = rng(seed);
      const counter = { n: 0 };
      let state = { ...richState(), nodes: { ...(richState().nodes as Loose), ...(bigState(3, 4, "q").nodes as Loose) } } as Loose;
      ((state.nodes as Record<string, Loose>).qroot).parentId = "root";
      ((state.nodes as Record<string, Loose>).root.children as string[]).push("qroot");
      let stale: RecordChange[] = [];
      for (let step = 0; step < 80; step += 1) {
        const after = clone(state);
        for (let k = 0; k < 1 + Math.floor(random() * 3); k += 1) randomEdit(after, random, counter);
        const changes = diffState(state, after);
        both(state, changes);
        both(after, invertChanges(changes));
        // A command built on an older state: conflicts must be reported the same way.
        if (stale.length > 0) both(after, stale);
        if (step % 5 === 0) stale = changes;
        const applied = applyChangesReduced(state, changes);
        expect(applied.ok).toBe(true);
        if (applied.ok) expect(applied.state).toEqual(after);
        state = after;
      }
    }
  });

  it("keeps the objects of nodes the changes do not reach", () => {
    const state = bigState(4, 5);
    const nodes = state.nodes as Record<string, Loose>;
    const after = clone(state);
    const afterNodes = after.nodes as Record<string, Loose>;
    afterNodes.fresh = node("fresh", "bg0001");
    (afterNodes.bg0001.children as string[]).splice(1, 0, "fresh");
    const applied = applyChangesReduced(state, diffState(state, after));
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const result = (applied.state as Loose).nodes as Record<string, Loose>;
    expect(result).toEqual(afterNodes);
    expect(result.bg0002n0003).toBe(nodes.bg0002n0003);
    expect(result.bg0003).toBe(nodes.bg0003);
    expect(result.bg0001).not.toBe(nodes.bg0001);
  });

  it("hands the node table back untouched when no change names a node", () => {
    const state = richState();
    const after = clone(state);
    after.linearPanelWidth = 512;
    (after.linearNotesByScope as Loose).root = "other";
    const applied = applyChangesReduced(state, diffState(state, after));
    expect(applied.ok && (applied.state as Loose).nodes).toBe(state.nodes);
    expect(applied.ok && applied.state).toEqual(after);
  });

  it("falls back to the full state when the node table itself appears or disappears", () => {
    const changes = diffState({}, richState());
    expect(applyChangesReduced({}, changes)).toEqual(applyChanges({}, changes));
    const gone = diffState(richState(), { rootId: "root" });
    expect(applyChangesReduced(richState(), gone)).toEqual(applyChanges(richState(), gone));
  });
});
