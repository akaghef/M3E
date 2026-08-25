import { describe, expect, test } from "vitest";
import { layout } from "../../src/shared/layout_port";
import { layoutSamples, toVisibleLayoutGraph } from "../../src/labs/layout/layout_samples";

describe("LayoutResult Disperse contract", () => {
  test("leaves Disperse-only output unset for Tree", () => {
    const sample = layoutSamples.find((item) => item.sample_id === "tree-stress-30")!;
    const result = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, "Tree", sample.input.options);
    expect(result.groups).toBeUndefined();
    expect(result.edges).toBeUndefined();
  });

  test("returns aggregated edges and drawable group boundaries from layout()", () => {
    const sample = layoutSamples.find((item) => item.sample_id === "tree-stress-30")!;
    const result = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, "Disperse", {
      ...sample.input.options,
      disperse: { subtype: "cluster", edgeAggregation: "bundle" },
    });

    expect(result.groups?.length).toBeGreaterThan(0);
    expect(result.edges?.length).toBeGreaterThan(0);
    const group = result.groups![0]!;
    expect(group).toMatchObject({ id: expect.any(String), memberIds: expect.any(Array) });
    expect(group.w).toBeGreaterThan(0);
    expect(group.h).toBeGreaterThan(0);
    console.info(JSON.stringify({ groups: result.groups!.length, firstGroup: group, edges: result.edges!.length }));
  });
});
