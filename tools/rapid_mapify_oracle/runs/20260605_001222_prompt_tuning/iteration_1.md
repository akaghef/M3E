# Prompt tuning Iteration 1

## Scenario Set

- A median: selected 動物, existing children 哺乳類 / 鳥類 / 魚類, teacher trace supports missing classes.
- B edge: selected 魚類, no teacher trace.

## Requirements Checklist

1. [critical] Local delta under selected node only, not whole map.
2. [critical] No fallback/dictionary route when teacher evidence is insufficient; return NEED_CONTEXT.
3. Short map-native noun phrase labels.
4. Single semantic role per run.
5. Filter existing sibling labels.
6. Machine-convertible appendChildren-style output.

## Iter-1 executor result summary

Success: ○
Accuracy: 100%
Steps: estimated 1 executor call
Duration: estimated from subagent wall-clock
Retries: 0

## Newly surfaced unclear points

- Issue: What counts as teacher trace sufficient.
  - Cause: Prompt did not define evidence threshold.
  - General Fix Rule: Define sufficient evidence as explicit candidate labels or explicit same-role expansion pattern with stated candidates.
- Issue: Parent id naming in benchmark.
  - Cause: Scenario gave labels, not concrete node IDs.
  - General Fix Rule: Require stable selectedNodeId from harness and forbid prompt-generated stable IDs.
- Issue: Order of children.
  - Cause: Expected labels implied order but prompt had no order rule.
  - General Fix Rule: Preserve teacher-trace order after duplicate filtering.

## Fix applied for Iter-2

Created `tools/rapid_mapify_oracle/prompts/local_delta_worker.md` with:

- Teacher Sufficiency section
- ID And Order section
- JSON-only appendChildren / NEED_CONTEXT output
- Explicit no fallback/common-knowledge rule
