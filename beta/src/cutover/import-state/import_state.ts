/**
 * beta の maps.state_json をレコード配列へ分ける。
 * SQLite の値は AppState そのもの（rapid_mvp.ts の saveToSqlite）。
 * ファイル保存の { version, savedAt, state } も受け、state を中身として使う。
 * Neo4j にも SQLite にも書かない。
 *
 * 兄弟順キーは a で始まる固定幅の base62。
 * 同じ親の中ではバイト順が children[] の順と一致する。
 * beta に fractional-indexing は無く、この取り込みは現在の順を保つだけである。
 */

export interface ImportedNodeRecord {
  id: string;
  text: string;
  isRoot: boolean;
  nodeType: string;
  collapsed: boolean;
  details: string;
  note: string;
  link: string;
  targetNodeId?: string;
  aliasLabel?: string;
  access?: "read" | "write";
  targetSnapshotLabel?: string;
  isBroken?: boolean;
}

export interface ParentChildEdgeRecord {
  parentId: string;
  childId: string;
}

export interface SiblingOrderKeyRecord {
  parentId: string;
  childId: string;
  orderKey: string;
}

export interface AttributeRecord {
  ownerKind: "node" | "link";
  ownerId: string;
  key: string;
  value: unknown;
}

export interface ScopeMembershipRecord {
  scopeId: string;
  nodeId: string;
}

export interface ImportedStateRecords {
  nodes: ImportedNodeRecord[];
  edges: ParentChildEdgeRecord[];
  siblingOrderKeys: SiblingOrderKeyRecord[];
  attributes: AttributeRecord[];
  scopeMemberships: ScopeMembershipRecord[];
  /** レコードへ入れなかったフィールド名。値は入れない。 */
  unstored: string[];
}

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const STORED_NODE_KEYS = new Set([
  "id",
  "parentId",
  "children",
  "nodeType",
  "scopeId",
  "text",
  "collapsed",
  "details",
  "note",
  "attributes",
  "link",
  "targetNodeId",
  "aliasLabel",
  "access",
  "targetSnapshotLabel",
  "isBroken",
]);

export function siblingOrderKey(index: number, count: number): string {
  if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
    throw new Error("sibling order index is outside the sibling list");
  }
  let width = 1;
  let capacity = DIGITS.length;
  while (capacity < count) {
    width += 1;
    capacity *= DIGITS.length;
  }
  let n = index;
  const chars: string[] = [];
  for (let i = 0; i < width; i += 1) {
    chars.push(DIGITS[n % DIGITS.length] ?? "0");
    n = Math.floor(n / DIGITS.length);
  }
  chars.reverse();
  return `a${chars.join("")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapState(input: unknown, unstored: Set<string>): Record<string, unknown> {
  let value: unknown = input;
  if (typeof value === "string") {
    value = JSON.parse(value) as unknown;
  }
  if (!isRecord(value)) {
    throw new Error("state_json must be a JSON object");
  }
  if (!isRecord(value.nodes) && isRecord(value.state) && isRecord(value.state.nodes)) {
    for (const key of Object.keys(value)) {
      if (key !== "state") unstored.add(key);
    }
    return value.state;
  }
  return value;
}

function stringChildIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const child of value) {
    if (typeof child !== "string" || child.length === 0 || seen.has(child)) continue;
    seen.add(child);
    ids.push(child);
  }
  return ids;
}

function walkSchema(entity: Record<string, unknown>, prefix: string, into: Set<string>, seen: WeakSet<object>): void {
  if (seen.has(entity)) return;
  seen.add(entity);
  for (const [field, child] of Object.entries(entity)) {
    const name = `${prefix}.${field}`;
    into.add(name);
    if (field === "nodeViews") walkIdDictionary(child, name, into, seen);
    else if (isRecord(child)) walkSchema(child, name, into, seen);
    else if (Array.isArray(child)) {
      for (const item of child) {
        if (isRecord(item)) walkSchema(item, name, into, seen);
      }
    }
  }
}

function walkIdDictionary(dict: unknown, prefix: string, into: Set<string>, seen: WeakSet<object>): void {
  if (!isRecord(dict) || seen.has(dict)) return;
  seen.add(dict);
  for (const value of Object.values(dict)) {
    if (isRecord(value)) walkSchema(value, prefix, into, seen);
  }
}

function cloneAttributeValue(value: unknown): unknown {
  if (value !== null && typeof value === "object") return structuredClone(value);
  return value;
}

function takeAttributes(
  ownerKind: AttributeRecord["ownerKind"],
  ownerId: string,
  value: unknown,
  attributes: AttributeRecord[],
  unstored: Set<string>,
  fieldName: string,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    unstored.add(fieldName);
    return;
  }
  for (const [key, attrValue] of Object.entries(value)) {
    attributes.push({ ownerKind, ownerId, key, value: cloneAttributeValue(attrValue) });
  }
}

function recordedScopeId(scopeRoot: string, scopes: unknown): string {
  const inferred = `scope:${scopeRoot}`;
  if (!isRecord(scopes)) return inferred;
  const direct = scopes[inferred];
  if (isRecord(direct)) {
    return typeof direct.id === "string" && direct.id.length > 0 ? direct.id : inferred;
  }
  for (const [key, value] of Object.entries(scopes)) {
    if (!isRecord(value) || !Array.isArray(value.rootNodeIds) || !value.rootNodeIds.includes(scopeRoot)) continue;
    return typeof value.id === "string" && value.id.length > 0 ? value.id : key;
  }
  return inferred;
}

function compareAttributes(a: AttributeRecord, b: AttributeRecord, nodeIndex: Map<string, number>): number {
  if (a.ownerKind !== b.ownerKind) return a.ownerKind === "node" ? -1 : 1;
  const ai = nodeIndex.get(a.ownerId) ?? Number.MAX_SAFE_INTEGER;
  const bi = nodeIndex.get(b.ownerId) ?? Number.MAX_SAFE_INTEGER;
  if (ai !== bi) return ai - bi;
  if (a.ownerId !== b.ownerId) return a.ownerId < b.ownerId ? -1 : 1;
  if (a.key === b.key) return 0;
  return a.key < b.key ? -1 : 1;
}

export function importStateJson(input: unknown): ImportedStateRecords {
  const unstored = new Set<string>();
  const state = unwrapState(input, unstored);
  if (typeof state.rootId !== "string" || state.rootId.length === 0) {
    throw new Error("state_json.rootId must be a string");
  }
  if (!isRecord(state.nodes)) {
    throw new Error("state_json.nodes must be an object");
  }

  const rootId = state.rootId;
  const rawNodes = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(state.nodes)) {
    if (!isRecord(value)) {
      unstored.add("nodes");
      continue;
    }
    rawNodes.set(key, value);
    if (typeof value.id === "string" && value.id !== key) unstored.add("nodes.id");
    else if (value.id !== undefined && typeof value.id !== "string") unstored.add("nodes.id");
  }

  const childLists = new Map<string, string[]>();
  for (const [id, raw] of rawNodes) {
    if (!("children" in raw) || raw.children === undefined) continue;
    const children = stringChildIds(raw.children);
    if (!children) {
      unstored.add("nodes.children");
      continue;
    }
    if (children.length > 0) childLists.set(id, children);
  }

  const listed = new Set<string>();
  for (const children of childLists.values()) {
    for (const childId of children) listed.add(childId);
  }
  for (const [id, raw] of rawNodes) {
    if (listed.has(id) || !("parentId" in raw) || raw.parentId === null) continue;
    if (typeof raw.parentId !== "string" || raw.parentId.length === 0) {
      unstored.add("nodes.parentId");
      continue;
    }
    const list = childLists.get(raw.parentId) ?? [];
    list.push(id);
    childLists.set(raw.parentId, list);
    listed.add(id);
  }

  const edges: ParentChildEdgeRecord[] = [];
  const siblingOrderKeys: SiblingOrderKeyRecord[] = [];
  const emittedParents = new Set<string>();
  const emitParent = (parentId: string): void => {
    if (emittedParents.has(parentId)) return;
    emittedParents.add(parentId);
    const children = childLists.get(parentId) ?? [];
    children.forEach((childId, index) => {
      edges.push({ parentId, childId });
      siblingOrderKeys.push({ parentId, childId, orderKey: siblingOrderKey(index, children.length) });
    });
    for (const childId of children) emitParent(childId);
  };
  emitParent(rootId);
  for (const parentId of [...childLists.keys()].sort()) emitParent(parentId);

  const parentOf = new Map<string, string>();
  for (const edge of edges) {
    if (!parentOf.has(edge.childId)) parentOf.set(edge.childId, edge.parentId);
  }

  const orderedIds: string[] = [];
  const seenNodes = new Set<string>();
  const visit = (id: string): void => {
    if (seenNodes.has(id) || !rawNodes.has(id)) return;
    seenNodes.add(id);
    orderedIds.push(id);
    for (const childId of childLists.get(id) ?? []) visit(childId);
  };
  visit(rootId);
  for (const id of [...rawNodes.keys()].sort()) visit(id);

  const attributes: AttributeRecord[] = [];
  const nodes: ImportedNodeRecord[] = [];
  const explicitScopeIds = new Map<string, string>();

  for (const id of orderedIds) {
    const raw = rawNodes.get(id)!;
    const record: ImportedNodeRecord = {
      id,
      text: typeof raw.text === "string" ? raw.text : "",
      isRoot: id === rootId,
      nodeType: typeof raw.nodeType === "string" && raw.nodeType.length > 0 ? raw.nodeType : "text",
      collapsed: raw.collapsed === true,
      details: typeof raw.details === "string" ? raw.details : "",
      note: typeof raw.note === "string" ? raw.note : "",
      link: typeof raw.link === "string" ? raw.link : "",
    };
    if ("text" in raw && raw.text !== undefined && typeof raw.text !== "string") unstored.add("nodes.text");
    if ("nodeType" in raw && raw.nodeType !== undefined && record.nodeType === "text" && raw.nodeType !== "text") {
      unstored.add("nodes.nodeType");
    }
    if ("collapsed" in raw && raw.collapsed !== undefined && typeof raw.collapsed !== "boolean") {
      unstored.add("nodes.collapsed");
    }
    for (const key of ["details", "note", "link"] as const) {
      if (key in raw && raw[key] !== undefined && typeof raw[key] !== "string") unstored.add(`nodes.${key}`);
    }
    if (typeof raw.targetNodeId === "string") record.targetNodeId = raw.targetNodeId;
    else if (raw.targetNodeId !== undefined) unstored.add("nodes.targetNodeId");
    if (typeof raw.aliasLabel === "string") record.aliasLabel = raw.aliasLabel;
    else if (raw.aliasLabel !== undefined) unstored.add("nodes.aliasLabel");
    if (raw.access === "read" || raw.access === "write") record.access = raw.access;
    else if (raw.access !== undefined) unstored.add("nodes.access");
    if (typeof raw.targetSnapshotLabel === "string") record.targetSnapshotLabel = raw.targetSnapshotLabel;
    else if (raw.targetSnapshotLabel !== undefined) unstored.add("nodes.targetSnapshotLabel");
    if (typeof raw.isBroken === "boolean") record.isBroken = raw.isBroken;
    else if (raw.isBroken !== undefined) unstored.add("nodes.isBroken");
    if (typeof raw.scopeId === "string" && raw.scopeId.length > 0) explicitScopeIds.set(id, raw.scopeId);
    else if (raw.scopeId !== undefined) unstored.add("nodes.scopeId");

    takeAttributes("node", id, raw.attributes, attributes, unstored, "nodes.attributes");
    for (const key of Object.keys(raw)) {
      if (STORED_NODE_KEYS.has(key)) continue;
      unstored.add(`nodes.${key}`);
      if (isRecord(raw[key])) walkSchema(raw[key], `nodes.${key}`, unstored, new WeakSet());
      else if (Array.isArray(raw[key])) {
        for (const item of raw[key] as unknown[]) {
          if (isRecord(item)) walkSchema(item, `nodes.${key}`, unstored, new WeakSet());
        }
      }
    }
    nodes.push(record);
  }

  if (isRecord(state.links)) {
    let linkUnstored = false;
    for (const [linkKey, link] of Object.entries(state.links)) {
      if (!isRecord(link)) {
        linkUnstored = true;
        continue;
      }
      const ownerId = typeof link.id === "string" && link.id.length > 0 ? link.id : linkKey;
      takeAttributes("link", ownerId, link.attributes, attributes, unstored, "links.attributes");
      for (const field of Object.keys(link)) {
        if (field === "attributes") continue;
        linkUnstored = true;
        unstored.add(`links.${field}`);
        if (isRecord(link[field])) walkSchema(link[field], `links.${field}`, unstored, new WeakSet());
        else if (Array.isArray(link[field])) {
          for (const item of link[field] as unknown[]) {
            if (isRecord(item)) walkSchema(item, `links.${field}`, unstored, new WeakSet());
          }
        }
      }
    }
    if (linkUnstored) unstored.add("links");
  } else if (state.links !== undefined) {
    unstored.add("links");
  }

  const nodeIndex = new Map(orderedIds.map((id, index) => [id, index]));
  attributes.sort((a, b) => compareAttributes(a, b, nodeIndex));

  const scopeMemberships: ScopeMembershipRecord[] = [];
  const membershipSeen = new Set<string>();
  const addMembership = (scopeId: string, nodeId: string): void => {
    const key = `${scopeId}\0${nodeId}`;
    if (membershipSeen.has(key)) return;
    membershipSeen.add(key);
    scopeMemberships.push({ scopeId, nodeId });
  };
  const scopeRootFor = (nodeId: string): string => {
    let cursor: string | null = nodeId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const raw = rawNodes.get(cursor);
      if (!raw) break;
      if (raw.nodeType === "folder") return cursor;
      cursor = parentOf.get(cursor) ?? null;
    }
    return rootId;
  };
  for (const id of orderedIds) addMembership(recordedScopeId(scopeRootFor(id), state.scopes), id);
  for (const [id, scopeId] of explicitScopeIds) addMembership(scopeId, id);

  if (isRecord(state.scopes)) {
    for (const [key, scope] of Object.entries(state.scopes)) {
      if (!isRecord(scope)) {
        unstored.add("scopes");
        continue;
      }
      const scopeId = typeof scope.id === "string" && scope.id.length > 0 ? scope.id : key;
      if (Array.isArray(scope.rootNodeIds)) {
        for (const nodeId of scope.rootNodeIds) {
          if (typeof nodeId === "string" && nodeId.length > 0) addMembership(scopeId, nodeId);
        }
      } else if (scope.rootNodeIds !== undefined) {
        unstored.add("scopes.rootNodeIds");
      }
      for (const field of Object.keys(scope)) {
        if (field === "id" || field === "rootNodeIds") continue;
        unstored.add(`scopes.${field}`);
        if (isRecord(scope[field])) walkSchema(scope[field], `scopes.${field}`, unstored, new WeakSet());
        else if (Array.isArray(scope[field])) {
          for (const item of scope[field] as unknown[]) {
            if (isRecord(item)) walkSchema(item, `scopes.${field}`, unstored, new WeakSet());
          }
        }
      }
    }
  } else if (state.scopes !== undefined) {
    unstored.add("scopes");
  }

  scopeMemberships.sort((a, b) => {
    const ai = nodeIndex.get(a.nodeId) ?? Number.MAX_SAFE_INTEGER;
    const bi = nodeIndex.get(b.nodeId) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    if (a.nodeId !== b.nodeId) return a.nodeId < b.nodeId ? -1 : 1;
    if (a.scopeId === b.scopeId) return 0;
    return a.scopeId < b.scopeId ? -1 : 1;
  });

  for (const key of Object.keys(state)) {
    if (key === "rootId" || key === "nodes" || key === "links" || key === "scopes") continue;
    unstored.add(key);
    const value = state[key];
    if (!isRecord(value) || !Object.values(value).some((entity) => isRecord(entity))) continue;
    walkIdDictionary(value, key, unstored, new WeakSet());
  }

  return { nodes, edges, siblingOrderKeys, attributes, scopeMemberships, unstored: [...unstored].sort() };
}
