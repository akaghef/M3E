import { describe, expect, test } from "vitest";
import { assembleSavedMap, type SavedMapEnvelope } from "../../../src/cutover/envelope/assemble";

const savedAt = "2026-11-11T00:00:00.000Z";

function envelope(overrides: Partial<SavedMapEnvelope> = {}): SavedMapEnvelope {
  return {
    version: 1,
    savedAt,
    tags: ["work", "draft"],
    archived: false,
    pinned: true,
    ...overrides,
  };
}

describe("assembleSavedMap", () => {
  test("外側と state は分かれたまま一つの文書に戻る", () => {
    const outside = envelope({
      mapVersion: 4,
      source: { kind: "obsidian", path: "/synthetic/vault" },
    });
    const state = {
      rootId: "synthetic-root",
      nodes: {
        "synthetic-root": { id: "synthetic-root", text: "合成", marker: "untouched" },
      },
      syntheticOnly: true,
    };

    const document = assembleSavedMap(outside, state);

    expect(document).toEqual({
      version: 1,
      savedAt,
      mapVersion: 4,
      tags: ["work", "draft"],
      archived: false,
      pinned: true,
      source: { kind: "obsidian", path: "/synthetic/vault" },
      state,
    });
    expect(document.state).toBe(state);
    expect(document).not.toBe(outside);
    expect(document.tags).not.toBe(outside.tags);
    expect(document.source).not.toBe(outside.source);
  });

  test("state の中身は読まず、そのまま載せる", () => {
    const state = new Proxy({ marker: "synthetic" }, {
      get(_target, prop) {
        throw new Error(`state was read: ${String(prop)}`);
      },
    });

    const document = assembleSavedMap(envelope(), state);

    expect(document.state).toBe(state);
    expect(document.version).toBe(1);
    expect(document.tags).toEqual(["work", "draft"]);
  });

  test("mapVersion と source が無い外側は、そのキーを文書に足さない", () => {
    const document = assembleSavedMap(envelope(), { rootId: "", nodes: {} });

    expect(document).toEqual({
      version: 1,
      savedAt,
      tags: ["work", "draft"],
      archived: false,
      pinned: true,
      state: { rootId: "", nodes: {} },
    });
    expect(Object.hasOwn(document, "mapVersion")).toBe(false);
    expect(Object.hasOwn(document, "source")).toBe(false);
  });

  test("mapVersion 0 は残る", () => {
    const document = assembleSavedMap(envelope({ mapVersion: 0 }), { untouched: true });
    expect(document.mapVersion).toBe(0);
  });

  test("外側の配列を後から変えても、組み立て済みの文書は変わらない", () => {
    const tags = ["alpha"];
    const document = assembleSavedMap(envelope({ tags }), { untouched: true });
    tags.push("beta");
    document.tags.push("gamma");

    expect(tags).toEqual(["alpha", "beta"]);
    expect(document.tags).toEqual(["alpha", "gamma"]);
  });

  test("version が 1 でない外側は拒否する", () => {
    expect(() => assembleSavedMap(envelope({ version: 2 as 1 }), {})).toThrow(/invalid save format/);
  });

  test("savedAt、mapVersion、tags、archived、pinned、source の形が違う外側は拒否する", () => {
    expect(() => assembleSavedMap(envelope({ savedAt: "" }), {})).toThrow(/savedAt/);
    expect(() => assembleSavedMap(envelope({ mapVersion: Number.NaN }), {})).toThrow(/mapVersion/);
    expect(() => assembleSavedMap(envelope({ tags: "work" as unknown as string[] }), {})).toThrow(/tags/);
    expect(() => assembleSavedMap(envelope({ archived: 1 as unknown as boolean }), {})).toThrow(/archived/);
    expect(() => assembleSavedMap(envelope({ pinned: 0 as unknown as boolean }), {})).toThrow(/pinned/);
    expect(() => assembleSavedMap(envelope({
      source: { kind: "file" as "obsidian", path: "/synthetic/vault" },
    }), {})).toThrow(/source/);
  });
});
