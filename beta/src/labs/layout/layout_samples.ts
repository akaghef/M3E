import treeBasic from "../../../tests/fixtures/layout-golden/tree-basic.json";
import mindmapBasic from "../../../tests/fixtures/layout-golden/mindmap-basic.json";
import scopeRoutingBasic from "../../../tests/fixtures/layout-golden/scope-routing-basic.json";
import type {
  GraphLinkLike,
  LayoutMode,
  LayoutNodeMetric,
  LayoutOptions,
  LayoutResult,
  VisibleLayoutGraph,
} from "../../shared/layout_port";

export interface LayoutGoldenSample {
  schema_version: 1;
  sample_id: "tree-basic" | "mindmap-basic" | "scope-routing-basic";
  source: {
    map_id?: string;
    scope_id?: string;
    product_path: "viewer.buildLayout" | "routingScopeSurface";
    captured_at: string;
  };
  input: {
    graph: {
      nodeIds: string[];
      children: Record<string, string[]>;
      graphLinks: GraphLinkLike[];
    };
    boxSizes: Record<string, LayoutNodeMetric>;
    mode: LayoutMode;
    options: LayoutOptions;
  };
  expected: LayoutResult;
}

export type LayoutSampleId = LayoutGoldenSample["sample_id"];

export const layoutSamples = [
  treeBasic,
  mindmapBasic,
  scopeRoutingBasic,
] as LayoutGoldenSample[];

export function findLayoutSample(sampleId: string): LayoutGoldenSample {
  const sample = layoutSamples.find((item) => item.sample_id === sampleId);
  if (!sample) {
    throw new Error(`Unknown layout sample: ${sampleId}`);
  }
  return sample;
}

export function toVisibleLayoutGraph(sample: LayoutGoldenSample): VisibleLayoutGraph {
  return {
    nodeIds: sample.input.graph.nodeIds,
    childrenOf: (nodeId: string) => sample.input.graph.children[nodeId] || [],
    graphLinks: sample.input.graph.graphLinks,
  };
}

export function summarizeLayout(result: LayoutResult): string {
  const placed = Object.keys(result.pos).length;
  return `${placed} nodes / ${Math.round(result.totalWidth)} x ${Math.round(result.totalHeight)} / ${result.order.join(" > ")}`;
}
