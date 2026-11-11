/**
 * Command は Glossary の操作単位。intent は Glossary（assert / rename /
 * reparent / bind / transfer / delete 等）と Command_Language 4 節、
 * それに Glossary の操作語 scopen / unscopen / reorder に限る。
 * このモジュールは保存経路を Command に変換するだけで、確定しない。
 */

/** Glossary と Command_Language 4 節の intent。scopen / unscopen / reorder は Glossary の操作語。 */
export type CommandIntent =
  | "assert"
  | "rename"
  | "reparent"
  | "bind"
  | "transfer"
  | "delete"
  | "set-attribute"
  | "unset-attribute"
  | "set-type"
  | "clone"
  | "replace"
  | "view"
  | "load"
  | "export"
  | "history"
  | "mark"
  | "select"
  | "scopen"
  | "unscopen"
  | "reorder"
  /**
   * ここで定義: retarget は同じ GraphLink の sourceNodeId または targetNodeId を変える。
   * reparent は node の親の変更であり、GraphLink の端点には使わない。
   */
  | "retarget";

/**
 * node / GraphLink / map は既存の対象語。
 * ここで定義: annotation は注釈 1 件。surface は MapSurface 1 件。どちらも node ではない。
 */
export type CommandTargetKind = "node" | "GraphLink" | "map" | "annotation" | "surface";

export interface CommandTarget {
  kind: CommandTargetKind;
  id: string;
}

export interface Command {
  commandId: string;
  intent: CommandIntent;
  target: CommandTarget;
  baseRevision: string;
  /**
   * ここで定義: payload は intent の引数（親、text、属性 key など）。
   * 同一判定には使わない。
   */
  payload?: Readonly<Record<string, string>>;
}

/**
 * ここで定義: 同一判定は commandId の一致。
 * Command_Language の commandId は再送と監査の識別子なので、
 * target や payload が違っても同じ commandId は同一の Command とする。
 */
export function sameCommand(left: Command, right: Command): boolean {
  return left.commandId === right.commandId;
}
