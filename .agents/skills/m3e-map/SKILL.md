---
name: m3e-map
description: |
  Read and write the M3E mind-map via local REST API at `/api/maps/`.
  Use this skill whenever the user asks to view, query, add, update, move, color,
  delete, or restructure nodes in an M3E map, or when they mention "map", "node",
  "tree", "色付け", "ノード", or refer to the M3E viewer.
  Also trigger on bulk edits, structural reorganization, listing/creating/renaming
  maps, resolving paths copied from the viewer, or operating on style attributes
  (fill / urgency / importance / status).
---

# M3E Map API Skill

Operate on the M3E mind-map through its local REST API.

## API Basics

- **Base URL**: `http://localhost:4173` (beta — default for dev / agent operations; override with `M3E_PORT` env var. final は `38482`)
- **Content-Type**: `application/json; charset=utf-8`
- **Auth**: None (local only)
- **Map ID**: Each map has its own opaque ID like `map_BG9BZP6NRDTEH1JYNDFGS6S3T5`. There is **no default doc ID** — discover the target map via `GET /api/maps` (filter by `label`).

## Workflow

For any map operation, follow this sequence:

1. **Identify the map** — if not given, list `GET /api/maps` and pick by `label` (e.g. "開発" = DEV, "研究" = RESEARCH)
2. **Read the display contract first** — for writes, determine the target facet and display goals before touching structure (see `references/facet-contracts.md` and `references/display-intent.md`)
3. **Read** the current state (see `references/read.md`)
4. **Modify** in-memory while maintaining invariants and the chosen display contract (see `references/data-model.md`)
5. **Write** the full state back via POST or PUT (see `references/write.md`)
6. **Verify** the response — success returns `{ "ok": true, "savedAt": "...", "mapId": "..." }`

For complex modifications (>3 nodes), write a one-shot Node.js script to `%TEMP%` (Windows) / `/tmp` and execute. **Bash `/tmp` ≠ Node.js `/tmp` on Windows** — use absolute Windows path like `c:/Users/Akaghef/AppData/Local/Temp/script.js` when invoking `node`. For 1-3 node changes, inline JSON with curl is fine.

## Human-First Principle

M3E is for **structural dialogue between humans and AI**. When writing a map, optimize first for:

1. human review speed
2. human visual parsing
3. preserving semantic structure

This means:

- do not jump straight from raw user text to node placement
- determine the relevant **facet contract**
- determine the **display intent** for this write
- only then choose anchoring, ordering, links, colors, and collapse state

When the user gives a writing request that implies structure and visual policy, treat it as a **display-governed write**, not a plain CRUD operation.

## Write-Time Decision Order

For any non-trivial write, follow this exact order:

1. **Facet detection** — what kind of structure is this? (`flow`, `dependency`, `reviews`, `timeseries`, `document`, etc.)
2. **Facet contract lookup** — what does tree/link/alias mean in this facet?
3. **Display intent extraction** — what should be visually optimized for this specific write?
4. **Anchoring decision** — should synthetic grouping nodes be inserted for readability?
5. **Color/style decision** — what visual channels should encode importance, urgency, confidence, status, etc.?
6. **Concrete write** — create/move/update nodes and links
7. **Post-write verification** — reread and confirm the resulting view matches the display intent

Do not invert this order. In particular, do **not** decide anchoring or coloring before the facet and display intent are clear.

## Quick Endpoint Reference

### Map collection (home / list)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/maps` | List all maps (returns `{maps: [{id, label, savedAt, nodeCount, charCount, tags, archived, pinned}]}`) |
| POST | `/api/maps/new` | Create a new empty map |
| POST | `/api/maps/import-file` | Import map from uploaded JSON file |
| POST | `/api/maps/import-vault` | Import map from a vault folder |

### Per-map operations

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/maps/{mapId}` | Read entire map state (supports `?scope=<nodeId>&depth=N` for subtree read) |
| POST | `/api/maps/{mapId}` | Save entire map state (supports `?scope=<nodeId>` for subtree write); PUT also accepted |
| DELETE | `/api/maps/{mapId}` | Delete a map permanently |
| GET | `/api/maps/{mapId}/resolve?path=Map:Root/...` | Resolve a path string to a `nodeId` |
| POST | `/api/maps/{mapId}/duplicate` | Duplicate map |
| POST | `/api/maps/{mapId}/rename` | Rename (`{label}` body) |
| POST | `/api/maps/{mapId}/archive` | Archive |
| POST | `/api/maps/{mapId}/restore` | Restore from archive |
| POST | `/api/maps/{mapId}/tags` | Set tags (`{tags: [...]}` body) |
| PATCH/POST | `/api/maps/{mapId}/pin` | Toggle pinned |
| POST | `/api/maps/{mapId}/bind-vault` | Bind to a vault folder |
| POST | `/api/maps/{mapId}/unbind-vault` | Unbind |

The save response is:
```json
{ "ok": true, "savedAt": "ISO-8601", "mapId": "...", "integrationMode": "off|on", "sourceOfTruth": "sqlite" }
```

### Path format (`Map:` convention)

User-copied paths from the viewer (right-click → "Copy path") use the form `Map:Root/Child/Grandchild`. The `Map:` prefix is optional on the API (accepted case-insensitively). A leading `Root` segment (or the root node's own text) resolves to the document root.

- Success: `{ ok: true, mapId, nodeId, matched: ["Root", ...] }`
- `PATH_NOT_FOUND` (404): no child with that text under the current parent
- `PATH_AMBIGUOUS` (409): multiple children share the segment text; response includes `candidates: [nodeId, ...]`
- Custom separator: pass `&sep=>` (or any single char) if a segment text contains `/`

Prefer `resolve` + `?scope=<nodeId>` over loading the full state when the user gave you a path.

## Node Decoration: `m3e:style`

Visual decoration is stored as a JSON string under `node.attributes["m3e:style"]`. Recognized keys:

| Key | Type | Meaning |
|---|---|---|
| `fill` | hex string | Background color (e.g. `"#ffe5b4"`); omit/absent = no fill |
| `border` | hex string | Border color |
| `text` | hex string | Text color |
| `urgency` | 0..3 int | Auto-derives a fill via U×I bilinear interpolation if `fill` absent |
| `importance` | 0..3 int | (paired with urgency) |
| `status` | string | One of `placeholder` / `confirmed` / `contested` / `frozen` / `active` / `review` |

**Always merge** rather than overwrite — read the existing `m3e:style`, parse, mutate one key, re-serialize. Never blow away `border`/`text` when only changing `fill`. If the resulting object is empty, `delete attributes["m3e:style"]` rather than leaving `"{}"`.

### Color palette (built-in viewer presets)

The viewer's `c` shortcut palette uses these 10 swatches — match them when bulk-coloring for visual consistency:

| Slot | Label | Hex |
|---|---|---|
| 1 | Clear | (delete fill) |
| 2 | White | `#ffffff` |
| 3 | Urgent low | `#ffe5b4` (peach) |
| 4 | Urgent mid | `#ffb074` |
| 5 | Urgent high | `#ff6b4a` (vermilion) |
| 6 | Urgent top | `#ff0000` (red) |
| 7 | Important low | `#e1ecff` (pale blue) |
| 8 | Important mid | `#9ec5ff` |
| 9 | Important high | `#5a8dff` |
| 10 | Important top | `#0000ff` |

White→red urgency gradient: slots 2→3→4→5→6. White→blue importance gradient: slots 2→7→8→9→10.

## Default Coloring (run after structural writes)

After any **structural** mutation to a map (add/move/delete/restructure nodes; bulk imports; large content rewrites), refresh visual coloring as a final pass. Default heuristic: **white→red gradient by estimated execution difficulty** using `scripts/color_by_difficulty.js`.

```bash
node "<skill-path>/scripts/color_by_difficulty.js" <mapId>
# preview without writing:
node "<skill-path>/scripts/color_by_difficulty.js" <mapId> --dry
# different port:
node "<skill-path>/scripts/color_by_difficulty.js" <mapId> --port 38482
```

Behavior:
- 5 buckets → palette slots `Clear / Urgent low / mid / high / top` (white / peach / orange / vermilion / red)
- Preserves existing `m3e:style` keys (border, text, urgency, importance, status)
- Backs up the pre-write doc to `%TEMP%/<mapId>_before.json`
- Tries POST then falls back to PUT

**Apply map-wide.** Don't carve out subtrees by `?scope=` and don't exempt nodes by name (DAG, meta, status board, etc.) — uniform pass over the whole map. The user wants the entire map color-coded so eye-scan reveals difficulty hot spots without subjective curation.

Skip the default pass only when:
- The user explicitly asks for a different color scheme (then use that instead)
- The change is purely a single-node attribute tweak with no structural effect
- The user says "no color" / "skip color"

When unsure whether a change warrants a refresh, run it — the cost is one HTTP round-trip and the result is idempotent.

## Reference Files

| File | When to read |
|------|-------------|
| `references/data-model.md` | Node structure, ID format, invariants, alias/link rules, `m3e:style` schema |
| `references/facet-contracts.md` | Determine what tree / link / alias mean in each facet before writing |
| `references/display-intent.md` | Determine anchoring, ordering, color, and visibility from the human-facing display goal |
| `references/read.md` | Reading or querying maps; tree display; node search |
| `references/write.md` | Adding, updating, moving, deleting nodes; bulk script template; coloring template |
| `scripts/color_by_difficulty.js` | Default white→red difficulty coloring pass (run after structural writes) |

## Displaying the Tree

When the user asks to see map structure, fetch and render as an indented tree:

```
Root
├── Child 1
│   └── Grandchild
├── Child 2 [folder]
│   ├── Item A
│   └── Item B
└── Child 3
```

Include node type markers like `[folder]`, status from `m3e:style`, and color hint when relevant.

## Common Gotchas

- **Wrong endpoint prefix**: Old docs may say `/api/docs/` — that path no longer exists. Always use `/api/maps/`.
- **No default doc**: Don't hardcode `akaghef-beta` or similar — always discover via `/api/maps`.
- **Bash `/tmp` ≠ Node.js `/tmp`** on Windows: bash maps to `C:/Users/<user>/AppData/Local/Temp` but Node.js (Windows-native) sees `/tmp` as `C:\tmp`. Pass absolute Windows paths (`c:/Users/.../AppData/Local/Temp/x.js`) to `node`.
- **POST replaces full state** unless you use `?scope=<nodeId>`. Always read first.
- **Save invariants**: bidirectional parent/children links, no orphans, no cycles, root has `parentId: null`. Server rejects with `{ ok: false, error: ... }` on violation.
- **One-shot scripts go to `%TEMP%`**, not `scripts/` in the repo (project memory: `feedback_oneshot_scripts_tmp`).
