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

## DAG Representation (tree + link overlay)

M3E persists exactly one structural tree plus optional graph links. If you want to
display or preserve a DAG, write it in this form:

1. Use `parentId` / `children` for a **spanning tree** (more precisely, an
   arborescence) of the DAG. This structural edge is what drives depth and layout.
2. Put every remaining dependency edge in `state.links`.
3. For dependency flow, use `sourceNodeId = prerequisite`,
   `targetNodeId = dependent`, and `direction = "forward"` consistently.
4. Keep chapter / category / group information in `attributes`, `note`, or color
   when the goal is dependency-aligned depth. Do not force those groupings into the
   structural parent chain if they would distort the DAG layout.
5. Keep one DAG inside one scope/root whenever possible. Scoped reads/writes clip
   links whose endpoints fall outside the requested subtree.

Recommended parent-selection rule when converting a DAG into a structural tree:

- Prefer the deepest already-placed prerequisite as the structural parent.
- Break ties by preferring a prerequisite from the same local group/chapter/topic.
- If a node has no prerequisite, attach it directly under the DAG root.

Optional metadata keys are domain-owned, but these are reasonable examples:

```typescript
attributes: {
  "dag:group": "entropy",
  "dag:kind": "theorem",
  "dag:layer": "4",
  "dag:role": "spanning" // or "root", "derived"
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

## Scoped link convention

This is an operational rule, not a full-map validation invariant:

- Keep `GraphLink` source/target inside the same scope when you expect scoped reads
  and scoped writes (`?scope=<nodeId>`) to preserve those links.
- If you split a conceptual DAG across scopes, subtree reads will omit links that
  point outside the loaded subtree, and subtree writes can only recreate links whose
  endpoints are included in the incoming scope payload.
- If cross-scope navigation matters more than preserving graph edges, use aliases or
  duplicate entry nodes at the scope boundary instead of relying on cross-scope links.

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
