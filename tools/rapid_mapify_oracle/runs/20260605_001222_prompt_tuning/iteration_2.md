# Prompt tuning Iteration 2

## Changes from Iter-1

- Added `tools/rapid_mapify_oracle/prompts/local_delta_worker.md`.
- Added explicit teacher sufficiency threshold.
- Added ID rule: output labels only; M3E delta writer assigns IDs.
- Added order rule: preserve teacher-trace candidate order after duplicate filtering.

## Execution results

| Scenario | Success/Failure | Accuracy | steps | duration | retries | Weak phase |
|---|---|---:|---:|---|---:|---|
| A 動物 | × | 87.5% | 1 estimated | estimated | 0 | Formatting |
| B 魚類 missing teacher | × | 87.5% | 1 estimated | estimated | 0 | Formatting |

Success is × because checklist item 6 was partial: scenario omitted concrete `selectedNodeId`, so executor emitted `<selectedNodeId>` placeholder.

## Structured reflection

- Scenario A/B: [critical] items passed, but machine-convertible output was partial.
  - Issue: scenarios specify selected labels but not selected node IDs.
  - Cause: target prompt requires `selectedNodeId`; scenario text omitted it.
  - General Fix Rule: empirical scenarios should include a concrete opaque selected node ID, or explicitly allow a placeholder parent ID.

## Discretionary fill-ins

- Executor used `<selectedNodeId>` as non-invented placeholder.

## Ledger update

- Added: Scenario missing concrete selectedNodeId.

## Next fix

Fix evaluation scenario, not target prompt: provide concrete IDs `n_animals` and `n_fish` to the executor.
