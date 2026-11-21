// Steady-state projection of ONE map: current `AppState` row -> records, used on every commit
// after the migration. Same record shapes and field rules as ./to_snapshot.ts (contract sections
// 3.2-3.4), with these differences:
//   - existing ids are never renumbered and no `idMap` / seeded record is produced;
//   - surface ids are the ids the state uses;
//   - an edge / scope that existed in the previous records keeps its id; a new one gets the
//     deterministic id of the contract (sha256 of workspace, map, record kind and child / root id);
//   - sibling order keys are kept wherever the previous keys are consistent with the new order;
//   - `rev` is copied from the previous record when the record is otherwise unchanged; a changed
//     or new record has `rev: undefined` for the caller to stamp. A surface counts as changed when
//     one of its node views changed (a node view has no `rev` and follows its surface).
// The reverse direction is ./from_snapshot.ts. `MapProjector.project` also returns the state that
// `fromSnapshot` gives for the projected records, reusing untouched parts of the input state.

import type { AppState } from "../types";
import { fromSnapshot } from "./from_snapshot";
import { sha256Hex, type HashFn } from "./hash";
import { recordKeyString, sortRecords } from "./jsonl";
import { initialKeys, isOrderKey, keysBetween } from "./order_key";
import { edgeScopeRootOf } from "../scope_plane";
import type { TreeNode } from "../types";
import { writtenExtensions } from "./extensions";
import { scopeFieldsOf } from "./scope_fields";
import { EDGE_LABEL_ATTRIBUTE } from "./to_snapshot";
import {
  compareStrings,
  recordKeyParts,
  type DetailsRecord,
  type EdgeConnectionRecord,
  type JsonObject,
  type NodeRecord,
  type ScopeRecord,
  type SnapshotRecord,
  type SnapshotRow,
} from "./types";

type Dict = Record<string, unknown>;

const SCOPE_PREFIX = "scope:";
const NODE_FIELDS = new Set([
  "id", "parentId", "children", "nodeType", "scopeId", "edgeOutsideScope", "text", "collapsed", "details", "note",
  "attributes", "link", "targetNodeId", "aliasLabel", "access", "targetSnapshotLabel", "isBroken", "aliasOf",
  "extensions", "edgeRelationType", "edgeAttributes", "edgeExtensions", "valid", "copyOf",
]);
const LINK_FIELDS = new Set([
  "id", "sourceNodeId", "targetNodeId", "relationType", "label", "direction", "style", "color",
  "sourcePort", "targetPort", "attributes", "extensions",
]);
const ANNOTATION_COPIED_FIELDS = [
  "d", "points", "stroke", "strokeWidth", "opacity", "createdAt", "x", "y", "text", "fill",
  "fontSize", "fontWeight", "variant",
] as const;
const ANNOTATION_FIELDS = new Set<string>(["id", "kind", "scopeId", ...ANNOTATION_COPIED_FIELDS]);
const STATE_FIELDS = new Set([
  "rootId", "nodes", "links", "annotations", "scopes", "surfaces", "linearNotesByScope",
  "linearTextFontScale", "linearPanelWidth", "extensionDefs", "locks", "grants", "namedSnapshots",
]);
const STATE_DROPPED_FIELDS = new Set(["selectedId", "scopeId", "savedAt"]);
const NODE_VIEW_FIELDS = ["x", "y", "flowCol", "flowRow", "shape"] as const;
const NO_CHILDREN: readonly string[] = [];

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function present(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function dictOf(value: unknown): Dict {
  return isDict(value) ? value : {};
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** Keys in string order; does not sort again when they already are. */
function sortedKeys(value: Dict): string[] {
  const keys = Object.keys(value);
  for (let i = 1; i < keys.length; i += 1) {
    if (compareStrings(keys[i - 1], keys[i]) > 0) return keys.sort(compareStrings);
  }
  return keys;
}

function sortedEntries(value: unknown): Array<[string, Dict]> {
  const source = dictOf(value);
  const out: Array<[string, Dict]> = [];
  for (const key of sortedKeys(source)) {
    const item = source[key];
    if (isDict(item)) out.push([key, item]);
  }
  return out;
}

function copyPresent(target: Dict, source: Dict, fields: readonly string[]): void {
  for (const field of fields) {
    if (present(source[field])) target[field] = source[field];
  }
}

function collectExtra(source: Dict, known: Set<string>, dropped?: Set<string>): JsonObject | undefined {
  let extra: Dict | undefined;
  for (const key of Object.keys(source)) {
    if (known.has(key) || dropped?.has(key) || !present(source[key])) continue;
    (extra ??= {})[key] = source[key];
  }
  return extra as JsonObject | undefined;
}

function cleanAttributes(value: unknown, skipKey?: string): JsonObject | undefined {
  if (!isDict(value)) return undefined;
  let out: Dict | undefined;
  for (const key of Object.keys(value)) {
    if (key === skipKey || !present(value[key])) continue;
    (out ??= {})[key] = value[key];
  }
  return out as JsonObject | undefined;
}

/** Deep equality that ignores key order. */
export function sameJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (!sameJson(left[i], right[i])) return false;
    }
    return true;
  }
  if (!isDict(left) || !isDict(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    if (!hasOwn(right, key) || !sameJson(left[key], right[key])) return false;
  }
  return true;
}

/** Two records with the same content, `rev` aside. */
function sameRecordContent(left: SnapshotRecord, right: SnapshotRecord): boolean {
  const a = left as unknown as Dict;
  const b = right as unknown as Dict;
  let count = 0;
  for (const key of Object.keys(a)) {
    if (key === "rev") continue;
    count += 1;
    if (!hasOwn(b, key) || !sameJson(a[key], b[key])) return false;
  }
  for (const key of Object.keys(b)) {
    if (key !== "rev") count -= 1;
  }
  return count === 0;
}

const RK_CACHE = new WeakMap<object, string>();

/** `<kind>|<key string>`: the key a record has in the store and in Neo4j. */
export function recordRk(record: SnapshotRecord): string {
  let rk = RK_CACHE.get(record);
  if (rk === undefined) {
    rk = `${record.kind}|${recordKeyString(record)}`;
    RK_CACHE.set(record, rk);
  }
  return rk;
}

/** Deterministic id of the contract (section 3.1). */
export function generatedId(
  hash: HashFn, workspaceId: string, prefix: string, mapId: string, recordKind: string, seed: string,
): string {
  return prefix + hash(`${workspaceId}|${mapId}|${recordKind}|${seed}`).slice(0, 24);
}

function fillBetween(out: string[], lo: number, hi: number, a: string | undefined, b: string | undefined): void {
  if (lo > hi) return;
  const keys = keysBetween(a, b, hi - lo + 1);
  for (let i = 0; i < keys.length; i += 1) out[lo + i] = keys[i];
}

/**
 * Order keys for siblings in their new order. `previous[i]` is the key the i-th sibling had, if any.
 * The keys kept are a longest strictly increasing subsequence of the previous keys; every other
 * sibling gets a key between its kept neighbours. With nothing to keep, the keys are `initialKeys`.
 */
export function assignOrderKeys(previous: Array<string | undefined>): string[] {
  const n = previous.length;
  let valid = 0;
  let increasing = true;
  let last: string | undefined;
  for (let i = 0; i < n; i += 1) {
    const key = previous[i];
    if (key === undefined || !isOrderKey(key)) {
      increasing = false;
      continue;
    }
    valid += 1;
    if (last !== undefined && !(last < key)) increasing = false;
    last = key;
  }
  if (valid === 0) return initialKeys(n);
  if (increasing && valid === n) return previous as string[];

  // Longest strictly increasing subsequence (patience sorting with predecessor links).
  const tails: number[] = [];
  const before = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i += 1) {
    const key = previous[i];
    if (key === undefined || !isOrderKey(key)) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((previous[tails[mid]] as string) < key) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) before[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const kept = new Array<boolean>(n).fill(false);
  for (let i = tails[tails.length - 1]; i >= 0; i = before[i]) kept[i] = true;

  const out = new Array<string>(n);
  let lower: string | undefined;
  let runStart = 0;
  for (let i = 0; i <= n; i += 1) {
    if (i < n && !kept[i]) continue;
    const upper = i < n ? (previous[i] as string) : undefined;
    fillBetween(out, runStart, i - 1, lower, upper);
    if (i < n) out[i] = upper as string;
    lower = upper;
    runStart = i + 1;
  }
  return out;
}

interface NodeMemo {
  id: string;
  gen: number;
  node: NodeRecord;
  details: DetailsRecord | undefined;
  /** Value of `m3e:edge-label` that becomes the label of the incoming edge; undefined when none. */
  label: unknown;
  /** The state node already has the shape the reverse conversion gives it (children and nodeType aside). */
  selfNormal: boolean;
}

interface ParentMemo {
  gen: number;
  parentId: string;
  /** Scopes the edges could lie on when the memo was made; a change re-emits them. */
  scopeSig: string;
  members: NodeMemo[];
  childIds: string[];
}

interface SurfaceMemo {
  gen: number;
  context: string;
  records: SnapshotRecord[];
}

export interface ProjectionResult {
  /**
   * Records of the map keyed by `recordRk`. An unchanged record is the very object of `previous`;
   * a changed or new one has `rev: undefined`.
   */
  records: Map<string, SnapshotRecord>;
  /** What differs from `previous`: the record to put, or null for a key that is gone. */
  delta: Map<string, SnapshotRecord | null>;
  /** For every key of `delta` that `previous` had: the record it had. */
  replaced: Map<string, SnapshotRecord>;
  /**
   * Only for a projection made in place: puts the records of `previous` back as they were.
   * The projector then starts afresh on its next call.
   */
  revert?: () => void;
  /** The state `fromSnapshot` gives for `records`. Shares untouched parts with the input state. */
  state: AppState;
}

/** Same record slot: same kind and key, and for connections the same type (and child, for an edge). */
function sameIdentity(left: SnapshotRecord, right: SnapshotRecord): boolean {
  if (left.kind !== right.kind) return false;
  const a = recordKeyParts(left);
  const b = recordKeyParts(right);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  if (left.kind === "connection" && right.kind === "connection") {
    if (left.type !== right.type) return false;
    if (left.type === "edge" && left.target !== right.target) return false;
  }
  return true;
}

/** Same fields with the same values (by identity), `children` aside. */
function shallowSameNode(left: Dict, right: Dict): boolean {
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    if (key === "children") {
      if (!hasOwn(right, key)) return false;
      continue;
    }
    if (left[key] !== right[key] || !hasOwn(right, key)) return false;
  }
  return true;
}

/**
 * Projects one map. An instance remembers its last result: when `previous` of the next call is
 * that result's `records`, nodes, sibling lists and surfaces whose state objects are unchanged
 * are not projected again. The result never depends on that memory.
 * State objects handed in and returned must not be mutated afterwards.
 */
export class MapProjector {
  private nodeMemo = new WeakMap<object, NodeMemo>();
  private parentMemo = new WeakMap<object, ParentMemo>();
  private surfaceMemo = new WeakMap<object, SurfaceMemo>();
  private gen = 0;
  private lastRecords: ReadonlyMap<string, SnapshotRecord> | undefined;
  // What the last result (or, on a fresh start, `previous`) holds, by the slot the projection gives it.
  private edgeByTarget = new Map<string, EdgeConnectionRecord>();
  private scopeByRoot = new Map<string, ScopeRecord>();
  private surfaceRecords = new Map<string, SnapshotRecord[]>();
  private smallRecords: SnapshotRecord[] = [];
  private lastNodeIds: string[] = [];
  private lastStateNodes: Dict = {};
  private nodeSetToken = 0;
  private lastRestInput: SnapshotRecord[] = [];
  private lastRest: Dict | undefined;

  constructor(private readonly workspaceId: string, private readonly hash: HashFn = sha256Hex) {}

  /**
   * With `inPlace`, `previous` itself is changed into the result (no copy of the whole table);
   * `revert` of the result undoes that. Without it, `previous` is left as it is.
   */
  project(
    row: SnapshotRow,
    previous: ReadonlyMap<string, SnapshotRecord>,
    options: { inPlace?: boolean } = {},
  ): ProjectionResult {
    if (options.inPlace !== true) return this.run(row, previous, new Map(previous), undefined);
    const out = previous as Map<string, SnapshotRecord>;
    const original = new Map<string, SnapshotRecord | undefined>();
    const revert = (): void => {
      for (const [rk, record] of original) {
        if (record === undefined) out.delete(rk);
        else out.set(rk, record);
      }
      original.clear();
      this.lastRecords = undefined;
    };
    try {
      const result = this.run(row, previous, out, original);
      result.revert = revert;
      return result;
    } catch (error) {
      revert();
      throw error;
    }
  }

  /** `original`, when given, logs the first value of every key of `out` that changes (`out` is then `previous`). */
  private run(
    row: SnapshotRow,
    previous: ReadonlyMap<string, SnapshotRecord>,
    out: Map<string, SnapshotRecord>,
    original: Map<string, SnapshotRecord | undefined> | undefined,
  ): ProjectionResult {
    const mapId = row.id;
    const state = dictOf(row.state);
    const warm = previous === this.lastRecords;
    this.lastRecords = undefined; // stays unset when this call throws
    /** Keys of `previous` that no slot below accounts for; removed unless produced again. */
    const stray: string[] = [];
    if (!warm) {
      this.nodeMemo = new WeakMap();
      this.parentMemo = new WeakMap();
      this.surfaceMemo = new WeakMap();
      this.edgeByTarget = new Map();
      this.scopeByRoot = new Map();
      this.surfaceRecords = new Map();
      this.smallRecords = [];
      this.lastNodeIds = [];
      this.lastStateNodes = {};
      this.nodeSetToken += 1;
      this.lastRest = undefined;
      for (const [rk, record] of previous) {
        switch (record.kind) {
          case "node":
            this.lastNodeIds.push(record.id);
            break;
          case "details":
            stray.push(rk); // re-produced for every node that still has details
            break;
          case "connection":
            if (record.type !== "edge") this.smallRecords.push(record);
            else if (this.edgeByTarget.has(record.target)) stray.push(rk);
            else this.edgeByTarget.set(record.target, record);
            break;
          case "scope":
            // An observe projection shares its root with the scope that holds the entity. It must not take that scope's id.
            if (record.projection?.mode !== "observe" && !this.scopeByRoot.has(record.rootNodeId)) this.scopeByRoot.set(record.rootNodeId, record);
            this.smallRecords.push(record);
            break;
          case "surface": {
            const list = this.surfaceRecords.get(record.id);
            if (list) list.unshift(record);
            else this.surfaceRecords.set(record.id, [record]);
            break;
          }
          case "nodeView": {
            const list = this.surfaceRecords.get(record.surfaceId);
            if (list) list.push(record);
            else this.surfaceRecords.set(record.surfaceId, [record]);
            break;
          }
          case "linearText":
          case "annotation":
          case "map":
            this.smallRecords.push(record);
            break;
          default:
            break; // not a record of the projection; left alone
        }
      }
      this.lastNodeIds.sort(compareStrings);
    }
    const previousGen = this.gen;
    const gen = previousGen + 1;

    const delta = new Map<string, SnapshotRecord | null>();
    /** The record `previous` had under a key, also after `out` (which may be `previous`) changed. */
    const prior = original === undefined
      ? (rk: string): SnapshotRecord | undefined => previous.get(rk)
      : (rk: string): SnapshotRecord | undefined => (original.has(rk) ? original.get(rk) : out.get(rk));
    const setOut = (rk: string, record: SnapshotRecord): void => {
      if (original !== undefined && !original.has(rk)) original.set(rk, out.get(rk));
      out.set(rk, record);
    };
    const produced = new Set<string>();
    const collision = (rk: string): Error => new Error(`Two records of map ${mapId} share the key ${JSON.stringify(rk)}.`);
    /** Adds a freshly built record; the previous object is used instead when the content is the same. */
    const put = <T extends SnapshotRecord>(record: T): T => {
      const rk = recordRk(record);
      if (produced.has(rk)) throw collision(rk);
      const existing = out.get(rk);
      if (existing !== undefined && !sameIdentity(existing, record)) throw collision(rk);
      produced.add(rk);
      const before = prior(rk);
      if (before !== undefined && sameRecordContent(before, record)) {
        if (existing !== before) setOut(rk, before);
        delta.delete(rk);
        return before as T;
      }
      setOut(rk, record);
      delta.set(rk, record);
      return record;
    };
    const remove = (rk: string): void => {
      if (!out.has(rk)) return;
      const before = prior(rk);
      if (original !== undefined && !original.has(rk)) original.set(rk, out.get(rk));
      out.delete(rk);
      if (before !== undefined) delta.set(rk, null);
      else delta.delete(rk);
    };
    const removeUnlessProduced = (records: readonly SnapshotRecord[]): void => {
      for (const record of records) {
        const rk = recordRk(record);
        if (!produced.has(rk)) remove(rk);
      }
    };
    const makeId = (prefix: string, recordKind: string, seed: string): string =>
      generatedId(this.hash, this.workspaceId, prefix, mapId, recordKind, seed);

    const rootId = typeof state.rootId === "string" ? state.rootId : undefined;
    const sourceNodes = dictOf(state.nodes);
    const nodeKeys = sortedKeys(sourceNodes);
    const nodeIds: string[] = [];
    const nodes: Dict[] = [];
    const memos: NodeMemo[] = [];
    const childrenByParent = new Map<string, number[]>();
    const scopeRoots: string[] = [];
    let edgeCount = 0;

    // --- node, details ---
    for (const id of nodeKeys) {
      const node = sourceNodes[id];
      if (!isDict(node)) continue;
      const index = nodeIds.length;
      let memo = warm ? this.nodeMemo.get(node) : undefined;
      if (memo === undefined && warm) {
        // A copy of the node the last state had (same fields, same values).
        const before = this.lastStateNodes[id];
        const beforeMemo = isDict(before) ? this.nodeMemo.get(before) : undefined;
        if (beforeMemo !== undefined && beforeMemo.gen === previousGen && beforeMemo.id === id && shallowSameNode(node, before as Dict)) {
          memo = beforeMemo;
          this.nodeMemo.set(node, memo);
        }
      }
      if (memo !== undefined && (memo.gen === previousGen || memo.gen === gen) && memo.id === id) {
        memo.gen = gen;
      } else {
        const record: Dict = { kind: "node", id, mapId };
        const nodeType = node.nodeType;
        if (present(nodeType) && nodeType !== "folder" && nodeType !== "leaf" && nodeType !== "text") {
          record.nodeType = nodeType;
        }
        record.text = present(node.text) ? node.text : "";
        if (node.collapsed === true) record.collapsed = true;
        const attributes = cleanAttributes(node.attributes, EDGE_LABEL_ATTRIBUTE);
        if (attributes) record.attributes = attributes;
        let label: unknown;
        if (isDict(node.attributes) && present(node.attributes[EDGE_LABEL_ATTRIBUTE]) && node.attributes[EDGE_LABEL_ATTRIBUTE] !== "") {
          label = node.attributes[EDGE_LABEL_ATTRIBUTE];
        }
        const alias: Dict = {};
        if (typeof node.targetNodeId === "string") alias.target = node.targetNodeId;
        if (present(node.aliasLabel)) alias.label = node.aliasLabel;
        if (present(node.access)) alias.access = node.access;
        if (present(node.targetSnapshotLabel)) alias.snapshotLabel = node.targetSnapshotLabel;
        if (node.isBroken === true) alias.broken = true;
        if (Object.keys(alias).length > 0) record.alias = alias;
        const extensions = writtenExtensions(node.extensions);
        if (extensions) record.extensions = extensions;
        if (isDict(node.valid)) {
          const valid: Dict = {};
          if (typeof node.valid.from === "string" && node.valid.from !== "") valid.from = node.valid.from;
          if (typeof node.valid.to === "string" && node.valid.to !== "") valid.to = node.valid.to;
          if (Object.keys(valid).length > 0) record.valid = valid;
        }
        if (isDict(node.copyOf) && typeof node.copyOf.source === "string" && typeof node.copyOf.mode === "string" && typeof node.copyOf.seq === "number") {
          const copyOf: Dict = { source: node.copyOf.source, seq: node.copyOf.seq, mode: node.copyOf.mode };
          if (typeof node.copyOf.mapId === "string") copyOf.mapId = node.copyOf.mapId;
          copyOf.ids = isDict(node.copyOf.ids) ? node.copyOf.ids : {};
          record.copyOf = copyOf;
        }
        const extra = collectExtra(node, NODE_FIELDS);
        if (extra) record.extra = extra;
        record.rev = undefined;
        const nodeRecord = put(record as unknown as NodeRecord);

        const details: Dict = { kind: "details", nodeId: id, mapId, v: 1 };
        if (present(node.details) && node.details !== "") details.body = node.details;
        if (present(node.note) && node.note !== "") details.note = node.note;
        if (present(node.link) && node.link !== "") details.link = node.link;
        let detailsRecord: DetailsRecord | undefined;
        if ("body" in details || "note" in details || "link" in details) {
          details.rev = undefined;
          detailsRecord = put(details as unknown as DetailsRecord);
        } else {
          remove(`details|${id}`);
        }
        memo = { id, gen, node: nodeRecord, details: detailsRecord, label, selfNormal: false };
        this.nodeMemo.set(node, memo);
      }
      nodeIds.push(id);
      nodes.push(node);
      memos.push(memo);
      if (typeof node.parentId === "string") {
        edgeCount += 1;
        const siblings = childrenByParent.get(node.parentId);
        if (siblings) siblings.push(index);
        else childrenByParent.set(node.parentId, [index]);
      }
      if (id === rootId || node.nodeType === "folder") scopeRoots.push(id);
    }

    // Nodes the last record set had and this state does not.
    const lastIds = this.lastNodeIds;
    let sameNodeSet = nodeIds.length === lastIds.length;
    for (let i = 0; sameNodeSet && i < nodeIds.length; i += 1) {
      if (nodeIds[i] !== lastIds[i]) sameNodeSet = false;
    }
    if (!sameNodeSet) {
      this.nodeSetToken += 1;
      let j = 0;
      for (const id of lastIds) {
        while (j < nodeIds.length && compareStrings(nodeIds[j], id) < 0) j += 1;
        if (j < nodeIds.length && nodeIds[j] === id) continue;
        remove(`node|${id}`);
        remove(`details|${id}`);
      }
    }

    // --- scope ids ---
    const scopeIdByRoot = new Map<string, string>();
    for (const root of scopeRoots) {
      const before = this.scopeByRoot.get(root);
      scopeIdByRoot.set(root, before !== undefined ? before.id : makeId("s_", "scope", root));
    }
    // The scope each edge lies on (DA59), by the rule of shared/scope_plane.ts. The default for
    // a parent is its own scope when it is a scope root, else the scope it lies on; a child of a
    // scope root may stay outside it with `edgeOutsideScope`.
    const planeNodes = sourceNodes as unknown as Record<string, TreeNode>;
    const planeRootId = rootId ?? "";
    const defaultEdgeScope = (parentId: string): string | undefined => {
      const root = scopeIdByRoot.has(parentId) ? parentId : edgeScopeRootOf(planeNodes, planeRootId, parentId);
      return scopeIdByRoot.get(root);
    };
    const childEdgeScope = (parentId: string, child: Dict, fallback: string | undefined): string | undefined =>
      child.edgeOutsideScope === true && scopeIdByRoot.has(parentId) && parentId !== rootId
        ? scopeIdByRoot.get(edgeScopeRootOf(planeNodes, planeRootId, parentId)) ?? fallback
        : fallback;

    const edgeScopeIdByParent = new Map<string, string | undefined>();
    const scopeSigByParent = new Map<string, string>();
    // --- connection: edge ---
    const orderedChildren = new Map<string, string[]>();
    for (const [parentId, members] of childrenByParent) {
      // `members` are indexes into nodeIds, in id order.
      const parentNode = sourceNodes[parentId];
      const edgeScopeId = defaultEdgeScope(parentId);
      edgeScopeIdByParent.set(parentId, edgeScopeId);
      // Both scopes an edge out of this parent can lie on: its own (default) and, for a scope
      // root, the one outside it. A change of either re-emits the edges.
      const scopeSig = scopeIdByRoot.has(parentId) && parentId !== rootId
        ? `${edgeScopeId ?? ""}|${scopeIdByRoot.get(edgeScopeRootOf(planeNodes, planeRootId, parentId)) ?? ""}`
        : edgeScopeId ?? "";
      scopeSigByParent.set(parentId, scopeSig);
      let parentMemo = warm && isDict(parentNode) ? this.parentMemo.get(parentNode) : undefined;
      if (parentMemo === undefined && warm && isDict(parentNode)) {
        // A copy of the parent the last state had, with the very same list of children.
        const before = this.lastStateNodes[parentId];
        if (isDict(before) && before.children === parentNode.children) {
          parentMemo = this.parentMemo.get(before);
          if (parentMemo !== undefined) this.parentMemo.set(parentNode, parentMemo);
        }
      }
      if (parentMemo !== undefined && (parentMemo.gen === previousGen || parentMemo.gen === gen) && parentMemo.parentId === parentId && parentMemo.scopeSig === scopeSig && parentMemo.members.length === members.length) {
        let same = true;
        for (let i = 0; same && i < members.length; i += 1) {
          if (memos[members[i]] !== parentMemo.members[i]) same = false;
        }
        if (same) {
          parentMemo.gen = gen;
          orderedChildren.set(parentId, parentMemo.childIds);
          continue;
        }
      }
      let ordered: number[];
      const listed = isDict(parentNode) ? parentNode.children : undefined;
      if (Array.isArray(listed) && listed.length > 0) {
        const indexById = new Map<string, number>();
        for (const index of members) indexById.set(nodeIds[index], index);
        ordered = [];
        for (const childId of listed) {
          if (typeof childId !== "string") continue;
          const index = indexById.get(childId);
          if (index === undefined) continue;
          indexById.delete(childId);
          ordered.push(index);
        }
        if (ordered.length < members.length) {
          for (const index of members) {
            if (indexById.has(nodeIds[index])) ordered.push(index);
          }
        }
      } else {
        ordered = members;
      }
      const keys = assignOrderKeys(ordered.map((index) => this.edgeByTarget.get(nodeIds[index])?.ord));
      const childIds: string[] = new Array(ordered.length);
      for (let i = 0; i < ordered.length; i += 1) {
        const childId = nodeIds[ordered[i]];
        childIds[i] = childId;
        const before = this.edgeByTarget.get(childId);
        const record: Dict = {
          kind: "connection",
          id: before !== undefined ? before.id : makeId("c_", "edge", childId),
          mapId,
          type: "edge",
          source: parentId,
          target: childId,
        };
        const label = memos[ordered[i]].label;
        if (label !== undefined) record.label = label;
        const child = nodes[ordered[i]];
        if (typeof child.edgeRelationType === "string" && child.edgeRelationType !== "") record.relationType = child.edgeRelationType;
        const edgeAttributes = cleanAttributes(child.edgeAttributes);
        if (edgeAttributes) record.attributes = edgeAttributes;
        const edgeExtensions = writtenExtensions(child.edgeExtensions);
        if (edgeExtensions) record.extensions = edgeExtensions;
        record.ord = keys[i];
        const scopeId = childEdgeScope(parentId, nodes[ordered[i]], edgeScopeId);
        if (scopeId !== undefined) record.scopeId = scopeId;
        record.rev = undefined;
        this.edgeByTarget.set(childId, put(record as unknown as EdgeConnectionRecord));
      }
      orderedChildren.set(parentId, childIds);
      if (isDict(parentNode)) {
        this.parentMemo.set(parentNode, { gen, parentId, scopeSig, members: members.map((index) => memos[index]), childIds });
      }
    }
    if (this.edgeByTarget.size !== edgeCount) {
      // Edges of nodes that are gone or no longer have a parent.
      for (const [target, edge] of this.edgeByTarget) {
        const node = sourceNodes[target];
        if (isDict(node) && typeof node.parentId === "string") continue;
        this.edgeByTarget.delete(target);
        const rk = recordRk(edge);
        if (!produced.has(rk)) remove(rk);
      }
    }

    // --- connection: graphlink ---
    const small: SnapshotRecord[] = [];
    const linkRecords: SnapshotRecord[] = [];
    for (const [id, link] of sortedEntries(state.links)) {
      const record: Dict = { kind: "connection", id, mapId, type: "graphlink" };
      if (present(link.sourceNodeId)) record.source = link.sourceNodeId;
      if (present(link.targetNodeId)) record.target = link.targetNodeId;
      copyPresent(record, link, ["relationType", "label"]);
      const attributes = cleanAttributes(link.attributes);
      if (attributes) record.attributes = attributes;
      copyPresent(record, link, ["direction", "style", "color"]);
      if (present(link.sourcePort) && link.sourcePort !== "auto") record.sourcePort = link.sourcePort;
      if (present(link.targetPort) && link.targetPort !== "auto") record.targetPort = link.targetPort;
      const linkExtensions = writtenExtensions(link.extensions);
      if (linkExtensions) record.extensions = linkExtensions;
      const extra = collectExtra(link, LINK_FIELDS);
      if (extra) record.extra = extra;
      record.rev = undefined;
      linkRecords.push(put(record as unknown as SnapshotRecord));
    }

    const scopeRootOf = (ref: unknown): string | undefined => {
      if (typeof ref !== "string") return undefined;
      if (scopeIdByRoot.has(ref)) return ref;
      if (ref.startsWith(SCOPE_PREFIX) && scopeIdByRoot.has(ref.slice(SCOPE_PREFIX.length))) {
        return ref.slice(SCOPE_PREFIX.length);
      }
      return undefined;
    };

    // --- surface, nodeView ---
    const surfaceIds = new Set<string>();
    const surfaceList: SnapshotRecord[] = [];
    const nextSurfaceRecords = new Map<string, SnapshotRecord[]>();
    for (const [id, surface] of sortedEntries(state.surfaces)) {
      const root = scopeRootOf(surface.scopeId);
      if (root === undefined) continue; // its scope does not exist, so the surface and its node views are not stored
      const scopeId = scopeIdByRoot.get(root)!;
      surfaceIds.add(id);
      const context = `${this.nodeSetToken}|${scopeId}|${id}`;
      const memo = warm ? this.surfaceMemo.get(surface) : undefined;
      if (memo !== undefined && memo.gen === previousGen && memo.context === context) {
        memo.gen = gen;
        nextSurfaceRecords.set(id, memo.records);
        for (const record of memo.records) surfaceList.push(record);
        continue;
      }
      const before = this.surfaceRecords.get(id) ?? [];
      const views: SnapshotRecord[] = [];
      let viewsUnchanged = true;
      for (const [nodeId, view] of sortedEntries(surface.nodeViews)) {
        if (!isDict(sourceNodes[nodeId])) continue;
        const viewRecord: Dict = { kind: "nodeView", surfaceId: id, nodeId, mapId };
        copyPresent(viewRecord, view, NODE_VIEW_FIELDS);
        if (!NODE_VIEW_FIELDS.some((field) => field in viewRecord)) continue;
        const stored = put(viewRecord as unknown as SnapshotRecord);
        if (stored === (viewRecord as unknown)) viewsUnchanged = false;
        views.push(stored);
      }
      let beforeViews = 0;
      for (const record of before) if (record.kind === "nodeView") beforeViews += 1;
      if (views.length !== beforeViews) viewsUnchanged = false;
      const record: Dict = { kind: "surface", id, mapId, scopeId };
      if (present(surface.kind)) record.surfaceKind = surface.kind;
      copyPresent(record, surface, ["layout", "surfaceView"]);
      record.rev = undefined;
      let surfaceRecord = put(record as unknown as SnapshotRecord);
      if (!viewsUnchanged && surfaceRecord !== (record as unknown)) {
        // Unchanged itself, but a node view changed: the surface carries the `rev` for its node views.
        surfaceRecord = record as unknown as SnapshotRecord;
        setOut(recordRk(surfaceRecord), surfaceRecord);
        delta.set(recordRk(surfaceRecord), surfaceRecord);
      }
      const records = [surfaceRecord, ...views];
      removeUnlessProduced(before);
      this.surfaceMemo.set(surface, { gen, context, records });
      nextSurfaceRecords.set(id, records);
      for (const stored of records) surfaceList.push(stored);
    }
    for (const [id, records] of this.surfaceRecords) {
      if (!nextSurfaceRecords.has(id)) removeUnlessProduced(records);
    }

    // --- scope ---
    const rest: SnapshotRecord[] = [];
    const currentScopes = dictOf(state.scopes);
    const nextScopeByRoot = new Map<string, ScopeRecord>();
    for (const root of scopeRoots) {
      const record: Dict = { kind: "scope", id: scopeIdByRoot.get(root)!, mapId, rootNodeId: root };
      const current = currentScopes[SCOPE_PREFIX + root];
      if (isDict(current) && typeof current.primarySurfaceId === "string" && surfaceIds.has(current.primarySurfaceId)) {
        record.primarySurfaceId = current.primarySurfaceId;
      }
      if (isDict(current)) copyScopeFields(record, current);
      record.rev = undefined;
      const stored = put(record as unknown as ScopeRecord);
      nextScopeByRoot.set(root, stored);
      small.push(stored);
    }
    // Observe projections are not folder roots. Their state key is `scope:<record id>`, so several scopes can share a node.
    const emittedScopeIds = new Set(scopeIdByRoot.values());
    for (const key of sortedKeys(currentScopes)) {
      const current = currentScopes[key];
      if (!isDict(current)) continue;
      const fields = scopeFieldsOf(current);
      if (fields.projection?.mode !== "observe") continue;
      const range = fields.projection.range;
      const root = "root" in range ? range.root : undefined;
      if (typeof root !== "string" || !isDict(sourceNodes[root])) continue;
      const suffix = key.startsWith(SCOPE_PREFIX) ? key.slice(SCOPE_PREFIX.length) : "";
      let id = suffix;
      if (!id || id === root || emittedScopeIds.has(id)) id = makeId("s_", "scope", `observe:${key}`);
      const record: Dict = { kind: "scope", id, mapId, rootNodeId: root };
      copyScopeFields(record, current);
      record.rev = undefined;
      const stored = put(record as unknown as ScopeRecord);
      emittedScopeIds.add(id);
      small.push(stored);
    }
    for (const record of linkRecords) small.push(record);

    // --- linearText ---
    const notes = dictOf(state.linearNotesByScope);
    const scopesWithText = new Set<string>();
    for (const key of sortedKeys(notes)) {
      const text = notes[key];
      if (!present(text) || text === "") continue;
      const record: Dict = { kind: "linearText" };
      const root = scopeRootOf(key);
      if (root !== undefined && !scopesWithText.has(root)) {
        scopesWithText.add(root);
        record.scopeId = scopeIdByRoot.get(root)!;
        record.mapId = mapId;
      } else {
        record.mapId = mapId;
        record.orphanKey = key;
      }
      record.text = text;
      if (root === undefined) {
        const stripped = key.startsWith(SCOPE_PREFIX) ? key.slice(SCOPE_PREFIX.length) : key;
        const anchor = isDict(sourceNodes[key]) ? key : isDict(sourceNodes[stripped]) ? stripped : undefined;
        if (anchor !== undefined) record.anchorNodeId = anchor;
      }
      record.rev = undefined;
      small.push(put(record as unknown as SnapshotRecord));
    }

    // --- annotation ---
    for (const [id, annotation] of sortedEntries(state.annotations)) {
      const record: Dict = { kind: "annotation", id, mapId };
      const extra: Dict = collectExtra(annotation, ANNOTATION_FIELDS) ?? {};
      if (present(annotation.scopeId)) {
        const root = scopeRootOf(annotation.scopeId);
        if (root !== undefined) record.scopeId = scopeIdByRoot.get(root)!;
        else extra.scopeId = annotation.scopeId;
      }
      if (present(annotation.kind)) record.annotationKind = annotation.kind;
      copyPresent(record, annotation, ANNOTATION_COPIED_FIELDS);
      if (Object.keys(extra).length > 0) record.extra = extra;
      record.rev = undefined;
      small.push(put(record as unknown as SnapshotRecord));
    }

    // --- map ---
    const mapRecord: Dict = { kind: "map", id: mapId };
    if (rootId !== undefined) mapRecord.rootNodeId = rootId;
    copyPresent(mapRecord, row as unknown as Dict, ["tags", "archived", "pinned", "source"]);
    if (present(row.version)) mapRecord.legacyVersion = row.version;
    if (present(row.saved_at)) mapRecord.legacySavedAt = row.saved_at;
    copyPresent(mapRecord, state, ["linearTextFontScale", "linearPanelWidth"]);
    const mapExtra = collectExtra(state, STATE_FIELDS, STATE_DROPPED_FIELDS);
    if (mapExtra) mapRecord.extra = mapExtra;
    mapRecord.rev = undefined;
    small.push(put(mapRecord as unknown as SnapshotRecord));

    // extensionDef is workspace-level. An array on the state is the whole set.
    // An absent property leaves the definitions already in the record set.
    const declared = state.extensionDefs;
    if (Array.isArray(declared)) {
      const keep = new Set<string>();
      for (const item of declared) {
        if (!isDict(item) || item.kind !== "extensionDef") {
          throw new Error("extensionDefs contains a value that is not an extensionDef record.");
        }
        const record = item as unknown as SnapshotRecord;
        keep.add(recordRk(record));
        put(record);
      }
      for (const [rk, record] of [...out]) {
        if (record.kind === "extensionDef" && !keep.has(rk)) remove(rk);
      }
    } else {
      for (const record of out.values()) {
        if (record.kind === "extensionDef") produced.add(recordRk(record));
      }
    }
    // locks and grants: an absent property keeps the stored records; a present object is the whole set.
    const replaceHeld = (kind: "lock" | "grant", field: "locks" | "grants", build: (key: string, item: Dict) => SnapshotRecord): void => {
      if (!hasOwn(state, field)) return;
      const declared = dictOf(state[field]);
      const keep = new Set<string>();
      for (const key of sortedKeys(declared)) {
        const item = declared[key];
        if (!isDict(item)) throw new Error(`${field} contains a value that is not a record.`);
        const record = build(key, item);
        keep.add(recordRk(record));
        put(record);
      }
      for (const [rk, record] of [...out]) {
        if (record.kind === kind && (record as { mapId?: unknown }).mapId === mapId && !keep.has(rk)) remove(rk);
      }
    };
    replaceHeld("lock", "locks", (key, item) => {
      const target = typeof item.target === "string" && item.target !== "" ? item.target : key;
      if (!target) throw new Error("A lock record needs a target.");
      return { kind: "lock", target, mapId, rev: undefined } as unknown as SnapshotRecord;
    });
    replaceHeld("grant", "grants", (key, item) => {
      const principal = item.principal;
      if (typeof item.scopeId !== "string" || !isDict(principal) || typeof principal.account !== "string" || typeof item.capability !== "string" || typeof item.grantedBy !== "string") {
        throw new Error("A grant record needs scopeId, principal.account, capability and grantedBy.");
      }
      const record: Dict = {
        kind: "grant", id: key, mapId, scopeId: item.scopeId,
        principal: { account: principal.account }, capability: item.capability, grantedBy: item.grantedBy, rev: undefined,
      };
      if (typeof item.expiresAt === "string" && item.expiresAt !== "") record.expiresAt = item.expiresAt;
      return record as unknown as SnapshotRecord;
    });
    removeUnlessProduced(this.smallRecords);
    for (const rk of stray) {
      if (!produced.has(rk)) remove(rk);
    }
    for (const record of small) rest.push(record);
    for (const record of surfaceList) rest.push(record);
    const defRecords = [...out.values()].filter((record) => record.kind === "extensionDef");
    defRecords.sort((a, b) => compareStrings(recordRk(a), recordRk(b)));
    for (const record of defRecords) rest.push(record);
    const held = [...out.values()].filter((record) =>
      (record.kind === "lock" || record.kind === "grant") && (record as { mapId?: unknown }).mapId === mapId);
    held.sort((a, b) => compareStrings(recordRk(a), recordRk(b)));
    for (const record of held) rest.push(record);
    // namedSnapshots: an absent property keeps the stored records; a present object is the whole set.
    if (hasOwn(state, "namedSnapshots")) {
      const declared = dictOf(state.namedSnapshots);
      const keep = new Set<string>();
      for (const key of sortedKeys(declared)) {
        const item = declared[key];
        if (!isDict(item) || typeof item.name !== "string" || typeof item.seq !== "number" || typeof item.scopeId !== "string" || typeof item.reason !== "string") {
          throw new Error("A namedSnapshot record needs name, seq, scopeId and reason.");
        }
        const record = { kind: "namedSnapshot", id: key, mapId, name: item.name, seq: item.seq, scopeId: item.scopeId, reason: item.reason, rev: undefined } as unknown as SnapshotRecord;
        keep.add(recordRk(record));
        put(record);
      }
      for (const [rk, record] of [...out]) {
        if (record.kind === "namedSnapshot" && (record as { mapId?: unknown }).mapId === mapId && !keep.has(rk)) remove(rk);
      }
    } else {
      for (const record of out.values()) {
        if (record.kind === "namedSnapshot" && (record as { mapId?: unknown }).mapId === mapId) produced.add(recordRk(record));
      }
    }
    const named = [...out.values()].filter((record) => record.kind === "namedSnapshot" && (record as { mapId?: unknown }).mapId === mapId);
    named.sort((a, b) => compareStrings(recordRk(a), recordRk(b)));
    for (const record of named) rest.push(record);

    // --- the state the reverse conversion gives ---
    // Everything but the nodes goes through `fromSnapshot` itself.
    let restState = this.lastRest;
    let sameRest = restState !== undefined && rest.length === this.lastRestInput.length;
    for (let i = 0; sameRest && i < rest.length; i += 1) {
      if (rest[i] !== this.lastRestInput[i]) sameRest = false;
    }
    if (!sameRest || restState === undefined) {
      restState = fromSnapshot(rest).rows[0].state as unknown as Dict;
    }

    let reuseNodes = nodeIds.length === nodeKeys.length;
    const restoredNodes: Dict[] = new Array(nodeIds.length);
    for (let i = 0; i < nodeIds.length; i += 1) {
      const id = nodeIds[i];
      const node = nodes[i];
      const memo = memos[i];
      const record = memo.node;
      const children = orderedChildren.get(id) ?? NO_CHILDREN;
      const nodeType = record.nodeType ?? (node.nodeType === "folder" && id !== rootId ? "folder" : "text");
      if (memo.selfNormal && node.nodeType === nodeType && sameStrings(node.children, children)) {
        restoredNodes[i] = node;
        continue;
      }
      const attributes: Dict = { ...(record.attributes ?? {}) };
      const hasParent = typeof node.parentId === "string";
      if (hasParent && memo.label !== undefined) attributes[EDGE_LABEL_ATTRIBUTE] = memo.label;
      const restored: Dict = {
        ...(record.extra ?? {}),
        id,
        parentId: hasParent ? node.parentId : null,
        children: [...children],
        nodeType,
        text: record.text,
        collapsed: record.collapsed === true,
        details: memo.details?.body ?? "",
        note: memo.details?.note ?? "",
        attributes,
        link: memo.details?.link ?? "",
      };
      const alias = record.alias;
      if (alias) {
        if (alias.target !== undefined) restored.targetNodeId = alias.target;
        if (alias.label !== undefined) restored.aliasLabel = alias.label;
        if (alias.access !== undefined) restored.access = alias.access;
        if (alias.snapshotLabel !== undefined) restored.targetSnapshotLabel = alias.snapshotLabel;
        if (alias.broken === true) restored.isBroken = true;
      }
      if (record.extensions !== undefined) restored.extensions = record.extensions;
      if (record.valid !== undefined) restored.valid = record.valid;
      if (record.copyOf !== undefined) restored.copyOf = record.copyOf;
      const incoming = this.edgeByTarget.get(id);
      if (incoming?.relationType !== undefined) restored.edgeRelationType = incoming.relationType;
      if (incoming?.attributes !== undefined) restored.edgeAttributes = incoming.attributes;
      if (incoming?.extensions !== undefined) restored.edgeExtensions = incoming.extensions;
      if (hasParent && node.edgeOutsideScope !== undefined) {
        // Kept only while it puts the edge on another scope than the parent's own.
        const parentId = node.parentId as string;
        const fallback = edgeScopeIdByParent.get(parentId);
        if (childEdgeScope(parentId, node, fallback) !== fallback) restored.edgeOutsideScope = true;
      }
      if (sameJson(node, restored)) {
        memo.selfNormal = true;
        restoredNodes[i] = node;
      } else {
        // The restored node stands for the same records; remember that for the next call.
        const restoredMemo: NodeMemo = { ...memo, selfNormal: true };
        memos[i] = restoredMemo;
        this.nodeMemo.set(restored, restoredMemo);
        restoredNodes[i] = restored;
        reuseNodes = false;
      }
    }
    if (reuseNodes) {
      const keys = Object.keys(sourceNodes);
      for (let i = 0; reuseNodes && i < keys.length; i += 1) {
        if (keys[i] !== nodeIds[i]) reuseNodes = false;
      }
    }
    let stateNodes: Dict;
    if (reuseNodes) {
      stateNodes = sourceNodes;
    } else {
      stateNodes = {};
      for (let i = 0; i < nodeIds.length; i += 1) stateNodes[nodeIds[i]] = restoredNodes[i];
      // Sibling lists are remembered by the parent's state object: point them at the objects handed back.
      for (const [parentId, members] of childrenByParent) {
        const parentNode = stateNodes[parentId];
        const childIds = orderedChildren.get(parentId);
        if (!isDict(parentNode) || childIds === undefined || parentNode === sourceNodes[parentId]) continue;
        this.parentMemo.set(parentNode, { gen, parentId, scopeSig: scopeSigByParent.get(parentId) ?? "", members: members.map((index) => memos[index]), childIds });
      }
    }

    const nextState: Dict = { ...restState, nodes: stateNodes };
    if (isDict(restState.scopes)) {
      // `fromSnapshot` saw no node here, so the scope labels are filled in from the nodes.
      let scopes = restState.scopes;
      let copied = false;
      for (const key of Object.keys(scopes)) {
        const scope = scopes[key] as Dict;
        const root = Array.isArray(scope.rootNodeIds) ? scope.rootNodeIds[0] : undefined;
        const rootNode = typeof root === "string" ? stateNodes[root] : undefined;
        const label = (isDict(rootNode) ? rootNode.text : undefined) ?? "";
        if (scope.label === label) continue;
        if (!copied) {
          scopes = { ...scopes };
          copied = true;
        }
        scopes[key] = { ...scope, label };
      }
      nextState.scopes = scopes;
    }

    this.gen = gen;
    this.lastRecords = out;
    this.scopeByRoot = nextScopeByRoot;
    this.surfaceRecords = nextSurfaceRecords;
    this.smallRecords = small;
    this.lastNodeIds = nodeIds;
    this.lastStateNodes = stateNodes;
    this.lastRestInput = rest;
    // Remembered with the labels filled in, so that an unchanged scope keeps its object next time.
    this.lastRest = nextState.scopes !== restState.scopes ? { ...restState, scopes: nextState.scopes } : restState;
    const replaced = new Map<string, SnapshotRecord>();
    for (const rk of delta.keys()) {
      const before = prior(rk);
      if (before !== undefined) replaced.set(rk, before);
    }
    return { records: out, delta, replaced, state: nextState as unknown as AppState };
  }
}

function copyScopeFields(record: Dict, source: Dict): void {
  const fields = scopeFieldsOf(source);
  if (fields.band) record.band = fields.band;
  if (fields.projection) record.projection = fields.projection;
  if (fields.retention) record.retention = fields.retention;
}

function sameStrings(left: unknown, right: readonly string[]): boolean {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  for (let i = 0; i < right.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

/** True for a record `projectMap` produces for the map `mapId` (every map-scoped kind but `idMap`). */
export function isProjectedRecord(record: SnapshotRecord, mapId: string): boolean {
  if (record.kind === "extensionDef") return true;
  if (record.kind === "map") return record.id === mapId;
  // Decay is activity state, not a projection of the map. It lives beside the map records.
  if (record.kind === "idMap" || record.kind === "snapshot" || record.kind === "decay") return false;
  return (record as { mapId?: unknown }).mapId === mapId;
}

/**
 * Records of the map `row.id` for its current state, in canonical order. `previousRecords` may be
 * the records of the whole workspace; only those of this map are read. Unchanged records keep
 * their `rev`; changed and new records have `rev: undefined`.
 */
export function projectMap(workspaceId: string, row: SnapshotRow, previousRecords: SnapshotRecord[]): SnapshotRecord[] {
  const previous = new Map<string, SnapshotRecord>();
  for (const record of previousRecords) {
    if (isProjectedRecord(record, row.id)) previous.set(recordRk(record), record);
  }
  return sortRecords([...new MapProjector(workspaceId).project(row, previous).records.values()]);
}
