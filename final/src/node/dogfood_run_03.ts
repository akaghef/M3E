/**
 * T-3-3 dogfood_run_03 — PJ03 自身を workflow_scope_projector で投影
 *
 * 本 PJ の tasks.yaml + runtime/checkpoints/ を実データソースとして
 * projectTasks() を呼び、生成された AppState を artifacts/workflow_scope_snapshot.json に保存する。
 *
 * 追加で breakdown と主要 field のサマリを stdout に dump し、
 * Manager が dogfood_run_03.md に転記する。
 */

import * as fs from "fs";
import * as path from "path";

import { projectTasks } from "./workflow_scope_projector";

function main(): void {
  const [tasksFile, runtimeDir, outFile] = process.argv.slice(2);
  if (!tasksFile || !runtimeDir || !outFile) {
    console.error("usage: dogfood_run_03 <tasks.yaml> <runtimeDir> <outFile>");
    process.exit(2);
  }

  const app = projectTasks(tasksFile, runtimeDir);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(app, null, 2) + "\n", "utf8");

  const root = app.nodes[app.rootId];
  const total = Object.keys(app.nodes).length - 1;
  console.log(`=== Snapshot written to ${outFile} ===`);
  console.log(`rootId: ${app.rootId}`);
  console.log(`root.text: ${root?.text}`);
  console.log(`root.nodeType: ${root?.nodeType}`);
  console.log(`total task nodes: ${total}`);
  console.log();
  console.log("=== breakdown (from root.attributes) ===");
  for (const [k, v] of Object.entries(root?.attributes ?? {})) {
    if (k.startsWith("workflow.count.") || k === "workflow.total") {
      console.log(`  ${k} = ${v}`);
    }
  }
  console.log();
  console.log("=== sample task nodes (first 3 + any non-done) ===");
  const nonDoneIds: string[] = [];
  for (const [id, node] of Object.entries(app.nodes)) {
    if (id === app.rootId) continue;
    if (node.attributes["workflow.kind"] !== "done") nonDoneIds.push(id);
  }
  const ids: string[] = [];
  const taskIds = Object.keys(app.nodes).filter((i) => i !== app.rootId);
  ids.push(...taskIds.slice(0, 3));
  for (const i of nonDoneIds) if (!ids.includes(i)) ids.push(i);

  for (const id of ids) {
    const n = app.nodes[id];
    if (!n) continue;
    console.log(`  ${id}  text="${n.text}"`);
    console.log(`    kind=${n.attributes["workflow.kind"]} round=${n.attributes["workflow.round"]}/${n.attributes["workflow.round_max"]} phase=${n.attributes["workflow.phase"]} next=${n.attributes["workflow.next_signal"]}`);
    if (n.attributes["workflow.blocker"]) console.log(`    blocker=${JSON.stringify(n.attributes["workflow.blocker"])}`);
    if (n.attributes["workflow.linked_review"]) console.log(`    linked_review=${n.attributes["workflow.linked_review"]}`);
  }
}

main();
