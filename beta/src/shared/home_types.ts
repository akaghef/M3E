"use strict";

/**
 * Shared types for the HOME page (document list / management).
 *
 * Owner: data role. visual imports these read-only.
 * If visual needs an extension, file a request and let data update this file.
 *
 * See dev-docs/03_Spec/REST_API.md "Document Management API" section
 * and M3E map node "HOME Re-implementation" for the design context.
 */

/** Summary row returned by `GET /api/docs`. One per document. */
export interface DocSummary {
  /** Document id (primary key in the documents table). */
  id: string;
  /** Display label — root node's text when available, else id. */
  label: string;
  /** ISO-8601 timestamp of the last save. */
  savedAt: string;
  /** Total number of nodes in the document (computed from state_json). */
  nodeCount: number;
  /** Approx character count across node text/details/note (computed from state_json). */
  charCount: number;
  /** Tag list. Empty array if none. */
  tags: string[];
  /** True when the doc has been moved to the trash (archived=1). */
  archived: boolean;
}

/** Response body of `GET /api/docs`. */
export interface DocListResponse {
  docs: DocSummary[];
}

/** Body for `POST /api/docs/new`. */
export interface DocNewRequest {
  /** Optional initial root label. Defaults to "Untitled" when omitted. */
  label?: string;
}

/** Response body of `POST /api/docs/new` and `POST /api/docs/:id/duplicate`. */
export interface DocCreateResponse {
  ok: true;
  id: string;
}

/** Body for `POST /api/docs/:id/rename`. */
export interface DocRenameRequest {
  /** New label. Empty / whitespace-only is rejected with INVALID_LABEL. */
  label: string;
}

/** Body for `POST /api/docs/:id/tags`. */
export interface DocTagsRequest {
  /** Full replacement of the tag list. Each entry is trimmed; empties removed. */
  tags: string[];
}

/** Generic success envelope shared by mutation endpoints. */
export interface DocOkResponse {
  ok: true;
}

/**
 * Structured error envelope used by HOME API endpoints (Q8 = structured/extensible).
 *
 * `code` is a stable machine-readable identifier; UI selects messaging from it.
 * `message` is a human-readable fallback (English; visual may localise via home_i18n).
 * `details` is optional context (validation errors, conflicting state, etc.).
 */
export interface DocErrorResponse {
  ok: false;
  error: {
    code: DocErrorCode | string;
    message: string;
    details?: unknown;
  };
}

/** Known error codes. Extensible — string union allows future codes. */
export type DocErrorCode =
  | "DOC_NOT_FOUND"
  | "DOC_ALREADY_EXISTS"
  | "INVALID_LABEL"
  | "INVALID_TAGS"
  | "INVALID_BODY"
  | "NOT_ARCHIVED"
  | "ALREADY_ARCHIVED"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";
