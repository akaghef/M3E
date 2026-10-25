import { describe, it, expect } from "vitest";

const { reorderInsertionIndex } = require("../../dist/shared/reorder_insertion.js");

// The viewer move command accepts an index BEFORE removing the source.
function applyMove(children, source, index) {
  const oldIndex = children.indexOf(source);
  if (oldIndex >= 0 && oldIndex < index) index -= 1;
  const remaining = children.filter(id => id !== source);
  remaining.splice(index, 0, source);
  return remaining;
}

describe("visible reorder slot to move-command index", () => {
  const children = ["1", "2", "3", "4", "5"];
  for (const source of children) {
    const remaining = children.filter(id => id !== source);
    for (let slot = 0; slot <= remaining.length; slot += 1) {
      it(`moves ${source} to slot ${slot}, including no-op and tail`, () => {
        const expected = [...remaining];
        expected.splice(slot, 0, source);
        const index = reorderInsertionIndex(children, remaining, slot);
        expect(applyMove(children, source, index)).toEqual(expected);
        expect(children).toEqual(["1", "2", "3", "4", "5"]);
      });
    }
  }

  it("resolves a visible slot through sibling IDs, not filtered array indices", () => {
    const all = ["1", "hidden-a", "2", "hidden-b", "3"];
    const index = reorderInsertionIndex(all, ["2", "3"], 1);
    expect(applyMove(all, "1", index)).toEqual(["hidden-a", "2", "hidden-b", "1", "3"]);
  });

  it("places a visible-tail drop directly after the last visible sibling", () => {
    const all = ["1", "2", "3", "hidden-tail"];
    const index = reorderInsertionIndex(all, ["2", "3"], 2);
    expect(applyMove(all, "1", index)).toEqual(["2", "3", "1", "hidden-tail"]);
  });

  it("also handles a node arriving from another parent", () => {
    for (let slot = 0; slot <= children.length; slot += 1) {
      const expected = [...children];
      expected.splice(slot, 0, "external");
      expect(applyMove(children, "external", reorderInsertionIndex(children, children, slot))).toEqual(expected);
    }
  });
});
