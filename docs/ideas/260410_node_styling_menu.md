# Node Styling Menu -- UI Design

**Date:** 2026-04-10
**Author:** visual agent
**Status:** Design only (no implementation)
**Prerequisites:** PR #33 (m3e:* style attributes implemented)

---

## 1. Overview

PR #33 added `m3e:bg`, `m3e:color`, `m3e:border`, `m3e:border-style`, `m3e:border-width`, `m3e:shape`, `m3e:icon`, `m3e:edge-color`, `m3e:edge-style`, `m3e:edge-width`, `m3e:band`, `m3e:confidence` attributes, with rendering support in `buildNodeHitStyle()`, `buildLabelStyle()`, `buildEdgeStyle()`, and `shapeRx()`. However, users have no UI to set these -- they can only be set via raw JSON editing.

This document designs a **floating styling toolbar** that appears when one or more nodes are selected.

---

## 2. Design Decision: Floating Toolbar

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Floating toolbar above selection** | Miro-standard, contextual, immediate | Requires position tracking | **Selected** |
| Right-click context menu | Already exists for scope lock | Nested menus are clumsy for color picking | Rejected |
| Side panel (meta-panel extension) | Always visible | Not contextual; meta-panel is hidden by default | Rejected |
| Inline in entity list | Consistent with list view | Too far from canvas context | Rejected |

### Rationale

Miro, Figma, and Google Slides all use a floating toolbar that appears near the selection. This pattern is familiar to the target user (knowledge workers who use visual tools). The existing `showContextMenu()` pattern at L3999-L4035 provides a reusable foundation for floating DOM overlays.

---

## 3. Menu Position and Behavior

### 3.1 Positioning

```
                  [Floating Styling Toolbar]
                  +-----------------------+
                  | bg | txt | border | ...
                  +-----------------------+
                         ^
                         |  16px gap
                  +------+------+
                  | Selected    |   <-- node rect on canvas
                  | Node        |
                  +-------------+
```

- **Anchor:** Center-top of the primary selected node's bounding box
- **Offset:** 16px above the node's top edge (in screen coordinates, after zoom/pan transform)
- **Container:** Append to `document.body` as `position: fixed`, same as context menu
- **Reposition:** On `render()` and on `scheduleApplyZoom()` (pan/zoom changes)
- **Flip:** If toolbar would extend above viewport, show below the node instead
- **Multi-select:** Anchor to the bounding box center of all selected nodes

### 3.2 Show/Hide Triggers

| Event | Action |
|-------|--------|
| Node selected (click, arrow keys) | Show toolbar after 150ms debounce |
| Selection cleared (click empty area) | Hide immediately |
| Inline edit started (dblclick / Enter) | Hide toolbar |
| Pan/zoom | Reposition (do not hide) |
| Context menu opened | Hide toolbar |
| Another overlay opened (entity list, hamburger) | Hide toolbar |

### 3.3 z-index

The toolbar should sit at `z-index: 90`, below the context menu (`z-index: 100`) but above the canvas (`z-index: 1`).

---

## 4. Menu Items -- Layout

```
+---+---+---+---+---+---+---+
| B | T | F | S | I | D | C |
+---+---+---+---+---+---+---+

B = Background color
T = Text color
F = Frame (border)
S = Shape
I = Icon
D = Band (Flash/Rapid/Deep)
C = Confidence (Deep only)
```

Each button is a 32x32px icon button. Hovering shows a tooltip. Clicking opens a **dropdown sub-panel** below the button.

### 4.1 Background Color (B)

```
+-----------------------------+
| Background Color            |
|-----------------------------|
| [#] [#] [#] [#] [#] [#]    |   <- row 1: 6 preset colors
| [#] [#] [#] [#] [#] [#]    |   <- row 2: 6 preset colors
|-----------------------------|
| [x] Remove color            |
| [Custom...] #______         |   <- hex input
+-----------------------------+
```

**Preset palette (12 colors):**

```
Row 1: #FFE0B2  #FFCDD2  #F8BBD0  #E1BEE7  #C5CAE9  #BBDEFB
        (amber)  (red)    (pink)   (purple)  (indigo)  (blue)
Row 2: #B2DFDB  #C8E6C9  #DCEDC8  #FFF9C4  #F5F5F5  #E0E0E0
        (teal)   (green)  (lime)   (yellow)  (white)   (gray)
```

These are Material Design 100-level tones -- light enough for background use with dark text.

**Behavior:**
- Click preset: Immediately set `m3e:bg` on all selected nodes
- Click "Remove": Delete the `m3e:bg` attribute (revert to default)
- Type hex: Set on Enter or blur (validate with existing `sanitizeColor()`)

### 4.2 Text Color (T)

Same sub-panel structure as background, but with a darker palette:

```
Row 1: #D84315  #C62828  #AD1457  #6A1B9A  #283593  #1565C0
Row 2: #00695C  #2E7D32  #558B2F  #F9A825  #212121  #757575
```

Sets `m3e:color` attribute.

### 4.3 Frame / Border (F)

```
+-----------------------------+
| Border                      |
|-----------------------------|
| Color: [palette grid 6x2]  |
|-----------------------------|
| Style:                      |
| (o) solid   ( ) dashed      |
| ( ) dotted  ( ) none        |
|-----------------------------|
| Width: [1] [2] [4] [8]     |
|-----------------------------|
| [x] Remove all border       |
+-----------------------------+
```

Sets `m3e:border`, `m3e:border-style`, `m3e:border-width`.

### 4.4 Shape (S)

```
+-----------------------------+
| Shape                       |
|-----------------------------|
| [ [_] rect  ]               |   <- sharp corners
| [ (_) rounded ]             |   <- default
| [ (___) pill ]              |   <- full radius
|-----------------------------|
| [x] Reset to default        |
+-----------------------------+
```

Each option shows a small SVG preview of the shape. Sets `m3e:shape`.

### 4.5 Icon (I)

```
+-----------------------------+
| Icon / Emoji                |
|-----------------------------|
| Frequently used:            |
| star check warn flag pin    |
| bulb book gear heart fire   |
|-----------------------------|
| [____] type to search       |
|-----------------------------|
| [x] Remove icon             |
+-----------------------------+
```

**Implementation note:** Use a curated list of ~30 commonly useful emoji rather than a full emoji picker. The existing `sanitizeIcon()` at L529-L536 allows up to 4 characters.

**Curated emoji list:**
```
Stars/status: star, check_mark, warning, x_mark, question
Objects:      bulb, book, gear, key, lock, pin, flag, bell
People:       eyes, brain, handshake, raised_hand
Nature:       fire, sparkles, lightning, seedling, rocket
```

Sets `m3e:icon`.

### 4.6 Band (D)

```
+-----------------------------+
| Band                        |
|-----------------------------|
| ( ) Flash  [dashed, 60%]    |
| (o) Rapid  [default]        |
| ( ) Deep   [bold border]    |
|-----------------------------|
| [x] No band                 |
+-----------------------------+
```

Each radio shows a small visual preview of the band's styling effect. Sets `m3e:band`.

### 4.7 Confidence (C)

Only enabled when band = "deep" (or always available).

```
+-----------------------------+
| Confidence                  |
|-----------------------------|
| [=====|-----] 50%           |   <- slider 0-100
| or type: [___]%             |
|-----------------------------|
| [x] Remove                  |
+-----------------------------+
```

Uses the existing `confidenceColor()` function (L538-L548) to show a live color preview on the slider track. Sets `m3e:confidence` as a decimal 0-1.

---

## 5. Operation Flow

### 5.1 Single Node Styling

```
User clicks node
  -> selectByPointerModifiers() (L2983)
    -> setSingleSelection() (L2919)
      -> scheduleRender() (L2928)
        -> [NEW] scheduleShowStylingToolbar()

scheduleShowStylingToolbar():
  debounce 150ms
  compute node screen position from lastLayout.pos + zoom/pan transform
  create/update toolbar DOM
  position with fixed positioning

User clicks "Background Color" button
  -> show color sub-panel
    User clicks a color swatch
      -> pushUndoSnapshot()
      -> node.attributes["m3e:bg"] = selectedColor
      -> touchDocument()  // renders + autosaves
      -> update toolbar state (highlight active color)
```

### 5.2 Multi-Node Styling

```
User Ctrl+clicks or Shift+clicks multiple nodes
  -> viewState.selectedNodeIds contains multiple IDs

User clicks a color in toolbar
  -> pushUndoSnapshot()
  -> for each nodeId in viewState.selectedNodeIds:
       getNode(nodeId).attributes["m3e:bg"] = selectedColor
  -> touchDocument()
```

The toolbar shows "mixed" state when selected nodes have different values for an attribute (e.g., different background colors). In this case, no swatch is highlighted.

### 5.3 Keyboard Shortcut

Consider adding a keyboard shortcut to open the styling toolbar (e.g., `Alt+S` or `/` in non-edit mode) for power users.

---

## 6. Affected Code Locations

### 6.1 New Functions to Add (viewer.ts)

| Function | Purpose | Insert After |
|----------|---------|-------------|
| `showStylingToolbar()` | Create/show the floating toolbar DOM | L4036 (after `hideContextMenu`) |
| `hideStylingToolbar()` | Remove toolbar from DOM | After `showStylingToolbar` |
| `positionStylingToolbar()` | Compute screen coords from layout | After `hideStylingToolbar` |
| `setNodeStyleAttr(key, value)` | Set m3e:* attr on selected nodes with undo | After position function |
| `removeNodeStyleAttr(key)` | Delete m3e:* attr on selected nodes | After set function |
| `renderColorSubPanel(key, palette)` | Reusable color palette dropdown | After remove function |
| `renderShapeSubPanel()` | Shape option dropdown | After color sub-panel |
| `renderIconSubPanel()` | Icon/emoji picker dropdown | After shape sub-panel |
| `renderBandSubPanel()` | Band radio dropdown | After icon sub-panel |
| `renderConfidenceSubPanel()` | Confidence slider dropdown | After band sub-panel |

### 6.2 Modifications to Existing Code

| Location | Change |
|----------|--------|
| L2928 (`setSingleSelection`, renderNow branch) | Add call to `scheduleShowStylingToolbar()` |
| L2943-L2978 (`setRangeSelection`, `toggleNodeSelection`) | Add call to `scheduleShowStylingToolbar()` |
| L4421 (`startInlineEdit`) | Add call to `hideStylingToolbar()` |
| L6075-L6086 (canvas contextmenu handler) | Expand to show styling options for non-folder nodes |
| L6114 (board pointerdown, empty area) | Add call to `hideStylingToolbar()` |
| `scheduleApplyZoom()` area | Add call to `positionStylingToolbar()` |
| `render()` at L2223 | Add call to `positionStylingToolbar()` at end |

### 6.3 New Global State

```typescript
let activeStylingToolbar: HTMLElement | null = null;
let activeStylingSubPanel: HTMLElement | null = null;
let stylingToolbarDebounce: ReturnType<typeof setTimeout> | null = null;
```

Insert at ~L154 (near `activeContextMenu`).

### 6.4 CSS to Add (viewer.css)

Insert after `.scope-context-menu` block (~L1578):

```css
.styling-toolbar {
  position: fixed;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  padding: 4px;
  pointer-events: auto;
}

.styling-toolbar-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: background 0.1s ease;
}

.styling-toolbar-btn:hover {
  background: rgba(122, 53, 255, 0.08);
}

.styling-toolbar-btn.active {
  background: rgba(122, 53, 255, 0.12);
  outline: 2px solid var(--accent);
}

.styling-sub-panel {
  position: fixed;
  z-index: 91;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.14);
  padding: 10px;
  min-width: 200px;
}

.styling-color-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.styling-color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.1s, transform 0.1s;
}

.styling-color-swatch:hover {
  transform: scale(1.15);
}

.styling-color-swatch.active {
  border-color: var(--accent);
}

.styling-shape-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.styling-shape-option:hover {
  background: rgba(122, 53, 255, 0.06);
}

.styling-shape-option.active {
  background: rgba(122, 53, 255, 0.1);
  font-weight: 600;
}
```

### 6.5 HTML Changes (viewer.html)

No HTML changes needed. The toolbar is fully dynamic DOM, appended to `document.body` like the context menu.

---

## 7. Core Implementation Sketch

### 7.1 setNodeStyleAttr -- the mutation helper

```typescript
function setNodeStyleAttr(attrKey: string, value: string | null): void {
  if (!doc) return;
  const targetIds = viewState.selectedNodeIds.size > 0
    ? viewState.selectedNodeIds
    : new Set([viewState.selectedNodeId]);
  pushUndoSnapshot();
  for (const nodeId of targetIds) {
    const node = doc.state.nodes[nodeId];
    if (!node) continue;
    if (!node.attributes) node.attributes = {};
    if (value === null) {
      delete node.attributes[attrKey];
    } else {
      node.attributes[attrKey] = value;
    }
  }
  touchDocument(); // re-renders + schedules autosave
}
```

### 7.2 positionStylingToolbar

```typescript
function positionStylingToolbar(): void {
  if (!activeStylingToolbar || !lastLayout) return;
  const nodeId = viewState.selectedNodeId;
  const p = lastLayout.pos[nodeId];
  if (!p) { hideStylingToolbar(); return; }

  // Convert SVG coords to screen coords using current zoom/pan
  const svgRect = canvas.getBoundingClientRect();
  const svgW = canvas.viewBox.baseVal.width;
  const svgH = canvas.viewBox.baseVal.height;
  const scaleX = svgRect.width / svgW;
  const scaleY = svgRect.height / svgH;

  const screenX = svgRect.left + (p.x + p.w / 2) * scaleX;
  const screenY = svgRect.top + (p.y - p.h / 2) * scaleY;

  const tbRect = activeStylingToolbar.getBoundingClientRect();
  let left = screenX - tbRect.width / 2;
  let top = screenY - tbRect.height - 16;

  // Viewport clamping
  left = Math.max(8, Math.min(left, window.innerWidth - tbRect.width - 8));
  if (top < 8) {
    // Flip below the node
    top = svgRect.top + (p.y + p.h / 2) * scaleY + 16;
  }

  activeStylingToolbar.style.left = `${left}px`;
  activeStylingToolbar.style.top = `${top}px`;
}
```

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| Read-only mode | Do not show styling toolbar (check `isReadOnly` flag) |
| Root node selected | Show toolbar but disable shape (root shape has separate logic at L616-L621) |
| Alias node selected | Show toolbar; changes go to alias attributes, not target |
| Inline editing active | Hide toolbar |
| Node dragging | Hide toolbar during drag, show after drop |
| Very small zoom level | Hide toolbar when zoom < 0.3 (too small to be useful) |
| Node scrolled off-screen | Hide toolbar when computed position is outside viewport |
| Rapid keyboard navigation | 150ms debounce prevents toolbar flicker |

---

## 9. Integration with Existing Context Menu

The current context menu (L6075-L6086) only handles scope lock on folder nodes. Extend it:

```
Right-click any node:
  -> If folder: show scope lock options (existing)
  -> Always show: "Style..." submenu (opens styling toolbar positioned at click)
  -> Always show: separator + existing scope lock items (for folders)
```

This way users can access styling via both:
1. Select + floating toolbar (primary, Miro-like)
2. Right-click > Style... (secondary, discoverable)

---

## 10. Accessibility

- All toolbar buttons have `aria-label` attributes
- Sub-panels have `role="menu"` and `aria-expanded` state
- Color swatches include `title` with hex value and color name
- Escape key closes any open sub-panel, then the toolbar
- Tab navigation within sub-panels

---

## 11. Future Considerations (out of scope for v1)

- Edge styling sub-panel (m3e:edge-color, edge-style, edge-width) -- could be added as additional toolbar button
- Color picker widget (HTML5 `<input type="color">`) for truly custom colors
- Style presets/themes (save a combination of bg+color+border+shape as a named preset)
- Copy/paste style between nodes (Ctrl+Shift+C / Ctrl+Shift+V)
- Conditional formatting rules (auto-style based on node properties)

---

## 12. Implementation Plan

**Phase 1 (MVP):** Background color + text color + icon picker
- Smallest useful subset, tests the floating toolbar infrastructure
- ~200 lines of TypeScript, ~60 lines of CSS

**Phase 2:** Shape + border + band
- Adds remaining sub-panels
- ~150 lines additional

**Phase 3:** Confidence slider + context menu integration + keyboard shortcut
- Polish and discoverability
- ~100 lines additional

Total estimated addition: ~450-510 lines TypeScript, ~80-100 lines CSS.
