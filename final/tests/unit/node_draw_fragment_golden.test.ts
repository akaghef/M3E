import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { nodeLabSamples, withSurface, type NodeLabSampleId } from "../../src/labs/node/node_samples";
import { renderNode } from "../../src/shared/node_draw_svg";

interface GoldenSelectorSample {
  schema_version: 1;
  sample_id: NodeLabSampleId;
  selectors: string[];
}

const selectorFixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../fixtures/node-draw-golden/samples.json"), "utf8"),
) as GoldenSelectorSample[];

function normalizeFragment(svg: string): string {
  return svg.replace(/>\s+</g, "><").trim();
}

describe("nodeDraw fragment golden parity", () => {
  test("node-lab samples cover first-ratchet variants", () => {
    expect(nodeLabSamples.map((sample) => sample.sample_id)).toEqual([
      "plain",
      "long-wrap",
      "multiline",
      "root",
      "folder",
      "alias-read",
      "alias-write",
      "alias-broken",
      "selected",
      "multi",
      "cut",
      "link-source",
      "collapsed",
      "scope-locked",
      "fill",
      "color",
      "border",
      "status",
      "confidence",
      "katex",
    ]);
  });

  test("plain sample has deterministic fragment snapshot", () => {
    const sample = nodeLabSamples.find((item) => item.sample_id === "plain")!;
    const output = renderNode(sample.input);
    expect(normalizeFragment(output.svg)).toBe('<rect class="node-hit" data-node-id="plain" x="112" y="69" width="216" height="42" rx="12" /><text class="label-node" data-node-id="plain" x="120" y="94.9" text-anchor="start" style="font-size:14px"><tspan x="120">plain</tspan></text>');
    expect(output.bounds).toMatchObject({ x: 120, y: 69, w: 180, h: 42 });
  });

  test.each(selectorFixtures)("$sample_id emits required node-only selectors", (fixture) => {
    const sample = nodeLabSamples.find((item) => item.sample_id === fixture.sample_id);
    expect(sample, fixture.sample_id).toBeTruthy();
    const output = renderNode(sample!.input);
    for (const selector of fixture.selectors) {
      expect(output.svg, `${fixture.sample_id} ${selector}`).toContain(selector.replace(/^\./, ""));
    }
    expect(output.svg).not.toContain("flow-preview-edge");
    expect(output.svg).not.toContain("graph-link");
    expect(output.svg).not.toContain("markdown");
  });

  test("Disperse surface renders scatter circle without calling layout or edge", () => {
    const sample = nodeLabSamples.find((item) => item.sample_id === "folder")!;
    const output = renderNode(withSurface(sample.input, "Disperse"));
    expect(output.svg).toContain("scatter-node-circle");
    expect(output.svg).not.toContain("<path class=\"edge");
  });
});
