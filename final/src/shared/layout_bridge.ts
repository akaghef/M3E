import {
  layout,
  type LayoutNodeMetric,
  type LayoutOptions,
  type LayoutResult,
  type VisibleLayoutGraph,
} from "./layout_port";

export type LayoutMode = "tree" | "mindmap" | "logic-chart" | "timeline";

export interface LayoutGraph {
  nodeIds: string[];
  childrenOf: (id: string) => string[];
  graphLinks: unknown[];
}

export type {
  LayoutBranchDirection,
  LayoutDensity,
  LayoutDepthAlign,
  LayoutDirection,
  LayoutNodeMetric,
  LayoutNodePosition,
  LayoutOptions,
  LayoutResult,
} from "./layout_port";

/** Node-importable compatibility entry point backed by the canonical layout port. */
export function m3eLayout(
  graph: LayoutGraph,
  boxSizes: Record<string, LayoutNodeMetric>,
  mode: LayoutMode,
  options: LayoutOptions = {},
): LayoutResult {
  return layout(graph as VisibleLayoutGraph, boxSizes, mode, options);
}
