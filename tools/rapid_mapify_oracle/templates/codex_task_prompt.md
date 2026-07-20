# Codex prompt template: M3E Rapid × Mapify Oracle

You are working in the M3E repo. The mission is to improve M3E Rapid generation by treating Mapify Rapid-equivalent action as the provisional correct teacher trajectory.

## Fixed invariants

```text
Mapify action = teacher trajectory
M3E AppState = canonical state
Rapid = local selected-node/subtree delta
Flash = whole-source-to-map generation
```

## Current slice

```text
Operation: RF1.expandSelectedNode
Benchmark: fixtures/cases/biology_expand_animals.case.json
Selected node: 動物
Teacher delta: append 爬虫類, 両生類, 無脊椎動物 under 動物
```

## Required implementation behavior

- User selects an existing node.
- User invokes Rapid expansion through M3E's intended UI path.
- M3E generates candidate child labels using map-native formatting.
- M3E appends children under the selected node only.
- M3E records enough evidence to compare candidate delta against teacher delta.

## Do not

- Do not generate a new whole map.
- Do not add nodes to root unless root is explicitly selected.
- Do not use long sentence labels.
- Do not duplicate existing sibling labels.
- Do not copy Mapify's data model into M3E.
- Do not extract Mapify cookies.
- Do not revert unrelated dirty worktree changes.

## Verification to run

1. Unit: delta writer appends under selected node.
2. Model: AppState before/after diff matches local change.
3. Browser: visible map shows new children.
4. Quality: run or reproduce `scripts/evaluate_case.py` rubric logic.

## Required report

```text
- files changed
- commands run
- AppState diff summary
- browser verification summary
- grade score
- failure IDs if failed
- next patch if not passed
```
