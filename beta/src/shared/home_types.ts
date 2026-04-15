"use strict";

/**
 * Shared types for the HOME page (map list / management).
 *
 * Owner: data role. visual imports these read-only.
 * If visual needs an extension, file a request and let data update this file.
 *
 * See dev-docs/03_Spec/REST_API.md "Map Management API" section
 * and M3E map node "HOME Re-implementation" for the design context.
 */

/** Summary row returned by `GET /api/maps`. One per map. */
export interface MapSummary {
  /** Map id (primary key in the documents table). */
  id: string;
  /** Display label — root node's text when available, else id. */
  label: string;
  /** ISO-8601 timestamp of the last save. */
  savedAt: string;
  /** Total number of nodes in the map (computed from state_json). */
  nodeCount: number;
  /** Approx character count across node text/details/note (computed from state_json). */
  charCount: number;
  /** Tag list. Empty array if none. */
  tags: string[];
  /** True when the map has been moved to the trash (archived=1). */
  archived: boolean;
}

/** Response body of `GET /api/maps`. */
export interface MapListResponse {
  docs: MapSummary[];
}

/** Body for `POST /api/maps/new`. */
export interface MapNewRequest {
  /** Optional initial root label. Defaults to "Untitled" when omitted. */
  label?: string;
}

/** Response body of `POST /api/maps/new` and `POST /api/maps/:id/duplicate`. */
export interface MapCreateResponse {
  ok: true;
  id: string;
}

/** Body for `POST /api/maps/:id/rename`. */
export interface MapRenameRequest {
  /** New label. Empty / whitespace-only is rejected with INVALID_LABEL. */
  label: string;
}

/** Body for `POST /api/maps/:id/tags`. */
export interface MapTagsRequest {
  /** Full replacement of the tag list. Each entry is trimmed; empties removed. */
  tags: string[];
}

/** Generic success envelope shared by mutation endpoints. */
export interface MapOkResponse {
  ok: true;
}

/**
 * Structured error envelope used by HOME API endpoints (Q8 = structured/extensible).
 *
 * `code` is a stable machine-readable identifier; UI selects messaging from it.
 * `message` is a human-readable fallback (English; visual may localise via home_i18n).
 * `details` is optional context (validation errors, conflicting state, etc.).
 */
export interface MapErrorResponse {
  ok: false;
  error: {
    code: MapErrorCode | string;
    message: string;
    details?: unknown;
  };
}

/** Known error codes. Extensible — string union allows future codes. */
export type MapErrorCode =
  | "MAP_NOT_FOUND"
  | "MAP_ALREADY_EXISTS"
  | "INVALID_LABEL"
  | "INVALID_TAGS"
  | "INVALID_BODY"
  | "NOT_ARCHIVED"
  | "ALREADY_ARCHIVED"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";
