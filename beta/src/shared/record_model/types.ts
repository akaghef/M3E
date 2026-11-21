// Record types of the portable snapshot.
// Contract: .kiro/specs/rapid-persistence-redesign/snapshot-format.md section 2.
// One JSON Lines row is one record. Absent values are omitted; null is never written.

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const SNAPSHOT_FORMAT = 2;

export interface SnapshotHeader {
  kind: "snapshot";
  /** 1 is read and migrated once on open. 2 is the format this store writes. */
  format: 1 | 2;
  workspaceId: string;
  seq: number;
}

export interface MapRecord {
  kind: "map";
  id: string;
  rootNodeId?: string;
  tags?: JsonValue;
  archived?: JsonValue;
  pinned?: JsonValue;
  source?: JsonValue;
  legacyVersion?: JsonValue;
  legacySavedAt?: JsonValue;
  linearTextFontScale?: JsonValue;
  linearPanelWidth?: JsonValue;
  extra?: JsonObject;
  rev: number;
}

export interface AliasValue {
  target?: string;
  label?: string;
  access?: "read" | "write";
  snapshotLabel?: string;
  broken?: true;
}

/** Entity validity (Database_Spec 12.7). Absent means the entity has no period. */
export interface NodeValidity {
  from?: string;
  to?: string;
}

/**
 * Copy provenance kept on the node so compaction does not drop it (Database_Spec 6).
 * `source` is the copied node, `seq` the commit, `mode` the chosen arguments, `ids` the old-to-new map.
 */
export interface CopyOf {
  source: string;
  mapId?: string;
  seq: number;
  mode: string;
  ids: { [id: string]: string };
}

export interface NodeRecord {
  kind: "node";
  id: string;
  mapId: string;
  /** Omitted when the node is a plain text node. */
  nodeType?: string;
  text: string;
  /** Written only when true. */
  collapsed?: true;
  attributes?: JsonObject;
  alias?: AliasValue;
  valid?: NodeValidity;
  copyOf?: CopyOf;
  /** `name@version`, string order, one entry per name. Omitted when empty. */
  extensions?: string[];
  extra?: JsonObject;
  rev: number;
}

export interface DetailsRecord {
  kind: "details";
  nodeId: string;
  mapId: string;
  v: 1;
  body?: string;
  note?: string;
  link?: string;
  rev: number;
}

export interface EdgeConnectionRecord {
  kind: "connection";
  id: string;
  mapId: string;
  type: "edge";
  source: string;
  target: string;
  label?: string;
  ord: string;
  /** The scope this edge lies on (record-schema DA59). */
  scopeId?: string;
  relationType?: string;
  attributes?: JsonObject;
  /** `name@version`, string order, one entry per name. Omitted when empty. */
  extensions?: string[];
  rev: number;
}

export interface GraphLinkConnectionRecord {
  kind: "connection";
  id: string;
  mapId: string;
  type: "graphlink";
  source: string;
  target: string;
  relationType?: string;
  label?: string;
  attributes?: JsonObject;
  /** `name@version`, string order, one entry per name. Omitted when empty. */
  extensions?: string[];
  direction?: string;
  style?: string;
  color?: string;
  sourcePort?: string;
  targetPort?: string;
  extra?: JsonObject;
  rev: number;
}

export type ConnectionRecord = EdgeConnectionRecord | GraphLinkConnectionRecord;

export interface ScopeRecord {
  kind: "scope";
  id: string;
  mapId: string;
  rootNodeId: string;
  /** Own name; when absent the scope is named by its root node's label (DA61). */
  label?: string;
  primarySurfaceId?: string;
  rev: number;
}

/** Keyed by `scopeId`, or by `mapId` + `orphanKey` when no scope owns the text. */
export interface LinearTextRecord {
  kind: "linearText";
  scopeId?: string;
  mapId: string;
  orphanKey?: string;
  text: string;
  anchorNodeId?: string;
  rev: number;
}

export interface SurfaceRecord {
  kind: "surface";
  id: string;
  mapId: string;
  scopeId: string;
  surfaceKind: string;
  layout: string;
  surfaceView?: JsonValue;
  rev: number;
}

/** Has no `rev`; follows the `rev` of its surface. */
export interface NodeViewRecord {
  kind: "nodeView";
  surfaceId: string;
  nodeId: string;
  mapId: string;
  x?: number;
  y?: number;
  flowCol?: number;
  flowRow?: number;
  shape?: string;
}

/**
 * Current annotation fields are carried as they are. The current field `kind`
 * ("pen" / "text") collides with the record discriminator, so it is carried as
 * `annotationKind` (same pattern as `surfaceKind` / `accountKind`).
 */
export interface AnnotationRecord {
  kind: "annotation";
  id: string;
  mapId: string;
  scopeId?: string;
  annotationKind?: JsonValue;
  d?: JsonValue;
  points?: JsonValue;
  stroke?: JsonValue;
  strokeWidth?: JsonValue;
  opacity?: JsonValue;
  createdAt?: JsonValue;
  x?: JsonValue;
  y?: JsonValue;
  text?: JsonValue;
  fill?: JsonValue;
  fontSize?: JsonValue;
  fontWeight?: JsonValue;
  variant?: JsonValue;
  extra?: JsonObject;
  rev: number;
}

export type ExtensionTarget = "node" | "parentEdge" | "relationEdge";
export type ExtensionRenderSize = "text" | "fixed" | "attribute";

export interface ExtensionField {
  name: string;
  type: string;
  required?: boolean;
  /** Stored. Not applied and not checked (10.7 does not say how). */
  default?: JsonValue;
  values?: string[];
  /** Stored. Not checked (10.7 does not say how). */
  ref?: string;
}

export interface ExtensionRender {
  attributes: string[];
  size: ExtensionRenderSize;
}

/** Workspace-level. Key is `name@version` (one string, not two parts). */
export interface ExtensionDefRecord {
  kind: "extensionDef";
  /** `prefix:class:name`. `class` is `nodeType`, `parentEdge`, or `relationEdge`. */
  name: string;
  version: number;
  target: ExtensionTarget;
  label?: string;
  description?: string;
  fields: ExtensionField[];
  render?: ExtensionRender;
  rev: number;
}

export interface RelationTypeDefRecord {
  kind: "relationTypeDef";
  name: string;
  label?: string;
  description?: string;
  reads: "source-to-target" | "target-to-source";
  rev: number;
}

export interface PrefixRecord {
  kind: "prefix";
  prefix: string;
  uri: string;
  rev: number;
}

export interface AccountRecord {
  kind: "account";
  id: string;
  accountKind: "ai-agent" | "human" | "system";
  displayName: string;
  externalIds?: JsonValue;
  roles?: JsonValue;
  rev: number;
}

export interface CommitRecord {
  kind: "commit";
  seq: number;
  committedAt: string;
  issuer: string;
  sessionId?: string;
}

export interface IdMapRecord {
  kind: "idMap";
  recordKind: "node" | "graphlink" | "annotation" | "surface";
  mapId: string;
  oldId: string;
  newId: string;
  /**
   * Set by the record store (not by the migration) on an id it renumbered after the migration:
   * the client keeps using `oldId`, and the store translates both ways.
   */
  alias?: true;
}

/** Present only while the occurrence is locked. Key is the target record key. */
export interface LockRecord {
  kind: "lock";
  /** Record key of the locked occurrence, such as `node|n1` or `scope|s1`. */
  target: string;
  mapId: string;
  rev: number;
}

/** A grant of one capability in one scope. Key is `id`. Not inherited by nested scopes. */
export interface GrantRecord {
  kind: "grant";
  id: string;
  mapId: string;
  scopeId: string;
  principal: { account: string };
  capability: string;
  grantedBy: string;
  expiresAt?: string;
  rev: number;
}

export type SnapshotRecord =
  | SnapshotHeader
  | MapRecord
  | NodeRecord
  | DetailsRecord
  | ConnectionRecord
  | ScopeRecord
  | LinearTextRecord
  | SurfaceRecord
  | NodeViewRecord
  | AnnotationRecord
  | RelationTypeDefRecord
  | ExtensionDefRecord
  | PrefixRecord
  | AccountRecord
  | CommitRecord
  | IdMapRecord
  | LockRecord
  | GrantRecord;

export type RecordKind = SnapshotRecord["kind"];

/** One row of the current `maps` table; `state` is the parsed `state_json`. */
export interface SnapshotRow {
  id: string;
  state: unknown;
  tags?: unknown;
  archived?: unknown;
  pinned?: unknown;
  source?: unknown;
  version?: unknown;
  saved_at?: unknown;
}

/**
 * String order used everywhere in this module: by Unicode code point
 * (differs from the default UTF-16 order only for astral characters).
 */
export function compareStrings(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const x = a.charCodeAt(i);
    const y = b.charCodeAt(i);
    if (x !== y) return fixUp(x) - fixUp(y);
  }
  return a.length - b.length;
}

function fixUp(unit: number): number {
  if (unit < 0xd800) return unit;
  return unit <= 0xdfff ? unit + 0x2000 : unit - 0x800;
}

/** Key components of a record, in the order the contract lists them. */
export function recordKeyParts(record: SnapshotRecord): string[] {
  switch (record.kind) {
    case "snapshot":
      return [record.workspaceId];
    case "map":
    case "node":
    case "connection":
    case "scope":
    case "surface":
    case "annotation":
    case "account":
      return [record.id];
    case "details":
      return [record.nodeId];
    case "linearText":
      return record.scopeId !== undefined ? [record.scopeId] : [record.mapId, record.orphanKey ?? ""];
    case "nodeView":
      return [record.surfaceId, record.nodeId];
    case "relationTypeDef":
      return [record.name];
    case "extensionDef":
      return [`${record.name}@${record.version}`];
    case "prefix":
      return [record.prefix];
    case "commit":
      return [String(record.seq)];
    case "idMap":
      return [record.recordKind, record.mapId, record.oldId];
    case "lock":
      return [record.target];
    case "grant":
      return [record.id];
  }
}
