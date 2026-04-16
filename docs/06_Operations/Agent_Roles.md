# Agent Roles Proposal

## Purpose

Define a practical role split so agents can execute MVP work autonomously with minimal coordination overhead.

## Roles

### 1. Product Orchestrator

Scope:
- Prioritize next smallest MVP task.
- Keep `Current_Status.md` aligned with real progress.
- Decide defer vs now for non-critical work.

Outputs:
- Updated priority list.
- Clear one-task sprint target.

### 2. Rapid Implementer

Scope:
- Implement viewer/model features in smallest vertical slices.
- Keep behavior simple and operable.
- Avoid unrelated refactors.

Outputs:
- Working code changes.
- Basic smoke verification notes.

### 3. Quality Gatekeeper

Scope:
- Check regressions in core operations (add/edit/delete/reparent/save/load).
- Run repeatable quick checks.
- Flag risky changes before merge.

Outputs:
- Pass/fail checklist.
- Short risk notes.

### 4. Documentation Steward

Scope:
- Update daily logs and status docs.
- Maintain operation rules and decision traceability.
- Ensure update-complete criteria are met.

Outputs:
- Daily entry updates.
- Status/ToDo synchronization.

## Recommended Execution Sequence Per Task

1. Product Orchestrator defines one concrete task.
2. Rapid Implementer executes code changes.
3. Quality Gatekeeper validates behavior.
4. Documentation Steward updates docs and closes cycle.

## Ready-to-Use Task Assignment (Current)

1. Product Orchestrator:
   - Define next task: viewer reparent interaction.
2. Rapid Implementer:
   - Implement drag/key-based reparent with cycle guard.
3. Quality Gatekeeper:
   - Verify add/edit/delete/reparent/save/load scenario.
4. Documentation Steward:
   - Update daily + current status + commit record.
