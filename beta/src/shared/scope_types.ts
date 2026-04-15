import type { AppState, SavedDoc } from "./types";

/**
 * Structured error returned for scope-related failures on /api/maps/{mapId}.
 *
 * Shape follows the HOME-API convention:
 *   { ok: false, error: { code, message, details? } }
 */
export type ScopeErrorCode =
  | "SCOPE_NOT_FOUND"
  | "SCOPE_INVALID"
  | "SCOPE_WRITE_ROOT_MISMATCH"
  | "SCOPE_WRITE_OUTSIDE_REFERENCE"
  | "SCOPE_WRITE_PARENT_MUTATION";

export interface ScopeErrorPayload {
  ok: false;
  error: {
    code: ScopeErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Options for readScopedState.
 *
 *  - scopeId: node id that will become the root of the returned subtree.
 *  - depth:   0 = scope node only (no children); N>0 = descend N levels;
 *             undefined = unlimited (full subtree).
 */
export interface ReadScopedOptions {
  scopeId: string;
  depth?: number;
}

/**
 * Options for writeScopedState.
 *
 * The request body is expected to contain an AppState-shaped `state`
 * where `rootId` equals `scopeId` and `nodes[scopeId]` exists.
 *
 * Any node referenced by `nodes[*].children` or `nodes[*].parentId`
 * (other than the scope's own parent) must live inside the incoming
 * subtree — references to nodes outside the scope are rejected.
 */
export interface WriteScopedOptions {
  scopeId: string;
  incomingState: AppState;
}

/** Successful scoped GET response body. */
export interface ScopedReadResponse {
  version: number;
  savedAt: string;
  state: AppState;
  /** Echoed back so clients can confirm what scope was used. */
  scope: {
    rootId: string;
    depth: number | null;
    nodeCount: number;
  };
}

/** Successful scoped POST response body. */
export interface ScopedWriteResponse {
  ok: true;
  savedAt: string;
  documentId: string;
  scope: {
    rootId: string;
    replacedNodeCount: number;
  };
}

/** Internal result type for readScopedState / writeScopedState helpers. */
export type ScopedReadResult =
  | { ok: true; doc: SavedDoc; nodeCount: number }
  | { ok: false; error: ScopeErrorPayload["error"] };

export type ScopedWriteResult =
  | { ok: true; savedAt: string; replacedNodeCount: number }
  | { ok: false; error: ScopeErrorPayload["error"] };
