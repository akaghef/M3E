// Fields split into canonical records. Tests enumerate these tables, not a separate field list.
export const NODE_FIELDS = new Set([
  "id", "parentId", "children", "edgeOrder", "nodeType", "scopeId", "edgeOutsideScope", "text", "collapsed", "details", "note",
  "attributes", "link", "targetNodeId", "aliasLabel", "access", "targetSnapshotLabel", "isBroken", "aliasOf",
  "extensions", "edgeRelationType", "edgeAttributes", "edgeExtensions", "valid", "copyOf",
]);
export const LINK_FIELDS = new Set([
  "id", "sourceNodeId", "targetNodeId", "relationType", "label", "direction", "style", "color",
  "sourcePort", "targetPort", "attributes", "extensions",
]);
export const NODE_VIEW_FIELDS = ["x", "y", "flowCol", "flowRow", "shape"] as const;

type Fields = Record<string, unknown>;
const fields = (value: unknown): value is Fields => !!value && typeof value === "object" && !Array.isArray(value);

/** The same written forms are used by projection and viewer-before comparison. */
export function writtenNodeValid(value: unknown): Fields | undefined {
  if (!fields(value)) return undefined;
  const valid: Fields = {};
  if (typeof value.from === "string" && value.from !== "") valid.from = value.from;
  if (typeof value.to === "string" && value.to !== "") valid.to = value.to;
  return Object.keys(valid).length ? valid : undefined;
}

export function writtenNodeCopyOf(value: unknown): Fields | undefined {
  if (!fields(value) || typeof value.source !== "string" || typeof value.mode !== "string" || typeof value.seq !== "number") return undefined;
  const copyOf: Fields = { source: value.source, seq: value.seq, mode: value.mode };
  if (typeof value.mapId === "string") copyOf.mapId = value.mapId;
  copyOf.ids = fields(value.ids) ? value.ids : {};
  return copyOf;
}
