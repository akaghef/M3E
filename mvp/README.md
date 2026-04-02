# M3E Rapid MVP
**This is a memorandum for user. NOT to write here.**

## Important

`mvp/` is Alpha and frozen for development.

- Do not add new features in `mvp/`.
- Use `beta/` for active development.
- For daily startup, use `scripts/beta/launch.bat`.

Beta docs: `beta/README.md`

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
2. Start a local HTTP server at `http://localhost:38482`
3. Open `viewer.html` in your browser automatically

Stop with `Ctrl+C`.

Legacy (no build required):
```bash
node mvp/legacy/start_viewer.js
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