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
