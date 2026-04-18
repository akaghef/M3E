# Writing the M3E Map

POST or PUT replaces the entire document state (or the subtree if `?scope=<nodeId>` is set). **Always read first**, modify, then write back.

## Pre-Write Sequence For Structured Writes

Before mutating a map for anything more complex than trivial CRUD, follow this order:

1. identify the target facet (`flow`, `dependency`, `reviews`, `timeseries`, `document`, ...)
2. read the facet contract (`facet-contracts.md`)
3. extract the display intent (`display-intent.md`)
4. decide whether anchoring is active
5. decide what color encodes
6. only then create/move/reorder nodes and links

This sequence is mandatory for writes where presentation matters.

Reason:

- M3E is for human structural review
- the same tree operation means different things in different facets
- anchoring and coloring are not generic post-processes; they are often part of the write's core display contract

## Save endpoint

```bash
curl -s -X POST http://localhost:4173/api/maps/MAP_ID \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"state": { "rootId": "...", "nodes": {...}, "links": {...} }}'
```

PUT is also accepted with the same semantics. Successful response:
```json
{ "ok": true, "savedAt": "...", "mapId": "MAP_ID", "integrationMode": "off", "sourceOfTruth": "sqlite" }
```

Error response (invariant violation):
```json
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

### Subtree write

To replace only a subtree, pass `?scope=<nodeId>`. The request body should be a state object whose `rootId` matches the scope node's ID. The server merges this back into the parent map.

## Common write operations

### Add a node

1. Read the current state
2. Create a node with a fresh ID (see `data-model.md` for ID format)
3. Set `parentId` to the target parent
4. Append the new ID to the parent's `children` array
5. Add the node to `state.nodes`
6. POST the updated state

```javascript
const newId = `n_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
state.nodes[newId] = {
  id: newId,
  parentId: parentId,
  children: [],
  nodeType: "text",
  text: "New Task",
  collapsed: false,
  details: "",
  note: "",
  attributes: {},
  link: ""
};
state.nodes[parentId].children.push(newId);
```

### Add a synthetic anchor

Use an anchor only when the display intent calls for grouping that improves reviewability without inventing false semantics.

```javascript
const anchorId = `n_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
state.nodes[anchorId] = {
  id: anchorId,
  parentId,
  children: [],
  nodeType: "text",
  text: "API設計",
  collapsed: false,
  details: "",
  note: "Display anchor for review grouping.",
  attributes: {
    "m3e:facet": "reviews",
    "m3e:display-role": "anchor",
    "m3e:synthetic": "anchor"
  },
  link: ""
};
state.nodes[parentId].children.push(anchorId);
```

Prefer anchor insertion when:

- many low-cohesion siblings would be visually noisy
- the anchor creates a useful review batch

Avoid anchor insertion when:

- siblings form a meaningful serial progression
- the anchor would look like a new semantic stage

### Update node content

Modify fields in place — `text`, `details`, `note`, `attributes`, etc.

```javascript
state.nodes[nodeId].text = "Updated text";
state.nodes[nodeId].details = "More info here";
```

### Color a node (or any `m3e:style` change)

Always **merge** — never overwrite — to preserve other style keys (`border`, `text`, `urgency`, `importance`, `status`):

```javascript
function setFill(node, color) {
  node.attributes = node.attributes || {};
  let style = {};
  const raw = node.attributes["m3e:style"];
  if (raw) {
    try { const p = JSON.parse(raw); if (p && typeof p === "object") style = p; }
    catch { style = {}; }
  }
  if (color === null) delete style.fill;
  else style.fill = color;
  if (Object.keys(style).length > 0) node.attributes["m3e:style"] = JSON.stringify(style);
  else delete node.attributes["m3e:style"];
}
// Use viewer palette colors for visual consistency:
setFill(state.nodes[nodeId], "#ffb074"); // urgent mid
setFill(state.nodes[nodeId], null);       // clear fill
```

See SKILL.md for the full 10-color palette and the urgency/importance/status keys.

### Apply display-intent color semantics

If the user specified visual meaning, apply it intentionally instead of relying only on the default difficulty coloring pass.

Examples:

- review question node
  - fill = importance
  - border = urgency
- option node
  - fill = confidence
- synthetic anchor
  - usually neutral / low-emphasis unless the user asked otherwise

In those cases:

1. set the semantic display colors while writing
2. skip the default difficulty coloring if it would overwrite the intended review semantics

The default color pass is only for cases where no stronger display contract is present.

### Move a node (reparent)

```javascript
const node = state.nodes[nodeId];
const oldParent = state.nodes[node.parentId];
oldParent.children = oldParent.children.filter(c => c !== nodeId);
node.parentId = newParentId;
state.nodes[newParentId].children.push(nodeId);
```

### Delete a node (and descendants)

```javascript
function collectDescendants(id, nodes) {
  const ids = [id];
  for (const childId of (nodes[id]?.children || [])) {
    ids.push(...collectDescendants(childId, nodes));
  }
  return ids;
}

const toDelete = collectDescendants(nodeId, state.nodes);
const parent = state.nodes[state.nodes[nodeId].parentId];
parent.children = parent.children.filter(c => c !== nodeId);
for (const id of toDelete) delete state.nodes[id];

// Clean up any links touching deleted nodes
if (state.links) {
  for (const [linkId, link] of Object.entries(state.links)) {
    if (toDelete.includes(link.sourceNodeId) || toDelete.includes(link.targetNodeId)) {
      delete state.links[linkId];
    }
  }
}
```

### Reorder children

```javascript
const parent = state.nodes[parentId];
parent.children = parent.children.filter(c => c !== childId);
parent.children.unshift(childId); // move to front
```

## Bulk script template

For complex changes, write a one-shot script to `%TEMP%` and run it:

```javascript
// Save as c:/Users/Akaghef/AppData/Local/Temp/bulk_op.js
// Run: node "c:/Users/Akaghef/AppData/Local/Temp/bulk_op.js"
const http = require("http");

const HOST = "127.0.0.1", PORT = 4173;
const MAP_ID = "map_XXXXXXXXXX";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
    const req = http.request({
      host: HOST, port: PORT, method, path,
      headers: data
        ? { "Content-Type": "application/json; charset=utf-8", "Content-Length": data.length }
        : {},
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(text)); } catch { resolve(text); }
        } else reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const doc = await request("GET", `/api/maps/${MAP_ID}`);
  // ... mutate doc.state.nodes ...
  const result = await request("POST", `/api/maps/${MAP_ID}`, doc);
  console.log(JSON.stringify(result));
})().catch(e => { console.error(e.message); process.exit(1); });
```

**Path gotcha on Windows**: bash `/tmp` does not equal Node.js `/tmp`. Use absolute Windows paths (`c:/Users/Akaghef/AppData/Local/Temp/...`) when invoking `node`. Verify with `pwd -W` if confused.

Keep one-shot scripts in `%TEMP%`, not the repo's `scripts/` folder (project memory `feedback_oneshot_scripts_tmp`). Delete after use, or let the OS clean it up.

## Example Reasoning Pattern: Reviews Map

If the request is:

- many questions
- review is tangled
- cluster by context
- color questions by importance/urgency
- color options by confidence
- keep it unscoped

then the write pattern should be:

1. facet = `reviews`
2. display intent = `unscoped`, `anchored by context`, `question triage colors`, `option confidence colors`
3. create synthetic anchors for context clusters
4. place Q nodes under anchors
5. place options under Q nodes
6. place rationale/downside under options
7. apply review colors intentionally
8. skip generic difficulty recoloring if it would destroy the review semantics

## Map-level operations

### Create a new map

```bash
curl -s -X POST http://localhost:4173/api/maps/new \
  -H "Content-Type: application/json" \
  -d '{"label": "New Map"}'
```

### Rename / archive / restore / tags / pin

```bash
curl -s -X POST http://localhost:4173/api/maps/MAP_ID/rename \
  -H "Content-Type: application/json" \
  -d '{"label": "New Name"}'

curl -s -X POST http://localhost:4173/api/maps/MAP_ID/archive
curl -s -X POST http://localhost:4173/api/maps/MAP_ID/restore

curl -s -X POST http://localhost:4173/api/maps/MAP_ID/tags \
  -H "Content-Type: application/json" \
  -d '{"tags": ["dev", "active"]}'

curl -s -X PATCH http://localhost:4173/api/maps/MAP_ID/pin
```

### Delete a map (destructive)

```bash
curl -s -X DELETE http://localhost:4173/api/maps/MAP_ID
```

Confirm with the user before deleting — there's no undo.

## Safety checklist

Before POSTing, verify:

- [ ] Every node in `children` exists in `nodes`
- [ ] Every node's `parentId` points to a node that lists it in `children`
- [ ] Root node has `parentId: null`
- [ ] No node references a deleted node
- [ ] `links` endpoints reference existing non-alias nodes
- [ ] `m3e:style` JSON keys preserved on partial updates (don't overwrite `border` when changing `fill`)
