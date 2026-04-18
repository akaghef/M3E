# ADR 004: SQLite for Rapid MVP

## Status

Accepted

## Date

2026-03-31

## Context

M3E Rapid MVP is currently focused on:

- stable local editing
- save/load correctness
- `.mm` import/export compatibility
- demo-ready operation with minimal setup cost

The current technical risks are not backend scale problems.
They are:

- separation of persisted document state and `ViewState`
- correctness of save/load boundaries
- robustness of import/export
- consistency after repeated edit operations

At this stage, introducing a server-first database would increase implementation and operation complexity before it solves the actual MVP bottlenecks.

## Decision

M3E will complete the Rapid MVP with SQLite as the persistence implementation.

The persistence policy is:

1. The logical source of truth remains the JSON document model.
2. SQLite is used as the local persistence layer for MVP.
3. `.mm` remains an import/export compatibility format.
4. PostgreSQL is deferred until server-backed requirements become concrete.

## Why SQLite

- Fits the current single-user, local-first MVP scope
- Avoids early server startup, auth, and connection management
- Keeps demo and recovery flow simpler
- Supports local persistence, autosave, restore, and migration
- Has lower implementation and operational cost than PostgreSQL for MVP
- Can coexist with JSON-based interchange and fixtures

## Why Not PostgreSQL Yet

- Current MVP problems are not multi-user or distributed-system problems
- The model is still evolving, so early schema stabilization would create churn
- Adding backend operations now would make debugging and demo prep harder
- The project would pay extra cost in setup, migration, failure handling, and environment management

## Consequences

### Positive

- Lower complexity to finish MVP
- Faster local setup and repeatable demo flow
- Easier save/load debugging
- Simpler migration from current JSON-first implementation

### Negative

- Shared editing is still out of scope
- Server-side search/audit/access control are deferred
- A future backend migration path still needs to be designed

## Implementation Notes

- Keep the domain model DB-agnostic
- Use SQLite only as the persistence layer
- Preserve explicit `version` handling for migrations
- Keep export/import boundaries separate from internal storage
- Do not let DB table structure leak into `.mm` or JSON interchange format

## Re-evaluate PostgreSQL When

- multi-device sync becomes required
- collaborative editing becomes required
- server-side search, audit, or access control becomes required
- backup/restore becomes an account-level feature
