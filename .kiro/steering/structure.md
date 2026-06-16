# Project Structure

## Organization Philosophy

M3E separates product source, stable release output, strategy/spec documents, operations rules, protocols, and task artifacts. New work should land in the smallest directory boundary that already owns the behavior.

## Directory Patterns

### Active Product Source

**Location**: `beta/`

Active development target. Contains TypeScript source, prompts, tests, build config, local server, browser viewer, and beta-specific policy.

### Stable Release Surface

**Location**: `final/`

Stable distribution target. Do not implement new product behavior directly here; validated beta changes are migrated into final.

### Product and Architecture Documents

**Location**: `docs/`

Long-lived planning, specification, architecture, operations, ADR, task, and daily documents. Design/spec/architecture prose is Japanese by default.

### Runtime Protocols

**Location**: `protocols/`

Operational protocols for worker behavior, map writes, scope operations, handoff packets, and map-manager routing.

### Agent Skills

**Location**: `.agents/skills/`

Project-local skill instructions for M3E map, map manager, worker, notation, and bridge tasks. Do not duplicate detailed behavior elsewhere when a local skill is the route.

### Scripts

**Location**: `scripts/`

Operational helpers, launch scripts, worktree lifecycle helpers, and platform-specific runtime setup.

### Backlog and Ideas

**Location**: `backlog/`, `idea/`

Working notes and early ideas. Promote stable decisions into `docs/06_Operations/Decision_Pool.md`, `docs/03_Spec/`, `docs/04_Architecture/`, or ADRs as appropriate.

## Beta Source Patterns

### Shared Types

**Location**: `beta/src/shared/`

Shared TypeScript contracts used across Node and browser code.

### Node Runtime

**Location**: `beta/src/node/`

Local server, SQLite persistence, sync/import/export, AI proxy, audit, backup, graph runtime, and CLI utilities.

### Browser Viewer

**Location**: `beta/src/browser/`

Viewer, browser UI helpers, markdown rendering, workbench UI, tuning, and browser-specific declarations.

### Tests

**Location**: `beta/tests/` and `beta/src/**/*.test.ts`

Use unit tests for pure logic and Playwright tests for browser-visible viewer behavior.

## Naming Conventions

- Files generally use `snake_case.ts` in beta source.
- Product terms should follow `docs/00_Home/Glossary.md`.
- Prefer `map`, `scope`, `node`, `edge`, `alias`, `workspace`, and `linear-text` in specs; tolerate legacy code identifiers such as `docId` only where compatibility requires them.

## Import Organization

- Use relative imports within local beta modules unless an established local pattern uses a shared path.
- Shared cross-boundary types should live in `beta/src/shared/`.
- Node-only filesystem/database/server code belongs in `beta/src/node/`.
- Browser DOM/viewer code belongs in `beta/src/browser/`.

## Worktree and Branch Rules

- Primary checkout: `$HOME/dev/M3E` on `dev-beta`; no product implementation directly there.
- Task worktree: `$HOME/dev/M3E-<task>`.
- Task branch: `codex/<task>`.
- PR base: `dev-beta`.
- Helper: `scripts/ops/worktree.sh`.

## Documentation Placement

- Current short-term strategy state: `docs/00_Home/Current_Status.md`.
- Product terms: `docs/00_Home/Glossary.md`.
- Concrete task handoffs: `docs/tasks/`.
- Operations rules: `docs/06_Operations/`.
- Architecture decisions: `docs/09_Decisions/`.
- Kiro specs: `.kiro/specs/<feature>/`.

---
_Document ownership and placement patterns, not a complete file tree._
