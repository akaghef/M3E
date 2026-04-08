# Reading the M3E Map

## Fetch the full map

```bash
curl -s http://localhost:38482/api/docs/rapid-main
```

Response:
```json
{
  "version": 1,
  "savedAt": "2026-04-07T14:22:52.570Z",
  "state": {
    "rootId": "n_1775547979694_t8k38i",
    "nodes": { "<id>": { ... }, ... },
    "links": {}
  }
}
```

## Common read patterns

### Display as tree

Fetch the map and recursively walk from the root:

```bash
curl -s http://localhost:38482/api/docs/rapid-main | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const nodes = d.state.nodes;
function tree(id, depth=0) {
  const n = nodes[id]; if(!n) return;
  const type = n.nodeType === 'folder' ? ' [folder]' : '';
  const det = n.details ? ' -- ' + n.details.slice(0,60) : '';
  console.log('  '.repeat(depth) + n.text + type + det);
  (n.children||[]).forEach(c => tree(c, depth+1));
}
tree(d.state.rootId);
"
```

### Display a subtree

To show only the subtree under a specific node, find it first:

```bash
curl -s http://localhost:38482/api/docs/rapid-main | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const nodes = d.state.nodes;
const target = Object.values(nodes).find(n => n.text === 'SEARCH_TEXT');
if (!target) { console.log('Not found'); process.exit(1); }
function tree(id, depth=0) {
  const n = nodes[id]; if(!n) return;
  console.log('  '.repeat(depth) + n.text);
  (n.children||[]).forEach(c => tree(c, depth+1));
}
tree(target.id);
"
```

### Find nodes by text

```bash
curl -s http://localhost:38482/api/docs/rapid-main | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const matches = Object.values(d.state.nodes).filter(n => n.text.includes('SEARCH'));
matches.forEach(n => console.log(n.id, n.text));
"
```

### Get node details

```bash
curl -s http://localhost:38482/api/docs/rapid-main | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const n = d.state.nodes['NODE_ID'];
console.log(JSON.stringify(n, null, 2));
"
```

### Count nodes

```bash
curl -s http://localhost:38482/api/docs/rapid-main | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('Total nodes:', Object.keys(d.state.nodes).length);
"
```

## Check if server is running

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:38482/api/docs/rapid-main
```

Returns `200` if running, connection error otherwise. If the server is down, tell the user to start it:
```bash
cd beta && npm start
```
