# M3E Rapid MVP

> **MVP スコープ:** このディレクトリはM3Eプロジェクトの Rapid MVP 実装です。
> 研究思考支援ツールとして最低限動作する形態を検証することが目的であり、
> 製品版の機能・品質は保証しません。

TypeScript source files are in `src/`. Compiled output goes to `dist/` (git-ignored).

Source layout:
- `src/shared/types.ts` — shared interfaces (`TreeNode`, `AppState`, `SavedDoc`)
- `src/node/rapid_mvp.ts` — data model class
- `src/node/start_viewer.ts` — HTTP server + browser launcher
- `src/browser/viewer.tuning.ts` — centralized UI/UX constants
- `src/browser/viewer.globals.d.ts` — browser-side global type declarations
- `src/browser/viewer.ts` — main browser application

Legacy JS files (`rapid_mvp.js`, `start_viewer.js`, `viewer.js`, `viewer.tuning.js`) are kept for reference and backward compatibility.

## What is implemented (MVP scope)

**Data model:**
- Tree node structure: `id`, `parentId`, `children`, `text`, `collapsed`
- Extended fields: `details`, `note`, `attributes`, `link` (parsed, stored, not yet rendered in UI)
- Undo/redo stack (up to 200 history entries)
- Structural validation (cycle detection on reparent)
- Save/Load: `version: 1` JSON format

**Edit operations:**
- Add child node
- Add sibling node
- Edit node text (inline)
- Delete subtree (root node protected)
- Reparent node (cycle-safe)
- Collapse/expand toggle

**UI / Viewer:**
- SVG-based tree rendering on a 1600×900 canvas with grid background
- Zoom in/out/reset, Fit all, Focus selected
- Pan (drag on background)
- Selection highlight
- Toolbar: Load demos, Add/Delete/Collapse, Reparent (Mark+Apply), Zoom, Edit, Download JSON

**File import/export:**
- JSON (M3E `SavedDoc` format)
- Freeplane `.mm` (minimal import: TEXT, FOLDED, LINK, richcontent DETAILS/NOTE, attributes)

**Testing:**
- Playwright visual regression tests (baselines for default sample + aircraft.mm)

## Build

```bash
cd mvp
npm install
npm run build       # compiles src/ → dist/
```

Individual targets:
```bash
npm run build:node     # Node files only (dist/node/)
npm run build:browser  # Browser files only (dist/browser/)
```

## Run (viewer)

```bash
cd mvp && npm start
```

This will:
1. Generate `data/rapid-sample.json`
2. Start a local HTTP server at `http://localhost:4173`
3. Open `viewer.html` in your browser automatically

Stop with `Ctrl+C`.

Legacy (no build required):
```bash
node mvp/start_viewer.js
```

## Run (data model only)

After building, from `mvp/`:

```bash
node dist/node/rapid_mvp.js
```

Generates `data/rapid-sample.json` without starting the viewer.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Add child to selected node |
| `Enter` | Add sibling to selected node |
| `Shift+Enter` | Edit selected node text |
| `F2` | Edit selected node text (alias) |
| `Esc` | Cancel text editing |
| `Delete` / `Backspace` | Delete selected subtree (root protected) |
| `Space` | Collapse/expand selected node |
| `↑` / `↓` | Navigate through visible nodes |
| `M` | Mark selected node as move source |
| `P` | Move marked node under currently selected node |
| `Ctrl/Cmd + Wheel` | Zoom |

## Demo data

| Button | File |
|--------|------|
| Default | `data/rapid-sample.json` (regenerated on each startup) |
| Airplane | `data/airplane-parts-demo.json` |
| Aircraft.mm | `data/aircraft.mm` (Freeplane format) |

## Aircraft visual check walkthrough

Click **Run aircraft visual check** in the toolbar to step through a repeatable inspection sequence:
- Root overview
- Zoomed-out whole-map readability
- Branch selection on `Body` and `Wing`
- Collapse/expand visibility
- Label readability on `Main Wing` and `Propeller`

Stop at any time with **Stop visual check**.

## Visual regression tests (Playwright)

Setup (first time):
```bash
cd mvp
npm install
npx playwright install chromium
```

Run tests:
```bash
npm run test:visual
```

Update baselines:
```bash
npm run test:visual:update
```

Notes:
- `test_server.js` serves the viewer on `http://127.0.0.1:4173/viewer.html` without opening a browser.
- Falls back to legacy `viewer.js` if `dist/browser/viewer.js` is not found.

## Freeplane `.mm` import

Imported fields: `TEXT`, `FOLDED`, `LINK`, `richcontent DETAILS`, `richcontent NOTE`, `attributes`

**MVP limitation:** Imported metadata (details, note, attributes, link) is preserved in JSON state but the viewer renders `text` only.

## MVP limitations and known gaps

The following are out of MVP scope and deferred:

- Rendering of metadata fields (details, note, attributes, link) in the viewer
- Full Freeplane `.mm` compatibility
- Persistent `ViewState` separation from document state (in progress)
- Reparent UX improvement (target highlight, rejected drop feedback)
- Delete confirmation dialog for non-leaf nodes
- Performance logging for Rapid band checks
- Stage A CI pipeline
- Multi-user / server deployment (PostgreSQL deferred)
