# Rapid MVP Implementation

Initial implementation file:
- `rapid_mvp.js`

## What is implemented

- Tree node model (`id`, `parentId`, `children`, `text`, `collapsed`)
- Core edit operations
  - add node
  - add sibling
  - edit node text
  - delete subtree
  - reparent node (cycle-safe)
  - collapse toggle
- Selection state
- Structural validation
- Save/Load (`version: 1` JSON)
- Minimal Freeplane `.mm` import

## Run

From repository root:

```bash
node mvp/rapid_mvp.js
```

This generates:
- `mvp/data/rapid-sample.json`

## Visual check in Edge

1. Run sample generation first:
  - `node mvp/rapid_mvp.js`
2. Open viewer page in Edge:
  - `mvp/viewer.html`
3. Click "Load default sample".
4. If default load fails, use file picker and select:
  - `mvp/data/rapid-sample.json`

The page shows a visual tree with selected node highlight.

## Current keyboard-first editor behavior

- Tuning parameters for zoom, pan, spacing, and layout are centralized in `viewer.tuning.js`
- Starts from an editable root immediately, even without loading the sample JSON
- `Tab`: add child to selected node
- `Enter`: add sibling to selected node
- `Shift + Enter`: edit selected node text
- `Esc`: cancel text editing
- `F2`: compatibility shortcut for edit
- `Delete` / `Backspace`: delete selected subtree (root cannot be deleted)
- `Space`: collapse or expand selected node
- `Arrow Up` / `Arrow Down`: move through visible nodes
- Drag a node onto another node: reparent under the drop target
- `M`: mark selected node as the node to move
- `P`: move the marked node under the currently selected node
- `Download JSON`: save the current tree snapshot
- File picker accepts `.json` and `.mm`

## One-command startup

From repository root, run:

```bash
node mvp/start_viewer.js
```

This single command does all of the following:

1. Generates `mvp/data/rapid-sample.json`
2. Starts a local viewer server (`http://localhost:4173/viewer.html`)
3. Opens the viewer in your browser automatically

Stop with `Ctrl+C`.

## Airplane parts demo

Viewer now includes a demo button for an airplane parts mindmap.

1. Start viewer:
  - `node mvp/start_viewer.js`
2. Click:
  - `Load airplane demo`

Demo file:
- `mvp/data/airplane-parts-demo.json`

## Aircraft `.mm` demo

Viewer also includes a direct demo loader for:
- `mvp/data/aircraft.mm`

Steps:
1. Start viewer:
  - `node mvp/start_viewer.js`
2. Click:
  - `Load aircraft.mm demo`

## Aircraft visual check

Viewer includes an automated visual walkthrough for the existing aircraft map.

Steps:
1. Start viewer:
  - `node mvp/start_viewer.js`
2. Click:
  - `Run aircraft visual check`

What it checks visually:
- root overview visibility
- zoomed-out whole-map readability
- branch selection highlight on `Body` and `Wing`
- collapse/expand visibility on `Body` and `Wing`
- label readability on `Main Wing` and `Propeller`

You can stop the sequence at any time with:
- `Stop visual check`

## Visual regression tests (Playwright)

Visual tests are available under `mvp/tests/visual`.

Setup:

```bash
cd mvp
npm install
npx playwright install chromium
```

Run tests:

```bash
npm run test:visual
```

Create/update screenshot baselines:

```bash
npm run test:visual:update
```

Notes:
- `test_server.js` serves the viewer on `http://127.0.0.1:4173/viewer.html` without opening a browser.
- It also runs `rapid_mvp.js` before serving, so sample JSON is always regenerated for test input.

## Freeplane `.mm` import

The file picker now accepts Freeplane `.mm` files.

Imported fields:
- `TEXT`
- `FOLDED`
- `LINK`
- `richcontent TYPE="DETAILS"`
- `richcontent TYPE="NOTE"`
- `attributes/attribute`

Current limitation:
- Imported metadata is preserved in JSON state, but the viewer still renders `text` only.

## Next implementation steps

1. Split persistent document state from `ViewState`.
2. Improve the current minimal reparent UI.
3. Render imported metadata (`details`, `note`, `attributes`, `link`) in the UI.
4. Add operation latency logs for Rapid performance checks.
