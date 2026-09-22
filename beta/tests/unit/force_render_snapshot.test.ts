import { describe, expect, it } from "vitest";
import type { ForceSnapshot } from "../../src/shared/force_seam_interface";
import { forceRenderCamera, forceRenderSnapshot, hitForceGroupHeader } from "../../src/labs/force/force_render_snapshot";
import { labelAtlasKey, worldToScreen } from "../../src/rendering/webgl_projection";

function fixture(): ForceSnapshot {
  return {
    mode: "Disperse", status: "paused", steps: 3, remaining: 0, maxMove: 0, violations: 0,
    parameters: { repulsion: 100, length: 100, spring: 0.1, gravity: 0.1 },
    nodes: [
      { id: "a", label: "親", x: -100, y: -50, w: 80, h: 40, pinned: true, collapsed: true, hiddenCount: 3 },
      { id: "b", label: "子", x: 100, y: -50, w: 100, h: 60, collapsed: false, hiddenCount: 0 },
    ],
    groups: [
      { id: "outer", label: "外箱", x: -180, y: -120, w: 400, h: 200, members: ["a", "b"] },
      { id: "inner", label: "内箱", x: -160, y: -115, w: 120, h: 100, members: ["a"] },
    ],
    links: [
      { id: "tree", source: "a", target: "b", kind: "tree", weight: 1 },
      { id: "related", source: "b", target: "a", kind: "graph", weight: 4 },
    ],
  };
}

describe("ForceSnapshot rendering adapter", () => {
  it("converts world centres to top-left rectangles and includes negative group bounds", () => {
    const result = forceRenderSnapshot(fixture());
    expect(result.nodes[0]).toMatchObject({ id: "a", x: -140, y: -70, width: 80, height: 40 });
    expect(result.nodes[1]).toMatchObject({ id: "b", x: 50, y: -80, width: 100, height: 60 });
    expect(result.bounds).toEqual({ minX: -180, minY: -120, maxX: 220, maxY: 80 });
    expect(result.revision).toBe("Disperse:3");
  });

  it("does not clamp an entirely negative scene to the origin", () => {
    const input = fixture();
    input.nodes = input.nodes.slice(0, 1); input.groups = []; input.links = [];
    expect(forceRenderSnapshot(input).bounds).toEqual({ minX: -140, minY: -70, maxX: -60, maxY: -30 });
    input.nodes = [];
    expect(forceRenderSnapshot(input).bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it("preserves tree/GraphLink identity, rectangle endpoints, dashes and aggregate labels", () => {
    const result = forceRenderSnapshot(fixture());
    expect(result.edges).toHaveLength(1);
    expect(result.graphLinks).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ id: "tree", kind: "edge", sourceNodeId: "a", targetNodeId: "b",
      dash: [5, 4], points: [{ x: -60, y: -50 }, { x: 50, y: -50 }] });
    expect(result.graphLinks[0]).toMatchObject({ id: "related", kind: "graph-link", sourceNodeId: "b", targetNodeId: "a",
      points: [{ x: 50, y: -50 }, { x: -60, y: -50 }] });
    expect(result.graphLinks[0]?.dash).toBeUndefined();
    expect(result.labels?.find(label => label.id === "weight:related")?.lines).toEqual(["×4"]);
    expect(result.labels?.some(label => label.id === "weight:tree")).toBe(false);
  });

  it("retains pin/collapse labels and group headers without inventing physics nodes", () => {
    const result = forceRenderSnapshot(fixture(), "a");
    expect(result.nodes.map(node => node.id)).toEqual(["a", "b"]);
    expect(result.nodes[0]).toMatchObject({ labelLines: ["親", "PIN · +3 hidden"], strokeDash: [4, 3] });
    expect(result.groups.map(group => group.id)).toEqual(["outer", "inner"]);
    expect(result.groups[0]).toMatchObject({ memberIds: ["a", "b"], headerHeight: 28 });
    expect(result.labels?.find(label => label.id === "group:inner")).toMatchObject({ lines: ["内箱 · 1"], align: "left" });
  });

  it("prefers a nested header, excluding box bodies and points outside the header", () => {
    const input = fixture();
    expect(hitForceGroupHeader(input, { x: -150, y: -110 })).toBe("inner");
    expect(hitForceGroupHeader(input, { x: 100, y: -110 })).toBe("outer");
    expect(hitForceGroupHeader(input, { x: -150, y: -60 })).toBeNull();
    expect(hitForceGroupHeader(input, { x: -181, y: -110 })).toBeNull();
  });

  it("maps the force camera centre to viewport centre at arbitrary zoom", () => {
    const camera = forceRenderCamera({ x: -120, y: 40, scale: 2.5 }, 800, 600);
    expect(camera).toEqual({ x: 700, y: 200, zoom: 2.5 });
    expect(worldToScreen({ x: -120, y: 40 }, camera)).toEqual({ x: 400, y: 300 });
    expect(worldToScreen({ x: -100, y: 20 }, camera)).toEqual({ x: 450, y: 250 });
  });

  it("does not mutate or share mutable group membership with the force snapshot", () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = forceRenderSnapshot(input);
    hitForceGroupHeader(input, { x: 0, y: 0 });
    result.groups[0]!.memberIds.push("render-only");
    expect(input).toEqual(before);
  });

  it("rejects dangling visible endpoints instead of dropping a relation silently", () => {
    const input = fixture(); input.links[0]!.target = "missing";
    expect(() => forceRenderSnapshot(input)).toThrow("Missing visible endpoint: tree");
  });
});

describe("label atlas cache key", () => {
  it("ignores positions, group box motion/size and selection decoration", () => {
    const input = fixture();
    const key = labelAtlasKey(forceRenderSnapshot(input));
    input.nodes.forEach(node => { node.x += 37; node.y -= 19; });
    input.groups.forEach(group => { group.x += 37; group.y -= 19; group.w += 50; });
    expect(labelAtlasKey(forceRenderSnapshot(input, "a"))).toBe(key);
  });

  it("invalidates for text, label width, style and aggregate-weight changes", () => {
    const base = forceRenderSnapshot(fixture());
    const key = labelAtlasKey(base);
    const changedText = structuredClone(base); changedText.nodes[0]!.labelLines[0] = "改名";
    const changedWidth = structuredClone(base); changedWidth.nodes[0]!.width += 1;
    const changedStyle = structuredClone(base); changedStyle.nodes[0]!.textColor = "#ffffff";
    const changedWeight = structuredClone(base); changedWeight.labels!.find(label => label.id === "weight:related")!.lines = ["×5"];
    for (const changed of [changedText, changedWidth, changedStyle, changedWeight]) expect(labelAtlasKey(changed)).not.toBe(key);
  });
});
