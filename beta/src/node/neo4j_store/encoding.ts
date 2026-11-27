// Encoding of portable-snapshot records as Neo4j node properties, and back.
// Contract of the records: .kiro/specs/rapid-persistence-redesign/snapshot-format.md sections 1 and 2.
//
// Every record becomes one Neo4j node with the labels `Rec` and one label per record kind.
// The properties are the only source read back by the dump; relationships are derived from
// them at load time and exist for graph queries.
//
// Property scheme (one scheme for every record kind):
//   rk            `<kind>|<key string>`; unique over all `Rec` nodes.
//   kind          the record kind.
//   id            copy of the record's `id` when it is a string (indexed).
//   o             names of the record's fields in the order the JSON line had them.
//   f_<field>     a field whose value Neo4j stores natively: string, boolean, number, or a list
//                 of only strings / only booleans / only numbers (also the empty list).
//   j_<field>     any other field value (object, mixed or nested list, list with null), as JSON text.
//   a_<key> / aj_<key>, ao    one entry of `attributes` (native / JSON text) and its key order.
//   x_<key> / xj_<key>, xo    the same for `extra`.
//   j             the whole record as JSON text (fallback, see below).
//   ms_<field>    epoch milliseconds of a top-level canonical time string. Not part of `o`.
//   am_<key>      the same for a string in `attributes`.
//   xm_<key>      the same for a string in `extra`.
//
// Extension labels. Each `name@version` in `extensions` becomes one extra label:
// `Ext_` plus every character outside [A-Za-z0-9] replaced by `_`.
// `m3e:nodeType:task@1` → `Ext_m3e_nodeType_task_1`.
// The mapping is not injective. The record's `extensions` property is what is read back.
//
// Numbers: a safe integer is stored as a Neo4j Integer, any other number as a Float. JSON has
// one number type and JavaScript parses `1.0` as `1`, so this reproduces the JSON text exactly.
// A list of numbers is a list of Integers when all are safe integers, otherwise a list of Floats.
//
// Open maps (`attributes`, `extra`): the key is appended to the prefix unchanged, so `a_` + key
// is never empty, keys differing only by case stay distinct (property names are case sensitive),
// and a key that itself starts with `j_` (`a_j_x`) cannot be confused with a JSON entry (`aj_x`).
// Measured on Neo4j 2026.10.2: colons, dots, spaces, backticks, quotes, newlines, Japanese,
// emoji and 5,000-character names are accepted as property names. Two things are not: a
// null byte, and (through the UTF-8 wire format) a lone surrogate. So:
//   - a map with such a key is stored whole as JSON text in `j_attributes` / `j_extra`;
//   - a record with such a top-level field name is stored whole as JSON text in `j`;
//   - a string value with a lone surrogate is stored as JSON text (`j_…` / `aj_…` / `xj_…`);
//   - a record key (and therefore `rk`) with a lone surrogate is refused.

import neo4j from "neo4j-driver";
import { canonicalTimeMs } from "../../shared/record_model/extensions";
import { recordKeyString } from "../../shared/record_model/jsonl";
import type { JsonObject, JsonValue, RecordKind, SnapshotRecord } from "../../shared/record_model/types";

export const COMMON_LABEL = "Rec";

export const KIND_LABELS: Record<RecordKind, string> = {
  snapshot: "Snapshot",
  map: "Map",
  node: "M3eNode",
  details: "Details",
  connection: "Connection",
  scope: "Scope",
  linearText: "LinearText",
  surface: "Surface",
  nodeView: "NodeView",
  annotation: "Annotation",
  relationTypeDef: "RelationTypeDef",
  extensionDef: "ExtensionDef",
  prefix: "Prefix",
  account: "Account",
  commit: "Commit",
  idMap: "IdMap",
  lock: "Lock",
  grant: "Grant",
  namedSnapshot: "NamedSnapshot",
  decay: "Decay",
};

export const RELATIONSHIP_TYPES = ["SOURCE", "TARGET", "ROOT", "OF", "IN", "ON", "PLACES", "ALIAS_OF", "IN_MAP"] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/** A relationship wanted by a record. `to` lists candidate `rk`s; it is created to each one that exists. */
export interface RelationshipWish {
  type: RelationshipType;
  from: string[];
  to: string[];
}

export type PropertyMap = Record<string, unknown>;

export interface EncodedRecord {
  kind: RecordKind;
  rk: string;
  /** `Rec`, the kind label, then one `Ext_…` label per extension, in string order. */
  labels: string[];
  props: PropertyMap;
  relationships: RelationshipWish[];
}

const SAFE_LABEL = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Joins labels for a Cypher pattern. Refuses anything that is not a plain identifier. */
export function cypherLabelList(labels: readonly string[]): string {
  if (labels.length === 0) throw new Error("A record needs a Neo4j label.");
  for (const label of labels) {
    if (!SAFE_LABEL.test(label)) throw new Error(`Refusing a Neo4j label that is not a safe identifier: ${label}`);
  }
  return labels.join(":");
}

/** `name@version` → `Ext_` with every non-alphanumeric character replaced by `_`. */
export function extensionLabel(entry: string): string {
  return `Ext_${entry.replace(/[^A-Za-z0-9]/g, "_")}`;
}

export function labelsOf(record: SnapshotRecord): string[] {
  const labels = [COMMON_LABEL, KIND_LABELS[record.kind]];
  const extensions = (record as { extensions?: unknown }).extensions;
  if (!Array.isArray(extensions)) return labels;
  const extra = [...new Set(extensions.filter((entry): entry is string => typeof entry === "string").map(extensionLabel))].sort();
  return [...labels, ...extra];
}

const OPEN_MAPS: Record<string, { native: string; json: string; order: string }> = {
  attributes: { native: "a_", json: "aj_", order: "ao" },
  extra: { native: "x_", json: "xj_", order: "xo" },
};

const LONE_SURROGATE = /\p{Surrogate}/u;

function isWellFormed(text: string): boolean {
  return !LONE_SURROGATE.test(text);
}

function isSafePropertyName(name: string): boolean {
  return !name.includes("\u0000") && isWellFormed(name);
}

export function recordRk(record: SnapshotRecord): string {
  return `${record.kind}|${recordKeyString(record)}`;
}

function rkOf(kind: RecordKind, key: string): string {
  return `${kind}|${key}`;
}

/** The native Neo4j value for a JSON value, or `undefined` when it has to be stored as JSON text. */
function nativeValue(value: JsonValue): unknown {
  if (typeof value === "string") return isWellFormed(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isSafeInteger(value) ? neo4j.int(value) : value;
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return [];
  if (value.every((item) => typeof item === "string")) {
    return (value as string[]).every(isWellFormed) ? value : undefined;
  }
  if (value.every((item) => typeof item === "boolean")) return value;
  if (value.every((item) => typeof item === "number")) {
    const numbers = value as number[];
    return numbers.every((item) => Number.isSafeInteger(item)) ? numbers.map((item) => neo4j.int(item)) : numbers;
  }
  return undefined;
}

function putValue(props: PropertyMap, nativeName: string, jsonName: string, value: JsonValue): void {
  const native = nativeValue(value);
  if (native !== undefined) props[nativeName] = native;
  else props[jsonName] = JSON.stringify(value);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: SnapshotRecord, field: string): string | undefined {
  const value = (record as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function addEpoch(props: PropertyMap, prefix: string, key: string, value: unknown): void {
  if (typeof value !== "string") return;
  if (!isSafePropertyName(prefix + key)) return;
  const ms = canonicalTimeMs(value);
  if (ms !== undefined) props[prefix + key] = neo4j.int(ms);
}

function addEpochProps(props: PropertyMap, record: SnapshotRecord): void {
  const fields = record as unknown as Record<string, unknown>;
  for (const [field, value] of Object.entries(fields)) {
    if (field === "attributes" || field === "extra") continue;
    addEpoch(props, "ms_", field, value);
  }
  const attributes = fields.attributes;
  if (isPlainObject(attributes)) {
    for (const [key, value] of Object.entries(attributes)) addEpoch(props, "am_", key, value);
  }
  const extra = fields.extra;
  if (isPlainObject(extra)) {
    for (const [key, value] of Object.entries(extra)) addEpoch(props, "xm_", key, value);
  }
  if (record.kind === "node") {
    const valid = (record as { valid?: unknown }).valid;
    if (isPlainObject(valid)) {
      addEpoch(props, "ms_valid_", "from", valid.from);
      addEpoch(props, "ms_valid_", "to", valid.to);
    }
  }
}

function relationshipWishes(record: SnapshotRecord, rk: string): RelationshipWish[] {
  const wishes: RelationshipWish[] = [];
  const add = (type: RelationshipType, from: string[], to: string[]): void => {
    wishes.push({ type, from, to });
  };
  const self = [rk];
  const nodeRk = (id: string | undefined): string[] => (id === undefined ? [] : [rkOf("node", id)]);

  const mapId = record.kind === "map" ? undefined : stringField(record, "mapId");
  if (mapId !== undefined) add("IN_MAP", self, [rkOf("map", mapId)]);

  switch (record.kind) {
    case "connection": {
      // An edge connects nodes only; a graphlink endpoint is a node or another connection.
      const endpoint = (id: string | undefined): string[] => {
        if (id === undefined) return [];
        return record.type === "edge" ? [rkOf("node", id)] : [rkOf("node", id), rkOf("connection", id)];
      };
      add("SOURCE", endpoint(stringField(record, "source")), self);
      add("TARGET", self, endpoint(stringField(record, "target")));
      break;
    }
    case "scope":
      add("ROOT", self, nodeRk(stringField(record, "rootNodeId")));
      break;
    case "details":
      add("OF", self, nodeRk(stringField(record, "nodeId")));
      break;
    case "surface": {
      const scopeId = stringField(record, "scopeId");
      add("IN", self, scopeId === undefined ? [] : [rkOf("scope", scopeId)]);
      break;
    }
    case "nodeView": {
      const surfaceId = stringField(record, "surfaceId");
      add("ON", self, surfaceId === undefined ? [] : [rkOf("surface", surfaceId)]);
      add("PLACES", self, nodeRk(stringField(record, "nodeId")));
      break;
    }
    case "node": {
      const alias = (record as unknown as { alias?: unknown }).alias;
      const target = isPlainObject(alias) && typeof alias.target === "string" ? alias.target : undefined;
      add("ALIAS_OF", self, nodeRk(target));
      break;
    }
    default:
      break;
  }
  return wishes.filter((wish) => wish.from.length > 0 && wish.to.length > 0);
}

export function encodeRecord(record: SnapshotRecord): EncodedRecord {
  if (!(record.kind in KIND_LABELS)) throw new Error(`Unknown record kind: ${String(record.kind)}`);
  const rk = recordRk(record);
  if (!isWellFormed(rk)) throw new Error(`Record key has a lone surrogate and cannot be stored: ${JSON.stringify(rk)}`);

  const props: PropertyMap = { rk, kind: record.kind };
  const labels = labelsOf(record);
  const id = stringField(record, "id");
  if (id !== undefined) props.id = id;

  const entries = Object.entries(record as unknown as Record<string, JsonValue>);
  if (!entries.every(([field]) => isSafePropertyName(field))) {
    props.j = JSON.stringify(record);
    addEpochProps(props, record);
    return { kind: record.kind, rk, props, labels, relationships: relationshipWishes(record, rk) };
  }

  props.o = entries.map(([field]) => field);
  for (const [field, value] of entries) {
    if (field === "kind") continue;
    const open = OPEN_MAPS[field];
    if (open !== undefined && isPlainObject(value) && Object.keys(value).every(isSafePropertyName)) {
      const keys = Object.keys(value);
      if (keys.length > 0) props[open.order] = keys;
      for (const key of keys) putValue(props, open.native + key, open.json + key, value[key]);
      continue;
    }
    putValue(props, `f_${field}`, `j_${field}`, value);
  }
  addEpochProps(props, record);
  return { kind: record.kind, rk, props, labels, relationships: relationshipWishes(record, rk) };
}

function fromNative(value: unknown): JsonValue {
  if (neo4j.isInt(value)) return value.toNumber();
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(fromNative);
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  throw new Error(`Unexpected property value read from Neo4j: ${String(value)}`);
}

function hasOwn(props: PropertyMap, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, name);
}

function getValue(props: PropertyMap, nativeName: string, jsonName: string, where: string): JsonValue {
  if (hasOwn(props, nativeName)) return fromNative(props[nativeName]);
  if (hasOwn(props, jsonName)) return JSON.parse(String(props[jsonName])) as JsonValue;
  throw new Error(`Stored record is missing ${where}.`);
}

function stringList(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Stored record has a malformed ${where}.`);
  }
  return value as string[];
}

/** Rebuilds a record from the properties of its `Rec` node. Field and key order are restored. */
export function decodeRecord(props: PropertyMap): SnapshotRecord {
  const rk = String(props.rk);
  if (hasOwn(props, "j")) return JSON.parse(String(props.j)) as SnapshotRecord;
  const fields = stringList(props.o, `field order (${rk})`);
  // Object.fromEntries defines own properties, so a key such as `__proto__` survives.
  const entries: Array<[string, JsonValue]> = fields.map((field) => {
    if (field === "kind") return [field, String(props.kind)];
    const open = OPEN_MAPS[field];
    if (open !== undefined && !hasOwn(props, `f_${field}`) && !hasOwn(props, `j_${field}`)) {
      const keys = hasOwn(props, open.order) ? stringList(props[open.order], `${field} key order (${rk})`) : [];
      const inner = keys.map((key): [string, JsonValue] => [
        key,
        getValue(props, open.native + key, open.json + key, `${field}[${JSON.stringify(key)}] (${rk})`),
      ]);
      return [field, Object.fromEntries(inner)];
    }
    return [field, getValue(props, `f_${field}`, `j_${field}`, `field ${field} (${rk})`)];
  });
  return Object.fromEntries(entries) as unknown as SnapshotRecord;
}

/**
 * The label every record node of one store carries. One Neo4j database holds several stores
 * (a remote's workspace, a local's confirmed copy and its working store); the label keeps them
 * apart, and the store's `rk` constraint and indexes are made on it. A short hash of the name
 * keeps two names that sanitize alike apart.
 */
export function storeLabel(store: string): string {
  if (store === "") throw new Error("A store needs a name.");
  let hash = 0x811c9dc5;
  for (const char of store) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `S_${store.replace(/[^A-Za-z0-9]/g, "_")}_${hash.toString(36)}`;
}
