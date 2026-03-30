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

- Starts from an editable root immediately, even without loading the sample JSON
- `Tab`: add child to selected node
- `Enter`: add sibling to selected node
- `F2`: edit selected node text
- `Delete` / `Backspace`: delete selected subtree (root cannot be deleted)
- `Space`: collapse or expand selected node
- `Arrow Up` / `Arrow Down`: move through visible nodes
- `Download JSON`: save the current tree snapshot

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

## Next implementation steps

1. Split persistent document state from `ViewState`.
2. Add drag or command-based reparent editing.
3. Add `.mm` import parser and conversion pipeline.
4. Add operation latency logs for Rapid performance checks.
