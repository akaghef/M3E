---
name: mindmap-notation
description: Normalize official M3E human-facing map notation, including > and >> paths, legacy Map:Root compatibility, MF-* and WMF-* style references, and node operation shorthand.
---
# Mindmap Notation Skill

## Canonical path forms

- Standard instruction path: `M:(開発)> SYSTEM > DEV >> scratch`
- Scope transition: `M:(開発)> A > B >> C`
- Legacy/API compatibility path: `Map:Root/SYSTEM/DEV/scratch`
- ID reference: `#n_1234567890_abc123`
- Current scope: `@scope`

`>` and `>>` are official. `/` is non-official legacy/API/external compatibility only. `\` is filesystem only.

## Operation shorthand

- Add: `+ "New node" under M:(開発)> ... > parent`
- Delete: `- M:(開発)> ... > node`
- Move: `M:(開発)> ... > node -> M:(開発)> ... > new parent`
- Rename: `M:(開発)> ... > old := "new"`
- Attribute: `M:(開発)> ... > node [status: done]`

## Required distinctions

- `edge`: any line between two nodes; includes parent edges and relation edges
- `parent edge` = parent-child tree relation
- `relation edge` = non-tree node relation
- node-level `link` = URL/attribute
- `alias` = reference window to canonical entity

## MF / WMF handling

When MF-* / WMF-* labels are used, preserve them as stable human-facing identifiers unless the task explicitly asks to renumber or rename. Do not infer structural ownership from identifier prefixes alone; resolve actual map path/scope first.

### MF-H

`MF-H` is the M3E human-facing name for a Markdown heading tree fragment.
Use it when `#` heading depth is intentionally used as tree depth.

Relative MF-H fragment semantics:

```md
# Child
## Grandchild
```

- `#` means direct child of the resolved active node or target parent.
- `##` means child of the preceding `#` node.
- Deeper headings continue the same relative tree rule.
- The active node itself is not repeated unless the request explicitly asks for a full subtree.

MF / WMF / Mermaid are interchange, render, or request formats. They are not
M3E storage. Resolve the canonical M3E target before interpreting them as a
writeback request.
