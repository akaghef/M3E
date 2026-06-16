# Technology Stack

## Architecture

M3E beta is a TypeScript application with a Node.js local server and browser viewer. The current architecture favors local-first operation, explicit persistence boundaries, and small feature slices that can be verified with unit and browser-visible checks.

## Core Technologies

- **Language**: TypeScript.
- **Runtime**: Node.js for local server, filesystem, SQLite, import/export, sync, and AI proxy work.
- **Frontend**: Browser TypeScript plus React-based workbench surfaces where applicable.
- **Build**: TypeScript compiler and Vite.
- **Persistence**: `better-sqlite3` for local workspace data; JSON state remains an important compatibility shape.
- **Testing**: Vitest for unit checks and Playwright for browser-visible flows.

## Key Libraries

- `better-sqlite3` for local SQLite persistence.
- `@playwright/test` for visual and end-to-end verification.
- `vitest` for unit tests.
- `vite` for browser build output.
- `elkjs`, `cytoscape`, `@xyflow/react`, `@antv/x6`, and `@joint/core` for graph/layout/prototype surfaces.
- `js-yaml` for Markdown/frontmatter-oriented flows.
- `@langchain/langgraph` / `langchain` for graph runtime experiments.
- `@supabase/supabase-js` for optional cloud sync experiments.

## Development Standards

### Type Safety

- Prefer explicit TypeScript types and shared interfaces from `beta/src/shared/`.
- Avoid broad `any` and stringly contracts when a local type already exists.
- Validate external input at the Node/API boundary before applying it to `AppState` or persistent storage.

### Data Safety

- Treat `workspace > map > scope > node` as the product hierarchy.
- Preserve `mapId`, `workspaceId`, and runtime data-profile separation.
- Save/sync/recovery changes need narrow tests and clear rollback or backup behavior.
- Do not infer runtime truth from source alone when a visible viewer/runtime state is relevant.

### Code Quality

- Follow existing module patterns before introducing new abstractions.
- Keep UI behavior, persistence, and synchronization changes in small reviewable slices.
- Prefer established libraries for parsing, file watching, database access, rendering, and browser tests.

### Testing

- Use the narrowest relevant check first.
- Typical beta checks:

```bash
npm --prefix beta run build:node
npm --prefix beta run build:browser
npm --prefix beta run test:unit
npm --prefix beta run test:visual
```

- Browser-facing behavior requires actual browser-visible verification when the change affects the viewer.

## Development Environment

### Required Tools

- Node.js and npm.
- Git worktrees through `scripts/ops/worktree.sh`.
- Playwright browser dependencies for visual checks.

### Common Commands

```bash
npm --prefix beta install
npm --prefix beta run build
npm --prefix beta run test:unit
npm --prefix beta start
```

## Key Technical Decisions

- `beta/` is the active development target; `final/` receives validated beta changes only.
- Product implementation happens in task worktrees on `codex/<task>` branches.
- SQLite is the standard local persistence layer for beta runtime state, while Markdown/vault integration can define a mode where `.md` is the source of truth and SQLite is cache/index.
- AI-backed transformations must pass through local Node APIs; browser code must not receive provider API keys.

---
_Document technology patterns and constraints, not every dependency._
