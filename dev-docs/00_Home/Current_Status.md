# Current Status

## Documentation Operation Update (2026-03-30)

- Added `06_Operations/Decision_Pool.md` as the intake point for conversation decisions
- Added `06_Operations/Documentation_Rules.md` for documentation handling rules
- Future conversation decisions should be recorded there before promotion to formal docs

## Current Direction

M3E is currently moving from a `Freeplane-first UI` approach to a `Freeplane-informed custom engine` approach.

Freeplane is still important, but mainly as:

- a reference implementation
- a compatible `.mm` import/export target
- a source of useful node concepts and editing patterns

The rendering engine, layout behavior, and editing interaction are being implemented on the M3E side.

## What Is Decided

- UI shell is based on `React + TypeScript`
- Rendering is currently `SVG-first` for MVP speed
- Layout, rendering, and editing behavior should be separated as much as possible
- Freeplane is referenced, but M3E owns its own interaction model
- `.mm` import is part of the MVP path

## What Is Already Working

- Rapid MVP viewer/editor exists under `mvp/`
- Root-first editing works in the browser
- Node add/edit/delete/collapse works
- Keyboard-first editing works
- Basic zoom and pan behavior exists
- Key mapping and drag interaction were updated for better operability
- JSON save/load works
- Minimal `.mm` import now exists
- Demo loaders exist for sample JSON and `aircraft.mm`

## What Is Still Open

- `ViewState` is not fully separated from persisted document state in all code paths
- Minimal `reparent` UI now exists, but still needs refinement
- Imported metadata is preserved but not yet rendered in the UI
- `.mm` support is still MVP-level, not full Freeplane compatibility
- Some older docs still contain mojibake and need cleanup

## Immediate Next Steps

1. Fix remaining documentation readability issues
2. Finish separating `ViewState` from persisted document state
3. Refine the minimal `reparent` UI in the viewer
4. Improve `.mm` import validation and rendering of imported metadata

## Related Documents

- Direction pivot: [Current_Pivot_Freeplane_First.md](/C:/Users/Akaghef/dev/M3E/dev-docs/02_Strategy/Current_Pivot_Freeplane_First.md)
- MVP definition: [MVP_Definition.md](/C:/Users/Akaghef/dev/M3E/dev-docs/02_Strategy/MVP_Definition.md)
- Custom engine ADR: [ADR_003_Freeplane_Informed_Custom_Engine.md](/C:/Users/Akaghef/dev/M3E/dev-docs/09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
- UI basis ADR: [ADR_002_React_UI_Basis.md](/C:/Users/Akaghef/dev/M3E/dev-docs/09_Decisions/ADR_002_React_UI_Basis.md)
- Decision intake: [Decision_Pool.md](/C:/Users/Akaghef/dev/M3E/dev-docs/06_Operations/Decision_Pool.md)

## Working To-Do (2026-03-30)

### Today Goal

- [ ] Build a near-perfect UI experience for the Rapid MVP viewer

### UI Core (must)
* [X] ~~*AFEEJF*~~ [2026-03-30]
- [X] ~~*Keep edit flow fast: `Enter` sibling add, `Shift+Enter` edit start, `Tab` child add*~~ [2026-03-30]
- [X] ~~*Keep selection stable after every edit action*~~ [2026-03-30]
- [ ] Improve reparent interaction feedback (target highlight + rejected drop message)
- [ ] Make delete safer (confirm on non-leaf)
- [ ] Ensure collapsed/expanded states are always obvious

### View Experience (must)

- [ ] Finalize zoom UX (button + wheel consistency)
- [x] Finalize pan UX (drag smoothness and boundaries)
- [ ] Add fit-to-content and focus-selected actions
- [ ] Keep viewport stable during frequent edits
- [ ] Remove visual jitter on rapid operations

### Visual Polish (must)

- [ ] Unify spacing and text rhythm across root and child labels
- [ ] Tune edge curvature and color consistency
- [ ] Improve selected-state contrast for readability
- [ ] Handle long node text without layout break
- [ ] Clean up toolbar density for daily use

### Demo Readiness (must)

- [ ] Confirm `aircraft.mm` demo renders cleanly
- [ ] Confirm `airplane-parts-demo.json` works with full edit flow
- [ ] Prepare a 2-minute walkthrough script (open -> edit -> reparent -> save)
- [ ] Ensure startup does not block demo flow (`EADDRINUSE` fallback or clear recovery)

### Done Criteria (today)

- [ ] First-time user can complete edit operations without verbal help
- [ ] No obvious visual break during zoom/pan/edit on demo data
- [ ] UI is judged "demo-ready" by owner review
