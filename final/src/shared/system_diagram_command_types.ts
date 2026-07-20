/**
 * PJ03 Plan 3 (Plan CD) — System Diagram command schema (T-8-1)
 *
 * PJ03 map の System Diagram subtree を timed command replay で編集するための
 * 最小 command set。汎用化はしない (plan3.md §非目標)。
 *
 * 責務: type 定義のみ。実行は system_diagram_runner.ts (T-8-2)。
 */

export interface CommandEnvelopeBase {
  id: string;              // script 内で unique (e.g., "cmd-001")
  type: string;            // SystemDiagramCommand.type と対応
  delay_ms?: number;       // command 実行前の待ち (runner が sleep)
  description?: string;    // 人間向けメモ、実行に影響しない
}

/**
 * reset_subtree — 指定 node id 以下の children を全削除。anchor 自身は残す。
 * anchor node が無ければ新規作成して parentId 配下に置く。
 */
export interface ResetSubtreeCommand extends CommandEnvelopeBase {
  type: "reset_subtree";
  args: {
    anchor_id: string;          // anchor node の id
    anchor_parent_id: string;   // anchor が無かったとき配置する parent
    anchor_text: string;        // anchor が無かったときの text
  };
}

/**
 * create_node — 指定 parent の下に node を作る。
 * id が既に存在する場合は update_node_text + set attrs で上書きする (idempotent)。
 */
export interface CreateNodeCommand extends CommandEnvelopeBase {
  type: "create_node";
  args: {
    node_id: string;
    parent_id: string;
    text: string;
    node_type?: "text" | "folder";
    collapsed?: boolean;
    details?: string;
    note?: string;
    attributes?: Record<string, string>;
  };
}

export interface UpdateNodeTextCommand extends CommandEnvelopeBase {
  type: "update_node_text";
  args: {
    node_id: string;
    text: string;
  };
}

export interface SetAttrCommand extends CommandEnvelopeBase {
  type: "set_attr";
  args: {
    node_id: string;
    attributes: Record<string, string>;
  };
}

export interface LinkNodesCommand extends CommandEnvelopeBase {
  type: "link_nodes";
  args: {
    link_id: string;
    source_node_id: string;
    target_node_id: string;
    relation_type?: string;
    label?: string;
  };
}

export interface SleepCommand extends CommandEnvelopeBase {
  type: "sleep";
  args: {
    ms: number;
  };
}

export type SystemDiagramCommand =
  | ResetSubtreeCommand
  | CreateNodeCommand
  | UpdateNodeTextCommand
  | SetAttrCommand
  | LinkNodesCommand
  | SleepCommand;

/**
 * Script = command の配列 + メタ情報。
 */
export interface SystemDiagramScript {
  script_version: 1;
  map_id: string;                 // 対象 map の id
  map_label_expected?: string;    // 実行前 label 照合 (取り違え防止)
  title: string;
  description?: string;
  commands: SystemDiagramCommand[];
}

export const SUPPORTED_COMMAND_TYPES = [
  "reset_subtree",
  "create_node",
  "update_node_text",
  "set_attr",
  "link_nodes",
  "sleep",
] as const;

export type SupportedCommandType = typeof SUPPORTED_COMMAND_TYPES[number];
