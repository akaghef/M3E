// Projection, write-back, link-to-entity, promotion and named snapshots.
// Database_Spec 12.3, 12.4, 12.6 and 12.7. One Command mutates the state; the store commits it.

import type { AppState, GraphLink, MapScope, TreeNode } from "../../shared/types";
import { generatedId } from "../../shared/record_model/steady";
import { sha256Hex } from "../../shared/record_model/hash";
import { compareStrings } from "../../shared/record_model/types";
import type { ScopeProjection } from "../../shared/record_model/types";

export type NodeChoice = "new" | "hold" | { target: string };
export type PlanCode = "INVALID_COMMAND" | "CONFLICT" | "NOT_FOUND";
export type PlanResult = { ok: true } | { ok: false; code: PlanCode; message: string };

export interface ProjectInput {
  commandId: string;
  mode: "observe" | "work";
  workspaceId: string;
  mapId: string;
  /** Seq the commit will receive. Stamped as projection.baseSeq in work mode. */
  seq: number;
  sourceScopeId?: string;
  /** Root node of the source plane, when `from` is a scope. */
  scopeRootId?: string;
  relationType?: string;
  reads?: "source-to-target" | "target-to-source";
  root?: string;
  entities?: string[];
  depth?: number;
  parentId?: string;
  label?: string;
}

export interface WriteBackInput {
  commandId: string;
  workspaceId: string;
  mapId: string;
  seq: number;
  scopeKey: string;
  reason: string;
  name?: string;
  nodes?: Record<string, NodeChoice>;
  reads?: "source-to-target" | "target-to-source";
  /** Root of the plane the projection was taken from. QB5 moves a dissolved entity here. */
  homeRootId?: string;
  scopeRecordId: string;
}

export interface OccurrenceView {
  entity: string;
  parent: string | null;
}

const OBSERVE_EDIT = "An observe projection stores no alias or parent edge. Reading it computes the view.";

function fail(code: PlanCode, message: string): PlanResult {
  return { ok: false, code, message };
}

function blank(id: string, parentId: string | null, text: string, nodeType: TreeNode["nodeType"]): TreeNode {
  return { id, parentId, children: [], nodeType, text, collapsed: false, details: "", note: "", attributes: {}, link: "" };
}

function resolveEntity(state: AppState, id: string): string | null {
  const seen = new Set<string>();
  let at = id;
  while (!seen.has(at)) {
    const node = state.nodes[at];
    if (!node) return null;
    if (node.nodeType !== "alias" || !node.targetNodeId || node.isBroken) return at;
    seen.add(at);
    at = node.targetNodeId;
  }
  return null;
}

interface RawOcc {
  entity: string;
  parentEntity: string | null;
  order: number;
}

function relationChildren(state: AppState, relationType: string, reads: "source-to-target" | "target-to-source"): Map<string, string[]> {
  const buckets = new Map<string, Set<string>>();
  for (const link of Object.values(state.links ?? {})) {
    if ((link.relationType ?? "") !== relationType) continue;
    const source = resolveEntity(state, link.sourceNodeId);
    const target = resolveEntity(state, link.targetNodeId);
    if (!source || !target || source === target) continue;
    const parent = reads === "target-to-source" ? target : source;
    const child = reads === "target-to-source" ? source : target;
    const set = buckets.get(parent) ?? new Set<string>();
    set.add(child);
    buckets.set(parent, set);
  }
  const out = new Map<string, string[]>();
  for (const [parent, set] of buckets) out.set(parent, [...set].sort(compareStrings));
  return out;
}

function collectRelation(state: AppState, relationType: string, reads: "source-to-target" | "target-to-source", root: string | undefined, entities: string[] | undefined, depth: number | undefined): RawOcc[] | string {
  const children = relationChildren(state, relationType, reads);
  const occs: RawOcc[] = [];
  if (entities) {
    const set = new Set<string>();
    for (const id of entities) {
      const entity = resolveEntity(state, id);
      if (!entity || state.nodes[entity]?.nodeType === "alias") return "An entity in the range does not resolve to a node.";
      set.add(entity);
    }
    for (const entity of [...set].sort(compareStrings)) {
      const parents: string[] = [];
      for (const [parent, kids] of children) if (set.has(parent) && kids.includes(entity)) parents.push(parent);
      if (parents.length === 0) occs.push({ entity, parentEntity: null, order: 0 });
      else {
        for (const parent of parents.sort(compareStrings)) {
          occs.push({ entity, parentEntity: parent, order: (children.get(parent) ?? []).indexOf(entity) });
        }
      }
    }
    return occs;
  }
  if (!root) return "A projection names a start entity or a set of entities.";
  const start = resolveEntity(state, root);
  if (!start || state.nodes[start]?.nodeType === "alias") return "The start entity does not resolve to a node.";
  const walk = (entity: string, parentEntity: string | null, depthLeft: number | undefined, order: number, branch: Set<string>): void => {
    if (branch.has(entity)) return;
    occs.push({ entity, parentEntity, order });
    if (depthLeft !== undefined && depthLeft <= 0) return;
    const next = new Set(branch);
    next.add(entity);
    const kids = children.get(entity) ?? [];
    kids.forEach((child, index) => walk(child, entity, depthLeft === undefined ? undefined : depthLeft - 1, index, next));
  };
  walk(start, null, depth, 0, new Set());
  return occs;
}

function collectPlane(state: AppState, scopeRootId: string | undefined, root: string | undefined, entities: string[] | undefined, depth: number | undefined): RawOcc[] | string {
  const onPlane = (id: string): boolean => {
    if (!scopeRootId) return true;
    let at: string | null | undefined = id;
    const seen = new Set<string>();
    while (typeof at === "string" && !seen.has(at)) {
      if (at === scopeRootId) return true;
      seen.add(at);
      at = state.nodes[at]?.parentId;
    }
    return false;
  };
  const occs: RawOcc[] = [];
  if (entities) {
    const wanted = new Set<string>();
    for (const id of entities) {
      const entity = resolveEntity(state, id);
      if (!entity || !onPlane(id) && !onPlane(entity)) return "An entity in the range is not on the source scope.";
      if (state.nodes[entity]?.nodeType === "alias") return "An entity in the range does not resolve to a node.";
      wanted.add(entity);
    }
    const seen = new Set<string>();
    const visit = (nodeId: string): void => {
      const node = state.nodes[nodeId];
      if (!node || seen.has(nodeId)) return;
      seen.add(nodeId);
      const entity = resolveEntity(state, nodeId);
      if (entity && wanted.has(entity) && state.nodes[entity]?.nodeType !== "alias") {
        const parentNode = node.parentId ? state.nodes[node.parentId] : undefined;
        const parentEntity = parentNode ? resolveEntity(state, parentNode.id) : null;
        const linked = parentEntity && wanted.has(parentEntity) ? parentEntity : null;
        const order = parentNode ? parentNode.children.indexOf(nodeId) : 0;
        const key = `${entity}\u0000${linked ?? ""}`;
        if (![...occs].some((item) => `${item.entity}\u0000${item.parentEntity ?? ""}` === key)) {
          occs.push({ entity, parentEntity: linked, order });
        }
      }
      for (const child of node.children) {
        const childNode = state.nodes[child];
        if (!childNode || childNode.parentId !== nodeId) continue;
        if (scopeRootId && nodeId === scopeRootId && childNode.edgeOutsideScope) continue;
        visit(child);
      }
    };
    if (scopeRootId) visit(scopeRootId);
    else for (const id of Object.keys(state.nodes)) visit(id);
    if (occs.length === 0) return "The range is empty.";
    return occs;
  }
  if (!root) return "A projection names a start entity or a set of entities.";
  if (!state.nodes[root]) return "The start entity does not resolve to a node.";
  const walk = (nodeId: string, parentEntity: string | null, depthLeft: number | undefined, order: number, branch: Set<string>): string | void => {
    const entity = resolveEntity(state, nodeId);
    if (!entity || state.nodes[entity]?.nodeType === "alias") return "An entity in the range does not resolve to a node.";
    if (branch.has(entity + "\u0000" + nodeId)) return;
    occs.push({ entity, parentEntity, order });
    if (depthLeft !== undefined && depthLeft <= 0) return;
    const node = state.nodes[nodeId];
    if (!node) return;
    const next = new Set(branch);
    next.add(entity + "\u0000" + nodeId);
    let index = 0;
    for (const childId of node.children) {
      const child = state.nodes[childId];
      if (!child || child.parentId !== nodeId) continue;
      if (scopeRootId && nodeId === scopeRootId && child.edgeOutsideScope) continue;
      const problem = walk(childId, entity, depthLeft === undefined ? undefined : depthLeft - 1, index, next);
      if (typeof problem === "string") return problem;
      index += 1;
    }
  };
  const problem = walk(root, null, depth, 0, new Set());
  if (typeof problem === "string") return problem;
  return occs;
}

function dedupe(occs: RawOcc[]): RawOcc[] {
  const seen = new Set<string>();
  const out: RawOcc[] = [];
  for (const occ of occs) {
    const key = `${occ.entity}\u0000${occ.parentEntity ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(occ);
  }
  return out;
}

export function planProject(state: AppState, input: ProjectInput): PlanResult {
  const reads = input.reads ?? "source-to-target";
  const collected = input.relationType
    ? collectRelation(state, input.relationType, reads, input.root, input.entities, input.depth)
    : collectPlane(state, input.scopeRootId, input.root, input.entities, input.depth);
  if (typeof collected === "string") return fail("INVALID_COMMAND", collected);
  const occs = dedupe(collected);
  if (occs.length === 0) return fail("INVALID_COMMAND", "The range is empty.");
  const from: ScopeProjection["from"] = input.relationType ? { relationType: input.relationType } : { scopeId: input.sourceScopeId ?? "" };
  if (!input.relationType && !input.sourceScopeId) return fail("INVALID_COMMAND", "A plane projection names the source scope.");
  const range: ScopeProjection["range"] = input.entities
    ? { entities: input.entities.map((id) => resolveEntity(state, id) ?? id) }
    : { root: resolveEntity(state, input.root ?? "") ?? input.root ?? "", ...(input.depth !== undefined ? { depth: input.depth } : {}) };
  state.scopes = state.scopes ?? {};
  if (input.mode === "observe") {
    const observeId = generatedId(sha256Hex, input.workspaceId, "s_", input.mapId, "scope", `observe:${input.commandId}`);
    const key = `scope:${observeId}`;
    const root = "root" in range ? range.root : occs.find((item) => item.parentEntity === null)?.entity ?? occs[0]!.entity;
    state.scopes[key] = {
      id: key,
      label: input.label ?? state.nodes[root]?.text ?? "Projection",
      rootNodeIds: [root],
      relationIds: [],
      band: "rapid",
      projection: { mode: "observe", from, range },
    };
    return { ok: true };
  }
  const folderId = generatedId(sha256Hex, input.workspaceId, "n_", input.mapId, "node", `plane:${input.commandId}`);
  if (state.nodes[folderId]) return fail("INVALID_COMMAND", "The projection plane already exists.");
  const parentId = input.parentId ?? state.rootId;
  const parent = state.nodes[parentId];
  if (!parent) return fail("NOT_FOUND", "The projection plane has no parent.");
  if (parent.nodeType === "alias") return fail("INVALID_COMMAND", "The projection plane hangs under a node that can own a scope.");
  const folder = blank(folderId, parentId, input.label ?? "Projection", "folder");
  state.nodes[folderId] = folder;
  parent.children = [...parent.children, folderId];
  const aliasId = (parentEntity: string | null, entity: string): string =>
    generatedId(sha256Hex, input.workspaceId, "n_", input.mapId, "node", `alias:${folderId}:${parentEntity ?? "-"}:${entity}`);
  const idsByEntity = new Map<string, string[]>();
  for (const occ of occs) {
    const id = aliasId(occ.parentEntity, occ.entity);
    if (state.nodes[id]) return fail("INVALID_COMMAND", "An alias id of this projection already exists.");
    const source = state.nodes[occ.entity];
    const alias = blank(id, folderId, source?.text ?? "", "alias");
    alias.targetNodeId = occ.entity;
    alias.access = "write";
    state.nodes[id] = alias;
    const list = idsByEntity.get(occ.entity) ?? [];
    list.push(id);
    idsByEntity.set(occ.entity, list);
  }
  const chosen = (entity: string): string => [...(idsByEntity.get(entity) ?? [])].sort(compareStrings)[0] ?? folderId;
  const groups = new Map<string, RawOcc[]>();
  for (const occ of occs) {
    const parentAlias = occ.parentEntity === null ? folderId : chosen(occ.parentEntity);
    const list = groups.get(parentAlias) ?? [];
    list.push(occ);
    groups.set(parentAlias, list);
  }
  for (const [parentAlias, list] of groups) {
    list.sort((a, b) => a.order - b.order || compareStrings(a.entity, b.entity));
    state.nodes[parentAlias]!.children = list.map((occ) => aliasId(occ.parentEntity, occ.entity));
    for (const occ of list) state.nodes[aliasId(occ.parentEntity, occ.entity)]!.parentId = parentAlias;
  }
  const key = `scope:${folderId}`;
  state.scopes[key] = {
    id: key,
    label: folder.text,
    rootNodeIds: [folderId],
    relationIds: [],
    band: "rapid",
    projection: { mode: "work", from, range, baseSeq: input.seq },
  };
  return { ok: true };
}

interface AliasOcc {
  aliasId: string;
  entity: string;
  parentEntity: string | null;
  index: number;
}

function aliasOccurrences(state: AppState, folderId: string): AliasOcc[] {
  const out: AliasOcc[] = [];
  const walk = (id: string): void => {
    const node = state.nodes[id];
    if (!node) return;
    if (id !== folderId && node.nodeType === "alias" && node.targetNodeId) {
      const parent = node.parentId ? state.nodes[node.parentId] : undefined;
      const parentEntity = parent?.nodeType === "alias" && parent.targetNodeId ? parent.targetNodeId : null;
      out.push({ aliasId: id, entity: node.targetNodeId, parentEntity, index: parent?.children.indexOf(id) ?? 0 });
    }
    for (const child of node.children) walk(child);
  };
  walk(folderId);
  return out;
}

function siblingOrders(occs: AliasOcc[]): Map<string, string[]> {
  const groups = new Map<string, AliasOcc[]>();
  for (const occ of occs) {
    if (occ.parentEntity === null) continue;
    const list = groups.get(occ.parentEntity) ?? [];
    list.push(occ);
    groups.set(occ.parentEntity, list);
  }
  const out = new Map<string, string[]>();
  for (const [parent, list] of groups) {
    list.sort((a, b) => a.index - b.index || compareStrings(a.entity, b.entity));
    out.set(parent, list.map((item) => item.entity));
  }
  return out;
}

function sameList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sourceParent(state: AppState, entity: string): string | null {
  const node = state.nodes[entity];
  if (!node || node.parentId === null) return null;
  return node.parentId;
}

function sourceChildren(state: AppState, parentId: string): string[] {
  return state.nodes[parentId]?.children ?? [];
}

function findRelation(state: AppState, relationType: string, reads: "source-to-target" | "target-to-source", parent: string, child: string): GraphLink | undefined {
  return Object.values(state.links ?? {}).find((link) => {
    if ((link.relationType ?? "") !== relationType) return false;
    const source = reads === "target-to-source" ? link.targetNodeId : link.sourceNodeId;
    const target = reads === "target-to-source" ? link.sourceNodeId : link.targetNodeId;
    return source === parent && target === child;
  });
}

function moveEntity(state: AppState, entity: string, parentId: string): string | null {
  const node = state.nodes[entity];
  const parent = state.nodes[parentId];
  if (!node || !parent) return `Node ${entity} cannot be moved.`;
  if (node.parentId === null) return "The map root cannot be moved.";
  if (entity === parentId) return "A node cannot be moved under itself.";
  let at: string | null | undefined = parentId;
  const seen = new Set<string>();
  while (typeof at === "string" && !seen.has(at)) {
    if (at === entity) return "A node cannot be moved under itself.";
    seen.add(at);
    at = state.nodes[at]?.parentId;
  }
  if (node.parentId === parentId) return null;
  const old = node.parentId ? state.nodes[node.parentId] : undefined;
  if (old) old.children = old.children.filter((id) => id !== entity);
  node.parentId = parentId;
  if (!parent.children.includes(entity)) parent.children = [...parent.children, entity];
  return null;
}

function ensureRelation(state: AppState, input: WriteBackInput, relationType: string, reads: "source-to-target" | "target-to-source", parent: string, child: string): void {
  if (findRelation(state, relationType, reads, parent, child)) return;
  const id = generatedId(sha256Hex, input.workspaceId, "c_", input.mapId, "graphlink", `wb:${input.commandId}:${parent}:${child}`);
  const link: GraphLink = reads === "target-to-source"
    ? { id, sourceNodeId: child, targetNodeId: parent, relationType }
    : { id, sourceNodeId: parent, targetNodeId: child, relationType };
  state.links = state.links ?? {};
  state.links[id] = link;
}

function dropRelation(state: AppState, relationType: string, reads: "source-to-target" | "target-to-source", parent: string, child: string): void {
  const link = findRelation(state, relationType, reads, parent, child);
  if (!link || !state.links) return;
  delete state.links[link.id];
}

function reorderChildren(state: AppState, parentId: string, wanted: string[]): void {
  const parent = state.nodes[parentId];
  if (!parent) return;
  const wantedSet = new Set(wanted);
  const present = wanted.filter((id) => parent.children.includes(id));
  if (present.length === 0) return;
  const next: string[] = [];
  let inserted = false;
  for (const id of parent.children) {
    if (!wantedSet.has(id)) {
      next.push(id);
      continue;
    }
    if (!inserted) {
      next.push(...present);
      inserted = true;
    }
  }
  parent.children = next;
}

function nonAliases(state: AppState, folderId: string): string[] {
  const out: string[] = [];
  const walk = (id: string): void => {
    const node = state.nodes[id];
    if (!node) return;
    if (id !== folderId && node.nodeType !== "alias") out.push(id);
    for (const child of node.children) walk(child);
  };
  walk(folderId);
  return out;
}

function addNamedSnapshot(state: AppState, input: { workspaceId: string; mapId: string; commandId: string; seq: number; scopeRecordId: string; reason: string; name?: string }, fallback: string): void {
  const id = generatedId(sha256Hex, input.workspaceId, "ns_", input.mapId, "namedSnapshot", `${fallback}:${input.commandId}`);
  state.namedSnapshots = {
    ...(state.namedSnapshots ?? {}),
    [id]: { name: input.name ?? fallback, seq: input.seq, scopeId: input.scopeRecordId, reason: input.reason },
  };
}

export function planWriteBack(state: AppState, base: AppState, input: WriteBackInput): PlanResult {
  if (!input.reason.trim()) return fail("INVALID_COMMAND", "Write-back names a reason.");
  const scope = state.scopes?.[input.scopeKey];
  if (!scope?.projection) return fail("NOT_FOUND", "This scope has no projection.");
  if (scope.projection.mode !== "work") return fail("INVALID_COMMAND", "Write-back applies to a work projection.");
  const folderId = scope.rootNodeIds[0];
  if (!folderId || !state.nodes[folderId] || !base.nodes[folderId]) return fail("NOT_FOUND", "The work plane is missing.");
  const relationType = "relationType" in scope.projection.from ? scope.projection.from.relationType : undefined;
  const reads = input.reads ?? "source-to-target";
  const plane = !relationType;
  const now = aliasOccurrences(state, folderId);
  const then = aliasOccurrences(base, folderId);
  const nowById = new Map(now.map((item) => [item.aliasId, item]));
  const thenById = new Map(then.map((item) => [item.aliasId, item]));
  const dissolved = scope.projection.dissolved ?? [];
  const dissolvedKey = new Set(dissolved.map((pair) => `${pair.parent}\u0000${pair.child}`));

  type Move = { entity: string; parent: string | null; kind: "reparent" | "add" | "dissolve" };
  const moves: Move[] = [];
  for (const occ of now) {
    const prior = thenById.get(occ.aliasId);
    if (!prior) {
      if (occ.parentEntity !== null) moves.push({ entity: occ.entity, parent: occ.parentEntity, kind: "add" });
      continue;
    }
    if (prior.parentEntity !== occ.parentEntity && occ.parentEntity !== null) {
      moves.push({ entity: occ.entity, parent: occ.parentEntity, kind: "reparent" });
    }
  }
  for (const occ of then) {
    if (nowById.has(occ.aliasId)) continue;
    if (occ.parentEntity !== null && dissolvedKey.has(`${occ.parentEntity}\u0000${occ.entity}`)) {
      moves.push({ entity: occ.entity, parent: occ.parentEntity, kind: "dissolve" });
    }
  }
  const nowOrders = siblingOrders(now);
  const thenOrders = siblingOrders(then);
  const reorders: Array<{ parent: string; order: string[] }> = [];
  if (plane) {
    for (const [parent, order] of nowOrders) {
      const before = thenOrders.get(parent) ?? [];
      if (sameList(before, order)) continue;
      const keep = new Set(before.filter((id) => order.includes(id)));
      const sourceThen = sourceChildren(base, parent).filter((id) => keep.has(id));
      const sourceNow = sourceChildren(state, parent).filter((id) => keep.has(id));
      if (!sameList(sourceThen, sourceNow)) {
        return fail("CONFLICT", `CONFLICT: sibling order of ${parent} changed after baseSeq.`);
      }
      reorders.push({ parent, order });
    }
  }
  for (const move of moves) {
    if (!state.nodes[move.entity] || !base.nodes[move.entity]) {
      return fail("CONFLICT", `CONFLICT: ${move.entity} changed after baseSeq.`);
    }
    if (plane) {
      if (sourceParent(base, move.entity) !== sourceParent(state, move.entity)) {
        return fail("CONFLICT", `CONFLICT: ${move.entity} changed after baseSeq.`);
      }
    } else if (relationType && move.parent) {
      const had = Boolean(findRelation(base, relationType, reads, move.parent, move.entity));
      const has = Boolean(findRelation(state, relationType, reads, move.parent, move.entity));
      if (move.kind === "dissolve" || move.kind === "reparent") {
        if (had !== has) return fail("CONFLICT", `CONFLICT: the relation of ${move.entity} changed after baseSeq.`);
      }
      if (move.kind === "add" || move.kind === "reparent") {
        if (had !== has && move.kind === "add") return fail("CONFLICT", `CONFLICT: the relation of ${move.entity} changed after baseSeq.`);
      }
    }
  }
  if (relationType) {
    for (const move of moves) {
      if (move.kind !== "reparent") continue;
      const prior = then.find((item) => item.entity === move.entity && now.some((item) => item.aliasId === thenById.get(item.aliasId)?.aliasId && item.entity === move.entity));
      const fromParent = [...thenById.values()].find((item) => item.entity === move.entity && nowById.get(item.aliasId)?.parentEntity === move.parent)?.parentEntity;
      // The old parent is the base occurrence of the alias whose parent changed.
      const oldParent = [...thenById.values()].find((item) => nowById.get(item.aliasId)?.entity === move.entity && nowById.get(item.aliasId)?.parentEntity === move.parent)?.parentEntity;
      if (oldParent && oldParent !== move.parent) {
        const had = Boolean(findRelation(base, relationType, reads, oldParent, move.entity));
        const has = Boolean(findRelation(state, relationType, reads, oldParent, move.entity));
        if (had !== has) return fail("CONFLICT", `CONFLICT: the relation of ${move.entity} changed after baseSeq.`);
      }
      void prior;
      void fromParent;
    }
  }
  const planeNodes = new Set(nonAliases(state, folderId));
  for (const [id, choice] of Object.entries(input.nodes ?? {})) {
    if (!planeNodes.has(id)) return fail("INVALID_COMMAND", "Write-back was given a node that is not a non-alias on the plane.");
    if (choice !== "new" && choice !== "hold" && (typeof choice !== "object" || typeof choice.target !== "string")) {
      return fail("INVALID_COMMAND", "A node's write-back choice is a new Deep entity, an existing Deep entity, or not yet.");
    }
  }

  for (const move of moves) {
    if (!relationType) {
      if (move.kind === "dissolve") {
        if (!input.homeRootId) return fail("INVALID_COMMAND", "A dissolved entity moves to the root of its plane.");
        const problem = moveEntity(state, move.entity, input.homeRootId);
        if (problem) return fail("INVALID_COMMAND", problem);
      } else if (move.parent) {
        const problem = moveEntity(state, move.entity, move.parent);
        if (problem) return fail("INVALID_COMMAND", problem);
      }
    } else if (move.kind === "dissolve" && move.parent) {
      dropRelation(state, relationType, reads, move.parent, move.entity);
    } else if (move.kind === "add" && move.parent) {
      ensureRelation(state, input, relationType, reads, move.parent, move.entity);
    } else if (move.kind === "reparent" && move.parent) {
      const oldParent = [...thenById.values()].find((item) => nowById.get(item.aliasId)?.parentEntity === move.parent && item.entity === move.entity)?.parentEntity;
      if (oldParent && oldParent !== move.parent) dropRelation(state, relationType, reads, oldParent, move.entity);
      ensureRelation(state, input, relationType, reads, move.parent, move.entity);
    }
  }
  for (const reorder of reorders) reorderChildren(state, reorder.parent, reorder.order);
  for (const [id, choice] of Object.entries(input.nodes ?? {})) {
    if (choice === "new" || choice === "hold") continue;
    const target = state.nodes[choice.target];
    if (!target || target.nodeType === "alias") return fail("INVALID_COMMAND", "The existing Deep entity is not a node.");
    const node = state.nodes[id]!;
    if (node.nodeType === "alias" && node.targetNodeId && node.targetNodeId !== choice.target) {
      return fail("INVALID_COMMAND", "The node is already an alias of a different entity.");
    }
    node.nodeType = "alias";
    node.targetNodeId = choice.target;
    node.access = node.access ?? "write";
  }
  const next: ScopeProjection = { mode: "work", from: scope.projection.from, range: scope.projection.range, baseSeq: input.seq };
  scope.projection = next;
  addNamedSnapshot(state, input, "write-back");
  return { ok: true };
}

export function planLink(state: AppState, nodeId: string, targetId: string | undefined, unlink: boolean): PlanResult {
  const node = state.nodes[nodeId];
  if (!node) return fail("NOT_FOUND", "The node does not exist.");
  if (unlink) {
    if (node.nodeType !== "alias") return { ok: true };
    node.nodeType = "text";
    delete node.targetNodeId;
    delete node.access;
    delete node.aliasLabel;
    delete node.isBroken;
    delete node.targetSnapshotLabel;
    return { ok: true };
  }
  if (!targetId) return fail("INVALID_COMMAND", "Linking names the existing entity.");
  const target = state.nodes[targetId];
  if (!target || target.nodeType === "alias") return fail("INVALID_COMMAND", "The existing entity is not a node.");
  if (targetId === nodeId) return fail("INVALID_COMMAND", "A node cannot become an alias of itself.");
  if (node.nodeType === "alias") {
    if (node.targetNodeId === targetId) return { ok: true };
    return fail("INVALID_COMMAND", "The node is already an alias of a different entity.");
  }
  node.nodeType = "alias";
  node.targetNodeId = targetId;
  node.access = "write";
  return { ok: true };
}

function nodesOnScope(state: AppState, rootId: string): string[] {
  const out: string[] = [];
  const walk = (id: string, atRoot: boolean): void => {
    const node = state.nodes[id];
    if (!node) return;
    out.push(id);
    for (const child of node.children) {
      const childNode = state.nodes[child];
      if (!childNode || childNode.parentId !== id) continue;
      if (atRoot && childNode.edgeOutsideScope) continue;
      walk(child, false);
    }
  };
  walk(rootId, true);
  return out;
}

export function planPromote(state: AppState, input: { scopeKey: string; nodes: Record<string, NodeChoice>; reason: string; workspaceId: string; mapId: string; commandId: string; seq: number; scopeRecordId: string }): PlanResult {
  if (!input.reason.trim()) return fail("INVALID_COMMAND", "Promotion names a reason.");
  const scope = state.scopes?.[input.scopeKey];
  if (!scope) return fail("NOT_FOUND", "The scope does not exist.");
  if (scope.projection) return fail("INVALID_COMMAND", "A scope with a projection is rapid. It cannot become deep.");
  if (scope.band === "deep") return fail("INVALID_COMMAND", "Promotion starts from a rapid scope.");
  const rootId = scope.rootNodeIds[0];
  if (!rootId || !state.nodes[rootId]) return fail("NOT_FOUND", "The scope root does not exist.");
  const members = nodesOnScope(state, rootId);
  const memberSet = new Set(members);
  for (const id of Object.keys(input.nodes)) {
    if (!memberSet.has(id)) return fail("INVALID_COMMAND", "Promotion was given a node that is not on the scope.");
  }
  for (const id of members) {
    const choice = input.nodes[id];
    if (choice === undefined) return fail("INVALID_COMMAND", "Promotion requires a choice for every node: a new Deep entity, or an existing Deep entity.");
    if (choice === "hold") return fail("INVALID_COMMAND", "A promotion covers the whole scope. Leaving a node unpromoted is not committed.");
    if (choice === "new") continue;
    if (typeof choice !== "object" || typeof choice.target !== "string") {
      return fail("INVALID_COMMAND", "Promotion requires a choice for every node: a new Deep entity, or an existing Deep entity.");
    }
    const target = state.nodes[choice.target];
    if (!target || target.nodeType === "alias") return fail("INVALID_COMMAND", "The existing Deep entity is not a node.");
    const node = state.nodes[id]!;
    if (node.nodeType === "alias" && node.targetNodeId && node.targetNodeId !== choice.target) {
      return fail("INVALID_COMMAND", "The node is already an alias of a different entity.");
    }
  }
  for (const id of members) {
    const choice = input.nodes[id]!;
    if (choice === "new") continue;
    if (typeof choice === "string") continue;
    const node = state.nodes[id]!;
    node.nodeType = "alias";
    node.targetNodeId = choice.target;
    node.access = node.access ?? "write";
  }
  scope.band = "deep";
  addNamedSnapshot(state, input, "promotion");
  return { ok: true };
}

export function planSetBand(state: AppState, scopeKey: string, band: "rapid" | "deep" | undefined, retentionMs: number | undefined, retentionBytes: number | undefined): PlanResult {
  const scope = state.scopes?.[scopeKey];
  if (!scope) return fail("NOT_FOUND", "The scope does not exist.");
  if (band === "deep") {
    if (scope.projection) return fail("INVALID_COMMAND", "A scope with a projection is rapid. It cannot become deep.");
    return fail("INVALID_COMMAND", "A scope becomes deep by the promotion Command.");
  }
  if (band === "rapid") scope.band = "rapid";
  if (retentionMs !== undefined || retentionBytes !== undefined) {
    const next = { ...(scope.retention ?? {}) };
    if (retentionMs !== undefined) next.ms = retentionMs;
    if (retentionBytes !== undefined) next.bytes = retentionBytes;
    scope.retention = next;
  }
  return { ok: true };
}

export function planNamedSnapshot(state: AppState, input: { id?: string; name: string; seq: number; scopeRecordId: string; reason: string; workspaceId: string; mapId: string; commandId: string }): PlanResult {
  if (!input.name.trim() || !input.reason.trim()) return fail("INVALID_COMMAND", "A namedSnapshot has a name and a reason.");
  const id = input.id ?? generatedId(sha256Hex, input.workspaceId, "ns_", input.mapId, "namedSnapshot", `named:${input.commandId}`);
  state.namedSnapshots = { ...(state.namedSnapshots ?? {}), [id]: { name: input.name, seq: input.seq, scopeId: input.scopeRecordId, reason: input.reason } };
  return { ok: true };
}

export function planDeleteNamedSnapshot(state: AppState, id: string): PlanResult {
  if (!state.namedSnapshots?.[id]) return fail("NOT_FOUND", "The namedSnapshot does not exist.");
  const next = { ...state.namedSnapshots };
  delete next[id];
  state.namedSnapshots = next;
  return { ok: true };
}

export function readProjectionView(state: AppState, scope: MapScope, options: { scopeRootId?: string; reads?: "source-to-target" | "target-to-source" }): { ok: true; occurrences: OccurrenceView[] } | { ok: false; message: string } {
  const projection = scope.projection;
  if (!projection) return { ok: false, message: "This scope has no projection." };
  if (projection.mode === "work") {
    const folderId = scope.rootNodeIds[0];
    if (!folderId) return { ok: false, message: "The work plane is missing." };
    return { ok: true, occurrences: aliasOccurrences(state, folderId).map((item) => ({ entity: item.entity, parent: item.parentEntity })) };
  }
  const range = projection.range;
  const entities = "entities" in range ? range.entities : undefined;
  const root = "root" in range ? range.root : undefined;
  const depth = "root" in range ? range.depth : undefined;
  const collected = "relationType" in projection.from
    ? collectRelation(state, projection.from.relationType, options.reads ?? "source-to-target", root, entities, depth)
    : collectPlane(state, options.scopeRootId, root, entities, depth);
  if (typeof collected === "string") return { ok: false, message: collected };
  return { ok: true, occurrences: dedupe(collected).map((item) => ({ entity: item.entity, parent: item.parentEntity })) };
}

export function observeEditMessage(): string {
  return OBSERVE_EDIT;
}
