# Protocols

This directory is the canonical home for AI operating protocols in M3E / Akaghef-System.

## What belongs here

- How Codex reads/writes maps when delegated.
- How Map Manager scopes, layouts, and gates map mutations.
- How scoped Codex workers receive minimal instructions.
- How handoff packets stay consistent across Claude Director, Codex, and GPT Pro.
- Machine-checkable operating contracts under `contracts/`.

## Current Operating Model

- Claude is Director only.
- Codex (`codex exec`) is the sole worker for implementation, spec writing, refactoring, and investigation.
- Old Claude sub-agent workers (`manage` / `visual` / `data` / `team`) are superseded.
- Claude-facing procedure lives in `CLAUDE.md` and `docs/06_Operations/Director_Playbook.md`.

## What does not belong here

- Product meaning of `node`, `scope`, `edge`, `GraphLink`, node-level `link`, and `alias` → `docs/03_Spec/`
- Temporary conversation decisions → `docs/06_Operations/Decision_Pool.md`
- Full raw logs → evidence archives only

## Canonical protocols

- `map-manager/README.md` (Map Manager operational SSOT)
- `map-manager/gates.md`
- `map-manager/projection-rule.md`
- `map-manager.md` (compatibility entry point only)
- `worker-minimal-instruction.md`
- `map-write-protocol.md`
- `scope-operation-protocol.md`
- `layouting-protocol.md`
- `handoff-packet-protocol.md`
- `codex-claude-sync.md`
