import type { Command, CommandIntent, CommandTargetKind } from "./command";

/**
 * ここで定義: TopologyNode は全体置換と linear-text の Apply が比べる
 * node の親子・兄弟順・text・attributes。collapse は含めない。
 */
export interface TopologyNode {
  id: string;
  parentId: string | null;
  text: string;
  children: readonly string[];
  attributes?: Readonly<Record<string, string>>;
}

/** GraphLink の端点、label、attributes。端点の変更は retarget、label と attributes は set-attribute / unset-attribute。 */
export interface TopologyLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  attributes?: Readonly<Record<string, string>>;
}

/**
 * ここで定義: opaque は親子・text・GraphLink の増減以外を比較用文字列にしたもの。
 * 差分は Command にせず残余にする。
 */
export interface WholeStateBody {
  nodes: readonly TopologyNode[];
  links?: readonly TopologyLink[];
  opaque?: Readonly<Record<string, string>>;
}

/** ここで定義: LinearDraftNode は apply が位置で対応させる見出し。node id は持たない。 */
export interface LinearDraftNode {
  label: string;
  children?: readonly LinearDraftNode[];
}

export interface LinearApplyInput {
  nodes: readonly TopologyNode[];
  scopeRootId: string;
  draft: LinearDraftNode;
}

/** ここで定義: 未対応の残余。経路一覧の「未対応」とは別に、分解できなかった差分 1 件。 */
export interface UnmappedDiff {
  id: string;
  reason: string;
}

interface Indexed<T> {
  byId: Map<string, T>;
  duplicates: string[];
  empty: boolean;
}

const parentOf = (node: TopologyNode | undefined): string | null => node?.parentId ?? null;

function indexNodes(nodes: readonly TopologyNode[]): Indexed<TopologyNode> {
  const byId = new Map<string, TopologyNode>();
  const duplicates: string[] = [];
  let empty = false;
  for (const node of nodes) {
    if (node.id.trim() === "") {
      empty = true;
      continue;
    }
    if (byId.has(node.id)) duplicates.push(node.id);
    byId.set(node.id, node);
  }
  return { byId, duplicates, empty };
}

function indexLinks(links: readonly TopologyLink[] | undefined): Indexed<TopologyLink> {
  return indexNodes((links ?? []).map((link) => ({
    id: link.id,
    parentId: null,
    text: "",
    children: [],
    ...link,
  }))) as Indexed<TopologyLink>;
}

function depthOf(byId: Map<string, TopologyNode>, id: string): number {
  let depth = 0;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current?.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
    depth += 1;
  }
  return depth;
}

function sortedIds(byId: Map<string, TopologyNode>, ids: readonly string[], direction: "asc" | "desc"): string[] {
  return [...ids].sort((left, right) => {
    const delta = depthOf(byId, left) - depthOf(byId, right);
    if (delta !== 0) return direction === "asc" ? delta : -delta;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function orderedChildren(byId: Map<string, TopologyNode>, parentId: string): string[] {
  return (byId.get(parentId)?.children ?? []).filter((id) => parentOf(byId.get(id)) === parentId);
}

function needsReorder(beforeList: readonly string[], afterList: readonly string[]): boolean {
  if (beforeList.join("\0") === afterList.join("\0")) return false;
  const beforeSet = new Set(beforeList);
  let beforeIndex = 0;
  let split = 0;
  for (; split < afterList.length; split += 1) {
    const id = afterList[split];
    if (!beforeSet.has(id)) break;
    while (beforeIndex < beforeList.length && beforeList[beforeIndex] !== id) beforeIndex += 1;
    if (beforeIndex >= beforeList.length) return true;
    beforeIndex += 1;
  }
  const tail = afterList.slice(split);
  if (!tail.every((id) => !beforeSet.has(id))) return true;
  return tail.length > 1 || (beforeList.length === 0 && afterList.length > 1);
}

function reorderPlans(before: Map<string, TopologyNode>, after: Map<string, TopologyNode>): PlannedCommand[] {
  const planned: PlannedCommand[] = [];
  for (const parentId of [...after.keys()].sort()) {
    const beforeList = orderedChildren(before, parentId);
    const afterList = orderedChildren(after, parentId);
    if (!needsReorder(beforeList, afterList)) continue;
    planned.push({
      intent: "reorder",
      targetKind: "node",
      targetId: parentId,
      payload: { childIds: afterList.join(",") },
    });
  }
  return planned;
}

function attributePlans(
  kind: CommandTargetKind,
  id: string,
  beforeAttrs: Readonly<Record<string, string>> | undefined,
  afterAttrs: Readonly<Record<string, string>> | undefined,
): PlannedCommand[] {
  const beforeMap = beforeAttrs ?? {};
  const afterMap = afterAttrs ?? {};
  const planned: PlannedCommand[] = [];
  for (const key of [...new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])].sort()) {
    if (beforeMap[key] === afterMap[key]) continue;
    if (!(key in afterMap)) planned.push({ intent: "unset-attribute", targetKind: kind, targetId: id, payload: { key } });
    else planned.push({ intent: "set-attribute", targetKind: kind, targetId: id, payload: { key, value: afterMap[key] } });
  }
  return planned;
}

function linkEditPlans(before: Map<string, TopologyLink>, after: Map<string, TopologyLink>): PlannedCommand[] {
  const planned: PlannedCommand[] = [];
  for (const id of [...before.keys()].filter((key) => after.has(key)).sort()) {
    const left = before.get(id)!;
    const right = after.get(id)!;
    if (left.sourceNodeId !== right.sourceNodeId || left.targetNodeId !== right.targetNodeId) {
      planned.push({
        intent: "retarget",
        targetKind: "GraphLink",
        targetId: id,
        payload: { sourceNodeId: right.sourceNodeId, targetNodeId: right.targetNodeId },
      });
    }
    if ((left.label ?? "") !== (right.label ?? "")) {
      planned.push(right.label
        ? { intent: "set-attribute", targetKind: "GraphLink", targetId: id, payload: { key: "label", value: right.label } }
        : { intent: "unset-attribute", targetKind: "GraphLink", targetId: id, payload: { key: "label" } });
    }
    planned.push(...attributePlans("GraphLink", id, left.attributes, right.attributes));
  }
  return planned;
}

function opaqueResidue(before: WholeStateBody, after: WholeStateBody): UnmappedDiff[] {
  const keys = new Set([...Object.keys(before.opaque ?? {}), ...Object.keys(after.opaque ?? {})]);
  const residue: UnmappedDiff[] = [];
  for (const key of [...keys].sort()) {
    const left = before.opaque?.[key];
    const right = after.opaque?.[key];
    if (left !== right) {
      residue.push({ id: `opaque:${key}`, reason: "兄弟順、属性、GraphLink の端点と label 以外の差分は Command にしない" });
    }
  }
  return residue;
}

export interface PlannedCommand {
  intent: CommandIntent;
  targetKind: CommandTargetKind;
  targetId: string;
  payload?: Record<string, string>;
}

function assignIds(commandId: string, planned: readonly PlannedCommand[], baseRevision: string): Command[] {
  return planned.map((item, index) => ({
    commandId: index === 0 ? commandId : `${commandId}#${index}:${item.intent}`,
    intent: item.intent,
    target: { kind: item.targetKind, id: item.targetId },
    baseRevision,
    ...(item.payload ? { payload: { ...item.payload } } : {}),
  }));
}

export function planWholeState(before: WholeStateBody, after: WholeStateBody): { planned: PlannedCommand[]; unmapped: UnmappedDiff[] } {
  const left = indexNodes(before.nodes);
  const right = indexNodes(after.nodes);
  const beforeLinks = indexLinks(before.links);
  const afterLinks = indexLinks(after.links);
  const unmapped: UnmappedDiff[] = [];
  if (left.empty || right.empty || beforeLinks.empty || afterLinks.empty) {
    unmapped.push({ id: "empty-id", reason: "空の id は Command の対象にできない" });
  }
  for (const id of [...new Set([...left.duplicates, ...right.duplicates, ...beforeLinks.duplicates, ...afterLinks.duplicates])].sort()) {
    unmapped.push({ id: `duplicate:${id}`, reason: "同じ id が複数ある差分は一意な対象にできない" });
  }

  const removed = [...left.byId.keys()].filter((id) => !right.byId.has(id));
  const added = [...right.byId.keys()].filter((id) => !left.byId.has(id));
  const kept = [...left.byId.keys()].filter((id) => right.byId.has(id));
  const planned: PlannedCommand[] = [];

  for (const id of sortedIds(left.byId, removed, "desc")) {
    planned.push({ intent: "delete", targetKind: "node", targetId: id });
  }
  for (const id of sortedIds(right.byId, added, "asc")) {
    const node = right.byId.get(id)!;
    planned.push({
      intent: "assert",
      targetKind: "node",
      targetId: id,
      payload: { parentId: node.parentId ?? "", text: node.text },
    });
  }
  for (const id of [...kept].sort()) {
    const from = left.byId.get(id)!;
    const to = right.byId.get(id)!;
    if (parentOf(from) !== parentOf(to)) {
      planned.push({ intent: "reparent", targetKind: "node", targetId: id, payload: { parentId: to.parentId ?? "" } });
    }
  }
  for (const id of [...kept].sort()) {
    const from = left.byId.get(id)!;
    const to = right.byId.get(id)!;
    if (from.text !== to.text) {
      planned.push({ intent: "rename", targetKind: "node", targetId: id, payload: { text: to.text } });
    }
  }
  planned.push(...reorderPlans(left.byId, right.byId));
  for (const id of [...right.byId.keys()].sort()) {
    planned.push(...attributePlans("node", id, left.byId.get(id)?.attributes, right.byId.get(id)?.attributes));
  }

  const removedLinks = [...beforeLinks.byId.keys()].filter((id) => !afterLinks.byId.has(id)).sort();
  const addedLinks = [...afterLinks.byId.keys()].filter((id) => !beforeLinks.byId.has(id)).sort();
  for (const id of removedLinks) planned.push({ intent: "delete", targetKind: "GraphLink", targetId: id });
  for (const id of addedLinks) {
    const link = afterLinks.byId.get(id)!;
    planned.push({
      intent: "assert",
      targetKind: "GraphLink",
      targetId: id,
      payload: { sourceNodeId: link.sourceNodeId, targetNodeId: link.targetNodeId },
    });
  }

  planned.push(...linkEditPlans(beforeLinks.byId, afterLinks.byId));
  unmapped.push(...opaqueResidue(before, after));
  return { planned, unmapped };
}

function deleteSubtree(byId: Map<string, TopologyNode>, id: string, planned: PlannedCommand[], seen: Set<string>): void {
  if (seen.has(id)) return;
  seen.add(id);
  const node = byId.get(id);
  if (!node) return;
  for (const childId of node.children) deleteSubtree(byId, childId, planned, seen);
  planned.push({ intent: "delete", targetKind: "node", targetId: id });
}

function planDraft(
  commandId: string,
  byId: Map<string, TopologyNode>,
  parentId: string,
  draft: LinearDraftNode,
  path: string,
  planned: PlannedCommand[],
): void {
  const children = draft.children ?? [];
  children.forEach((child, index) => {
    const childPath = path === "" ? String(index) : `${path}.${index}`;
    const newId = `${commandId}:new:${childPath}`;
    planned.push({ intent: "assert", targetKind: "node", targetId: newId, payload: { parentId, text: child.label } });
    planDraft(commandId, byId, newId, child, childPath, planned);
  });
}

function planExisting(
  commandId: string,
  byId: Map<string, TopologyNode>,
  nodeId: string,
  draft: LinearDraftNode,
  path: string,
  planned: PlannedCommand[],
): void {
  const node = byId.get(nodeId);
  if (!node) return;
  if (node.text !== draft.label) {
    planned.push({ intent: "rename", targetKind: "node", targetId: nodeId, payload: { text: draft.label } });
  }
  const draftChildren = draft.children ?? [];
  draftChildren.forEach((child, index) => {
    const existingId = node.children[index];
    const childPath = path === "" ? String(index) : `${path}.${index}`;
    if (existingId && byId.has(existingId)) planExisting(commandId, byId, existingId, child, childPath, planned);
    else {
      const newId = `${commandId}:new:${childPath}`;
      planned.push({ intent: "assert", targetKind: "node", targetId: newId, payload: { parentId: nodeId, text: child.label } });
      planDraft(commandId, byId, newId, child, childPath, planned);
    }
  });
  const seen = new Set<string>();
  for (const redundantId of node.children.slice(draftChildren.length)) deleteSubtree(byId, redundantId, planned, seen);
}

export function planLinearApply(commandId: string, input: LinearApplyInput): { planned: PlannedCommand[]; unmapped: UnmappedDiff[] } {
  const indexed = indexNodes(input.nodes);
  const unmapped: UnmappedDiff[] = [];
  if (!indexed.byId.has(input.scopeRootId)) {
    unmapped.push({ id: "missing-scope-root", reason: "scope root が無いので Apply を Command に分解できない" });
    return { planned: [], unmapped };
  }
  const planned: PlannedCommand[] = [];
  planExisting(commandId, indexed.byId, input.scopeRootId, input.draft, "", planned);
  return { planned, unmapped };
}

export function planGroup(newParentId: string, parentId: string, text: string, childIds: readonly string[]): PlannedCommand[] {
  const planned: PlannedCommand[] = [{
    intent: "assert",
    targetKind: "node",
    targetId: newParentId,
    payload: { parentId, text },
  }];
  for (const childId of childIds) {
    planned.push({ intent: "reparent", targetKind: "node", targetId: childId, payload: { parentId: newParentId } });
  }
  return planned;
}

export function commandsFromPlan(commandId: string, baseRevision: string, planned: readonly PlannedCommand[]): Command[] {
  return assignIds(commandId, planned, baseRevision);
}
