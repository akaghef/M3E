# Writing the M3E Map

POST or PUT replaces the entire document state (or the subtree if `?scope=<nodeId>` is set). **Always read first**, modify, then write back.

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

## Write a DAG

M3E does not store a free-form DAG directly in `children`. The reliable pattern is:

1. Build a **spanning tree** of the DAG in `parentId` / `children`
2. Store every non-tree edge in `state.links`
3. Keep grouping metadata (`chapter`, `topic`, `phase`, etc.) in `attributes` or
   style, not in the structural parent chain, when you want depth to follow the DAG

Minimal recipe:

```javascript
function addDagLink(state, sourceNodeId, targetNodeId, relationType = "depends_on") {
  state.links ||= {};
  const linkId = `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  state.links[linkId] = {
    id: linkId,
    sourceNodeId,   // prerequisite
    targetNodeId,   // dependent
    relationType,
    direction: "forward",
    style: "default",
  };
}
```

Recommended conversion policy:

- Choose one prerequisite per node as the structural parent so vertical depth tracks
  the main dependency chain.
- Prefer the deepest available prerequisite as that parent.
- Attach source/root nodes with no prerequisite directly under one shared DAG root.
- Put all other prerequisites into `state.links`.
- Keep the whole DAG under one scope if you need scoped reads/writes to preserve the
  overlay links.

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
- [ ] Structural `parentId` / `children` still form a tree even if the conceptual model is a DAG
- [ ] `links` endpoints reference existing non-alias nodes
- [ ] DAG-style links use a consistent direction (`source = prerequisite`, `target = dependent`, `direction = "forward"`)
- [ ] Nodes that must keep their overlay links after scoped reads/writes live inside the same scope
- [ ] `m3e:style` JSON keys preserved on partial updates (don't overwrite `border` when changing `fill`)
