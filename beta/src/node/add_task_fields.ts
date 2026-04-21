/**
 * T-1-10 one-shot migration: tasks.yaml の各 entry に
 *   dependencies: [...]
 *   linked_review: "..." | null
 * を追加する。既に存在する場合は上書きしない (idempotent)。
 *
 * 使用:
 *   npm run build:node
 *   node dist/node/add_task_fields.js <tasks.yaml>
 */

import * as fs from "fs";

const DEPS: Record<string, string[]> = {
  "T-0-1": [], "T-0-2": [], "T-0-3": [], "T-0-4": [],
  "T-0-5": ["T-0-1", "T-0-2", "T-0-3", "T-0-4"],
  "T-1-1": ["T-0-5"],
  "T-1-2": ["T-1-1"],
  "T-1-3": ["T-1-1", "T-1-2"],
  "T-1-4": ["T-1-3"],
  "T-1-5": ["T-1-4"],
  "T-1-6": ["T-1-5"],
  "T-1-7": ["T-1-6"],
  "T-1-8": ["T-1-6"],
  "T-1-9": ["T-1-8"],
  "T-1-10": ["T-1-8", "T-1-9"],
  "T-1-11": ["T-1-10"],
};

const LINKED_REVIEW: Record<string, string | null> = {
  "T-1-7": "Qn3_gate2_rework",
  "T-1-8": "Qn3_gate2_rework",
  "T-1-9": "Qn3_gate2_rework",
  "T-1-10": "Qn3_gate2_rework",
  "T-1-11": "Qn3_gate2_rework",
};

function fmtDeps(deps: string[]): string {
  if (deps.length === 0) return "[]";
  return "[" + deps.map((d) => JSON.stringify(d)).join(", ") + "]";
}

function fmtReview(id: string): string {
  const r = LINKED_REVIEW[id];
  return r === undefined || r === null ? "null" : JSON.stringify(r);
}

function main() {
  const [tasksFile] = process.argv.slice(2);
  if (!tasksFile) {
    console.error("usage: add_task_fields <tasks.yaml>");
    process.exit(2);
  }
  const raw = fs.readFileSync(tasksFile, "utf8");
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let currentId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);

    const idMatch = line.match(/^- id:\s*(\S+)/);
    if (idMatch) {
      currentId = idMatch[1];
      continue;
    }
    // 既に存在するなら skip
    if (/^\s+dependencies:/.test(line) || /^\s+linked_review:/.test(line)) {
      // 既存の dependencies/linked_review を現行値で置換したい場合は以下を使う
      continue;
    }
    // round_max 行の直後に挿入
    if (currentId && /^\s+round_max:\s+\d+\s*$/.test(line)) {
      const deps = DEPS[currentId] ?? [];
      out.push(`  dependencies: ${fmtDeps(deps)}`);
      out.push(`  linked_review: ${fmtReview(currentId)}`);
      currentId = null; // 1 entry 1 回のみ
    }
  }
  fs.writeFileSync(tasksFile, out.join("\n"), "utf8");
  const added = out.length - lines.length;
  console.log(`added ${added} lines (${added / 2} entries × 2 fields)`);
}

main();
