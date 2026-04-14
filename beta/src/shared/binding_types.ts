"use strict";

/**
 * Rapid / Deep / Binding — shared data-model types.
 *
 * See dev-docs/03_Spec/Rapid_Deep_Binding.md for the contract and the open design
 * questions (Q1..Q5).
 *
 * This file defines pure data shapes only. No behavior. No AI. No UI.
 */

// ---------------------------------------------------------------------------
// Open-string enums (see Q1 / Q2 in the spec). Typed as string literal unions
// where we have a working vocabulary, and as `string` where the vocabulary is
// intentionally open for v1.
// ---------------------------------------------------------------------------

/** Domain axis of the semantic coordinate — e.g. "knot", "manifold", "bridge". */
export type Domain = string;

/** Role axis of the semantic coordinate — e.g. "object", "representation", "move". */
export type Role = string;

/** Abstraction band. */
export type Level = "introductory" | "technical" | "meta";

/** Editorial state of a semantic node. */
export type Status = "accepted" | "candidate" | "ambiguous";

/**
 * Typed relation between two semantic nodes. Open-ended; the listed values are
 * the working vocabulary from the idea doc.
 */
export type EdgeType =
  | "depends_on"
  | "represents"
  | "equivalent_under"
  | "constructed_by"
  | "invariant_of";

/**
 * Type of a binding between a syntactic span and a semantic node. Fixed vocabulary
 * per idea doc §5.
 */
export type BindType =
  | "defines"
  | "mentions"
  | "uses"
  | "motivates"
  | "examples"
  | "states"
  | "proves";

// ---------------------------------------------------------------------------
// Core shapes
// ---------------------------------------------------------------------------

/**
 * A node in the Semantic Structure (Deep mode). Not a tree node — the semantic
 * structure is a typed multilayer graph. Each node carries structural coordinates
 * `(domain, role, level)` so that parallel theories can be rendered as aligned
 * columns / rows in the matrix view.
 */
export interface SemanticNode {
  id: string;
  label: string;
  domain: Domain;
  role: Role;
  level: Level;
  status: Status;
  /** Free-form string-valued attributes. Use for tentative marks, source refs, etc. */
  attributes: Record<string, string>;
}

/**
 * A typed directed edge in the Semantic Structure.
 *
 * `src` and `dst` reference {@link SemanticNode.id}.
 * Undirected relations (e.g. `equivalent_under`) are modeled as directed edges
 * here; the UI layer decides whether to render the arrowhead.
 */
export interface SemanticEdge {
  id: string;
  src: string;
  dst: string;
  edgeType: EdgeType;
}

/**
 * A span-level, typed correspondence between a syntactic unit and a semantic node.
 *
 * Many-to-many: one `syntacticId` may have many bindings, one `semanticId` may
 * have many bindings.
 *
 * `syntacticId` — see Q3 in the spec. For v1 this is a `TreeNode.id` from the
 * existing M3E `nodes` table (the current mind-map is treated as the syntactic
 * layer).
 *
 * `spanStart` / `spanEnd` — character offsets (see Q4). Half-open `[start, end)`.
 * `spanStart === spanEnd` encodes a cursor / zero-width binding and is permitted.
 *
 * `confidence` — in `[0, 1]`. Human-confirmed bindings should carry `1.0`.
 * AI-proposed bindings carry the model's confidence.
 */
export interface Binding {
  id: string;
  syntacticId: string;
  spanStart: number;
  spanEnd: number;
  semanticId: string;
  bindType: BindType;
  confidence: number;
}
