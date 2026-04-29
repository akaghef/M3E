---
pj_id: PJ04
doc: loops/README.md
date: 2026-04-22
purpose: index + summary of visual-verify iteration artifacts
---

# loops/ — Visual-Verify Iteration Log

This directory is a **local-only workbench** for the edge-routing iteration loops driven by [tools/snapshot.mjs](../tools/snapshot.mjs).
Raw artifacts (`*.png`, `*.json`, `*.log`) are gitignored via repo-root `.gitignore`; **only this README and sibling READMEs are committed**.

The point of keeping this index under version control is to preserve the *narrative* of how each loop converged, so future sessions do not re-run a loop whose conclusion already exists.

## Directories

### `edge_v1/` — Baseline + tree v1
- Baseline Bezier render.
- Introduced rounded-orthogonal L/コ字 for tree mode.
- Tree mode accepted; system mode still Bezier.

### `edge_v2/` — Tree v2 + system v2 rejected
- Tree keeps L/コ字, r=8.
- System: force all back-edges to TOP arch (U-arch).
- **Rejected** by user: every back-edge lands on the top face, box 4-ports not used.

### `edge_v3/` — iter1 .. iter11 (final)
- 10-iter self-verify loop with automated collision detection (`_collisions.json` samples path with `getPointAtLength` and checks overlap with box rects).
- iter10: `collisions=0` — **accepted** as v3 final.
- iter11: `.linear-panel[hidden]` CSS fix — system mode hides note pane, box 幅 full-width.

#### v3 acceptance criteria
| # | criterion | verified in |
|---|---|---|
| 1 | tree L/コ字 r=8 preserved | iter10_tree_edges.json |
| 2 | system forward: 4-midpoint `edgeEndBetween` (right→left face) | iter10_system_edges.json |
| 3 | system back: TOP/BOTTOM U-arch via avoid-box heuristic | iter10_system_collisions.json (=0) |
| 4 | edges exit portal brackets (`[[ ]]`) with `PORTAL_BRACKET_ARM=14` | iter10_system_screenshot.png |
| 5 | multi back-edge staggered via `topArchCount` / `bottomArchCount` | iter10_system_screenshot.png |
| 6 | `anchor*` → `edgeEnd*` rename (disambig vs scope / zoom anchors) | viewer.ts grep |
| 7 | linear-panel hidden in system mode | iter11_system_nopanel_screenshot.png |

## Residuals (not covered by v3)
- **Execute System 内部 surface** の back-edge 見え方 (iter10 は edges=0 で未検証)
- preview (j/k detail level) での box 幅再計算
- canonical_mermaid.html との parity 明示チェック (T-1-1 eval)

### `codex_ui_self_improve/` — System view overlap fix
- Re-ran the Claude-style snapshot loop from Codex against beta dev map: `viewer.html?map=map_BG9BZP6NRDTEH1JYNDFGS6S3T5`.
- iter4: System view selected, but 8 direct child boxes resolved to the same `(x=72,y=151)` cell.
- Fix: System layout and flow preview now stack duplicate `(flowCol, flowRow)` cells downward instead of drawing boxes on top of each other.
- Fix: switching Tree/System refits the canvas immediately and on the next animation frame, so the view is inspectable after mode changes.
- iter6_system: `collisions=0`, `boxes=8`, `edges=0`; screenshot confirmed direct children are readable and non-overlapping.
- iter6_tree remains unchanged with `collisions=3`; this is outside the current System view overlap fix.

## Reproducing a loop locally
```bash
cd projects/PJ04_MermaidSystemLangGraph/tools
npm install  # if node_modules absent
SNAP_VIEW=system node snapshot.mjs http://localhost:4173 ../loops/myrun myrun_iter1_system
SNAP_VIEW=tree   node snapshot.mjs http://localhost:4173 ../loops/myrun myrun_iter1_tree
# artifacts land under ../loops/myrun/
```

Artifacts are **disposable evidence**, not archival: if a loop is re-run, overwrite freely. Conclusion narrative lives in this README and in [resume-cheatsheet.md §4.1](../resume-cheatsheet.md).
