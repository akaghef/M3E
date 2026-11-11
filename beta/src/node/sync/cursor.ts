import fs from "node:fs";
import path from "node:path";
import { OUTBOX_DIR, outboxFile } from "./file_layout";

/** 相手ごとに、送り切った recordId。未送信分は journal に残る。 */
export interface DeliveryCursor {
  sentIds(remotePeerId: string): ReadonlySet<string>;
  markSent(remotePeerId: string, recordIds: readonly string[]): void;
}

export class MemoryDeliveryCursor implements DeliveryCursor {
  private readonly sent = new Map<string, Set<string>>();

  sentIds(remotePeerId: string): ReadonlySet<string> {
    return new Set(this.sent.get(remotePeerId) ?? []);
  }

  markSent(remotePeerId: string, recordIds: readonly string[]): void {
    const current = new Set(this.sent.get(remotePeerId) ?? []);
    for (const recordId of recordIds) current.add(recordId);
    this.sent.set(remotePeerId, current);
  }
}

/** 配置案の outbox。落ちている相手の分はファイルを作らない。 */
export class FileDeliveryCursor implements DeliveryCursor {
  constructor(private readonly peerRoot: string) {
    fs.mkdirSync(path.join(peerRoot, OUTBOX_DIR), { recursive: true });
  }

  sentIds(remotePeerId: string): ReadonlySet<string> {
    const file = outboxFile(this.peerRoot, remotePeerId);
    if (!fs.existsSync(file)) return new Set();
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { sentRecordIds?: unknown };
    const ids = Array.isArray(parsed.sentRecordIds)
      ? parsed.sentRecordIds.filter((id): id is string => typeof id === "string")
      : [];
    return new Set(ids);
  }

  markSent(remotePeerId: string, recordIds: readonly string[]): void {
    const next = new Set(this.sentIds(remotePeerId));
    for (const recordId of recordIds) next.add(recordId);
    const file = outboxFile(this.peerRoot, remotePeerId);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify({ sentRecordIds: [...next].sort() }, null, 2)}\n`);
    fs.renameSync(tmp, file);
  }
}
