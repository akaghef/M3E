# Display Intent

`display intent` is the human-facing contract for a specific write.

It is not the same as the facet contract.

- `facet contract`
  - what the structure means
- `display intent`
  - how the structure should be shown so a human can review, compare, and judge it quickly

This matters because M3E is a system for structural dialogue between humans and AI, not just graph storage.

## What Display Intent Covers

Display intent may include:

- depth direction
- breadth grouping
- anchoring policy
- coloring policy
- node ordering
- collapse / unscoped preference
- which relations should be visually primary

It is broader than `layout`. Use `display intent` instead of `layout intent` when color and review visibility matter.

## Extraction Questions

When a write request contains structural or visual hints, extract these:

1. What should a human notice first?
2. What should be easy to compare side-by-side?
3. What must stay visually primary?
4. What should be grouped for review speed?
5. What should colors encode?
6. Should the view be scoped or unscoped?

## Anchoring Rule of Thumb

Anchoring is a **display** decision, not a semantic truth claim.

Use anchors when:

- many low-cohesion siblings are hard to review flat
- anchors create review batches or visual chunks
- anchors do not look like new semantic steps

Avoid anchors when:

- the siblings form a meaningful series (`実行1`, `実行2`, ...)
- inserting an anchor would look like a new processing stage
- the source already has a clear structure

Short form:

- low-cohesion mass -> anchor likely helps
- serial progression -> anchor likely hurts

## Coloring Rule of Thumb

Color belongs to display intent whenever the user cares about fast human triage.

Examples:

- review questions:
  - fill = importance
  - border = urgency
- options:
  - fill = confidence
- task maps:
  - fill = difficulty or progress

When the user specifies what colors should help a human notice, that is part of display intent and must be decided before writing.

## Example: Reviews Facet

User need:

- 100 questions are too tangled to review flat
- cluster them by context
- show importance / urgency / confidence quickly
- keep everything unscoped

Display intent becomes:

- `unscoped`
- `anchored by context`
- question nodes emphasize importance/urgency
- option nodes emphasize confidence
- rationale and downside stay as children of each option

This should lead the writer to:

1. keep the map unscoped
2. create context anchors
3. place Q nodes under those anchors
4. place options under each Q
5. place rationale/downside under each option
6. apply color rules intentionally, not as an afterthought

## Example: Flow Facet

User need:

- process order should go along depth
- `実行1` and `実行2` should sit side-by-side

Display intent becomes:

- depth follows process order
- same-stage items share breadth
- anchoring is unnecessary unless the parallel set becomes hard to scan

This means the writer should not introduce an `実行フェーズ` anchor unless readability truly requires it.

## Writer Checklist

Before mutating the map, the writer should be able to state:

- the facet
- the display intent
- whether anchoring is active
- what colors encode
- whether the result should stay scoped or unscoped

If these are unclear, pause the structural mutation and clarify them first in reasoning.
