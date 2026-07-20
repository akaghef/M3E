import { describe, expect, test } from "vitest";
import type { LayoutNodePosition } from "../../src/shared/layout_port";
import {
  canonicalSurfaceViewName,
  normalizeNodeDrawStyle,
  type NodeDrawInput,
  type NodeDrawOutput,
  type NodeDrawStyle,
  type NodeDrawSurface,
  type NodeDrawViewState,
} from "../../src/shared/node_draw_port";
import { renderNode } from "../../src/shared/node_draw_svg";

describe("NodeDrawPort contract", () => {
  test("renders a positioned plain node through the public renderer", () => {
    const position: LayoutNodePosition = { x: 100, y: 80, w: 160, h: 40, depth: 1, labelLines: ["Plain"], fontSize: 14 };
    const style: NodeDrawStyle = { fill: "#ffffff", border: "#333333" };
    const view: NodeDrawViewState = {
      selected: false,
      primarySelected: false,
      multiSelected: false,
      linkSource: false,
      cutPending: false,
      reparentSource: false,
      dragSource: false,
      dropTarget: false,
      lockedBy: "none",
    };
    const surface: NodeDrawSurface = { view: "Tree", structuredMode: "Tree", displayRootId: "root" };
    const input: NodeDrawInput = {
      node: {
        id: "plain",
        type: "text",
        kind: "plain",
        label: "Plain",
        text: "Plain",
        alias: "none",
        isFolder: false,
        isScopePortal: false,
        isRoot: false,
        isLatex: false,
      },
      position,
      style,
      view,
      surface,
      content: { kind: "plainLabel", labelLines: ["Plain"], fontSize: 14 },
    };

    const output: NodeDrawOutput = renderNode(input);

    expect(output.bounds).toMatchObject({ x: 100, y: 60, w: 160, h: 40 });
    expect(output.svg).toContain('class="node-hit');
    expect(output.svg).toContain('data-node-id="plain"');
    expect(output.svg).not.toContain("edge-");
    expect(output.svg).not.toContain("markdown");
  });

  test("normalizes style JSON, legacy attrs, and legacy surface names", () => {
    expect(normalizeNodeDrawStyle({
      styleJson: JSON.stringify({ fill: "#abcdef", text: "#111111", urgency: 2, importance: 3, status: "review" }),
      legacy: { "m3e:bg": "#ffffff", "m3e:border": "#222222", "m3e:confidence": "2" },
    })).toMatchObject({
      fill: "#abcdef",
      text: "#111111",
      border: "#222222",
      confidence: 1,
      status: "review",
    });
    expect(canonicalSurfaceViewName("scatter")).toBe("Disperse");
    expect(canonicalSurfaceViewName("timeline")).toBe("Axial");
    expect(canonicalSurfaceViewName("mindmap")).toBe("Tree");
  });
});
