// Temporary: lets the not-yet-rewritten local mode compile in the store owner's branch. Replaced by the local-mode rewrite at merge.
import fs from "fs";
import path from "path";
export function fsyncDir(dir: string): void {
  let fd: number | undefined;
  try { fd = fs.openSync(dir, "r"); fs.fsyncSync(fd); } catch { /* Windows */ } finally { if (fd !== undefined) fs.closeSync(fd); }
}
export function writeFileDurably(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, filePath);
  fsyncDir(path.dirname(filePath));
}
export function assertNotLiveM3e(_dir: string): void {}
export const SNAPSHOT_FILE = "snapshot.jsonl";
export const JOURNAL_FILE = "journal.jsonl";
