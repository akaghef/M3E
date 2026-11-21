// Commit-time delete, copy, lock and grant checks.
// Database_Spec 12.7 (OC1–OC4), 12.8 (copy) and 3.2 (lock, grant). OC5 and projection are not here.

import type { AppState, TreeNode } from "../../shared/types";
import { recordRk } from "../../shared/record_model/steady";
import type {
  EdgeConnectionRecord,
  GrantRecord,
  LockRecord,
  NodeRecord,
  ScopeRecord,
  SnapshotRecord,
} from "../../shared/record_model/types";
import type { RecordOp } from "./engine";
import { touchedOf } from "./journal_archive";

export type DeleteOperation = "oc1" | "oc2" | "oc3" | "oc4";

export type OpResult = { ok: true } | { ok: false; message: string };

export interface DeleteOptions {
  /** Destination parent for OC2, the canonical-plane move. */
  parentId?: string;
  /** Time written to valid.to by OC3. */
  at?: string;
}

const OC1_NON_ALIAS = "OC1 removes an alias occurrence only. End the entity with OC3 or retract it with OC4.";
const OC2_PROJECTED = "OC2 on a projected plane records projection.dissolved, which this store does not keep. On the canonical plane, move the node and name the destination parent.";
const OC4_IS_OC1 = "OC4 retracts the entity. This removes an alias occurrence. Remove the occurrence with OC1.";

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function isAliasNode(node: TreeNode | undefined): boolean {
  return node?.nodeType === "alias";
}

function displayLabel(node: TreeNode | undefined): string {
  if (!node) return "Untitled";
  if (node.aliasLabel && node.aliasLabel.trim()) return node.aliasLabel;
  if (node.text && node.text.trim()) return node.text;
  return "Untitled";
}

function subtree(nodes: Record<string, TreeNode>, rootId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    const node = nodes[id];
    if (!node) continue;
    for (const child of node.children) stack.push(child);
  }
  return out;
}

function descends(nodes: Record<string, TreeNode>, id: string, ancestor: string): boolean {
  let at: string | null | undefined = id;
  const seen = new Set<string>();
  while (typeof at === "string" && !seen.has(at)) {
    if (at === ancestor) return true;
    seen.add(at);
    at = nodes[at]?.parentId;
  }
  return false;
}

function removeNodes(state: AppState, ids: readonly string[]): void {
  const deleted = new Set(ids);
  const labels = new Map(ids.map((id) => [id, displayLabel(state.nodes[id])]));
  for (const node of Object.values(state.nodes)) {
    if (deleted.has(node.id)) continue;
    if (node.children.some((child) => deleted.has(child))) node.children = node.children.filter((child) => !deleted.has(child));
  }
  if (state.links) {
    for (const [id, link] of Object.entries(state.links)) {
      if (deleted.has(link.sourceNodeId) || deleted.has(link.targetNodeId)) delete state.links[id];
    }
  }
  for (const id of ids) delete state.nodes[id];
  for (const node of Object.values(state.nodes)) {
    if (node.nodeType !== "alias" || !node.targetNodeId || !deleted.has(node.targetNodeId)) continue;
    const label = labels.get(node.targetNodeId) ?? "Untitled";
    node.isBroken = true;
    node.targetSnapshotLabel = label;
    node.text = node.aliasLabel ? `${node.aliasLabel} → ${label} (deleted)` : `${label} (deleted)`;
  }
}

function entityId(state: AppState, nodeId: string, operation: "oc3" | "oc4"): { ok: true; id: string } | { ok: false; message: string } {
  const node = state.nodes[nodeId];
  if (!node) return fail(`Node ${nodeId} does not exist.`);
  if (!isAliasNode(node)) return { ok: true, id: nodeId };
  if (operation === "oc3" && node.access === "read") {
    return fail("OC3 ends the entity. A read alias cannot end it. End it from the entity or from a write alias.");
  }
  const missing = !node.targetNodeId || node.isBroken || !state.nodes[node.targetNodeId] || isAliasNode(state.nodes[node.targetNodeId]);
  if (missing) {
    return operation === "oc3"
      ? fail("OC3 ends the entity. This alias has no live target. End it from the entity, or remove the occurrence with OC1.")
      : fail("OC4 retracts the entity. This alias has no live target. Remove the occurrence with OC1.");
  }
  return { ok: true, id: node.targetNodeId! };
}

function moveUnder(state: AppState, nodeId: string, parentId: string): OpResult {
  const node = state.nodes[nodeId];
  const parent = state.nodes[parentId];
  if (!node) return fail(`Node ${nodeId} does not exist.`);
  if (!parent) return fail(`Node ${parentId} does not exist.`);
  if (node.parentId === null) return fail("The map root cannot be moved.");
  if (isAliasNode(parent)) return fail("OC2 moves the node under a node that can own children. An alias cannot be that parent.");
  if (nodeId === parentId || descends(state.nodes, parentId, nodeId)) return fail("OC2 cannot move a node under itself.");
  const oldParent = node.parentId ? state.nodes[node.parentId] : undefined;
  if (oldParent) oldParent.children = oldParent.children.filter((child) => child !== nodeId);
  node.parentId = parentId;
  delete node.edgeOutsideScope;
  parent.children = [...parent.children, nodeId];
  return { ok: true };
}

/**
 * Applies one delete operation to `state`. The operation argument is the meaning;
 * a different operation is never performed in its place.
 */
export function applyDelete(state: AppState, operation: DeleteOperation, nodeId: string, options: DeleteOptions = {}): OpResult {
  const node = state.nodes[nodeId];
  if (!node) return fail(`Node ${nodeId} does not exist.`);
  if (operation === "oc1") {
    if (!isAliasNode(node)) return fail(OC1_NON_ALIAS);
    if (node.parentId === null) return fail("The map root cannot be removed.");
    removeNodes(state, subtree(state.nodes, nodeId));
    return { ok: true };
  }
  if (operation === "oc2") {
    if (!options.parentId) return fail(OC2_PROJECTED);
    return moveUnder(state, nodeId, options.parentId);
  }
  if (operation === "oc3") {
    const entity = entityId(state, nodeId, "oc3");
    if (!entity.ok) return entity;
    const target = state.nodes[entity.id];
    if (!target) return fail(`Node ${entity.id} does not exist.`);
    if (target.valid?.to) return fail("OC3 ends an entity that has not ended. Undo of the end clears valid.to.");
    const at = options.at && options.at.trim() ? options.at : new Date().toISOString();
    target.valid = { ...(target.valid ?? {}), to: at };
    return { ok: true };
  }
  const entity = isAliasNode(node) ? entityId(state, nodeId, "oc4") : { ok: true as const, id: nodeId };
  if (!entity.ok) return entity;
  const subject = state.nodes[entity.id];
  if (!subject) return fail(`Node ${entity.id} does not exist.`);
  if (isAliasNode(subject)) return fail(OC4_IS_OC1);
  if (subject.parentId === null) return fail("The map root cannot be retracted.");
  removeNodes(state, subtree(state.nodes, entity.id));
  return { ok: true };
}

export type CopyRange = "node" | "subtree" | "scope";
export type CopyAlias = "keep" | "skip" | "duplicate";

export interface CopyOptions {
  range?: CopyRange;
  alias?: CopyAlias;
  /** Commit sequence recorded as the copy's baseline. */
  seq: number;
  mapId?: string;
}

export type CopyResult = { ok: true; ids: Record<string, string> } | { ok: false; message: string };

function rangeOf(state: AppState, sourceId: string, range: CopyRange, alias: CopyAlias): string[] {
  const out: string[] = [];
  const walk = (id: string, atRoot: boolean): void => {
    const node = state.nodes[id];
    if (!node) return;
    if (alias === "skip" && isAliasNode(node)) return;
    out.push(id);
    if (range === "node") return;
    for (const child of node.children) {
      const childNode = state.nodes[child];
      if (!childNode) continue;
      if (range === "scope" && atRoot && childNode.edgeOutsideScope) continue;
      walk(child, false);
    }
  };
  walk(sourceId, true);
  return out;
}

/**
 * Copies nodes inside one map. An alias in the range stays an alias of the same entity
 * unless `alias` is `duplicate` or `skip`. A reference outside the range is shared.
 * A scope whose root is in the range is copied by copying that scope root; the scope
 * the root itself lies on is not copied.
 */
export function copyEntities(state: AppState, sourceId: string, parentId: string, options: CopyOptions): CopyResult {
  const range = options.range ?? "subtree";
  const alias = options.alias ?? "keep";
  const source = state.nodes[sourceId];
  const parent = state.nodes[parentId];
  if (!source) return fail(`Node ${sourceId} does not exist.`);
  if (!parent) return fail(`Node ${parentId} does not exist.`);
  if (isAliasNode(parent)) return fail("The destination parent cannot be an alias.");
  const selected = rangeOf(state, sourceId, range, alias);
  if (selected.length === 0) return fail("The copy range is empty.");
  if (selected.includes(parentId)) return fail("The destination parent is inside the copied range.");
  const reserved = new Set(Object.keys(state.nodes));
  const alloc = (seed: string): string => {
    let id = `copy_${seed}`;
    let n = 2;
    while (reserved.has(id)) id = `copy_${seed}_${n++}`;
    reserved.add(id);
    return id;
  };
  const ids: Record<string, string> = {};
  for (const id of selected) ids[id] = alloc(id);
  const mode = `range=${range};alias=${alias}`;
  for (const oldId of selected) {
    const from = state.nodes[oldId];
    const id = ids[oldId];
    const nextParent = oldId === sourceId ? parentId : (from.parentId ? ids[from.parentId] : parentId);
    const children = from.children.filter((child) => ids[child] !== undefined).map((child) => ids[child]);
    const copy: TreeNode = {
      ...from,
      id,
      parentId: nextParent ?? parentId,
      children,
      attributes: { ...from.attributes },
      copyOf: {
        source: oldId,
        ...(options.mapId ? { mapId: options.mapId } : {}),
        seq: options.seq,
        mode,
        ids: { ...ids },
      },
    };
    if (isAliasNode(from) && alias === "duplicate") {
      delete copy.targetNodeId;
      delete copy.aliasLabel;
      delete copy.access;
      delete copy.targetSnapshotLabel;
      delete copy.isBroken;
      copy.nodeType = "text";
    }
    state.nodes[id] = copy;
  }
  parent.children = [...parent.children, ids[sourceId]];
  if (state.links) {
    for (const link of Object.values(state.links)) {
      const sourceNodeId = ids[link.sourceNodeId];
      const targetNodeId = ids[link.targetNodeId];
      if (!sourceNodeId || !targetNodeId) continue;
      const id = alloc(link.id);
      state.links[id] = { ...link, id, sourceNodeId, targetNodeId, attributes: link.attributes ? { ...link.attributes } : undefined };
    }
  }
  return { ok: true, ids };
}

export interface CommitGuardInput {
  intent: string;
  actor?: { kind: string; id: string };
  committedAt: string;
  mapId: string;
  ops: readonly RecordOp[];
  before: (rk: string) => SnapshotRecord | undefined;
  preimage: Iterable<SnapshotRecord>;
}

function aliasRecord(node: NodeRecord): boolean {
  return node.nodeType === "alias" || node.alias !== undefined;
}

function filled(value: string | undefined): boolean {
  return typeof value === "string" && value !== "";
}

/** Why this commit is refused, or null when the locks, grants and operation shape allow it. */
export function commitTimeRefusal(input: CommitGuardInput): string | null {
  const locks: LockRecord[] = [];
  const grants = new Map<string, GrantRecord>();
  const nodes = new Map<string, NodeRecord>();
  const edgeByTarget = new Map<string, EdgeConnectionRecord>();
  const scopes = new Map<string, ScopeRecord>();
  for (const record of input.preimage) {
    if (record.kind === "lock" && record.mapId === input.mapId) locks.push(record);
    else if (record.kind === "grant" && record.mapId === input.mapId) grants.set(recordRk(record), record);
    else if (record.kind === "node" && record.mapId === input.mapId) nodes.set(record.id, record);
    else if (record.kind === "connection" && record.type === "edge" && record.mapId === input.mapId) edgeByTarget.set(record.target, record);
    else if (record.kind === "scope" && record.mapId === input.mapId) scopes.set(record.id, record);
  }
  for (const op of input.ops) {
    if (op.op === "delete") grants.delete(op.rk);
    else if (op.record?.kind === "grant" && op.record.mapId === input.mapId) grants.set(op.rk, op.record);
  }

  const touched = new Map(touchedOf(input.ops, input.before).map((entry) => [entry.rk, entry.ev]));
  const scopeOf = (target: string): string | undefined => {
    if (target.startsWith("scope|")) return target.slice("scope|".length);
    if (!target.startsWith("node|")) return undefined;
    const nodeId = target.slice("node|".length);
    const edge = edgeByTarget.get(nodeId);
    if (edge?.scopeId) return edge.scopeId;
    for (const scope of scopes.values()) if (scope.rootNodeId === nodeId) return scope.id;
    return undefined;
  };
  const blocked = (target: string): boolean => {
    const ev = touched.get(target) ?? [];
    if (ev.includes("m3e:delete") || ev.includes("m3e:end")) return true;
    if (target.startsWith("node|")) {
      const nodeId = target.slice("node|".length);
      const edge = edgeByTarget.get(nodeId);
      if (edge && (touched.get(recordRk(edge)) ?? []).includes("m3e:reparent")) return true;
      const entity = nodes.get(nodeId)?.alias?.target;
      if (entity) {
        const entityEv = touched.get(`node|${entity}`) ?? [];
        if (entityEv.includes("m3e:end") || entityEv.includes("m3e:delete")) return true;
      }
    }
    if (target.startsWith("scope|")) {
      const scope = scopes.get(target.slice("scope|".length));
      if (scope) {
        const rootEv = touched.get(`node|${scope.rootNodeId}`) ?? [];
        if (rootEv.includes("m3e:delete") || rootEv.includes("m3e:end")) return true;
        const edge = edgeByTarget.get(scope.rootNodeId);
        if (edge && (touched.get(recordRk(edge)) ?? []).includes("m3e:reparent")) return true;
      }
    }
    return false;
  };
  for (const lock of locks) {
    if (blocked(lock.target)) return `locked ${lock.target}`;
  }
  if (input.actor?.kind === "ai-agent") {
    for (const op of input.ops) {
      if (op.op !== "delete") continue;
      const prior = input.before(op.rk);
      if (prior?.kind !== "lock") continue;
      const scopeId = scopeOf(prior.target);
      const actorId = input.actor.id;
      const allowed = [...grants.values()].some((grant) =>
        grant.capability === "m3e:unlock" &&
        grant.principal.account === actorId &&
        grant.scopeId === scopeId &&
        (grant.expiresAt === undefined || input.committedAt < grant.expiresAt));
      if (!allowed) return `locked ${prior.target} requires a grant with capability m3e:unlock`;
    }
  }

  if (input.intent !== "oc1" && input.intent !== "oc2" && input.intent !== "oc3" && input.intent !== "oc4") return null;
  const deleted = new Set<string>();
  const putNodes = new Map<string, NodeRecord>();
  for (const op of input.ops) {
    if (op.op === "delete") {
      const prior = input.before(op.rk);
      if (prior?.kind === "node") deleted.add(prior.id);
    } else if (op.record?.kind === "node") putNodes.set(op.record.id, op.record);
  }
  const roots = [...deleted].filter((id) => {
    const parent = edgeByTarget.get(id)?.source;
    return parent === undefined || !deleted.has(parent);
  });
  if (input.intent === "oc1") {
    if (deleted.size === 0 || roots.some((id) => !aliasRecord(nodes.get(id)!))) return OC1_NON_ALIAS;
    for (const id of deleted) {
      const target = nodes.get(id)?.alias?.target;
      if (target && deleted.has(target)) return "OC1 removes an alias occurrence only. It does not retract the entity. Retract the entity with OC4 or end it with OC3.";
    }
    const entities = new Set(roots.map((id) => nodes.get(id)?.alias?.target).filter((id): id is string => typeof id === "string"));
    for (const node of nodes.values()) {
      if (!node.alias?.target || !entities.has(node.alias.target) || deleted.has(node.id)) continue;
      const after = putNodes.get(node.id);
      if (node.alias.broken !== true && after?.alias?.broken === true) {
        return "OC1 removes one alias occurrence. Other aliases of the entity stay. Retract the entity with OC4.";
      }
    }
    return null;
  }
  if (input.intent === "oc2") {
    if (deleted.size > 0) return OC2_PROJECTED;
    let moved = false;
    for (const op of input.ops) {
      if (op.op !== "put" || op.record?.kind !== "connection" || op.record.type !== "edge") continue;
      const prior = input.before(op.rk);
      if (prior?.kind !== "connection" || prior.type !== "edge") continue;
      if (prior.source !== op.record.source || prior.scopeId !== op.record.scopeId) moved = true;
    }
    if (!moved) return OC2_PROJECTED;
    return null;
  }
  if (input.intent === "oc3") {
    if (deleted.size > 0) return "OC3 ends the entity and keeps the node and its aliases. Retract the entity with OC4 or remove an occurrence with OC1.";
    let ended = false;
    for (const [id, after] of putNodes) {
      const prior = nodes.get(id);
      if (!prior) continue;
      if (!filled(prior.valid?.to) && filled(after.valid?.to)) ended = true;
      if (aliasRecord(prior) && prior.alias?.broken !== true && after.alias?.broken === true) {
        return "OC3 keeps aliases alive. Retract the entity with OC4.";
      }
    }
    if (!ended) return "OC3 fills valid.to and keeps the entity. Remove an occurrence with OC1 or retract it with OC4.";
    return null;
  }
  if (deleted.size === 0) return "OC4 retracts the entity. This command does not delete it. Remove an occurrence with OC1 or end the entity with OC3.";
  if (roots.every((id) => aliasRecord(nodes.get(id)!))) return OC4_IS_OC1;
  for (const node of nodes.values()) {
    if (!aliasRecord(node) || !node.alias?.target || !deleted.has(node.alias.target) || deleted.has(node.id)) continue;
    if (putNodes.get(node.id)?.alias?.broken !== true) return "OC4 leaves aliases of the retracted entity broken. Remove an occurrence with OC1.";
    for (const edge of edgeByTarget.values()) {
      if (edge.source === node.id && deleted.has(edge.target)) return "OC4 keeps the children of an alias. Retract does not delete them.";
    }
  }
  return null;
}
