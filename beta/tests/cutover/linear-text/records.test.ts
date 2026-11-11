import { describe, expect, test } from "vitest";
import { fromLinearTextRecords, toLinearTextRecords } from "../../../src/cutover/linear-text/records";

describe("linear-text records", () => {
  test("二つの scope の本文は混ざらず往復する", () => {
    const fields = Object.freeze({
      linearNotesByScope: Object.freeze({ "scope-a": "A", "scope-b": "B" }),
      linearTextFontScale: 1.1,
      linearPanelWidth: 340,
    });

    const records = toLinearTextRecords(fields);
    const restored = fromLinearTextRecords(records);

    expect(records.bodies).toEqual([
      { scopeId: "scope-a", body: "A" },
      { scopeId: "scope-b", body: "B" },
    ]);
    expect(records.notesPresent).toBe(true);
    expect(restored).toEqual({
      linearNotesByScope: { "scope-a": "A", "scope-b": "B" },
      linearTextFontScale: 1.1,
      linearPanelWidth: 340,
    });
    expect(restored.linearNotesByScope?.["scope-a"]).toBe("A");
    expect(restored.linearNotesByScope?.["scope-b"]).toBe("B");
    expect(restored.linearNotesByScope?.["scope-a"]).not.toBe(restored.linearNotesByScope?.["scope-b"]);
    expect(fields.linearNotesByScope).toEqual({ "scope-a": "A", "scope-b": "B" });
    expect(records.bodies[0]?.body).toBe("A");
  });

  test("同じ scope の本文は二つに割れない", () => {
    expect(() => fromLinearTextRecords({
      notesPresent: true,
      bodies: [
        { scopeId: "scope-a", body: "A" },
        { scopeId: "scope-a", body: "B" },
      ],
    })).toThrow(/Duplicate scope: scope-a/);
  });
});
