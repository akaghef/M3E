# Reading the M3E Map

All endpoints live under `/api/maps/`. Each map has its own opaque ID — discover via `GET /api/maps` first if you don't already have one.

## List all maps

```bash
curl -s http://localhost:4173/api/maps
```

Returns `{ maps: [{ id, label, savedAt, nodeCount, charCount, tags, archived, pinned }] }`. Filter by `label` to find your target (e.g. `"開発"`, `"研究"`, `"AlgLibMove"`).

```bash
# Find DEV map ID
curl -s http://localhost:4173/api/maps | node -e "
const { maps } = JSON.parse(require('fs').readFileSync(0,'utf8'));
const dev = maps.find(m => m.label === '開発');
console.log(dev.id, dev.nodeCount, 'nodes');
"
```

## Fetch a full map

```bash
curl -s http://localhost:4173/api/maps/MAP_ID
```

Response:
```json
{
  "version": 1,
  "savedAt": "2026-04-16T17:47:05.281Z",
  "mapId": "map_BG9BZP6NRDTEH1JYNDFGS6S3T5",
  "state": {
    "rootId": "n_1775547979694_t8k38i",
    "nodes": { "<id>": { ... }, ... },
    "links": {}
  }
}
```

## Subtree read (preferred for large maps)

When you only need a portion, use `?scope=<nodeId>&depth=N` to avoid loading the whole state:

```bash
curl -s "http://localhost:4173/api/maps/MAP_ID?scope=n_xxx_yyy&depth=3"
```

`depth=0` = just the scope node; `depth=N` = N levels of descendants. Omit `depth` for the entire subtree.

## Resolve a path to a node ID

When the user gives a path like `Map:Root/SYSTEM/DEV/reviews/Alias Impl`, use the resolve endpoint instead of walking the tree:

```bash
curl -s "http://localhost:4173/api/maps/MAP_ID/resolve?path=Map:Root/SYSTEM/DEV/reviews/Alias%20Impl"
```

Success:
```json
{ "ok": true, "mapId": "...", "nodeId": "n_...", "matched": ["Root","SYSTEM","DEV","reviews","Alias Impl"] }
```

- `Map:` prefix optional (case-insensitive)
- Leading `Root` optional
- Default separator `/`; pass `&sep=>` if a segment text contains `/`
- On `PATH_AMBIGUOUS` (409), response includes `candidates: [nodeId, ...]` — surface them to the user

Once you have the `nodeId`, prefer scoped read/write: `GET /api/maps/{mapId}?scope=<nodeId>` and `POST .../{mapId}?scope=<nodeId>`.

## Common read patterns

### Display as tree

```bash
curl -s http://localhost:4173/api/maps/MAP_ID | node -e "
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

### Find nodes by text

```bash
curl -s http://localhost:4173/api/maps/MAP_ID | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const matches = Object.values(d.state.nodes).filter(n => n.text.includes('SEARCH'));
matches.forEach(n => console.log(n.id, n.text));
"
```

### Get node details

```bash
curl -s http://localhost:4173/api/maps/MAP_ID | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const n = d.state.nodes['NODE_ID'];
console.log(JSON.stringify(n, null, 2));
"
```

### Read styled fills

```bash
curl -s http://localhost:4173/api/maps/MAP_ID | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
const colored = Object.values(d.state.nodes).filter(n => n.attributes && n.attributes['m3e:style']);
console.log('Colored nodes:', colored.length);
"
```

### Count nodes

```bash
curl -s http://localhost:4173/api/maps/MAP_ID | node -e "
const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('Total nodes:', Object.keys(d.state.nodes).length);
"
```

## Audit log

Every save is logged. Read the recent N entries:

```bash
curl -s "http://localhost:4173/api/maps/MAP_ID/audit?limit=50"
```

## Check if server is running

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:4173/api/maps
```

Returns `200` if running. If down, tell the user:
```bash
cd beta && npm start
```
