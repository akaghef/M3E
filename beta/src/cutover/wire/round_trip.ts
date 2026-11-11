/**
 * 取込から組み立てへの一周。
 * `importStateJson` が分けた node・親子・兄弟順を、木の不変量と viewer の組み立てへ渡す。
 * 取込が未収納にした項目は捨てない。
 * GraphLink は graphlink、linear-text は linear-text、
 * scope の label と relationIds を含む scope / surface は scope-surface、
 * 配置と Style は layout、annotation は annotation、alias は alias、
 * SavedMap の外側は envelope が戻す。
 * どのモジュールのフィールドでもない未収納は、値を held に残し、組み立てた state へ書き戻す。
 * エンジンは呼ばない。生きている map は読まない。
 */
import { applyCommand, type ApplyRejection } from "../apply/command";
import { aliasRecordsToAppState, toAliasRecords } from "../alias/records";
import { recordAnnotations, restoreAnnotations } from "../annotation/record";
import { assembleSavedMap, type SavedMapDocument, type SavedMapEnvelope } from "../envelope/assemble";
import { graphLinksToRecords, recordsToAppStateLinks } from "../graphlink/records";
import { importStateJson, type AttributeRecord, type ImportedNodeRecord, type ImportedStateRecords, type ScopeMembershipRecord } from "../import-state";
import { applyNodePlacementRecords, applyNodeStyleRecords, layoutRecordsFromAppState } from "../layout/records";
import { fromLinearTextRecords, toLinearTextRecords } from "../linear-text/records";
import { assembleScopeSurface, extractScopeSurfaceRecords } from "../scope-surface/records";
import { childrenInOrder, validateTree, type TreeIssue, type TreeState } from "../tree/invariant";
import { assembleViewerState, type NodeAttributeRecord, type NodeContentRecord, type SiblingOrderRecord } from "../viewer-state/assemble";
import type { AppState, NodeType } from "../../shared/types";

/** ここで定義: HeldField — 取込が値を載せなかった項目と、その値。 */
export interface HeldField {
  readonly name: string;
  readonly value: unknown;
}

/** apply の rename。commandId と baseRevision は applyCommand が判定する。 */
export interface RenameRequest {
  readonly commandId: string;
  readonly nodeId: string;
  readonly text: string;
}

export type RoundTripResult =
  | {
      readonly ok: true;
      readonly state: AppState;
      readonly document: SavedMapDocument<AppState> | null;
      readonly scopeMemberships: readonly ScopeMembershipRecord[];
      readonly held: readonly HeldField[];
      readonly unstored: readonly string[];
      /** viewer が文字列以外の node 属性を受け取れないとき、ここに値を残す。 */
      readonly pendingAttributes: readonly AttributeRecord[];
    }
  | { readonly ok: false; readonly reason: "tree"; readonly issues: readonly TreeIssue[] }
  | { readonly ok: false; readonly reason: "rename"; readonly rejection: ApplyRejection };

const NODE_TYPES = new Set<NodeType>(["text", "image", "folder", "alias"]);
const DICTIONARIES = new Set(["nodes", "links", "scopes", "surfaces", "annotations"]);
const ENVELOPE = new Set(["version", "savedAt", "mapVersion", "tags", "archived", "pinned", "source"]);
const EXACT = new Set([
  "linearNotesByScope",
  "linearTextFontScale",
  "linearPanelWidth",
  "links",
  "scopes",
  "surfaces",
  "annotations",
]);

const OWNED: Readonly<Record<string, ReadonlySet<string>>> = {
  links: new Set(["id", "sourceNodeId", "targetNodeId", "relationType", "label", "direction", "style", "color", "sourcePort", "targetPort", "attributes"]),
  scopes: new Set(["id", "label", "rootNodeIds", "relationIds", "primarySurfaceId"]),
  surfaces: new Set(["id", "scopeId", "kind", "layout", "surfaceView", "nodeViews", "direction", "space", "x", "y", "flowCol", "flowRow", "shape"]),
  annotations: new Set(["id", "kind", "scopeId", "d", "points", "stroke", "strokeWidth", "opacity", "createdAt", "x", "y", "text", "fill", "fontSize", "fontWeight", "variant"]),
};

/** 合成または保存文書を、取込レコードと各モジュールの組み立てで一周させる。 */
export function roundTrip(input: unknown, rename?: RenameRequest): RoundTripResult {
  const imported = importStateJson(input);
  const checked = validateTree(treeFrom(imported));
  if (!checked.ok) return { ok: false, reason: "tree", issues: checked.issues };

  const texts = nodeTexts(imported, rename);
  if (!texts.ok) return { ok: false, reason: "rename", rejection: texts.rejection };

  const parsed = parseInput(input);
  const { wrapper, state: source } = carrierOf(parsed);
  const original = source as unknown as AppState;

  let state = assembleViewerState({
    nodes: imported.nodes.map((node) => contentFrom(node, texts.texts.get(node.id) ?? node.text)),
    edges: imported.edges,
    siblingOrders: siblingOrders(checked.tree),
    attributes: viewerAttributes(imported.attributes),
  });
  state = aliasRecordsToAppState(state, toAliasRecords(state));
  if (original.links !== undefined) {
    state = { ...state, links: recordsToAppStateLinks(graphLinksToRecords(original.links)) };
  }
  state = { ...state, ...fromLinearTextRecords(toLinearTextRecords(original)) };

  const ledger = recordAnnotations(original.annotations);
  if (!ledger.absent) state = { ...state, annotations: restoreAnnotations(ledger) };

  const scopeSurface = assembleScopeSurface(extractScopeSurfaceRecords(original));
  if (scopeSurface.scopes !== undefined) state = { ...state, scopes: scopeSurface.scopes };
  if (scopeSurface.surfaces !== undefined) state = { ...state, surfaces: scopeSurface.surfaces };

  const layout = layoutRecordsFromAppState(original);
  state = applyNodeStyleRecords(state, layout.styles);
  state = applyNodePlacementRecords(state, layout.placements);
  if (scopeSurface.surfaces !== undefined) state = { ...state, surfaces: scopeSurface.surfaces };

  const hasDocument = wrapper !== null && canAssembleEnvelope(wrapper);
  const held = heldFields(imported.unstored, wrapper, source, hasDocument);
  writeHeld(state, held);
  const document = hasDocument && wrapper ? assembleSavedMap(wrapper as unknown as SavedMapEnvelope, state) : null;

  return {
    ok: true,
    state,
    document,
    scopeMemberships: imported.scopeMemberships,
    held,
    unstored: imported.unstored,
    pendingAttributes: pendingNodeAttributes(imported.attributes),
  };
}

function treeFrom(imported: ImportedStateRecords): TreeState {
  return {
    nodeIds: imported.nodes.map((node) => node.id),
    links: imported.siblingOrderKeys.map((row) => ({
      parentId: row.parentId,
      childId: row.childId,
      orderKey: row.orderKey,
    })),
  };
}

function siblingOrders(tree: TreeState): SiblingOrderRecord[] {
  const parents = new Set(tree.links.map((link) => link.parentId));
  const rows: SiblingOrderRecord[] = [];
  for (const parentId of parents) {
    childrenInOrder(tree, parentId).forEach((childId, order) => {
      rows.push({ parentId, childId, order });
    });
  }
  return rows;
}

function nodeTexts(
  imported: ImportedStateRecords,
  rename: RenameRequest | undefined,
): { ok: true; texts: Map<string, string> } | { ok: false; rejection: ApplyRejection } {
  const parentOf = new Map<string, string>();
  for (const edge of imported.edges) {
    if (!parentOf.has(edge.childId)) parentOf.set(edge.childId, edge.parentId);
  }
  const records = imported.nodes.map((node) => ({
    id: node.id,
    text: node.text,
    parentId: node.isRoot ? null : parentOf.get(node.id) ?? null,
  }));
  if (!rename) return { ok: true, texts: new Map(records.map((record) => [record.id, record.text])) };

  const applied = applyCommand(
    { revision: "0", records, appliedCommandIds: [] },
    {
      commandId: rename.commandId,
      baseRevision: "0",
      intent: "rename",
      nodeId: rename.nodeId,
      text: rename.text,
    },
  );
  if (applied.outcome === "rejected") return { ok: false, rejection: applied.reason };
  if (applied.outcome === "ignored") {
    return { ok: true, texts: new Map(records.map((record) => [record.id, record.text])) };
  }
  return { ok: true, texts: new Map(applied.log.records.map((record) => [record.id, record.text])) };
}

function contentFrom(node: ImportedNodeRecord, text: string): NodeContentRecord {
  const record: NodeContentRecord = {
    id: node.id,
    text,
    details: node.details,
    note: node.note,
    link: node.link,
    collapsed: node.collapsed,
  };
  if (NODE_TYPES.has(node.nodeType as NodeType)) record.nodeType = node.nodeType as NodeType;
  if (node.targetNodeId !== undefined) record.targetNodeId = node.targetNodeId;
  if (node.aliasLabel !== undefined) record.aliasLabel = node.aliasLabel;
  if (node.access !== undefined) record.access = node.access;
  if (node.targetSnapshotLabel !== undefined) record.targetSnapshotLabel = node.targetSnapshotLabel;
  if (node.isBroken !== undefined) record.isBroken = node.isBroken;
  return record;
}

function viewerAttributes(attributes: readonly AttributeRecord[]): NodeAttributeRecord[] {
  const records: NodeAttributeRecord[] = [];
  for (const attr of attributes) {
    if (attr.ownerKind !== "node" || typeof attr.value !== "string") continue;
    records.push({ nodeId: attr.ownerId, key: attr.key, value: attr.value });
  }
  return records;
}

function pendingNodeAttributes(attributes: readonly AttributeRecord[]): AttributeRecord[] {
  return attributes.filter((attr) => attr.ownerKind === "node" && typeof attr.value !== "string");
}

function heldFields(
  unstored: readonly string[],
  wrapper: Record<string, unknown> | null,
  state: Record<string, unknown>,
  hasDocument: boolean,
): HeldField[] {
  const held: HeldField[] = [];
  for (const name of unstored) {
    if (isRestored(name, hasDocument)) continue;
    held.push({ name, value: holdValue(name, wrapper, state) });
  }
  return held;
}

function isRestored(name: string, hasDocument: boolean): boolean {
  if (ENVELOPE.has(name) || name.startsWith("source.")) return hasDocument;
  if (EXACT.has(name) || name.startsWith("linearNotesByScope.")) return true;
  for (const [prefix, fields] of Object.entries(OWNED)) {
    if (!name.startsWith(`${prefix}.`)) continue;
    const field = name.slice(prefix.length + 1).split(".")[0] ?? "";
    return fields.has(field);
  }
  return false;
}

function holdValue(name: string, wrapper: Record<string, unknown> | null, state: Record<string, unknown>): unknown {
  if (wrapper && (ENVELOPE.has(name) || name.startsWith("source."))) return cloneValue(readPath(wrapper, name));
  if (!name.includes(".")) return cloneValue(state[name]);
  const [head, ...path] = name.split(".");
  if (head && DICTIONARIES.has(head)) return collectField(state[head], path);
  return cloneValue(readPath(state, name));
}

function collectField(dict: unknown, path: readonly string[]): Record<string, unknown> {
  const collected: Record<string, unknown> = {};
  if (!isRecord(dict) || path.length === 0) return collected;
  const [field, ...rest] = path;
  if (!field) return collected;
  for (const [id, entity] of Object.entries(dict)) {
    if (!isRecord(entity) || !(field in entity)) continue;
    const value = rest.length === 0 ? entity[field] : readPath(entity[field], rest.join("."));
    if (value !== undefined) collected[id] = cloneValue(value);
  }
  return collected;
}

function writeHeld(state: AppState, held: readonly HeldField[]): void {
  const root = state as unknown as Record<string, unknown>;
  for (const field of held) {
    if (!field.name.includes(".")) {
      root[field.name] = cloneValue(field.value);
      continue;
    }
    const [head, prop, extra] = field.name.split(".");
    if (!head || !prop || extra !== undefined || !isRecord(field.value)) continue;
    const table = root[head];
    if (!isRecord(table)) continue;
    for (const [id, value] of Object.entries(field.value)) {
      const entity = table[id];
      if (!isRecord(entity)) continue;
      entity[prop] = cloneValue(value);
    }
  }
}

function canAssembleEnvelope(value: Record<string, unknown>): boolean {
  if (value.version !== 1) return false;
  if (typeof value.savedAt !== "string" || value.savedAt.length === 0) return false;
  if (value.mapVersion !== undefined && (typeof value.mapVersion !== "number" || !Number.isFinite(value.mapVersion))) {
    return false;
  }
  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string")) return false;
  if (typeof value.archived !== "boolean" || typeof value.pinned !== "boolean") return false;
  if (value.source === undefined) return true;
  return isRecord(value.source) && value.source.kind === "obsidian" && typeof value.source.path === "string";
}

function carrierOf(parsed: unknown): { wrapper: Record<string, unknown> | null; state: Record<string, unknown> } {
  if (!isRecord(parsed)) throw new Error("state must be an object");
  if (!isRecord(parsed.nodes) && isRecord(parsed.state) && isRecord(parsed.state.nodes)) {
    return { wrapper: parsed, state: parsed.state };
  }
  return { wrapper: null, state: parsed };
}

function parseInput(input: unknown): unknown {
  if (typeof input === "string") return JSON.parse(input) as unknown;
  return input;
}

function readPath(source: unknown, name: string): unknown {
  let current = source;
  for (const part of name.split(".")) {
    if (!isRecord(current) || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function cloneValue(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
