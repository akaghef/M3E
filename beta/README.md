# M3E Beta
**This is a memorandum for user. NOT to write here.**

## Build

```bash
cd beta
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
cd beta && npm start
```

This will:
1. Generate `data/rapid-sample.json`
2. Start a local HTTP server at `http://localhost:4173`
3. Open `viewer.html` in your browser automatically

Stop with `Ctrl+C`.

### Optional cloud sync (file-mirror mode)

Cloud sync can be enabled as an opt-in mirror layer on top of local SQLite persistence.

Environment variables:

```bash
M3E_CLOUD_SYNC=1
M3E_CLOUD_DIR=./data/cloud-sync
```

Behavior:

- On startup: tries cloud pull first, then falls back to local SQLite/doc sample
- On save/autosave: keeps local save and additionally pushes to cloud mirror
- Cloud backend in Beta is file-based (`M3E_CLOUD_DIR`) for local-first validation

Sync API endpoints:

- `GET /api/sync/status/:docId`
- `POST /api/sync/pull/:docId`
- `POST /api/sync/push/:docId`

Legacy (no build required):
```bash
node beta/legacy/start_viewer.js
```

## Run (data model only)

After building, from `beta/`:

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

## Visual regression tests (Playwright)

Setup (first time):
```bash
cd beta
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