/**
 * GraphLink は AppState.links の非木の typed relation。
 * 形は `beta/src/shared/types.ts` の GraphLink。
 * 辞書のキーが住所で、値は id、sourceNodeId、targetNodeId と、
 * 任意の relationType、label、direction、LinkStyle（style）、color、
 * LinkPort（sourcePort / targetPort）、attributes。
 * 親子 edge は TreeNode の parentId と children[] であり、links には入らない。
 *
 * ここで定義: GraphLinkRecord — AppState.links の 1 件を配列要素にしたもの。
 * ここで定義: linksKey — AppState.links の辞書キー。GraphLink.id とは別に保つ。
 * 書き込みは両者を同じにすることが多い。id が空のときは辞書キーを id にする。
 *
 * 正規化はしない。direction の "none" や LinkPort の "auto" を埋めない。
 * 親子 edge の判定もしない。渡された links の GraphLink フィールドだけを写す。
 */
import type { AppState, GraphLink, LinkDirection, LinkPort, LinkStyle } from "../../shared/types";

const DIRECTIONS: readonly LinkDirection[] = ["none", "forward", "backward", "both"];
const STYLES: readonly LinkStyle[] = ["default", "dashed", "soft", "emphasis"];
const PORTS: readonly LinkPort[] = ["auto", "left", "right", "top", "bottom"];

export interface GraphLinkRecord {
  readonly linksKey: string;
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly relationType?: string;
  readonly label?: string;
  readonly direction?: LinkDirection;
  readonly style?: LinkStyle;
  readonly color?: string;
  readonly sourcePort?: LinkPort;
  readonly targetPort?: LinkPort;
  readonly attributes?: Readonly<Record<string, string>>;
}

/** AppState.links を GraphLinkRecord の配列にする。親子 edge は読まない。 */
export function graphLinksToRecords(links: AppState["links"]): GraphLinkRecord[] {
  if (links === undefined) return [];
  if (!isRecord(links)) throw new Error("AppState.links must be an object.");

  const records: GraphLinkRecord[] = [];
  for (const [linksKey, link] of Object.entries(links)) {
    if (!isRecord(link)) throw new Error(`GraphLink ${linksKey} must be an object.`);
    const key = requireId(linksKey, "linksKey");
    records.push({
      linksKey: key,
      id: storedId(link.id, key),
      sourceNodeId: requireId(link.sourceNodeId, "sourceNodeId"),
      targetNodeId: requireId(link.targetNodeId, "targetNodeId"),
      ...optionals(link, key),
    });
  }
  return records;
}

/** GraphLinkRecord の配列を AppState.links に戻す。nodes の親子 edge は作らない。 */
export function recordsToAppStateLinks(records: readonly GraphLinkRecord[]): NonNullable<AppState["links"]> {
  if (!Array.isArray(records)) throw new Error("GraphLink records must be an array.");

  const links: NonNullable<AppState["links"]> = {};
  for (const record of records) {
    if (!isRecord(record)) throw new Error("GraphLink record must be an object.");
    const linksKey = requireId(record.linksKey, "linksKey");
    if (Object.prototype.hasOwnProperty.call(links, linksKey)) {
      throw new Error(`Duplicate GraphLink key: ${linksKey}`);
    }
    links[linksKey] = {
      id: requireId(record.id, "id"),
      sourceNodeId: requireId(record.sourceNodeId, "sourceNodeId"),
      targetNodeId: requireId(record.targetNodeId, "targetNodeId"),
      ...optionals(record, linksKey),
    };
  }
  return links;
}

function optionals(source: object, label: string): Omit<GraphLink, "id" | "sourceNodeId" | "targetNodeId"> {
  const fields = source as Partial<GraphLink>;
  const result: Omit<GraphLink, "id" | "sourceNodeId" | "targetNodeId"> = {};
  const relationType = optionalString(fields.relationType, `${label} relationType`);
  const linkLabel = optionalString(fields.label, `${label} label`);
  const direction = optionalEnum(fields.direction, DIRECTIONS, `${label} direction`);
  const style = optionalEnum(fields.style, STYLES, `${label} style`);
  const color = optionalString(fields.color, `${label} color`);
  const sourcePort = optionalEnum(fields.sourcePort, PORTS, `${label} sourcePort`);
  const targetPort = optionalEnum(fields.targetPort, PORTS, `${label} targetPort`);
  const attributes = copyAttributes(fields.attributes, label);
  if (relationType !== undefined) result.relationType = relationType;
  if (linkLabel !== undefined) result.label = linkLabel;
  if (direction !== undefined) result.direction = direction;
  if (style !== undefined) result.style = style;
  if (color !== undefined) result.color = color;
  if (sourcePort !== undefined) result.sourcePort = sourcePort;
  if (targetPort !== undefined) result.targetPort = targetPort;
  if (attributes !== undefined) result.attributes = attributes;
  return result;
}

function storedId(id: unknown, linksKey: string): string {
  if (id === undefined || id === "") return linksKey;
  if (typeof id !== "string") throw new Error("GraphLink id must be a string.");
  return id;
}

function copyAttributes(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${label} attributes must be an object with string values.`);
  const copy: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error(`${label} attributes must be an object with string values.`);
    }
    copy[key] = entry;
  }
  return copy;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  return value;
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${label} is invalid.`);
  return value as T;
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
