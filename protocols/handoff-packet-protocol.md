# Handoff Packet Protocol

## Purpose

A handoff packet gives GPT Pro / Codex / Claude / worker agents enough context to execute without re-reading the entire history.

## Required sections

1. Task objective
2. Target repo/branch/worktree
3. Target map/path/scope
4. Canonical docs to read
5. Operating protocols to obey
6. Allowed changes
7. Forbidden changes
8. Verification requirements
9. Expected output format
10. Open decisions for akaghef

## What to include for GPT Pro

- `docs/00_Home/Agent_Brief.md`
- `docs/00_Home/Current_Status.md`
- `docs/00_Home/Glossary.md`
- relevant `docs/03_Spec/*`
- relevant `protocols/*`
- contract YAMLs
- concise decision/correction summary
- adherence patterns summary

## What not to include by default

- raw logs unless needed as evidence
- stale drafts that have been superseded
- duplicate copies of product specs
