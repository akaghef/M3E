// validateState must report exactly what RapidMvpModel.fromJSON(state).validate() reports.

import { describe, expect, it } from "vitest";
import { commitValidationErrorCount, validateState, validationErrorCount, validationUnaffected } from "../../src/node/record_store/validate";
import { diffState } from "../../src/shared/map_changes";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import type { AppState } from "../../src/shared/types";
import { bigState, clone, node, randomEdit, richState, rng, type Loose } from "./record_store_helpers";

function literal(state: Loose): string[] {
  return RapidMvpModel.fromJSON(state as unknown as AppState).validate();
}

function nodesOf(state: Loose): Record<string, Loose> {
  return state.nodes as Record<string, Loose>;
}

const BROKEN: Array<[string, (state: Loose) => void]> = [
  ["valid", () => undefined],
  ["missing root", (state) => { state.rootId = "nowhere"; }],
  ["missing parent", (state) => { nodesOf(state).leaf.parentId = "gone"; }],
  ["missing child reference", (state) => { (nodesOf(state).root.children as string[]).push("ghost"); }],
  ["parent/child mismatch", (state) => { (nodesOf(state).f1.children as string[]).push("leaf"); }],
  ["cycle", (state) => { nodesOf(state).root.parentId = "inner"; (nodesOf(state).inner.children as string[]).push("root"); }],
  ["disconnected", (state) => { nodesOf(state).island = node("island", null); }],
  ["alias with children", (state) => { nodesOf(state).al.children = ["inner"]; }],
  ["alias with bad access", (state) => { nodesOf(state).al.access = "admin"; }],
  ["alias without access", (state) => { delete nodesOf(state).al.access; }],
  ["alias without target", (state) => { delete nodesOf(state).al.targetNodeId; }],
  ["alias to missing target", (state) => { nodesOf(state).al.targetNodeId = "gone"; }],
  ["broken alias with snapshot label", (state) => { nodesOf(state).al.targetNodeId = "gone"; nodesOf(state).al.isBroken = true; }],
  ["alias marked broken but target exists", (state) => { nodesOf(state).al.isBroken = true; }],
  ["alias to alias", (state) => { nodesOf(state).al2 = node("al2", "root", [], { nodeType: "alias", targetNodeId: "al", access: "read" }); (nodesOf(state).root.children as string[]).push("al2"); }],
  ["non-alias with alias fields", (state) => { Object.assign(nodesOf(state).leaf, { targetNodeId: "img", access: "read", isBroken: true }); }],
  ["node without nodeType", (state) => { delete nodesOf(state).leaf.nodeType; }],
  ["link to missing nodes", (state) => { (state.links as Loose).bad = { id: "bad", sourceNodeId: "gone", targetNodeId: "gone2" }; }],
  ["link to itself", (state) => { (state.links as Loose).self = { id: "self", sourceNodeId: "leaf", targetNodeId: "leaf" }; }],
  ["link from alias", (state) => { (state.links as Loose).fromAlias = { id: "fromAlias", sourceNodeId: "al", targetNodeId: "al" }; }],
  ["link with bad direction and style", (state) => { Object.assign((state.links as Record<string, Loose>).l1, { direction: "sideways", style: "wavy" }); }],
  ["link with bad attributes", (state) => { (state.links as Record<string, Loose>).l1.attributes = { n: 1 }; }],
  ["link with bad ports", (state) => { Object.assign((state.links as Record<string, Loose>).l1, { sourcePort: "middle", targetPort: 3 }); }],
  ["no links", (state) => { delete state.links; }],
  ["no nodes", (state) => { delete state.nodes; }],
  ["nodes is not an object", (state) => { state.nodes = "nope"; }],
];

describe("validateState", () => {
  it.each(BROKEN)("reports what fromJSON(state).validate() reports: %s", (_name, breakIt) => {
    const state = richState();
    breakIt(state);
    const before = clone(state);
    let expected: string[] | undefined;
    try {
      expected = literal(clone(state));
    } catch {
      expected = undefined;
    }
    if (expected === undefined) {
      expect(validationErrorCount(state)).toBe(Number.POSITIVE_INFINITY);
    } else {
      expect(validateState(state)).toEqual(expected);
      expect(validationErrorCount(state)).toBe(expected.length);
    }
    // The state handed in is not touched.
    expect(state).toEqual(before);
  });

  it("agrees over random edits, valid and damaged", () => {
    const random = rng(99);
    const counter = { n: 0 };
    let state = { ...richState(), nodes: { ...(richState().nodes as Loose), ...(bigState(2, 3, "q").nodes as Loose) } } as Loose;
    nodesOf(state).qroot.parentId = "root";
    (nodesOf(state).root.children as string[]).push("qroot");
    for (let step = 0; step < 150; step += 1) {
      const next = clone(state);
      randomEdit(next, random, counter);
      expect(validateState(next)).toEqual(literal(next));
      // Damage a copy in a random way and compare again.
      const damaged = clone(next);
      const ids = Object.keys(nodesOf(damaged));
      const victim = nodesOf(damaged)[ids[Math.floor(random() * ids.length)]];
      const pick = Math.floor(random() * 4);
      if (pick === 0) victim.parentId = ids[Math.floor(random() * ids.length)];
      else if (pick === 1) (victim.children as string[]).push(ids[Math.floor(random() * ids.length)]);
      else if (pick === 2) delete nodesOf(damaged)[String(victim.id)];
      else victim.nodeType = "alias";
      expect(validateState(damaged)).toEqual(literal(damaged));
      state = next;
    }
  });
});

describe("validationUnaffected", () => {
  it("keeps the validation count for content-only edits, on valid and damaged states", () => {
    for (const [name, breakIt] of BROKEN) {
      const before = clone(richState()) as Loose;
      breakIt(before);
      if (!before.nodes || typeof before.nodes !== "object") continue; // nothing to edit
      const after = clone(before) as Loose;
      for (const id of Object.keys(nodesOf(after))) {
        const n = nodesOf(after)[id]!;
        n.text = `${String(n.text ?? "")}!`;
        n.details = "d";
        n.note = "n";
        n.collapsed = !n.collapsed;
        n.link = "https://example.invalid/";
      }
      const changes = diffState(before as never, after as never);
      expect(validationUnaffected(changes), name).toBe(true);
      expect(commitValidationErrorCount(after), name).toBe(commitValidationErrorCount(before));
    }
  });

  it("does not hold for a change validation reads", () => {
    const before = clone(richState()) as Loose;
    const typed = clone(before) as Loose;
    nodesOf(typed).leaf.nodeType = "alias";
    expect(validationUnaffected(diffState(before as never, typed as never))).toBe(false);
    const moved = clone(before) as Loose;
    nodesOf(moved).island = node("island", null);
    expect(validationUnaffected(diffState(before as never, moved as never))).toBe(false);
    const attributed = clone(before) as Loose;
    nodesOf(attributed).leaf.attributes = { k: "v" };
    expect(validationUnaffected(diffState(before as never, attributed as never))).toBe(false);
    expect(validationUnaffected([])).toBe(false);
  });
});
