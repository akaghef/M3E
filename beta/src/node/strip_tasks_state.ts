/**
 * T-1-8 補助: tasks.yaml から machine state フィールド (status / round / last_feedback / blocker) を除去。
 * round_max は契約なので残す。
 *
 * 使用:
 *   node dist/node/strip_tasks_state.js <tasks.yaml>
 */

import * as fs from "fs";

function main() {
  const [tasksFile] = process.argv.slice(2);
  if (!tasksFile) {
    console.error("usage: strip_tasks_state <tasks.yaml>");
    process.exit(2);
  }
  const raw = fs.readFileSync(tasksFile, "utf8");
  const lines = raw.split(/\r?\n/);
  const stripped: string[] = [];
  const removeRe = /^(\s+)(status|round|last_feedback|blocker):\s*/;

  for (const line of lines) {
    if (removeRe.test(line)) continue;
    stripped.push(line);
  }
  const out = stripped.join("\n");
  fs.writeFileSync(tasksFile, out, "utf8");
  const removed = lines.length - stripped.length;
  console.log(`stripped ${removed} lines from ${tasksFile}`);
}

main();
