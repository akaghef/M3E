"use strict";

/**
 * The provenance of a commit (Database_Spec 6): the records the commit adopted as its sources,
 * each at the revision it was taken at. `observed`: the issuer was shown the record (a read
 * through its participation). `declared`: the Command names the record as its source (the
 * source subtree of a copy).
 */

export const PROVENANCE_LIMIT = 100;
const MODES = new Set(["observed", "declared"]);

export interface ProvenanceItem {
  mode: "observed" | "declared";
  rk: string;
  rev: number;
}

export interface Provenance {
  items: ProvenanceItem[];
  truncated?: true;
}

function isItem(value: unknown): value is ProvenanceItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return MODES.has(item.mode as string)
    && typeof item.rk === "string" && item.rk.length > 0 && item.rk.length <= 1000
    && typeof item.rev === "number" && Number.isSafeInteger(item.rev) && item.rev >= 0;
}

/**
 * The provenance a journal line keeps. A value in the decided shape is checked and cut to the
 * limit; one rk appears once (its first item). Any other value (the shapes Commands carried
 * before: `{contextId, tool}`, `{tabId}`) holds nothing beyond the actor and is not kept.
 * Throws on a value in the decided shape with a malformed item.
 */
export function normalizeProvenance(value: unknown): Provenance | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.items)) return undefined;
  const items: ProvenanceItem[] = [];
  const seen = new Set<string>();
  let truncated = raw.truncated === true;
  for (const item of raw.items) {
    if (!isItem(item)) throw new Error("provenance.items holds an item that is not {mode, rk, rev}.");
    if (seen.has(item.rk)) continue;
    if (items.length === PROVENANCE_LIMIT) { truncated = true; break; }
    seen.add(item.rk);
    items.push({ mode: item.mode, rk: item.rk, rev: item.rev });
  }
  return truncated ? { items, truncated: true } : { items };
}
