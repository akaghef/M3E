# Writing the M3E Map

POST replaces the entire document state. **Always read first**, modify, then write back.

## Save endpoint

```bash
curl -s -X POST http://localhost:4173/api/maps/{mapId} \
  -H "Content-Type: application/json" \
  -d '{"state": { "rootId": "...", "nodes": {...}, "links": {...} }}'
```

Success response:
```json
{ "ok": true, "savedAt": "...", "documentId": "akaghef-beta" }
```

Error response (invariant violation):
```json
{ "ok": false, "error": "..." }
```

## Common write operations

### Add a node

1. Read the current state
2. Create a new node with a fresh ID (see `data-model.md` for ID format)
3. Set `parentId` to the target parent
4. Append the new ID to the parent's `children` array
5. Add the node to `state.nodes`
6. POST the updated state

```javascript
// Example: add "New Task" under parent node
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
state.nodes[nodeId].attributes = { status: "done" };
```

### Move a node (reparent)

1. Remove node ID from old parent's `children`
2. Update node's `parentId` to new parent
3. Append node ID to new parent's `children`

```javascript
const node = state.nodes[nodeId];
const oldParent = state.nodes[node.parentId];
oldParent.children = oldParent.children.filter(c => c !== nodeId);
node.parentId = newParentId;
state.nodes[newParentId].children.push(nodeId);
```

### Delete a node (and descendants)

1. Collect the node and all descendants recursively
2. Remove each from `state.nodes`
3. Remove the node's ID from its parent's `children`
4. Remove any GraphLinks referencing deleted nodes

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
for (const id of toDelete) {
  delete state.nodes[id];
}
// Also clean up links
if (state.links) {
  for (const [linkId, link] of Object.entries(state.links)) {
    if (toDelete.includes(link.sourceNodeId) || toDelete.includes(link.targetNodeId)) {
      delete state.links[linkId];
    }
  }
}
```

### Reorder children

Change the order of IDs in the parent's `children` array:

```javascript
// Move child to position 0 (first)
const parent = state.nodes[parentId];
parent.children = parent.children.filter(c => c !== childId);
parent.children.unshift(childId);
```

### Bulk operations

For complex changes (adding many nodes, restructuring), write a temporary Node.js script:

```javascript
const http = require("http");

// 1. GET current state
http.get("http://localhost:4173/api/maps/{mapId}", (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    const doc = JSON.parse(data);
    const state = doc.state;

    // 2. Modify state
    // ... your changes here ...

    // 3. POST back
    const body = JSON.stringify({ state });
    const req = http.request({
      hostname: "localhost", port: 4173,
      path: "/api/maps/rapid-main", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, (res2) => {
      let out = "";
      res2.on("data", c => out += c);
      res2.on("end", () => console.log(out));
    });
    req.write(body);
    req.end();
  });
});
```

Clean up the script file after use.

## Safety checklist

Before POSTing, verify:

- [ ] Every node in `children` exists in `nodes`
- [ ] Every node's `parentId` points to a node that lists it in `children`
- [ ] Root node has `parentId: null`
- [ ] No node references a deleted node
- [ ] `links` endpoints reference existing non-alias nodes
