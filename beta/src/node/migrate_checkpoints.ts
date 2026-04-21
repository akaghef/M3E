/**
 * T-1-8 migration script
 *
 * 現行 tasks.yaml から各 task の state を読み、
 * projects/PJ03_SelfDrive/runtime/checkpoints/{id}.json を生成する。
 *
 * 実行後、tasks.yaml から status / round / last_feedback / blocker を手動で除去。
 *
 * 使用:
 *   npm run build:node
 *   node dist/node/migrate_checkpoints.js <tasks.yaml> <runtime/checkpoints>
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  CHECKPOINT_SCHEMA_VERSION,
  CheckpointFile,
  PersistedState,
} from "../shared/checkpoint_types";
import type { WorkflowStateKind } from "../shared/workflow_types";

interface OldEntry {
  id: string;
  status: WorkflowStateKind;
  round: number;
  round_max: number;
  last_feedback: string | null;
  blocker: string | null;
  escalation_kind?: string | null;
  wakeup_at?: string | null;
  wakeup_mechanism?: string | null;
  failure_reason?: string | null;
}

function main() {
  const [tasksFile, outDir] = process.argv.slice(2);
  if (!tasksFile || !outDir) {
    console.error("usage: migrate_checkpoints <tasks.yaml> <outDir>");
    process.exit(2);
  }
  const raw = fs.readFileSync(tasksFile, "utf8");
  const entries = yaml.load(raw) as OldEntry[];
  if (!Array.isArray(entries)) {
    throw new Error("tasks.yaml must be a list");
  }
  fs.mkdirSync(outDir, { recursive: true });

  for (const e of entries) {
    const state: PersistedState = {
      kind: e.status,
      round: e.round ?? 0,
      round_max: e.round_max ?? 3,
      last_feedback: e.last_feedback ?? null,
      blocker: e.blocker ?? null,
      escalation_kind: (e.escalation_kind as PersistedState["escalation_kind"]) ?? null,
      wakeup_at: e.wakeup_at ?? null,
      wakeup_mechanism: (e.wakeup_mechanism as PersistedState["wakeup_mechanism"]) ?? null,
      failure_reason: e.failure_reason ?? null,
    };
    const cp: CheckpointFile = {
      schema_version: CHECKPOINT_SCHEMA_VERSION,
      task_id: e.id,
      updated_at: new Date().toISOString(),
      state,
    };
    const out = path.join(outDir, `${e.id}.json`);
    fs.writeFileSync(out, JSON.stringify(cp, null, 2) + "\n", "utf8");
    console.log(`wrote ${out} (kind=${state.kind})`);
  }
}

main();
