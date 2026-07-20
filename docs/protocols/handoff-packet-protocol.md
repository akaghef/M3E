# Handoff Packet Protocol

## Purpose

A handoff packet gives Codex enough context to execute a scoped task without re-reading the entire history.
Claude writes these packets as Director; Codex executes them as worker.

## Required Sections

Use the Director Playbook template:

1. `OBJECTIVE`: one sentence describing done.
2. `CONTEXT`: only what Codex needs; prefer file pointers over pasted history.
3. `SCOPE`: files/dirs/maps Codex may touch.
4. `CONSTRAINTS`: conventions and forbidden changes.
5. `ACCEPTANCE`: checkable criteria.
6. `OUTPUT`: required report shape.

For code-writing tasks, also include:

- target worktree: `$HOME/dev/M3E-<task>`
- target branch: `codex/<task>`
- PR base: `dev-beta`
- whether `beta_update` is required

## What to Include for Codex

- `docs/00_Home/Agent_Brief.md`
- `docs/00_Home/Current_Status.md`
- `docs/00_Home/Glossary.md`
- relevant `docs/03_Spec/*`
- relevant `docs/protocols/*`
- relevant contract YAMLs
- concise decision/correction summary
- required verification commands

## What to Include for GPT Pro

GPT Pro receives the same product/protocol pointers when it is used for reasoning or review, but it is not the implementation worker unless explicitly directed by akaghef.

## What Not to Include by Default

- raw logs unless needed as evidence
- stale drafts that have been superseded
- duplicate copies of product specs
- obsolete Claude sub-agent launch instructions
