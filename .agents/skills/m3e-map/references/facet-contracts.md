# Facet Contracts

Before writing any non-trivial structure, identify the **facet**. A facet contract defines what the tree, links, aliases, and synthetic anchors mean in that view.

The purpose is to stop the writer from making layout choices too early or mixing semantics with display heuristics.

## Core Rule

- `facet contract` defines **meaning**
- `display intent` defines **how the meaning should be shown to a human**

Never substitute one for the other.

## Minimum Questions

Before writing, answer:

1. What facet is this write in?
2. In this facet, what does `parent-child` mean?
3. In this facet, what do `GraphLink`s mean?
4. Are aliases part of the facet, or cross-facet references?
5. Are anchors semantic, or only display-synthetic?

## Common Facets

### 1. `flow`

Use for program flow, operation flow, procedural steps, pipelines.

- `parent-child`
  - primarily expresses stage/depth ordering
  - depth should reflect process order when the user asks for sequence
- `GraphLink`
  - supplementary dependencies, joins, or cross-stage relations
- `alias`
  - usually optional; use when another facet already owns the canonical node
- `anchor`
  - display-synthetic by default
  - acceptable only when it improves readability without being mistaken for a new processing step

### 2. `dependency`

Use for theorem dependencies, prerequisite graphs, logical support structures.

- `parent-child`
  - structural backbone / spanning tree
  - depth should track dependency direction
- `GraphLink`
  - non-tree dependencies
- `alias`
  - used for alternate viewpoints (`By Chapter`, `Implementation`, etc.)
- `anchor`
  - usually display-synthetic unless the source already has real grouping

### 3. `reviews`

Use for decision queues, judgment maps, question-option trees.

- `parent-child`
  - question / option / rationale breakdown
- `GraphLink`
  - cross-question coupling, prerequisite judgments, or conflicts
- `alias`
  - reuse of canonical questions or options in another context
- `anchor`
  - context grouping for human review batches
  - often strongly recommended when many low-cohesion questions coexist

### 4. `timeseries`

Use for chronology, event sequences, version history, development arcs.

- `parent-child`
  - stage or temporal progression
- `GraphLink`
  - causal or dependency relations not captured by the main temporal axis
- `alias`
  - optional, usually for cross-referencing another facet
- `anchor`
  - acceptable when it preserves chronology while improving reviewability

### 5. `document`

Use for chapter/section trees, notebooks, outlines, folders.

- `parent-child`
  - native document hierarchy
- `GraphLink`
  - cross references, citations, thematic relations
- `alias`
  - alternate placement or index views
- `anchor`
  - often unnecessary because the source already has a hierarchy

## Choosing Between Semantic vs Synthetic Grouping

Ask:

- Is there already a real grouping in the source?
- If not, would grouping improve reviewability?
- Would grouping be mistaken for new meaning?

If grouping improves readability **without** creating false meaning, use a synthetic anchor.

If grouping would blur the intended semantics, avoid it.

## Writer Obligation

When writing through `m3e-map`, the agent must be able to say:

- which facet it chose
- what `parent-child` means in that facet
- whether any inserted anchor is semantic or display-synthetic

If it cannot say that, the write is under-specified and should not jump directly to structure mutation.
