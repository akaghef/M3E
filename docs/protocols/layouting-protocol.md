# Layouting Protocol

## Product reference

See `docs/03_Spec/map_layout_modes.md` for layout modes.

## Operating distinction

- `layouting`: product/view placement behavior.
- `display intent`: write-time contract for human review.

## Core rules

- Tree `edge` participates in layout.
- Graph-level `GraphLink` is overlay and does not participate in layout.
- node-level `link` is an attribute and has no layout meaning.
- Synthetic anchors must be marked and must not be mistaken for semantic source nodes.

## Choosing display form

Before writing:

1. What should a human notice first?
2. What should be side-by-side?
3. What is the primary relation: tree, sequence, dependency, review queue, or timeline?
4. Is the current layout mode implemented?
5. Should this stay unscoped for review?

## Worker boundary

Worker must not change layout mode or introduce synthetic anchors unless the handoff explicitly says so.
