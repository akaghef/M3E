# M3E Data Model

## Node Structure (TreeNode)

Every node has these fields — all are required when writing:

```typescript
{
  id: string,            // Format: n_{timestamp_ms}_{random_6chars}
  parentId: string|null, // null only for root
  children: string[],    // ordered child IDs
  nodeType?: "text"|"image"|"folder"|"alias",  // default "text"
  text: string,          // main content
  collapsed: boolean,    // fold state
  details: string,       // extended description
  note: string,          // comments/notes
  attributes: Record<string, string>,  // key-value metadata
  link: string           // external URL
}
```

### Alias-specific fields (only when `nodeType === "alias"`)

- `targetNodeId?: string` — reference target
- `aliasLabel?: string` — display name override
- `access?: "read"|"write"` — permission level
- `isBroken?: boolean` — broken reference flag

## Graph Links (optional)

Stored in `state.links` as `Record<string, GraphLink>`:

```typescript
{
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  relationType?: string,
  label?: string,
  direction?: "none"|"forward"|"backward"|"both",
  style?: "default"|"dashed"|"soft"|"emphasis"
}
```

## Document Envelope (SavedDoc)

```typescript
{
  version: 1,
  savedAt: string,       // ISO 8601 timestamp
  state: {
    rootId: string,
    nodes: Record<string, TreeNode>,
    links?: Record<string, GraphLink>
  }
}
```

## Generating Node IDs

Timestamp in ms + 6 random alphanumeric chars:

```javascript
const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```

When adding multiple nodes, increment the timestamp:
```javascript
const ts = Date.now();
const id1 = `n_${ts}_${Math.random().toString(36).slice(2, 8)}`;
const id2 = `n_${ts + 1}_${Math.random().toString(36).slice(2, 8)}`;
```

## Critical Invariants

The server validates these on every save. Violations cause a rejected POST:

1. **Root must exist** — `state.rootId` must point to an existing node with `parentId: null`
2. **Bidirectional consistency** — if node A lists B in `children`, then B's `parentId` must be A, and vice versa
3. **No orphans** — every non-root node must be reachable from the root
4. **No cycles** — the tree must be acyclic
5. **Alias constraints** — alias nodes cannot have children, cannot chain to other aliases
6. **Link endpoints** — GraphLink source/target must reference existing non-alias nodes

## Helper: Build a new node

```javascript
function makeNode(id, parentId, text, opts = {}) {
  return {
    id,
    parentId,
    children: opts.children || [],
    nodeType: opts.nodeType || "text",
    text,
    collapsed: false,
    details: opts.details || "",
    note: opts.note || "",
    attributes: opts.attributes || {},
    link: opts.link || "",
  };
}
```

## Display-Oriented Metadata Conventions

When synthetic display structures are introduced, make them explicit in `attributes`.

Recommended keys:

```typescript
{
  "m3e:facet"?: string,         // e.g. flow, dependency, reviews, timeseries, document
  "m3e:display-role"?: string,  // e.g. anchor, question, option, rationale, downside, stage
  "m3e:synthetic"?: "anchor"    // mark display-synthetic nodes that are not semantic source nodes
}
```

Use these when:

- an anchor is inserted only for readability
- a node exists mainly to satisfy display intent
- later re-anchoring should be possible without confusing the semantic leaf nodes

Do not mark genuine source hierarchy nodes as synthetic just because they help the display.
