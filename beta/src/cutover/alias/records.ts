/**
 * alias は参照窓である。実体 node の text / details / note / attributes / link は複製しない。
 * 正本は target の実体 node に一つだけ置く。
 *
 * access（"read" | "write"）は alias ごとに持つ。既定は read。
 * target の node には載せない。scope の権限判定はここでは行わない。
 * write authority とは別である。
 *
 * ここで定義: AliasRecord — alias node から切り出した参照窓。
 * AppState の TreeNode は createdAt / updatedAt を持たないため、このレコードにも載せない。
 */
import type { AliasAccess, AppState, NodeType, TreeNode } from "../../shared/types";

const ENTITY_NODE_TYPES = new Set<NodeType>(["text", "image", "folder"]);

export interface AliasRecord {
  readonly id: string;
  readonly parentId: string | null;
  readonly targetNodeId: string;
  readonly aliasLabel?: string;
  readonly access: AliasAccess;
  readonly targetSnapshotLabel?: string;
  readonly isBroken: boolean;
}

/** AppState 上の alias を参照窓レコードへ切り出す。実体 node は返さない。 */
export function toAliasRecords(state: AppState): readonly AliasRecord[] {
  const nodes = state.nodes;
  const aliasIds = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.nodeType === "alias") aliasIds.add(node.id);
  }

  const records: AliasRecord[] = [];
  for (const node of Object.values(nodes)) {
    if (node.nodeType !== "alias") continue;
    records.push(recordFromNode(node, nodes, aliasIds));
  }
  return records;
}

/**
 * 参照窓レコードを AppState の alias node へ戻す。
 * 実体の本文は alias へ写さない。alias から alias は拒否する。
 * 入力の state と records は変更しない。
 */
export function aliasRecordsToAppState(state: AppState, records: readonly AliasRecord[]): AppState {
  const list = [...records];
  const aliasIds = new Set<string>();
  for (const record of list) {
    if (aliasIds.has(record.id)) {
      throw new Error(`Duplicate alias: ${record.id}`);
    }
    aliasIds.add(requireId(record.id, "alias id"));
  }

  for (const record of list) {
    assertAliasRecord(record, state.nodes, aliasIds);
    const existing = state.nodes[record.id];
    if (existing && existing.nodeType !== "alias") {
      throw new Error(`Node ${record.id} is an entity and cannot be replaced by an alias.`);
    }
    if (existing && existing.children.length > 0) {
      throw new Error(`Alias ${record.id} cannot have children.`);
    }
  }

  const nodes = new Map<string, TreeNode>();
  for (const [id, node] of Object.entries(state.nodes)) {
    nodes.set(id, copyNode(node));
  }

  for (const record of list) {
    const parentId = record.parentId;
    if (parentId === null) {
      throw new Error(`Alias ${record.id} requires a parent.`);
    }
    const parent = nodes.get(parentId);
    if (!parent) {
      throw new Error(`Alias parent is missing: ${parentId}`);
    }
    nodes.set(record.id, aliasNodeFromRecord(record));
    if (!parent.children.includes(record.id)) {
      nodes.set(parentId, { ...parent, children: [...parent.children, record.id] });
    }
  }

  const assembled: Record<string, TreeNode> = {};
  for (const [id, node] of nodes) {
    assembled[id] = node;
  }
  return { ...state, nodes: assembled };
}

function recordFromNode(
  node: TreeNode,
  nodes: Readonly<Record<string, TreeNode>>,
  aliasIds: ReadonlySet<string>,
): AliasRecord {
  if (node.children.length > 0) {
    throw new Error(`Alias ${node.id} cannot have children.`);
  }
  const targetNodeId = requireId(node.targetNodeId, `alias ${node.id} targetNodeId`);
  const isBroken = node.isBroken === true;
  const targetSnapshotLabel = optionalLabel(node.targetSnapshotLabel);
  assertEntityTarget(nodes, aliasIds, node.id, targetNodeId, isBroken, targetSnapshotLabel);
  const record: AliasRecord = {
    id: node.id,
    parentId: node.parentId,
    targetNodeId,
    access: readAccess(node.access, node.id),
    isBroken,
  };
  const aliasLabel = optionalLabel(node.aliasLabel);
  if (aliasLabel !== undefined) {
    return targetSnapshotLabel === undefined
      ? { ...record, aliasLabel }
      : { ...record, aliasLabel, targetSnapshotLabel };
  }
  return targetSnapshotLabel === undefined ? record : { ...record, targetSnapshotLabel };
}

function assertAliasRecord(
  record: AliasRecord,
  nodes: Readonly<Record<string, TreeNode>>,
  aliasIds: ReadonlySet<string>,
): void {
  requireId(record.id, "alias id");
  const targetNodeId = requireId(record.targetNodeId, `alias ${record.id} targetNodeId`);
  readAccess(record.access, record.id);
  if (record.parentId !== null) requireId(record.parentId, `alias ${record.id} parentId`);
  const targetSnapshotLabel = optionalLabel(record.targetSnapshotLabel);
  assertEntityTarget(nodes, aliasIds, record.id, targetNodeId, record.isBroken === true, targetSnapshotLabel);
  if (record.parentId !== null && aliasIds.has(record.parentId)) {
    throw new Error(`Alias ${record.id} cannot be a child of an alias.`);
  }
  const parent = record.parentId === null ? undefined : nodes[record.parentId];
  if (parent?.nodeType === "alias") {
    throw new Error(`Alias ${record.id} cannot be a child of an alias.`);
  }
}

function assertEntityTarget(
  nodes: Readonly<Record<string, TreeNode>>,
  aliasIds: ReadonlySet<string>,
  aliasId: string,
  targetNodeId: string,
  isBroken: boolean,
  targetSnapshotLabel: string | undefined,
): void {
  if (aliasId === targetNodeId || aliasIds.has(targetNodeId)) {
    throw new Error("Alias cannot target another alias.");
  }
  const target = nodes[targetNodeId];
  if (!target) {
    if (isBroken && targetSnapshotLabel !== undefined) return;
    throw new Error(`Alias ${aliasId} target is missing: ${targetNodeId}`);
  }
  if (target.nodeType === "alias") {
    throw new Error("Alias cannot target another alias.");
  }
  if (target.nodeType !== undefined && !ENTITY_NODE_TYPES.has(target.nodeType)) {
    throw new Error(`Alias ${aliasId} target must be an entity node.`);
  }
}

function aliasNodeFromRecord(record: AliasRecord): TreeNode {
  const aliasLabel = optionalLabel(record.aliasLabel);
  const targetSnapshotLabel = optionalLabel(record.targetSnapshotLabel);
  const isBroken = record.isBroken === true;
  const node: TreeNode = {
    id: record.id,
    parentId: record.parentId,
    children: [],
    nodeType: "alias",
    text: displayText(aliasLabel, isBroken, targetSnapshotLabel),
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
    targetNodeId: record.targetNodeId,
    access: record.access,
    isBroken,
  };
  if (aliasLabel !== undefined) node.aliasLabel = aliasLabel;
  if (targetSnapshotLabel !== undefined) node.targetSnapshotLabel = targetSnapshotLabel;
  return node;
}

function displayText(aliasLabel: string | undefined, isBroken: boolean, targetSnapshotLabel: string | undefined): string {
  if (aliasLabel !== undefined) return aliasLabel;
  if (isBroken && targetSnapshotLabel !== undefined) return `${targetSnapshotLabel} (deleted)`;
  return "";
}

function readAccess(access: AliasAccess | undefined, aliasId: string): AliasAccess {
  const value = access ?? "read";
  if (value !== "read" && value !== "write") {
    throw new Error(`Alias ${aliasId} has invalid access.`);
  }
  return value;
}

function optionalLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error("Alias label must be a string.");
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function copyNode(node: TreeNode): TreeNode {
  return {
    ...node,
    children: [...node.children],
    attributes: { ...node.attributes },
  };
}
