# Visual Design Guidelines

## Purpose

This document defines the visual design policy for the M3E MVP viewer/editor.

The goal is not to finish the final product design.
The goal is to make visual decisions explicit enough that implementation can move without repeated ambiguity.

This document focuses on:

- node appearance
- node color policy
- typography
- spacing and density
- interaction feedback
- metadata presentation
- implementation policy for design evolution

## Design Direction

The MVP should feel:

- lightweight
- editable
- structured
- calm rather than decorative
- information-first rather than illustration-first

Reference mood:

- Miro mind map for layout clarity
- Freeplane for information density
- M3E-specific emphasis on readable structure and future metadata

The MVP should not aim for a “finished brand look” yet.
It should aim for a stable visual grammar that can survive later renderer changes.

## Core Visual Principles

### 1. Structure First

- Hierarchy must be readable before decoration.
- Parent/child relation must remain obvious at a glance.
- Selection, collapse, drag target, and edit target must always override decorative styling.

### 2. Calm Base, Strong Interaction

- Default nodes should be neutral and easy to scan.
- Strong color should be used mainly for interaction states and branch recognition.
- Permanent saturated colors on every element should be avoided.

### 3. Color Carries Meaning Sparingly

- Color should help orientation, not become the main encoding for meaning.
- Important semantic distinctions must not rely only on color.
- Future node types may use accent hints, but the base MVP should remain readable in grayscale.

### 4. Metadata Is Secondary but Visible

- `text` is primary.
- `details`, `note`, `attributes`, and `link` are secondary.
- Secondary data should appear in a consistent place and not compete with the node label.

## Node Design Policy

### Root Node

- Root is visually distinct from normal nodes.
- Root uses a bounded shape, not plain text only.
- Root should feel like the map anchor rather than just another node.

MVP decision:

- Root uses a rounded rectangle
- Root keeps a stronger outline than child nodes
- Root text is centered

### Child Nodes

- Child nodes should prioritize fast scanning.
- Child nodes should remain mostly text-led.
- Heavy containers for every child node are not required in the MVP.

MVP decision:

- Child nodes are rendered as text-led rows with a soft interaction hit area
- Selection and drag target states are shown via background highlight
- Non-selected child nodes do not require visible boxes by default

### Collapsed Nodes

- Collapse state must be recognizable without adding visual noise.
- The collapsed indicator should remain small and consistent.

MVP decision:

- Use a small `+` indicator
- Keep it aligned near the node end
- Do not use large disclosure widgets yet

## Node Color Policy

### Why Node Color Needs a Policy

Without a policy, node color tends to become inconsistent very quickly:

- some colors represent depth
- some colors represent interaction
- some colors represent node type
- some colors are purely decorative

That creates collisions.

### Color Roles

For the MVP, color should be separated into these roles:

1. Base surface color
2. Text color
3. Interaction accent
4. Branch edge color
5. Validation/error color
6. Optional semantic color

### MVP Decision

- Node fill should stay mostly neutral
- Text should stay dark and high-contrast
- Selection should use one consistent accent family
- Branch recognition should mainly happen on edges, not full node fills
- Error/destructive actions should use a separate danger color
- Semantic node colors are deferred until node type rules are clearer

### Practical Consequences

- Do not color every node by branch fill
- Do not introduce per-node rainbow fills in MVP
- Use branch color on connecting edges first
- Use selection fill for focus state
- Reserve additional fills for future node typing or status, not for decoration

## Visual Element Inventory

This section lists the visual elements that should be treated as explicit design items.

These items should not be changed casually one by one.
They should be considered as part of a coherent visual system.

### 1. Node

- root node fill color
- root node border color
- root node border width
- root node corner radius
- child node fill color
- child node border color
- selected node fill color
- selected node border color
- hover node fill color
- drag source fill color
- valid drop target fill color
- invalid drop target color treatment
- collapsed indicator color
- node hit area size
- node opacity
- node shadow or no-shadow policy

### 2. Edge

- branch edge color
- edge color variation by depth
- edge color variation by branch
- edge thickness
- edge curvature
- edge opacity
- edge cap style
- selected path emphasis

### 3. Typography

- root text color
- child text color
- secondary text color
- metadata text color
- link text color
- root font size
- child font size
- metadata font size
- font weight policy
- line height
- text truncation policy
- long label wrapping policy

### 4. Surface

- app background color
- board background color
- grid line color
- grid density
- grid opacity
- panel background color
- toolbar background color
- inspector background color
- section divider color

### 5. Interaction

- selection accent color
- focus ring color
- editing state color
- destructive action color
- success state color
- warning state color
- info state color
- disabled state color
- drag preview style
- drop target highlight style

### 6. Metadata

- details text style
- note text style
- attribute key style
- attribute value style
- link icon or link marker style
- metadata section spacing
- metadata separator style
- metadata panel width

### 7. Density and Spacing

- parent-child distance
- sibling spacing
- branch column gap
- root padding
- child hit padding
- canvas side padding
- canvas bottom padding
- inspector spacing
- toolbar spacing

## Development Policy for Visual Elements

To keep the visual system manageable, these items should be grouped into stable buckets.

Recommended buckets:

- `Node`
- `Edge`
- `Typography`
- `Surface`
- `Interaction`
- `Metadata`
- `Density`

Implementation rule:

- Every tunable visual value should belong to one of these buckets
- New visual values should be added to centralized tuning, not scattered inline
- Node color and interaction color must remain separate concerns
- Branch differentiation and semantic meaning must not share the same color channel by default

## Typography Policy

### Considerations

- Labels are the dominant information object
- Long labels are common
- The renderer may later move from SVG to Canvas
- Font metrics must stay predictable enough for layout

### MVP Decision

- Use one primary UI font family for now
- Root text may be larger than child text
- Child text should stay large enough for zoomed-out scanning
- Font weight should communicate emphasis lightly, not heavily

### Development Policy

- Typography tuning must live in central tuning parameters
- Font changes must be checked against layout width calculations
- Avoid introducing multiple decorative font families in MVP

## Spacing and Density Policy

### Considerations

- Tight layouts feel powerful but become unreadable fast
- Loose layouts improve clarity but reduce map density
- Future metadata display will increase density pressure

### MVP Decision

- Keep layout slightly airy rather than aggressively compact
- Tune sibling spacing and branch spacing separately
- Preserve enough hit area for drag, click, and touchpad use

### Development Policy

- Spacing constants must be centralized
- Visual density should be tuned from one source of truth
- Changes to spacing should be tested with:
  - short labels
  - long labels
  - deep trees
  - wide sibling sets

## Interaction Feedback Policy

### Required Interaction States

- selected
- editing
- collapsed
- drag source
- valid drop target
- destructive action target

### MVP Decision

- Selected node uses a soft accent fill
- Drag source uses a separate warm hint
- Valid drop target uses a green-tinted hint
- Editing should rely on the text input focus for now, not an in-node text editor
- Dangerous actions remain button/status based, not visually dramatic

### Development Policy

- Interaction colors must remain distinct from branch colors
- Interaction state must win over decorative state
- A user should always understand “what will happen if I release now”

## Metadata Presentation Policy

### Considerations

- `.mm` import already carries metadata beyond `text`
- Putting all metadata inside the node will quickly destroy readability
- Metadata still needs to be inspectable in MVP

### MVP Decision

- Node label shows only primary `text`
- Secondary metadata should appear in a side panel or secondary inspector area
- Links should be visibly identifiable but not always expanded inline
- Attributes should be displayed as structured key/value rows
- `details` and `note` should be visually separated from each other

### Development Policy

- Do not overload the node body with imported metadata
- Favor “select node -> inspect metadata” over “everything visible at once”
- Keep node rendering stable even as metadata support grows

## Accessibility and Robustness Considerations

- Text contrast must remain high
- Color must not be the only meaning carrier
- Small indicators must still remain visible under zoom-out
- Hit areas should be larger than the visible text bounds
- Selection and drag target states must still be understandable under reduced contrast

## What We Intentionally Defer

- final brand palette
- theme switching
- dark mode
- semantic node-type color system
- polished iconography
- rich inline metadata cards inside nodes
- animation-heavy transitions

## Implementation Policy

### Source of Truth

MVP visual tuning values should be centralized.

Current implementation direction:

- visual tuning constants live in `mvp/viewer.tuning.js`
- structural CSS lives in `mvp/viewer.css`
- behavior lives in `mvp/viewer.js`

### Decision Rule for Future Design Changes

When deciding whether to introduce a new visual style, use this order:

1. Does it improve structure readability?
2. Does it improve editing clarity?
3. Does it preserve future renderer portability?
4. Does it avoid colliding with semantic meaning planned for later?
5. Is it cheap to tune centrally?

If a change is mainly decorative and does not help the first three, defer it.

### Node Color Development Policy

For now:

- keep node bodies neutral
- use edges for branch differentiation
- use accent fills for interaction
- reserve semantic fills for later

This is the default rule unless a later ADR or spec explicitly changes it.

## MVP Decisions Summary

- Root is visually boxed and distinct
- Child nodes stay text-led and light
- Branch color lives mainly on edges
- Selection color is consistent and reserved for interaction
- Semantic node colors are deferred
- Metadata is inspectable outside the main node label
- Tuning values must stay centralized
- Design changes should favor clarity over decoration

## Link as a Separate Visual Element

`Link` should be treated as a separate visual category from `Edge`.

### Edge

- shows structural parent-child relation
- is part of the main reading path
- should remain the strongest connector in the tree view

### Link

- shows non-tree relation or semantic association
- should read as an overlay, not as part of the skeleton
- must be visually distinguishable from `Edge`

### Link Design Items

- link stroke color
- link thickness
- link opacity
- link dash pattern
- link arrowhead style
- link curvature
- link label style
- link hover state
- selected link state
- rendering layer order relative to edge

### MVP Visual Policy

- `Edge` keeps the main branch color system
- `Link` should use a different visual language, preferably lighter or dashed
- `Link` should not borrow the main selection accent by default
- `Link` should not visually overpower structural edges

### Development Policy

- keep `edge` tuning and `link` tuning in separate buckets
- do not let `Link` affect layout rules
- do not render `Link` exactly like `Edge`
- prepare `viewer.tuning.js` to split `edge` and `link` when implementation starts
