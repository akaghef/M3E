"use strict";

import neo4j, { type Driver, type QueryResult, type Session } from "neo4j-driver";
import { importStateJson, siblingOrderKey, type ImportedNodeRecord } from "../cutover/import-state";
import { recordAnnotations, restoreAnnotations, type AnnotationRecord } from "../cutover/annotation/record";
import { applyCommand as applyRecordCommand, type ApplyRejection } from "../cutover/apply/command";
import { commandsFromPlan, planWholeState, type Command } from "../cutover/operations";
import { admitToAccount, canWriteScope, type ScopeGrant, type WorkspaceAccount } from "../cutover/scope-permission";
import { graphLinksToRecords, recordsToAppStateLinks, type GraphLinkRecord } from "../cutover/graphlink/records";
import { fromLinearTextRecords, toLinearTextRecords, type LinearTextRecords } from "../cutover/linear-text/records";
import {
  assembleScopeSurface,
  extractScopeSurfaceRecords,
  type ScopeSurfaceRecords,
} from "../cutover/scope-surface/records";
import type { AppState, MapAnnotation, NodeType, SavedMap, TreeNode } from "../shared/types";

/**
 * Persists a beta map as Neo4j records.
 * Node, parent/child, sibling order, and attributes come from import-state.
 * Links come from graphlink. linearNotes come from linear-text.
 * Scope label, rootNodeIds, and relationIds come from scope-surface.
 * import-state leaves those fields unstored; this adapter keeps them.
 * The operation journal is not written here. It stays in memory on the model.
 *
 * ここで定義: syncScopeId は import-state が folder または root から選んだ scope id。
 * TreeNode.scopeId には戻さない。scope 単位の変更読み出しに使う。
 * ここで定義: contentPermission は scope に載る中身の権限。当面 `edit`。
 * workspace の ACL は Workspace.accountId。node には複製しない。
 * ここで定義: touchGeneration は node record の更新世代。saveMap は全 node を 1 に戻す。
 * editNodeText は対象だけ増やす。
 * ここで定義: revision は node 単位の楽観ロック。別 node の revision は進めない。
 * ここで定義: AppliedCommand は適用できた commandId だけを持つ。拒否では作らない。
 * ここで定義: ScopeGrant は canWriteScope に渡す許可。判定は scope-permission に委譲する。
 */

export const NEO4J_TEST_DATABASE = "m3ebetatest";
export const NEO4J_DURABLE_DATABASE = "m3ebeta";

const SEP = "\u001f";

export interface Neo4jMapAddress {
  workspaceId: string;
  accountId: string;
  mapId: string;
}

export interface Neo4jMapStoreOptions {
  uri: string;
  database: string;
  username?: string;
  password?: string;
}

export interface ScopeChangeRecord {
  seq: number;
  mapId: string;
  scopeId: string;
  at: string;
  intent: "assert" | "rename" | "reparent" | "delete" | "set-attribute" | "unset-attribute" | "reorder" | "retarget";
  nodeId: string | null;
  field: string | null;
  previousText: string | null;
  nextText: string | null;
}

export type NodeCommandRejectReason =
  | ApplyRejection
  | "scope-denied"
  | "missing-map"
  | "missing-scope"
  | "unsupported-intent";

export type NodeCommandIntent = "rename" | "assert" | "reparent" | "delete" | "set-attribute" | "unset-attribute" | "reorder" | "retarget";

/** 1 件の command。map 全体の JSON は持たない。 */
export interface NodeCommandSubmit {
  mapId: string;
  actorAccountId: string;
  commandId: string;
  baseRevision: string;
  intent: NodeCommandIntent;
  nodeId: string;
  targetKind?: "node" | "GraphLink" | "annotation" | "linear" | "surface" | "scope";
  scopeId?: string;
  text?: string;
  parentId?: string | null;
  attrKey?: string;
  attrValue?: string;
  childIds?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
}

const GATED_NODE_INTENTS = new Set<NodeCommandIntent>([
  "rename", "assert", "reparent", "delete", "set-attribute", "unset-attribute", "reorder", "retarget",
]);

/** 全体保存が同じ編集を再送したとき、一度だけになる commandId。 */
export function swarmSaveCommandId(intent: string, nodeId: string, baseRevision: string, payload: string): string {
  return `save:${intent}:${stableHash([intent, nodeId, baseRevision, payload])}`;
}

function alignGatedState(guarded: AppState, latest: AppState): void {
  for (const id of Object.keys(guarded.nodes)) {
    if (!latest.nodes[id]) delete guarded.nodes[id];
  }
  for (const [id, live] of Object.entries(latest.nodes)) {
    const node = guarded.nodes[id];
    if (!node) {
      guarded.nodes[id] = JSON.parse(JSON.stringify(live)) as TreeNode;
      continue;
    }
    node.details = live.details;
    node.note = live.note;
    node.link = live.link;
    node.collapsed = live.collapsed;
    node.nodeType = live.nodeType;
    const liveType = (live as TreeNode & { type?: string }).type;
    const guardedType = node as TreeNode & { type?: string };
    if (liveType === undefined) delete guardedType.type;
    else guardedType.type = liveType;
    node.text = live.text;
    node.attributes = { ...live.attributes };
    node.parentId = live.parentId;
    node.children = live.children.slice();
    copyNamedFields(node, live, ["aliasOf", "createdAt", "notes", "updatedAt", "scopeId"]);
  }
  guarded.links = JSON.parse(JSON.stringify(latest.links ?? {})) as AppState["links"];
  copyNamedFields(guarded, latest, ["savedAt", "exportedAt", "sourceDb", "sourceDocSavedAt", "scopeId"]);
  if (latest.annotations) guarded.annotations = JSON.parse(JSON.stringify(latest.annotations)) as AppState["annotations"];
  else delete guarded.annotations;
  if (latest.linearNotesByScope) guarded.linearNotesByScope = { ...latest.linearNotesByScope };
  else delete guarded.linearNotesByScope;
  if (latest.linearTextFontScale !== undefined) guarded.linearTextFontScale = latest.linearTextFontScale;
  else delete guarded.linearTextFontScale;
  if (latest.linearPanelWidth !== undefined) guarded.linearPanelWidth = latest.linearPanelWidth;
  else delete guarded.linearPanelWidth;
  if (latest.scopes) guarded.scopes = JSON.parse(JSON.stringify(latest.scopes)) as AppState["scopes"];
  else delete guarded.scopes;
  if (latest.surfaces) guarded.surfaces = JSON.parse(JSON.stringify(latest.surfaces)) as AppState["surfaces"];
  else delete guarded.surfaces;
}

function stableHash(parts: readonly string[]): string {
  let hash = 2166136261;
  const text = parts.join("\u0000");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface NodeCommandApplied {
  outcome: "applied";
  commandId: string;
  nodeId: string;
  scopeId: string;
  revision: string;
  text: string;
  seq: number;
}

export interface NodeCommandIgnored {
  outcome: "ignored";
  commandId: string;
  nodeId: string;
  scopeId: string;
  revision: string;
  text: string;
}

export interface NodeCommandRejected {
  outcome: "rejected";
  commandId: string;
  reason: NodeCommandRejectReason;
  nodeId?: string;
  scopeId?: string;
  revision?: string;
}

export type NodeCommandResult = NodeCommandApplied | NodeCommandIgnored | NodeCommandRejected;

export interface EdgeRecord {
  parentId: string;
  childId: string;
  orderKey: string;
}

export interface AttributeRecord {
  ownerKind: "node" | "link";
  ownerId: string;
  attrKey: string;
  value: string;
}

interface Runner {
  run(statement: string, params?: Record<string, unknown>): Promise<QueryResult>;
}

const CONSTRAINTS = [
  "CREATE CONSTRAINT m3e_workspace_id IF NOT EXISTS FOR (w:Workspace) REQUIRE w.id IS UNIQUE",
  "CREATE CONSTRAINT m3e_map_id IF NOT EXISTS FOR (m:Map) REQUIRE m.id IS UNIQUE",
  "CREATE CONSTRAINT m3e_node_record IF NOT EXISTS FOR (n:M3eNode) REQUIRE n.recordKey IS UNIQUE",
  "CREATE CONSTRAINT m3e_attribute_record IF NOT EXISTS FOR (a:Attribute) REQUIRE a.recordKey IS UNIQUE",
  "CREATE CONSTRAINT m3e_sync_scope IF NOT EXISTS FOR (s:SyncScope) REQUIRE s.recordKey IS UNIQUE",
  "CREATE CONSTRAINT m3e_journal_record IF NOT EXISTS FOR (j:JournalEntry) REQUIRE j.recordKey IS UNIQUE",
  "CREATE INDEX m3e_journal_scope IF NOT EXISTS FOR (j:JournalEntry) ON (j.mapId, j.scopeId, j.seq)",
  "CREATE CONSTRAINT m3e_applied_command IF NOT EXISTS FOR (c:AppliedCommand) REQUIRE c.recordKey IS UNIQUE",
  "CREATE CONSTRAINT m3e_scope_grant IF NOT EXISTS FOR (g:ScopeGrant) REQUIRE g.recordKey IS UNIQUE",
];

function assertLoopback(uri: string): void {
  let hostname = "";
  try {
    hostname = new URL(uri).hostname;
  } catch {
    throw new Error(`Invalid Neo4j URI: ${uri}`);
  }
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing non-loopback Neo4j URI host ${hostname}.`);
  }
}

function assertId(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0 || value.includes(SEP)) throw new Error(`Invalid ${label}.`);
}

function asNumber(value: unknown, fallback?: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (neo4j.isInt(value)) return value.toNumber();
  if (fallback !== undefined && (value === null || value === undefined)) return fallback;
  throw new Error("Expected a Neo4j number.");
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  throw new Error("Expected a string.");
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  throw new Error("Expected a string or null.");
}

function asRevision(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (neo4j.isInt(value)) return value.toString();
  throw new Error("Expected a node revision.");
}

function commandRecordKey(mapId: string, commandId: string): string {
  return `${mapId}${SEP}command${SEP}${commandId}`;
}

function isAppliedCommandConstraint(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { code?: unknown }).code !== "Neo.ClientError.Schema.ConstraintValidationFailed") return false;
  return error instanceof Error && error.message.includes("AppliedCommand");
}

function scopeGrantsFrom(records: Array<{ scopeId: unknown; capability: unknown }>): ScopeGrant[] {
  const grants: ScopeGrant[] = [];
  for (const record of records) {
    if (typeof record.scopeId !== "string" || record.scopeId.length === 0) continue;
    if (record.capability !== "read" && record.capability !== "write") continue;
    grants.push({ scopeId: record.scopeId, capability: record.capability });
  }
  return grants;
}

function danglingRefName(name: string): boolean {
  return name === "nodes.children" || name === "nodes.parentId"
    || name === "links.sourceNodeId" || name === "links.targetNodeId"
    || name === "scopes.rootNodeIds";
}

function coveredUnstored(name: string): boolean {
  return name === "links" || name.startsWith("links.")
    || name === "linearNotesByScope" || name === "linearTextFontScale" || name === "linearPanelWidth"
    || name === "scopes" || name.startsWith("scopes.")
    || name === "surfaces" || name.startsWith("surfaces.")
    || name === "annotations" || name.startsWith("annotations.")
    || name === "nodes.type"
    || name === "savedAt" || name === "exportedAt" || name === "sourceDb" || name === "sourceDocSavedAt"
    || name === "scopeId" || name === "selectedId"
    || name === "nodes.aliasOf" || name === "nodes.createdAt" || name === "nodes.notes" || name === "nodes.updatedAt"
    || name.startsWith("nodes.notes.");
}

function carriedField(source: object, key: string): { present: boolean; value: string | null } {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return { present: false, value: null };
  const value = (source as Record<string, unknown>)[key];
  if (typeof value === "string" || value === null) return { present: true, value };
  return { present: false, value: null };
}

const NODE_SCALAR_FIELDS: Record<string, { revision: string; assign: string }> = {
  details: { revision: "detailsRevision", assign: "n.details = $attrValue, n.detailsRevision = $next" },
  note: { revision: "noteRevision", assign: "n.note = $attrValue, n.noteRevision = $next" },
  link: { revision: "linkRevision", assign: "n.link = $attrValue, n.linkRevision = $next" },
  collapsed: { revision: "collapsedRevision", assign: "n.collapsed = $flag, n.collapsedRevision = $next" },
  nodeType: { revision: "nodeTypeRevision", assign: "n.nodeType = $attrValue, n.nodeTypeRevision = $next" },
  type: { revision: "typeRevision", assign: "n.typeRevision = $next" },
  aliasOf: { revision: "aliasOfRevision", assign: "n.aliasOf = $stored, n.aliasOfRevision = $next" },
  createdAt: { revision: "createdAtRevision", assign: "n.createdAt = $stored, n.createdAtRevision = $next" },
  notes: { revision: "notesRevision", assign: "n.notes = $stored, n.notesRevision = $next" },
  updatedAt: { revision: "docUpdatedAtRevision", assign: "n.docUpdatedAt = $stored, n.docUpdatedAtRevision = $next" },
  scopeId: { revision: "explicitScopeIdRevision", assign: "n.explicitScopeId = $stored, n.explicitScopeIdRevision = $next" },
};

const DOCUMENT_FIELDS: Record<string, { revision: string; property: string; present: string; stateKey: string }> = {
  savedAt: { revision: "savedAtRevision", property: "documentSavedAt", present: "documentSavedAtPresent", stateKey: "savedAt" },
  exportedAt: { revision: "exportedAtRevision", property: "exportedAt", present: "exportedAtPresent", stateKey: "exportedAt" },
  sourceDb: { revision: "sourceDbRevision", property: "sourceDb", present: "sourceDbPresent", stateKey: "sourceDb" },
  sourceDocSavedAt: { revision: "sourceDocSavedAtRevision", property: "sourceDocSavedAt", present: "sourceDocSavedAtPresent", stateKey: "sourceDocSavedAt" },
  documentScopeId: { revision: "documentScopeIdRevision", property: "documentScopeId", present: "documentScopeIdPresent", stateKey: "scopeId" },
};

const LINK_CHROME_FIELDS = ["direction", "style", "color", "sourcePort", "targetPort", "relationType"] as const;
type LinkChromeField = (typeof LINK_CHROME_FIELDS)[number];
const CARRIED_NODE_FIELDS = ["aliasOf", "createdAt", "notes", "updatedAt", "scopeId"] as const;
const ABSENT_TOKEN = "\u0000";

function linkChromeField(key: string | undefined): LinkChromeField | null {
  return LINK_CHROME_FIELDS.find((field) => field === key) ?? null;
}

function carriedToken(source: object, key: string): string | undefined {
  const field = carriedField(source, key);
  if (!field.present) return undefined;
  return field.value === null ? ABSENT_TOKEN : field.value;
}

function storedToken(token: string | undefined): string | null {
  if (token === undefined || token === ABSENT_TOKEN) return null;
  return token;
}

export function annotationToken(annotation: MapAnnotation): string {
  if (annotation.kind === "pen") {
    return JSON.stringify({
      kind: "pen",
      d: annotation.d,
      points: annotation.points,
      stroke: annotation.stroke,
      strokeWidth: annotation.strokeWidth,
      opacity: annotation.opacity ?? null,
      scopeId: annotation.scopeId ?? null,
      createdAt: annotation.createdAt ?? null,
    });
  }
  return JSON.stringify({
    kind: "text",
    text: annotation.text,
    x: annotation.x,
    y: annotation.y,
    fill: annotation.fill,
    fontSize: annotation.fontSize,
    fontWeight: annotation.fontWeight ?? null,
    variant: annotation.variant ?? null,
    scopeId: annotation.scopeId ?? null,
    createdAt: annotation.createdAt ?? null,
  });
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function copyNamedFields(target: object, source: object, keys: readonly string[]): void {
  const to = target as Record<string, unknown>;
  const from = source as Record<string, unknown>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(from, key)) to[key] = from[key];
    else delete to[key];
  }
}

function restoreCarriedState(state: AppState, mapProps: Record<string, unknown>): void {
  const target = state as AppState & Record<string, string | null>;
  const assign = (stateKey: string, presentKey: string, valueKey: string) => {
    if (mapProps[presentKey] !== true) return;
    target[stateKey] = typeof mapProps[valueKey] === "string" ? mapProps[valueKey] : null;
  };
  assign("savedAt", "documentSavedAtPresent", "documentSavedAt");
  assign("exportedAt", "exportedAtPresent", "exportedAt");
  assign("sourceDb", "sourceDbPresent", "sourceDb");
  assign("sourceDocSavedAt", "sourceDocSavedAtPresent", "sourceDocSavedAt");
  assign("scopeId", "documentScopeIdPresent", "documentScopeId");
}

/** ここで定義: NodeTypeRecord は import-state が未収納の node.type 文字列。nodeType とは別レコード。 */
function nodeTypeRows(state: AppState, mapId: string): Array<{ recordKey: string; nodeId: string; type: string }> {
  const rows: Array<{ recordKey: string; nodeId: string; type: string }> = [];
  for (const node of Object.values(state.nodes)) {
    const value = (node as TreeNode & { type?: unknown }).type;
    if (typeof value !== "string") continue;
    rows.push({ recordKey: `${mapId}${SEP}node-type${SEP}${node.id}`, nodeId: node.id, type: value });
  }
  return rows;
}

function syncScopeId(
  nodeId: string,
  parentOf: Map<string, string>,
  nodeType: Map<string, string>,
  rootId: string,
  scopes: AppState["scopes"],
): string {
  let scopeRoot = rootId;
  let cursor: string | null = nodeId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    if (nodeType.get(cursor) === "folder") {
      scopeRoot = cursor;
      break;
    }
    cursor = parentOf.get(cursor) ?? null;
  }
  const inferred = `scope:${scopeRoot}`;
  const direct = scopes?.[inferred];
  if (direct && typeof direct.id === "string" && direct.id.length > 0) return direct.id;
  if (scopes) {
    for (const [key, scope] of Object.entries(scopes)) {
      if (scope.rootNodeIds?.includes(scopeRoot)) {
        return typeof scope.id === "string" && scope.id.length > 0 ? scope.id : key;
      }
    }
  }
  return inferred;
}

function nodeRow(node: ImportedNodeRecord, mapId: string, scopeId: string): Record<string, string | number | boolean> {
  const row: Record<string, string | number | boolean> = {
    recordKey: `${mapId}${SEP}${node.id}`,
    mapId,
    id: node.id,
    text: node.text,
    isRoot: node.isRoot,
    nodeType: node.nodeType,
    collapsed: node.collapsed,
    details: node.details,
    note: node.note,
    link: node.link,
    syncScopeId: scopeId,
    touchGeneration: 1,
  };
  if (node.targetNodeId !== undefined) row.targetNodeId = node.targetNodeId;
  if (node.aliasLabel !== undefined) row.aliasLabel = node.aliasLabel;
  if (node.access !== undefined) row.access = node.access;
  if (node.targetSnapshotLabel !== undefined) row.targetSnapshotLabel = node.targetSnapshotLabel;
  if (node.isBroken !== undefined) row.isBroken = node.isBroken;
  return row;
}

function assertWriteCount(result: QueryResult, expected: number, label: string): void {
  if (result.records.length !== expected) throw new Error(`${label} wrote ${result.records.length} of ${expected}.`);
}

function topologyOf(state: AppState) {
  return {
    nodes: Object.values(state.nodes).map((node) => ({
      id: node.id,
      parentId: node.parentId,
      text: node.text,
      children: node.children,
      ...(Object.keys(node.attributes).length > 0 ? { attributes: node.attributes } : {}),
    })),
    links: Object.values(state.links ?? {}).map((link) => ({
      id: link.id,
      sourceNodeId: link.sourceNodeId,
      targetNodeId: link.targetNodeId,
      ...(link.label !== undefined ? { label: link.label } : {}),
      ...(link.attributes && Object.keys(link.attributes).length > 0 ? { attributes: link.attributes } : {}),
    })),
  };
}

function journalFrom(entry: {
  seq: number;
  mapId: string;
  scopeId: string;
  at: string;
  intent: ScopeChangeRecord["intent"];
  nodeId?: string | null;
  field?: string | null;
  previousText?: string | null;
  nextText?: string | null;
}): ScopeChangeRecord {
  return {
    seq: entry.seq,
    mapId: entry.mapId,
    scopeId: entry.scopeId,
    at: entry.at,
    intent: entry.intent,
    nodeId: entry.nodeId ?? null,
    field: entry.field ?? null,
    previousText: entry.previousText ?? null,
    nextText: entry.nextText ?? null,
  };
}

export class Neo4jMapStore {
  private constructor(
    private readonly driver: Driver,
    private readonly database: string,
  ) {}

  static async open(options: Neo4jMapStoreOptions): Promise<Neo4jMapStore> {
    assertLoopback(options.uri);
    const allowedName = options.database === NEO4J_DURABLE_DATABASE
      ? NEO4J_DURABLE_DATABASE
      : options.database === NEO4J_TEST_DATABASE
        ? NEO4J_TEST_DATABASE
        : "";
    if (!allowedName) {
      throw new Error(`Refusing Neo4j database "${options.database}". Allowed databases are ${NEO4J_TEST_DATABASE} and ${NEO4J_DURABLE_DATABASE}.`);
    }
    const driver = neo4j.driver(options.uri, neo4j.auth.basic(options.username ?? "neo4j", options.password ?? "unused"));
    const session = driver.session({ database: options.database });
    try {
      const listed = await session.run("SHOW DATABASES YIELD name RETURN name");
      const names = listed.records.map((record) => String(record.get("name")));
      const allowed = new Set([allowedName, "system"]);
      if (!names.includes(allowedName) || names.some((name) => !allowed.has(name))) {
        throw new Error(`Refusing Neo4j instance databases [${names.join(", ")}]. Expected only ${allowedName}.`);
      }
      for (const statement of CONSTRAINTS) await session.run(statement);
    } catch (error) {
      await session.close();
      await driver.close();
      throw error;
    }
    await session.close();
    return new Neo4jMapStore(driver, options.database);
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  private async claimEmptyMap(mapId: string, token: string): Promise<"owner" | "exists"> {
    const session = this.session();
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const status = await session.executeWrite(async (tx) => {
          const result = await tx.run(
            `MERGE (m:Map {id: $mapId})
             ON CREATE SET m._creating = true, m._creator = $token
             WITH m, m._creator = $token AS mine
             OPTIONAL MATCH (n:M3eNode {mapId: $mapId})
             RETURN mine AS mine, count(n) AS c`,
            { mapId, token },
          );
          const row = result.records[0]!;
          if (asNumber(row.get("c"), 0) > 0) return "exists";
          if (row.get("mine") === true) return "owner";
          return "wait";
        });
        if (status === "owner" || status === "exists") return status;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return "exists";
    } finally {
      await session.close();
    }
  }

  private async releaseCreate(mapId: string, token: string): Promise<void> {
    const session = this.session();
    try {
      await session.executeWrite((tx) => tx.run(
        "MATCH (m:Map {id: $mapId, _creator: $token}) REMOVE m._creating, m._creator",
        { mapId, token },
      ));
    } finally {
      await session.close();
    }
  }

  /**
   * 初回は record を作る。既存 map の text・属性・追加・親変更・削除は command の採否を通す。
   * 古い全体状態は、採否を通らなかった node text を戻さない。
   */
  async saveMap(input: Neo4jMapAddress & {
    state: AppState;
    nodeBases?: Record<string, string>;
    actorAccountId?: string;
  }): Promise<{ savedAt: string; journal: ScopeChangeRecord[]; commands: NodeCommandResult[] }> {
    assertId(input.workspaceId, "workspace id");
    assertId(input.accountId, "account id");
    assertId(input.mapId, "map id");
    const imported = importStateJson(input.state);
    const uncovered = imported.unstored.filter((name) => !coveredUnstored(name) && !danglingRefName(name));
    if (uncovered.length > 0) {
      throw new Error(`Neo4j persistence cannot store these fields yet: ${uncovered.join(", ")}`);
    }
    const nodeIds = new Set(Object.keys(input.state.nodes ?? {}));
    const links = graphLinksToRecords(input.state.links)
      .filter((link) => nodeIds.has(link.sourceNodeId) && nodeIds.has(link.targetNodeId));
    const linear = toLinearTextRecords(input.state);
    const scopeSurface = extractScopeSurfaceRecords(input.state);
    const savedAt = new Date().toISOString();
    const createToken = `${savedAt}:${Math.random().toString(36).slice(2)}`;
    let existing: AppState | null = null;
    try {
      existing = (await this.loadMap(input.mapId)).state;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "Map not found.") throw error;
    }
    if (existing) {
      const commands = await this.reconcileExisting(input);
      await this.writeSessionSelected(input.mapId, input.state);
      return { savedAt, journal: [], commands };
    }
    const claim = await this.claimEmptyMap(input.mapId, createToken);
    if (claim === "exists") {
      const commands = await this.reconcileExisting(input);
      await this.writeSessionSelected(input.mapId, input.state);
      return { savedAt, journal: [], commands };
    }
    const session = this.session();
    try {
      if (!existing && imported.nodes.length > 800) {
        await this.writeMapInBatches(input, imported, links, linear, scopeSurface, savedAt);
        await this.writeCarried(input.mapId, input.state);
        await this.writeSessionSelected(input.mapId, input.state);
        return { savedAt, journal: [], commands: [] };
      }
      const journal = await session.executeWrite((tx) => this.writeMap(tx, input, imported, links, linear, scopeSurface, savedAt));
      await this.writeCarried(input.mapId, input.state);
      await this.writeSessionSelected(input.mapId, input.state);
      return { savedAt, journal, commands: [] };
    } finally {
      await this.releaseCreate(input.mapId, createToken);
      await session.close();
    }
  }

  async loadMap(mapId: string): Promise<SavedMap> {
    assertId(mapId, "map id");
    const session = this.session();
    try {
      return await session.executeRead((tx) => this.readMap(tx, mapId));
    } finally {
      await session.close();
    }
  }

  async editNodeText(input: {
    mapId: string;
    nodeId: string;
    text: string;
    commandId: string;
    baseRevision: string;
    actorAccountId: string;
    operation?: { operationId: string; before: Record<string, string>; after: Record<string, string>; cursor: number };
  }): Promise<ScopeChangeRecord> {
    const result = await this.submitNodeCommand({
      mapId: input.mapId,
      nodeId: input.nodeId,
      text: input.text,
      commandId: input.commandId,
      baseRevision: input.baseRevision,
      actorAccountId: input.actorAccountId,
      intent: "rename",
    });
    if (result.outcome === "rejected") throw new Error(`Node command rejected: ${result.reason}`);
    if (result.outcome === "applied" && input.operation) {
      await this.recordTextOperation({ mapId: input.mapId, operation: input.operation });
    }
    return journalFrom({
      seq: result.outcome === "applied" ? result.seq : 0,
      mapId: input.mapId,
      scopeId: result.scopeId,
      at: new Date().toISOString(),
      intent: "rename",
      nodeId: input.nodeId,
      field: "text",
      previousText: input.operation?.before[input.nodeId] ?? null,
      nextText: result.text,
    });
  }

  async recordTextOperation(input: {
    mapId: string;
    operation: { operationId: string; before: Record<string, string>; after: Record<string, string>; cursor: number };
  }): Promise<void> {
    const session = this.session();
    try {
      await session.executeWrite((tx) => tx.run(
        `MATCH (m:Map {id: $mapId})
         CREATE (op:TextOperation {
           recordKey: $mapId + ":" + $operationId,
           mapId: $mapId,
           operationId: $operationId,
           seq: $cursor,
           beforeJson: $beforeJson,
           afterJson: $afterJson
         })
         CREATE (m)-[:HAS_TEXT_OPERATION]->(op)
         SET m.textJournalCursor = $cursor`,
        {
          mapId: input.mapId,
          operationId: input.operation.operationId,
          cursor: input.operation.cursor,
          beforeJson: JSON.stringify(input.operation.before),
          afterJson: JSON.stringify(input.operation.after),
        },
      ));
    } finally {
      await session.close();
    }
  }

  async readNodeRevisions(mapId: string): Promise<Record<string, string>> {
    assertId(mapId, "map id");
    const rows = await this.readObjects(
      `MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id AS id, coalesce(n.revision, "0") AS revision
       UNION
       MATCH ()-[g:GRAPH_LINK {mapId: $mapId}]->()
       RETURN g.id AS id, coalesce(g.revision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "details" AS id, coalesce(n.detailsRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "note" AS id, coalesce(n.noteRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "link" AS id, coalesce(n.linkRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "collapsed" AS id, coalesce(n.collapsedRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "nodeType" AS id, coalesce(n.nodeTypeRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "type" AS id, coalesce(n.typeRevision, "0") AS revision
       UNION
       MATCH (a:Annotation {mapId: $mapId})
       RETURN "ann" + $sep + a.id AS id, coalesce(a.revision, "0") AS revision
       UNION
       MATCH (b:LinearBody {mapId: $mapId})
       RETURN "linear" + $sep + b.scopeId AS id, coalesce(b.revision, "0") AS revision
       UNION
       MATCH (m:Map {id: $mapId})
       RETURN "linear" + $sep + "chrome" AS id, coalesce(m.linearChromeRevision, "0") AS revision
       UNION
       MATCH (v:SurfaceNodeView {mapId: $mapId})
       RETURN "view" + $sep + v.surfaceKey + $sep + v.nodeId AS id, coalesce(v.revision, "0") AS revision`,
      { mapId, sep: SEP },
    );
    const extra = await this.readObjects(
      `MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "aliasOf" AS id, coalesce(n.aliasOfRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "createdAt" AS id, coalesce(n.createdAtRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "notes" AS id, coalesce(n.notesRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "updatedAt" AS id, coalesce(n.docUpdatedAtRevision, "0") AS revision
       UNION
       MATCH (n:M3eNode {mapId: $mapId})
       RETURN n.id + $sep + "scopeId" AS id, coalesce(n.explicitScopeIdRevision, "0") AS revision
       UNION
       MATCH (m:Map {id: $mapId})
       MATCH (n:M3eNode {mapId: m.id, id: m.rootNodeId})
       RETURN "doc" + $sep + "savedAt" AS id, coalesce(n.savedAtRevision, "0") AS revision
       UNION
       MATCH (m:Map {id: $mapId})
       MATCH (n:M3eNode {mapId: m.id, id: m.rootNodeId})
       RETURN "doc" + $sep + "exportedAt" AS id, coalesce(n.exportedAtRevision, "0") AS revision
       UNION
       MATCH (m:Map {id: $mapId})
       MATCH (n:M3eNode {mapId: m.id, id: m.rootNodeId})
       RETURN "doc" + $sep + "sourceDb" AS id, coalesce(n.sourceDbRevision, "0") AS revision
       UNION
       MATCH (m:Map {id: $mapId})
       MATCH (n:M3eNode {mapId: m.id, id: m.rootNodeId})
       RETURN "doc" + $sep + "sourceDocSavedAt" AS id, coalesce(n.sourceDocSavedAtRevision, "0") AS revision
       UNION
       MATCH (m:Map {id: $mapId})
       MATCH (n:M3eNode {mapId: m.id, id: m.rootNodeId})
       RETURN "doc" + $sep + "documentScopeId" AS id, coalesce(n.documentScopeIdRevision, "0") AS revision
       UNION
       MATCH ()-[g:GRAPH_LINK {mapId: $mapId}]->()
       RETURN g.id + $sep + "direction" AS id, coalesce(g.directionRevision, "0") AS revision
       UNION
       MATCH ()-[g:GRAPH_LINK {mapId: $mapId}]->()
       RETURN g.id + $sep + "style" AS id, coalesce(g.styleRevision, "0") AS revision
       UNION
       MATCH ()-[g:GRAPH_LINK {mapId: $mapId}]->()
       RETURN g.id + $sep + "color" AS id, coalesce(g.colorRevision, "0") AS revision
       UNION
       MATCH ()-[g:GRAPH_LINK {mapId: $mapId}]->()
       RETURN g.id + $sep + "sourcePort" AS id, coalesce(g.sourcePortRevision, "0") AS revision
       UNION
       MATCH ()-[g:GRAPH_LINK {mapId: $mapId}]->()
       RETURN g.id + $sep + "targetPort" AS id, coalesce(g.targetPortRevision, "0") AS revision
       UNION
       MATCH ()-[g:GRAPH_LINK {mapId: $mapId}]->()
       RETURN g.id + $sep + "relationType" AS id, coalesce(g.relationTypeRevision, "0") AS revision
       UNION
       MATCH (s:SurfaceRecord {mapId: $mapId})
       RETURN "surface" + $sep + s.key + $sep + "kind" AS id, coalesce(s.kindRevision, "0") AS revision
       UNION
       MATCH (s:SurfaceRecord {mapId: $mapId})
       RETURN "surface" + $sep + s.key + $sep + "layout" AS id, coalesce(s.layoutRevision, "0") AS revision
       UNION
       MATCH (s:SurfaceRecord {mapId: $mapId})
       RETURN "surface" + $sep + s.key + $sep + "surfaceView" AS id, coalesce(s.surfaceViewRevision, "0") AS revision
       UNION
       MATCH (v:SurfaceNodeView {mapId: $mapId})
       RETURN "view" + $sep + v.surfaceKey + $sep + v.nodeId + $sep + "flowCol" AS id, coalesce(v.flowColRevision, "0") AS revision
       UNION
       MATCH (v:SurfaceNodeView {mapId: $mapId})
       RETURN "view" + $sep + v.surfaceKey + $sep + v.nodeId + $sep + "flowRow" AS id, coalesce(v.flowRowRevision, "0") AS revision
       UNION
       MATCH (v:SurfaceNodeView {mapId: $mapId})
       RETURN "view" + $sep + v.surfaceKey + $sep + v.nodeId + $sep + "shape" AS id, coalesce(v.shapeRevision, "0") AS revision
       UNION
       MATCH (s:MapScope {mapId: $mapId})
       RETURN "scope" + $sep + s.key + $sep + "label" AS id, coalesce(s.labelRevision, "0") AS revision
       UNION
       MATCH (s:MapScope {mapId: $mapId})
       RETURN "scope" + $sep + s.key + $sep + "roots" AS id, coalesce(s.rootsRevision, "0") AS revision
       UNION
       MATCH (s:MapScope {mapId: $mapId})
       RETURN "scope" + $sep + s.key + $sep + "relations" AS id, coalesce(s.relationsRevision, "0") AS revision
       UNION
       MATCH (s:MapScope {mapId: $mapId})
       RETURN "scope" + $sep + s.key + $sep + "primarySurfaceId" AS id, coalesce(s.primarySurfaceIdRevision, "0") AS revision`,
      { mapId, sep: SEP },
    );
    const revisions: Record<string, string> = {};
    for (const row of [...rows, ...extra]) revisions[asString(row.id)] = asRevision(row.revision);
    return revisions;
  }

  async readScopeChanges(mapId: string, scopeId: string, afterSeq = 0): Promise<ScopeChangeRecord[]> {
    assertId(mapId, "map id");
    assertId(scopeId, "scope id");
    const session = this.session();
    try {
      return await session.executeRead(async (tx) => {
        const result = await tx.run(
          `MATCH (j:JournalEntry {mapId: $mapId, scopeId: $scopeId})
           WHERE j.seq > $afterSeq
           RETURN j.seq AS seq, j.at AS at, j.intent AS intent, j.nodeId AS nodeId,
                  j.field AS field, j.previousText AS previousText, j.nextText AS nextText
           ORDER BY j.seq`,
          { mapId, scopeId, afterSeq },
        );
        return result.records.map((record) => {
          const intent = record.get("intent");
          if (
            intent !== "assert" && intent !== "rename" && intent !== "reparent"
            && intent !== "delete" && intent !== "set-attribute" && intent !== "unset-attribute"
            && intent !== "reorder" && intent !== "retarget"
          ) throw new Error(`Unsupported journal intent: ${String(intent)}`);
          return journalFrom({
            seq: asNumber(record.get("seq")),
            mapId,
            scopeId,
            at: asString(record.get("at")),
            intent,
            nodeId: asNullableString(record.get("nodeId")),
            field: asNullableString(record.get("field")),
            previousText: asNullableString(record.get("previousText")),
            nextText: asNullableString(record.get("nextText")),
          });
        });
      });
    } finally {
      await session.close();
    }
  }

  /**
   * 1 node の改名を、その node record だけへ書く。
   * commandId と revision の採否は apply/command に委譲する。
   * scope の書き権限は canWriteScope に委譲する。workspace のアカウント境界は同期単位にしない。
   * 拒否した commandId は AppliedCommand に残さない。
   */
  async submitNodeCommand(input: NodeCommandSubmit): Promise<NodeCommandResult> {
    assertId(input.mapId, "map id");
    if (!GATED_NODE_INTENTS.has(input.intent)) {
      return { outcome: "rejected", commandId: input.commandId, reason: "unsupported-intent" };
    }
    if (input.commandId === "") return { outcome: "rejected", commandId: "", reason: "empty-command-id" };
    if (input.commandId.includes(SEP)) throw new Error("Invalid command id.");
    if (input.nodeId === "") return { outcome: "rejected", commandId: input.commandId, reason: "empty-node-id" };
    assertId(input.nodeId, "node id");
    if ((input.intent === "rename" || (input.intent === "assert" && input.targetKind !== "GraphLink")) && typeof input.text !== "string") {
      throw new Error("Invalid node text.");
    }
    if (input.intent === "reorder" && typeof input.childIds !== "string") throw new Error("Invalid child order.");
    if ((input.intent === "retarget" || (input.targetKind === "GraphLink" && input.intent === "assert"))
      && (typeof input.sourceNodeId !== "string" || typeof input.targetNodeId !== "string")) {
      throw new Error("Invalid GraphLink endpoints.");
    }
    if ((input.intent === "set-attribute" || input.intent === "unset-attribute") && (typeof input.attrKey !== "string" || input.attrKey.length === 0)) {
      throw new Error("Invalid attribute key.");
    }
    try {
      return await this.writeNodeCommand(input);
    } catch (error) {
      if (!isAppliedCommandConstraint(error)) throw error;
      const ignored = await this.ignoredIfStored(input);
      if (ignored) return ignored;
      throw error;
    }
  }

  /** 呼び出し手が読んだ node revision。無い node は null。 */
  async readNodeClaim(mapId: string, nodeId: string): Promise<{ nodeId: string; revision: string; scopeId: string; text: string } | null> {
    assertId(mapId, "map id");
    assertId(nodeId, "node id");
    const rows = await this.readObjects(
      `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
       RETURN n.id AS nodeId, coalesce(n.revision, "0") AS revision, coalesce(n.syncScopeId, "") AS scopeId, n.text AS text`,
      { mapId, nodeId },
    );
    if (rows.length !== 1) return null;
    const row = rows[0]!;
    return {
      nodeId: asString(row.nodeId),
      revision: asRevision(row.revision),
      scopeId: asString(row.scopeId),
      text: asString(row.text),
    };
  }

  async hasAppliedCommand(mapId: string, commandId: string): Promise<boolean> {
    assertId(mapId, "map id");
    if (commandId === "" || commandId.includes(SEP)) return false;
    const rows = await this.readObjects(
      "MATCH (c:AppliedCommand {recordKey: $recordKey}) RETURN c.commandId AS commandId",
      { recordKey: commandRecordKey(mapId, commandId) },
    );
    return rows.length === 1;
  }

  /**
   * scope 許可を map に置く。アカウント境界は admitToAccount。
   * 許可の中身は後で canWriteScope が読む。ここでは採否を再実装しない。
   */
  async replaceScopeGrants(input: { mapId: string; actorAccountId: string; grants: readonly ScopeGrant[] }): Promise<void> {
    assertId(input.mapId, "map id");
    const grants: ScopeGrant[] = [];
    const seen = new Set<string>();
    for (const grant of input.grants) {
      assertId(grant.scopeId, "scope id");
      if (grant.capability !== "read" && grant.capability !== "write") throw new Error("Invalid scope capability.");
      const key = `${grant.scopeId}${SEP}${grant.capability}`;
      if (seen.has(key)) continue;
      seen.add(key);
      grants.push({ scopeId: grant.scopeId, capability: grant.capability });
    }
    await this.commit(async (tx) => {
      const found = await tx.run(
        `MATCH (m:Map {id: $mapId})
         MATCH (w:Workspace {id: m.workspaceId})
         RETURN w.id AS workspaceId, w.accountId AS accountId`,
        { mapId: input.mapId },
      );
      if (found.records.length !== 1) throw new Error("Map not found.");
      const workspace: WorkspaceAccount = {
        workspaceId: asString(found.records[0]!.get("workspaceId")),
        accountId: asString(found.records[0]!.get("accountId")),
      };
      if (!admitToAccount(input.actorAccountId, workspace)) {
        throw new Error("Workspace account boundary does not match.");
      }
      await tx.run("MATCH (g:ScopeGrant {mapId: $mapId}) DETACH DELETE g", { mapId: input.mapId });
      if (grants.length === 0) return;
      await tx.run(
        `UNWIND $grants AS grant
         CREATE (:ScopeGrant {
           recordKey: $mapId + $sep + "grant" + $sep + grant.scopeId + $sep + grant.capability,
           mapId: $mapId,
           scopeId: grant.scopeId,
           capability: grant.capability
         })`,
        { mapId: input.mapId, grants, sep: SEP },
      );
    });
  }

  async touchGenerations(mapId: string): Promise<Record<string, number>> {
    const rows = await this.readObjects(
      "MATCH (n:M3eNode {mapId: $mapId}) RETURN n.id AS id, n.touchGeneration AS touch",
      { mapId },
    );
    const touches: Record<string, number> = {};
    for (const row of rows) touches[asString(row.id)] = asNumber(row.touch);
    return touches;
  }

  async edgeRecords(mapId: string): Promise<EdgeRecord[]> {
    const rows = await this.readObjects(
      `MATCH (p:M3eNode {mapId: $mapId})-[e:EDGE {mapId: $mapId}]->(c:M3eNode {mapId: $mapId})
       RETURN p.id AS parentId, c.id AS childId, e.orderKey AS orderKey
       ORDER BY p.id, e.orderKey`,
      { mapId },
    );
    return rows.map((row) => ({
      parentId: asString(row.parentId),
      childId: asString(row.childId),
      orderKey: asString(row.orderKey),
    }));
  }

  async attributeRecords(mapId: string): Promise<AttributeRecord[]> {
    const rows = await this.readObjects(
      `MATCH (a:Attribute {mapId: $mapId})
       RETURN a.ownerKind AS ownerKind, a.ownerId AS ownerId, a.attrKey AS attrKey, a.value AS value
       ORDER BY a.ownerKind, a.ownerId, a.attrKey`,
      { mapId },
    );
    return rows.map((row) => {
      if (row.ownerKind !== "node" && row.ownerKind !== "link") throw new Error("Invalid attribute owner.");
      return {
        ownerKind: row.ownerKind,
        ownerId: asString(row.ownerId),
        attrKey: asString(row.attrKey),
        value: asString(row.value),
      };
    });
  }

  async wholeMapBlobPaths(mapId: string): Promise<string[]> {
    const session = this.session();
    try {
      return await session.executeRead(async (tx) => {
        const found: string[] = [];
        const inspect = (label: string, props: Record<string, unknown>, nodeLabel = false) => {
          for (const [key, value] of Object.entries(props)) {
            if (
              key === "stateJson" || key === "state_json" || key === "state" || key === "children"
              || (nodeLabel && (key === "parentId" || key === "accountId"))
            ) found.push(`${label}.${key}`);
            if (typeof value === "string" && value.includes('"rootId"') && value.includes('"nodes"')) {
              found.push(`${label}.${key}:blob`);
            }
          }
        };
        const nodes = await tx.run(
          `MATCH (n) WHERE n.mapId = $mapId OR (n:Map AND n.id = $mapId)
           RETURN labels(n) AS labels, properties(n) AS props`,
          { mapId },
        );
        for (const record of nodes.records) {
          const labels = record.get("labels") as string[];
          inspect(labels.join(":"), record.get("props") as Record<string, unknown>, labels.includes("M3eNode"));
        }
        const rels = await tx.run(
          `MATCH (a)-[r]->(b)
           WHERE a.mapId = $mapId OR b.mapId = $mapId OR r.mapId = $mapId
           RETURN type(r) AS type, properties(r) AS props`,
          { mapId },
        );
        for (const record of rels.records) inspect(String(record.get("type")), record.get("props") as Record<string, unknown>);
        return found;
      });
    } finally {
      await session.close();
    }
  }

  async deleteMap(mapId: string): Promise<void> {
    assertId(mapId, "map id");
    const session = this.session();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run(
          `MATCH (n)
           WHERE n.mapId = $mapId OR (n:Map AND n.id = $mapId)
           DETACH DELETE n`,
          { mapId },
        );
      });
    } finally {
      await session.close();
    }
  }

  async countMaps(mapIds: readonly string[]): Promise<{ mapCount: number; nodeCount: number }> {
    if (mapIds.length === 0) return { mapCount: 0, nodeCount: 0 };
    const rows = await this.readObjects(
      `UNWIND $ids AS id
       MATCH (m:Map {id: id})
       OPTIONAL MATCH (n:M3eNode {mapId: id})
       RETURN count(DISTINCT m) AS mapCount, count(n) AS nodeCount`,
      { ids: [...mapIds] },
    );
    return {
      mapCount: asNumber(rows[0]?.mapCount, 0),
      nodeCount: asNumber(rows[0]?.nodeCount, 0),
    };
  }

  async countWithPrefix(mapIdPrefix: string): Promise<{ mapCount: number; nodeCount: number }> {
    const rows = await this.readObjects(
      `MATCH (m:Map) WHERE m.id STARTS WITH $prefix
       OPTIONAL MATCH (n:M3eNode {mapId: m.id})
       RETURN count(DISTINCT m) AS mapCount, count(n) AS nodeCount`,
      { prefix: mapIdPrefix },
    );
    return {
      mapCount: asNumber(rows[0]?.mapCount, 0),
      nodeCount: asNumber(rows[0]?.nodeCount, 0),
    };
  }

  async hasMap(mapId: string): Promise<boolean> {
    assertId(mapId, "map id");
    const rows = await this.readObjects("MATCH (m:Map {id: $mapId}) RETURN m.id AS id", { mapId });
    return rows.length === 1;
  }

  async edgeElementIds(mapId: string): Promise<string[]> {
    const rows = await this.readObjects(
      `MATCH (:M3eNode {mapId: $mapId})-[e:EDGE {mapId: $mapId}]->(:M3eNode {mapId: $mapId})
       RETURN elementId(e) AS id ORDER BY id`,
      { mapId },
    );
    return rows.map((row) => asString(row.id));
  }

  async loadTextJournal(mapId: string): Promise<{ cursor: number; operations: Array<{ operationId: string; before: Record<string, string>; after: Record<string, string> }> } | null> {
    assertId(mapId, "map id");
    const session = this.session();
    try {
      return await session.executeRead(async (tx) => {
        const map = await tx.run("MATCH (m:Map {id: $mapId}) RETURN m.textJournalCursor AS cursor", { mapId });
        if (map.records.length !== 1) return null;
        const ops = await tx.run(
          `MATCH (op:TextOperation {mapId: $mapId})
           RETURN op.operationId AS operationId, op.seq AS seq, op.beforeJson AS beforeJson, op.afterJson AS afterJson
           ORDER BY op.seq`,
          { mapId },
        );
        if (ops.records.length === 0) return null;
        const cursorValue = map.records[0]!.get("cursor");
        return {
          cursor: cursorValue === null || cursorValue === undefined ? ops.records.length - 1 : asNumber(cursorValue),
          operations: ops.records.map((record) => ({
            operationId: asString(record.get("operationId")),
            before: JSON.parse(asString(record.get("beforeJson"))) as Record<string, string>,
            after: JSON.parse(asString(record.get("afterJson"))) as Record<string, string>,
          })),
        };
      });
    } finally {
      await session.close();
    }
  }

  /** 採否を通った undo だけが text を戻す。command の無い復元は書かない。 */
  async restoreNodeTexts(input: {
    mapId: string;
    cursor: number;
    restores: Array<{ nodeId: string; text: string; commandId: string; baseRevision: string; actorAccountId: string }>;
  }): Promise<NodeCommandResult[]> {
    assertId(input.mapId, "map id");
    const results: NodeCommandResult[] = [];
    for (const restore of input.restores) {
      if (restore.commandId === "" || restore.baseRevision === "") {
        results.push({
          outcome: "rejected",
          commandId: restore.commandId,
          reason: restore.commandId === "" ? "empty-command-id" : "missing-base-revision",
          nodeId: restore.nodeId,
        });
        return results;
      }
      const result = await this.submitNodeCommand({
        mapId: input.mapId,
        actorAccountId: restore.actorAccountId,
        commandId: restore.commandId,
        baseRevision: restore.baseRevision,
        intent: "rename",
        nodeId: restore.nodeId,
        text: restore.text,
      });
      results.push(result);
      if (result.outcome === "rejected") return results;
    }
    const session = this.session();
    try {
      await session.executeWrite((tx) => tx.run(
        "MATCH (m:Map {id: $mapId}) SET m.textJournalCursor = $cursor, m.savedAt = $at",
        { mapId: input.mapId, cursor: input.cursor, at: new Date().toISOString() },
      ));
    } finally {
      await session.close();
    }
    return results;
  }

  private async writeNodeCommand(input: NodeCommandSubmit): Promise<NodeCommandResult> {
    const session = this.session();
    try {
      return await session.executeWrite((tx) => this.applyLockedCommand(tx, input));
    } finally {
      await session.close();
    }
  }

  private async applyLockedCommand(tx: Runner, input: NodeCommandSubmit): Promise<NodeCommandResult> {
    if (input.targetKind === "annotation" || input.targetKind === "linear" || input.targetKind === "surface" || input.targetKind === "scope") {
      return this.applyAuxCommand(tx, input);
    }
    if (input.intent === "retarget" || input.targetKind === "GraphLink") return this.applyLinkCommand(tx, input);
    if (input.intent === "assert") return this.applyAssertCommand(tx, input);
    const recordKey = commandRecordKey(input.mapId, input.commandId);
    const locked = await tx.run(
      `MATCH (m:Map {id: $mapId})
       MATCH (w:Workspace {id: m.workspaceId})
       MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
       SET n._swarmLock = $commandId
       WITH w, n
       OPTIONAL MATCH (c:AppliedCommand {recordKey: $recordKey})
       RETURN w.id AS workspaceId, w.accountId AS accountId,
              coalesce(n.syncScopeId, "") AS scopeId,
              coalesce(n.revision, "0") AS revision,
              coalesce(n.detailsRevision, "0") AS detailsRevision,
              coalesce(n.noteRevision, "0") AS noteRevision,
              coalesce(n.linkRevision, "0") AS linkRevision,
              coalesce(n.collapsedRevision, "0") AS collapsedRevision,
              coalesce(n.nodeTypeRevision, "0") AS nodeTypeRevision,
              coalesce(n.typeRevision, "0") AS typeRevision,
              coalesce(n.aliasOfRevision, "0") AS aliasOfRevision,
              coalesce(n.createdAtRevision, "0") AS createdAtRevision,
              coalesce(n.notesRevision, "0") AS notesRevision,
              coalesce(n.docUpdatedAtRevision, "0") AS docUpdatedAtRevision,
              coalesce(n.explicitScopeIdRevision, "0") AS explicitScopeIdRevision,
              coalesce(n.savedAtRevision, "0") AS savedAtRevision,
              coalesce(n.exportedAtRevision, "0") AS exportedAtRevision,
              coalesce(n.sourceDbRevision, "0") AS sourceDbRevision,
              coalesce(n.sourceDocSavedAtRevision, "0") AS sourceDocSavedAtRevision,
              coalesce(n.documentScopeIdRevision, "0") AS documentScopeIdRevision,
              n.text AS text,
              c.commandId AS appliedId`,
      { mapId: input.mapId, nodeId: input.nodeId, commandId: input.commandId, recordKey },
    );
    if (locked.records.length !== 1) {
      const stored = await tx.run(
        "MATCH (c:AppliedCommand {recordKey: $recordKey}) RETURN c.nodeId AS nodeId, coalesce(c.scopeId, \"\") AS scopeId, coalesce(c.revision, \"0\") AS revision",
        { recordKey },
      );
      if (stored.records.length === 1) {
        const storedRow = stored.records[0]!;
        return {
          outcome: "ignored",
          commandId: input.commandId,
          nodeId: asString(storedRow.get("nodeId")),
          scopeId: asString(storedRow.get("scopeId")),
          revision: asRevision(storedRow.get("revision")),
          text: "",
        };
      }
      return this.missingCommandTarget(tx, input);
    }

    const row = locked.records[0]!;
    const scopeId = asString(row.get("scopeId"));
    const scalar = NODE_SCALAR_FIELDS[input.attrKey ?? ""];
    const documentField = DOCUMENT_FIELDS[input.attrKey ?? ""];
    const revision = scalar
      ? asRevision(row.get(scalar.revision))
      : documentField
        ? asRevision(row.get(documentField.revision))
        : asRevision(row.get("revision"));
    const text = asString(row.get("text"));
    const appliedId = row.get("appliedId");
    const workspace: WorkspaceAccount = {
      workspaceId: asString(row.get("workspaceId")),
      accountId: asString(row.get("accountId")),
    };
    const grantRows = await tx.run(
      "MATCH (g:ScopeGrant {mapId: $mapId}) RETURN g.scopeId AS scopeId, g.capability AS capability",
      { mapId: input.mapId },
    );
    const grants = scopeGrantsFrom(grantRows.records.map((record) => ({
      scopeId: record.get("scopeId"),
      capability: record.get("capability"),
    })));
    if (!canWriteScope(input.actorAccountId, workspace, grants, scopeId)) {
      await this.clearSwarmLock(tx, input.mapId, input.nodeId);
      return { outcome: "rejected", commandId: input.commandId, reason: "scope-denied", nodeId: input.nodeId, scopeId, revision };
    }

    const decision = await this.gateNodeCommand(tx, input, revision, text, appliedId);
    if (decision.outcome === "ignored") {
      await this.clearSwarmLock(tx, input.mapId, input.nodeId);
      const kept = decision.log.records.find((item) => item.id === input.nodeId);
      return {
        outcome: "ignored",
        commandId: input.commandId,
        nodeId: input.nodeId,
        scopeId,
        revision: decision.log.revision,
        text: kept?.text ?? text,
      };
    }
    if (decision.outcome === "rejected") {
      await this.clearSwarmLock(tx, input.mapId, input.nodeId);
      return {
        outcome: "rejected",
        commandId: input.commandId,
        reason: decision.reason,
        nodeId: input.nodeId,
        scopeId,
        revision: decision.log.revision,
      };
    }
    if (input.intent !== "rename") {
      return this.commitStructural(tx, input, scopeId, revision, decision.log.revision, text);
    }

    const scopeLocked = await tx.run(
      `MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
       SET s._scopeLock = $commandId
       RETURN s.id AS id`,
      { mapId: input.mapId, scopeId, commandId: input.commandId },
    );
    if (scopeLocked.records.length !== 1) {
      await this.clearSwarmLock(tx, input.mapId, input.nodeId);
      return { outcome: "rejected", commandId: input.commandId, reason: "missing-scope", nodeId: input.nodeId, scopeId, revision };
    }
    const allocated = await tx.run(
      `MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
       WHERE s._scopeLock = $commandId
       OPTIONAL MATCH (j:JournalEntry {mapId: $mapId, scopeId: s.id})
       WITH s, toInteger(
         CASE
           WHEN toInteger(coalesce(s.changeSeq, 0)) > toInteger(coalesce(max(j.seq), 0)) THEN coalesce(s.changeSeq, 0)
           ELSE coalesce(max(j.seq), 0)
         END
       ) + 1 AS seq
       SET s.changeSeq = seq
       RETURN seq AS seq`,
      { mapId: input.mapId, scopeId, commandId: input.commandId },
    );
    if (allocated.records.length !== 1) {
      await this.clearSwarmLock(tx, input.mapId, input.nodeId);
      await this.clearScopeLock(tx, input.mapId, scopeId);
      return { outcome: "rejected", commandId: input.commandId, reason: "missing-scope", nodeId: input.nodeId, scopeId, revision };
    }
    const seq = asNumber(allocated.records[0]!.get("seq"));
    const written = await tx.run(
      `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
       MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
       MATCH (m:Map {id: $mapId})
       WHERE n._swarmLock = $commandId
         AND s._scopeLock = $commandId
         AND coalesce(n.revision, "0") = $baseRevision
         AND NOT EXISTS { MATCH (c:AppliedCommand {recordKey: $recordKey}) }
       SET n.text = $text,
           n.revision = $next,
           n.touchGeneration = coalesce(n.touchGeneration, 0) + 1,
           n.updatedAt = $at,
           m.savedAt = $at
       REMOVE n._swarmLock, s._scopeLock
       CREATE (c:AppliedCommand {
         recordKey: $recordKey,
         mapId: $mapId,
         commandId: $commandId,
         nodeId: $nodeId,
         scopeId: s.id,
         revision: $next
       })
       CREATE (entry:JournalEntry {
         recordKey: $journalKey,
         mapId: $mapId,
         scopeId: s.id,
         seq: $seq,
         at: $at,
         intent: "rename",
         nodeId: n.id,
         field: "text",
         previousText: $previousText,
         nextText: $text
       })
       CREATE (m)-[:HAS_JOURNAL]->(entry)
       CREATE (entry)-[:IN_SCOPE]->(s)
       RETURN n.revision AS revision, n.text AS text, s.id AS scopeId, entry.seq AS seq`,
      {
        mapId: input.mapId,
        nodeId: input.nodeId,
        scopeId,
        commandId: input.commandId,
        recordKey,
        baseRevision: revision,
        next: decision.log.revision,
        text: input.text,
        previousText: text,
        at: new Date().toISOString(),
        journalKey: `${input.mapId}${SEP}journal${SEP}${scopeId}${SEP}${seq}`,
        seq: neo4j.int(seq),
      },
    );
    if (written.records.length === 1) {
      const saved = written.records[0]!;
      return {
        outcome: "applied",
        commandId: input.commandId,
        nodeId: input.nodeId,
        scopeId: asString(saved.get("scopeId")),
        revision: asRevision(saved.get("revision")),
        text: asString(saved.get("text")),
        seq: asNumber(saved.get("seq")),
      };
    }
    return this.recoverUnwrittenCommand(tx, input, scopeId);
  }

  private async recoverUnwrittenCommand(
    tx: Runner,
    input: NodeCommandSubmit,
    scopeId: string,
  ): Promise<NodeCommandResult> {
    const found = await tx.run(
      `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
       OPTIONAL MATCH (s:SyncScope {mapId: $mapId, id: n.syncScopeId})
       OPTIONAL MATCH (c:AppliedCommand {recordKey: $recordKey})
       RETURN coalesce(n.revision, "0") AS revision, n.text AS text, s.id AS scopeFound, c.commandId AS appliedId`,
      { mapId: input.mapId, nodeId: input.nodeId, recordKey: commandRecordKey(input.mapId, input.commandId) },
    );
    await this.clearSwarmLock(tx, input.mapId, input.nodeId);
    await this.clearScopeLock(tx, input.mapId, scopeId);
    if (found.records.length !== 1) {
      return { outcome: "rejected", commandId: input.commandId, reason: "missing-node", nodeId: input.nodeId };
    }
    const row = found.records[0]!;
    const revision = asRevision(row.get("revision"));
    if (row.get("scopeFound") === null) {
      return { outcome: "rejected", commandId: input.commandId, reason: "missing-scope", nodeId: input.nodeId, scopeId, revision };
    }
    if (typeof row.get("appliedId") === "string") {
      return {
        outcome: "ignored",
        commandId: input.commandId,
        nodeId: input.nodeId,
        scopeId: asString(row.get("scopeFound")),
        revision,
        text: asString(row.get("text")),
      };
    }
    return { outcome: "rejected", commandId: input.commandId, reason: "stale-revision", nodeId: input.nodeId, scopeId, revision };
  }

  private async missingCommandTarget(tx: Runner, input: NodeCommandSubmit): Promise<NodeCommandResult> {
    const found = await tx.run(
      `OPTIONAL MATCH (m:Map {id: $mapId})
       OPTIONAL MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
       RETURN m.id AS mapId, n.id AS nodeId`,
      { mapId: input.mapId, nodeId: input.nodeId },
    );
    const row = found.records[0];
    if (!row || row.get("mapId") === null) {
      return { outcome: "rejected", commandId: input.commandId, reason: "missing-map" };
    }
    return { outcome: "rejected", commandId: input.commandId, reason: "missing-node", nodeId: input.nodeId };
  }

  private async clearSwarmLock(tx: Runner, mapId: string, nodeId: string): Promise<void> {
    await tx.run(
      "MATCH (n:M3eNode {mapId: $mapId, id: $nodeId}) REMOVE n._swarmLock",
      { mapId, nodeId },
    );
  }

  private async clearScopeLock(tx: Runner, mapId: string, scopeId: string): Promise<void> {
    await tx.run(
      "MATCH (s:SyncScope {mapId: $mapId, id: $scopeId}) REMOVE s._scopeLock",
      { mapId, scopeId },
    );
  }

  private async ignoredIfStored(input: NodeCommandSubmit): Promise<NodeCommandResult | null> {
    const session = this.session();
    try {
      return await session.executeRead(async (tx) => {
        const found = await tx.run(
          `MATCH (c:AppliedCommand {recordKey: $recordKey})
           MATCH (n:M3eNode {mapId: $mapId, id: c.nodeId})
           RETURN c.nodeId AS nodeId, coalesce(n.revision, "0") AS revision, n.text AS text, coalesce(n.syncScopeId, "") AS scopeId`,
          { recordKey: commandRecordKey(input.mapId, input.commandId), mapId: input.mapId },
        );
        if (found.records.length !== 1) return null;
        const row = found.records[0]!;
        return {
          outcome: "ignored",
          commandId: input.commandId,
          nodeId: asString(row.get("nodeId")),
          scopeId: asString(row.get("scopeId")),
          revision: asRevision(row.get("revision")),
          text: asString(row.get("text")),
        };
      });
    } finally {
      await session.close();
    }
  }

  private async gateNodeCommand(
    tx: Runner,
    input: NodeCommandSubmit,
    revision: string,
    text: string,
    appliedId: unknown,
  ): Promise<ReturnType<typeof applyRecordCommand>> {
    const appliedCommandIds = typeof appliedId === "string" ? [input.commandId] : [];
    if (input.intent === "rename" || input.intent === "set-attribute" || input.intent === "unset-attribute" || input.intent === "reorder") {
      return applyRecordCommand(
        { revision, records: [{ id: input.nodeId, text, parentId: null }], appliedCommandIds },
        {
          commandId: input.commandId,
          baseRevision: input.baseRevision,
          intent: "rename",
          nodeId: input.nodeId,
          text: input.intent === "rename" ? input.text ?? "" : text,
        },
      );
    }
    const records = await this.readCommandTopology(tx, input.mapId);
    if (input.intent === "delete") {
      return applyRecordCommand(
        { revision, records, appliedCommandIds },
        { commandId: input.commandId, baseRevision: input.baseRevision, intent: "delete", nodeId: input.nodeId },
      );
    }
    return applyRecordCommand(
      { revision, records, appliedCommandIds },
      {
        commandId: input.commandId,
        baseRevision: input.baseRevision,
        intent: "reparent",
        nodeId: input.nodeId,
        parentId: input.parentId ?? "",
      },
    );
  }

  private async readCommandTopology(tx: Runner, mapId: string): Promise<Array<{ id: string; text: string; parentId: string | null }>> {
    const result = await tx.run(
      `MATCH (n:M3eNode {mapId: $mapId})
       OPTIONAL MATCH (p:M3eNode {mapId: $mapId})-[e:EDGE {mapId: $mapId}]->(n)
       RETURN n.id AS id, n.text AS text, p.id AS parentId`,
      { mapId },
    );
    const byId = new Map<string, { id: string; text: string; parentId: string | null }>();
    for (const record of result.records) {
      const id = asString(record.get("id"));
      if (byId.has(id)) continue;
      const parent = record.get("parentId");
      byId.set(id, { id, text: asString(record.get("text")), parentId: parent === null ? null : asString(parent) });
    }
    return [...byId.values()];
  }

  private async applyAuxCommand(tx: Runner, input: NodeCommandSubmit): Promise<NodeCommandResult> {
    const recordKey = commandRecordKey(input.mapId, input.commandId);
    const map = await tx.run(
      `MATCH (m:Map {id: $mapId})
       MATCH (w:Workspace {id: m.workspaceId})
       OPTIONAL MATCH (c:AppliedCommand {recordKey: $recordKey})
       RETURN w.id AS workspaceId, w.accountId AS accountId, m.rootNodeId AS rootId, c.commandId AS appliedId`,
      { mapId: input.mapId, recordKey },
    );
    if (map.records.length !== 1) return { outcome: "rejected", commandId: input.commandId, reason: "missing-map" };
    const mapRow = map.records[0]!;
    const workspace: WorkspaceAccount = {
      workspaceId: asString(mapRow.get("workspaceId")),
      accountId: asString(mapRow.get("accountId")),
    };
    const rootScope = `scope:${asString(mapRow.get("rootId"))}`;
    const scopeId = input.scopeId || (input.targetKind === "linear" && input.nodeId !== "linear-chrome" ? input.nodeId : rootScope);
    if (typeof mapRow.get("appliedId") === "string") {
      return { outcome: "ignored", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision: input.baseRevision, text: input.text ?? "" };
    }
    const grantRows = await tx.run(
      "MATCH (g:ScopeGrant {mapId: $mapId}) RETURN g.scopeId AS scopeId, g.capability AS capability",
      { mapId: input.mapId },
    );
    const grants = scopeGrantsFrom(grantRows.records.map((record) => ({
      scopeId: record.get("scopeId"),
      capability: record.get("capability"),
    })));
    if (!canWriteScope(input.actorAccountId, workspace, grants, scopeId)) {
      return { outcome: "rejected", commandId: input.commandId, reason: "scope-denied", nodeId: input.nodeId, scopeId };
    }
    const current = await tx.run(this.auxLookup(input), {
      mapId: input.mapId,
      id: input.nodeId,
      viewNode: this.surfaceViewNode(input),
    });
    const currentRow = current.records[0];
    const found = currentRow?.get("found");
    const revision = found === null || found === undefined ? "0" : asRevision(currentRow?.get("revision"));
    const decision = applyRecordCommand(
      { revision, records: [{ id: input.nodeId, text: "", parentId: null }], appliedCommandIds: [] },
      { commandId: input.commandId, baseRevision: input.baseRevision, intent: "rename", nodeId: input.nodeId, text: "" },
    );
    if (decision.outcome !== "applied") {
      return decision.outcome === "ignored"
        ? { outcome: "ignored", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision, text: input.text ?? "" }
        : { outcome: "rejected", commandId: input.commandId, reason: decision.reason, nodeId: input.nodeId, scopeId, revision };
    }
    const seq = await this.allocateScopeSeq(tx, input.mapId, scopeId, input.commandId);
    if (seq === null) return { outcome: "rejected", commandId: input.commandId, reason: "missing-scope", nodeId: input.nodeId, scopeId };
    const at = new Date().toISOString();
    const next = decision.log.revision;
    const common = {
      mapId: input.mapId, id: input.nodeId, scopeId, next, commandId: input.commandId, recordKey,
      journalKey: `${input.mapId}${SEP}journal${SEP}${scopeId}${SEP}${seq}`,
      seq: neo4j.int(seq), at, text: input.text ?? "", baseRevision: revision,
      viewNode: this.surfaceViewNode(input), attrValue: input.attrValue ?? "",
      recordNode: `${input.mapId}${SEP}${input.targetKind}${SEP}${input.nodeId}${SEP}${input.attrKey ?? ""}`,
      sep: SEP,
    };
    const written = await tx.run(this.auxWrite(input), { ...common, ...this.auxParams(input) });
    if (written.records.length !== 1) {
      await this.clearScopeLock(tx, input.mapId, scopeId);
      return { outcome: "rejected", commandId: input.commandId, reason: "stale-revision", nodeId: input.nodeId, scopeId, revision };
    }
    return { outcome: "applied", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision: next, text: input.text ?? "", seq };
  }

  private auxLookup(input: NodeCommandSubmit): string {
    if (input.targetKind === "annotation") {
      return `OPTIONAL MATCH (a:Annotation {mapId: $mapId, id: $id}) RETURN coalesce(a.revision, "0") AS revision, a.id AS found`;
    }
    if (input.targetKind === "scope") {
      const revision = input.attrKey === "roots" ? "rootsRevision"
        : input.attrKey === "relations" ? "relationsRevision"
          : input.attrKey === "primarySurfaceId" ? "primarySurfaceIdRevision"
            : "labelRevision";
      return `OPTIONAL MATCH (s:MapScope {mapId: $mapId, key: $id}) RETURN coalesce(s.${revision}, "0") AS revision, s.key AS found`;
    }
    if (input.targetKind === "linear" && input.nodeId === "linear-chrome") {
      return `MATCH (m:Map {id: $mapId}) RETURN coalesce(m.linearChromeRevision, "0") AS revision, m.id AS found`;
    }
    if (input.targetKind === "linear") {
      return `OPTIONAL MATCH (b:LinearBody {mapId: $mapId, scopeId: $id}) RETURN coalesce(b.revision, "0") AS revision, b.scopeId AS found`;
    }
    if (input.attrKey === "@kind" || input.attrKey === "@layout" || input.attrKey === "@surfaceView") {
      const revision = input.attrKey === "@kind" ? "kindRevision" : input.attrKey === "@layout" ? "layoutRevision" : "surfaceViewRevision";
      return `OPTIONAL MATCH (s:SurfaceRecord {mapId: $mapId, key: $id}) RETURN coalesce(s.${revision}, "0") AS revision, s.key AS found`;
    }
    if (input.attrKey === "@flowCol" || input.attrKey === "@flowRow" || input.attrKey === "@shape") {
      const revision = input.attrKey === "@flowCol" ? "flowColRevision" : input.attrKey === "@flowRow" ? "flowRowRevision" : "shapeRevision";
      return `OPTIONAL MATCH (v:SurfaceNodeView {mapId: $mapId, surfaceKey: $id, nodeId: $viewNode}) RETURN coalesce(v.${revision}, "0") AS revision, v.nodeId AS found`;
    }
    return `OPTIONAL MATCH (v:SurfaceNodeView {mapId: $mapId, surfaceKey: $id, nodeId: $viewNode}) RETURN coalesce(v.revision, "0") AS revision, v.nodeId AS found`;
  }

  private surfaceViewNode(input: NodeCommandSubmit): string {
    if (input.attrKey === "@flowCol" || input.attrKey === "@flowRow" || input.attrKey === "@shape") {
      const parsed = JSON.parse(input.attrValue || "{}") as { nodeId?: string };
      return typeof parsed.nodeId === "string" ? parsed.nodeId : "";
    }
    return input.attrKey ?? "";
  }

  private auxParams(input: NodeCommandSubmit): Record<string, unknown> {
    if (input.targetKind === "annotation" && input.attrKey === "body") {
      const body = JSON.parse(input.attrValue || "{}") as Record<string, unknown>;
      const points = Array.isArray(body.points) ? body.points : [];
      return {
        kind: body.kind === "pen" ? "pen" : "text",
        bodyText: typeof body.text === "string" ? body.text : "",
        x: typeof body.x === "number" ? body.x : null,
        y: typeof body.y === "number" ? body.y : null,
        fill: typeof body.fill === "string" ? body.fill : null,
        fontSize: typeof body.fontSize === "number" ? body.fontSize : null,
        fontWeight: typeof body.fontWeight === "number" ? body.fontWeight : null,
        variant: body.variant === "date" || body.variant === "label" ? body.variant : null,
        annScope: typeof body.scopeId === "string" ? body.scopeId : null,
        createdAt: typeof body.createdAt === "string" ? body.createdAt : null,
        d: typeof body.d === "string" ? body.d : null,
        stroke: typeof body.stroke === "string" ? body.stroke : null,
        strokeWidth: typeof body.strokeWidth === "number" ? body.strokeWidth : null,
        opacity: typeof body.opacity === "number" ? body.opacity : null,
        points: points.map((point, order) => {
          const item = point as { x?: number; y?: number };
          return { order, x: typeof item.x === "number" ? item.x : 0, y: typeof item.y === "number" ? item.y : 0 };
        }),
      };
    }
    if (input.attrKey === "@surfaceView") {
      const view = input.attrValue ? JSON.parse(input.attrValue) as { direction?: string; space?: string } : {};
      return {
        direction: typeof view.direction === "string" ? view.direction : null,
        space: typeof view.space === "string" ? view.space : null,
      };
    }
    if (input.attrKey === "@flowCol" || input.attrKey === "@flowRow") {
      const parsed = JSON.parse(input.attrValue || "{}") as { value?: number | null };
      return { flowValue: typeof parsed.value === "number" ? parsed.value : null };
    }
    if (input.attrKey === "@shape") {
      const parsed = JSON.parse(input.attrValue || "{}") as { value?: string | null };
      return { shapeValue: typeof parsed.value === "string" ? parsed.value : null };
    }
    if (input.targetKind === "scope" && (input.attrKey === "roots" || input.attrKey === "relations")) {
      return { ids: JSON.parse(input.attrValue || "[]") as string[] };
    }
    if (input.targetKind === "scope" && input.attrKey === "primarySurfaceId") {
      return { stored: storedToken(input.attrValue) };
    }
    return {};
  }

  private auxWrite(input: NodeCommandSubmit): string {
    const journal = `
      CREATE (:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: $id, scopeId: $scopeId, revision: $next})
      CREATE (entry:JournalEntry {
        recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
        intent: "${input.intent}", nodeId: $id, field: "${input.targetKind}", previousText: null, nextText: $text
      })
      CREATE (m)-[:HAS_JOURNAL]->(entry)
      CREATE (entry)-[:IN_SCOPE]->(scope)
      SET m.savedAt = $at
      REMOVE scope._scopeLock
      RETURN $next AS revision`;
    if (input.targetKind === "annotation" && input.intent === "delete") {
      return `MATCH (a:Annotation {mapId: $mapId, id: $id})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(a.revision, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        DETACH DELETE a
        WITH scope, m
        ${journal}`;
    }
    if (input.targetKind === "annotation" && input.attrKey === "body" && input.intent === "assert") {
      return `MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (a:Annotation {mapId: $mapId, id: $id}) }
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        CREATE (a:Annotation {recordKey: $recordNode, mapId: $mapId, id: $id, key: $id, revision: $next})
        SET a.kind = $kind, a.text = $bodyText, a.x = $x, a.y = $y, a.fill = $fill, a.fontSize = $fontSize,
            a.fontWeight = $fontWeight, a.variant = $variant, a.scopeId = $annScope, a.createdAt = $createdAt,
            a.d = $d, a.stroke = $stroke, a.strokeWidth = $strokeWidth, a.opacity = $opacity, m.annotationsAbsent = false
        WITH a, scope, m
        FOREACH (point IN $points | CREATE (a)-[:HAS_POINT {order: point.order, x: point.x, y: point.y}]->(a))
        WITH scope, m
        ${journal}`;
    }
    if (input.targetKind === "annotation" && input.attrKey === "body") {
      return `MATCH (a:Annotation {mapId: $mapId, id: $id})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(a.revision, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        SET a.kind = $kind, a.text = $bodyText, a.x = $x, a.y = $y, a.fill = $fill, a.fontSize = $fontSize,
            a.fontWeight = $fontWeight, a.variant = $variant, a.scopeId = $annScope, a.createdAt = $createdAt,
            a.d = $d, a.stroke = $stroke, a.strokeWidth = $strokeWidth, a.opacity = $opacity,
            a.revision = $next, m.annotationsAbsent = false
        WITH a, scope, m
        OPTIONAL MATCH (a)-[p:HAS_POINT]->(a)
        DELETE p
        WITH DISTINCT a, scope, m
        FOREACH (point IN $points | CREATE (a)-[:HAS_POINT {order: point.order, x: point.x, y: point.y}]->(a))
        WITH scope, m
        ${journal}`;
    }
    if (input.targetKind === "scope" && input.attrKey === "primarySurfaceId") {
      return `MATCH (s:MapScope {mapId: $mapId, key: $id})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(s.primarySurfaceIdRevision, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        SET s.primarySurfaceId = $stored, s.primarySurfaceIdRevision = $next
        WITH scope, m
        ${journal}`;
    }
    if (input.targetKind === "scope" && input.attrKey === "label") {
      return `MATCH (s:MapScope {mapId: $mapId, key: $id})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(s.labelRevision, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        SET s.label = $attrValue, s.labelRevision = $next
        WITH scope, m
        ${journal}`;
    }
    if (input.targetKind === "scope" && (input.attrKey === "roots" || input.attrKey === "relations")) {
      const revision = input.attrKey === "roots" ? "rootsRevision" : "relationsRevision";
      const label = input.attrKey === "roots" ? "ScopeRoot" : "ScopeRelation";
      const idField = input.attrKey === "roots" ? "nodeId" : "relationId";
      return `MATCH (s:MapScope {mapId: $mapId, key: $id})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(s.${revision}, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        OPTIONAL MATCH (old:${label} {mapId: $mapId, scopeKey: $id})
        DELETE old
        WITH DISTINCT s, scope, m
        SET s.${revision} = $next
        WITH s, scope, m, $ids AS ids
        FOREACH (order IN range(0, size(ids) - 1) |
          CREATE (:${label} {recordKey: $mapId + $sep + s.key + $sep + toString(order), mapId: $mapId, scopeKey: s.key, ${idField}: ids[order], order: order})
        )
        WITH scope, m
        ${journal}`;
    }
    if (input.attrKey === "@kind" || input.attrKey === "@layout") {
      const property = input.attrKey === "@kind" ? "kind" : "layout";
      return `MATCH (s:SurfaceRecord {mapId: $mapId, key: $id})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(s.${property}Revision, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        SET s.${property} = $attrValue, s.${property}Revision = $next
        WITH scope, m
        ${journal}`;
    }
    if (input.attrKey === "@surfaceView") {
      return `MATCH (s:SurfaceRecord {mapId: $mapId, key: $id})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(s.surfaceViewRevision, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        SET s.direction = $direction, s.space = $space, s.surfaceViewRevision = $next
        WITH scope, m
        ${journal}`;
    }
    if (input.attrKey === "@flowCol" || input.attrKey === "@flowRow" || input.attrKey === "@shape") {
      const property = input.attrKey.slice(1);
      const value = property === "shape" ? "$shapeValue" : "$flowValue";
      return `MATCH (v:SurfaceNodeView {mapId: $mapId, surfaceKey: $id, nodeId: $viewNode})
        MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(v.${property}Revision, "0") = $baseRevision AND scope._scopeLock = $commandId
          AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
        SET v.${property} = ${value}, v.${property}Revision = $next
        WITH scope, m
        ${journal}`;
    }
    if (input.targetKind === "annotation") {
      return `MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        MERGE (a:Annotation {recordKey: $recordNode})
        ON CREATE SET a.mapId = $mapId, a.id = $id, a.key = $id, a.kind = "text", a.x = 1, a.y = 2, a.fill = "#111", a.fontSize = 14, a.scopeId = $scopeId
        SET a.text = $text, a.revision = $next, m.annotationsAbsent = false
        ${journal}`;
    }
    if (input.targetKind === "linear" && input.nodeId === "linear-chrome") {
      const field = input.attrKey === "panelWidth" ? "linearPanelWidth" : "linearTextFontScale";
      return `MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        WHERE coalesce(m.linearChromeRevision, "0") = $baseRevision
        SET m.${field} = toFloat($attrValue), m.linearChromeRevision = $next
        ${journal}`;
    }
    if (input.targetKind === "linear") {
      return `MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
        MERGE (b:LinearBody {recordKey: $recordNode})
        ON CREATE SET b.mapId = $mapId, b.scopeId = $id
        SET b.body = $text, b.revision = $next, m.notesPresent = true
        ${journal}`;
    }
    return `MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
      MERGE (s:SurfaceRecord {recordKey: $mapId + ":surface:" + $id})
      ON CREATE SET s.mapId = $mapId, s.key = $id, s.id = $id, s.scopeId = $scopeId, s.kind = "tree", s.layout = "tree", s.nodeViewsPresent = true
      MERGE (v:SurfaceNodeView {recordKey: $recordNode})
      ON CREATE SET v.mapId = $mapId, v.surfaceKey = $id, v.nodeId = $viewNode
      SET v.x = toFloat(split($attrValue, ",")[0]), v.y = toFloat(split($attrValue, ",")[1]), v.revision = $next, m.surfacesPresent = true
      ${journal}`;
  }

  private async applyLinkCommand(tx: Runner, input: NodeCommandSubmit): Promise<NodeCommandResult> {
    const recordKey = commandRecordKey(input.mapId, input.commandId);
    const chrome = linkChromeField(input.attrKey);
    const looked = await tx.run(
      `MATCH (m:Map {id: $mapId})
       MATCH (w:Workspace {id: m.workspaceId})
       OPTIONAL MATCH (c:AppliedCommand {recordKey: $recordKey})
       OPTIONAL MATCH ()-[g:GRAPH_LINK {mapId: $mapId, id: $linkId}]->()
       RETURN w.id AS workspaceId, w.accountId AS accountId, c.commandId AS appliedId,
              g.id AS linkId, ${chrome ? `coalesce(g.${chrome}Revision, "0")` : `coalesce(g.revision, "0")`} AS revision,
              g.sourceNodeId AS currentSource, g.targetNodeId AS currentTarget`,
      { mapId: input.mapId, linkId: input.nodeId, recordKey },
    );
    if (looked.records.length !== 1) return { outcome: "rejected", commandId: input.commandId, reason: "missing-map" };
    const row = looked.records[0]!;
    const workspace: WorkspaceAccount = {
      workspaceId: asString(row.get("workspaceId")),
      accountId: asString(row.get("accountId")),
    };
    const linkExists = row.get("linkId") !== null;
    const revision = linkExists ? asRevision(row.get("revision")) : "0";
    if (typeof row.get("appliedId") === "string") {
      return {
        outcome: "ignored",
        commandId: input.commandId,
        nodeId: input.nodeId,
        scopeId: "",
        revision,
        text: "",
      };
    }
    const endpointIds = [
      input.sourceNodeId,
      input.targetNodeId,
      linkExists ? asString(row.get("currentSource")) : undefined,
      linkExists ? asString(row.get("currentTarget")) : undefined,
    ].filter((id): id is string => typeof id === "string" && id.length > 0);
    const scopes = await tx.run(
      `UNWIND $ids AS id
       MATCH (n:M3eNode {mapId: $mapId, id: id})
       RETURN n.id AS id, coalesce(n.syncScopeId, "") AS scopeId`,
      { mapId: input.mapId, ids: [...new Set(endpointIds)] },
    );
    if (scopes.records.length !== new Set(endpointIds).size) {
      return { outcome: "rejected", commandId: input.commandId, reason: "missing-node", nodeId: input.nodeId };
    }
    const grantRows = await tx.run(
      "MATCH (g:ScopeGrant {mapId: $mapId}) RETURN g.scopeId AS scopeId, g.capability AS capability",
      { mapId: input.mapId },
    );
    const grants = scopeGrantsFrom(grantRows.records.map((record) => ({
      scopeId: record.get("scopeId"),
      capability: record.get("capability"),
    })));
    const scopeIds = scopes.records.map((record) => asString(record.get("scopeId")));
    if (scopeIds.some((scopeId) => !canWriteScope(input.actorAccountId, workspace, grants, scopeId))) {
      return { outcome: "rejected", commandId: input.commandId, reason: "scope-denied", nodeId: input.nodeId, scopeId: scopeIds[0] ?? "" };
    }
    const decision = applyRecordCommand(
      {
        revision,
        records: [{ id: input.nodeId, text: "", parentId: null }],
        appliedCommandIds: [],
      },
      {
        commandId: input.commandId,
        baseRevision: input.baseRevision,
        intent: "rename",
        nodeId: input.nodeId,
        text: "",
      },
    );
    if (decision.outcome !== "applied") {
      return decision.outcome === "ignored"
        ? { outcome: "ignored", commandId: input.commandId, nodeId: input.nodeId, scopeId: scopeIds[0] ?? "", revision, text: "" }
        : { outcome: "rejected", commandId: input.commandId, reason: decision.reason, nodeId: input.nodeId, scopeId: scopeIds[0] ?? "", revision };
    }
    const scopeId = scopeIds[0] ?? "";
    const seq = await this.allocateScopeSeq(tx, input.mapId, scopeId, input.commandId);
    if (seq === null) return { outcome: "rejected", commandId: input.commandId, reason: "missing-scope", nodeId: input.nodeId, scopeId };
    const at = new Date().toISOString();
    const next = decision.log.revision;
    const journalKey = `${input.mapId}${SEP}journal${SEP}${scopeId}${SEP}${seq}`;
    if (input.intent === "set-attribute" || input.intent === "unset-attribute") {
      if (!linkExists) {
        await this.clearScopeLock(tx, input.mapId, scopeId);
        return { outcome: "rejected", commandId: input.commandId, reason: "missing-node", nodeId: input.nodeId, scopeId, revision };
      }
      const label = input.attrKey === "label";
      const effect = chrome
        ? (input.intent === "unset-attribute"
          ? `REMOVE g.${chrome}`
          : `SET g.${chrome} = $attrValue`)
        : input.intent === "unset-attribute"
          ? (label
            ? "REMOVE g.label"
            : `WITH g, scope, m
             MATCH (a:Attribute {mapId: $mapId, ownerKind: "link", ownerId: $linkId, attrKey: $attrKey})
             DETACH DELETE a
             WITH g, scope, m`)
          : (label
            ? "SET g.label = $attrValue"
            : `MERGE (a:Attribute {recordKey: $attrRecord})
             SET a.mapId = $mapId, a.ownerKind = "link", a.ownerId = $linkId, a.attrKey = $attrKey, a.value = $attrValue
             WITH g, scope, m`);
      const revisionSet = chrome ? `g.${chrome}Revision = $next` : "g.revision = $next";
      const written = await tx.run(
        `MATCH ()-[g:GRAPH_LINK {mapId: $mapId, id: $linkId}]->()
         MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
         WHERE ${chrome ? `coalesce(g.${chrome}Revision, "0")` : `coalesce(g.revision, "0")`} = $baseRevision
           AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
         ${effect}
         SET ${revisionSet}, m.savedAt = $at
         REMOVE scope._scopeLock
         CREATE (:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: $linkId, scopeId: $scopeId, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
           intent: $intent, nodeId: $linkId, field: $attrKey, previousText: null, nextText: $attrValue
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(scope)
         RETURN g.revision AS revision, $scopeId AS scopeId, $seq AS seq`,
        {
          mapId: input.mapId, linkId: input.nodeId, scopeId, baseRevision: revision, next,
          commandId: input.commandId, recordKey, journalKey, seq: neo4j.int(seq), at,
          attrKey: input.attrKey ?? "", attrValue: input.attrValue ?? "", intent: input.intent,
          attrRecord: `${input.mapId}${SEP}link${SEP}${input.nodeId}${SEP}${input.attrKey ?? ""}`,
        },
      );
      if (written.records.length !== 1) {
        await this.clearScopeLock(tx, input.mapId, scopeId);
        return { outcome: "rejected", commandId: input.commandId, reason: "stale-revision", nodeId: input.nodeId, scopeId, revision };
      }
      return { outcome: "applied", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision: next, text: "", seq };
    }
    if (input.intent === "assert") {
      const written = await tx.run(
        `MATCH (s:M3eNode {mapId: $mapId, id: $sourceId}), (t:M3eNode {mapId: $mapId, id: $targetId})
         MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId})
         MATCH (m:Map {id: $mapId})
         WHERE NOT EXISTS { MATCH ()-[existing:GRAPH_LINK {mapId: $mapId, id: $linkId}]->() }
           AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
         CREATE (s)-[:GRAPH_LINK {mapId: $mapId, id: $linkId, linksKey: $linkId, sourceNodeId: $sourceId, targetNodeId: $targetId, revision: $next}]->(t)
         CREATE (:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: $linkId, scopeId: $scopeId, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
           intent: "assert", nodeId: $linkId, field: "link", previousText: null, nextText: $sourceId + "->" + $targetId
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(scope)
         SET m.savedAt = $at
         REMOVE scope._scopeLock
         RETURN $next AS revision, $scopeId AS scopeId, $seq AS seq`,
        {
          mapId: input.mapId, sourceId: input.sourceNodeId, targetId: input.targetNodeId, linkId: input.nodeId,
          scopeId, next, commandId: input.commandId, recordKey, journalKey, seq: neo4j.int(seq), at,
        },
      );
      if (written.records.length !== 1) {
        await this.clearScopeLock(tx, input.mapId, scopeId);
        return { outcome: "rejected", commandId: input.commandId, reason: "duplicate-node", nodeId: input.nodeId, scopeId, revision };
      }
      return { outcome: "applied", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision: next, text: "", seq };
    }
    if (input.intent === "retarget") {
      const written = await tx.run(
        `MATCH ()-[g:GRAPH_LINK {mapId: $mapId, id: $linkId}]->()
         WHERE coalesce(g.revision, "0") = $baseRevision
           AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
         WITH g, properties(g) AS props
         DELETE g
         WITH props
         MATCH (s:M3eNode {mapId: $mapId, id: $sourceId}), (t:M3eNode {mapId: $mapId, id: $targetId})
         MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
         CREATE (s)-[ng:GRAPH_LINK]->(t)
         SET ng = props, ng.sourceNodeId = $sourceId, ng.targetNodeId = $targetId, ng.revision = $next
         CREATE (:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: $linkId, scopeId: $scopeId, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
           intent: "retarget", nodeId: $linkId, field: "endpoints", previousText: null, nextText: $sourceId + "->" + $targetId
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(scope)
         SET m.savedAt = $at
         REMOVE scope._scopeLock
         RETURN ng.revision AS revision, $scopeId AS scopeId, $seq AS seq`,
        {
          mapId: input.mapId, linkId: input.nodeId, sourceId: input.sourceNodeId, targetId: input.targetNodeId,
          baseRevision: revision, next, scopeId, commandId: input.commandId, recordKey, journalKey, seq: neo4j.int(seq), at,
        },
      );
      if (written.records.length !== 1) {
        await this.clearScopeLock(tx, input.mapId, scopeId);
        return { outcome: "rejected", commandId: input.commandId, reason: "stale-revision", nodeId: input.nodeId, scopeId, revision };
      }
      return { outcome: "applied", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision: next, text: "", seq };
    }
    const written = await tx.run(
      `MATCH ()-[g:GRAPH_LINK {mapId: $mapId, id: $linkId}]->()
       WHERE coalesce(g.revision, "0") = $baseRevision
         AND NOT EXISTS { MATCH (:AppliedCommand {recordKey: $recordKey}) }
       MATCH (scope:SyncScope {mapId: $mapId, id: $scopeId}), (m:Map {id: $mapId})
       CREATE (:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: $linkId, scopeId: $scopeId, revision: $next})
       CREATE (entry:JournalEntry {
         recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
         intent: "delete", nodeId: $linkId, field: "link", previousText: null, nextText: null
       })
       CREATE (m)-[:HAS_JOURNAL]->(entry)
       CREATE (entry)-[:IN_SCOPE]->(scope)
       SET m.savedAt = $at
       REMOVE scope._scopeLock
       WITH g, $next AS revision, $scopeId AS scopeId, $seq AS seq
       DELETE g
       RETURN revision, scopeId, seq`,
      {
        mapId: input.mapId, linkId: input.nodeId, baseRevision: revision, next, scopeId,
        commandId: input.commandId, recordKey, journalKey, seq: neo4j.int(seq), at,
      },
    );
    if (written.records.length !== 1) {
      await this.clearScopeLock(tx, input.mapId, scopeId);
      return { outcome: "rejected", commandId: input.commandId, reason: "stale-revision", nodeId: input.nodeId, scopeId, revision };
    }
    return { outcome: "applied", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision: next, text: "", seq };
  }

  private async applyAssertCommand(tx: Runner, input: NodeCommandSubmit): Promise<NodeCommandResult> {
    const recordKey = commandRecordKey(input.mapId, input.commandId);
    const parentId = input.parentId ?? "";
    const looked = await tx.run(
      `MATCH (m:Map {id: $mapId})
       MATCH (w:Workspace {id: m.workspaceId})
       OPTIONAL MATCH (c:AppliedCommand {recordKey: $recordKey})
       OPTIONAL MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
       OPTIONAL MATCH (p:M3eNode {mapId: $mapId, id: $parentId})
       RETURN w.id AS workspaceId, w.accountId AS accountId,
              c.commandId AS appliedId,
              n.id AS existingId, coalesce(n.revision, "0") AS existingRevision, n.text AS existingText, coalesce(n.syncScopeId, "") AS existingScope,
              p.id AS parentFound, coalesce(p.syncScopeId, "") AS parentScope, coalesce(p.nodeType, "text") AS parentType`,
      { mapId: input.mapId, nodeId: input.nodeId, parentId, recordKey },
    );
    if (looked.records.length !== 1) return { outcome: "rejected", commandId: input.commandId, reason: "missing-map" };
    const row = looked.records[0]!;
    if (typeof row.get("appliedId") === "string") {
      return {
        outcome: "ignored",
        commandId: input.commandId,
        nodeId: input.nodeId,
        scopeId: asString(row.get("existingScope")),
        revision: asRevision(row.get("existingRevision")),
        text: asString(row.get("existingText") ?? ""),
      };
    }
    const workspace: WorkspaceAccount = {
      workspaceId: asString(row.get("workspaceId")),
      accountId: asString(row.get("accountId")),
    };
    const scopeId = asString(row.get("parentScope"));
    const grantRows = await tx.run(
      "MATCH (g:ScopeGrant {mapId: $mapId}) RETURN g.scopeId AS scopeId, g.capability AS capability",
      { mapId: input.mapId },
    );
    const grants = scopeGrantsFrom(grantRows.records.map((record) => ({
      scopeId: record.get("scopeId"),
      capability: record.get("capability"),
    })));
    if (!canWriteScope(input.actorAccountId, workspace, grants, scopeId)) {
      return { outcome: "rejected", commandId: input.commandId, reason: "scope-denied", nodeId: input.nodeId, scopeId };
    }
    const existingId = row.get("existingId");
    const revision = existingId === null ? "0" : asRevision(row.get("existingRevision"));
    const parentRecord = row.get("parentFound") === null ? [] : [{ id: parentId, text: "", parentId: null }];
    const records = existingId === null
      ? parentRecord
      : [...parentRecord, { id: input.nodeId, text: asString(row.get("existingText") ?? ""), parentId }];
    const decision = applyRecordCommand(
      { revision, records, appliedCommandIds: [] },
      {
        commandId: input.commandId,
        baseRevision: input.baseRevision,
        intent: "assert",
        nodeId: input.nodeId,
        text: input.text ?? "",
        parentId,
      },
    );
    if (decision.outcome !== "applied") {
      return decision.outcome === "ignored"
        ? { outcome: "ignored", commandId: input.commandId, nodeId: input.nodeId, scopeId, revision, text: input.text ?? "" }
        : { outcome: "rejected", commandId: input.commandId, reason: decision.reason, nodeId: input.nodeId, scopeId, revision };
    }
    const seq = await this.allocateScopeSeq(tx, input.mapId, scopeId, input.commandId);
    if (seq === null) return { outcome: "rejected", commandId: input.commandId, reason: "missing-scope", nodeId: input.nodeId, scopeId };
    const at = new Date().toISOString();
    await tx.run(
      `MATCH (m:Map {id: $mapId})
       MATCH (p:M3eNode {mapId: $mapId, id: $parentId})
       MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
       CREATE (n:M3eNode {
         recordKey: $recordNode, mapId: $mapId, id: $nodeId, text: $text, nodeType: "text",
         collapsed: false, details: "", note: "", link: "", isRoot: false,
         syncScopeId: $scopeId, touchGeneration: 1, revision: $next
       })
       CREATE (m)-[:CONTAINS]->(n)
       CREATE (p)-[:EDGE {mapId: $mapId, orderKey: "a0"}]->(n)
       CREATE (s)-[:MEMBER]->(n)
       CREATE (c:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: $nodeId, scopeId: $scopeId, revision: $next})
       CREATE (entry:JournalEntry {
         recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
         intent: "assert", nodeId: $nodeId, field: "text", previousText: null, nextText: $text
       })
       CREATE (m)-[:HAS_JOURNAL]->(entry)
       CREATE (entry)-[:IN_SCOPE]->(s)
       SET m.savedAt = $at
       REMOVE s._scopeLock`,
      {
        mapId: input.mapId,
        parentId,
        nodeId: input.nodeId,
        scopeId,
        text: input.text ?? "",
        next: decision.log.revision,
        commandId: input.commandId,
        recordKey,
        recordNode: `${input.mapId}${SEP}${input.nodeId}`,
        journalKey: `${input.mapId}${SEP}journal${SEP}${scopeId}${SEP}${seq}`,
        seq: neo4j.int(seq),
        at,
      },
    );
    return {
      outcome: "applied",
      commandId: input.commandId,
      nodeId: input.nodeId,
      scopeId,
      revision: decision.log.revision,
      text: input.text ?? "",
      seq,
    };
  }

  private async commitStructural(
    tx: Runner,
    input: NodeCommandSubmit,
    scopeId: string,
    revision: string,
    next: string,
    previousText: string,
  ): Promise<NodeCommandResult> {
    const seq = await this.allocateScopeSeq(tx, input.mapId, scopeId, input.commandId);
    if (seq === null) {
      await this.clearSwarmLock(tx, input.mapId, input.nodeId);
      return { outcome: "rejected", commandId: input.commandId, reason: "missing-scope", nodeId: input.nodeId, scopeId, revision };
    }
    const at = new Date().toISOString();
    const recordKey = commandRecordKey(input.mapId, input.commandId);
    const common = {
      mapId: input.mapId,
      nodeId: input.nodeId,
      scopeId,
      commandId: input.commandId,
      recordKey,
      baseRevision: revision,
      next,
      at,
      previousText,
      journalKey: `${input.mapId}${SEP}journal${SEP}${scopeId}${SEP}${seq}`,
      seq: neo4j.int(seq),
    };
    if (input.intent === "reorder") {
      const childIds = (input.childIds ?? "").split(",").filter((id) => id.length > 0);
      const pairs = childIds.map((childId, index) => ({ childId, orderKey: siblingOrderKey(index, childIds.length) }));
      const written = await tx.run(
        `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
         MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
         MATCH (m:Map {id: $mapId})
         WHERE n._swarmLock = $commandId AND s._scopeLock = $commandId AND coalesce(n.revision, "0") = $baseRevision
           AND NOT EXISTS { MATCH (c:AppliedCommand {recordKey: $recordKey}) }
         UNWIND $pairs AS pair
         MATCH (n)-[e:EDGE {mapId: $mapId}]->(:M3eNode {mapId: $mapId, id: pair.childId})
         SET e.orderKey = pair.orderKey
         WITH DISTINCT n, s, m
         SET n.revision = $next, n.touchGeneration = coalesce(n.touchGeneration, 0) + 1, n.updatedAt = $at, m.savedAt = $at
         REMOVE n._swarmLock, s._scopeLock
         CREATE (c:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: n.id, scopeId: s.id, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: s.id, seq: $seq, at: $at,
           intent: "reorder", nodeId: n.id, field: "children", previousText: null, nextText: $childIds
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(s)
         RETURN n.revision AS revision, n.text AS text, s.id AS scopeId, entry.seq AS seq`,
        { ...common, pairs, childIds: input.childIds ?? "" },
      );
      if (written.records.length !== 1) return this.recoverUnwrittenCommand(tx, input, scopeId);
      return this.appliedFrom(written, input, previousText);
    }
    const documentField = DOCUMENT_FIELDS[input.attrKey ?? ""];
    if (input.intent === "set-attribute" && documentField) {
      const written = await tx.run(
        `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
         MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
         MATCH (m:Map {id: $mapId})
         WHERE n._swarmLock = $commandId AND s._scopeLock = $commandId
           AND coalesce(n.${documentField.revision}, "0") = $baseRevision
           AND NOT EXISTS { MATCH (c:AppliedCommand {recordKey: $recordKey}) }
         SET n.${documentField.revision} = $next, n.updatedAt = $at, m.savedAt = $at,
             m.${documentField.property} = $stored, m.${documentField.present} = true
         REMOVE n._swarmLock, s._scopeLock
         CREATE (c:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: n.id, scopeId: s.id, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: s.id, seq: $seq, at: $at,
           intent: "set-attribute", nodeId: n.id, field: $attrKey, previousText: null, nextText: $attrValue
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(s)
         RETURN $next AS revision, n.text AS text, s.id AS scopeId, entry.seq AS seq`,
        {
          ...common,
          attrKey: input.attrKey ?? "",
          attrValue: input.attrValue ?? "",
          stored: storedToken(input.attrValue),
        },
      );
      if (written.records.length !== 1) return this.recoverUnwrittenCommand(tx, input, scopeId);
      const applied = this.appliedFrom(written, input, previousText);
      if (applied.outcome === "applied") return { ...applied, revision: next };
      return applied;
    }
    const scalar = NODE_SCALAR_FIELDS[input.attrKey ?? ""];
    if (input.intent === "set-attribute" && scalar) {
      const field = input.attrKey ?? "";
      const typeWrite = field === "type"
        ? `WITH n, s, m
           MERGE (t:NodeTypeRecord {recordKey: $typeKey})
           SET t.mapId = $mapId, t.nodeId = n.id, t.type = $attrValue
           WITH n, s, m`
        : "WITH n, s, m";
      const written = await tx.run(
        `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
         MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
         MATCH (m:Map {id: $mapId})
         WHERE n._swarmLock = $commandId AND s._scopeLock = $commandId
           AND coalesce(n.${scalar.revision}, "0") = $baseRevision
           AND NOT EXISTS { MATCH (c:AppliedCommand {recordKey: $recordKey}) }
         SET ${scalar.assign}, n.updatedAt = $at, m.savedAt = $at
         REMOVE n._swarmLock, s._scopeLock
         ${typeWrite}
         CREATE (c:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: n.id, scopeId: s.id, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: s.id, seq: $seq, at: $at,
           intent: "set-attribute", nodeId: n.id, field: $attrKey, previousText: null, nextText: $attrValue
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(s)
         RETURN $next AS revision, n.text AS text, s.id AS scopeId, entry.seq AS seq`,
        {
          ...common,
          attrKey: field,
          attrValue: input.attrValue ?? "",
          stored: storedToken(input.attrValue),
          flag: input.attrValue === "true",
          typeKey: `${input.mapId}${SEP}node-type${SEP}${input.nodeId}`,
        },
      );
      if (written.records.length !== 1) return this.recoverUnwrittenCommand(tx, input, scopeId);
      const applied = this.appliedFrom(written, input, previousText);
      if (applied.outcome === "applied") return { ...applied, revision: next };
      return applied;
    }
    if (input.intent === "set-attribute" || input.intent === "unset-attribute") {
      const attribute = input.intent === "unset-attribute"
        ? `MATCH (a:Attribute {mapId: $mapId, ownerKind: "node", ownerId: $nodeId, attrKey: $attrKey})
           DETACH DELETE a
           WITH n, s, m`
        : `MERGE (a:Attribute {recordKey: $attrRecord})
           SET a.mapId = $mapId, a.ownerKind = "node", a.ownerId = $nodeId, a.attrKey = $attrKey, a.value = $attrValue
           WITH n, s, m`;
      const written = await tx.run(
        `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
         MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
         MATCH (m:Map {id: $mapId})
         WHERE n._swarmLock = $commandId AND s._scopeLock = $commandId AND coalesce(n.revision, "0") = $baseRevision
           AND NOT EXISTS { MATCH (c:AppliedCommand {recordKey: $recordKey}) }
         SET n.revision = $next, n.touchGeneration = coalesce(n.touchGeneration, 0) + 1, n.updatedAt = $at, m.savedAt = $at
         REMOVE n._swarmLock, s._scopeLock
         WITH n, s, m
         ${attribute}
         CREATE (c:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: n.id, scopeId: s.id, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: s.id, seq: $seq, at: $at,
           intent: $intent, nodeId: n.id, field: $attrKey, previousText: null, nextText: $attrValue
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(s)
         RETURN n.revision AS revision, n.text AS text, s.id AS scopeId, entry.seq AS seq`,
        {
          ...common,
          attrKey: input.attrKey ?? "",
          attrValue: input.attrValue ?? "",
          attrRecord: `${input.mapId}${SEP}node${SEP}${input.nodeId}${SEP}${input.attrKey ?? ""}`,
          intent: input.intent,
        },
      );
      if (written.records.length !== 1) return this.recoverUnwrittenCommand(tx, input, scopeId);
      return this.appliedFrom(written, input, previousText);
    }
    if (input.intent === "reparent") {
      const written = await tx.run(
        `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
         MATCH (p:M3eNode {mapId: $mapId, id: $parentId})
         MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
         MATCH (m:Map {id: $mapId})
         WHERE n._swarmLock = $commandId AND s._scopeLock = $commandId AND coalesce(n.revision, "0") = $baseRevision
           AND NOT EXISTS { MATCH (c:AppliedCommand {recordKey: $recordKey}) }
         OPTIONAL MATCH (:M3eNode {mapId: $mapId})-[e:EDGE {mapId: $mapId}]->(n)
         DELETE e
         CREATE (p)-[:EDGE {mapId: $mapId, orderKey: "a0"}]->(n)
         SET n.revision = $next, n.syncScopeId = p.syncScopeId, n.touchGeneration = coalesce(n.touchGeneration, 0) + 1, n.updatedAt = $at, m.savedAt = $at
         REMOVE n._swarmLock, s._scopeLock
         CREATE (c:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: n.id, scopeId: $scopeId, revision: $next})
         CREATE (entry:JournalEntry {
           recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
           intent: "reparent", nodeId: n.id, field: "parentId", previousText: null, nextText: $parentId
         })
         CREATE (m)-[:HAS_JOURNAL]->(entry)
         CREATE (entry)-[:IN_SCOPE]->(s)
         RETURN n.revision AS revision, n.text AS text, s.id AS scopeId, entry.seq AS seq`,
        { ...common, parentId: input.parentId ?? "" },
      );
      if (written.records.length !== 1) return this.recoverUnwrittenCommand(tx, input, scopeId);
      return this.appliedFrom(written, input, previousText);
    }
    const topology = await this.readCommandTopology(tx, input.mapId);
    const removed = new Set(topology.map((record) => record.id));
    const decision = applyRecordCommand(
      { revision, records: topology, appliedCommandIds: [] },
      { commandId: input.commandId, baseRevision: revision, intent: "delete", nodeId: input.nodeId },
    );
    if (decision.outcome === "applied") {
      for (const record of decision.log.records) removed.delete(record.id);
    }
    const written = await tx.run(
      `MATCH (n:M3eNode {mapId: $mapId, id: $nodeId})
       MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
       MATCH (m:Map {id: $mapId})
       WHERE n._swarmLock = $commandId AND s._scopeLock = $commandId AND coalesce(n.revision, "0") = $baseRevision
         AND NOT EXISTS { MATCH (c:AppliedCommand {recordKey: $recordKey}) }
       REMOVE n._swarmLock, s._scopeLock
       CREATE (c:AppliedCommand {recordKey: $recordKey, mapId: $mapId, commandId: $commandId, nodeId: n.id, scopeId: $scopeId, revision: $next})
       CREATE (entry:JournalEntry {
         recordKey: $journalKey, mapId: $mapId, scopeId: $scopeId, seq: $seq, at: $at,
         intent: "delete", nodeId: n.id, field: "text", previousText: n.text, nextText: null
       })
       CREATE (m)-[:HAS_JOURNAL]->(entry)
       CREATE (entry)-[:IN_SCOPE]->(s)
       SET m.savedAt = $at
       WITH collect(n.id) AS lockedId
       UNWIND $removed AS id
       MATCH (gone:M3eNode {mapId: $mapId, id: id})
       OPTIONAL MATCH (a:Attribute {mapId: $mapId, ownerKind: "node", ownerId: id})
       DETACH DELETE gone, a
       RETURN $next AS revision, $scopeId AS scopeId, $seq AS seq`,
      { ...common, removed: [...removed] },
    );
    if (written.records.length < 1) return this.recoverUnwrittenCommand(tx, input, scopeId);
    return {
      outcome: "applied",
      commandId: input.commandId,
      nodeId: input.nodeId,
      scopeId,
      revision: next,
      text: "",
      seq,
    };
  }

  private appliedFrom(written: QueryResult, input: NodeCommandSubmit, fallbackText: string): NodeCommandResult {
    const saved = written.records[0]!;
    return {
      outcome: "applied",
      commandId: input.commandId,
      nodeId: input.nodeId,
      scopeId: asString(saved.get("scopeId")),
      revision: asRevision(saved.get("revision")),
      text: asString(saved.get("text") ?? fallbackText),
      seq: asNumber(saved.get("seq")),
    };
  }

  private async allocateScopeSeq(tx: Runner, mapId: string, scopeId: string, commandId: string): Promise<number | null> {
    const scopeLocked = await tx.run(
      `MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
       SET s._scopeLock = $commandId
       RETURN s.id AS id`,
      { mapId, scopeId, commandId },
    );
    if (scopeLocked.records.length !== 1) return null;
    const allocated = await tx.run(
      `MATCH (s:SyncScope {mapId: $mapId, id: $scopeId})
       WHERE s._scopeLock = $commandId
       OPTIONAL MATCH (j:JournalEntry {mapId: $mapId, scopeId: s.id})
       WITH s, toInteger(
         CASE
           WHEN toInteger(coalesce(s.changeSeq, 0)) > toInteger(coalesce(max(j.seq), 0)) THEN coalesce(s.changeSeq, 0)
           ELSE coalesce(max(j.seq), 0)
         END
       ) + 1 AS seq
       SET s.changeSeq = seq
       RETURN seq AS seq`,
      { mapId, scopeId, commandId },
    );
    if (allocated.records.length !== 1) return null;
    return asNumber(allocated.records[0]!.get("seq"));
  }

  private async sideCommands(input: Neo4jMapAddress & {
    state: AppState;
    nodeBases?: Record<string, string>;
    actorAccountId?: string;
  }, before: AppState): Promise<NodeCommandResult[]> {
    const actor = input.actorAccountId || input.accountId;
    const bases = input.nodeBases ?? {};
    const commands: NodeCommandResult[] = [];
    const send = (command: NodeCommandSubmit) => this.submitNodeCommand({ ...command, mapId: input.mapId, actorAccountId: actor });
    for (const [id, node] of Object.entries(input.state.nodes)) {
      const prior = before.nodes[id];
      if (!prior) continue;
      for (const field of ["details", "note", "link"] as const) {
        if (prior[field] === node[field]) continue;
        const base = bases[`${id}${SEP}${field}`];
        if (base === undefined) continue;
        commands.push(await send({
          mapId: input.mapId, actorAccountId: actor, baseRevision: base,
          commandId: swarmSaveCommandId(field, id, base, node[field]),
          intent: "set-attribute", nodeId: id, attrKey: field, attrValue: node[field],
        }));
      }
      if (prior.collapsed !== node.collapsed) {
        const base = bases[`${id}${SEP}collapsed`];
        if (base !== undefined) {
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base,
            commandId: swarmSaveCommandId("collapsed", id, base, String(node.collapsed)),
            intent: "set-attribute", nodeId: id, attrKey: "collapsed", attrValue: String(node.collapsed),
          }));
        }
      }
      if ((prior.nodeType ?? "text") !== (node.nodeType ?? "text")) {
        const base = bases[`${id}${SEP}nodeType`];
        if (base !== undefined) {
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base,
            commandId: swarmSaveCommandId("nodeType", id, base, node.nodeType ?? "text"),
            intent: "set-attribute", nodeId: id, attrKey: "nodeType", attrValue: node.nodeType ?? "text",
          }));
        }
      }
      for (const field of CARRIED_NODE_FIELDS) {
        const priorToken = carriedToken(prior, field);
        const nextToken = carriedToken(node, field);
        if (priorToken === nextToken) continue;
        const base = bases[`${id}${SEP}${field}`];
        if (base === undefined && priorToken !== undefined) continue;
        const token = nextToken ?? ABSENT_TOKEN;
        commands.push(await send({
          mapId: input.mapId, actorAccountId: actor, baseRevision: base ?? "0",
          commandId: swarmSaveCommandId(field, id, base ?? "0", token),
          intent: "set-attribute", nodeId: id, attrKey: field, attrValue: token,
        }));
      }
      const priorType = (prior as TreeNode & { type?: string }).type;
      const nextType = (node as TreeNode & { type?: string }).type;
      if (priorType !== nextType && nextType !== undefined) {
        const base = bases[`${id}${SEP}type`];
        if (base !== undefined) {
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base,
            commandId: swarmSaveCommandId("type", id, base, nextType),
            intent: "set-attribute", nodeId: id, attrKey: "type", attrValue: nextType,
          }));
        }
      }
    }
    const beforeNotes = before.linearNotesByScope ?? {};
    const afterNotes = input.state.linearNotesByScope ?? {};
    for (const scopeId of new Set([...Object.keys(beforeNotes), ...Object.keys(afterNotes)])) {
      if (beforeNotes[scopeId] === afterNotes[scopeId]) continue;
      const base = bases[`linear${SEP}${scopeId}`];
      if (base === undefined && beforeNotes[scopeId] !== undefined) continue;
      commands.push(await send({
        mapId: input.mapId, actorAccountId: actor, baseRevision: base ?? "0",
        commandId: swarmSaveCommandId("linear", scopeId, base ?? "0", afterNotes[scopeId] ?? ""),
        intent: beforeNotes[scopeId] === undefined ? "assert" : "rename",
        targetKind: "linear", nodeId: scopeId, scopeId, text: afterNotes[scopeId] ?? "",
      }));
    }
    if (before.linearTextFontScale !== input.state.linearTextFontScale && input.state.linearTextFontScale !== undefined) {
      const base = bases[`linear${SEP}chrome`];
      if (base !== undefined) {
        commands.push(await send({
          mapId: input.mapId, actorAccountId: actor, baseRevision: base,
          commandId: swarmSaveCommandId("font", "linear-chrome", base, String(input.state.linearTextFontScale)),
          intent: "set-attribute", targetKind: "linear", nodeId: "linear-chrome", scopeId: `scope:${before.rootId}`,
          attrKey: "fontScale", attrValue: String(input.state.linearTextFontScale),
        }));
      }
    }
    if (before.linearPanelWidth !== input.state.linearPanelWidth && input.state.linearPanelWidth !== undefined) {
      const base = bases[`linear${SEP}chrome`];
      if (base !== undefined) {
        commands.push(await send({
          mapId: input.mapId, actorAccountId: actor, baseRevision: base,
          commandId: swarmSaveCommandId("panel", "linear-chrome", base, String(input.state.linearPanelWidth)),
          intent: "set-attribute", targetKind: "linear", nodeId: "linear-chrome", scopeId: `scope:${before.rootId}`,
          attrKey: "panelWidth", attrValue: String(input.state.linearPanelWidth),
        }));
      }
    }
    for (const [field, spec] of Object.entries(DOCUMENT_FIELDS)) {
      const prior = carriedField(before, spec.stateKey);
      const next = carriedField(input.state, spec.stateKey);
      if (prior.present === next.present && prior.value === next.value) continue;
      const base = bases[`doc${SEP}${field}`];
      if (base === undefined && prior.present) continue;
      const token = !next.present || next.value === null ? ABSENT_TOKEN : next.value;
      commands.push(await send({
        mapId: input.mapId, actorAccountId: actor, baseRevision: base ?? "0",
        commandId: swarmSaveCommandId(field, before.rootId, base ?? "0", token),
        intent: "set-attribute", nodeId: before.rootId, attrKey: field, attrValue: token,
      }));
    }
    for (const [id, link] of Object.entries(input.state.links ?? {})) {
      const prior = before.links?.[id];
      if (!prior) continue;
      for (const field of LINK_CHROME_FIELDS) {
        if ((prior[field] ?? undefined) === (link[field] ?? undefined)) continue;
        const base = bases[`${id}${SEP}${field}`];
        if (base === undefined && prior[field] !== undefined) continue;
        const next = link[field];
        commands.push(await send({
          mapId: input.mapId, actorAccountId: actor, baseRevision: base ?? "0",
          commandId: swarmSaveCommandId(field, id, base ?? "0", next ?? ""),
          intent: next === undefined ? "unset-attribute" : "set-attribute",
          targetKind: "GraphLink", nodeId: id, attrKey: field, attrValue: next ?? "",
          scopeId: `scope:${before.rootId}`,
        }));
      }
    }
    const beforeAnn = before.annotations ?? {};
    const afterAnn = input.state.annotations ?? {};
    for (const id of new Set([...Object.keys(beforeAnn), ...Object.keys(afterAnn)])) {
      const prior = beforeAnn[id];
      const annotation = afterAnn[id];
      const scopeId = prior?.scopeId || annotation?.scopeId || `scope:${before.rootId}`;
      const base = prior ? bases[`ann${SEP}${id}`] : "0";
      if (base === undefined) continue;
      if (!annotation) {
        commands.push(await send({
          mapId: input.mapId, actorAccountId: actor, baseRevision: base,
          commandId: swarmSaveCommandId("annotation-delete", id, base, ""),
          intent: "delete", targetKind: "annotation", nodeId: id, scopeId, text: "",
        }));
        continue;
      }
      if (prior && annotationToken(prior) === annotationToken(annotation)) continue;
      commands.push(await send({
        mapId: input.mapId, actorAccountId: actor, baseRevision: base,
        commandId: swarmSaveCommandId("annotation-body", id, base, annotationToken(annotation)),
        intent: prior ? "set-attribute" : "assert",
        targetKind: "annotation", nodeId: id, scopeId, text: "", attrKey: "body", attrValue: annotationToken(annotation),
      }));
    }
    for (const [key, scope] of Object.entries(input.state.scopes ?? {})) {
      const prior = before.scopes?.[key];
      if (!prior) continue;
      const scopeId = scope.id || `scope:${before.rootId}`;
      if ((prior.primarySurfaceId ?? undefined) !== (scope.primarySurfaceId ?? undefined)) {
        const base = bases[`scope${SEP}${key}${SEP}primarySurfaceId`];
        if (base !== undefined || prior.primarySurfaceId === undefined) {
          const token = scope.primarySurfaceId ?? ABSENT_TOKEN;
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base ?? "0",
            commandId: swarmSaveCommandId("primarySurfaceId", key, base ?? "0", token),
            intent: "set-attribute", targetKind: "scope", nodeId: key, scopeId, attrKey: "primarySurfaceId", attrValue: token, text: "",
          }));
        }
      }
      if (prior.label !== scope.label) {
        const base = bases[`scope${SEP}${key}${SEP}label`];
        if (base !== undefined) {
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base,
            commandId: swarmSaveCommandId("scope-label", key, base, scope.label),
            intent: "set-attribute", targetKind: "scope", nodeId: key, scopeId, attrKey: "label", attrValue: scope.label, text: "",
          }));
        }
      }
      if (!sameJson(prior.rootNodeIds, scope.rootNodeIds)) {
        const base = bases[`scope${SEP}${key}${SEP}roots`];
        if (base !== undefined) {
          const payload = JSON.stringify(scope.rootNodeIds ?? []);
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base,
            commandId: swarmSaveCommandId("scope-roots", key, base, payload),
            intent: "set-attribute", targetKind: "scope", nodeId: key, scopeId, attrKey: "roots", attrValue: payload, text: "",
          }));
        }
      }
      if (!sameJson(prior.relationIds, scope.relationIds)) {
        const base = bases[`scope${SEP}${key}${SEP}relations`];
        if (base !== undefined) {
          const payload = JSON.stringify(scope.relationIds ?? []);
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base,
            commandId: swarmSaveCommandId("scope-relations", key, base, payload),
            intent: "set-attribute", targetKind: "scope", nodeId: key, scopeId, attrKey: "relations", attrValue: payload, text: "",
          }));
        }
      }
    }
    for (const [surfaceKey, surface] of Object.entries(input.state.surfaces ?? {})) {
      const priorSurface = before.surfaces?.[surfaceKey];
      if (priorSurface) {
        const surfaceFields: Array<["@kind" | "@layout" | "@surfaceView", string, string]> = [];
        if (priorSurface.kind !== surface.kind) surfaceFields.push(["@kind", "kind", surface.kind]);
        if (priorSurface.layout !== surface.layout) surfaceFields.push(["@layout", "layout", surface.layout]);
        if (!sameJson(priorSurface.surfaceView ?? null, surface.surfaceView ?? null)) {
          surfaceFields.push(["@surfaceView", "surfaceView", JSON.stringify(surface.surfaceView ?? null)]);
        }
        for (const [attrKey, name, payload] of surfaceFields) {
          const base = bases[`surface${SEP}${surfaceKey}${SEP}${name}`];
          if (base === undefined) continue;
          commands.push(await send({
            mapId: input.mapId, actorAccountId: actor, baseRevision: base,
            commandId: swarmSaveCommandId(name, surfaceKey, base, payload),
            intent: "set-attribute", targetKind: "surface", nodeId: surfaceKey, scopeId: surface.scopeId,
            attrKey, attrValue: payload, text: "",
          }));
        }
      }
      const priorViews = before.surfaces?.[surfaceKey]?.nodeViews ?? {};
      for (const [nodeId, view] of Object.entries(surface.nodeViews ?? {})) {
        const priorView = priorViews[nodeId];
        if (priorView) {
          for (const field of ["flowCol", "flowRow", "shape"] as const) {
            if (priorView[field] === view[field]) continue;
            const base = bases[`view${SEP}${surfaceKey}${SEP}${nodeId}${SEP}${field}`];
            if (base === undefined) continue;
            const payload = JSON.stringify({ nodeId, value: view[field] ?? null });
            commands.push(await send({
              mapId: input.mapId, actorAccountId: actor, baseRevision: base,
              commandId: swarmSaveCommandId(field, `${surfaceKey}${SEP}${nodeId}`, base, payload),
              intent: "set-attribute", targetKind: "surface", nodeId: surfaceKey, scopeId: surface.scopeId,
              attrKey: `@${field}`, attrValue: payload, text: "",
            }));
          }
        }
      }
      for (const [nodeId, view] of Object.entries(surface.nodeViews ?? {})) {
        const prior = priorViews[nodeId];
        if (prior && prior.x === view.x && prior.y === view.y) continue;
        const key = `view${SEP}${surfaceKey}${SEP}${nodeId}`;
        const base = prior ? bases[key] : "0";
        if (base === undefined) continue;
        commands.push(await send({
          mapId: input.mapId, actorAccountId: actor, baseRevision: base,
          commandId: swarmSaveCommandId("place", key, base, `${view.x ?? ""},${view.y ?? ""}`),
          intent: "set-attribute", targetKind: "surface", nodeId: surfaceKey, scopeId: surface.scopeId,
          attrKey: nodeId, attrValue: `${view.x ?? 0},${view.y ?? 0}`,
        }));
      }
    }
    return commands;
  }

  private async reconcileExisting(input: Neo4jMapAddress & {
    state: AppState;
    nodeBases?: Record<string, string>;
    actorAccountId?: string;
  }): Promise<NodeCommandResult[]> {
    const existing = await this.loadMap(input.mapId);
    const actor = input.actorAccountId || input.accountId;
    const bases = input.nodeBases ?? {};
    const diff = planWholeState(topologyOf(existing.state), topologyOf(input.state));
    const commands: NodeCommandResult[] = [];
    for (const planned of diff.planned) {
      const linkCommand = planned.targetKind === "GraphLink"
        && (planned.intent === "assert" || planned.intent === "delete" || planned.intent === "retarget"
          || planned.intent === "set-attribute" || planned.intent === "unset-attribute");
      const nodeCommand = planned.targetKind === "node" && GATED_NODE_INTENTS.has(planned.intent as NodeCommandIntent);
      if (!linkCommand && !nodeCommand) continue;
      const intent = planned.intent as NodeCommandIntent;
      const base = intent === "assert" ? (bases[planned.targetId] ?? "0") : bases[planned.targetId];
      if (base === undefined) continue;
      const payload = JSON.stringify(planned.payload ?? {});
      commands.push(await this.submitNodeCommand({
        mapId: input.mapId,
        actorAccountId: actor,
        commandId: swarmSaveCommandId(intent, planned.targetId, base, payload),
        baseRevision: base,
        intent,
        nodeId: planned.targetId,
        targetKind: planned.targetKind === "GraphLink" ? "GraphLink" : "node",
        text: planned.payload?.text,
        parentId: planned.payload?.parentId,
        attrKey: planned.payload?.key,
        attrValue: planned.payload?.value,
        childIds: planned.payload?.childIds,
        sourceNodeId: planned.payload?.sourceNodeId,
        targetNodeId: planned.payload?.targetNodeId,
      }));
    }
    commands.push(...await this.sideCommands(input, existing.state));
    const latest = await this.loadMap(input.mapId);
    const guarded = JSON.parse(JSON.stringify(input.state)) as AppState;
    alignGatedState(guarded, latest.state);
    const session = this.session();
    try {
      await session.executeWrite((tx) => this.applyDiff(tx, input.mapId, latest.state, guarded, new Date().toISOString()));
    } finally {
      await session.close();
    }
    return commands;
  }

  private async applyDiff(tx: Runner, mapId: string, before: AppState, after: AppState, savedAt: string): Promise<void> {
    const diff = planWholeState(topologyOf(before), topologyOf(after));
    const commands = commandsFromPlan(`diff:${savedAt}`, savedAt, diff.planned);
    for (const command of commands) await this.applyCommand(tx, mapId, command, after, savedAt);
    await tx.run("MATCH (m:Map {id: $mapId}) SET m.savedAt = $savedAt", { mapId, savedAt });
  }

  private async applyCommand(tx: Runner, mapId: string, command: Command, after: AppState, savedAt: string): Promise<void> {
    if (
      command.intent === "reorder" || command.intent === "retarget"
      || ((command.intent === "assert" || command.intent === "delete") && command.target.kind === "GraphLink")
      || ((command.intent === "set-attribute" || command.intent === "unset-attribute") && command.target.kind === "GraphLink")
    ) return;
    const payload = command.payload ?? {};
    if (command.intent === "rename" && command.target.kind === "node") {
      const written = await tx.run(
        `MATCH (n:M3eNode {mapId: $mapId, id: $id})
         SET n.text = $text, n.touchGeneration = coalesce(n.touchGeneration, 0) + 1, n.updatedAt = $at
         RETURN n.id AS id`,
        { mapId, id: command.target.id, text: payload.text ?? "", at: savedAt },
      );
      assertWriteCount(written, 1, "rename");
      return;
    }
    if (command.intent === "set-attribute" || command.intent === "unset-attribute") {
      const ownerKind = command.target.kind === "GraphLink" ? "link" : "node";
      const key = payload.key ?? "";
      if (command.target.kind === "GraphLink" && key === "label") {
        if (command.intent === "unset-attribute") {
          await tx.run(
            "MATCH ()-[g:GRAPH_LINK {mapId: $mapId, id: $id}]->() REMOVE g.label",
            { mapId, id: command.target.id },
          );
        } else {
          await tx.run(
            "MATCH ()-[g:GRAPH_LINK {mapId: $mapId, id: $id}]->() SET g.label = $value",
            { mapId, id: command.target.id, value: payload.value ?? "" },
          );
        }
        return;
      }
      if (command.intent === "unset-attribute") {
        await tx.run(
          `MATCH (a:Attribute {mapId: $mapId, ownerKind: $ownerKind, ownerId: $ownerId, attrKey: $attrKey})
           DETACH DELETE a`,
          { mapId, ownerKind, ownerId: command.target.id, attrKey: key },
        );
        return;
      }
      await tx.run(
        `MERGE (a:Attribute {recordKey: $recordKey})
         SET a.mapId = $mapId, a.ownerKind = $ownerKind, a.ownerId = $ownerId, a.attrKey = $attrKey, a.value = $value`,
        {
          mapId,
          ownerKind,
          ownerId: command.target.id,
          attrKey: key,
          value: payload.value ?? "",
          recordKey: `${mapId}${SEP}${ownerKind}${SEP}${command.target.id}${SEP}${key}`,
        },
      );
      return;
    }
    if (command.intent === "assert" && command.target.kind === "node") {
      const node = after.nodes[command.target.id];
      if (!node) throw new Error(`Asserted node is missing from the next state: ${command.target.id}`);
      const parentId = node.parentId;
      const orderKey = parentId && after.nodes[parentId]
        ? siblingOrderKey(Math.max(0, after.nodes[parentId]!.children.indexOf(node.id)), Math.max(1, after.nodes[parentId]!.children.length))
        : "a0";
      await tx.run(
        `MERGE (n:M3eNode {recordKey: $recordKey})
         SET n.mapId = $mapId, n.id = $id, n.text = $text, n.nodeType = $nodeType, n.collapsed = $collapsed,
             n.details = $details, n.note = $note, n.link = $link, n.isRoot = $isRoot, n.touchGeneration = 1
         WITH n
         MATCH (m:Map {id: $mapId})
         MERGE (m)-[:CONTAINS]->(n)`,
        {
          mapId,
          id: node.id,
          recordKey: `${mapId}${SEP}${node.id}`,
          text: node.text,
          nodeType: node.nodeType ?? "text",
          collapsed: node.collapsed,
          details: node.details,
          note: node.note,
          link: node.link,
          isRoot: node.parentId === null,
        },
      );
      if (parentId) {
        await tx.run(
          `MATCH (p:M3eNode {mapId: $mapId, id: $parentId}), (c:M3eNode {mapId: $mapId, id: $id})
           MERGE (p)-[e:EDGE {mapId: $mapId}]->(c)
           SET e.orderKey = $orderKey`,
          { mapId, parentId, id: node.id, orderKey },
        );
      }
      return;
    }
    if (command.intent === "delete" && command.target.kind === "node") {
      await tx.run(
        `MATCH (n:M3eNode {mapId: $mapId, id: $id})
         OPTIONAL MATCH (a:Attribute {mapId: $mapId, ownerKind: "node", ownerId: $id})
         DETACH DELETE n, a`,
        { mapId, id: command.target.id },
      );
      return;
    }
    if (command.intent === "reparent" && command.target.kind === "node") {
      const parentId = payload.parentId ?? "";
      const parent = after.nodes[parentId];
      const index = parent ? Math.max(0, parent.children.indexOf(command.target.id)) : 0;
      const count = parent ? Math.max(1, parent.children.length) : 1;
      await tx.run(
        `MATCH (:M3eNode {mapId: $mapId})-[e:EDGE {mapId: $mapId}]->(c:M3eNode {mapId: $mapId, id: $id})
         DELETE e`,
        { mapId, id: command.target.id },
      );
      if (parentId) {
        await tx.run(
          `MATCH (p:M3eNode {mapId: $mapId, id: $parentId}), (c:M3eNode {mapId: $mapId, id: $id})
           CREATE (p)-[:EDGE {mapId: $mapId, orderKey: $orderKey}]->(c)`,
          { mapId, parentId, id: command.target.id, orderKey: siblingOrderKey(index, count) },
        );
      }
      return;
    }
    if (command.intent === "assert" && command.target.kind === "GraphLink") {
      const link = after.links?.[command.target.id];
      if (!link) throw new Error(`Asserted GraphLink is missing: ${command.target.id}`);
      await tx.run(
        `MATCH (s:M3eNode {mapId: $mapId, id: $sourceId}), (t:M3eNode {mapId: $mapId, id: $targetId})
         CREATE (s)-[:GRAPH_LINK {mapId: $mapId, id: $id, linksKey: $id, sourceNodeId: $sourceId, targetNodeId: $targetId}]->(t)`,
        { mapId, id: link.id, sourceId: link.sourceNodeId, targetId: link.targetNodeId },
      );
      return;
    }
    if (command.intent === "delete" && command.target.kind === "GraphLink") {
      await tx.run(
        `MATCH ()-[g:GRAPH_LINK {mapId: $mapId, id: $id}]->()
         DELETE g`,
        { mapId, id: command.target.id },
      );
      await tx.run(
        `MATCH (a:Attribute {mapId: $mapId, ownerKind: "link", ownerId: $id})
         DETACH DELETE a`,
        { mapId, id: command.target.id },
      );
    }
  }

  private async patchNodeScalars(tx: Runner, mapId: string, before: AppState, after: AppState): Promise<void> {
    const rows = [];
    for (const [id, node] of Object.entries(after.nodes)) {
      const prior = before.nodes[id];
      if (!prior) continue;
      if (
        prior.link === node.link
        && prior.collapsed === node.collapsed && (prior.nodeType ?? "text") === (node.nodeType ?? "text")
      ) continue;
      rows.push({
        id,
        link: node.link,
        collapsed: node.collapsed,
        nodeType: node.nodeType ?? "text",
      });
    }
    if (rows.length === 0) return;
    const written = await tx.run(
      `UNWIND $rows AS row
       MATCH (n:M3eNode {mapId: $mapId, id: row.id})
       SET n.link = row.link, n.collapsed = row.collapsed, n.nodeType = row.nodeType
       RETURN n.id AS id`,
      { mapId, rows },
    );
    assertWriteCount(written, rows.length, "node scalars");
  }

  private async writeNodeTypes(
    tx: Runner,
    mapId: string,
    rows: Array<{ recordKey: string; nodeId: string; type: string }>,
  ): Promise<void> {
    await tx.run("MATCH (t:NodeTypeRecord {mapId: $mapId}) DELETE t", { mapId });
    if (rows.length === 0) return;
    const written = await tx.run(
      `UNWIND $rows AS row
       CREATE (t:NodeTypeRecord {recordKey: row.recordKey, mapId: $mapId, nodeId: row.nodeId, type: row.type})
       RETURN t.nodeId AS nodeId`,
      { mapId, rows },
    );
    assertWriteCount(written, rows.length, "node types");
  }

  private async writeAnnotations(tx: Runner, mapId: string, ledger: ReturnType<typeof recordAnnotations>): Promise<void> {
    await tx.run("MATCH (a:Annotation {mapId: $mapId}) DETACH DELETE a", { mapId });
    await tx.run("MATCH (m:Map {id: $mapId}) SET m.annotationsAbsent = $absent", { mapId, absent: ledger.absent });
    if (ledger.records.length === 0) return;
    const records = ledger.records.map((record) => ({
      recordKey: `${mapId}${SEP}annotation${SEP}${record.key}`,
      mapId,
      key: record.key,
      id: record.id,
      kind: record.kind,
      ...(record.scopeId ? { scopeId: record.scopeId } : {}),
      ...(record.createdAt ? { createdAt: record.createdAt } : {}),
          ...(record.kind === "pen"
        ? { d: record.d, stroke: record.stroke, strokeWidth: record.strokeWidth, ...(record.opacity !== undefined ? { opacity: record.opacity } : {}) }
        : {
          text: record.text,
          x: record.x,
          y: record.y,
          fill: record.fill,
          fontSize: record.fontSize,
          ...(record.fontWeight !== undefined ? { fontWeight: record.fontWeight } : {}),
          ...(record.variant ? { variant: record.variant } : {}),
        }),
    }));
    await tx.run(
      `UNWIND $records AS record
       CREATE (a:Annotation {recordKey: record.recordKey})
       SET a = record`,
      { records },
    );
    const points = ledger.records.flatMap((record) => (
      record.kind === "pen"
        ? record.points.map((point, order) => ({ key: record.key, order, x: point.x, y: point.y }))
        : []
    ));
    if (points.length > 0) {
      await tx.run(
        `UNWIND $points AS point
         MATCH (a:Annotation {mapId: $mapId, key: point.key})
         CREATE (a)-[:HAS_POINT {order: point.order, x: point.x, y: point.y}]->(a)`,
        { mapId, points },
      );
    }
  }

  private async writeLinear(tx: Runner, mapId: string, linear: ReturnType<typeof toLinearTextRecords>): Promise<void> {
    await tx.run("MATCH (n:LinearBody {mapId: $mapId}) DELETE n", { mapId });
    await tx.run(
      `MATCH (m:Map {id: $mapId})
       SET m.notesPresent = $notesPresent
       REMOVE m.linearTextFontScale, m.linearPanelWidth`,
      { mapId, notesPresent: linear.notesPresent },
    );
    if (linear.linearTextFontScale !== undefined) {
      await tx.run("MATCH (m:Map {id: $mapId}) SET m.linearTextFontScale = $fontScale", { mapId, fontScale: linear.linearTextFontScale });
    }
    if (linear.linearPanelWidth !== undefined) {
      await tx.run("MATCH (m:Map {id: $mapId}) SET m.linearPanelWidth = $panelWidth", { mapId, panelWidth: linear.linearPanelWidth });
    }
    if (linear.bodies.length > 0) {
      await tx.run(
        `UNWIND $bodies AS body
         CREATE (:LinearBody {recordKey: $mapId + $sep + body.scopeId, mapId: $mapId, scopeId: body.scopeId, body: body.body})`,
        { mapId, bodies: linear.bodies, sep: SEP },
      );
    }
  }

  private async writeScopeSurface(tx: Runner, mapId: string, records: ReturnType<typeof extractScopeSurfaceRecords>): Promise<void> {
    await tx.run("MATCH (n:MapScope {mapId: $mapId}) DETACH DELETE n", { mapId });
    await tx.run("MATCH (n:ScopeRoot {mapId: $mapId}) DELETE n", { mapId });
    await tx.run("MATCH (n:ScopeRelation {mapId: $mapId}) DELETE n", { mapId });
    await tx.run("MATCH (n:SurfaceRecord {mapId: $mapId}) DETACH DELETE n", { mapId });
    await tx.run("MATCH (n:SurfaceNodeView {mapId: $mapId}) DELETE n", { mapId });
    await tx.run(
      "MATCH (m:Map {id: $mapId}) SET m.scopesPresent = $scopesPresent, m.surfacesPresent = $surfacesPresent",
      { mapId, scopesPresent: records.scopesPresent, surfacesPresent: records.surfacesPresent },
    );
    if (records.scopes.length > 0) {
      await tx.run(
        `UNWIND $scopes AS scope
         CREATE (s:MapScope {recordKey: scope.recordKey})
         SET s = scope`,
        {
          scopes: records.scopes.map((scope) => ({
            recordKey: `${mapId}${SEP}scope${SEP}${scope.key}`,
            mapId,
            key: scope.key,
            id: scope.id,
            label: scope.label,
            ...(scope.primarySurfaceId ? { primarySurfaceId: scope.primarySurfaceId } : {}),
          })),
        },
      );
    }
    if (records.scopeRoots.length > 0) {
      await tx.run(
        `UNWIND $roots AS root
         CREATE (:ScopeRoot {recordKey: $mapId + $sep + root.scopeKey + $sep + toString(root.order), mapId: $mapId, scopeKey: root.scopeKey, nodeId: root.nodeId, order: root.order})`,
        { mapId, roots: records.scopeRoots, sep: SEP },
      );
    }
    if (records.scopeRelations.length > 0) {
      await tx.run(
        `UNWIND $relations AS rel
         CREATE (:ScopeRelation {recordKey: $mapId + $sep + rel.scopeKey + $sep + rel.relationId, mapId: $mapId, scopeKey: rel.scopeKey, relationId: rel.relationId, order: rel.order})`,
        { mapId, relations: records.scopeRelations, sep: SEP },
      );
    }
    if (records.surfaces.length > 0) {
      await tx.run(
        `UNWIND $surfaces AS surface
         CREATE (s:SurfaceRecord {recordKey: surface.recordKey})
         SET s = surface`,
        {
          surfaces: records.surfaces.map((surface) => ({
            recordKey: `${mapId}${SEP}surface${SEP}${surface.key}`,
            mapId,
            key: surface.key,
            id: surface.id,
            scopeId: surface.scopeId,
            kind: surface.kind,
            layout: surface.layout,
            nodeViewsPresent: surface.nodeViewsPresent,
            ...(surface.surfaceView ? { direction: surface.surfaceView.direction, space: surface.surfaceView.space } : {}),
          })),
        },
      );
    }
    if (records.surfaceNodeViews.length > 0) {
      await tx.run(
        `UNWIND $views AS view
         CREATE (v:SurfaceNodeView {recordKey: $mapId + $sep + view.surfaceKey + $sep + view.nodeId, mapId: $mapId})
         SET v += view`,
        { mapId, views: records.surfaceNodeViews, sep: SEP },
      );
    }
  }

  private session(): Session {
    return this.driver.session({ database: this.database });
  }

  private async readObjects(statement: string, params: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    const session = this.session();
    try {
      return await session.executeRead(async (tx) => {
        const result = await tx.run(statement, params);
        return result.records.map((record) => record.toObject() as Record<string, unknown>);
      });
    } finally {
      await session.close();
    }
  }

  private async commit(work: (tx: Runner) => Promise<void>): Promise<void> {
    const session = this.session();
    try {
      await session.executeWrite(async (tx) => {
        await work(tx);
      });
    } finally {
      await session.close();
    }
  }

  private async writeMapInBatches(
    input: Neo4jMapAddress & { state: AppState },
    imported: ReturnType<typeof importStateJson>,
    links: GraphLinkRecord[],
    linear: LinearTextRecords,
    scopeSurface: ScopeSurfaceRecords,
    savedAt: string,
  ): Promise<void> {
    const mapId = input.mapId;
    const parentOf = new Map(imported.edges.map((edge) => [edge.childId, edge.parentId]));
    const nodeType = new Map(imported.nodes.map((node) => [node.id, node.nodeType]));
    const orderByChild = new Map(imported.siblingOrderKeys.map((row) => [`${row.parentId}${SEP}${row.childId}`, row.orderKey]));
    const scopeByNode = new Map<string, string>();
    for (const node of imported.nodes) {
      scopeByNode.set(node.id, syncScopeId(node.id, parentOf, nodeType, input.state.rootId, input.state.scopes));
    }
    const rows = imported.nodes.map((node) => nodeRow(node, mapId, scopeByNode.get(node.id)!));
    const presentIds = new Set(imported.nodes.map((node) => node.id));
    const edges = imported.edges
      .filter((edge) => presentIds.has(edge.parentId) && presentIds.has(edge.childId))
      .map((edge) => ({
        parentId: edge.parentId,
        childId: edge.childId,
        orderKey: orderByChild.get(`${edge.parentId}${SEP}${edge.childId}`) ?? "a0",
      }));
    const attributes = imported.attributes
      .filter((attr) => typeof attr.value === "string")
      .map((attr) => ({ ownerKind: attr.ownerKind, ownerId: attr.ownerId, attrKey: attr.key, value: attr.value as string }));
    const session = this.session();
    const writeSlice = async (statement: string, params: Record<string, unknown>) => {
      await session.executeWrite(async (tx) => {
        await tx.run(statement, params);
      });
    };
    const chunks = <T,>(items: T[]): T[][] => {
      const out: T[][] = [];
      for (let index = 0; index < items.length; index += 2000) out.push(items.slice(index, index + 2000));
      return out;
    };
    try {
    await this.commit(async (tx) => {
        await tx.run(
          `MERGE (w:Workspace {id: $workspaceId})
           ON CREATE SET w.accountId = $accountId
           MERGE (m:Map {id: $mapId})
           ON CREATE SET m.workspaceId = $workspaceId
           MERGE (w)-[:HAS_MAP]->(m)
           SET m.workspaceId = $workspaceId, m.version = 1, m.savedAt = $savedAt, m.rootNodeId = $rootId,
               m.notesPresent = $notesPresent, m.scopesPresent = $scopesPresent, m.surfacesPresent = $surfacesPresent`,
          {
            workspaceId: input.workspaceId,
            accountId: input.accountId,
            mapId,
            savedAt,
            rootId: input.state.rootId,
            notesPresent: linear.notesPresent,
            scopesPresent: scopeSurface.scopesPresent,
            surfacesPresent: scopeSurface.surfacesPresent,
          },
        );
      });
      for (const nodeSlice of chunks(rows)) {
        await writeSlice(
          `UNWIND $nodes AS row
           MERGE (n:M3eNode {recordKey: row.recordKey})
           SET n = row
           WITH n
           MATCH (m:Map {id: $mapId})
           MERGE (m)-[:CONTAINS]->(n)`,
          { mapId, nodes: nodeSlice },
        );
      }
      for (const edgeSlice of chunks(edges)) {
        await writeSlice(
          `UNWIND $edges AS edge
           MATCH (p:M3eNode {mapId: $mapId, id: edge.parentId})
           MATCH (c:M3eNode {mapId: $mapId, id: edge.childId})
           CREATE (p)-[:EDGE {mapId: $mapId, orderKey: edge.orderKey}]->(c)`,
          { mapId, edges: edgeSlice },
        );
      }
      for (const attributeSlice of chunks(attributes)) {
        await writeSlice(
          `UNWIND $attributes AS attr
           CREATE (:Attribute {
             recordKey: $mapId + $sep + attr.ownerKind + $sep + attr.ownerId + $sep + attr.attrKey,
             mapId: $mapId, ownerKind: attr.ownerKind, ownerId: attr.ownerId, attrKey: attr.attrKey, value: attr.value
           })`,
          { mapId, attributes: attributeSlice, sep: SEP },
        );
      }
      const syncIds = [...new Set(scopeByNode.values())];
      await this.commit(async (tx) => {
        if (syncIds.length === 0) return;
        await tx.run(
          `UNWIND $scopes AS scopeId
           MERGE (s:SyncScope {recordKey: $mapId + $sep + scopeId})
           SET s.mapId = $mapId, s.id = scopeId, s.accountId = $accountId, s.contentPermission = "edit"`,
          { mapId, scopes: syncIds, sep: SEP, accountId: input.accountId },
        );
        await tx.run(
          `UNWIND $scopes AS scopeId
           MERGE (g:ScopeGrant {recordKey: $mapId + $sep + "grant" + $sep + scopeId + $sep + "write"})
           SET g.mapId = $mapId, g.scopeId = scopeId, g.capability = "write"`,
          { mapId, scopes: syncIds, sep: SEP },
        );
      });
      for (const nodeSlice of chunks(rows)) {
        await writeSlice(
          `UNWIND $nodes AS node
           MATCH (s:SyncScope {mapId: $mapId, id: node.syncScopeId})
           MATCH (n:M3eNode {mapId: $mapId, id: node.id})
           CREATE (s)-[:MEMBER]->(n)`,
          { mapId, nodes: nodeSlice },
        );
      }
      await this.commit(async (tx) => {
        await this.writeLinear(tx, mapId, linear);
        await this.writeAnnotations(tx, mapId, recordAnnotations(input.state.annotations));
        await this.writeNodeTypes(tx, mapId, nodeTypeRows(input.state, mapId));
        await this.writeScopeSurface(tx, mapId, scopeSurface);
      });
    } finally {
      await session.close();
    }
  }

  private async writeMap(
    tx: Runner,
    input: Neo4jMapAddress & { state: AppState },
    imported: ReturnType<typeof importStateJson>,
    links: GraphLinkRecord[],
    linear: LinearTextRecords,
    scopeSurface: ScopeSurfaceRecords,
    savedAt: string,
  ): Promise<ScopeChangeRecord[]> {
    const mapId = input.mapId;
    const workspace = await tx.run(
      "MATCH (w:Workspace {id: $workspaceId}) RETURN w.accountId AS accountId",
      { workspaceId: input.workspaceId },
    );
    if (workspace.records.length > 0 && workspace.records[0]!.get("accountId") !== input.accountId) {
      throw new Error("Workspace account boundary does not match.");
    }
    const existingMap = await tx.run("MATCH (m:Map {id: $mapId}) RETURN m.workspaceId AS workspaceId", { mapId });
    const storedWorkspace = existingMap.records[0]?.get("workspaceId");
    if (typeof storedWorkspace === "string" && storedWorkspace.length > 0 && storedWorkspace !== input.workspaceId) {
      throw new Error("Map belongs to a different workspace.");
    }

    const parentOf = new Map(imported.edges.map((edge) => [edge.childId, edge.parentId]));
    const nodeType = new Map(imported.nodes.map((node) => [node.id, node.nodeType]));
    const orderByChild = new Map(imported.siblingOrderKeys.map((row) => [`${row.parentId}${SEP}${row.childId}`, row.orderKey]));
    const scopeByNode = new Map<string, string>();
    for (const node of imported.nodes) {
      scopeByNode.set(node.id, syncScopeId(node.id, parentOf, nodeType, input.state.rootId, input.state.scopes));
    }
    const rows = imported.nodes.map((node) => nodeRow(node, mapId, scopeByNode.get(node.id)!));
    const presentIds = new Set(imported.nodes.map((node) => node.id));
    const edges = imported.edges
      .filter((edge) => presentIds.has(edge.parentId) && presentIds.has(edge.childId))
      .map((edge) => ({
        parentId: edge.parentId,
        childId: edge.childId,
        orderKey: orderByChild.get(`${edge.parentId}${SEP}${edge.childId}`) ?? "a0",
      }));
    const attributes = imported.attributes.map((attr) => ({
      ownerKind: attr.ownerKind,
      ownerId: attr.ownerId,
      attrKey: attr.key,
      value: typeof attr.value === "string" ? attr.value : JSON.stringify(attr.value),
    }));

    await tx.run(
      `MERGE (w:Workspace {id: $workspaceId})
       ON CREATE SET w.accountId = $accountId
       MERGE (m:Map {id: $mapId})
       ON CREATE SET m.workspaceId = $workspaceId
       MERGE (w)-[:HAS_MAP]->(m)
       SET m.workspaceId = $workspaceId, m.version = 1, m.savedAt = $savedAt, m.rootNodeId = $rootId,
           m.notesPresent = $notesPresent, m.scopesPresent = $scopesPresent, m.surfacesPresent = $surfacesPresent
       REMOVE m.linearTextFontScale, m.linearPanelWidth, m.stateJson, m.state_json, m.state`,
      {
        workspaceId: input.workspaceId,
        accountId: input.accountId,
        mapId,
        savedAt,
        rootId: input.state.rootId,
        notesPresent: linear.notesPresent,
        scopesPresent: scopeSurface.scopesPresent,
        surfacesPresent: scopeSurface.surfacesPresent,
      },
    );
    if (linear.linearTextFontScale !== undefined) {
      await tx.run("MATCH (m:Map {id: $mapId}) SET m.linearTextFontScale = $fontScale", { mapId, fontScale: linear.linearTextFontScale });
    }
    if (linear.linearPanelWidth !== undefined) {
      await tx.run("MATCH (m:Map {id: $mapId}) SET m.linearPanelWidth = $panelWidth", { mapId, panelWidth: linear.linearPanelWidth });
    }

    await tx.run("MATCH (:M3eNode {mapId: $mapId})-[r:EDGE {mapId: $mapId}]->() DELETE r", { mapId });
    await tx.run("MATCH (:M3eNode {mapId: $mapId})-[r:GRAPH_LINK {mapId: $mapId}]->() DELETE r", { mapId });
    await tx.run("MATCH (a:Attribute {mapId: $mapId}) DETACH DELETE a", { mapId });
    await tx.run("MATCH (t:NodeTypeRecord {mapId: $mapId}) DELETE t", { mapId });
    await tx.run("MATCH (:SyncScope {mapId: $mapId})-[r:MEMBER]->() DELETE r", { mapId });
    await tx.run("MATCH (n:LinearBody {mapId: $mapId}) DELETE n", { mapId });
    await tx.run("MATCH (n:MapScope {mapId: $mapId}) DETACH DELETE n", { mapId });
    await tx.run("MATCH (n:ScopeRoot {mapId: $mapId}) DELETE n", { mapId });
    await tx.run("MATCH (n:ScopeRelation {mapId: $mapId}) DELETE n", { mapId });
    await tx.run("MATCH (n:SurfaceRecord {mapId: $mapId}) DETACH DELETE n", { mapId });
    await tx.run("MATCH (n:SurfaceNodeView {mapId: $mapId}) DELETE n", { mapId });
    await tx.run("MATCH (n:M3eNode {mapId: $mapId}) WHERE NOT n.id IN $ids DETACH DELETE n", {
      mapId,
      ids: rows.map((row) => row.id),
    });

    assertWriteCount(await tx.run(
      `UNWIND $nodes AS row
       MERGE (n:M3eNode {recordKey: row.recordKey})
       SET n = row
       WITH n
       MATCH (m:Map {id: $mapId})
       MERGE (m)-[:CONTAINS]->(n)
       RETURN n.id AS id`,
      { mapId, nodes: rows },
    ), rows.length, "nodes");

    if (edges.length > 0) {
      assertWriteCount(await tx.run(
        `UNWIND $edges AS edge
         MATCH (p:M3eNode {mapId: $mapId, id: edge.parentId})
         MATCH (c:M3eNode {mapId: $mapId, id: edge.childId})
         CREATE (p)-[:EDGE {mapId: $mapId, orderKey: edge.orderKey}]->(c)
         RETURN edge.childId AS childId`,
        { mapId, edges },
      ), edges.length, "edges");
    }

    const linkRows = links.map((link) => {
      const props: Record<string, string> = {
        mapId,
        id: link.id,
        linksKey: link.linksKey,
        sourceNodeId: link.sourceNodeId,
        targetNodeId: link.targetNodeId,
      };
      for (const field of ["relationType", "label", "direction", "style", "color", "sourcePort", "targetPort"] as const) {
        const value = link[field];
        if (typeof value === "string") props[field] = value;
      }
      return { sourceNodeId: link.sourceNodeId, targetNodeId: link.targetNodeId, props };
    });
    if (linkRows.length > 0) {
      assertWriteCount(await tx.run(
        `UNWIND $links AS link
         MATCH (s:M3eNode {mapId: $mapId, id: link.sourceNodeId})
         MATCH (t:M3eNode {mapId: $mapId, id: link.targetNodeId})
         CREATE (s)-[g:GRAPH_LINK]->(t)
         SET g = link.props
         RETURN link.props.id AS id`,
        { mapId, links: linkRows },
      ), linkRows.length, "graph links");
    }
    if (attributes.length > 0) {
      assertWriteCount(await tx.run(
        `UNWIND $attributes AS attr
         CREATE (a:Attribute {
           recordKey: $mapId + $sep + attr.ownerKind + $sep + attr.ownerId + $sep + attr.attrKey,
           mapId: $mapId,
           ownerKind: attr.ownerKind,
           ownerId: attr.ownerId,
           attrKey: attr.attrKey,
           value: attr.value
         })
         RETURN a.recordKey AS recordKey`,
        { mapId, attributes, sep: SEP },
      ), attributes.length, "attributes");
    }

    const syncIds = [...new Set(scopeByNode.values())];
    assertWriteCount(await tx.run(
      `UNWIND $scopes AS scopeId
       MERGE (s:SyncScope {recordKey: $mapId + $sep + scopeId})
       SET s.mapId = $mapId, s.id = scopeId, s.accountId = $accountId, s.contentPermission = "edit"
       RETURN s.id AS id`,
      { mapId, scopes: syncIds, sep: SEP, accountId: input.accountId },
    ), syncIds.length, "sync scopes");
    await tx.run(
      `UNWIND $scopes AS scopeId
       MERGE (g:ScopeGrant {recordKey: $mapId + $sep + "grant" + $sep + scopeId + $sep + "write"})
       SET g.mapId = $mapId, g.scopeId = scopeId, g.capability = "write"`,
      { mapId, scopes: syncIds, sep: SEP },
    );
    await tx.run("MATCH (s:SyncScope {mapId: $mapId}) WHERE NOT s.id IN $ids DETACH DELETE s", { mapId, ids: syncIds });
    assertWriteCount(await tx.run(
      `UNWIND $nodes AS node
       MATCH (s:SyncScope {mapId: $mapId, id: node.syncScopeId})
       MATCH (n:M3eNode {mapId: $mapId, id: node.id})
       CREATE (s)-[:MEMBER]->(n)
       RETURN n.id AS id`,
      { mapId, nodes: rows },
    ), rows.length, "scope membership");

    if (linear.bodies.length > 0) {
      assertWriteCount(await tx.run(
        `UNWIND $bodies AS body
         CREATE (:LinearBody {recordKey: $mapId + $sep + body.scopeId, mapId: $mapId, scopeId: body.scopeId, body: body.body})
         RETURN body.scopeId AS scopeId`,
        { mapId, bodies: linear.bodies, sep: SEP },
      ), linear.bodies.length, "linear notes");
    }

    if (scopeSurface.scopes.length > 0) {
      const scopeRows = scopeSurface.scopes.map((scope) => ({
        recordKey: `${mapId}${SEP}scope${SEP}${scope.key}`,
        mapId,
        key: scope.key,
        id: scope.id,
        label: scope.label,
        ...(scope.primarySurfaceId ? { primarySurfaceId: scope.primarySurfaceId } : {}),
      }));
      assertWriteCount(await tx.run(
        `UNWIND $scopes AS scope
         CREATE (s:MapScope {recordKey: scope.recordKey})
         SET s = scope
         RETURN s.id AS id`,
        { scopes: scopeRows },
      ), scopeRows.length, "scope labels");
    }
    if (scopeSurface.scopeRoots.length > 0) {
      assertWriteCount(await tx.run(
        `UNWIND $roots AS root
         CREATE (:ScopeRoot {recordKey: $mapId + $sep + root.scopeKey + $sep + toString(root.order), mapId: $mapId, scopeKey: root.scopeKey, nodeId: root.nodeId, order: root.order})
         RETURN root.nodeId AS nodeId`,
        { mapId, roots: scopeSurface.scopeRoots, sep: SEP },
      ), scopeSurface.scopeRoots.length, "scope roots");
    }
    if (scopeSurface.scopeRelations.length > 0) {
      assertWriteCount(await tx.run(
        `UNWIND $relations AS rel
         CREATE (:ScopeRelation {recordKey: $mapId + $sep + rel.scopeKey + $sep + rel.relationId, mapId: $mapId, scopeKey: rel.scopeKey, relationId: rel.relationId, order: rel.order})
         RETURN rel.relationId AS relationId`,
        { mapId, relations: scopeSurface.scopeRelations, sep: SEP },
      ), scopeSurface.scopeRelations.length, "scope relations");
    }
    if (scopeSurface.surfaces.length > 0) {
      const surfaces = scopeSurface.surfaces.map((surface) => ({
        recordKey: `${mapId}${SEP}surface${SEP}${surface.key}`,
        mapId,
        key: surface.key,
        id: surface.id,
        scopeId: surface.scopeId,
        kind: surface.kind,
        layout: surface.layout,
        nodeViewsPresent: surface.nodeViewsPresent,
        ...(surface.surfaceView ? { direction: surface.surfaceView.direction, space: surface.surfaceView.space } : {}),
      }));
      assertWriteCount(await tx.run(
        `UNWIND $surfaces AS surface
         CREATE (s:SurfaceRecord {recordKey: surface.recordKey})
         SET s = surface
         RETURN s.id AS id`,
        { surfaces },
      ), surfaces.length, "surfaces");
    }
    if (scopeSurface.surfaceNodeViews.length > 0) {
      assertWriteCount(await tx.run(
        `UNWIND $views AS view
         CREATE (v:SurfaceNodeView {recordKey: $mapId + $sep + view.surfaceKey + $sep + view.nodeId, mapId: $mapId})
         SET v += view
         RETURN v.nodeId AS nodeId`,
        { mapId, views: scopeSurface.surfaceNodeViews, sep: SEP },
      ), scopeSurface.surfaceNodeViews.length, "surface node views");
    }

    await this.writeAnnotations(tx, mapId, recordAnnotations(input.state.annotations));
    await this.writeNodeTypes(tx, mapId, nodeTypeRows(input.state, mapId));

    const baseResult = await tx.run("MATCH (m:Map {id: $mapId}) RETURN coalesce(m.journalSeq, 0) AS base", { mapId });
    const base = asNumber(baseResult.records[0]!.get("base"));
    const entries = [...scopeByNode.values()].filter((scopeId, index, all) => all.indexOf(scopeId) === index).sort().map((scopeId, index) => ({
      recordKey: `${mapId}:${base + index + 1}`,
      mapId,
      scopeId,
      seq: base + index + 1,
      at: savedAt,
      intent: "assert" as const,
    }));
    if (entries.length > 0) {
      assertWriteCount(await tx.run(
        `MATCH (m:Map {id: $mapId})
         UNWIND $entries AS entry
         CREATE (j:JournalEntry {recordKey: entry.recordKey, mapId: entry.mapId, scopeId: entry.scopeId, seq: entry.seq, at: entry.at, intent: entry.intent})
         CREATE (m)-[:HAS_JOURNAL]->(j)
         WITH j, entry
         MATCH (s:SyncScope {mapId: $mapId, id: entry.scopeId})
         CREATE (j)-[:IN_SCOPE]->(s)
         RETURN j.seq AS seq`,
        { mapId, entries },
      ), entries.length, "journal");
      await tx.run("MATCH (m:Map {id: $mapId}) SET m.journalSeq = $seq", { mapId, seq: base + entries.length });
    }
    return entries.map((entry) => journalFrom(entry));
  }

  private async readMap(tx: Runner, mapId: string): Promise<SavedMap> {
    const mapResult = await tx.run("MATCH (m:Map {id: $mapId}) RETURN properties(m) AS props", { mapId });
    if (mapResult.records.length !== 1) throw new Error("Map not found.");
    const mapProps = mapResult.records[0]!.get("props") as Record<string, unknown>;
    if (asNumber(mapProps.version) !== 1) throw new Error("Unsupported or invalid save format.");

    const nodeResult = await tx.run("MATCH (n:M3eNode {mapId: $mapId}) RETURN properties(n) AS props", { mapId });
    const typeResult = await tx.run(
      "MATCH (t:NodeTypeRecord {mapId: $mapId}) RETURN t.nodeId AS nodeId, t.type AS type",
      { mapId },
    );
    const edgeResult = await tx.run(
      `MATCH (p:M3eNode {mapId: $mapId})-[e:EDGE {mapId: $mapId}]->(c:M3eNode {mapId: $mapId})
       RETURN p.id AS parentId, c.id AS childId, e.orderKey AS orderKey`,
      { mapId },
    );
    const attributeResult = await tx.run(
      "MATCH (a:Attribute {mapId: $mapId}) RETURN a.ownerKind AS ownerKind, a.ownerId AS ownerId, a.attrKey AS attrKey, a.value AS value",
      { mapId },
    );
    const linkResult = await tx.run(
      `MATCH (s:M3eNode {mapId: $mapId})-[g:GRAPH_LINK {mapId: $mapId}]->(t:M3eNode {mapId: $mapId})
       RETURN properties(g) AS props`,
      { mapId },
    );
    const membershipResult = await tx.run(
      `MATCH (s:SyncScope {mapId: $mapId})-[:MEMBER]->(n:M3eNode {mapId: $mapId})
       RETURN s.id AS scopeId, n.id AS nodeId`,
      { mapId },
    );
    const noteResult = await tx.run(
      "MATCH (n:LinearBody {mapId: $mapId}) RETURN n.scopeId AS scopeId, n.body AS body",
      { mapId },
    );
    const scopeResult = await tx.run("MATCH (s:MapScope {mapId: $mapId}) RETURN properties(s) AS props", { mapId });
    const scopeRootResult = await tx.run(
      "MATCH (r:ScopeRoot {mapId: $mapId}) RETURN r.scopeKey AS scopeKey, r.nodeId AS nodeId, r.order AS order",
      { mapId },
    );
    const scopeRelationResult = await tx.run(
      "MATCH (r:ScopeRelation {mapId: $mapId}) RETURN r.scopeKey AS scopeKey, r.relationId AS relationId, r.order AS order",
      { mapId },
    );
    const surfaceResult = await tx.run("MATCH (s:SurfaceRecord {mapId: $mapId}) RETURN properties(s) AS props", { mapId });
    const viewResult = await tx.run("MATCH (v:SurfaceNodeView {mapId: $mapId}) RETURN properties(v) AS props", { mapId });
    const annotationResult = await tx.run(
      `MATCH (a:Annotation {mapId: $mapId})
       OPTIONAL MATCH (a)-[p:HAS_POINT]->(a)
       RETURN properties(a) AS props, p.order AS pointOrder, p.x AS x, p.y AS y`,
      { mapId },
    );

    const nodeAttributes = new Map<string, Record<string, string>>();
    const linkAttributes = new Map<string, Record<string, string>>();
    for (const record of attributeResult.records) {
      const ownerKind = asString(record.get("ownerKind"));
      const ownerId = asString(record.get("ownerId"));
      const bucket = ownerKind === "link" ? linkAttributes : nodeAttributes;
      const current = bucket.get(ownerId) ?? {};
      current[asString(record.get("attrKey"))] = asString(record.get("value"));
      bucket.set(ownerId, current);
    }

    const children = new Map<string, Array<{ id: string; orderKey: string }>>();
    const parentOf = new Map<string, string>();
    for (const record of edgeResult.records) {
      const parentId = asString(record.get("parentId"));
      const childId = asString(record.get("childId"));
      if (parentOf.has(childId)) throw new Error(`Node ${childId} has more than one parent.`);
      parentOf.set(childId, parentId);
      const list = children.get(parentId) ?? [];
      list.push({ id: childId, orderKey: asString(record.get("orderKey")) });
      children.set(parentId, list);
    }
    const memberships = new Map<string, string[]>();
    for (const record of membershipResult.records) {
      const nodeId = asString(record.get("nodeId"));
      const list = memberships.get(nodeId) ?? [];
      list.push(asString(record.get("scopeId")));
      memberships.set(nodeId, list);
    }

    const rawNodes = new Map<string, Record<string, unknown>>();
    for (const record of nodeResult.records) rawNodes.set(asString((record.get("props") as Record<string, unknown>).id), record.get("props") as Record<string, unknown>);
    const nodeType = new Map<string, string>();
    for (const [id, props] of rawNodes) nodeType.set(id, asString(props.nodeType, "text"));
    const rootId = asString(mapProps.rootNodeId);

    const scopeRecords = scopeResult.records.map((record) => {
      const props = record.get("props") as Record<string, unknown>;
      const scope: ScopeSurfaceRecords["scopes"][number] = {
        key: asString(props.key),
        id: asString(props.id),
        label: asString(props.label),
      };
      if (typeof props.primarySurfaceId === "string") scope.primarySurfaceId = props.primarySurfaceId;
      return scope;
    });
    const assembledScopes = assembleScopeSurface({
      scopesPresent: mapProps.scopesPresent === true,
      surfacesPresent: mapProps.surfacesPresent === true,
      scopes: scopeRecords,
      scopeRoots: scopeRootResult.records.map((record) => ({
        scopeKey: asString(record.get("scopeKey")),
        nodeId: asString(record.get("nodeId")),
        order: asNumber(record.get("order")),
      })),
      scopeRelations: scopeRelationResult.records.map((record) => ({
        scopeKey: asString(record.get("scopeKey")),
        relationId: asString(record.get("relationId")),
        order: asNumber(record.get("order")),
      })),
      surfaces: surfaceResult.records.map((record) => {
        const props = record.get("props") as Record<string, unknown>;
        const surface: ScopeSurfaceRecords["surfaces"][number] = {
          key: asString(props.key),
          id: asString(props.id),
          scopeId: asString(props.scopeId),
          kind: props.kind as ScopeSurfaceRecords["surfaces"][number]["kind"],
          layout: props.layout as ScopeSurfaceRecords["surfaces"][number]["layout"],
          nodeViewsPresent: props.nodeViewsPresent === true,
        };
        if (typeof props.direction === "string" && typeof props.space === "string") {
          surface.surfaceView = {
            direction: props.direction as NonNullable<ScopeSurfaceRecords["surfaces"][number]["surfaceView"]>["direction"],
            space: props.space as NonNullable<ScopeSurfaceRecords["surfaces"][number]["surfaceView"]>["space"],
          };
        }
        return surface;
      }),
      surfaceNodeViews: viewResult.records.map((record) => {
        const props = record.get("props") as Record<string, unknown>;
        const view: ScopeSurfaceRecords["surfaceNodeViews"][number] = {
          surfaceKey: asString(props.surfaceKey),
          nodeId: asString(props.nodeId),
        };
        for (const field of ["x", "y", "flowCol", "flowRow"] as const) {
          if (props[field] !== undefined && props[field] !== null) view[field] = asNumber(props[field]);
        }
        if (props.shape === "rect" || props.shape === "diamond" || props.shape === "rounded") view.shape = props.shape;
        return view;
      }),
    });

    const typeByNode = new Map<string, string>();
    for (const record of typeResult.records) typeByNode.set(asString(record.get("nodeId")), asString(record.get("type")));

    const nodes: Record<string, TreeNode> = {};
    for (const [id, props] of rawNodes) {
      const ordered = (children.get(id) ?? []).sort((left, right) => left.orderKey < right.orderKey ? -1 : left.orderKey > right.orderKey ? 1 : 0);
      const node: TreeNode = {
        id,
        parentId: parentOf.get(id) ?? null,
        children: ordered.map((child) => child.id),
        nodeType: asString(props.nodeType, "text") as NodeType,
        text: asString(props.text),
        collapsed: props.collapsed === true,
        details: asString(props.details),
        note: asString(props.note),
        attributes: nodeAttributes.get(id) ?? {},
        link: asString(props.link),
      };
      const storedType = typeByNode.get(id);
      if (storedType !== undefined) (node as TreeNode & { type?: string }).type = storedType;
      if (typeof props.explicitScopeId === "string" && props.explicitScopeId.length > 0) {
        node.scopeId = props.explicitScopeId;
      } else {
        const derived = syncScopeId(id, parentOf, nodeType, rootId, assembledScopes.scopes);
        const explicit = (memberships.get(id) ?? []).find((scopeId) => scopeId !== derived);
        if (explicit) node.scopeId = explicit;
      }
      if (node.nodeType === "alias") {
        if (typeof props.targetNodeId === "string") node.targetNodeId = props.targetNodeId;
        if (typeof props.aliasLabel === "string") node.aliasLabel = props.aliasLabel;
        if (props.access === "read" || props.access === "write") node.access = props.access;
        if (typeof props.targetSnapshotLabel === "string") node.targetSnapshotLabel = props.targetSnapshotLabel;
        node.isBroken = props.isBroken === true;
      }
      const carried = node as TreeNode & { aliasOf?: string; createdAt?: string; notes?: string; updatedAt?: string };
      if (typeof props.aliasOf === "string") carried.aliasOf = props.aliasOf;
      if (typeof props.createdAt === "string") carried.createdAt = props.createdAt;
      if (typeof props.notes === "string") carried.notes = props.notes;
      if (typeof props.docUpdatedAt === "string") carried.updatedAt = props.docUpdatedAt;
      nodes[id] = node;
    }
    if (!nodes[rootId]) throw new Error("Stored root node is missing.");
    if (nodes[rootId]!.parentId !== null) throw new Error("Stored root node has a parent.");

    const linkRecords: GraphLinkRecord[] = linkResult.records.map((record) => {
      const props = record.get("props") as Record<string, unknown>;
      const id = asString(props.id);
      const attributes = linkAttributes.get(id);
      return {
        linksKey: asString(props.linksKey),
        id,
        sourceNodeId: asString(props.sourceNodeId),
        targetNodeId: asString(props.targetNodeId),
        ...(typeof props.relationType === "string" ? { relationType: props.relationType } : {}),
        ...(typeof props.label === "string" ? { label: props.label } : {}),
        ...(props.direction === "none" || props.direction === "forward" || props.direction === "backward" || props.direction === "both" ? { direction: props.direction } : {}),
        ...(props.style === "default" || props.style === "dashed" || props.style === "soft" || props.style === "emphasis" ? { style: props.style } : {}),
        ...(typeof props.color === "string" ? { color: props.color } : {}),
        ...(props.sourcePort === "auto" || props.sourcePort === "left" || props.sourcePort === "right" || props.sourcePort === "top" || props.sourcePort === "bottom" ? { sourcePort: props.sourcePort } : {}),
        ...(props.targetPort === "auto" || props.targetPort === "left" || props.targetPort === "right" || props.targetPort === "top" || props.targetPort === "bottom" ? { targetPort: props.targetPort } : {}),
        ...(attributes ? { attributes } : {}),
      };
    });

    const linear = fromLinearTextRecords({
      bodies: noteResult.records.map((record) => ({ scopeId: asString(record.get("scopeId")), body: asString(record.get("body")) })),
      notesPresent: mapProps.notesPresent === true,
      ...(mapProps.linearTextFontScale !== undefined && mapProps.linearTextFontScale !== null
        ? { linearTextFontScale: asNumber(mapProps.linearTextFontScale) }
        : {}),
      ...(mapProps.linearPanelWidth !== undefined && mapProps.linearPanelWidth !== null
        ? { linearPanelWidth: asNumber(mapProps.linearPanelWidth) }
        : {}),
    });

    const annotationRows = new Map<string, { props: Record<string, unknown>; points: Array<{ order: number; x: number; y: number }> }>();
    for (const record of annotationResult.records) {
      const props = record.get("props") as Record<string, unknown>;
      const key = asString(props.key);
      const current = annotationRows.get(key) ?? { props, points: [] };
      if (record.get("pointOrder") !== null && record.get("pointOrder") !== undefined) {
        current.points.push({
          order: asNumber(record.get("pointOrder")),
          x: asNumber(record.get("x")),
          y: asNumber(record.get("y")),
        });
      }
      annotationRows.set(key, current);
    }
    const annotationRecords: AnnotationRecord[] = [...annotationRows.values()].map(({ props, points }) => {
      if (props.kind === "pen") {
        return {
          key: asString(props.key),
          id: asString(props.id),
          kind: "pen" as const,
          ...(typeof props.scopeId === "string" ? { scopeId: props.scopeId } : {}),
          ...(typeof props.createdAt === "string" ? { createdAt: props.createdAt } : {}),
          d: asString(props.d),
          points: points.sort((left, right) => left.order - right.order).map((point) => ({ x: point.x, y: point.y })),
          stroke: asString(props.stroke),
          strokeWidth: asNumber(props.strokeWidth),
          ...(props.opacity !== undefined && props.opacity !== null ? { opacity: asNumber(props.opacity) } : {}),
        };
      }
      return {
        key: asString(props.key),
        id: asString(props.id),
        kind: "text" as const,
        ...(typeof props.scopeId === "string" ? { scopeId: props.scopeId } : {}),
        ...(typeof props.createdAt === "string" ? { createdAt: props.createdAt } : {}),
        x: asNumber(props.x, 0),
        y: asNumber(props.y, 0),
        text: asString(props.text),
        fill: asString(props.fill),
        fontSize: asNumber(props.fontSize),
        ...(props.fontWeight !== undefined && props.fontWeight !== null ? { fontWeight: asNumber(props.fontWeight) } : {}),
        ...(props.variant === "date" || props.variant === "label" ? { variant: props.variant } : {}),
      };
    });
    const annotations = restoreAnnotations({
      absent: mapProps.annotationsAbsent !== false,
      records: mapProps.annotationsAbsent === false ? annotationRecords : [],
    });

    const state: AppState = {
      rootId,
      nodes,
      links: recordsToAppStateLinks(linkRecords),
      ...linear,
      ...assembledScopes,
      ...(annotations ? { annotations } : {}),
    };
    restoreCarriedState(state, mapProps);
    return { version: 1, savedAt: asString(mapProps.savedAt), state };
  }

  /** 退避文書の項目。selectedId は sessionSelectedId に置き、state には戻さない。 */
  private async writeCarried(mapId: string, state: AppState): Promise<void> {
    const saved = carriedField(state, "savedAt");
    const exported = carriedField(state, "exportedAt");
    const sourceDb = carriedField(state, "sourceDb");
    const sourceDoc = carriedField(state, "sourceDocSavedAt");
    const scope = carriedField(state, "scopeId");
    const nodes: Array<Record<string, string | null>> = [];
    const explicitScopes: Array<{ id: string; scopeId: string }> = [];
    for (const node of Object.values(state.nodes ?? {})) {
      if (typeof node.scopeId === "string" && node.scopeId.length > 0) {
        explicitScopes.push({ id: node.id, scopeId: node.scopeId });
      }
      const aliasOf = carriedField(node, "aliasOf");
      const createdAt = carriedField(node, "createdAt");
      const notes = carriedField(node, "notes");
      const updatedAt = carriedField(node, "updatedAt");
      if (!aliasOf.present && !createdAt.present && !notes.present && !updatedAt.present) continue;
      nodes.push({
        id: node.id,
        aliasOf: aliasOf.value,
        createdAt: createdAt.value,
        notes: notes.value,
        docUpdatedAt: updatedAt.value,
      });
    }
    const session = this.session();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run(
          `MATCH (m:Map {id: $mapId})
           SET m.documentSavedAt = $documentSavedAt, m.documentSavedAtPresent = $documentSavedAtPresent,
               m.exportedAt = $exportedAt, m.exportedAtPresent = $exportedAtPresent,
               m.sourceDb = $sourceDb, m.sourceDbPresent = $sourceDbPresent,
               m.sourceDocSavedAt = $sourceDocSavedAt, m.sourceDocSavedAtPresent = $sourceDocSavedAtPresent,
               m.documentScopeId = $documentScopeId, m.documentScopeIdPresent = $documentScopeIdPresent`,
          {
            mapId,
            documentSavedAt: saved.value,
            documentSavedAtPresent: saved.present,
            exportedAt: exported.value,
            exportedAtPresent: exported.present,
            sourceDb: sourceDb.value,
            sourceDbPresent: sourceDb.present,
            sourceDocSavedAt: sourceDoc.value,
            sourceDocSavedAtPresent: sourceDoc.present,
            documentScopeId: scope.value,
            documentScopeIdPresent: scope.present,
          },
        );
        if (explicitScopes.length > 0) {
          await tx.run(
            `UNWIND $rows AS row
             MATCH (n:M3eNode {mapId: $mapId, id: row.id})
             SET n.explicitScopeId = row.scopeId`,
            { mapId, rows: explicitScopes },
          );
        }
        for (let index = 0; index < nodes.length; index += 500) {
          await tx.run(
            `UNWIND $nodes AS row
             MATCH (n:M3eNode {mapId: $mapId, id: row.id})
             SET n.aliasOf = row.aliasOf, n.createdAt = row.createdAt, n.notes = row.notes, n.docUpdatedAt = row.docUpdatedAt`,
            { mapId, nodes: nodes.slice(index, index + 500) },
          );
        }
      });
    } finally {
      await session.close();
    }
  }

  /** selectedId は正本の外。読み戻した state には入れない。 */
  private async writeSessionSelected(mapId: string, state: AppState): Promise<void> {
    const selected = carriedField(state, "selectedId");
    if (!selected.present) return;
    const session = this.session();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run(
          `MATCH (m:Map {id: $mapId})
           SET m.sessionSelectedId = $sessionSelectedId, m.sessionSelectedIdPresent = true`,
          { mapId, sessionSelectedId: selected.value },
        );
      });
    } finally {
      await session.close();
    }
  }
}

async function probeMain(): Promise<void> {
  const uri = process.env.M3E_BETA_NEO4J_URI;
  const mapId = process.env.M3E_BETA_NEO4J_MAP_ID;
  const nodeId = process.env.M3E_BETA_NEO4J_NODE_ID;
  if (!uri || !mapId || !nodeId) throw new Error("Neo4j probe requires URI, map id, and node id.");
  const store = await Neo4jMapStore.open({ uri, database: NEO4J_TEST_DATABASE });
  try {
    const saved = await store.loadMap(mapId);
    const touch = await store.touchGenerations(mapId);
    process.stdout.write(JSON.stringify({
      text: saved.state.nodes[nodeId]?.text ?? null,
      touch,
      state: saved.state,
    }));
  } finally {
    await store.close();
  }
}

async function syncMain(): Promise<void> {
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
  const request = JSON.parse(raw) as {
    op: string;
    workspaceId?: string;
    accountId?: string;
    mapId?: string;
    state?: AppState;
    texts?: Record<string, string>;
    cursor?: number;
    actorAccountId?: string;
    commandId?: string;
    baseRevision?: string;
    intent?: string;
    nodeId?: string;
    text?: string;
    parentId?: string | null;
    attrKey?: string;
    attrValue?: string;
    childIds?: string;
    sourceNodeId?: string;
    targetNodeId?: string;
    targetKind?: "node" | "GraphLink";
    restores?: Array<{ nodeId: string; text: string; commandId: string; baseRevision: string; actorAccountId: string }>;
    nodeBases?: Record<string, string>;
  };
  const store = await Neo4jMapStore.open({
    uri: process.env.M3E_BETA_NEO4J_URI || "bolt://127.0.0.1:17687",
    database: process.env.M3E_BETA_NEO4J_DATABASE || NEO4J_TEST_DATABASE,
  });
  try {
    if (request.op === "save") {
      const mapId = request.mapId || "";
      const saved = await store.saveMap({
        workspaceId: request.workspaceId || "",
        accountId: request.accountId || "",
        mapId,
        state: request.state as AppState,
        nodeBases: request.nodeBases,
        actorAccountId: request.actorAccountId || request.accountId || "",
      });
      const revisions = await store.readNodeRevisions(mapId);
      process.stdout.write(JSON.stringify({ ok: true, savedAt: saved.savedAt, revisions }));
      return;
    }
    if (request.op === "revisions") {
      process.stdout.write(JSON.stringify({ ok: true, revisions: await store.readNodeRevisions(request.mapId || "") }));
      return;
    }
    if (request.op === "load") {
      const saved = await store.loadMap(request.mapId || "");
      process.stdout.write(JSON.stringify({ ok: true, saved }));
      return;
    }
    if (request.op === "exists") {
      process.stdout.write(JSON.stringify({ ok: true, exists: await store.hasMap(request.mapId || "") }));
      return;
    }
    if (request.op === "restore-texts") {
      const results = await store.restoreNodeTexts({
        mapId: request.mapId || "",
        cursor: request.cursor ?? -1,
        restores: request.restores ?? [],
      });
      const rejected = results.find((result) => result.outcome === "rejected");
      process.stdout.write(JSON.stringify({ ok: !rejected, results }));
      return;
    }
    if (request.op === "submit") {
      if (
        request.intent !== "rename" && request.intent !== "assert" && request.intent !== "reparent"
        && request.intent !== "delete" && request.intent !== "set-attribute" && request.intent !== "unset-attribute"
        && request.intent !== "reorder" && request.intent !== "retarget"
      ) {
        process.stdout.write(JSON.stringify({
          ok: true,
          outcome: "rejected",
          reason: "unsupported-intent",
          commandId: request.commandId || "",
        }));
        return;
      }
      const result = await store.submitNodeCommand({
        mapId: request.mapId || "",
        actorAccountId: request.actorAccountId || "",
        commandId: request.commandId || "",
        baseRevision: request.baseRevision ?? "",
        intent: request.intent,
        nodeId: request.nodeId || "",
        targetKind: request.targetKind,
        text: request.text,
        parentId: request.parentId,
        attrKey: request.attrKey,
        attrValue: request.attrValue,
        childIds: request.childIds,
        sourceNodeId: request.sourceNodeId,
        targetNodeId: request.targetNodeId,
      });
      process.stdout.write(JSON.stringify({ ok: true, ...result }));
      return;
    }
    throw new Error(`Unknown Neo4j request: ${request.op}`);
  } finally {
    await store.close();
  }
}

if (process.env.M3E_BETA_NEO4J_SYNC === "1") {
  syncMain().then(() => {
    process.exit(0);
  }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

if (process.env.M3E_BETA_NEO4J_PROBE === "1") {
  probeMain().then(() => {
    process.exit(0);
  }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
