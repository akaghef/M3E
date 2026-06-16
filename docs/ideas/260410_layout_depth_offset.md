# Layout Depth Offset Design: Parent-Grouped Subtree Indentation

Date: 2026-04-10
Status: Design (not implemented)
Author: visual agent

---

## 1. Problem Statement

In the current M3E tree layout, all nodes at the same `depth` share the same X position. This means grandchildren (depth=2) from different parents (depth=1) are visually indistinguishable in terms of parent affiliation along the X axis.

```
Current:
  Root ─── ChildA ─── Grandchild1   (depth=2, x=420)
                  ─── Grandchild2   (depth=2, x=420)
       ─── ChildB ─── Grandchild3   (depth=2, x=420)
```

Desired: grandchildren from different parents should have a slight X offset so the parent grouping is visually obvious.

```
Proposed:
  Root ─── ChildA ─── Grandchild1   (depth=2, x=420)
                  ─── Grandchild2   (depth=2, x=420)
       ─── ChildB ────── Grandchild3   (depth=2, x=440, offset +20)
```

---

## 2. Current Layout Algorithm Analysis

File: `beta/src/browser/viewer.ts`, function `buildLayout()` (line 1901-2015).

### 2.1 Phase 1: Measurement & Depth Assignment (lines 1908-1932)

```typescript
function visit(nodeId: string, depth: number): void {
  depthOf[nodeId] = depth;
  metrics[nodeId] = measureNodeLabel(...);
  depthMaxWidth[depth] = Math.max(depthMaxWidth[depth] ?? 0, metrics[nodeId].w);
  visibleChildren(node).forEach((childId) => visit(childId, depth + 1));
}
visit(displayRootId, 0);
```

- Recursively assigns `depth` to every node.
- Tracks the maximum label width at each depth (`depthMaxWidth`).

### 2.2 Phase 2: X-Position by Depth (lines 1936-1941)

```typescript
const xByDepth: Record<number, number> = {};
let cursorX = VIEWER_TUNING.layout.leftPad;   // 80
for (let d = 0; d <= maxDepth; d += 1) {
  xByDepth[d] = cursorX;
  cursorX += (depthMaxWidth[d] ?? 120) + VIEWER_TUNING.layout.columnGap;  // columnGap=170
}
```

- **All nodes at the same depth get the same X position.**
- This is the core code that needs to change.

### 2.3 Phase 3: Subtree Height Calculation (lines 1943-1972)

```typescript
function subtreeHeight(nodeId: string): number {
  const children = visibleChildren(node);
  if (children.length === 0) return leafSpan;
  let sum = 0;
  children.forEach((childId, i) => {
    sum += subtreeHeight(childId);
    if (i < children.length - 1) sum += siblingGap;
  });
  return Math.max(sum, metrics[nodeId].h + 24);
}
```

- Computes Y-axis space needed for each subtree. Not affected by the proposed change.

### 2.4 Phase 4: Placement (lines 1977-2006)

```typescript
function place(nodeId: string, topY: number): number {
  const depth = depthOf[nodeId] ?? 0;
  pos[nodeId] = {
    x: xByDepth[depth]!,     // <-- THIS LINE uses depth-uniform X
    y: centerY,
    depth,
    w: metrics[nodeId].w,
    h: metrics[nodeId].h,
  };
  // ... place children
}
```

- The `x` is read from `xByDepth[depth]` which is uniform per depth.
- **This is the assignment point to change.**

### 2.5 Hit Test (lines 2361-2396)

```typescript
function getNodeHitBounds(nodeId: string): { left, right, top, bottom } | null {
  const p = lastLayout.pos[nodeId];
  const left = nodeId === displayRootId ? p.x : p.x - 8;
  const width = nodeId === displayRootId ? p.w : p.w + 36;
  const halfH = interactionHalfHeight(p);
  return { left, right: left + width, top: p.y - halfH, bottom: p.y + halfH };
}

function findNodeAtCanvasPoint(x: number, y: number): string | null {
  visibleOrder.forEach((nodeId) => {
    const bounds = getNodeHitBounds(nodeId);
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
      hitNodeId = nodeId;
    }
  });
  return hitNodeId;
}
```

- **Already per-node.** `getNodeHitBounds` reads `p.x` from the individual node position, not from a depth table.
- `findNodeAtCanvasPoint` iterates all visible nodes.
- **No changes needed for hit testing.**

### 2.6 Edge Drawing (lines 2160-2178)

```typescript
const startX = p.x + p.w + edgeStartPad;    // parent's right edge
const endX = child.x - edgeEndPad;           // child's left edge
const curve = Math.max(48, (endX - startX) * 0.45);
```

- Edge drawing already uses per-node `p.x` and `child.x`, not the depth table.
- **No changes needed for edge rendering.** If child X shifts, edges will automatically follow.

### 2.7 Graph Link Drawing (lines 2092-2146)

- Same pattern: uses `sourcePos.x` and `targetPos.x` from `pos[]`.
- **No changes needed.**

### 2.8 Drag & Drop (lines 2398-2640)

- `proposeReorderDrop` uses `parentPos.depth + 1` only in `getNextVisibleNodeTopAtDepth` (line 2573).
- `getNextVisibleNodeTopAtDepth` searches for nodes matching a specific depth value. With the proposed change, nodes at the same logical depth may have different X offsets, but this function compares `nextPos.depth` which remains the logical depth integer. **No change needed.**
- Reorder/reparent zone calculations use `nodePos.x`, `parentPos.x + parentPos.w` etc. -- all per-node. **No changes needed.**

---

## 3. Proposed Design

### 3.1 Core Concept: Parent-Relative X Offset

Instead of a single `xByDepth[d]` for all depth-d nodes, compute the X position relative to the parent node's actual X + width.

```
childX = parentPos.x + parentPos.w + columnGap
```

This naturally produces the "grouping" effect: siblings share the same X (because they share a parent), but cousins differ if their parents differ.

### 3.2 Changes to `buildLayout()`

#### 3.2.1 Remove `xByDepth` Table (lines 1936-1941)

The global `xByDepth` map becomes unnecessary. Delete these lines:

```typescript
// DELETE:
const xByDepth: Record<number, number> = {};
let cursorX = VIEWER_TUNING.layout.leftPad;
for (let d = 0; d <= maxDepth; d += 1) {
  xByDepth[d] = cursorX;
  cursorX += (depthMaxWidth[d] ?? 120) + VIEWER_TUNING.layout.columnGap;
}
```

#### 3.2.2 New: Per-Node X Calculation in `place()` (line 1988)

Replace:
```typescript
pos[nodeId] = {
  x: xByDepth[depth]!,
  ...
};
```

With:
```typescript
// Root node gets leftPad as before
const nodeX = (parentX === null)
  ? VIEWER_TUNING.layout.leftPad
  : parentX + parentW + VIEWER_TUNING.layout.columnGap;

pos[nodeId] = {
  x: nodeX,
  y: centerY,
  depth,
  w: metrics[nodeId]!.w,
  h: metrics[nodeId]!.h,
};
```

#### 3.2.3 Updated `place()` Signature

Change `place(nodeId, topY)` to `place(nodeId, topY, parentX, parentW)`:

```typescript
function place(
  nodeId: string,
  topY: number,
  parentX: number | null,
  parentW: number | null
): number {
  const node = state.nodes[nodeId];
  if (!node) return VIEWER_TUNING.layout.leafHeight;

  const depth = depthOf[nodeId] ?? 0;
  const h = subtreeHeight(nodeId);
  const centerY = topY + h / 2;

  const nodeX = (parentX === null || parentW === null)
    ? VIEWER_TUNING.layout.leftPad
    : parentX + parentW + VIEWER_TUNING.layout.columnGap;

  pos[nodeId] = {
    x: nodeX,
    y: centerY,
    depth,
    w: metrics[nodeId]!.w,
    h: metrics[nodeId]!.h,
  };
  order.push(nodeId);

  let placeCursorY = topY;
  visibleChildren(node).forEach((childId, i, arr) => {
    const childH = place(childId, placeCursorY, nodeX, metrics[nodeId]!.w);
    placeCursorY += childH;
    if (i < arr.length - 1) {
      placeCursorY += VIEWER_TUNING.layout.siblingGap;
    }
  });

  return h;
}

const totalHeight = place(displayRootId, VIEWER_TUNING.layout.topPad, null, null);
```

#### 3.2.4 Update `totalWidth` Calculation (line 2013)

Currently:
```typescript
totalWidth: cursorX + VIEWER_TUNING.layout.canvasRightPad,
```

Since `cursorX` no longer exists, compute `totalWidth` from the placed nodes:

```typescript
let maxRight = VIEWER_TUNING.layout.minCanvasWidth;
for (const nodeId of order) {
  const p = pos[nodeId]!;
  maxRight = Math.max(maxRight, p.x + p.w + VIEWER_TUNING.layout.nodeRightPad);
}

return {
  pos,
  order,
  totalHeight,
  totalWidth: maxRight + VIEWER_TUNING.layout.canvasRightPad,
};
```

#### 3.2.5 `depthMaxWidth` Becomes Unnecessary

Currently used only for computing `xByDepth`. With per-parent X positioning, `depthMaxWidth` is no longer needed. Remove lines 1905 and 1930.

### 3.3 Summary of Lines Changed

| Location | Line(s) | Action |
|----------|---------|--------|
| `depthMaxWidth` declaration | 1905 | Delete |
| `depthMaxWidth[depth] = ...` | 1930 | Delete |
| `xByDepth` computation block | 1936-1941 | Delete |
| `place()` signature | 1977 | Add `parentX`, `parentW` params |
| `x: xByDepth[depth]!` | 1988 | Replace with parent-relative calculation |
| Child placement call | 1998 | Pass `nodeX`, `metrics[nodeId].w` |
| Root `place()` call | 2008 | Pass `null, null` |
| `totalWidth` return | 2013 | Compute from placed node positions |

---

## 4. Impact Analysis

### 4.1 Hit Testing

**No changes required.** `getNodeHitBounds()` (line 2361) and `findNodeAtCanvasPoint()` (line 2381) already operate on per-node `pos[nodeId].x`. They do not use `xByDepth`.

### 4.2 Edge Drawing

**No changes required.** Edge start/end coordinates (lines 2168-2171) are computed from `p.x + p.w` (parent) and `child.x` (child), which are per-node values.

### 4.3 Graph Link Drawing

**No changes required.** Same per-node pattern (lines 2096-2118).

### 4.4 Drag & Drop

**No changes required.** All drag proposal computations use per-node positions from `lastLayout.pos[nodeId]`. The `getNextVisibleNodeTopAtDepth` function (line 2452) matches on `nextPos.depth` (the integer depth), which is unchanged.

### 4.5 Inline Editor Positioning

`syncInlineEditorPosition()` uses `lastLayout.pos[nodeId]` (line 1279-1284). **No changes needed.**

### 4.6 `scrollNodeIntoView` / Camera

These functions use `lastLayout.pos[nodeId]` for X/Y. **No changes needed.**

---

## 5. Performance Analysis

### 5.1 Current Complexity

- `visit()`: O(N) -- one pass over all visible nodes
- `xByDepth` loop: O(D) where D = max depth
- `subtreeHeight()`: O(N) with memoization
- `place()`: O(N) -- one pass
- Total: O(N)

### 5.2 Proposed Complexity

- `visit()`: O(N) -- unchanged, but remove `depthMaxWidth` tracking
- `xByDepth` loop: Removed
- `subtreeHeight()`: O(N) -- unchanged
- `place()`: O(N) -- unchanged (parent info passed as params, no lookup)
- `totalWidth` computation: O(N) additional scan over placed nodes
- Total: O(N) -- same asymptotic cost

### 5.3 For 1000+ Nodes

No measurable performance impact. The change removes one O(D) loop and adds one O(N) scan for maxRight, which is trivially fast. The per-node `place()` call adds two parameter passes (parentX, parentW) -- negligible.

---

## 6. Edge Cases

### 6.1 Childless Nodes (Leaves)

No issue. A leaf's X is determined by its parent's position. If a parent has no children, no child placement occurs.

### 6.2 Deeply Nested Trees (depth > 20)

Each level adds `parentW + columnGap` to X. With `columnGap = 170` and typical label widths of 100-300px, depth=20 would push X to ~5400-9400px. The canvas already handles large X values (scrollable), so no issue.

However, compared to the current algorithm, trees may become **wider** when a node at depth d has a narrow label but another at depth d has a wide label. Currently, `depthMaxWidth` ensures the wider label dictates column width for the entire depth. With parent-relative positioning, narrow-label parents produce tighter columns.

**Trade-off:** The tree will be more compact overall but less "grid-aligned". This is the desired visual effect.

### 6.3 Collapsed Nodes

`visibleChildren()` returns `[]` for collapsed nodes (line 1319). The collapsed badge is drawn at the node's X + W position. Since X is now parent-relative, the badge position automatically adapts. **No issue.**

### 6.4 Alias Nodes

`visibleChildren()` returns `[]` for alias nodes (line 1319). They are leaf nodes from a layout perspective. **No issue.**

### 6.5 Folder / Scope Nodes

`visibleChildren()` returns `[]` for folder nodes that are not the current scope root (line 1323). When scope-in occurs, the folder becomes the display root and gets `VIEWER_TUNING.layout.leftPad` as X. **No issue.**

### 6.6 Scope-In Behavior

When a user scopes into a subtree, `currentScopeRootId()` changes. `buildLayout()` calls `visit(displayRootId, 0)` and `place(displayRootId, topPad, null, null)`. The scoped root starts at `leftPad`, and all descendants compute relative to it. **The offset automatically resets at the scope boundary.**

### 6.7 Root Node with Multiple Direct Children

This is the primary use case. Children of root will all be at the same X (since they share the same parent). Their children (grandchildren) will have X positions relative to their respective parent's width, producing the desired visual grouping.

### 6.8 Single-Child Chains

A -> B -> C -> D: each node will be at `parent.x + parent.w + columnGap`. This produces a staircase effect if labels have different widths, which is visually natural. No alignment issue.

---

## 7. Visual Impact Illustration

### Before (current, depth-aligned columns):

```
x=80       x=420               x=760
Root ────── ProjectA ────────── Task1
                             ── Task2
                             ── Task3
       ──── ProjectB ────────── TaskX
                             ── TaskY
```

`Task1..3` and `TaskX..Y` are at the same X=760.

### After (parent-relative):

```
x=80       x=420               x=700
Root ────── ProjectA ────────── Task1
                             ── Task2
                             ── Task3
                  x=450                x=730
       ──── ProjectB(longer) ────────── TaskX
                                     ── TaskY
```

`TaskX/Y` start at x=730 (based on `ProjectB`'s width + columnGap), while `Task1..3` start at x=700 (based on `ProjectA`'s width + columnGap). The offset visually groups tasks under their parent.

---

## 8. Optional Enhancement: Minimum Column Width per Depth

If the unaligned appearance is too chaotic, a hybrid approach is possible:

```typescript
// After all nodes are placed, optionally snap depth-groups to the max X within each depth:
const maxXByDepth: Record<number, number> = {};
for (const nodeId of order) {
  const p = pos[nodeId]!;
  maxXByDepth[p.depth] = Math.max(maxXByDepth[p.depth] ?? 0, p.x);
}
// Optional: align all nodes at each depth to the max X (reverts to grid-like)
// Or: use a weighted blend between parent-relative and depth-aligned
```

This is a tuning decision. Recommend implementing the pure parent-relative approach first, then evaluating visually whether a hybrid blend is needed.

---

## 9. New Tuning Constants (optional)

No new constants are strictly required. The existing `columnGap` (170px) controls the horizontal gap between parent and child. However, if we want a reduced offset (e.g., only partial parent-relative influence), we could add:

```typescript
// In viewer.tuning.ts, layout section:
depthOffsetFactor: 1.0,  // 0.0 = depth-aligned (current), 1.0 = fully parent-relative
```

Then in `place()`:

```typescript
const baseX = xByDepth[depth]!;  // keep depth table for blending
const parentRelX = parentX + parentW + columnGap;
const nodeX = baseX + (parentRelX - baseX) * depthOffsetFactor;
```

This allows smooth tuning between the current and proposed behavior. **Recommended for first implementation** to allow easy rollback via config.

---

## 10. Implementation Plan (when ready)

1. Add `depthOffsetFactor: number` to `ViewerTuning.layout` interface and set to `1.0` in `VIEWER_TUNING`
2. In `buildLayout()`, keep `xByDepth` calculation as baseline
3. Modify `place()` to accept `parentX: number | null, parentW: number | null`
4. Compute `nodeX` using blend formula
5. Update `totalWidth` to scan placed nodes
6. Remove `depthMaxWidth` tracking (only if `depthOffsetFactor` is hardcoded to 1.0; keep if using blend)
7. Run `npx tsc --noEmit` and `npx vitest run`
8. Visual review with Playwright if snapshot tests exist

Estimated changes: ~20 lines modified, 0 new files.

---

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Visual regression in existing maps | Medium | `depthOffsetFactor` tuning constant allows 0.0 = no change |
| Wider canvas for deep trees | Low | Already scrollable, canvasRightPad handles clipping |
| Label truncation at edge | Low | `nodeRightPad = 260` provides buffer |
| Drag/drop accuracy change | None | All drag code uses per-node positions |
| Hit test accuracy change | None | Already per-node |

---

## 12. Decision Needed from Manager

1. **Pure parent-relative vs. blended approach?**
   - Pure: simpler code, stronger visual grouping
   - Blended (`depthOffsetFactor`): tunable, safer rollback
   - Recommendation: blended for first iteration

2. **Should siblings be aligned with each other?**
   - Current proposal: yes (siblings share the same parent, so they get the same X)
   - Alternative: could add per-sibling offset based on subtree depth (more complex, not recommended for v1)

3. **Should collapsed subtrees influence the offset?**
   - Current: collapsed nodes have no visible children, so their subtree width does not affect cousin X positions
   - This seems correct, but worth confirming
