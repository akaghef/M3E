import type { ScopeChangeSequence } from "../../cutover/scope-permission";
import type { ScopeJournalRecord } from "./types";

export type ScopeSendResult =
  | { ok: true; acceptedIds: readonly string[] }
  | { ok: false; reason: "unreachable"; detail?: string };

/** 相手への配送。届かないときは ok: false を返し、呼び出し側は cursor を進めない。 */
export interface ScopeSyncTransport {
  send(sequences: readonly ScopeChangeSequence<ScopeJournalRecord>[]): Promise<ScopeSendResult>;
}
