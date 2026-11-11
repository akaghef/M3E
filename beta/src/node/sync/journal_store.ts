import fs from "node:fs";
import path from "node:path";
import { JOURNAL_DIR, journalFile } from "./file_layout";
import type { ScopeJournalRecord } from "./types";

/**
 * journal の読み口。Neo4j には依存しない。
 * テストはメモリ実装、二ピアの追いつきは配置案のファイル実装を使う。
 */
export interface ScopeJournalReader {
  has(recordId: string): boolean;
  listScopeIds(): readonly string[];
  readScope(scopeId: string): readonly ScopeJournalRecord[];
  readAll(): readonly ScopeJournalRecord[];
}

export interface ScopeJournalStore extends ScopeJournalReader {
  /** 同じ recordId は追加しない。追記のみで、既存行は書き換えない。 */
  append(record: ScopeJournalRecord): { appended: boolean };
}

export class MemoryScopeJournalStore implements ScopeJournalStore {
  private readonly records: ScopeJournalRecord[] = [];
  private readonly ids = new Set<string>();

  has(recordId: string): boolean {
    return this.ids.has(recordId);
  }

  listScopeIds(): readonly string[] {
    return [...new Set(this.records.map((record) => record.scopeId))].sort();
  }

  readScope(scopeId: string): readonly ScopeJournalRecord[] {
    return this.records.filter((record) => record.scopeId === scopeId);
  }

  readAll(): readonly ScopeJournalRecord[] {
    return [...this.records];
  }

  append(record: ScopeJournalRecord): { appended: boolean } {
    if (this.ids.has(record.recordId)) {
      return { appended: false };
    }
    this.ids.add(record.recordId);
    this.records.push(record);
    return { appended: true };
  }
}

/**
 * 配置案の scope 別 jsonl。
 * peerRoot 以外は開かない。Application Support の生きている M3E データは対象外。
 */
export class FileScopeJournalStore implements ScopeJournalStore {
  private records: ScopeJournalRecord[] = [];
  private ids = new Set<string>();

  constructor(private readonly peerRoot: string) {
    fs.mkdirSync(path.join(peerRoot, JOURNAL_DIR), { recursive: true });
    this.reload();
  }

  has(recordId: string): boolean {
    return this.ids.has(recordId);
  }

  listScopeIds(): readonly string[] {
    return [...new Set(this.records.map((record) => record.scopeId))].sort();
  }

  readScope(scopeId: string): readonly ScopeJournalRecord[] {
    return this.records.filter((record) => record.scopeId === scopeId);
  }

  readAll(): readonly ScopeJournalRecord[] {
    return [...this.records];
  }

  append(record: ScopeJournalRecord): { appended: boolean } {
    if (this.ids.has(record.recordId)) {
      return { appended: false };
    }
    const file = journalFile(this.peerRoot, record.scopeId);
    const fd = fs.openSync(file, "a");
    try {
      fs.writeSync(fd, `${JSON.stringify(record)}\n`);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    this.ids.add(record.recordId);
    this.records.push(record);
    return { appended: true };
  }

  private reload(): void {
    this.records = [];
    this.ids = new Set();
    const dir = path.join(this.peerRoot, JOURNAL_DIR);
    const names = fs.readdirSync(dir).filter((name) => name.endsWith(".jsonl")).sort();
    for (const name of names) {
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      const lines = text.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        let parsed: ScopeJournalRecord;
        try {
          parsed = JSON.parse(line) as ScopeJournalRecord;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`journal line ${name}:${index + 1} is not JSON (${message})`);
        }
        if (!parsed || typeof parsed.recordId !== "string" || typeof parsed.scopeId !== "string") {
          throw new Error(`journal line ${name}:${index + 1} is not a scope journal record`);
        }
        if (this.ids.has(parsed.recordId)) continue;
        this.ids.add(parsed.recordId);
        this.records.push(parsed);
      }
    }
  }
}
