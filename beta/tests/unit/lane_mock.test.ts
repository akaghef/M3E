// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import { computeLaneLayout, laneLinkGeometry } from "../../src/shared/lane_layout";
import { projectLane } from "../../src/shared/lane_view";
import { laneFrames, laneNodeInput } from "../../src/browser/lane_scene";
import { renderNode } from "../../src/shared/node_draw_svg";
import { nodeLabSamples } from "../../src/labs/node/node_samples";
import type { AppState, GraphLink } from "../../src/shared/types";
import asys from "../fixtures/lane_asys.json";

// Exercise the existing viewer's pure curve functions without starting its UI
// or creating another product geometry module just for these tests.
const viewer = ts.createSourceFile("viewer.ts", fs.readFileSync(path.join(__dirname, "../../src/browser/viewer.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const names = ["edgePortNormal", "graphLinkControlPoints", "graphLinkPathWithPorts", "graphLinkLabelPointWithPorts", "cubicPointAtHalf", "graphLinkPathForRoute"];
const functions = viewer.statements.filter(s => ts.isFunctionDeclaration(s) && names.includes(s.name?.text ?? "")).map(s => s.getText(viewer)).join("\n");
const common = new Function(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText + ";return {graphLinkPathForRoute,graphLinkControlPoints,graphLinkLabelPointWithPorts};")();

function mock(direction: "down" | "right") {
  const state = structuredClone(asys.state) as AppState, projection = projectLane(state, "asys", new Set());
  const metrics = Object.fromEntries(Object.keys(state.nodes).map((id, i) => [id, {
    w: 90 + i % 4 * 35, h: 34 + i % 3 * 18, labelLines: [state.nodes[id].text],
  }]));
  const result = computeLaneLayout({ projection, metrics, direction, space: "normal" });
  result.lane!.rootLabel = state.nodes.asys.text;
  return { state, projection, result };
}

for (const direction of ["down", "right"] as const) {
  test(`${direction}: M6/M7/M8/M11 A-sys has equal section centers across differently populated lanes`, () => {
    const { result, projection } = mock(direction), down = direction === "down", bands = result.lane!.boundaries;
    expect(bands.map(b => b.id)).toEqual(asys.state.nodes.asys.children);
    expect(new Set(bands.map(b => down ? b.h : b.w)).size).toBe(1);
    // Infer the shared interval from the three AI children, then verify all
    // other counts (including five and six). Left packing cannot satisfy it.
    const first = projection.lanes[0].nodeIds.map(id => result.pos[id]);
    const center = (p: typeof first[number]) => down ? p.x + p.w / 2 : p.y;
    const step = (center(first.at(-1)!) - center(first[0])) / (first.length - 1);
    const start = center(first[0]) - step / 2, extent = step * first.length;
    projection.lanes.forEach((lane, i) => {
      const band = bands[i];
      lane.nodeIds.forEach((id, j) => {
        const p = result.pos[id];
        expect(center(p)).toBeCloseTo(start + extent * (j + 0.5) / lane.nodeIds.length);
        expect(down ? p.y : p.x + p.w / 2).toBeCloseTo(down ? band.y + band.h / 2 : band.x + band.w / 2);
        expect(down ? p.x >= start && p.x + p.w <= start + extent : p.y - p.h / 2 >= start && p.y + p.h / 2 <= start + extent).toBe(true);
      });
      expect(band.count).toBe(lane.nodeIds.length);
    });
    expect(down ? start > bands[0].x : start > bands[0].y).toBe(true);
  });

  test(`${direction}: M9/M10/M12 all 82 A-sys links face the other lane or form a same-lane arc`, () => {
    const { state, result, projection } = mock(direction), before = structuredClone(state), down = direction === "down";
    const laneOf = Object.fromEntries(projection.lanes.flatMap((lane, i) => lane.nodeIds.map(id => [id, i])));
    let sameCount = 0, crossCount = 0;
    for (const link of projection.links) {
      const ports = laneLinkGeometry(result, link), a = result.pos[link.sourceNodeId], b = result.pos[link.targetNodeId];
      const same = laneOf[link.sourceNodeId] === laneOf[link.targetNodeId], backwards = laneOf[link.targetNodeId] < laneOf[link.sourceNodeId];
      const sourceSide = down ? (!same && backwards ? "top" : "bottom") : (!same && backwards ? "left" : "right");
      const targetSide = same ? sourceSide : down ? (backwards ? "bottom" : "top") : (backwards ? "right" : "left");
      expect(ports.source.side).toBe(sourceSide); expect(ports.target.side).toBe(targetSide);
      if (down) {
        expect(ports.source.x).toBeCloseTo(a.x + a.w / 2); expect(ports.target.x).toBeCloseTo(b.x + b.w / 2);
        expect(ports.source.y).toBe(a.y + (sourceSide === "top" ? -a.h / 2 : a.h / 2));
        expect(ports.target.y).toBe(b.y + (targetSide === "top" ? -b.h / 2 : b.h / 2));
      } else {
        expect(ports.source.y).toBe(a.y); expect(ports.target.y).toBe(b.y);
        expect(ports.source.x).toBe(a.x + (sourceSide === "left" ? 0 : a.w));
        expect(ports.target.x).toBe(b.x + (targetSide === "left" ? 0 : b.w));
      }
      const path = common.graphLinkPathForRoute(ports.source, ports.target, "simple-bezier");
      expect(path).toContain(" C ");
      const controls = common.graphLinkControlPoints(ports.source, ports.target);
      if (down) { expect(controls.c1x).toBe(ports.source.x); expect(controls.c2x).toBe(ports.target.x); }
      else { expect(controls.c1y).toBe(ports.source.y); expect(controls.c2y).toBe(ports.target.y); }
      if (same) {
        sameCount++;
        const midpoint = common.graphLinkLabelPointWithPorts(ports.source, ports.target);
        expect(down ? midpoint.y > Math.max(ports.source.y, ports.target.y) : midpoint.x > Math.max(ports.source.x, ports.target.x)).toBe(true);
      } else crossCount++;
    }
    expect(sameCount).toBe(3); expect(crossCount).toBe(79); expect(state).toEqual(before);
  });

  test(`${direction}: explicit LinkPort overrides automatic sides independently`, () => {
    const { result, projection } = mock(direction), original = projection.links.find(l => l.sourceNodeId !== l.targetNodeId)!;
    for (const sourcePort of ["left", "right", "top", "bottom"] as const) {
      const link: GraphLink = { ...original, sourcePort, targetPort: "left" };
      expect(laneLinkGeometry(result, link)).toMatchObject({ source: { side: sourcePort }, target: { side: "left" } });
      expect(laneLinkGeometry(result, { ...link, targetPort: "auto" }).target.side).toBe(laneLinkGeometry(result, original).target.side);
    }
  });
}

test("M1/M4 root heading and lane counts accompany the scene without drawing a root box", () => {
  const { result } = mock("down"), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = laneFrames(result, s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;"));
  expect(svg.querySelector(".lane-heading")?.textContent).toBe("Akaghef-System 構成");
  expect([...svg.querySelectorAll(".lane-count")].map(n => n.textContent)).toEqual(["3 個", "3 個", "5 個", "6 個", "5 個", "3 個"]);
  // The root is a selectable heading, not a node card.
  expect(svg.querySelector('.node-hit[data-node-id="asys"], .node-visual-box[data-node-id="asys"]')).toBeNull();
  expect(svg.querySelector('.lane-heading[data-node-id="asys"]')).not.toBeNull();
});

test("M2 labels remain in the existing node renderer and selection keeps its common state", () => {
  const base = structuredClone(nodeLabSamples.find(s => s.sample_id === "plain")!.input);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.innerHTML = renderNode(laneNodeInput(base, true)).svg;
  expect(svg.querySelector(".node-shape")).not.toBeNull();
  expect(svg.querySelector(".label-node")?.textContent).toBe(base.node.label);
  expect(laneNodeInput(base, false)).toBe(base);
  const selected = laneNodeInput({ ...base, style: {}, view: { ...base.view, selected: true } }, true);
  expect(selected.style.fill).toBeUndefined();
  expect(renderNode(selected).svg).toContain("node-visual-box selected");
});
