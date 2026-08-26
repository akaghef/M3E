import treeBasic from "../../../tests/fixtures/layout-golden/tree-basic.json";
import scopeRoutingBasic from "../../../tests/fixtures/layout-golden/scope-routing-basic.json";
import treeStress30 from "../../../tests/fixtures/layout-golden/tree-stress-30.json";
import scopeRoutingStress30 from "../../../tests/fixtures/layout-golden/scope-routing-stress-30.json";
import type {
  GraphLinkLike,
  LayoutMode,
  LayoutNodeMetric,
  LayoutOptions,
  LayoutResult,
  VisibleLayoutGraph,
} from "../../shared/layout_port";
import { syntheticLayoutSamples, type LayoutSyntheticSample } from "./synthetic_layout_samples";

export interface LayoutGoldenSample {
  schema_version: 1;
  sample_id:
    | "tree-basic"
    | "scope-routing-basic"
    | "tree-stress-30"
    | "scope-routing-stress-30";
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
export type LayoutLabSample = LayoutGoldenSample | LayoutSyntheticSample;
export type LayoutLabSampleId = LayoutLabSample["sample_id"];

export const layoutSamples = [
  treeBasic,
  scopeRoutingBasic,
  treeStress30,
  scopeRoutingStress30,
] as LayoutGoldenSample[];

export const layoutLabSamples = [
  ...layoutSamples,
  ...syntheticLayoutSamples,
] as LayoutLabSample[];

export function findLayoutSample(sampleId: string): LayoutGoldenSample {
  const sample = layoutSamples.find((item) => item.sample_id === sampleId);
  if (!sample) {
    throw new Error(`Unknown layout sample: ${sampleId}`);
  }
  return sample;
}

/**
 * Produces the graph visible to structured layouts. A collapsed node remains
 * visible, while its descendants are unreachable because it exposes no
 * children. Disperse receives the unmodified graph and performs its distinct
 * super-node contraction itself.
 */
export function toVisibleLayoutGraph(sample: LayoutLabSample, collapsedNodeIds: readonly string[] = []): VisibleLayoutGraph {
  const collapsed = new Set(collapsedNodeIds);
  return {
    nodeIds: sample.input.graph.nodeIds,
    childrenOf: (nodeId: string) => collapsed.has(nodeId) ? [] : sample.input.graph.children[nodeId] || [],
    graphLinks: sample.input.graph.graphLinks,
  };
}

export function summarizeLayout(result: LayoutResult): string {
  const placed = Object.keys(result.pos).length;
  return `${placed} nodes / ${Math.round(result.totalWidth)} x ${Math.round(result.totalHeight)} / ${result.order.join(" > ")}`;
}
