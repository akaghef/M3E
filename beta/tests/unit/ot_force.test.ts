import { describe, expect, test } from "vitest";
import { createOtForce, FORCE_DEFAULTS, FORCE_POLICY } from "../../src/shared/ot_force";
import type { ForceGraph, ForceNode, ForceSimulation, ForceSnapshot } from "../../src/shared/force_seam_interface";
import { forceFixture } from "../../src/labs/force/force_fixtures";

const n = (id: string, x: number, y: number, parentId?: string): ForceNode => ({ id, label: id, x, y, w: 120, h: 60, parentId });
function finish(sim: ForceSimulation): ForceSnapshot {
  for (let i = 0; i < FORCE_POLICY.budget + 1 && sim.snapshot().status === "running"; i++) sim.step();
  expect(sim.snapshot().status).not.toBe("running");
  return sim.snapshot();
}
function verifyGeometry(s: ForceSnapshot): void {
  expect(s.violations).toBe(0);
  const nodes = s.nodes;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    expect([a.x, a.y, a.w, a.h].every(Number.isFinite)).toBe(true);
    for (const b of nodes.slice(i + 1)) {
      expect(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + FORCE_POLICY.gap - 1e-4 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2 + FORCE_POLICY.gap - 1e-4).toBe(true);
    }
  }
  for (const g of s.groups) {
    for (const id of g.members) {
      const a = nodes.find(n => n.id === id)!;
      expect(a.x - a.w / 2).toBeGreaterThanOrEqual(g.x + FORCE_POLICY.padding - 1e-4);
      expect(a.y - a.h / 2).toBeGreaterThanOrEqual(g.y + FORCE_POLICY.padding + FORCE_POLICY.header - 1e-4);
      expect(a.x + a.w / 2).toBeLessThanOrEqual(g.x + g.w - FORCE_POLICY.padding + 1e-4);
      expect(a.y + a.h / 2).toBeLessThanOrEqual(g.y + g.h - FORCE_POLICY.padding + 1e-4);
    }
    for (const other of s.groups) {
      if (g.id === other.id || g.members.includes(other.id) || other.members.includes(g.id)) continue;
      expect(g.x + g.w + FORCE_POLICY.gap <= other.x + 1e-4 || other.x + other.w + FORCE_POLICY.gap <= g.x + 1e-4 || g.y + g.h + FORCE_POLICY.gap <= other.y + 1e-4 || other.y + other.h + FORCE_POLICY.gap <= g.y + 1e-4).toBe(true);
    }
  }
}

describe("OT force seam", () => {
  test.each(["nested", "flat", "hundred"])("%s: finite, bounded, rectangular non-overlap and group containment", fixture => {
    for (const mode of ["Disperse", "Radial"] as const) {
      const graph = forceFixture(fixture), before = JSON.stringify(graph);
      const s = finish(createOtForce(graph, mode));
      verifyGeometry(s);
      expect(JSON.stringify(graph)).toBe(before);
      expect(s.nodes).toHaveLength(graph.nodes.length);
      expect(s.steps).toBeLessThanOrEqual(FORCE_POLICY.budget);
      // Non-overlap alone is insufficient: group envelopes must not stretch
      // off-screen indefinitely as external links pull individual members.
      const span = (nodes: ForceNode[], axis: "x" | "y") => Math.max(...nodes.map(n => n[axis])) - Math.min(...nodes.map(n => n[axis]));
      expect(span(s.nodes, "x")).toBeLessThan(Math.max(400, span(graph.nodes, "x")) * 2);
      expect(span(s.nodes, "y")).toBeLessThan(Math.max(400, span(graph.nodes, "y")) * 2);
      expect(s.groups.length > 0).toBe(mode === "Disperse" && fixture === "nested");
    }
  });

  test("deterministic from identical geometry; coincident seeds separate", () => {
    const graph = { nodes: [n("a", 0, 0), n("b", 0, 0), n("c", 0, 0)], links: [] };
    const first = finish(createOtForce(graph)), second = finish(createOtForce(graph));
    expect(first).toEqual(second); verifyGeometry(first);
  });

  test("OT spring parameter changes motion and reheats a stopped simulation", () => {
    const graph = { nodes: [n("a", -250, 0), n("b", 250, 0)], links: [{ id: "ab", source: "a", target: "b" }] };
    const sim = createOtForce(graph);
    sim.setParameters({ spring: 0, gravity: 0 });
    const resting = finish(sim);
    expect(resting.status).toBe("settled");
    expect(resting.nodes[0].x).toBe(-250);
    sim.setParameters({ spring: .04 });
    expect(sim.snapshot().status).toBe("running");
    const active = sim.step();
    expect(active.nodes[0].x).toBeGreaterThan(-250);
    expect(active.nodes[1].x).toBeLessThan(250);
    expect(active.parameters.length).toBe(FORCE_DEFAULTS.length);
  });

  test("Tree-style collapse keeps parent identity and aggregates only visible relations", () => {
    const graph: ForceGraph = { nodes: [n("a", -300, 0), n("b", -500, 100, "a"), n("c", -200, 100, "a"), n("d", 300, 0)],
      links: [{ id: "bd", source: "b", target: "d" }, { id: "cd", source: "c", target: "d" }, { id: "bc", source: "b", target: "c" }] };
    const sim = createOtForce(graph);
    sim.setCollapsed("a", true);
    expect(sim.snapshot().nodes.map(n => n.id)).toEqual(["a", "d"]);
    expect(sim.snapshot().nodes[0]).toMatchObject({ w: 120, h: 60, hiddenCount: 2 });
    expect(sim.snapshot().links).toHaveLength(1);
    expect(sim.snapshot().links[0]).toMatchObject({ source: "a", target: "d", weight: 2 });
    sim.beginDrag("a"); sim.moveDrag(90, 40); sim.endDrag();
    sim.setCollapsed("a", false);
    expect(sim.snapshot().nodes.find(n => n.id === "b")).toMatchObject({ x: -410, y: 140, parentId: "a" });
    expect(sim.snapshot().links).toHaveLength(3);
    expect(sim.snapshot().nodes.map(n => n.id)).toEqual(["a", "b", "c", "d"]);
    sim.setMode("Radial");
    expect(sim.snapshot().links.filter(e => e.kind === "tree")).toHaveLength(2);
    expect(sim.snapshot().groups).toEqual([]);
  });

  test("nested collapse restores relative coordinates once, not twice", () => {
    const sim = createOtForce({ nodes: [n("a", 0, 0), n("b", 100, 0, "a"), n("c", 200, 0, "b")], links: [] });
    sim.setCollapsed("b", true); sim.setCollapsed("a", true);
    sim.beginDrag("a"); sim.moveDrag(50, 20); sim.endDrag();
    sim.setCollapsed("a", false); sim.setCollapsed("b", false);
    expect(sim.snapshot().nodes.find(n => n.id === "c")).toMatchObject({ x: 250, y: 20 });
  });

  test("pin stays fixed; group drag moves members together and restores pin state", () => {
    const sim = createOtForce(forceFixture("nested"));
    sim.setPinned("design", true);
    const before = sim.snapshot().nodes.find(n => n.id === "design")!;
    finish(sim);
    expect(sim.snapshot().nodes.find(n => n.id === "design")).toMatchObject({ x: before.x, y: before.y, pinned: true });
    const group = sim.snapshot().groups.find(g => g.id === "design")!;
    const positions = new Map(sim.snapshot().nodes.map(n => [n.id, { x: n.x, y: n.y }]));
    sim.beginDrag("design", true); sim.moveDrag(60, -20); sim.endDrag();
    for (const id of group.members) expect(sim.snapshot().nodes.find(n => n.id === id)).toMatchObject({ x: positions.get(id)!.x + 60, y: positions.get(id)!.y - 20 });
    expect(sim.snapshot().nodes.find(n => n.id === "design")!.pinned).toBe(true);
  });

  test("unsatisfiable fixed collision is blocked, never reported as convergence", () => {
    const sim = createOtForce(forceFixture("blocked")), before = sim.snapshot().nodes;
    const result = finish(sim);
    expect(result.status).toBe("blocked"); expect(result.violations).toBeGreaterThan(0);
    expect(result.nodes).toEqual(before);
  });

  test("pause is immutable; reheat has a hard budget even during drag", () => {
    const sim = createOtForce(forceFixture("flat"));
    sim.pause(); const paused = sim.snapshot(); sim.step(); expect(sim.snapshot()).toEqual(paused);
    sim.beginDrag("human");
    const result = finish(sim);
    expect(["budget", "blocked"]).toContain(result.status);
    expect(result.remaining).toBe(0);
    sim.endDrag(); expect(sim.snapshot().status).toBe("running");
  });

  test("empty, singleton, input copies, reset vs settings reset", () => {
    expect(createOtForce({ nodes: [], links: [] }).step().status).toBe("settled");
    expect(finish(createOtForce({ nodes: [n("a", 0, 0)], links: [] })).status).toBe("settled");
    const graph = forceFixture("flat"), sim = createOtForce(graph);
    graph.nodes[0].x = 9999; graph.links.length = 0;
    sim.setParameters({ length: 200 }); sim.resetPositions();
    expect(sim.snapshot().parameters.length).toBe(200);
    expect(sim.snapshot().nodes[0].x).not.toBe(9999);
    expect(sim.snapshot().links).toHaveLength(4);
    const before = sim.snapshot().nodes; sim.setParameters({ ...FORCE_DEFAULTS }); expect(sim.snapshot().nodes).toEqual(before);
  });

  test("reject invalid geometry, hierarchy, endpoints, parameters without partial mutation", () => {
    expect(() => createOtForce({ nodes: [n("a", NaN, 0)], links: [] })).toThrow();
    expect(() => createOtForce({ nodes: [n("a", 0, 0), n("a", 1, 1)], links: [] })).toThrow();
    expect(() => createOtForce({ nodes: [{ ...n("a", 0, 0), w: -1 }], links: [] })).toThrow();
    expect(() => createOtForce({ nodes: [n("a", 0, 0, "b"), n("b", 0, 0, "a")], links: [] })).toThrow();
    expect(() => createOtForce({ nodes: [n("a", 0, 0)], links: [{ id: "bad", source: "a", target: "missing" }] })).toThrow();
    const sim = createOtForce(forceFixture("flat")); const before = sim.snapshot();
    expect(() => sim.setParameters({ length: 200, repulsion: Infinity })).toThrow();
    expect(sim.snapshot()).toEqual(before);
    expect(() => sim.moveDrag(NaN, 0)).toThrow();
  });
});
