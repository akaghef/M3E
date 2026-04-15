import type { AppState } from "./types";

export type PathResolveErrorCode =
  | "PATH_INVALID"
  | "PATH_NOT_FOUND"
  | "PATH_AMBIGUOUS";

export interface PathResolveError {
  code: PathResolveErrorCode;
  message: string;
  failedAt?: number;
  segment?: string;
  candidates?: string[];
  matched?: string[];
}

export type PathResolveResult =
  | { ok: true; nodeId: string; matched: string[] }
  | { ok: false; error: PathResolveError };

export interface ParsedMapPath {
  segments: string[];
  hadMapPrefix: boolean;
}

// Parse a user-supplied path string. Accepts optional "Map:" prefix
// (case-insensitive). Segments are split on `sep` (default "/") and trimmed.
// Returns null if nothing usable remained.
export function parseMapPath(raw: string, sep: string = "/"): ParsedMapPath | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  const prefixMatch = /^map:\s*/i.exec(s);
  const hadMapPrefix = prefixMatch !== null;
  if (hadMapPrefix) s = s.slice(prefixMatch![0].length);
  const segments = s
    .split(sep)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (segments.length === 0) return null;
  return { segments, hadMapPrefix };
}

// Resolve a list of text segments against AppState, returning the nodeId
// of the final matched node. A leading segment equal to "Root" (any case)
// or to the root node's own text is treated as the root itself.
export function resolveNodePath(
  state: AppState,
  segments: string[],
): PathResolveResult {
  const root = state.nodes[state.rootId];
  if (!root) {
    return { ok: false, error: { code: "PATH_INVALID", message: "Document has no root node." } };
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, error: { code: "PATH_INVALID", message: "Empty path." } };
  }

  let segs = segments;
  if (
    segs.length > 0 &&
    (segs[0].toLowerCase() === "root" || segs[0] === root.text)
  ) {
    segs = segs.slice(1);
  }

  let cur = root;
  const matched: string[] = [root.text];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const hits = cur.children
      .map((id) => state.nodes[id])
      .filter((n) => n && n.text === seg);
    if (hits.length === 0) {
      return {
        ok: false,
        error: {
          code: "PATH_NOT_FOUND",
          message: `No child named "${seg}" under "${cur.text}".`,
          failedAt: i,
          segment: seg,
          matched,
        },
      };
    }
    if (hits.length > 1) {
      return {
        ok: false,
        error: {
          code: "PATH_AMBIGUOUS",
          message: `Multiple children named "${seg}" under "${cur.text}".`,
          failedAt: i,
          segment: seg,
          candidates: hits.map((h) => h.id),
          matched,
        },
      };
    }
    cur = hits[0];
    matched.push(cur.text);
  }

  return { ok: true, nodeId: cur.id, matched };
}
