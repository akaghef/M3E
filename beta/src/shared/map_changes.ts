/**
 * Field-level changes between two map states.
 * The storage shape stays the current map state. Command application compares
 * `before` with the saved value of each touched field.
 * Collection entries (node, edge, attribute, GraphLink, linear-text, scope,
 * Surface View, annotation) are separate changes. `nodes`, `links`, `scopes`,
 * `surfaces`, `annotations`, and `linearNotesByScope` also record whether the
 * property itself is present, because an empty object is different from a
 * missing one. That presence change compares only `present`, so an untouched
 * entry is not a conflict.
 */

export type RecordKind =
  | "node"
  | "edge"
  | "attribute"
  | "graph-link"
  | "linear-text"
  | "scope-setting"
  | "surface"
  | "surface-node-view"
  | "annotation"
  | "map-field";

export type ChangeOp = "create" | "update" | "delete";

export interface RecordChange {
  kind: RecordKind;
  key: string[];
  op: ChangeOp;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface FieldConflict {
  kind: RecordKind;
  key: string[];
  field: string;
}

export type ApplyResult =
  | { ok: true; state: object }
  | { ok: false; conflicts: FieldConflict[] };

export interface MapCommandActor {
  kind: "human" | "ai-agent" | "system";
  id: string;
}

export interface MapCommand {
  commandId: string;
  actor: MapCommandActor;
  intent: string;
  provenance?: unknown;
  /** Written on the journal line when present. Write-back and promotion require one. */
  reason?: string;
  /** Required to shorten retention.ms and to delete a namedSnapshot. */
  confirm?: boolean;
  changes: RecordChange[];
}

const STRUCTURED = new Set(["nodes", "links", "scopes", "surfaces", "annotations", "linearNotesByScope"]);
const NODE_SPLIT = new Set(["parentId", "children", "attributes"]);
const SHELL_FIELDS = new Set(["attributes", "nodeViews"]);

type Bag = Record<string, unknown>;
type EdgeAssign = { parentId: string; index: number };

function isBag(value: unknown): value is Bag {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function has(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (isBag(value)) {
    const copy: Bag = {};
    for (const key of Object.keys(value)) copy[key] = clone(value[key]);
    return copy as T;
  }
  return value;
}

export function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => sameValue(item, right[index]));
  }
  if (!isBag(left) || !isBag(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => has(right, key) && sameValue(left[key], right[key]));
}

function dict(state: Bag, field: string): Bag {
  const value = state[field];
  if (Array.isArray(value)) {
    const copy: Bag = {};
    value.forEach((item, index) => { copy[String(index)] = item; });
    return copy;
  }
  return isBag(value) ? value : {};
}

function bagOf(value: unknown): Bag | null {
  return isBag(value) ? value : null;
}

function payload(source: Bag, skip: Set<string>): Bag {
  const copy: Bag = {};
  for (const key of Object.keys(source)) {
    if (skip.has(key)) continue;
    copy[key] = clone(source[key]);
  }
  return copy;
}

function nodeBody(source: Bag): Bag {
  const copy = shellPayload(source, NODE_SPLIT, "attributes");
  if (has(source, "parentId") && typeof source.parentId !== "string") copy.parentId = clone(source.parentId);
  return copy;
}

function shellPayload(source: Bag, skip: Set<string>, shellKey: string): Bag {
  const copy = payload(source, new Set([...skip, shellKey]));
  if (has(source, shellKey) && isBag(source[shellKey])) copy[shellKey] = {};
  return copy;
}

function changedFields(before: Bag, after: Bag): { before: Bag; after: Bag } | null {
  const beforeFields: Bag = {};
  const afterFields: Bag = {};
  let changed = false;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const inBefore = has(before, key);
    const inAfter = has(after, key);
    if (inBefore && inAfter && sameValue(before[key], after[key])) continue;
    if (inBefore) beforeFields[key] = clone(before[key]);
    if (inAfter) afterFields[key] = clone(after[key]);
    changed = true;
  }
  return changed ? { before: beforeFields, after: afterFields } : null;
}

function pushPair(changes: RecordChange[], kind: RecordKind, key: string[], before: Bag | null, after: Bag | null): void {
  if (!before && after) changes.push({ kind, key, op: "create", after: clone(after) });
  else if (before && !after) changes.push({ kind, key, op: "delete", before: clone(before) });
  else if (before && after) {
    const fields = changedFields(before, after);
    if (fields) changes.push({ kind, key, op: "update", before: fields.before, after: fields.after });
  }
}

function valueBag(value: unknown): Bag {
  return { value: clone(value) };
}

function edgesOf(state: Bag): Map<string, EdgeAssign> {
  const nodes = dict(state, "nodes");
  const found = new Map<string, EdgeAssign>();
  for (const [id, raw] of Object.entries(nodes)) {
    if (!isBag(raw) || typeof raw.parentId !== "string") continue;
    const parent = bagOf(nodes[raw.parentId]);
    const children = parent && Array.isArray(parent.children) ? parent.children as unknown[] : [];
    found.set(id, { parentId: raw.parentId, index: children.indexOf(id) });
  }
  return found;
}

function diffAttributes(changes: RecordChange[], ownerKind: "node" | "graph-link", ownerId: string, before: unknown, after: unknown): void {
  const left = isBag(before) ? before : {};
  const right = isBag(after) ? after : {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const inLeft = isBag(before) && has(left, key);
    const inRight = isBag(after) && has(right, key);
    if (inLeft && inRight && sameValue(left[key], right[key])) continue;
    pushPair(
      changes,
      "attribute",
      [ownerKind, ownerId, key],
      inLeft ? valueBag(left[key]) : null,
      inRight ? valueBag(right[key]) : null,
    );
  }
}

function diffNodes(before: Bag, after: Bag, changes: RecordChange[]): void {
  const left = dict(before, "nodes");
  const right = dict(after, "nodes");
  const leftEdges = edgesOf(before);
  const rightEdges = edgesOf(after);
  for (const id of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const from = bagOf(left[id]);
    const to = bagOf(right[id]);
    if (from && !to) {
      diffAttributes(changes, "node", id, from.attributes, undefined);
      pushPair(changes, "edge", [id], edgeBag(leftEdges.get(id)), null);
      pushPair(changes, "node", [id], nodeBody(from), null);
    } else if (!from && to) {
      pushPair(changes, "node", [id], null, nodeBody(to));
      diffAttributes(changes, "node", id, undefined, to.attributes);
      pushPair(changes, "edge", [id], null, edgeBag(rightEdges.get(id)));
    } else if (from && to) {
      diffAttributes(changes, "node", id, from.attributes, to.attributes);
      pushPair(changes, "node", [id], nodeBody(from), nodeBody(to));
      pushPair(changes, "edge", [id], edgeBag(leftEdges.get(id)), edgeBag(rightEdges.get(id)));
    }
  }
}

function edgeBag(edge: EdgeAssign | undefined): Bag | null {
  return edge ? { parentId: edge.parentId, index: edge.index } : null;
}

function diffLinks(before: Bag, after: Bag, changes: RecordChange[]): void {
  const left = dict(before, "links");
  const right = dict(after, "links");
  for (const id of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const from = bagOf(left[id]);
    const to = bagOf(right[id]);
    const pair = () => pushPair(
      changes,
      "graph-link",
      [id],
      from ? shellPayload(from, new Set(["attributes"]), "attributes") : null,
      to ? shellPayload(to, new Set(["attributes"]), "attributes") : null,
    );
    if (!from && to) {
      pair();
      diffAttributes(changes, "graph-link", id, undefined, to.attributes);
    } else if (from && !to) {
      diffAttributes(changes, "graph-link", id, from.attributes, undefined);
      pair();
    } else if (from && to) {
      diffAttributes(changes, "graph-link", id, from.attributes, to.attributes);
      pair();
    }
  }
}

function diffKeyed(kind: RecordKind, field: string, before: Bag, after: Bag, changes: RecordChange[], asValue: boolean): void {
  const left = dict(before, field);
  const right = dict(after, field);
  const leftPresent = has(before, field);
  const rightPresent = has(after, field);
  for (const id of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const from = leftPresent && has(left, id) ? left[id] : undefined;
    const to = rightPresent && has(right, id) ? right[id] : undefined;
    if (asValue) pushPair(changes, kind, [id], from === undefined ? null : valueBag(from), to === undefined ? null : valueBag(to));
    else pushPair(changes, kind, [id], bagOf(from), bagOf(to) ?? (to === undefined ? null : valueBag(to)));
  }
}

function diffSurfaces(before: Bag, after: Bag, changes: RecordChange[]): void {
  const left = dict(before, "surfaces");
  const right = dict(after, "surfaces");
  for (const id of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const from = bagOf(left[id]);
    const to = bagOf(right[id]);
    const fromViews = from && isBag(from.nodeViews) ? from.nodeViews : {};
    const toViews = to && isBag(to.nodeViews) ? to.nodeViews : {};
    const viewChanges: RecordChange[] = [];
    const ids = [...new Set([...Object.keys(fromViews), ...Object.keys(toViews)])].sort();
    for (const nodeId of ids) {
      pushPair(
        viewChanges,
        "surface-node-view",
        [id, nodeId],
        from && has(fromViews, nodeId) ? bagOf(fromViews[nodeId]) ?? valueBag(fromViews[nodeId]) : null,
        to && has(toViews, nodeId) ? bagOf(toViews[nodeId]) ?? valueBag(toViews[nodeId]) : null,
      );
    }
    const surfaceChange: RecordChange[] = [];
    pushPair(
      surfaceChange,
      "surface",
      [id],
      from ? shellPayload(from, new Set(["nodeViews"]), "nodeViews") : null,
      to ? shellPayload(to, new Set(["nodeViews"]), "nodeViews") : null,
    );
    if (!from && to) changes.push(...surfaceChange, ...viewChanges);
    else changes.push(...viewChanges, ...surfaceChange);
  }
}

function diffAnnotations(before: Bag, after: Bag, changes: RecordChange[]): void {
  const leftShape = annotationShape(before.annotations);
  const rightShape = annotationShape(after.annotations);
  const left = dict(before, "annotations");
  const right = dict(after, "annotations");
  for (const id of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const from = leftShape === "absent" || !has(left, id) ? undefined : left[id];
    const to = rightShape === "absent" || !has(right, id) ? undefined : right[id];
    pushPair(changes, "annotation", [id], from === undefined ? null : bagOf(from) ?? valueBag(from), to === undefined ? null : bagOf(to) ?? valueBag(to));
  }
  if (leftShape !== rightShape && (leftShape !== "absent" || rightShape !== "absent")) {
    pushPair(changes, "map-field", ["annotations"], leftShape === "absent" ? null : { shape: leftShape }, rightShape === "absent" ? null : { shape: rightShape });
  }
}

function annotationShape(value: unknown): "array" | "record" | "absent" {
  if (Array.isArray(value)) return "array";
  if (isBag(value)) return "record";
  return "absent";
}

function diffPresence(before: Bag, after: Bag, changes: RecordChange[]): void {
  for (const field of STRUCTURED) {
    if (field === "annotations") continue;
    const left = has(before, field);
    const right = has(after, field);
    if (left === right) continue;
    pushPair(changes, "map-field", [field], left ? { present: true } : null, right ? { present: true } : null);
  }
}

function diffMapFields(before: Bag, after: Bag, changes: RecordChange[]): void {
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    if (STRUCTURED.has(key)) continue;
    const leftHas = has(before, key);
    const rightHas = has(after, key);
    const left = before[key];
    const right = after[key];
    if (leftHas && rightHas && isBag(left) && isBag(right)) pushPair(changes, "map-field", [key], left, right);
    else if (leftHas && isBag(left) && !rightHas) pushPair(changes, "map-field", [key], left, null);
    else if (!leftHas && rightHas && isBag(right)) pushPair(changes, "map-field", [key], null, right);
    else pushPair(changes, "map-field", [key], leftHas ? valueBag(left) : null, rightHas ? valueBag(right) : null);
  }
}

function unwrapAnnotation(value: Bag | undefined): unknown {
  if (!value) return {};
  if (has(value, "value") && !has(value, "kind") && Object.keys(value).length === 1) return clone(value.value);
  return clone(value);
}

export function diffState(before: object, after: object): RecordChange[] {
  const from = before as Bag;
  const to = after as Bag;
  const changes: RecordChange[] = [];
  diffPresence(from, to, changes);
  diffNodes(from, to, changes);
  diffLinks(from, to, changes);
  diffKeyed("linear-text", "linearNotesByScope", from, to, changes, true);
  diffKeyed("scope-setting", "scopes", from, to, changes, false);
  diffSurfaces(from, to, changes);
  diffAnnotations(from, to, changes);
  diffMapFields(from, to, changes);
  return changes;
}

function touched(before: Bag | undefined, after: Bag | undefined): string[] {
  return [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
}

function conflictsFor(change: RecordChange, current: Bag | null, fields: string[]): FieldConflict[] {
  return fields.map((field) => ({ kind: change.kind, key: change.key, field }));
}

/**
 * An empty attributes or nodeViews container is not a value: its entries are records
 * of their own, and the record store keeps no row for an empty one, so a state read
 * back from it lacks the field where the viewer holds {}. Absent and {} compare equal.
 */
function emptyShell(bag: Bag, field: string): boolean {
  if (!SHELL_FIELDS.has(field)) return false;
  const value = bag[field];
  return !has(bag, field) || (isBag(value) && Object.keys(value).length === 0);
}

/** A node without nodeType, or a leaf, is a text node: the record store keeps neither and reads "text" back. */
function nodeTypeOf(bag: Bag): unknown {
  const value = has(bag, "nodeType") ? bag.nodeType : undefined;
  return value === undefined || value === "leaf" ? "text" : value;
}

/** Node fields the record store does not keep: a value read back never shows them. */
const NODE_NOT_KEPT = new Set(["scopeId", "aliasOf"]);
/** Node fields the record store keeps only when they differ from this value; absent reads as it. */
const NODE_DEFAULTS: Record<string, unknown> = {
  collapsed: false, details: "", note: "", link: "", isBroken: false, edgeOutsideScope: false,
};

function present(bag: Bag, field: string): boolean {
  return has(bag, field) && bag[field] !== undefined;
}

/**
 * Field equality in the record store's terms: what it reads back for a value it was given.
 * Without this, a viewer that holds `isBroken: false` or a `scopeId` conflicts with itself.
 */
function sameField(left: Bag, right: Bag, field: string, kind?: RecordChange["kind"]): boolean {
  if (emptyShell(left, field) && emptyShell(right, field)) return true;
  if (kind === "node") {
    if (NODE_NOT_KEPT.has(field)) return true;
    if (field === "nodeType") return nodeTypeOf(left) === nodeTypeOf(right);
    if (Object.prototype.hasOwnProperty.call(NODE_DEFAULTS, field)) {
      const fallback = NODE_DEFAULTS[field];
      return sameValue(present(left, field) ? left[field] : fallback, present(right, field) ? right[field] : fallback);
    }
  }
  return present(left, field) === present(right, field) && sameValue(left[field], right[field]);
}

function fieldConflicts(change: RecordChange, current: Bag | null, allowAfter: boolean): FieldConflict[] {
  const before = change.before ?? {};
  const after = change.after ?? {};
  const fields = touched(change.before, change.after);
  if (change.op === "create") return current ? conflictsFor(change, current, fields.length ? fields : ["*"]) : [];
  if (!current) return conflictsFor(change, current, fields.length ? fields : ["*"]);
  const mismatched = fields.filter((field) => {
    if (allowAfter && change.op === "update" && matchesField(current, after, field, change.kind)) return false;
    return !sameField(current, before, field, change.kind);
  });
  if (change.op === "delete") {
    for (const field of Object.keys(current)) {
      if (!has(before, field) && !sameField(current, before, field, change.kind)) mismatched.push(field);
    }
  }
  return conflictsFor(change, current, mismatched);
}

class Draft {
  readonly state: Bag;
  private readonly original: Bag;

  constructor(source: object) {
    this.original = source as Bag;
    this.state = { ...this.original };
  }

  private own(field: string): Bag {
    const current = this.state[field];
    if (current === this.original[field]) {
      this.state[field] = Array.isArray(current)
        ? [...current]
        : isBag(current) ? { ...current } : {};
    } else if (!isBag(this.state[field]) && !Array.isArray(this.state[field])) this.state[field] = {};
    return this.state[field] as Bag;
  }

  ensure(field: string): Bag {
    if (!has(this.state, field) || (!isBag(this.state[field]) && !Array.isArray(this.state[field]))) this.state[field] = {};
    return this.own(field);
  }

  node(id: string): Bag | null {
    const nodes = this.ensure("nodes");
    if (!isBag(nodes[id])) return null;
    const originalNodes = isBag(this.original.nodes) ? this.original.nodes : {};
    if (nodes[id] === originalNodes[id]) nodes[id] = { ...(nodes[id] as Bag) };
    return nodes[id] as Bag;
  }

  putNode(id: string, value: Bag): void {
    this.ensure("nodes")[id] = value;
  }

  bag(field: string, id: string): Bag | null {
    const items = this.ensure(field);
    if (Array.isArray(this.state[field])) return null;
    if (!isBag(items[id])) return null;
    const original = dict(this.original, field);
    if (items[id] === original[id]) items[id] = { ...(items[id] as Bag) };
    return items[id] as Bag;
  }
}

function assignFields(target: Bag, before: Bag | undefined, after: Bag | undefined): void {
  for (const key of touched(before, after)) {
    if (!after || !has(after, key)) {
      delete target[key];
      continue;
    }
    const value = after[key];
    if (SHELL_FIELDS.has(key) && isBag(value) && Object.keys(value).length === 0) {
      if (!isBag(target[key])) target[key] = {};
      continue;
    }
    target[key] = clone(value);
  }
}

function attributeTarget(draft: Draft, ownerKind: string, ownerId: string): Bag | null {
  if (ownerKind === "node") {
    const node = draft.node(ownerId);
    if (!node) return null;
    if (!isBag(node.attributes)) node.attributes = {};
    else node.attributes = { ...node.attributes };
    return node.attributes as Bag;
  }
  const link = draft.bag("links", ownerId);
  if (!link) return null;
  if (!isBag(link.attributes)) link.attributes = {};
  else link.attributes = { ...link.attributes };
  return link.attributes as Bag;
}

/** Application-only index. Unlike diff's reference walk, each sibling list is read once. */
function applicationEdges(state: Bag): Map<string, EdgeAssign> {
  const nodes = dict(state, "nodes");
  const positions = new Map<string, Map<unknown, number>>();
  const found = new Map<string, EdgeAssign>();
  for (const [id, raw] of Object.entries(nodes)) {
    if (!isBag(raw) || typeof raw.parentId !== "string") continue;
    let indexes = positions.get(raw.parentId);
    if (!indexes) {
      positions.set(raw.parentId, indexes = new Map());
      const parent = nodes[raw.parentId];
      const children = isBag(parent) && Array.isArray(parent.children) ? parent.children : [];
      for (let i = 0; i < children.length; i += 1) if (!indexes.has(children[i])) indexes.set(children[i], i);
    }
    found.set(id, { parentId: raw.parentId, index: indexes.get(id) ?? -1 });
  }
  return found;
}

function applyEdges(draft: Draft, changes: readonly RecordChange[]): void {
  const edges = changes.filter((change) => change.kind === "edge");
  if (!edges.length) return;
  const assign = applicationEdges(draft.state);
  const affected = new Set<string>();
  for (const change of edges) {
    const id = change.key[0] ?? "";
    const beforeParent = typeof change.before?.parentId === "string" ? change.before.parentId : "";
    const afterParent = typeof change.after?.parentId === "string" ? change.after.parentId : "";
    if (beforeParent) affected.add(beforeParent);
    if (afterParent) affected.add(afterParent);
    // A reorder carries only the index, so the parent comes from the current edge.
    const previous = assign.get(id);
    if (previous) affected.add(previous.parentId);
    if (change.op === "delete") assign.delete(id);
    else {
      const parentId = typeof change.after?.parentId === "string" ? change.after.parentId : previous?.parentId;
      const index = typeof change.after?.index === "number" ? change.after.index : previous?.index;
      if (typeof parentId === "string" && typeof index === "number") assign.set(id, { parentId, index });
    }
  }
  const nodes = draft.ensure("nodes");
  for (const parentId of affected) {
    if (!isBag(nodes[parentId])) continue;
    const parent = draft.node(parentId);
    if (!parent) continue;
    parent.children = [...assign.entries()]
      .filter(([, edge]) => edge.parentId === parentId)
      .sort((left, right) => left[1].index - right[1].index || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
      .map(([id]) => id);
  }
  const changedIds = new Set(edges.map((change) => change.key[0]));
  for (const [id, edge] of assign) {
    if (!affected.has(edge.parentId) && !changedIds.has(id)) continue;
    const current = nodes[id];
    if (isBag(current) && current.parentId === edge.parentId) continue;
    const node = draft.node(id);
    if (node) node.parentId = edge.parentId;
  }
  for (const change of edges) {
    if (change.op !== "delete") continue;
    const node = draft.node(change.key[0] ?? "");
    if (node) node.parentId = null;
  }
}

function applyAnnotations(draft: Draft, changes: readonly RecordChange[]): void {
  const relevant = changes.filter((change) => change.kind === "annotation" || (change.kind === "map-field" && change.key[0] === "annotations" && (has(change.before ?? {}, "shape") || has(change.after ?? {}, "shape"))));
  if (!relevant.length) return;
  const shapeChange = [...relevant].reverse().find((change) => change.kind === "map-field");
  let shape = annotationShape(draft.state.annotations);
  if (shapeChange?.op === "delete") shape = "absent";
  else if (shapeChange?.after?.shape === "array" || shapeChange?.after?.shape === "record") shape = shapeChange.after.shape;
  const sourceItems = dict(draft.state, "annotations");
  const items: Bag = {};
  for (const key of Object.keys(sourceItems)) {
    const value = sourceItems[key];
    items[key] = isBag(value) ? { ...value } : value;
  }
  for (const change of relevant) {
    if (change.kind !== "annotation") continue;
    const id = change.key[0] ?? "";
    if (change.op === "delete") delete items[id];
    else if (change.op === "create") items[id] = unwrapAnnotation(change.after);
    else if (isBag(items[id])) assignFields(items[id] as Bag, change.before, change.after);
    else items[id] = unwrapAnnotation(change.after);
  }
  if (shape === "absent") delete draft.state.annotations;
  else if (shape === "array") {
    draft.state.annotations = Object.keys(items).map(Number).sort((left, right) => left - right).map((index) => items[String(index)]);
  } else draft.state.annotations = items;
}

function locate(state: Bag, change: RecordChange, edges?: Map<string, EdgeAssign>): Bag | null {
  if (change.kind === "node") return bagOf(dict(state, "nodes")[change.key[0] ?? ""]);
  if (change.kind === "edge") {
    const edge = edges?.get(change.key[0] ?? "");
    return edge ? { parentId: edge.parentId, index: edge.index } : null;
  }
  if (change.kind === "attribute") {
    const owner = change.key[0] === "graph-link" ? bagOf(dict(state, "links")[change.key[1] ?? ""]) : bagOf(dict(state, "nodes")[change.key[1] ?? ""]);
    const bag = owner && isBag(owner.attributes) ? owner.attributes : null;
    const key = change.key[2] ?? "";
    return bag && has(bag, key) ? { value: bag[key] } : null;
  }
  if (change.kind === "graph-link") return bagOf(dict(state, "links")[change.key[0] ?? ""]);
  if (change.kind === "linear-text") {
    const notes = state.linearNotesByScope;
    const key = change.key[0] ?? "";
    return isBag(notes) && has(notes, key) ? { value: notes[key] } : null;
  }
  if (change.kind === "scope-setting") return bagOf(dict(state, "scopes")[change.key[0] ?? ""]);
  if (change.kind === "surface") return bagOf(dict(state, "surfaces")[change.key[0] ?? ""]);
  if (change.kind === "surface-node-view") {
    const surface = bagOf(dict(state, "surfaces")[change.key[0] ?? ""]);
    const views = surface && isBag(surface.nodeViews) ? surface.nodeViews : null;
    const key = change.key[1] ?? "";
    return views && has(views, key) ? bagOf(views[key]) ?? valueBag(views[key]) : null;
  }
  if (change.kind === "annotation") {
    const items = dict(state, "annotations");
    const key = change.key[0] ?? "";
    return annotationShape(state.annotations) !== "absent" && has(items, key) ? bagOf(items[key]) ?? valueBag(items[key]) : null;
  }
  const field = change.key[0] ?? "";
  if (!has(state, field)) return null;
  if (change.before && has(change.before, "present") || change.after && has(change.after, "present")) return { present: true };
  if (change.before && has(change.before, "shape") || change.after && has(change.after, "shape")) return { shape: annotationShape(state[field]) };
  if (isBag(state[field]) && !(change.before && has(change.before, "value") && Object.keys(change.before).length === 1 && !isBag(change.before.value))) return bagOf(state[field]);
  return { value: state[field] };
}

function presenceConflict(state: Bag, changes: readonly RecordChange[], change: RecordChange): FieldConflict[] {
  const field = change.key[0] ?? "";
  if (!STRUCTURED.has(field) || field === "annotations") return [];
  const present = has(state, field);
  if (change.op === "create") return present ? [{ kind: change.kind, key: change.key, field: "present" }] : [];
  if (!present) return [{ kind: change.kind, key: change.key, field: "present" }];
  if (change.op !== "delete") return [];
  const kindByField: Record<string, RecordKind> = {
    nodes: "node",
    links: "graph-link",
    scopes: "scope-setting",
    surfaces: "surface",
    linearNotesByScope: "linear-text",
  };
  const entryKind = kindByField[field];
  const removed = new Set(changes.filter((item) => item.kind === entryKind && item.op === "delete").map((item) => item.key[0]));
  const residual = Object.keys(dict(state, field)).filter((key) => !removed.has(key));
  return residual.map((key) => ({ kind: change.kind, key: change.key, field: key }));
}

function matchesField(current: Bag, expected: Bag, field: string, kind?: RecordChange["kind"]): boolean {
  return sameField(current, expected, field, kind);
}

function alreadyApplied(change: RecordChange, current: Bag | null): boolean {
  if (change.op === "delete") return current === null;
  if (change.op === "create") return sameValue(current, change.after ?? null);
  return current !== null && touched(change.before, change.after)
    .every((field) => matchesField(current, change.after ?? {}, field, change.kind));
}

export function applyChanges(state: object, changes: readonly RecordChange[], allowAfter = false): ApplyResult {
  const source = state as Bag;
  const conflicts: FieldConflict[] = [];
  const pending: RecordChange[] = [];
  const edges = changes.some((change) => change.kind === "edge") ? applicationEdges(source) : undefined;
  for (const change of changes) {
    const current = locate(source, change, edges);
    if (change.kind === "map-field" && (change.before?.present === true || change.after?.present === true)) {
      if (allowAfter && alreadyApplied(change, current)) continue;
      conflicts.push(...presenceConflict(source, changes, change));
      pending.push(change);
      continue;
    }
    const shellKind = change.kind === "graph-link" || change.kind === "surface" || change.kind === "node";
    const value = shellKind && current
      ? change.kind === "node"
        ? nodeBody(current)
        : shellPayload(current, change.kind === "surface" ? new Set(["nodeViews"]) : new Set(["attributes"]), change.kind === "surface" ? "nodeViews" : "attributes")
      : current;
    if (allowAfter && alreadyApplied(change, value)) continue;
    conflicts.push(...fieldConflicts(change, value, allowAfter));
    if (shellKind && change.op === "delete" && current) conflicts.push(...residualEntries(source, changes, change));
    pending.push(change);
  }
  if (conflicts.length) return { ok: false, conflicts };

  const draft = new Draft(source);
  const deferred: RecordChange[] = [];
  for (const change of pending) {
    if (change.kind === "edge" || change.kind === "annotation") continue;
    if (change.kind === "map-field" && change.key[0] === "annotations" && (has(change.before ?? {}, "shape") || has(change.after ?? {}, "shape"))) continue;
    if (change.kind === "map-field" && change.op === "delete" && change.before?.present === true) {
      deferred.push(change);
      continue;
    }
    applyOne(draft, change);
  }
  applyEdges(draft, pending);
  applyAnnotations(draft, pending);
  for (const change of deferred) applyMapField(draft, change);
  return { ok: true, state: draft.state };
}

function residualEntries(state: Bag, changes: readonly RecordChange[], change: RecordChange): FieldConflict[] {
  const id = change.key[0] ?? "";
  if (change.kind === "surface") {
    const surface = bagOf(dict(state, "surfaces")[id]);
    const views = surface && isBag(surface.nodeViews) ? surface.nodeViews : {};
    const removed = new Set(changes.filter((item) => item.kind === "surface-node-view" && item.op === "delete" && item.key[0] === id).map((item) => item.key[1]));
    return Object.keys(views).filter((key) => !removed.has(key)).map((key) => ({ kind: "surface-node-view" as const, key: [id, key], field: "*" }));
  }
  const ownerKind = change.kind === "node" ? "node" : "graph-link";
  const owner = bagOf((change.kind === "node" ? dict(state, "nodes") : dict(state, "links"))[id]);
  const attributes = owner && isBag(owner.attributes) ? owner.attributes : {};
  const removed = new Set(changes.filter((item) => item.kind === "attribute" && item.op === "delete" && item.key[0] === ownerKind && item.key[1] === id).map((item) => item.key[2]));
  return Object.keys(attributes).filter((key) => !removed.has(key)).map((key) => ({ kind: "attribute" as const, key: [ownerKind, id, key], field: "value" }));
}

function applyOne(draft: Draft, change: RecordChange): void {
  if (change.kind === "node") applyNode(draft, change);
  else if (change.kind === "attribute") applyAttribute(draft, change);
  else if (change.kind === "graph-link") applyEntry(draft, "links", change);
  else if (change.kind === "linear-text") applyValueEntry(draft, "linearNotesByScope", change);
  else if (change.kind === "scope-setting") applyEntry(draft, "scopes", change);
  else if (change.kind === "surface") applyEntry(draft, "surfaces", change);
  else if (change.kind === "surface-node-view") applyNodeView(draft, change);
  else if (change.kind === "map-field") applyMapField(draft, change);
}

function applyNode(draft: Draft, change: RecordChange): void {
  const id = change.key[0] ?? "";
  if (change.op === "delete") {
    const nodes = draft.ensure("nodes");
    delete nodes[id];
    return;
  }
  if (change.op === "create") {
    const created: Bag = { children: [] };
    assignFields(created, undefined, change.after);
    if (!has(created, "children")) created.children = [];
    draft.putNode(id, created);
    return;
  }
  const node = draft.node(id);
  if (node) assignFields(node, change.before, change.after);
}

function applyAttribute(draft: Draft, change: RecordChange): void {
  const bag = attributeTarget(draft, change.key[0] ?? "", change.key[1] ?? "");
  if (!bag) return;
  const key = change.key[2] ?? "";
  if (change.op === "delete") delete bag[key];
  else bag[key] = clone(change.after?.value);
}

function applyEntry(draft: Draft, field: string, change: RecordChange): void {
  const id = change.key[0] ?? "";
  const items = draft.ensure(field);
  if (change.op === "delete") {
    delete items[id];
    return;
  }
  if (change.op === "create") {
    items[id] = clone(change.after ?? {});
    return;
  }
  const current = draft.bag(field, id);
  if (current) assignFields(current, change.before, change.after);
}

function applyValueEntry(draft: Draft, field: string, change: RecordChange): void {
  const items = draft.ensure(field);
  const id = change.key[0] ?? "";
  if (change.op === "delete") delete items[id];
  else items[id] = clone(change.after?.value);
}

function applyNodeView(draft: Draft, change: RecordChange): void {
  const surface = draft.bag("surfaces", change.key[0] ?? "");
  if (!surface) return;
  if (!isBag(surface.nodeViews)) surface.nodeViews = {};
  else surface.nodeViews = { ...surface.nodeViews };
  const views = surface.nodeViews as Bag;
  const id = change.key[1] ?? "";
  if (change.op === "delete") delete views[id];
  else if (change.op === "create") views[id] = clone(change.after ?? {});
  else if (isBag(views[id])) {
    // Copy first: the entry is still shared with the caller's state.
    views[id] = { ...(views[id] as Bag) };
    assignFields(views[id] as Bag, change.before, change.after);
  } else views[id] = clone(change.after ?? {});
}

function applyMapField(draft: Draft, change: RecordChange): void {
  const field = change.key[0] ?? "";
  if (change.before?.present === true || change.after?.present === true) {
    if (change.op === "delete") delete draft.state[field];
    else if (!has(draft.state, field)) draft.state[field] = {};
    return;
  }
  if (change.op === "delete") {
    delete draft.state[field];
    return;
  }
  const boxed = !!change.after && has(change.after, "value") && Object.keys(change.after).length === 1 && !isBag(draft.state[field]);
  if (change.op === "create") {
    draft.state[field] = boxed ? clone(change.after?.value) : clone(change.after ?? {});
    return;
  }
  if (boxed || !isBag(draft.state[field])) draft.state[field] = clone(change.after?.value);
  // The field bag is still the caller's until ensure copies it. A refused commit must leave that state unchanged.
  else assignFields(draft.ensure(field), change.before, change.after);
}

export function invertChanges(changes: readonly RecordChange[]): RecordChange[] {
  return [...changes].reverse().map((change) => {
    if (change.op === "create") return { kind: change.kind, key: [...change.key], op: "delete", before: clone(change.after ?? {}) };
    if (change.op === "delete") return { kind: change.kind, key: [...change.key], op: "create", after: clone(change.before ?? {}) };
    return { kind: change.kind, key: [...change.key], op: "update", before: clone(change.after ?? {}), after: clone(change.before ?? {}) };
  });
}
