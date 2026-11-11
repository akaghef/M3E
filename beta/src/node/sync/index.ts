/**
 * scope 単位同期の公開口。
 * 権限判定は cutover/scope-permission をそのまま使う。
 */
export {
  admitToAccount,
  decideScopePermission,
  filterScopeChangeSequences,
} from "../../cutover/scope-permission";
export type {
  ScopeChangeSequence,
  ScopeGrant,
  WorkspaceAccount,
} from "../../cutover/scope-permission";
export { FileDeliveryCursor, MemoryDeliveryCursor } from "./cursor";
export type { DeliveryCursor } from "./cursor";
export { JOURNAL_DIR, OUTBOX_DIR, journalFile, outboxFile } from "./file_layout";
export { FileScopeJournalStore, MemoryScopeJournalStore } from "./journal_store";
export type { ScopeJournalReader, ScopeJournalStore } from "./journal_store";
export { ScopeSyncPeer } from "./peer";
export { replayScope } from "./replay";
export type { ScopeSendResult, ScopeSyncTransport } from "./transport";
export type {
  RecordScopeChangeInput,
  ScopeCommand,
  ScopeJournalRecord,
  ScopePushReport,
  ScopeReceiveReport,
} from "./types";
