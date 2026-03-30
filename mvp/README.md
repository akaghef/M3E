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
- Undo/Redo
- Structural validation
- Save/Load (`version: 1` JSON)

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

## Next implementation steps

1. Add keyboard command mapping for Rapid operations.
2. Add minimal SVG rendering layer.
3. Add `.mm` import parser and conversion pipeline.
4. Add operation latency logs for Rapid performance checks.
