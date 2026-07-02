# UI Seam Integration Contract

最終更新: 2026-07-02

Status: Draft canonical contract

Evidence: [UI_Seam_Integration_Contract_Evidence.md](./UI_Seam_Integration_Contract_Evidence.md)

Audience: Director, Codex worker, CI gate authors.
Human review surface: contract diffs, claim diffs, CI result, risk, rollback.

---

## 1. GUI Subadditivity Problem Definition

RQ1. GUI subadditivity is the failure mode where good seams A+B+C integrate
into less than A+B+C because they collide on shared runtime resources.

RQ2. The current collision surface is concentrated in
`beta/src/browser/viewer.ts`: selection, focus, keyboard, pointer capture,
drag, edit mode, scope/navigation, camera, layout coordinates, render layers,
save queue, undo/redo, clipboard, z-index, and performance hot paths.

RQ3. Per-seam quality does not compose automatically. A seam can pass its unit
test while stealing a key, focus target, pointer capture, render layer, undo
boundary, save path, or frame budget from another seam.

RQ4. Integration guarantees must be institutional:

- contracts define responsibility and claims;
- CI gates validate schemas, claims, files, imports, tests, performance, rollback;
- worker permission design limits files and shared resources;
- Director reviews contract diff, claim diff, CI, risk, rollback;
- the human owner reviews the contract surface, not implementation internals.

RQ5. The evidence appendix overrides prior assumptions:

- hover is not a central resource; hit-test and z-order are;
- layout, node draw, and edge ports already exist;
- the missing layer is interaction-state ownership.

RK1. Without mechanical contracts, worker agents optimize local feature finish
and under-specify cross-seam effects.

---

## 2. Seam Definition

DC1. Development unit = seam cut by responsibility boundary.
It is not a widget, Button, Panel, Toolbar, or visual component.

DC2. Canonical UI seams:

- `selection`
- `drag-node`
- `edge-label-edit`
- `scope-navigation`
- `keyboard-command`
- `layout`
- `render-surface`
- `persistence-bridge`

DC3. Execution unit does not equal seam.

| Unit | Canonical meaning |
|---|---|
| Development unit | seam |
| Verification unit | seam contract |
| Runtime unit | layered runtime / scheduler |

DC4. Vertical seams are not runtime modules by default. Hot paths may be
folded, scheduled, or inlined at compile/publish time while the seam contract
remains the verification unit.

DC5. Existing seams are authoritative and must be referenced, not re-specified:

- `beta/src/shared/layout_port.ts` (`LayoutPort`, `LayoutResult`);
- `beta/src/shared/node_draw_port.ts` and `node_draw_svg.ts`;
- `beta/src/shared/edge_port.ts`, `edge_route.ts`,
  `parent_child_edge_adapter.ts`, `browser/edge_adapters/graphlink_endpoint_edit.ts`;
- [map_layout_modes.md](./map_layout_modes.md).

DC6. New work must not redefine layout taxonomy, node draw input/output, edge
port semantics, or route semantics.

---

## 3. Shared Resource Catalog

SR0. Seams never mutate shared resources directly. They read through state
views and mutate only through the owner, registry, controller, port, or command.

| Resource | Current state location | Target owner / registry | Rule |
|---|---|---|---|
| Selection | `viewer.ts` `viewState.selectedNodeId`, `selectedNodeIds`, `selectionAnchorId`; `viewer.globals.d.ts` | `SelectionStore` | Set/toggle/range/restore via commands only. |
| Focus | raw DOM `board.focus()` and inline input focus | `FocusController` | No raw focus side effects from seams. |
| Keyboard | document keydown, cheatsheet, inline editor, linear editor handlers | `CommandRegistry` | All keys are mode-scoped claims; exclusive collisions fail. |
| Pointer capture | raw capture/release on canvas, board, linear resize, pen/eraser | `InteractionArbiter` | One pointer owner; explicit capture lifecycle. |
| Drag | `dragState`, `linkPortDragState`, `panState`, `pinchState`, resize, pen/eraser | `DragController` | begin/update/commit/cancel; undo boundary declared. |
| Hover / hit-test | CSS/DOM transient; no central hover state | `RenderRegistry` + `InteractionArbiter` | Claim hit-test zones and z-order, not hover. |
| Edit mode | `inlineEditor`, `inlineEdgeLabelEditor`, `suppressInlineBlurCommit`, `annotationTool` | `EditModeStore` | One active editor unless compatible nesting is declared. |
| Scope/navigation | `currentScopeId`, `currentScopeRootId`, `scopeHistory`, URL scope query | `ScopeNavigationController` | Scope transitions via commands; view routing does not mutate map. |
| Camera/viewport | `zoom`, `cameraX/Y`, camera motion, pending zoom globals | `ViewportController` | Pan/zoom/follow scheduled; hot paths stay bounded. |
| Layout coordinates | `lastLayout`, `visibleOrder`, dimensions in `render()`; `layout_port.ts` | `LayoutPort` existing | Consume `LayoutResult`; no layout mutation during draw. |
| Render layers | string buckets in `render()` and fixed SVG order | `RenderRegistry` | Claim slots, bands, and order; no ad hoc bucket append. |
| Save queue | autosave timer, server saved state, local save/push paths | `PersistencePort` | UI seams mark dirty through persistence commands only. |
| Undo/redo | `undoStack`, `redoStack`, snapshot helpers | `CommandHistory` | Transaction boundary is part of command contract. |
| Clipboard | `clipboardState`, BroadcastChannel, localStorage, browser/server clipboard | `ClipboardPort` | Declare system/local clipboard and selection mutation. |
| z-index | CSS bands in `viewer.css` and Workbench PN | `RenderRegistry` | z-index is a render-layer claim. |
| Performance | `render()`, `applyZoom()`, RAF/timers, viewport fast path | `RuntimeScheduler` | `hotPathSafe` governs async/DOM/persistence/allocation. |

SR1. Missing implemented owners may appear as target owners, but the PR must
be `legacy extraction` or `CI gate`, not silent direct mutation.

SR2. Existing pure ports remain pure resource owners: `LayoutPort`, node draw
port, and edge ports.

---

## 4. Seam Contract Required Fields

RQ6. Contract-less seams must not be integrated into beta.

RQ7. Required fields:

| Field | Meaning |
|---|---|
| `id` | Stable kebab-case seam id. |
| `responsibility` | One responsibility boundary. |
| `inputs` / `outputs` | State views, events, ports, emitted commands/events/render registrations. |
| `commands` / `events` | Owned and invoked commands; observed/emitted events. |
| `stateReads` / `stateWrites` | Reads by selector; writes only through owner/registry/command. |
| `resourceClaims` | Keyboard, pointer, focus, render slots, undo, persistence, perf. |
| `forbiddenResources` | Resources this seam must not touch. |
| `allowedFiles` | Worker file permission manifest. |
| `integrationPoints` | Ports, registries, shell wiring, flags. |
| `tests` | Unit, contract, composition, performance, rollback tests. |
| `rollback` | Feature flag, registry disable, or command disable. |
| `performance` | `hotPathSafe` and constraints. |

RQ8. `performance.hotPathSafe` is mandatory. If true: no async, DOM read, DOM
write, persistence, unbounded allocation, or non-command side effect in hot path.
If false: explain why the seam is outside render/wheel/pointer-move/key-repeat/RAF.

RQ9. Full YAML example:

```yaml
id: edge-label-edit
responsibility: >
  Edit an existing incoming edge or graph-link label without owning selection,
  layout, render ordering, keyboard routing, or persistence scheduling.
inputs:
  stateViews:
    - GraphState.edges
    - GraphState.graphLinks
    - SelectionStore.primarySelection
    - LayoutPort.LayoutResult
    - EditModeStore.activeEditor
  domEvents:
    - dblclick:onEdgeLabel
    - keydown:whileEditing
    - blur:whileEditing
  ports: [LayoutPort, edge_port, edge_route]
  featureFlags: [ui.edgeLabelEdit.altEnter]
outputs:
  commands: [edgeLabelEdit.start, edgeLabelEdit.commit, edgeLabelEdit.cancel]
  events: [edgeLabelEdit:started, edgeLabelEdit:committed, edgeLabelEdit:cancelled]
  renderRegistrations: [overlay.edgeLabelEditor]
commands:
  owns: [edgeLabelEdit.start, edgeLabelEdit.commit, edgeLabelEdit.cancel]
  invokes:
    - commandHistory.beginTransaction
    - commandHistory.commitTransaction
    - persistence.markDirty
events:
  observes:
    - command:edgeLabelEdit.start
    - dom:blur:whileEditing
    - dom:keydown:whileEditing
  emits: [edgeLabelEdit:started, edgeLabelEdit:committed, edgeLabelEdit:cancelled]
stateReads:
  - selector: SelectionStore.primarySelection
  - selector: EditModeStore.activeEditor
  - selector: LayoutPort.currentResult
  - selector: EdgePort.edgeLabelAnchor
stateWrites:
  - owner: EditModeStore
    operation: activate(edge-label-edit)
  - owner: EditModeStore
    operation: clear(edge-label-edit)
  - owner: CommandHistory
    operation: transaction(edgeLabelEdit.commit)
  - owner: PersistencePort
    operation: markDirty(command=edgeLabelEdit.commit)
resourceClaims:
  keyboard:
    - key: Enter:whileEditing
      mode: edge-label-edit
      exclusivity: exclusive
      command: edgeLabelEdit.commit
    - key: Alt+Enter:normal
      mode: viewer
      exclusivity: exclusive
      command: edgeLabelEdit.start
    - key: Escape:whileEditing
      mode: edge-label-edit
      exclusivity: exclusive
      command: edgeLabelEdit.cancel
  focus:
    - target: inlineEdgeLabelInput
      owner: FocusController
      exclusivity: exclusive
  pointer:
    - target: edgeLabelHitZone
      owner: InteractionArbiter
      capture: none
  renderSlots:
    - slot: overlay.edgeLabelEditor
      owner: RenderRegistry
      zBand: editor-overlay
      orderAfter: [graphLinks, edges]
      orderBefore: [contextMenu]
  undo:
    - owner: CommandHistory
      boundary: oneTransactionPerCommit
  persistence:
    - owner: PersistencePort
      schedule: dirtyAfterCommitOnly
forbiddenResources:
  - LayoutPort.mutate
  - SelectionStore.write
  - ViewportController.write
  - rawDocumentKeydown
  - rawBoardFocus
  - directAutosave
  - directUndoStackMutation
allowedFiles:
  - beta/src/browser/viewer.ts
  - beta/src/browser/edge_label_edit.ts
  - beta/src/browser/edge_label_edit.test.ts
  - beta/src/shared/edge_port.ts
  - beta/src/shared/edge_route.ts
  - docs/03_Spec/UI_Seam_Integration_Contract.md
  - docs/03_Spec/UI_Seams/edge-label-edit.yaml
integrationPoints:
  shell: [viewer.ts:wiringOnly]
  registries: [CommandRegistry, EditModeStore, RenderRegistry, PersistencePort, CommandHistory]
  existingPorts: [LayoutPort, edge_port, edge_route]
tests:
  unit: [edge_label_edit.test.ts]
  contract: [validate:seam-contracts, validate:resource-claims]
  composition:
    - edge-label-edit + selection
    - edge-label-edit + keyboard-command
    - edge-label-edit + render-surface
  performance: [validate:hot-path-safe]
  rollback: [disable feature flag ui.edgeLabelEdit.altEnter]
rollback:
  method: featureFlag
  flag: ui.edgeLabelEdit.altEnter
  default: offUntilDirectorApproval
  disables: [CommandRegistry.edgeLabelEdit.*, RenderRegistry.overlay.edgeLabelEditor]
performance:
  hotPathSafe: false
  reason: >
    Editor creation is command-triggered and outside render/pointer-move/wheel
    RAF paths. Active key handling is mode-scoped and does not measure layout,
    persist, or allocate unbounded state on repeat.
  constraints:
    noAsyncInHotPath: true
    noDomReadInHotPath: true
    noDomWriteInHotPath: true
    noPersistenceInHotPath: true
    boundedAllocation: true
    commandOnlySideEffects: true
```

DC7. `allowedFiles` is a permission boundary. A handoff without it is
incomplete for implementation.

---

## 5. Integration Gates G1-G8

G1. Contract schema validation. Validate every seam contract with `ajv` or
`zod`; do not hand-roll a validator.

G2. Resource-claim collision detection. Exclusive keyboard claims collide by
normalized key, mode, and condition. Pointer capture allows one owner. Render
slots and z-index claims reject duplicate slots and order cycles.

G3. Allowed-files enforcement. CI compares the Director handoff manifest with
`git diff --name-only`; unlisted files fail.

G4. Dependency boundary / forbidden imports. Extend existing `lint:deps`.
Seams may import declared pure ports and registries; they may not import
private legacy globals from `viewer.ts`.

G5. Seam unit tests. Each seam tests owned commands and state transitions.
Existing layout/node/edge contract tests are the pattern for pure ports.

G6. Composition smoke. Compose the new seam with every claimed resource owner.
Known hazard: `render()` currently normalizes state during draw, so smoke
failures around selection/scope after render are real integration evidence.

G7. Performance budget. Hot paths include render, wheel, pointer move, keyboard
repeat, and RAF. They cannot contain async, DOM read/write, persistence,
unbounded allocation, or non-command side effects.

G8. Rollback. Every seam is disableable by feature flag or registry disable.
Rollback removes command and render registration and does not require editing
`viewer.ts` during an incident.

RK2. G1-G8 are beta integration gates, not documentation suggestions.

---

## 6. PR / Worktree Units

DC8. One PR equals one seam contract change.

DC9. Allowed PR types:

| Type | Meaning |
|---|---|
| `new seam` | Adds a contract and minimal scaffolding. |
| `contract change` | Changes one seam's responsibility, claims, tests, rollback, or allowed files. |
| `registration` | Registers an already contracted seam behind a flag or registry. |
| `legacy extraction` | Moves behavior from `viewer.ts` into an owner/registry/port. |
| `CI gate` | Adds or tightens mechanical validation. |
| `generated artifact sync` | Updates generated indexes/snapshots from canonical contracts. |

DC10. Mixed-concern PRs are forbidden: e.g. keyboard registry plus edge-label
behavior, render registry plus persistence behavior, layout API plus selection
store extraction, default-on change plus cleanup.

DC11. Every PR reports `viewer.ts` changed lines:

| Field | Required value |
|---|---|
| added | number |
| removed | number |
| purpose | one sentence |
| wiringOnly | `yes` or `no` |

DC12. `wiringOnly: no` requires Director escalation and follow-up extraction
or rollback plan.

---

## 7. Done Definitions

DD1. Seam done:

- contract exists and passes G1;
- resource claims pass G2;
- allowed files and forbidden resources are declared;
- tests exist or a Director-approved gap is recorded;
- rollback and performance classification are declared.

DD2. Beta integration done:

- seam is default-off or guarded;
- G1-G8 are green;
- `viewer.ts` changes are wiring-only or escalated;
- Director reviewed contract diff, claim diff, CI, risk, rollback;
- PR targets `dev-beta`.

DD3. Sealed:

- seam is default-on and stable;
- disable path has been exercised;
- legacy path is deletable or deleted;
- temporary migration allowances are removed;
- `viewer.ts` keeps only shell wiring.

---

## 8. `viewer.ts` Legacy-Shell Policy

DC13. No new logic in `viewer.ts`.

DC14. Allowed changes: import owner/registry/port, register seam, call command,
pass state view into port, remove sealed legacy branch, wire feature flag,
temporary compatibility adapter with explicit contract allowance.

DC15. Forbidden changes: new global mutable interaction state, raw document
keydown branch, raw pointer capture branch, direct selection mutation, direct
undo stack mutation, direct persistence call, render bucket append outside
`RenderRegistry`, layout mutation during draw.

DC16. `validate:viewer-growth` reports added/removed lines, function-count
movement, and whether additions are wiring-only.

DC17. Growth failures require Director review with a named follow-up extraction
task or rollback.

---

## 9. Roles

DC18. Human owner owns intent, UX boundary, priority, merge judgment, and acceptance of risk/rollback.

DC19. Director owns decomposition, seam contracts, resource claims, CI gates, handoffs, allowed-file manifests, and review of contract diff / claim diff / CI / risk / rollback.

DC20. Codex worker owns implementation inside allowed files, tests, local verification, commit, and PR creation when requested by the Director workflow.

DC21. CI owns schema validation, claim collision detection, allowed-file enforcement, dependency checks, tests, performance checks, and viewer growth reporting.

RK3. Human review of implementation internals is not a scalable protection
against GUI subadditivity; the reviewable artifact is the contract plus CI.

---

## 10. Rollout Plan

Phase 1. CI gates:

- add `validate:seam-contracts`;
- schema via `ajv` or `zod`, not hand-rolled validation;
- add `validate:resource-claims`;
- add `validate:viewer-growth`;
- extend existing `lint:deps`;
- generate claim index for Director review.

Phase 2. Pilot seam: `edge-label-edit`.

- use the Alt+Enter edge label edit feature from PR #70 as extraction material;
- add or sync the seam contract;
- add minimal `CommandRegistry`, `EditModeStore`, and `RenderRegistry`
  implementations for pilot needs only: claim declaration, registration,
  collision-check input, and disable path;
- register keyboard claims through minimal `CommandRegistry`;
- register editor overlay through minimal `RenderRegistry`;
- route edit mode through minimal `EditModeStore`;
- keep default-off or guarded until G1-G8 are green.

Phase 3. Interaction-state owners:

- generalize the minimal `CommandRegistry`, `EditModeStore`, and
  `RenderRegistry` into full owners;
- then add `InteractionArbiter`, `DragController`, `SelectionStore`,
  `CommandHistory`, and `RuntimeScheduler` in risk order.

DC22. Owners may start minimal and grow through `legacy extraction` PRs, so a
pilot seam is not blocked on full owner buildout.

Phase 4. Legacy shell reduction: for each sealed seam, delete duplicated
`viewer.ts` behavior, keep shell wiring only, and let `validate:viewer-growth`
enforce non-regression.

RK4. Layout is not the first extraction target. `LayoutPort` already exists;
the current problem is render-side normalization and interaction-state coupling.
