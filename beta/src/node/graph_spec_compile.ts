/**
 * PJ04 — Map → GraphSpec compile
 *
 * M3E の AppState + scope id を受け取って、実行非依存の GraphSpec を produce する。
 * 関数実体・reducer 関数・router 関数は ref 文字列で名前参照するのみで、
 * ここでは解決しない (registry 層の責務)。
 *
 * 契約: projects/PJ04_MermaidSystemLangGraph/docs/map_attribute_spec.md
 */

import type { AppState, GraphLink, TreeNode } from "../shared/types";
import {
  GRAPH_SPEC_END,
  GRAPH_SPEC_START,
  GRAPH_SPEC_VERSION,
  type GraphSpec,
  type GraphSpecChannel,
  type GraphSpecConditionalEdge,
  type GraphSpecEdge,
  type GraphSpecNode,
  type GraphSpecNodeKind,
  type GraphSpecReducerKind,
  type GraphSpecStaticEdge,
} from "../shared/graph_spec_types";

export interface CompileOptions {
  /**
   * 対象 scope に含まれる node id 集合を外から与える場合に使う。
   * 省略時は scope root の直下 children を自動で採用 (flat scope 前提)。
   */
  readonly includeNodeIds?: string[];
  /**
   * ここで列挙された link id だけ edge に含める。
   * 省略時は includeNodeIds に両端が収まるもの全てを採用。
   */
  readonly includeLinkIds?: string[];
}

export interface CompileWarning {
  readonly kind:
    | "unknown_node_kind"
    | "subgraph_scope_missing"
    | "callable_ref_missing"
    | "router_ref_missing"
    | "invalid_channel_json"
    | "invalid_metadata_json"
    | "orphan_link";
  readonly detail: string;
}

export interface CompileResult {
  readonly spec: GraphSpec;
  readonly warnings: CompileWarning[];
}

const KERNEL_NODE_KIND_KEY = "m3e:kernel-node-kind";
const KERNEL_CALLABLE_REF_KEY = "m3e:kernel-callable-ref";
const KERNEL_SUBGRAPH_SCOPE_KEY = "m3e:kernel-subgraph-scope";
const KERNEL_LABEL_KEY = "m3e:kernel-label";
const KERNEL_METADATA_KEY = "m3e:kernel-metadata";
const KERNEL_ROUTER_REF_KEY = "m3e:kernel-router-ref";
const KERNEL_CHANNELS_KEY = "m3e:kernel-channels";
const KERNEL_ENTRY_KEY = "m3e:kernel-entry";

const VALID_NODE_KINDS: ReadonlySet<GraphSpecNodeKind> = new Set([
  "callable",
  "subgraph",
  "tool",
  "entry",
  "terminal",
]);

const VALID_REDUCERS: ReadonlySet<GraphSpecReducerKind> = new Set([
  "append",
  "replace",
  "merge",
  "custom",
]);

export function compileFromMap(
  state: AppState,
  scopeNodeId: string,
  opts: CompileOptions = {},
): CompileResult {
  const warnings: CompileWarning[] = [];
  const scopeNode = state.nodes[scopeNodeId];
  if (!scopeNode) {
    throw new Error(`compileFromMap: scope node not found: ${scopeNodeId}`);
  }

  const includeIds = opts.includeNodeIds
    ? new Set(opts.includeNodeIds)
    : collectFlatScopeNodeIds(state, scopeNode);

  const nodes: GraphSpecNode[] = [];
  for (const nodeId of includeIds) {
    const node = state.nodes[nodeId];
    if (!node) continue;
    const compiled = compileNode(node, warnings);
    if (compiled) {
      nodes.push(compiled);
    }
  }

  const edges: GraphSpecEdge[] = [];
  const linkMap = state.links ?? {};
  const allLinkIds = opts.includeLinkIds ?? Object.keys(linkMap);

  const routerBuckets = new Map<string, GraphSpecConditionalEdge>();

  for (const linkId of allLinkIds) {
    const link = linkMap[linkId];
    if (!link) continue;
    if (!includeIds.has(link.sourceNodeId) && link.sourceNodeId !== GRAPH_SPEC_START) {
      continue;
    }
    if (
      !includeIds.has(link.targetNodeId) &&
      link.targetNodeId !== GRAPH_SPEC_END &&
      link.targetNodeId !== GRAPH_SPEC_START
    ) {
      warnings.push({ kind: "orphan_link", detail: linkId });
      continue;
    }
    compileLink(link, state.nodes, routerBuckets, edges, warnings);
  }

  for (const condEdge of routerBuckets.values()) {
    edges.push(condEdge);
  }

  const channels = parseChannels(scopeNode, warnings);
  const entry = scopeNode.attributes[KERNEL_ENTRY_KEY]?.trim() || GRAPH_SPEC_START;

  const spec: GraphSpec = {
    version: GRAPH_SPEC_VERSION,
    scopeId: scopeNodeId,
    entry,
    nodes,
    edges,
    channels,
    metadata: buildSpecMetadata(scopeNode),
  };

  return { spec, warnings };
}

function collectFlatScopeNodeIds(state: AppState, scopeNode: TreeNode): Set<string> {
  const ids = new Set<string>();
  for (const childId of scopeNode.children) {
    if (state.nodes[childId]) ids.add(childId);
  }
  return ids;
}

function compileNode(node: TreeNode, warnings: CompileWarning[]): GraphSpecNode | null {
  const rawKind = (node.attributes[KERNEL_NODE_KIND_KEY] || "callable").trim() as GraphSpecNodeKind;
  const kind: GraphSpecNodeKind = VALID_NODE_KINDS.has(rawKind) ? rawKind : "callable";
  if (kind !== rawKind) {
    warnings.push({ kind: "unknown_node_kind", detail: `${node.id}: ${rawKind}` });
  }

  const ref = node.attributes[KERNEL_CALLABLE_REF_KEY]?.trim() || undefined;
  const subgraphScopeId = node.attributes[KERNEL_SUBGRAPH_SCOPE_KEY]?.trim() || undefined;
  const label = node.attributes[KERNEL_LABEL_KEY]?.trim() || node.text || undefined;
  const metadata = parseJsonStringMap(node.attributes[KERNEL_METADATA_KEY], node.id, warnings);

  if ((kind === "callable" || kind === "tool") && !ref) {
    warnings.push({ kind: "callable_ref_missing", detail: node.id });
  }
  if (kind === "subgraph" && !subgraphScopeId) {
    warnings.push({ kind: "subgraph_scope_missing", detail: node.id });
  }

  return {
    id: node.id,
    kind,
    ref,
    label,
    subgraphScopeId,
    metadata,
  };
}

function compileLink(
  link: GraphLink,
  nodeIndex: Record<string, TreeNode>,
  routerBuckets: Map<string, GraphSpecConditionalEdge>,
  out: GraphSpecEdge[],
  warnings: CompileWarning[],
): void {
  const relationType = (link.relationType || "").trim();
  const label = link.label;

  if (relationType.startsWith("cond:")) {
    const branchKey = relationType.slice("cond:".length).trim() || "default";
    const source = link.sourceNodeId;
    const bucketKey = source;
    let bucket = routerBuckets.get(bucketKey);
    if (!bucket) {
      const routerRef = nodeIndex[source]?.attributes[KERNEL_ROUTER_REF_KEY]?.trim();
      if (!routerRef) {
        warnings.push({ kind: "router_ref_missing", detail: source });
      }
      bucket = {
        id: `cond:${source}`,
        kind: "conditional",
        source,
        routerRef: routerRef || "",
        branches: {},
        label,
      };
      routerBuckets.set(bucketKey, bucket);
    }
    (bucket.branches as Record<string, string>)[branchKey] = link.targetNodeId;
    return;
  }

  const edge: GraphSpecStaticEdge = {
    id: link.id,
    kind: "static",
    source: link.sourceNodeId,
    target: link.targetNodeId,
    label,
  };
  out.push(edge);
}

function parseChannels(scopeNode: TreeNode, warnings: CompileWarning[]): GraphSpecChannel[] {
  const raw = scopeNode.attributes[KERNEL_CHANNELS_KEY];
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warnings.push({ kind: "invalid_channel_json", detail: scopeNode.id });
    return [];
  }
  if (!Array.isArray(parsed)) {
    warnings.push({ kind: "invalid_channel_json", detail: `${scopeNode.id}: not array` });
    return [];
  }
  const out: GraphSpecChannel[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name : null;
    if (!name) continue;
    const reducerRaw = typeof obj.reducer === "string" ? obj.reducer : "replace";
    const reducer = (VALID_REDUCERS.has(reducerRaw as GraphSpecReducerKind)
      ? reducerRaw
      : "replace") as GraphSpecReducerKind;
    const reducerRef = typeof obj.reducerRef === "string" ? obj.reducerRef : undefined;
    const typeHint = typeof obj.typeHint === "string" ? obj.typeHint : undefined;
    out.push({ name, reducer, reducerRef, typeHint });
  }
  return out;
}

function parseJsonStringMap(
  raw: string | undefined,
  ownerId: string,
  warnings: CompileWarning[],
): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      warnings.push({ kind: "invalid_metadata_json", detail: ownerId });
      return undefined;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === "string" ? v : String(v);
    }
    return out;
  } catch {
    warnings.push({ kind: "invalid_metadata_json", detail: ownerId });
    return undefined;
  }
}

function buildSpecMetadata(scopeNode: TreeNode): Record<string, string> | undefined {
  if (!scopeNode.text) return undefined;
  return { scopeLabel: scopeNode.text };
}
