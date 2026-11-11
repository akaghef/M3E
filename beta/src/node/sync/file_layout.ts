import path from "node:path";

/**
 * 配置案。論理 journal の物理置き場であり、新しい正本 DB ではない。
 * backup（物理 DB 複製）とも、用語集の新語ともしない。
 *
 *   <peerRoot>/journal/<scopeId>.jsonl
 *     scope ごとの append-only。1 行が 1 ScopeJournalRecord。
 *   <peerRoot>/outbox/<remotePeerId>.json
 *     その相手へ送れた recordId。journal 本体ではない配送カーソル。
 *
 * 相手が落ちている間は journal だけが進み、outbox は進まない。
 * 復帰時は outbox に無い自記録を scope ごとに再送する。
 * 受け側の二重適用防止は recordId であり、行を消して巻き戻さない。
 */
export const JOURNAL_DIR = "journal";
export const OUTBOX_DIR = "outbox";

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function assertLayoutToken(value: string, label: string): string {
  if (!TOKEN.test(value) || value === "." || value === "..") {
    throw new Error(`${label} is not safe for the journal layout: ${value}`);
  }
  return value;
}

export function journalFile(peerRoot: string, scopeId: string): string {
  return path.join(peerRoot, JOURNAL_DIR, `${assertLayoutToken(scopeId, "scopeId")}.jsonl`);
}

export function outboxFile(peerRoot: string, remotePeerId: string): string {
  return path.join(peerRoot, OUTBOX_DIR, `${assertLayoutToken(remotePeerId, "remotePeerId")}.json`);
}
