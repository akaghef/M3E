import type { AppState, GraphLink, TreeNode } from "./types";
import type { OrreryActor, OrreryMapBinding, OrreryRelation, OrrerySnapshot } from "./orrery_seam_interface";
import { validateOrrerySnapshot } from "./orrery_observation";

const hasOwn = (object: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(object, key);

export interface OrreryMapProjection {
  /** Display-only materialization. Never use this state for save, undo, or sync. */
  state: AppState;
  actorNodeIds: string[];
  actorByNodeId: Record<string, OrreryActor>;
  relationByLinkId: Record<string, OrreryRelation>;
  runtimeNodeIds: string[];
  runtimeLinkIds: string[];
}

export function orreryRuntimeNodeId(actorId: string): string {
  return `orrery-runtime:${encodeURIComponent(actorId)}`;
}

/** Pure read model; neither authoring nor snapshot objects are shared with the result. */
export function projectOrreryMap(
  authoring: AppState, snapshot: OrrerySnapshot, bindings: readonly OrreryMapBinding[] = [],
): OrreryMapProjection {
  const checked = validateOrrerySnapshot(snapshot);
  const state: AppState = JSON.parse(JSON.stringify(authoring));
  if (!hasOwn(state.nodes, state.rootId)) throw new Error("orrery_missing_map_root");
  const result: OrreryMapProjection = {
    state, actorNodeIds: [], actorByNodeId: Object.create(null), relationByLinkId: Object.create(null),
    runtimeNodeIds: [], runtimeLinkIds: [],
  };
  const actors = new Set(checked.actors.map((actor) => actor.id));
  const nodeByActor = new Map<string, string>();
  const boundNodes = new Set<string>();
  for (const binding of bindings) {
    if (!actors.has(binding.actorId) || !hasOwn(state.nodes, binding.mapNodeId)) throw new Error("orrery_invalid_binding");
    if (nodeByActor.has(binding.actorId) || boundNodes.has(binding.mapNodeId)) throw new Error("orrery_duplicate_binding");
    for (const roleId of binding.roleNodeIds ?? []) {
      if (!hasOwn(state.nodes, roleId)) throw new Error("orrery_invalid_role_binding");
    }
    nodeByActor.set(binding.actorId, binding.mapNodeId);
    boundNodes.add(binding.mapNodeId);
  }
  for (const actor of [...checked.actors].sort((a, b) => a.id.localeCompare(b.id))) {
    let nodeId = nodeByActor.get(actor.id);
    if (!nodeId) {
      nodeId = orreryRuntimeNodeId(actor.id);
      if (hasOwn(state.nodes, nodeId)) throw new Error("orrery_runtime_id_collision");
      const node: TreeNode = {
        id: nodeId, parentId: state.rootId, children: [], nodeType: "text", text: actor.name,
        collapsed: false, details: "", note: "", link: "", attributes: {},
      };
      state.nodes[nodeId] = node;
      state.nodes[state.rootId].children.push(nodeId);
      nodeByActor.set(actor.id, nodeId);
      result.runtimeNodeIds.push(nodeId);
    }
    result.actorNodeIds.push(nodeId);
    result.actorByNodeId[nodeId] = actor;
  }
  function addLink(id: string, sourceNodeId: string, targetNodeId: string, type: string): void {
    if (state.links && hasOwn(state.links, id)) throw new Error("orrery_runtime_id_collision");
    const link: GraphLink = { id, sourceNodeId, targetNodeId, relationType: type, label: type, direction: "forward", style: "dashed" };
    (state.links ??= {})[id] = link;
    result.runtimeLinkIds.push(id);
  }
  for (const relation of [...checked.relations].sort((a, b) => a.id.localeCompare(b.id))) {
    // Relationship provenance is explicit upstream evidence. No name/mail-count inference.
    const id = `orrery-relation:${encodeURIComponent(relation.id)}`;
    addLink(id, nodeByActor.get(relation.sourceActorId)!, nodeByActor.get(relation.targetActorId)!, relation.type);
    result.relationByLinkId[id] = relation;
  }
  for (const binding of bindings) {
    for (const roleId of new Set(binding.roleNodeIds ?? [])) {
      const id = `orrery-role:${encodeURIComponent(binding.actorId)}:${encodeURIComponent(roleId)}`;
      addLink(id, nodeByActor.get(binding.actorId)!, roleId, "assignment");
    }
  }
  return result;
}
