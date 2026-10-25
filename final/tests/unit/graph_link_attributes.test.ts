import { describe, expect, test } from "vitest";

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function linkedModel() {
  const model = new RapidMvpModel("Diagram");
  const source = model.addNode(model.state.rootId, "Source");
  const target = model.addNode(model.state.rootId, "Target");
  return { model, source, target };
}

describe("GraphLink attributes", () => {
  test("addLink copies attributes and preserves them through edit, JSON, undo and redo", () => {
    const { model, source, target } = linkedModel();
    const attributes = { confidence: "declared", note: "  unchanged  " };
    const link = model.addLink(source, target, { attributes, style: "dashed" });
    attributes.confidence = "changed by caller";
    model.editNode(model.state.rootId, "Edited diagram");
    expect(model.state.links[link].attributes).toEqual({ confidence: "declared", note: "  unchanged  " });
    expect(model.state.links[link].style).toBe("dashed");
    const reloaded = RapidMvpModel.fromJSON(JSON.parse(JSON.stringify(model.toJSON())));
    expect(reloaded.validate()).toEqual([]);
    expect(reloaded.state.links[link].attributes).toEqual(model.state.links[link].attributes);
    expect(model.undo()).toBe(true);
    expect(model.state.links[link].attributes.confidence).toBe("declared");
    expect(model.redo()).toBe(true);
    expect(model.state.links[link].attributes.confidence).toBe("declared");
  });

  test.each([null, [], ["value"], "value", 1, false, { confidence: 1 }, { valid: "yes", invalid: null }].map((attributes) => ({ attributes })))(
    "addLink rejects invalid attributes %j without changing state or history", ({ attributes }) => {
      const { model, source, target } = linkedModel();
      const before = model.toJSON();
      const historyLength = model.undoStack.length;
      expect(() => model.addLink(source, target, { attributes })).toThrow(/attributes/i);
      expect(model.toJSON()).toEqual(before);
      expect(model.undoStack).toHaveLength(historyLength);
    },
  );

  test.each([null, [], "value", 1, { confidence: 1 }, { valid: "yes", invalid: false }].map((attributes) => ({ attributes })))(
    "full-state validation rejects invalid attributes %j without sanitizing away evidence", ({ attributes }) => {
      const { model, source, target } = linkedModel();
      const link = model.addLink(source, target);
      const state = model.toJSON();
      state.links[link].attributes = attributes;
      const incoming = RapidMvpModel.fromJSON(state);
      expect(incoming.validate().some((error: string) => /attributes/i.test(error))).toBe(true);
      expect(incoming.state.links[link].attributes).toEqual(attributes);
    },
  );

  test("old links without attributes and empty attributes remain valid", () => {
    const { model, source, target } = linkedModel();
    const oldLink = model.addLink(source, target);
    const emptyLink = model.addLink(source, target, { attributes: {} });
    expect(model.toJSON().links[oldLink]).not.toHaveProperty("attributes");
    expect(model.toJSON().links[emptyLink].attributes).toEqual({});
    expect(model.validate()).toEqual([]);
  });

  test("viewer read keeps own string entries, including literal keys, without mutating input", async () => {
    const { sanitizeGraphLinkAttributes, isGraphLinkAttributes } = await import("../../src/shared/graph_link_attributes");
    const mixed = JSON.parse('{"confidence":"declared","count":2,"__proto__":"literal","blank":""}');
    const kept = sanitizeGraphLinkAttributes(mixed);
    expect(kept).toEqual(JSON.parse('{"confidence":"declared","__proto__":"literal","blank":""}'));
    expect(mixed.count).toBe(2);
    expect(Object.getPrototypeOf(kept)).toBe(Object.prototype);
    expect(isGraphLinkAttributes(mixed)).toBe(false);
    expect(isGraphLinkAttributes(kept)).toBe(true);
    expect(isGraphLinkAttributes(undefined)).toBe(true);
    expect(sanitizeGraphLinkAttributes(undefined)).toBeUndefined();
    for (const value of [null, [], "value", 1, false]) {
      expect(sanitizeGraphLinkAttributes(value)).toBeUndefined();
      expect(isGraphLinkAttributes(value)).toBe(false);
    }
    const inherited = Object.create({ inherited: "ignore" });
    inherited.own = "keep";
    expect(sanitizeGraphLinkAttributes(inherited)).toEqual({ own: "keep" });
  });
});
