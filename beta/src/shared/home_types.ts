// HOME page shared types.
//
// Co-owned by `visual` and `data` agents.
// Update via PR with cross-review (decision: reviews/HOME Re-implementation/Q7).
//
// Backend endpoints (RPC-style, decision Q3):
//   GET    /api/docs                 -> { ok: true, docs: DocSummary[] }
//   POST   /api/docs/new             body: { label?: string }            -> { ok: true, id: string }
//   POST   /api/docs/:id/duplicate                                       -> { ok: true, id: string }
//   POST   /api/docs/:id/rename      body: { label: string }             -> { ok: true }
//   POST   /api/docs/:id/archive                                         -> { ok: true }
//   POST   /api/docs/:id/restore                                         -> { ok: true }
//   POST   /api/docs/:id/tags        body: { tags: string[] }            -> { ok: true }
//   DELETE /api/docs/:id             (only when archived)                -> { ok: true }
//
// Errors (decision Q8): `{ ok: false, error: { code, message, details? } }`
// with an appropriate HTTP status code.

/** Summary entry returned by `GET /api/docs`. */
export interface DocSummary {
  /** Stable document identifier (also used as the localDocId query param). */
  id: string;
  /** Root-node text, displayed as the human label. */
  label: string;
  /** ISO-8601 timestamp of the last save. */
  savedAt: string;
  /** Total node count (computed at list time per Q4 = parse-on-list). */
  nodeCount: number;
  /** Total character count across `text` + `details` + `note`. */
  charCount: number;
  /** Tag list (stored on the documents row per Q5). */
  tags: string[];
  /** Whether the doc is in the trash (decision Q2 = trash folder/archive flag). */
  archived: boolean;
}

/** Successful list response. */
export interface DocListResponse {
  ok: true;
  docs: DocSummary[];
}

/** Successful create/duplicate response. */
export interface DocIdResponse {
  ok: true;
  id: string;
}

/** Generic ok-only response (rename / archive / restore / tags / delete). */
export interface DocOkResponse {
  ok: true;
}

/** Error envelope shared by every HOME endpoint. */
export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Known error codes. Backend may add more — UI must handle unknown gracefully. */
export type HomeErrorCode =
  | "DOC_NOT_FOUND"
  | "DOC_NOT_ARCHIVED"
  | "INVALID_LABEL"
  | "INVALID_TAGS"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// Cross-tab broadcast (decision Q9 = BroadcastChannel)
// ---------------------------------------------------------------------------

/** BroadcastChannel name used to coordinate "currently open" doc state. */
export const HOME_BROADCAST_CHANNEL = "m3e:home:v1";

/** Viewer announces it is showing a doc. */
export interface OpenDocBroadcast {
  type: "doc-open";
  docId: string;
  /** Wall-clock timestamp; receivers may use this to expire stale entries. */
  ts: number;
}

/** Viewer is closing or navigating away from a doc. */
export interface CloseDocBroadcast {
  type: "doc-close";
  docId: string;
  ts: number;
}

/** HOME asks all viewers to re-announce themselves (used right after HOME mounts). */
export interface PingBroadcast {
  type: "ping";
  ts: number;
}

export type HomeBroadcastMessage = OpenDocBroadcast | CloseDocBroadcast | PingBroadcast;
