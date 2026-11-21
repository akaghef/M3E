/**
 * A read that names `minSeq` waits until both the journal and the storage engine
 * have applied that seq. The commit response itself does not wait: the commit point
 * is the journal fsync (format2 R3.9). Waiting is this read's job.
 *
 * The timeout code is `ENGINE_BEHIND`.
 */
import { activeRecordStore } from "../record_store/active";

export const MIN_SEQ_TIMEOUT_CODE = "ENGINE_BEHIND" as const;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface AppliedSeq {
  seq(): number;
  engineStatus(): { appliedSeq: number };
}

export function minSeqTimeoutMs(): number {
  const raw = Number(process.env.M3E_MIN_SEQ_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  return DEFAULT_TIMEOUT_MS;
}

export async function waitForAppliedSeq(store: AppliedSeq, minSeq: number, timeoutMs = minSeqTimeoutMs()): Promise<{ ok: true } | { ok: false; code: typeof MIN_SEQ_TIMEOUT_CODE }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (store.seq() >= minSeq && store.engineStatus().appliedSeq >= minSeq) return { ok: true };
    if (Date.now() >= deadline) return { ok: false, code: MIN_SEQ_TIMEOUT_CODE };
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

export interface MinSeqGate {
  ok: true;
}

export interface MinSeqRefusal {
  ok: false;
  status: number;
  body: { ok: false; code: string; error: string };
}

/** Viewer map reads pass the raw `minSeq` query. Omitted means do not wait. */
export async function enforceMinSeq(raw: string | null): Promise<MinSeqGate | MinSeqRefusal> {
  if (raw === null || raw === "") return { ok: true };
  if (!/^\d+$/.test(raw)) {
    return { ok: false, status: 400, body: { ok: false, code: "INVALID_ARGUMENT", error: "minSeq must be a non-negative integer." } };
  }
  const minSeq = Number(raw);
  if (!Number.isSafeInteger(minSeq)) {
    return { ok: false, status: 400, body: { ok: false, code: "INVALID_ARGUMENT", error: "minSeq must be a non-negative integer." } };
  }
  const store = activeRecordStore();
  if (!store) {
    // SQLite mode has no workspace applied seq. Zero asks for nothing.
    if (minSeq === 0) return { ok: true };
    return { ok: false, status: 503, body: { ok: false, code: MIN_SEQ_TIMEOUT_CODE, error: "minSeq waits on the record store, which is not open." } };
  }
  const waited = await waitForAppliedSeq(store, minSeq);
  if (!waited.ok) {
    return { ok: false, status: 503, body: { ok: false, code: MIN_SEQ_TIMEOUT_CODE, error: "Applied sequence has not reached minSeq." } };
  }
  return { ok: true };
}
