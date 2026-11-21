// Invariant check of the records a Command touched and the neighbourhood those rules read.
// The whole-map scan stays in `checkInvariants` for tests and for `record_store_cli --verify`.
// Database_Spec section 4: with several reparents in one Command, cycles are judged after all of them.

import { extensionValueErrors } from "./extensions";
import type { InvariantProblem } from "./invariants";
import { recordKeyString } from "./jsonl";
import type {
  ConnectionRecord,
  EdgeConnectionRecord,
  ExtensionDefRecord,
  ExtensionTarget,
  JsonObject,
  NodeRecord,
  ScopeRecord,
  SnapshotRecord,
} from "./types";
import { recordKeyParts } from "./types";

export interface NeighbourOp {
  op: "put" | "delete";
  rk: string;
  record?: SnapshotRecord;
}

export interface TouchCheck {
  problems: InvariantProblem[];
  /** `${kind}\u0000${key}` of every record this check evaluated. */
  checked: Set<string>;
}

type Bucket = Map<string, Set<string>>;
type Lookup = (rk: string) => SnapshotRecord | undefined;

function rkOf(record: SnapshotRecord): string {
  return `${record.kind}|${recordKeyString(record)}`;
}

function subjectOf(record: SnapshotRecord): string {
  return `${record.kind}\u0000${recordKeyParts(record).join("+")}`;
}

function isAlias(node: NodeRecord): boolean {
  return node.nodeType === "alias" || node.alias !== undefined;
}

function isEdge(record: SnapshotRecord | undefined): record is EdgeConnectionRecord {
  return record?.kind === "connection" && record.type === "edge";
}

/**
 * Reverse links for one map. Built once, then updated by each committed Command.
 * `apply` moves it to the post-state; the returned function puts it back.
 */
export class NeighbourhoodIndex {
  private readonly incoming: Bucket = new Map();
  private readonly outgoing: Bucket = new Map();
  private readonly byEndpoint: Bucket = new Map();
  private readonly edgesByScope: Bucket = new Map();
  private readonly aliasesByTarget: Bucket = new Map();
  private readonly scopesByRoot: Bucket = new Map();
  private readonly scopesBySurface: Bucket = new Map();
  private readonly detailsByNode: Bucket = new Map();
  private readonly surfacesByScope: Bucket = new Map();
  private readonly viewsByNode: Bucket = new Map();
  private readonly viewsBySurface: Bucket = new Map();
  private readonly annotationsByScope: Bucket = new Map();
  private readonly linearByScope: Bucket = new Map();
  private readonly linearByAnchor: Bucket = new Map();
  private readonly mapsByRoot: Bucket = new Map();
  private readonly carriers: Bucket = new Map();

  static fromRecords(records: Iterable<SnapshotRecord>): NeighbourhoodIndex {
    const index = new NeighbourhoodIndex();
    for (const record of records) index.add(record, []);
    return index;
  }

  /** Scope ids the node lies on. An incoming parent edge wins; a root with none lies on the scopes it roots. */
  scopeIdsOf(nodeId: string, lookup: Lookup): string[] {
    const incoming = this.incoming.get(nodeId);
    if (incoming && incoming.size > 0) {
      const ids = new Set<string>();
      for (const rk of incoming) {
        const edge = lookup(rk);
        if (isEdge(edge) && edge.scopeId !== undefined) ids.add(edge.scopeId);
      }
      return [...ids];
    }
    const ids: string[] = [];
    for (const rk of this.scopesByRoot.get(nodeId) ?? []) {
      const scope = lookup(rk);
      if (scope?.kind === "scope") ids.push(scope.id);
    }
    return ids;
  }

  apply(ops: readonly NeighbourOp[], before: Lookup): () => void {
    const undos: Array<() => void> = [];
    for (const op of ops) {
      const prior = before(op.rk);
      if (prior) this.remove(prior, undos);
      if (op.op === "put" && op.record) this.add(op.record, undos);
    }
    return () => {
      for (let i = undos.length - 1; i >= 0; i -= 1) undos[i]();
    };
  }

  /**
   * Problems introduced around `ops`, judged on the index after `apply`.
   * `lookup` reads the post-state. `before` reads the pre-image of an op.
   * `defs` is keyed by `name@version`.
   */
  check(lookup: Lookup, ops: readonly NeighbourOp[], before: Lookup, defs: ReadonlyMap<string, ExtensionDefRecord>): TouchCheck {
    const problems: InvariantProblem[] = [];
    const checked = new Set<string>();
    const seen = new Set<string>();
    const add = (rule: InvariantProblem["rule"], record: SnapshotRecord, message: string): void => {
      const key = `${rule}|${record.kind}|${recordKeyParts(record).join("+")}|${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      problems.push({ rule, kind: record.kind, key: recordKeyParts(record).join("+"), message });
    };
    const mark = (record: SnapshotRecord): void => {
      checked.add(subjectOf(record));
    };

    const nodes = new Set<string>();
    const connections = new Set<string>();
    const scopes = new Set<string>();
    const details = new Set<string>();
    const linear = new Set<string>();
    const surfaces = new Set<string>();
    const views = new Set<string>();
    const annotations = new Set<string>();
    const maps = new Set<string>();
    const parents = new Set<string>();
    const cycleStarts = new Set<string>();
    const edgeScope = new Set<string>();
    const carrierRks = new Set<string>();
    const touchedEdges = new Set<string>();

    const pull = (bucket: Bucket, key: string | undefined, into: Set<string>): void => {
      if (key === undefined) return;
      for (const rk of bucket.get(key) ?? []) into.add(rk);
    };

    const noteEdge = (edge: EdgeConnectionRecord, rk: string): void => {
      connections.add(rk);
      edgeScope.add(rk);
      parents.add(edge.source);
      cycleStarts.add(edge.target);
      nodes.add(edge.source);
      nodes.add(edge.target);
      carrierRks.add(rk);
      touchedEdges.add(rk);
      for (const child of this.outgoing.get(edge.target) ?? []) edgeScope.add(child);
    };

    for (const op of ops) {
      const prior = before(op.rk);
      const next = op.op === "put" ? op.record : undefined;
      for (const record of [prior, next]) {
        if (!record) continue;
        if (record.kind === "node") {
          nodes.add(record.id);
          carrierRks.add(rkOf(record));
          if (isAlias(record)) nodes.add(record.alias?.target ?? "");
        } else if (isEdge(record)) {
          noteEdge(record, op.rk);
        } else if (record.kind === "connection") {
          connections.add(op.rk);
          nodes.add(record.source);
          nodes.add(record.target);
          carrierRks.add(op.rk);
        } else if (record.kind === "scope") {
          scopes.add(op.rk);
          nodes.add(record.rootNodeId);
          if (prior?.kind === "scope" && next?.kind === "scope" && prior.rootNodeId !== next.rootNodeId) {
            for (const rk of this.edgesByScope.get(record.id) ?? []) edgeScope.add(rk);
          }
        } else if (record.kind === "details") {
          details.add(op.rk);
        } else if (record.kind === "linearText") {
          linear.add(op.rk);
        } else if (record.kind === "surface") {
          surfaces.add(op.rk);
        } else if (record.kind === "nodeView") {
          views.add(op.rk);
        } else if (record.kind === "annotation") {
          annotations.add(op.rk);
        } else if (record.kind === "map") {
          maps.add(op.rk);
          if (record.rootNodeId) nodes.add(record.rootNodeId);
        } else if (record.kind === "extensionDef") {
          const key = `${record.name}@${record.version}`;
          for (const rk of this.carriers.get(key) ?? []) carrierRks.add(rk);
        }
      }
      if (op.op === "delete" && prior) {
        if (prior.kind === "node") {
          pull(this.byEndpoint, prior.id, connections);
          pull(this.byEndpoint, prior.id, edgeScope);
          pull(this.aliasesByTarget, prior.id, carrierRks);
          for (const rk of this.aliasesByTarget.get(prior.id) ?? []) {
            const alias = lookup(rk);
            if (alias?.kind === "node") nodes.add(alias.id);
          }
          pull(this.scopesByRoot, prior.id, scopes);
          pull(this.detailsByNode, prior.id, details);
          pull(this.viewsByNode, prior.id, views);
          pull(this.linearByAnchor, prior.id, linear);
          pull(this.mapsByRoot, prior.id, maps);
        } else if (prior.kind === "connection") {
          pull(this.byEndpoint, prior.id, connections);
          if (isEdge(prior)) for (const child of this.outgoing.get(prior.target) ?? []) edgeScope.add(child);
        } else if (prior.kind === "scope") {
          for (const rk of this.edgesByScope.get(prior.id) ?? []) edgeScope.add(rk);
          pull(this.surfacesByScope, prior.id, surfaces);
          pull(this.linearByScope, prior.id, linear);
          pull(this.annotationsByScope, prior.id, annotations);
        } else if (prior.kind === "surface") {
          pull(this.viewsBySurface, prior.id, views);
          pull(this.scopesBySurface, prior.id, scopes);
        }
      }
    }

    const nodeRecord = (id: string): NodeRecord | undefined => {
      const record = lookup(`node|${id}`);
      return record?.kind === "node" ? record : undefined;
    };
    const scopeRecord = (id: string): ScopeRecord | undefined => {
      const record = lookup(`scope|${id}`);
      return record?.kind === "scope" ? record : undefined;
    };
    const mapOf = (record: SnapshotRecord): void => {
      if (!("mapId" in record) || typeof record.mapId !== "string") return;
      const map = lookup(`map|${record.mapId}`);
      if (!map || map.kind !== "map") add(0, record, `map ${record.mapId} does not exist`);
    };

    for (const id of nodes) {
      if (id === "") continue;
      const node = nodeRecord(id);
      if (!node) continue;
      mark(node);
      mapOf(node);
      const count = this.incoming.get(id)?.size ?? 0;
      const map = lookup(`map|${node.mapId}`);
      const root = map?.kind === "map" && map.rootNodeId === id;
      if (root) {
        if (count !== 0) add(1, node, `map root has ${count} incoming edge(s)`);
      } else if (count !== 1) {
        add(1, node, `node has ${count} incoming edges, expected exactly 1`);
      }
      if (isAlias(node)) {
        const target = node.alias?.target;
        if (node.alias?.broken === true) {
          // a broken alias is one whose target is known to be gone
        } else if (target === undefined) add(3, node, "alias has no target");
        else if (!nodeRecord(target)) add(3, node, `alias target ${target} does not exist`);
        else if (isAlias(nodeRecord(target)!)) add(3, node, `alias target ${target} is an alias`);
      }
    }

    for (const rk of maps) {
      const map = lookup(rk);
      if (map?.kind !== "map") continue;
      mark(map);
      const root = map.rootNodeId === undefined ? undefined : nodeRecord(map.rootNodeId);
      if (!root) add(1, map, `root node ${map.rootNodeId ?? "(none)"} does not exist`);
      else if (root.mapId !== map.id) add(1, map, `root node ${map.rootNodeId} belongs to another map`);
    }

    const reportedCycle = new Set<string>();
    for (const start of cycleStarts) {
      const cycle = this.cycleFrom(start, lookup);
      if (!cycle || !cycle.edges.some((rk) => touchedEdges.has(rk))) continue;
      const id = cycle.nodes[0];
      if (reportedCycle.has(id)) continue;
      reportedCycle.add(id);
      const node = nodeRecord(id);
      if (!node) continue;
      mark(node);
      add(2, node, `edge cycle: ${[...cycle.nodes, id].join(" -> ")}`);
    }

    for (const rk of connections) {
      const connection = lookup(rk);
      if (connection?.kind !== "connection") continue;
      mark(connection);
      mapOf(connection);
      this.checkEndpoints(connection, lookup, add);
      if (connection.type !== "edge") carrierRks.add(rk);
    }

    for (const rk of edgeScope) {
      const edge = lookup(rk);
      if (!isEdge(edge)) continue;
      mark(edge);
      mapOf(edge);
      this.checkEdgeScope(edge, lookup, scopeRecord, add);
    }

    for (const parentId of parents) {
      const seenOrd = new Map<string, string>();
      for (const rk of this.outgoing.get(parentId) ?? []) {
        const edge = lookup(rk);
        if (!isEdge(edge)) continue;
        mark(edge);
        const first = seenOrd.get(edge.ord);
        if (first !== undefined) add(9, edge, `duplicate ord ${JSON.stringify(edge.ord)} under parent ${edge.source}`);
        else seenOrd.set(edge.ord, rk);
      }
    }

    for (const rk of scopes) {
      const scope = lookup(rk);
      if (scope?.kind !== "scope") continue;
      mark(scope);
      mapOf(scope);
      const root = nodeRecord(scope.rootNodeId);
      if (!root) add(5, scope, `root node ${scope.rootNodeId ?? "(none)"} does not exist`);
      else if (isAlias(root)) add(5, scope, `root node ${scope.rootNodeId} is an alias`);
      if (scope.primarySurfaceId !== undefined && lookup(`surface|${scope.primarySurfaceId}`)?.kind !== "surface") {
        add(7, scope, `primary surface ${scope.primarySurfaceId} does not exist`);
      }
    }

    for (const rk of details) {
      const record = lookup(rk);
      if (record?.kind !== "details") continue;
      mark(record);
      mapOf(record);
      if (!nodeRecord(record.nodeId)) add(7, record, `node ${record.nodeId} does not exist`);
    }
    for (const rk of linear) {
      const record = lookup(rk);
      if (record?.kind !== "linearText") continue;
      mark(record);
      mapOf(record);
      if (record.scopeId !== undefined && !scopeRecord(record.scopeId)) add(7, record, `scope ${record.scopeId} does not exist`);
      if (record.scopeId === undefined && record.orphanKey === undefined) add(7, record, "neither scopeId nor orphanKey");
      if (record.anchorNodeId !== undefined && !nodeRecord(record.anchorNodeId)) add(7, record, `anchor node ${record.anchorNodeId} does not exist`);
    }
    for (const rk of surfaces) {
      const record = lookup(rk);
      if (record?.kind !== "surface") continue;
      mark(record);
      mapOf(record);
      if (!scopeRecord(record.scopeId)) add(7, record, `scope ${record.scopeId} does not exist`);
    }
    for (const rk of views) {
      const record = lookup(rk);
      if (record?.kind !== "nodeView") continue;
      mark(record);
      mapOf(record);
      if (lookup(`surface|${record.surfaceId}`)?.kind !== "surface") add(7, record, `surface ${record.surfaceId} does not exist`);
      if (!nodeRecord(record.nodeId)) add(7, record, `node ${record.nodeId} does not exist`);
    }
    for (const rk of annotations) {
      const record = lookup(rk);
      if (record?.kind !== "annotation") continue;
      mark(record);
      mapOf(record);
      if (record.scopeId !== undefined && !scopeRecord(record.scopeId)) add(7, record, `scope ${record.scopeId} does not exist`);
    }

    const nodeOf = (id: string): NodeRecord | undefined => nodeRecord(id);
    const checkCarrier = (record: SnapshotRecord, carrier: ExtensionTarget, extensions: unknown, attributes: JsonObject | undefined): void => {
      mark(record);
      for (const problem of extensionValueErrors(extensions, attributes, carrier, defs, nodeOf)) add(10, record, problem.message);
    };
    for (const rk of carrierRks) {
      const record = lookup(rk);
      if (record?.kind === "node") checkCarrier(record, "node", record.extensions, record.attributes);
      else if (record?.kind === "connection" && record.type === "edge") checkCarrier(record, "parentEdge", record.extensions, record.attributes);
      else if (record?.kind === "connection") checkCarrier(record, "relationEdge", record.extensions, record.attributes);
    }

    return { problems, checked };
  }

  private cycleFrom(start: string, lookup: Lookup): { nodes: string[]; edges: string[] } | undefined {
    const at = new Map<string, number>();
    const nodes: string[] = [];
    const edges: string[] = [];
    let current: string | undefined = start;
    while (current !== undefined && !at.has(current)) {
      at.set(current, nodes.length);
      nodes.push(current);
      const edge = this.parentEdge(current, lookup);
      if (!edge) return undefined;
      edges.push(rkOf(edge));
      current = edge.source;
      if (nodes.length > 100000) return undefined;
    }
    if (current === undefined) return undefined;
    const from = at.get(current);
    if (from === undefined) return undefined;
    return { nodes: nodes.slice(from), edges: edges.slice(from) };
  }

  private parentEdge(nodeId: string, lookup: Lookup): EdgeConnectionRecord | undefined {
    for (const rk of this.incoming.get(nodeId) ?? []) {
      const record = lookup(rk);
      if (isEdge(record)) return record;
    }
    return undefined;
  }

  private checkEndpoints(
    connection: ConnectionRecord,
    lookup: Lookup,
    add: (rule: InvariantProblem["rule"], record: SnapshotRecord, message: string) => void,
  ): void {
    for (const side of ["source", "target"] as const) {
      const id = connection[side];
      const node = lookup(`node|${id}`)?.kind === "node";
      const link = lookup(`connection|${id}`)?.kind === "connection";
      const exists = connection.type === "edge" ? node : node || (link && id !== connection.id);
      if (!exists) add(4, connection, `${side} ${id ?? "(none)"} does not exist`);
    }
  }

  private checkEdgeScope(
    edge: EdgeConnectionRecord,
    lookup: Lookup,
    scopeRecord: (id: string) => ScopeRecord | undefined,
    add: (rule: InvariantProblem["rule"], record: SnapshotRecord, message: string) => void,
  ): void {
    if (edge.scopeId === undefined) {
      add(5, edge, "edge has no scope");
      return;
    }
    const scope = scopeRecord(edge.scopeId);
    if (!scope) {
      add(5, edge, `scope ${edge.scopeId} does not exist`);
      return;
    }
    if (scope.mapId !== edge.mapId) add(5, edge, `scope ${edge.scopeId} belongs to another map`);
    if (scope.rootNodeId === edge.source) return;
    const parent = this.parentEdge(edge.source, lookup);
    if (parent === undefined || parent.scopeId !== edge.scopeId) {
      add(5, edge, `edge lies on scope ${edge.scopeId}, but its parent ${edge.source} is neither that scope's root nor on that scope`);
    }
  }

  private add(record: SnapshotRecord, undos: Array<() => void>): void {
    const rk = rkOf(record);
    for (const [bucket, key] of this.contributions(record)) this.bind(bucket, key, rk, undos);
  }

  private remove(record: SnapshotRecord, undos: Array<() => void>): void {
    const rk = rkOf(record);
    for (const [bucket, key] of this.contributions(record)) this.unbind(bucket, key, rk, undos);
  }

  private contributions(record: SnapshotRecord): Array<[Bucket, string]> {
    const out: Array<[Bucket, string]> = [];
    const put = (bucket: Bucket, key: string | undefined): void => {
      if (key) out.push([bucket, key]);
    };
    switch (record.kind) {
      case "node":
        put(this.aliasesByTarget, record.alias?.target);
        for (const entry of record.extensions ?? []) if (typeof entry === "string") put(this.carriers, entry);
        break;
      case "connection":
        put(this.byEndpoint, record.source);
        put(this.byEndpoint, record.target);
        if (record.type === "edge") {
          put(this.incoming, record.target);
          put(this.outgoing, record.source);
          put(this.edgesByScope, record.scopeId);
        }
        for (const entry of record.extensions ?? []) if (typeof entry === "string") put(this.carriers, entry);
        break;
      case "scope":
        put(this.scopesByRoot, record.rootNodeId);
        put(this.scopesBySurface, record.primarySurfaceId);
        break;
      case "details":
        put(this.detailsByNode, record.nodeId);
        break;
      case "surface":
        put(this.surfacesByScope, record.scopeId);
        break;
      case "nodeView":
        put(this.viewsByNode, record.nodeId);
        put(this.viewsBySurface, record.surfaceId);
        break;
      case "annotation":
        put(this.annotationsByScope, record.scopeId);
        break;
      case "linearText":
        put(this.linearByScope, record.scopeId);
        put(this.linearByAnchor, record.anchorNodeId);
        break;
      case "map":
        put(this.mapsByRoot, record.rootNodeId);
        break;
      default:
        break;
    }
    return out;
  }

  private bind(bucket: Bucket, key: string, rk: string, undos: Array<() => void>): void {
    let set = bucket.get(key);
    if (set?.has(rk)) return;
    if (!set) {
      set = new Set();
      bucket.set(key, set);
    }
    set.add(rk);
    const owned = set;
    undos.push(() => {
      owned.delete(rk);
      if (owned.size === 0) bucket.delete(key);
    });
  }

  private unbind(bucket: Bucket, key: string, rk: string, undos: Array<() => void>): void {
    const set = bucket.get(key);
    if (!set?.has(rk)) return;
    set.delete(rk);
    if (set.size === 0) bucket.delete(key);
    undos.push(() => {
      let next = bucket.get(key);
      if (!next) {
        next = new Set();
        bucket.set(key, next);
      }
      next.add(rk);
    });
  }
}

/** `${kind}\u0000${key}` of a stored problem key (`rule|kind|key|message`), or undefined when it does not split. */
export function subjectOfProblemKey(key: string): string | undefined {
  const ruleEnd = key.indexOf("|");
  if (ruleEnd < 0) return undefined;
  const kindEnd = key.indexOf("|", ruleEnd + 1);
  if (kindEnd < 0) return undefined;
  const keyEnd = key.indexOf("|", kindEnd + 1);
  if (keyEnd < 0) return undefined;
  return `${key.slice(ruleEnd + 1, kindEnd)}\u0000${key.slice(kindEnd + 1, keyEnd)}`;
}
