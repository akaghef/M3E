---
name: m3e-map
description: |
  Read and write the M3E mind-map via local REST API. Use this skill whenever the user asks to view, query, add, update, move, or delete nodes in their M3E map, or when they mention "map", "node", "tree", or refer to the M3E viewer. Also trigger when the user asks about map structure, wants to reorganize nodes, or requests bulk edits to the map.
---

# M3E Map API Skill

Operate on the M3E mind-map through its local REST API.

## API Basics

- **Base URL**: `http://localhost:38482` (override with `M3E_PORT` env var)
- **Content-Type**: `application/json; charset=utf-8`
- **Auth**: None (local only)
- **Document ID**: `rapid-main` (the default working document)

## Workflow

For any map operation, follow this sequence:

1. **Read** the current state first (see `references/read.md`)
2. **Modify** the in-memory state while maintaining invariants (see `references/data-model.md`)
3. **Write** the full state back (see `references/write.md`)
4. **Verify** the response for `"ok": true`

For complex modifications (many nodes), write a temporary Node.js script that constructs the state and POSTs it, then delete the script afterwards. For simple changes (1-3 nodes), inline JSON with curl is fine.

## Reference Files

| File | When to read |
|------|-------------|
| `references/data-model.md` | When you need to understand node structure, ID format, invariants, or how to construct/modify nodes |
| `references/read.md` | When reading or querying the map |
| `references/write.md` | When adding, updating, moving, or deleting nodes |

## Quick Reference

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/docs/{docId}` | Read entire map state |
| POST | `/api/docs/{docId}` | Save entire map state (full replace) |

### Displaying the Tree

When the user asks to see the map structure, fetch it and render as an indented tree:

```
Root
├── Child 1
│   └── Grandchild
├── Child 2 [folder]
│   ├── Item A
│   └── Item B
└── Child 3
```

Include node type markers like `[folder]` and status from attributes when relevant.
