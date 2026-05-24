# Protocols

This directory is the canonical home for AI operating protocols in M3E / Akaghef-System.

## What belongs here

- How agents read/write maps
- How Map Manager scopes, layouts, and delegates work
- How worker agents receive minimal instructions
- How Codex / Claude / GPT Pro handoffs stay consistent
- Machine-checkable operating contracts under `contracts/`

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
