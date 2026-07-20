import { renderToString } from "katex";
import type { NodeDrawInput, SurfaceViewName } from "../../shared/node_draw_port";

export type NodeLabSampleId =
  | "plain"
  | "long-wrap"
  | "multiline"
  | "root"
  | "folder"
  | "alias-read"
  | "alias-write"
  | "alias-broken"
  | "selected"
  | "multi"
  | "cut"
  | "link-source"
  | "collapsed"
  | "scope-locked"
  | "fill"
  | "color"
  | "border"
  | "status"
  | "confidence"
  | "katex";

export interface NodeLabSample {
  sample_id: NodeLabSampleId;
  input: NodeDrawInput;
}

export const surfaceViews: SurfaceViewName[] = ["Tree", "Axial", "Radial", "Disperse", "System"];

function renderLatex(source: string): { html: string; displayMode: boolean } {
  const displayMode = false;
  return {
    html: renderToString(source, { displayMode, throwOnError: false }),
    displayMode,
  };
}

const base = {
  selected: false,
  primarySelected: false,
  multiSelected: false,
  linkSource: false,
  cutPending: false,
  reparentSource: false,
  dragSource: false,
  dropTarget: false,
  lockedBy: "none" as const,
};

interface NodeSampleOverrides {
  node?: Partial<NodeDrawInput["node"]>;
  position?: Partial<NodeDrawInput["position"]>;
  style?: Partial<NodeDrawInput["style"]>;
  view?: Partial<NodeDrawInput["view"]>;
  surface?: Partial<NodeDrawInput["surface"]>;
  content?: NodeDrawInput["content"];
}

function sample(
  sample_id: NodeLabSampleId,
  overrides: NodeSampleOverrides,
): NodeLabSample {
  const label = sample_id.replace(/-/g, " ");
  return {
    sample_id,
    input: {
      node: {
        id: sample_id,
        type: "text",
        kind: "plain",
        label,
        text: label,
        alias: "none",
        isFolder: false,
        isScopePortal: false,
        isRoot: false,
        isLatex: false,
        ...overrides.node,
      },
      position: {
        x: 120,
        y: 90,
        w: 180,
        h: 42,
        depth: 1,
        labelLines: [label],
        fontSize: 14,
        ...overrides.position,
      },
      style: {
        ...overrides.style,
      },
      view: {
        ...base,
        ...overrides.view,
      },
      surface: {
        view: "Tree",
        structuredMode: "Tree",
        displayRootId: "root",
        rootless: false,
        ...overrides.surface,
      },
      content: overrides.content || { kind: "plainLabel", labelLines: [label], fontSize: 14 },
    },
  };
}

export function withSurface(input: NodeDrawInput, view: SurfaceViewName): NodeDrawInput {
  return {
    ...input,
    surface: { ...input.surface, view, structuredMode: view },
    position: view === "Disperse"
      ? { ...input.position, w: 72, h: 72, scatterCollapsedGroup: input.node.isFolder }
      : input.position,
  };
}

export const nodeLabSamples: NodeLabSample[] = [
  sample("plain", {}),
  sample("long-wrap", {
    position: { w: 220, h: 66, labelLines: ["A deliberately long", "wrapped node label"], fontSize: 14 },
    content: { kind: "plainLabel", labelLines: ["A deliberately long", "wrapped node label"], fontSize: 14 },
  }),
  sample("multiline", {
    position: { h: 74, labelLines: ["Line one", "Line two", "Line three"], fontSize: 13 },
    content: { kind: "plainLabel", labelLines: ["Line one", "Line two", "Line three"], fontSize: 13 },
  }),
  sample("root", {
    node: { id: "root", kind: "root", isRoot: true, label: "Root Node" },
    position: { x: 80, y: 100, w: 260, h: 72, depth: 0, labelLines: ["Root Node"], fontSize: 18 },
    content: { kind: "plainLabel", labelLines: ["Root Node"], fontSize: 18, textAnchor: "middle" },
  }),
  sample("folder", {
    node: { type: "folder", kind: "folder", isFolder: true, label: "Folder Scope", badge: "scope" },
    position: { w: 210, h: 58, labelLines: ["Folder Scope"] },
    content: { kind: "plainLabel", labelLines: ["Folder Scope"], fontSize: 14 },
  }),
  sample("alias-read", {
    node: { type: "alias", alias: "read", label: "Read Alias", badge: "read" },
    content: { kind: "plainLabel", labelLines: ["Read Alias"], fontSize: 14 },
  }),
  sample("alias-write", {
    node: { type: "alias", alias: "write", label: "Write Alias", badge: "write" },
    content: { kind: "plainLabel", labelLines: ["Write Alias"], fontSize: 14 },
  }),
  sample("alias-broken", {
    node: { type: "alias", alias: "broken", label: "Broken Alias", badge: "broken", snapshotLabel: "Deleted" },
    content: { kind: "plainLabel", labelLines: ["Broken Alias"], fontSize: 14 },
  }),
  sample("selected", { view: { selected: true, primarySelected: true, multiSelected: true } }),
  sample("multi", { view: { selected: true, multiSelected: true } }),
  sample("cut", { view: { cutPending: true } }),
  sample("link-source", { view: { linkSource: true } }),
  sample("collapsed", { view: { collapsedCount: 12 } }),
  sample("scope-locked", {
    node: { type: "folder", kind: "folder", isFolder: true, label: "Locked Scope", badge: "scope" },
    view: { lockedBy: "other" },
    content: { kind: "plainLabel", labelLines: ["Locked Scope"], fontSize: 14 },
  }),
  sample("fill", { style: { fill: "#dff3ff" } }),
  sample("color", { style: { text: "#9b2f2f" } }),
  sample("border", { style: { border: "#2d5bd1", borderStyle: "dashed", borderWidth: 3, shape: "rounded" } }),
  sample("status", { style: { status: "review" } }),
  sample("confidence", { style: { confidence: 0.82 } }),
  sample("katex", {
    node: { kind: "latex", label: "KaTeX", isLatex: true },
    position: { w: 180, h: 58, labelLines: ["KaTeX"] },
    content: {
      kind: "latexHtml",
      ...renderLatex("x^2+y^2"),
    },
  }),
];
