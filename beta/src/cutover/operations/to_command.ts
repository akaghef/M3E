import { type Command, type CommandIntent } from "./command";
import { commandsFromPlan, planGroup, planLinearApply, planWholeState, type LinearApplyInput, type UnmappedDiff, type WholeStateBody } from "./decompose";
import { findWritePath, type MappedWritePath, type UnsupportedWritePath } from "./write_paths";

/**
 * 保存入口を Command に変換する。読みもしないし、保存もしない。
 */

export interface WritePathRequest {
  pathId: string;
  commandId: string;
  baseRevision: string;
  target: { kind: Command["target"]["kind"]; id: string };
  /** ここで定義: payload は Command.payload へコピーする引数。 */
  payload?: Readonly<Record<string, string>>;
  /** 全体置換 POST の基準 state と受信 state。 */
  before?: WholeStateBody;
  after?: WholeStateBody;
  /** linear-text の Apply が位置で対応させる木と見出し。 */
  linearApply?: LinearApplyInput;
}

/**
 * ここで定義: 「拒否」は、入口は対応済みだが入力が Command を組み立てられないこと。
 * 保存の失敗ではない。
 */
export type ToCommandResult =
  | { status: "対応"; commands: Command[]; unmapped?: readonly UnmappedDiff[] }
  | { status: "未対応"; path: UnsupportedWritePath }
  | { status: "拒否"; pathId: string; reason: string };

const filled = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0;

function missingFields(request: WritePathRequest, path: MappedWritePath): string[] {
  const missing: string[] = [];
  if (!filled(request.commandId)) missing.push("commandId");
  if (!filled(request.baseRevision)) missing.push("baseRevision");
  if (!request.target || request.target.kind !== path.targetKind || !filled(request.target.id)) missing.push("target");
  for (const key of path.requiredPayload) {
    if (!filled(request.payload?.[key])) missing.push(key);
  }
  if (path.selectIntent === "relation") {
    const relation = request.payload?.relation;
    if (relation !== "reparent" && relation !== "reorder") missing.push("relation");
    else if (relation === "reparent" && !filled(request.payload?.parentId)) missing.push("parentId");
    else if (relation === "reorder" && !filled(request.payload?.index)) missing.push("index");
  }
  if (path.selectIntent === "action") {
    const action = request.payload?.action;
    if (action !== "assert" && action !== "delete" && action !== "rename") missing.push("action");
    else if (action === "rename" && !filled(request.payload?.text)) missing.push("text");
  }
  if (path.decompose === "whole-state") {
    if (!request.before) missing.push("before");
    if (!request.after) missing.push("after");
  }
  if (path.decompose === "linear-apply" && !request.linearApply) missing.push("linearApply");
  if (path.id === "mcp.create-node" && filled(request.payload?.attributeKey) && !filled(request.payload?.attributeValue)) {
    missing.push("attributeValue");
  }
  return missing;
}

function intentsFor(path: MappedWritePath, request: WritePathRequest): CommandIntent[] {
  if (path.selectIntent === "relation") {
    return [request.payload!.relation as CommandIntent];
  }
  if (path.selectIntent === "action") {
    return [request.payload!.action as CommandIntent];
  }
  if (path.id === "mcp.create-node" && filled(request.payload?.attributeKey)) {
    return ["assert", "set-attribute"];
  }
  return [...path.intents];
}

function commandIdFor(commandId: string, index: number, intent: CommandIntent): string {
  return index === 0 ? commandId : `${commandId}#${index}:${intent}`;
}

/** 同じ入力からは同じ Command 列が返る。経路の実行はしない。 */
export function toCommand(request: WritePathRequest): ToCommandResult {
  const path = findWritePath(request.pathId);
  if (!path) return { status: "拒否", pathId: request.pathId, reason: "列挙にない入口" };
  if (path.disposition === "未対応") return { status: "未対応", path };
  const missing = missingFields(request, path);
  if (missing.length > 0) return { status: "拒否", pathId: path.id, reason: `不足: ${missing.join(", ")}` };
  if (path.decompose === "whole-state") {
    const diff = planWholeState(request.before!, request.after!);
    return mappedResult(request.commandId, request.baseRevision, diff.planned, diff.unmapped);
  }
  if (path.decompose === "linear-apply") {
    const diff = planLinearApply(request.commandId, request.linearApply!);
    return mappedResult(request.commandId, request.baseRevision, diff.planned, diff.unmapped);
  }
  if (path.decompose === "group") {
    const childIds = request.payload!.childIds.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
    return mappedResult(request.commandId, request.baseRevision, planGroup(request.target.id, request.payload!.parentId, request.payload!.text, childIds), []);
  }
  const payload = request.payload ? { ...request.payload } : undefined;
  const commands = intentsFor(path, request).map((intent, index): Command => ({
    commandId: commandIdFor(request.commandId, index, intent),
    intent,
    target: { kind: path.targetKind, id: request.target.id },
    baseRevision: request.baseRevision,
    ...(payload || path.id.startsWith("linear-text.") ? { payload: { ...payload, ...linearField(path.id) } } : {}),
  }));
  return { status: "対応", commands };
}

function linearField(pathId: string): Record<string, string> {
  if (pathId === "linear-text.put" || pathId === "linear-text.edit" || pathId === "linear-text.delete") return { key: "linear-text" };
  return {};
}

function mappedResult(commandId: string, baseRevision: string, planned: Parameters<typeof commandsFromPlan>[2], unmapped: readonly UnmappedDiff[]): ToCommandResult {
  return {
    status: "対応",
    commands: commandsFromPlan(commandId, baseRevision, planned),
    ...(unmapped.length > 0 ? { unmapped } : {}),
  };
}
