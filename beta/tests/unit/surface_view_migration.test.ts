import { describe, expect, test } from "vitest";
import legacyMap from "../fixtures/layout/legacy-surface-view-map.json";
import { migrateSurfaceViewFromMapRead, type SurfaceViewMapReadState } from "../../src/shared/surface_view_migration";

describe("surface-view map read migration", () => {
  test("restores legacy root attributes while reading persisted map surfaces", () => {
    const state = legacyMap as SurfaceViewMapReadState & { surfaces: Record<string, { scopeId: string; surfaceView?: unknown }> };
    const restored = Object.fromEntries(Object.entries(state.surfaces).map(([surfaceId, surface]) => [
      surfaceId,
      migrateSurfaceViewFromMapRead(state, surface.scopeId, surface.surfaceView),
    ]));

    expect(restored).toEqual({
      "surface:root:tree": { direction: "left/right", space: "loose" },
      "surface:compact-scope:tree": { direction: "left", space: "tight" },
    });
  });

  test("keeps persisted surface-view fields ahead of legacy attributes", () => {
    const state = legacyMap as SurfaceViewMapReadState;
    expect(migrateSurfaceViewFromMapRead(state, "scope:root", { direction: "down", space: "normal" }))
      .toEqual({ direction: "down", space: "normal" });
  });
});
