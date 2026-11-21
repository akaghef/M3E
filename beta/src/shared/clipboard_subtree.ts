/** Pure copy/paste of a subtree: alias targets, closed relation edges, collapsed. */

export type ClipboardNodeType = "text" | "image" | "folder" | "alias";
export type ClipboardAliasAccess = "read" | "write";
export type ClipboardLinkDirection = "none" | "forward" | "backward" | "both";
export type ClipboardLinkStyle = "default" | "dashed" | "soft" | "emphasis";
export type ClipboardLinkPort = "auto" | "left" | "right" | "top" | "bottom";

export interface ClipboardNodeSource {
  id: string;
  nodeType?: string;
  text?: string;
  collapsed?: boolean;
  details?: string;
  note?: string;
  attributes?: Record<string, string>;
  link?: string;
  children?: readonly string[];
  targetNodeId?: string;
  aliasLabel?: string;
  access?: string;
  targetSnapshotLabel?: string;
  isBroken?: boolean;
}

export interface ClipboardAlias {
  /** Id of the non-alias entity. Paste keeps this id. */
  target: string;
  label?: string;
  access: ClipboardAliasAccess;
  snapshotLabel?: string;
  broken: boolean;
}

export interface ClipboardSnapshotNode {
  /** Source node id. Paste allocates a different id. */
  id: string;
  nodeType: ClipboardNodeType;
  text: string;
  collapsed: boolean;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link: string;
  alias?: ClipboardAlias;
  children: ClipboardSnapshotNode[];
}

export interface ClipboardRelationEdge {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType?: string;
  label?: string;
  direction?: ClipboardLinkDirection;
  style?: ClipboardLinkStyle;
  color?: string;
  sourcePort?: ClipboardLinkPort;
  targetPort?: ClipboardLinkPort;
  attributes?: Record<string, string>;
}

export interface PastedSnapshotNode {
  id: string;
  sourceId: string;
  nodeType: ClipboardNodeType;
  text: string;
  collapsed: boolean;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link: string;
  alias?: ClipboardAlias;
  children: PastedSnapshotNode[];
}

export interface PastedRelationEdge extends ClipboardRelationEdge {
  id: string;
}

export interface ClipboardPastePlan {
  idMap: Map<string, string>;
  roots: PastedSnapshotNode[];
  links: PastedRelationEdge[];
}

function copyStringRecord(value: Record<string, string> | undefined): Record<string, string> {
  const copy: Record<string, string> = {};
  if (!value) return copy;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") copy[key] = entry;
  }
  return copy;
}

function nodeTypeOf(value: string | undefined): ClipboardNodeType {
  return value === "image" || value === "folder" || value === "alias" ? value : "text";
}

function nonEmpty(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

/** Walk alias targets until a non-alias node. A missing id stays, and is broken. */
export function resolveAliasEntityTarget(
  targetId: string | undefined,
  lookup: Readonly<Record<string, ClipboardNodeSource | undefined>>,
): { target: string; broken: boolean } | undefined {
  if (!targetId) return undefined;
  const seen = new Set<string>();
  let id = targetId;
  while (!seen.has(id)) {
    seen.add(id);
    const node = lookup[id];
    if (!node || node.nodeType !== "alias") {
      return { target: id, broken: !node };
    }
    if (!node.targetNodeId) return { target: id, broken: true };
    id = node.targetNodeId;
  }
  return { target: targetId, broken: true };
}

function aliasFromSource(
  node: ClipboardNodeSource,
  lookup: Readonly<Record<string, ClipboardNodeSource | undefined>>,
): ClipboardAlias | undefined {
  if (node.nodeType !== "alias") return undefined;
  const resolved = resolveAliasEntityTarget(node.targetNodeId, lookup);
  const target = resolved?.target || node.targetNodeId || "";
  const live = Boolean(target && lookup[target] && lookup[target]?.nodeType !== "alias");
  const retargeted = Boolean(resolved && node.targetNodeId && resolved.target !== node.targetNodeId);
  return {
    target,
    label: nonEmpty(node.aliasLabel),
    access: node.access === "write" ? "write" : "read",
    snapshotLabel: nonEmpty(node.targetSnapshotLabel),
    broken: live ? (retargeted ? false : Boolean(node.isBroken)) : true,
  };
}

function captureNode(
  nodeId: string,
  rangeNodes: Readonly<Record<string, ClipboardNodeSource | undefined>>,
  lookup: Readonly<Record<string, ClipboardNodeSource | undefined>>,
  seen: Set<string>,
): ClipboardSnapshotNode | null {
  if (seen.has(nodeId)) return null;
  const node = rangeNodes[nodeId];
  if (!node) return null;
  seen.add(nodeId);
  const children: ClipboardSnapshotNode[] = [];
  for (const childId of node.children || []) {
    const child = captureNode(childId, rangeNodes, lookup, seen);
    if (child) children.push(child);
  }
  const nodeType = nodeTypeOf(node.nodeType);
  const alias = aliasFromSource(node, lookup);
  return {
    id: node.id || nodeId,
    nodeType: alias ? "alias" : nodeType === "alias" ? "text" : nodeType,
    text: node.text || "",
    collapsed: node.collapsed === true,
    details: node.details || "",
    note: node.note || "",
    attributes: copyStringRecord(node.attributes),
    link: node.link || "",
    alias,
    children,
  };
}

export function collectClipboardNodeIds(snapshots: readonly ClipboardSnapshotNode[], ids = new Set<string>()): Set<string> {
  for (const snapshot of snapshots) {
    if (snapshot.id) ids.add(snapshot.id);
    collectClipboardNodeIds(snapshot.children, ids);
  }
  return ids;
}

/** Relation edges whose source and target are both inside `nodeIds`. */
export function closedRelationEdges<T extends ClipboardRelationEdge>(
  links: readonly T[],
  nodeIds: ReadonlySet<string>,
): T[] {
  const closed: T[] = [];
  for (const link of links) {
    if (!nodeIds.has(link.sourceNodeId) || !nodeIds.has(link.targetNodeId)) continue;
    closed.push(JSON.parse(JSON.stringify(link)) as T);
  }
  return closed;
}

export function captureClipboard(
  rootIds: readonly string[],
  rangeNodes: Readonly<Record<string, ClipboardNodeSource | undefined>>,
  links: readonly ClipboardRelationEdge[],
  aliasLookup?: Readonly<Record<string, ClipboardNodeSource | undefined>>,
): { snapshots: ClipboardSnapshotNode[]; links: ClipboardRelationEdge[] } {
  const lookup = aliasLookup ?? rangeNodes;
  const seen = new Set<string>();
  const snapshots: ClipboardSnapshotNode[] = [];
  for (const rootId of rootIds) {
    const snapshot = captureNode(rootId, rangeNodes, lookup, seen);
    if (snapshot) snapshots.push(snapshot);
  }
  return {
    snapshots,
    links: closedRelationEdges(links, collectClipboardNodeIds(snapshots)),
  };
}

function indexSnapshots(snapshots: readonly ClipboardSnapshotNode[], byId: Map<string, ClipboardSnapshotNode>): void {
  for (const snapshot of snapshots) {
    byId.set(snapshot.id, snapshot);
    indexSnapshots(snapshot.children, byId);
  }
}

/** Keep the entity id. Do not point the pasted alias at another alias or at a new id. */
function aliasForPaste(alias: ClipboardAlias, byId: ReadonlyMap<string, ClipboardSnapshotNode>): ClipboardAlias {
  const seen = new Set<string>();
  let target = alias.target;
  while (target && !seen.has(target)) {
    seen.add(target);
    const node = byId.get(target);
    if (!node || node.nodeType !== "alias" || !node.alias?.target) break;
    target = node.alias.target;
  }
  const node = target ? byId.get(target) : undefined;
  return {
    target,
    label: alias.label,
    access: alias.access === "write" ? "write" : "read",
    snapshotLabel: alias.snapshotLabel,
    broken: node ? node.nodeType === "alias" : alias.broken,
  };
}

function pasteNode(
  snapshot: ClipboardSnapshotNode,
  allocateId: () => string,
  idMap: Map<string, string>,
  byId: ReadonlyMap<string, ClipboardSnapshotNode>,
): PastedSnapshotNode {
  const id = allocateId();
  idMap.set(snapshot.id, id);
  const alias = snapshot.alias ? aliasForPaste(snapshot.alias, byId) : undefined;
  return {
    id,
    sourceId: snapshot.id,
    nodeType: alias ? "alias" : snapshot.nodeType === "alias" ? "text" : snapshot.nodeType,
    text: snapshot.text,
    collapsed: snapshot.collapsed === true,
    details: snapshot.details,
    note: snapshot.note,
    attributes: copyStringRecord(snapshot.attributes),
    link: snapshot.link,
    alias,
    children: snapshot.children.map((child) => pasteNode(child, allocateId, idMap, byId)),
  };
}

export function pasteClipboard(
  snapshots: readonly ClipboardSnapshotNode[],
  links: readonly ClipboardRelationEdge[],
  allocateId: () => string,
): ClipboardPastePlan {
  const byId = new Map<string, ClipboardSnapshotNode>();
  indexSnapshots(snapshots, byId);
  const idMap = new Map<string, string>();
  const roots = snapshots.map((snapshot) => pasteNode(snapshot, allocateId, idMap, byId));
  const pastedLinks: PastedRelationEdge[] = [];
  for (const link of links) {
    const sourceNodeId = idMap.get(link.sourceNodeId);
    const targetNodeId = idMap.get(link.targetNodeId);
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) continue;
    const cloned = JSON.parse(JSON.stringify(link)) as ClipboardRelationEdge;
    pastedLinks.push({
      ...cloned,
      id: allocateId(),
      sourceNodeId,
      targetNodeId,
      attributes: cloned.attributes ? copyStringRecord(cloned.attributes) : undefined,
    });
  }
  return { idMap, roots, links: pastedLinks };
}
