# M3E Agent Execution Guide

## Objective

This repository is operated with agent-driven implementation cycles for the Rapid MVP.
Agents should prioritize small validated changes over broad refactors.

## Source of Truth

1. Strategy and MVP scope:
   - `dev-docs/02_Strategy/MVP_Definition.md`
2. Current priorities and progress:
   - `dev-docs/00_Home/Current_Status.md`
3. Daily execution log:
   - `dev-docs/daily/YYMMDD.md`
4. Operations rules:
   - `dev-docs/06_Operations/Documentation_Rules.md`

## Definition of Update-Complete

A task is update-complete only when all three are done:

1. Changes are committed.
2. Daily note is updated (`dev-docs/daily/YYMMDD.md`).
3. Current status is updated (`dev-docs/00_Home/Current_Status.md`).

If any item is missing, task state is still in-progress.

## Agent Workflow

1. Read scope and current status.
2. Pick one smallest deliverable task.
3. Implement with minimal changes.
4. Run a local verification step.
5. Update docs (daily + current status).
6. Commit with an imperative message.

## Branch Operation Policy

1. On branches starting with `dev-`, agents may perform branch operations autonomously.
2. Allowed without per-step confirmation: create/switch `dev-*` branches, stage changes, commit, and push.
3. Exceptions that still require explicit confirmation:
   - destructive history rewrite (`reset --hard`, force-push, history rewrite)
   - operations on `main` or release branches
   - secret/credential related operations

## Constraints for MVP Phase

1. AI proposal features are deferred.
2. Focus on Rapid usability first.
3. Keep data-safe operations as top priority.
4. Prefer simple operable UI over architecture expansion.

## Language Policy

1. Agent-user conversation should be in English by default.
2. Design and development documents under `dev-docs/` should be written in Japanese by default.
3. Code identifiers, file names, API names, and technical tokens may remain in English where appropriate.
4. If a document is a design/spec/architecture/ADR document, prefer Japanese prose even when the surrounding conversation is in English.

## Preferred Task Order (Rapid MVP)

1. Direct editing in viewer (add/edit/delete/reparent).
2. Navigation ergonomics (pan/zoom/focus).
3. Save/restore robustness.
4. Performance checks (500 nodes).

## Handoff Format

When an agent finishes a cycle, report:

1. What changed (files and behavior).
2. What was verified.
3. What remains next (one concrete task).
