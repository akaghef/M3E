# Rapid / Deep / Binding — Data-Model Spec

Status: draft (data-model + contract only; no implementation logic, no UI, no AI in this PR)
Source idea: [`dev-docs/ideas/tree_structure_rapid_deep.md`](../ideas/tree_structure_rapid_deep.md)

This document formalizes the three layers that M3E's "Rapid / Deep" modes operate on, plus the
binding layer that connects them, and the encoder/decoder contract that produces and consumes
them. The implementation in this PR is intentionally minimal: only types, schema, and CRUD
stubs. The semantic/AI inference side is deferred — it is the button-triggered step described
in the idea doc.

---

## 1. Three layers

### 1.1 Syntactic Tree (Rapid mode)

- **What it is:** the document as presented. Sections, paragraphs, theorem blocks, lists,
  figures, in the linear order in which the human author chose to present them.
- **Properties:** fully determined by the source (PDF / markdown / note). Lossless.
  Deterministic. No inference. Revising it means re-parsing, not re-thinking.
- **Rapid mode = read-only projection of the Syntactic Tree.**

### 1.2 Semantic Structure (Deep mode)

- **What it is:** a typed multilayer graph of notions. Not a tree. Revisable.
- **Nodes** carry structural coordinates:
  - `domain` — which parallel theory / world the node lives in (e.g. `knot`, `link`,
    `manifold`, `bridge`, `general`).
  - `role` — which layer the node plays within its domain (e.g. `object`, `representation`,
    `move`, `invariant`, `theorem`, `method`).
  - `level` — abstraction band (e.g. `introductory`, `technical`, `meta`).
  - `status` — editorial state (`accepted`, `candidate`, `ambiguous`).
- **Edges** are typed: `depends_on`, `represents`, `equivalent_under`, `constructed_by`,
  `invariant_of`, …
- **Deep mode = editable construction of the Semantic Structure.** Non-unique, revisable.

### 1.3 Binding (the bridge)

The binding is the **explicit correspondence channel** between Syntactic and Semantic. It is
what makes the transformation inspectable and editable.

- Many-to-many. One paragraph can mention several notions; one notion can appear in many
  paragraphs.
- **Span-level**, not block-level: a binding records a `(span_start, span_end)` offset into
  the syntactic unit, so one paragraph can bind different substrings to different notions.
- **Typed**: `bindType ∈ {defines, mentions, uses, motivates, examples, states, proves}`.
- Carries **confidence** ∈ [0, 1] so that AI-proposed bindings and human-accepted bindings
  can coexist.

---

## 2. Binding as a sparse 3-tensor

Per the idea doc, the correct formalization is:

```
χ : I × A × B → {0, 1}
```

where
- `I` = syntactic positions (document unit id + span),
- `A` = domain axis (knot / manifold / …),
- `B` = role axis (object / representation / move / invariant / …).

`χ(i, a, b) = 1` iff the syntactic position `i` binds to the semantic slot `(a, b)`.

Extended with label / confidence / context:

```
χ(i, a, b, t, r, c)
  t  = binding type (defines / mentions / uses / ...)
  r  = confidence
  c  = context / version
```

Practical projections:

- **Rapid-side lookup** — given a syntactic position `i`, what notions does it bind to?
  `listBindings(syntacticId) → Binding[]`
- **Deep-side lookup** — given a semantic node, where does it occur in the document?
  `listOccurrences(semanticId) → Binding[]`

---

## 3. Matrix-view example (knot / link / manifold)

The parallel-structure requirement from the idea doc. Semantic nodes laid out on the
`domain × role` grid:

|                    | **knot**         | **link**            | **manifold**     |
|--------------------|------------------|---------------------|------------------|
| **object**         | `K`              | `L`                 | `M`              |
| **representation** | diagram          | framed diagram      | surgery          |
| **move**           | Reidemeister     | framed moves        | Kirby            |
| **invariant**      | J(K) (Jones)     | …                   | Z(M) (RT-type)   |

Horizontal edges = cross-domain correspondence / analogy (e.g. `represents`).
Vertical edges = within-domain dependency (e.g. `invariant_of`, `constructed_by`).

**Bridge nodes** (e.g. *framed link*) sit across columns and connect the knot world to the
manifold world. They are first-class semantic nodes, typically with `domain = "bridge"`.

---

## 4. Encoder / Decoder contract

```
Syntactic Tree  ⇌  Canonical Semantic Form
               E   N   D
```

- **E (Encoder):** `E : S → (P(M), P(R), P(B), U)` — from a syntactic node/span, propose
  semantic node candidates `M`, relation candidates `R`, binding candidates `B`, and
  residual/uncertainty metadata `U`. The encoder proposes; it does not commit.
- **N (Normalizer):** canonicalize the proposals — merge duplicates, resolve aliases, assign
  `(domain, role)` coordinates, keep uncertainty rather than forcing a decision.
- **D (Decoder):** `D : (M, R, B) → view` — generate a user-facing view (Rapid textbook
  order, Deep concept graph, matrix view by role). **Decoder ≠ inverse of encoder.** It is
  a view generator.

### 4.1 Accuracy principle

The encoder must separate:
- **Hard facts** — section nesting, theorem/proof boundaries, repeated-term spans, citation
  references. Deterministic.
- **Soft inferences** — "this sentence defines a notion", "this notion belongs to the knot
  domain". Probabilistic, stored with confidence.

Mixing these two channels is the main source of drift.

### 4.2 Laziness principle (button-triggered)

- **Automatic, cheap, deterministic:**
  - id preservation on syntactic node moves,
  - span redistribution on paragraph splits,
  - label propagation on semantic renames.
- **On-demand, expensive, AI-driven (button-triggered):**
  - notion extraction from newly-added text,
  - rebinding after large edits,
  - inference of missing semantic relations,
  - ambiguity resolution.

State can be marked `fresh | stale | partially_stale` to hint (not force) the user to press
the "Refresh semantic links" button. **Never autorun the AI encoder on every keystroke.**

### 4.3 Edit-propagation rules

- Syntactic node moved → bindings stay (ids persist).
- Syntactic node split → bindings redistributed by span math.
- Semantic nodes merged → bindings unioned.
- Semantic node deleted → bindings become orphaned and must be explicitly resolved
  (kept as `bindType` with dangling `semantic_id`, surfaced in UI for review).

---

## 5. Data model (this PR)

### 5.1 TypeScript types — `beta/src/shared/binding_types.ts`

```ts
export type Domain = string;                  // open string; see Q1
export type Role = string;                    // open string; see Q2
export type Level = "introductory" | "technical" | "meta";
export type Status = "accepted" | "candidate" | "ambiguous";

export type EdgeType =
  | "depends_on" | "represents" | "equivalent_under"
  | "constructed_by" | "invariant_of";        // open; see Q1/Q2

export type BindType =
  | "defines" | "mentions" | "uses" | "motivates"
  | "examples" | "states" | "proves";

export interface SemanticNode {
  id: string;
  label: string;
  domain: Domain;
  role: Role;
  level: Level;
  status: Status;
  attributes: Record<string, string>;
}

export interface SemanticEdge {
  id: string;
  src: string;          // SemanticNode.id
  dst: string;          // SemanticNode.id
  edgeType: EdgeType;
}

export interface Binding {
  id: string;
  syntacticId: string;  // points to the syntactic unit; see Q3
  spanStart: number;    // char offset; see Q4
  spanEnd: number;
  semanticId: string;   // SemanticNode.id
  bindType: BindType;
  confidence: number;   // [0, 1]
}
```

### 5.2 SQLite schema — additive migration in `beta/src/node/rapid_mvp.ts`

```sql
CREATE TABLE IF NOT EXISTS semantic_nodes (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  domain          TEXT NOT NULL,
  role            TEXT NOT NULL,
  level           TEXT NOT NULL,
  status          TEXT NOT NULL,
  attributes_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS semantic_edges (
  id        TEXT PRIMARY KEY,
  src       TEXT NOT NULL,
  dst       TEXT NOT NULL,
  edge_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bindings (
  id           TEXT PRIMARY KEY,
  syntactic_id TEXT NOT NULL,
  span_start   INTEGER NOT NULL,
  span_end     INTEGER NOT NULL,
  semantic_id  TEXT NOT NULL,
  bind_type    TEXT NOT NULL,
  confidence   REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bindings_syntactic ON bindings(syntactic_id);
CREATE INDEX IF NOT EXISTS idx_bindings_semantic  ON bindings(semantic_id);
```

SQLite does not enforce true FKs here (additive-migration principle; we do not want to break
pre-existing `documents` rows). Referential integrity is enforced **at the model layer** in
`validate()` / stub methods.

### 5.3 `RapidMvpModel` stubs (signatures only)

```
createSemanticNode(node: SemanticNode): void
addSemanticEdge(edge: SemanticEdge): void
addBinding(binding: Binding): void
listBindings(syntacticId: string): Binding[]
listOccurrences(semanticId: string): Binding[]
deleteSemanticNode(id: string): void          // leaves bindings orphaned; see §4.3
```

No inference. No AI. CRUD and invariant checks only. Tests cover:
- round-trip insert / list,
- orphan-binding behavior on `deleteSemanticNode`,
- empty-result behavior on absent syntactic / semantic ids,
- rejection of malformed confidence / span values.

---

## 6. Open design questions (pooled, not decided here)

These go into `ROOT/SYSTEM/DEV/reviews/Rapid Deep Binding/Q1..Q5` per canvas-protocol
ambiguity-pooling. Interim choices carry `attributes.tentative="yes"`; none carry
`selected="yes"`.

- **Q1 — Domain enum.** Fixed list (`knot | manifold | component | force | bridge | general`)
  vs free string vs hierarchical path (`math.topology.knot`)?
  *Tentative:* free string (typed as `Domain = string`). Lets early users extend without
  a schema change; hierarchical/fixed can be enforced later at the normalizer layer.
- **Q2 — Role enum.** Fixed (`object | representation | move | invariant | theorem | method`)
  vs free string?
  *Tentative:* free string (`Role = string`), same reasoning as Q1.
- **Q3 — Where does the Syntactic Tree live?** Re-use the existing M3E `nodes` table
  (treat the current mind-map as the syntactic layer) vs introduce a dedicated
  `syntactic_nodes` table?
  *Tentative:* re-use existing `nodes`. `Binding.syntacticId` is interpreted as a
  `TreeNode.id`. Keeps PR scope minimal; a separate table can be split out later without
  breaking the binding schema.
- **Q4 — Span addressing.** Character offset into `details` / `note`, vs token range, vs
  node-id only (no span)?
  *Tentative:* character offset into the concatenation `text + details + note` of the
  bound `TreeNode`. Simple, deterministic, survives edits via redistribution (§4.3).
  Token-level is a later upgrade.
- **Q5 — Encoder trigger.** Explicit button per scope vs auto-on-idle vs both?
  *Tentative:* **explicit button only** for v1 (matches §4.2 and the idea-doc Section 10
  conclusion). Auto-on-idle can be added behind a flag later.

---

## 7. What this PR does **not** do

- No encoder implementation. No AI inference calls.
- No UI for Deep mode / matrix view / binding editing.
- No PDF → Syntactic Tree importer changes.
- No propagation / rebinding logic (spec'd in §4.3; to be implemented in a follow-up).
- No REST API additions in `start_viewer.ts` (spec'd here; endpoints to be added in a
  follow-up PR once UI requirements are clearer).

The deliverable is the **foundation**: the types, the schema, the method signatures, and a
single spec document that agents and humans can refer back to as the canonical definition
of the Rapid / Deep / Binding triad.
