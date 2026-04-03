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

### UI terminology

- `meta-panel` (class name): Official name is "メタパネル".
- This panel shows mode/scope/status metadata and shortcut hints.

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

### Optional AI infrastructure and linear transform subagent

Beta now treats external model access as shared AI infrastructure.
Linear <-> Tree conversion is one feature on top of that provider layer.
This build provides the integration layer only: shared provider config,
prompt file loading, status probing, and a proxy API for conversion requests.

Concrete DeepSeek setup:

1. Create a DeepSeek API key.
2. Store it in Bitwarden.
3. Put the API key in the Bitwarden item's `password`.
4. Optionally add custom fields:
   - `provider=deepseek`
   - `transport=openai-compatible`
   - `base_url=https://api.deepseek.com`
   - `model=deepseek-chat`
5. Unlock Bitwarden and export `BW_SESSION`.
6. Launch Beta through:

```powershell
pwsh -File scripts/beta/launch-with-ai.ps1 -BitwardenItem "m3e-deepseek"
```

This launcher injects:

- `M3E_AI_ENABLED=1`
- `M3E_AI_PROVIDER=deepseek`
- `M3E_AI_TRANSPORT=openai-compatible`
- `M3E_AI_API_KEY=...`
- `M3E_AI_BASE_URL=https://api.deepseek.com`
- `M3E_AI_MODEL=deepseek-chat`

Concrete local Gemma setup (Ollama):

1. Run installer script:

```powershell
pwsh -File scripts/beta/install-ollama-gemma3-4b.ps1
```

2. Create Bitwarden item (example name: `m3e-ollama-gemma`) and set:
  - `password=ollama` (dummy key for OpenAI-compatible auth header)
  - `provider=ollama`
  - `transport=openai-compatible`
  - `base_url=http://localhost:11434/v1`
  - `model=gemma3:4b`

3. Launch with AI:

```powershell
bw unlock
$env:BW_SESSION = "<session>"
pwsh -File scripts/beta/launch-with-ai.ps1 -BitwardenItem "m3e-ollama-gemma"
```

Or launch directly without Bitwarden:

```bat
scripts\beta\launch-with-local-gemma.bat
```

Environment variables:

```bash
M3E_AI_ENABLED=1
M3E_AI_PROVIDER=deepseek
M3E_AI_TRANSPORT=openai-compatible
M3E_AI_BASE_URL=https://api.deepseek.com
M3E_AI_API_KEY=YOUR_API_KEY
M3E_AI_MODEL=deepseek-chat
M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT_FILE=./prompts/linear-agent/system.txt
M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT_FILE=./prompts/linear-agent/tree-to-linear.txt
M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT_FILE=./prompts/linear-agent/linear-to-tree.txt
```

Notes:

- `openai-compatible` transport is implemented and intended for DeepSeek-style APIs.
- `mcp` is reserved in the config surface, but not implemented yet.
- `M3E_AI_GATEWAY=litellm` can be used to indicate gateway mode in status output.
- Provider connection settings live under `M3E_AI_*` so other AI-backed features can reuse the same base config.
- Model alias switching can be configured via `M3E_AI_DEFAULT_MODEL_ALIAS` + `M3E_AI_MODEL_REGISTRY_JSON`.
- Prompt files under `beta/prompts/linear-agent/` are placeholders and should be refined later.
- Legacy `M3E_LINEAR_AGENT_*` env names are still accepted as a temporary fallback.

Model alias example:

```bash
M3E_AI_DEFAULT_MODEL_ALIAS=chat.fast
M3E_AI_MODEL_REGISTRY_JSON={"chat.fast":{"label":"Fast Cloud","kind":"chat","privacy":"cloud","capabilities":["streaming"],"targetModel":"deepseek-chat","dataPolicy":"cloud_allowed"},"chat.local":{"label":"Gemma Local","kind":"chat","privacy":"local","capabilities":["streaming"],"targetModel":"gemma3:4b","dataPolicy":"local_only"}}
```

Recommended rollout:

1. Phase 1 (quickest): `Vercel AI SDK + Ollama/OpenAI`.
2. Phase 2 (infrastructure): add LiteLLM gateway and route local/cloud models through one endpoint.

Bitwarden-based launch:

```powershell
bw unlock
$env:BW_SESSION = "<session>"
pwsh -File scripts/beta/launch-with-ai.ps1 -BitwardenItem "m3e-deepseek"
```

Expected Bitwarden item shape:

- `password`: API key
- optional custom fields:
  - `provider`
  - `transport`
  - `base_url`
  - `model`

The launcher maps those values into shared `M3E_AI_*` env vars before starting Beta.

Linear transform API endpoints:

- `GET /api/linear-transform/status`
- `POST /api/linear-transform/convert`

Common AI API endpoints:

- `GET /api/ai/status`
- `POST /api/ai/subagent/linear-transform`
- `POST /api/ai/subagent/topic-suggest`

Trial feature in viewer:

- Toolbar button: `AI topics`
- Shortcut: `Ctrl/Cmd+Shift+T`
- Behavior: calls `topic-suggest` and appends proposed related topics as child nodes of current selection

Minimal request example:

```json
{
  "documentId": "rapid-main",
  "scopeId": "root",
  "mode": "direct-result",
  "input": {
    "direction": "tree-to-linear",
    "sourceText": "- id: root\n  text: \"Root\"",
    "scopeLabel": "Root"
  }
}
```

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
| `Tab` | Add child to selected node and start editing the new node |
| `Enter` | Add sibling to selected node and start editing the new node |
| `Shift+Enter` | Insert a newline while editing node text |
| `F2` | Edit selected node text (alias) |
| `Esc` | Cancel text editing |
| `Delete` / `Backspace` | Delete selected subtree (root protected). In nested scope, `Backspace` on scope root goes back scope |
| `Space` | Collapse/expand selected node |
| `↑` / `↓` | Navigate through visible nodes |
| `→` | Go deeper: if folder is selected, enter scope; otherwise select first child |
| `←` | Go shallower: if current scope root is selected, back scope; otherwise select parent |
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
