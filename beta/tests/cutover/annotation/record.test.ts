import { describe, expect, test } from "vitest";
import type { MapAnnotation } from "../../../src/shared/types";
import { recordAnnotations, restoreAnnotations } from "../../../src/cutover/annotation/record";

describe("annotation record / restore", () => {
  test("pen と text は辞書キー順のまま往復する", () => {
    const annotations: Record<string, MapAnnotation> = {
      "pen-key": {
        id: "pen-1",
        kind: "pen",
        scopeId: "scope-a",
        d: "M 0 0 L 12.5 8",
        points: [
          { x: 0, y: 0 },
          { x: 12.5, y: 8 },
        ],
        stroke: "#f6e27a",
        strokeWidth: 18,
        opacity: 0.35,
        createdAt: "2026-11-11T00:00:00.000Z",
      },
      "date-key": {
        id: "date-1",
        kind: "text",
        scopeId: "scope-a",
        x: 40,
        y: 64,
        text: "11/11",
        fill: "#243044",
        fontSize: 18,
        fontWeight: 650,
        variant: "date",
        createdAt: "2026-11-11T00:00:01.000Z",
      },
      "label-key": {
        id: "label-key",
        kind: "text",
        x: 0,
        y: -4,
        text: "合成ラベル",
        fill: "#111111",
        fontSize: 14,
      },
    };

    const ledger = recordAnnotations(annotations);
    const restored = restoreAnnotations(ledger);

    expect(ledger.absent).toBe(false);
    expect(ledger.records.map((record) => record.key)).toEqual(["pen-key", "date-key", "label-key"]);
    expect(ledger.records[0]).toMatchObject({ key: "pen-key", id: "pen-1", kind: "pen", opacity: 0.35 });
    expect(ledger.records[1]).toMatchObject({ key: "date-key", id: "date-1", kind: "text", variant: "date" });
    expect(restored).toEqual(annotations);
    expect(restored).not.toBe(annotations);
    expect(Object.keys(restored!)).toEqual(["pen-key", "date-key", "label-key"]);

    const pen = annotations["pen-key"];
    if (pen?.kind === "pen") {
      pen.points[0]!.x = 999;
    }
    const restoredPen = restored!["pen-key"];
    expect(restoredPen?.kind === "pen" && restoredPen.points[0]?.x).toBe(0);
    expect(ledger.records[0]?.kind === "pen" && ledger.records[0].points[0]?.x).toBe(0);
  });

  test("annotations が無いときは無いまま、空オブジェクトは空のまま", () => {
    const absent = recordAnnotations(undefined);
    expect(absent).toEqual({ absent: true, records: [] });
    expect(restoreAnnotations(absent)).toBeUndefined();

    const empty = recordAnnotations({});
    expect(empty).toEqual({ absent: false, records: [] });
    expect(restoreAnnotations(empty)).toEqual({});
  });
});
