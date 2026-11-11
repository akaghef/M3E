/**
 * viewer / server が map を読むときの state は `AppState`
 * （map 全体の state スナップショット）である。
 * GET `/api/maps/:mapId` は `SavedMap` を返し、その `state` がこれにあたる。
 * ここでは node、親子 edge、兄弟順、attributes のレコードから
 * `rootId` と `nodes` を組み立てる。保存 JSON をそのまま返す関数ではない。
 *
 * ここで定義: ViewerStateRecords — 組み立て入力。4種のレコード配列であり、
 * `AppState` や `SavedMap` そのものではない。
 * ここで定義: SiblingOrderRecord.order — 同一親の `children[]` における位置。
 * 数値が小さいほど先。欠番は詰め、同値はレコードの後勝ちの並びを保つ。
 */
import type { AliasAccess, AppState, NodeType, TreeNode } from "../../shared/types";

const NODE_TYPES = new Set<NodeType>(["text", "image", "folder", "alias"]);

/** node の Content と nodeType。親子・兄弟順・attributes はここには載せず、別レコードから組む。 */
export interface NodeContentRecord {
  id: string;
  text?: string;
  details?: string;
  note?: string;
  link?: string;
  nodeType?: NodeType;
  collapsed?: boolean;
  scopeId?: string;
  targetNodeId?: string;
  aliasLabel?: string;
  access?: AliasAccess;
  targetSnapshotLabel?: string;
  isBroken?: boolean;
}

/** 親子 edge。親から子への有向関係。GraphLink ではない。 */
export interface ParentChildEdgeRecord {
  parentId: string;
  childId: string;
}

/** 兄弟順。同一親の `children[]` の位置を表す。 */
export interface SiblingOrderRecord {
  parentId: string;
  childId: string;
  order: number;
}

/** node の attributes 1件。値は文字列。 */
export interface NodeAttributeRecord {
  nodeId: string;
  key: string;
  value: string;
}

/** ここで定義: ViewerStateRecords。上記4配列。 */
export interface ViewerStateRecords {
  nodes: readonly NodeContentRecord[];
  edges: readonly ParentChildEdgeRecord[];
  siblingOrders: readonly SiblingOrderRecord[];
  attributes: readonly NodeAttributeRecord[];
}

interface Rank {
  order: number;
  index: number;
}

export function assembleViewerState(records: ViewerStateRecords): AppState {
  const nodes = new Map<string, TreeNode>();
  for (const record of requireArray(records.nodes, "nodes")) {
    const id = requireId(record.id, "node id");
    if (nodes.has(id)) {
      throw new Error(`Duplicate node: ${id}`);
    }
    nodes.set(id, nodeFromRecord({ ...record, id }));
  }

  const parentOf = new Map<string, string>();
  const edgeIndexOf = new Map<string, number>();
  requireArray(records.edges, "edges").forEach((edge, index) => {
    const parentId = requireId(edge.parentId, "edge parentId");
    const childId = requireId(edge.childId, "edge childId");
    requireKnown(nodes, parentId);
    requireKnown(nodes, childId);
    if (parentId === childId) {
      throw new Error(`Node ${childId} cannot be its own parent.`);
    }
    const existing = parentOf.get(childId);
    if (existing !== undefined && existing !== parentId) {
      throw new Error(`Node ${childId} has multiple parents: ${existing}, ${parentId}`);
    }
    if (existing === undefined) {
      parentOf.set(childId, parentId);
      edgeIndexOf.set(childId, index);
    }
  });

  const orderOf = new Map<string, Rank>();
  requireArray(records.siblingOrders, "siblingOrders").forEach((row, index) => {
    const parentId = requireId(row.parentId, "sibling order parentId");
    const childId = requireId(row.childId, "sibling order childId");
    requireKnown(nodes, parentId);
    requireKnown(nodes, childId);
    if (parentId === childId) {
      throw new Error(`Node ${childId} cannot be its own parent.`);
    }
    if (typeof row.order !== "number" || !Number.isFinite(row.order)) {
      throw new Error(`Sibling order for ${childId} must be a finite number.`);
    }
    const existing = parentOf.get(childId);
    if (existing === undefined) {
      parentOf.set(childId, parentId);
    } else if (existing !== parentId) {
      throw new Error(`Sibling order disagrees with parent edge for ${childId}: ${existing}, ${parentId}`);
    }
    orderOf.set(childId, { order: row.order, index });
  });

  if (nodes.size === 0) {
    return { rootId: "", nodes: {} };
  }

  const roots = [...nodes.keys()].filter((id) => !parentOf.has(id));
  if (roots.length !== 1) {
    throw new Error(roots.length === 0 ? "Root node is missing." : `Multiple roots: ${roots.join(", ")}`);
  }
  const rootId = roots[0]!;

  const buckets = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    buckets.set(id, []);
  }
  for (const [childId, parentId] of parentOf) {
    nodes.get(childId)!.parentId = parentId;
    buckets.get(parentId)!.push(childId);
  }
  for (const [parentId, childIds] of buckets) {
    childIds.sort((a, b) => compareSiblings(a, b, orderOf, edgeIndexOf));
    nodes.get(parentId)!.children = childIds;
  }

  for (const attribute of requireArray(records.attributes, "attributes")) {
    const nodeId = requireId(attribute.nodeId, "attribute nodeId");
    const node = nodes.get(nodeId);
    if (!node) {
      throw new Error(`Attribute node is missing: ${nodeId}`);
    }
    if (typeof attribute.key !== "string" || attribute.key.length === 0) {
      throw new Error(`Attribute key on ${nodeId} is empty.`);
    }
    if (typeof attribute.value !== "string") {
      throw new Error(`Attribute ${attribute.key} on ${nodeId} must be a string.`);
    }
    node.attributes[attribute.key] = attribute.value;
  }

  assertSingleTree(rootId, nodes);

  const assembled: Record<string, TreeNode> = {};
  for (const [id, node] of nodes) {
    assembled[id] = node;
  }
  return { rootId, nodes: assembled };
}

function nodeFromRecord(record: NodeContentRecord): TreeNode {
  const nodeType = record.nodeType ?? "text";
  if (!NODE_TYPES.has(nodeType)) {
    throw new Error(`Invalid nodeType: ${String(record.nodeType)}`);
  }
  const node: TreeNode = {
    id: record.id,
    parentId: null,
    children: [],
    nodeType,
    text: optionalString(record.text, "text"),
    collapsed: record.collapsed === true,
    details: optionalString(record.details, "details"),
    note: optionalString(record.note, "note"),
    attributes: {},
    link: optionalString(record.link, "link"),
  };
  if (record.scopeId !== undefined) {
    node.scopeId = optionalString(record.scopeId, "scopeId");
  }
  if (nodeType === "alias") {
    if (record.targetNodeId !== undefined) {
      node.targetNodeId = requireId(record.targetNodeId, "targetNodeId");
    }
    if (record.aliasLabel !== undefined) {
      node.aliasLabel = optionalString(record.aliasLabel, "aliasLabel");
    }
    if (record.access !== undefined && record.access !== "read" && record.access !== "write") {
      throw new Error(`Alias node ${record.id} has invalid access.`);
    }
    node.access = record.access ?? "read";
    if (record.targetSnapshotLabel !== undefined) {
      node.targetSnapshotLabel = optionalString(record.targetSnapshotLabel, "targetSnapshotLabel");
    }
    node.isBroken = record.isBroken === true;
  }
  return node;
}

function compareSiblings(
  a: string,
  b: string,
  orderOf: Map<string, Rank>,
  edgeIndexOf: Map<string, number>,
): number {
  const left = orderOf.get(a);
  const right = orderOf.get(b);
  if (left && right && left.order !== right.order) {
    return left.order - right.order;
  }
  if (left && !right) {
    return -1;
  }
  if (!left && right) {
    return 1;
  }
  if (left && right) {
    return left.index - right.index;
  }
  return (edgeIndexOf.get(a) ?? 0) - (edgeIndexOf.get(b) ?? 0);
}

function assertSingleTree(rootId: string, nodes: Map<string, TreeNode>): void {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const walk = (id: string): void => {
    if (stack.has(id)) {
      throw new Error(`Cycle detected at node: ${id}`);
    }
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    stack.add(id);
    for (const childId of nodes.get(id)!.children) {
      walk(childId);
    }
    stack.delete(id);
  };
  walk(rootId);
  const disconnected = [...nodes.keys()].filter((id) => !visited.has(id));
  if (disconnected.length > 0) {
    throw new Error(`Disconnected nodes: ${disconnected.join(", ")}`);
  }
}

function requireArray<T>(value: readonly T[] | undefined, name: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  return value;
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function requireKnown(nodes: Map<string, TreeNode>, id: string): void {
  if (!nodes.has(id)) {
    throw new Error(`Node is missing: ${id}`);
  }
}
