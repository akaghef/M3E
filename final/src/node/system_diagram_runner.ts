/**
 * PJ03 Plan 3 — system_diagram_runner (T-8-2)
 *
 * PJ03 map 専用。`SystemDiagramScript` を受け取り、順に command を実行する。
 *
 * モード:
 *   --dry-run: HTTP を打たず、実行計画を stdout に出力
 *   --live:    map server (localhost:4173) に対して実行
 *   --step:    1 command ごとに Enter 入力待ち (manual pacing)
 *   --auto:    script の delay_ms + fixed interval で自動実行 (default)
 *
 * 非責務:
 *   - 汎用 CLI スクリプト基盤 (plan3.md §非目標)
 *   - reducer / graph_runtime / checkpoint への書込 (全く触らない)
 */

import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as readline from "readline";

import type {
  CreateNodeCommand,
  LinkNodesCommand,
  ResetSubtreeCommand,
  SetAttrCommand,
  SleepCommand,
  SystemDiagramCommand,
  SystemDiagramScript,
  UpdateNodeTextCommand,
} from "../shared/system_diagram_command_types";
import type { AppState, TreeNode, GraphLink } from "../shared/types";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 4173;
const DEFAULT_AUTO_INTERVAL_MS = 500;

interface RunnerOptions {
  scriptFile: string;
  dryRun: boolean;               // default true (Gate 5 Finding 2 fix: live を明示 opt-in にする)
  mode: "step" | "auto";
  autoIntervalMs: number;
  host: string;
  port: number;
  backupDir: string;             // 非空なら pre-run snapshot を書く (Gate 5 Finding 2 fix)
}

// ---------------------------------------------------------------------------
// HTTP helpers (minimal, std http)
// ---------------------------------------------------------------------------

function httpRequest(opts: { host: string; port: number; method: string; path: string; body?: unknown }): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = opts.body ? JSON.stringify(opts.body) : undefined;
    const req = http.request(
      {
        host: opts.host,
        port: opts.port,
        method: opts.method,
        path: opts.path,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function fetchAppState(opts: { host: string; port: number; mapId: string }): Promise<AppState> {
  const r = await httpRequest({ ...opts, method: "GET", path: `/api/maps/${encodeURIComponent(opts.mapId)}` });
  if (r.status !== 200) throw new Error(`GET map ${opts.mapId} -> ${r.status}: ${r.body.slice(0, 200)}`);
  const parsed = JSON.parse(r.body) as { state: AppState; mapVersion?: number; label?: string };
  return parsed.state;
}

async function saveAppState(opts: { host: string; port: number; mapId: string; state: AppState }): Promise<void> {
  const r = await httpRequest({
    host: opts.host,
    port: opts.port,
    method: "POST",
    path: `/api/maps/${encodeURIComponent(opts.mapId)}`,
    body: { version: 1, savedAt: new Date().toISOString(), state: opts.state },
  });
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`POST map ${opts.mapId} -> ${r.status}: ${r.body.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Command application (state in-memory → save at end of each command for step visibility)
// ---------------------------------------------------------------------------

function emptyNode(id: string, parentId: string | null, text: string, nodeType: "text" | "folder" = "text"): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType,
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
  };
}

function applyResetSubtree(state: AppState, cmd: ResetSubtreeCommand): AppState {
  const { anchor_id, anchor_parent_id, anchor_text } = cmd.args;
  const nodes = { ...state.nodes };

  // anchor が無ければ作る
  if (!nodes[anchor_id]) {
    nodes[anchor_id] = emptyNode(anchor_id, anchor_parent_id, anchor_text, "folder");
    const parent = nodes[anchor_parent_id];
    if (parent) {
      const pcopy = { ...parent, children: [...parent.children] };
      if (!pcopy.children.includes(anchor_id)) pcopy.children.push(anchor_id);
      nodes[anchor_parent_id] = pcopy;
    }
  }

  // anchor 配下の子孫を削除
  const toDelete: string[] = [];
  const stack = [...(nodes[anchor_id]?.children ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    toDelete.push(id);
    const n = nodes[id];
    if (n) stack.push(...n.children);
  }
  for (const id of toDelete) delete nodes[id];
  nodes[anchor_id] = { ...nodes[anchor_id]!, children: [], text: anchor_text };

  // links も anchor 配下のものを削除
  const links = { ...(state.links ?? {}) };
  for (const lid of Object.keys(links)) {
    const l = links[lid];
    if (!l) continue;
    if (toDelete.includes(l.sourceNodeId) || toDelete.includes(l.targetNodeId)) delete links[lid];
  }

  return { ...state, nodes, links };
}

function applyCreateNode(state: AppState, cmd: CreateNodeCommand): AppState {
  const { node_id, parent_id, text, node_type, collapsed, details, note, attributes } = cmd.args;
  const nodes = { ...state.nodes };
  const existing = nodes[node_id];
  if (existing) {
    nodes[node_id] = {
      ...existing,
      text: text ?? existing.text,
      nodeType: node_type ?? existing.nodeType,
      collapsed: collapsed ?? existing.collapsed,
      details: details ?? existing.details,
      note: note ?? existing.note,
      attributes: attributes ? { ...existing.attributes, ...attributes } : existing.attributes,
    };
    return { ...state, nodes };
  }
  nodes[node_id] = {
    ...emptyNode(node_id, parent_id, text, node_type ?? "text"),
    collapsed: collapsed ?? false,
    details: details ?? "",
    note: note ?? "",
    attributes: attributes ?? {},
  };
  const parent = nodes[parent_id];
  if (!parent) throw new Error(`create_node: parent not found: ${parent_id}`);
  nodes[parent_id] = { ...parent, children: [...parent.children, node_id] };
  return { ...state, nodes };
}

function applyUpdateText(state: AppState, cmd: UpdateNodeTextCommand): AppState {
  const n = state.nodes[cmd.args.node_id];
  if (!n) throw new Error(`update_node_text: node not found: ${cmd.args.node_id}`);
  return { ...state, nodes: { ...state.nodes, [cmd.args.node_id]: { ...n, text: cmd.args.text } } };
}

function applySetAttr(state: AppState, cmd: SetAttrCommand): AppState {
  const n = state.nodes[cmd.args.node_id];
  if (!n) throw new Error(`set_attr: node not found: ${cmd.args.node_id}`);
  return {
    ...state,
    nodes: { ...state.nodes, [cmd.args.node_id]: { ...n, attributes: { ...n.attributes, ...cmd.args.attributes } } },
  };
}

function applyLinkNodes(state: AppState, cmd: LinkNodesCommand): AppState {
  const { link_id, source_node_id, target_node_id, relation_type, label } = cmd.args;
  if (!state.nodes[source_node_id]) throw new Error(`link_nodes: source not found: ${source_node_id}`);
  if (!state.nodes[target_node_id]) throw new Error(`link_nodes: target not found: ${target_node_id}`);
  const link: GraphLink = {
    id: link_id,
    sourceNodeId: source_node_id,
    targetNodeId: target_node_id,
    relationType: relation_type,
    label,
  };
  return { ...state, links: { ...(state.links ?? {}), [link_id]: link } };
}

export function applyCommand(state: AppState, cmd: SystemDiagramCommand): AppState {
  switch (cmd.type) {
    case "reset_subtree": return applyResetSubtree(state, cmd);
    case "create_node": return applyCreateNode(state, cmd);
    case "update_node_text": return applyUpdateText(state, cmd);
    case "set_attr": return applySetAttr(state, cmd);
    case "link_nodes": return applyLinkNodes(state, cmd);
    case "sleep": return state; // sleep は runner 側で扱う、state に影響なし
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
}

function describe(cmd: SystemDiagramCommand): string {
  switch (cmd.type) {
    case "reset_subtree": return `reset_subtree(anchor=${cmd.args.anchor_id} under ${cmd.args.anchor_parent_id})`;
    case "create_node": return `create_node(${cmd.args.node_id} @ ${cmd.args.parent_id}) = "${cmd.args.text}"`;
    case "update_node_text": return `update_node_text(${cmd.args.node_id}) = "${cmd.args.text}"`;
    case "set_attr": return `set_attr(${cmd.args.node_id}) += ${Object.keys(cmd.args.attributes).join(",")}`;
    case "link_nodes": return `link_nodes(${cmd.args.link_id}: ${cmd.args.source_node_id} → ${cmd.args.target_node_id})`;
    case "sleep": return `sleep(${cmd.args.ms}ms)`;
  }
}

async function runScript(script: SystemDiagramScript, opts: RunnerOptions): Promise<void> {
  console.log(`[runner] title: ${script.title}`);
  console.log(`[runner] map_id: ${script.map_id}`);
  console.log(`[runner] mode: ${opts.mode}${opts.dryRun ? " (dry-run)" : ` (live @ ${opts.host}:${opts.port})`}`);
  console.log(`[runner] commands: ${script.commands.length}`);
  console.log();

  let state: AppState | null = null;

  // live mode: fetch initial state + label exact-match guard + pre-run backup
  if (!opts.dryRun) {
    state = await fetchAppState({ host: opts.host, port: opts.port, mapId: script.map_id });
    console.log(`[runner] fetched map rootId=${state.rootId} nodes=${Object.keys(state.nodes).length}`);

    // Gate 5 Finding 2 fix: 厳密な root.text 一致チェック (substring ではない)
    if (script.map_label_expected) {
      const rootNode = state.nodes[state.rootId];
      const actualLabel = rootNode?.text ?? "(unknown)";
      if (actualLabel !== script.map_label_expected) {
        throw new Error(`map_label_expected='${script.map_label_expected}' but root.text='${actualLabel}' (exact match required) — refusing to run to prevent targeting wrong map`);
      }
    }

    // Gate 5 Finding 2 fix: 最初の destructive command の前に pre-run snapshot を書く
    const hasDestructive = script.commands.some((c) => c.type === "reset_subtree");
    if (hasDestructive) {
      const backupDir = opts.backupDir;
      if (!backupDir) {
        throw new Error(`script contains destructive command (reset_subtree) but --backup-dir was not provided; refusing to run without backup`);
      }
      fs.mkdirSync(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `map-${script.map_id}-${stamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }, null, 2), "utf8");
      console.log(`[runner] pre-run snapshot written: ${backupPath}`);
    }
    console.log();
  }

  for (let i = 0; i < script.commands.length; i++) {
    const cmd = script.commands[i]!;
    const prefix = `[${String(i + 1).padStart(3, "0")}/${script.commands.length}]`;

    if (cmd.delay_ms && cmd.delay_ms > 0 && opts.mode === "auto") {
      await sleep(cmd.delay_ms);
    } else if (opts.mode === "auto" && opts.autoIntervalMs > 0 && i > 0) {
      await sleep(opts.autoIntervalMs);
    }
    if (opts.mode === "step" && i > 0) {
      await waitForEnter(`${prefix} press Enter to run: ${describe(cmd)} ... `);
    }

    console.log(`${prefix} ${cmd.type}: ${describe(cmd)}`);
    if (cmd.type === "sleep") {
      if (!opts.dryRun) await sleep(cmd.args.ms);
      continue;
    }
    if (opts.dryRun) continue;

    try {
      state = applyCommand(state!, cmd);
      await saveAppState({ host: opts.host, port: opts.port, mapId: script.map_id, state });
    } catch (e) {
      console.error(`${prefix} FAILED: ${(e as Error).message}`);
      throw e;
    }
  }

  console.log();
  console.log(`[runner] done.`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): RunnerOptions {
  const out: RunnerOptions = {
    scriptFile: "",
    dryRun: true,                  // Gate 5 Finding 2 fix: default は dry-run
    mode: "auto",
    autoIntervalMs: DEFAULT_AUTO_INTERVAL_MS,
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    backupDir: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--script") out.scriptFile = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;         // 冗長だが明示 OK
    else if (a === "--live") out.dryRun = false;           // Gate 5 Finding 2 fix: 実走行は明示 opt-in
    else if (a === "--step") out.mode = "step";
    else if (a === "--auto") out.mode = "auto";
    else if (a === "--interval") out.autoIntervalMs = Number(argv[++i]);
    else if (a === "--host") out.host = argv[++i];
    else if (a === "--port") out.port = Number(argv[++i]);
    else if (a === "--backup-dir") out.backupDir = argv[++i];
  }
  return out;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.scriptFile) {
    console.error("usage: system_diagram_runner --script <path.json> [--live] [--backup-dir <dir>] [--step|--auto] [--interval <ms>] [--host <h>] [--port <p>]");
    console.error("  default is dry-run; use --live to actually modify the map server.");
    console.error("  scripts containing reset_subtree (destructive) require --backup-dir in live mode.");
    process.exit(2);
  }
  const raw = fs.readFileSync(opts.scriptFile, "utf8");
  const script = JSON.parse(raw) as SystemDiagramScript;
  try {
    await runScript(script, opts);
  } catch (e) {
    console.error(`[runner] error: ${(e as Error).message}`);
    process.exit(1);
  }
}

if (require.main === module) main();
