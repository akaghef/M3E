/**
 * Layout（配置）と Style（視覚表現）を、保存されている形のままレコードにする。
 * エンジンは呼ばない。引数だけを見る純関数。
 *
 * Layout の保存形は Surface View ごとの node 配置値。
 * `AppState.surfaces[surfaceId].nodeViews[nodeId]`（`SurfaceNodeView`）に入る。
 * field は `x`、`y`、`flowCol`、`flowRow`、`shape`（`rect` / `diamond` / `rounded`）。
 * 読込み時の `sanitizeSurfaceNodeViews` と同じく、有限数か列挙 shape があるものだけ残す。
 * `{}` や、有効 field が一つもない view は空の配置値であり、レコードにしない。
 * 存在しない node の配置値も残さない。座標 `0` は空ではない。
 * Disperse の保存 kind / layout は `scatter`。ここでは Surface View の設定自体は組み立てない。
 *
 * Style の保存形は node の `attributes["m3e:style"]`。中身は JSON object の文字列。
 * 空 object のときは属性自体が無い（`updateStyleJson` が消す）。
 * 書く field は `fill`、`text`、`border`、および同じ object に既にある `urgency`、`importance`、`status`。
 * 読む側 `normalizeNodeDrawStyle` は、JSON に無い色などを legacy の attribute
 * （`m3e:bg`、`m3e:color`、`m3e:border`、`m3e:border-style`、`m3e:border-width`、
 * `m3e:shape`、`m3e:icon`、`m3e:status`、`m3e:confidence`、`m3e:band`）から補う。
 * それらの key は attribute のまま残し、ここでは複製しない。
 * `SurfaceNodeView.shape` は Layout の配置値であり、Style の形状とは別の保存欄。
 *
 * ここで定義: NodePlacementRecord — 一つの Surface View 上の、一つの node の空でない配置値。
 * ここで定義: NodeStyleRecord — 一つの node の、空でない `m3e:style` object。
 * ここで定義: LayoutRecords — 上記二つの配列。AppState そのものではない。
 */
import type { AppState, MapSurface, SurfaceNodeView, TreeNode } from "../../shared/types";

export interface NodePlacementRecord {
  surfaceId: string;
  nodeId: string;
  x?: number;
  y?: number;
  flowCol?: number;
  flowRow?: number;
  shape?: "rect" | "diamond" | "rounded";
}

export interface NodeStyleRecord {
  nodeId: string;
  style: Readonly<Record<string, unknown>>;
}

export interface LayoutRecords {
  placements: readonly NodePlacementRecord[];
  styles: readonly NodeStyleRecord[];
}

/** 値がある配置と Style だけをレコードにする。空の配置値と空の `m3e:style` は配列に入らない。 */
export function layoutRecordsFromAppState(state: AppState): LayoutRecords {
  return {
    placements: nodePlacementRecordsFromAppState(state),
    styles: nodeStyleRecordsFromAppState(state),
  };
}

/** LayoutRecords を AppState へ戻す。レコードに無い配置値と `m3e:style` は消える。他の attribute と木は残す。 */
export function applyLayoutRecords(state: AppState, records: LayoutRecords): AppState {
  const withPlacement = applyNodePlacementRecords(state, requireArray(records?.placements, "placements"));
  return applyNodeStyleRecords(withPlacement, requireArray(records?.styles, "styles"));
}

export function nodePlacementRecordsFromAppState(state: AppState): NodePlacementRecord[] {
  const nodes = nodeMap(state);
  const surfaces = surfaceMap(state);
  const records: NodePlacementRecord[] = [];
  for (const [surfaceId, surface] of Object.entries(surfaces)) {
    const nodeViews = surface?.nodeViews;
    if (!nodeViews || typeof nodeViews !== "object") continue;
    for (const [nodeId, view] of Object.entries(nodeViews)) {
      if (!nodes[nodeId] || !view || typeof view !== "object") continue;
      const placement = placementView(view);
      if (!placement) continue;
      records.push({ surfaceId, nodeId, ...placement });
    }
  }
  return records;
}

export function applyNodePlacementRecords(
  state: AppState,
  records: readonly NodePlacementRecord[],
): AppState {
  const nodes = nodeMap(state);
  const surfaces = surfaceMap(state);
  const incoming = placementsBySurface(requireArray(records, "placements"), new Set(Object.keys(nodes)));
  if (Object.keys(surfaces).length === 0) {
    return { ...state, nodes };
  }
  const nextSurfaces: Record<string, MapSurface> = {};
  for (const [surfaceId, surface] of Object.entries(surfaces)) {
    const nodeViews: Record<string, SurfaceNodeView> = {};
    const bucket = incoming.get(surfaceId);
    if (bucket) {
      for (const [nodeId, view] of bucket) {
        nodeViews[nodeId] = view;
      }
    }
    nextSurfaces[surfaceId] = { ...surface, nodeViews };
  }
  return { ...state, nodes, surfaces: nextSurfaces };
}

export function nodeStyleRecordsFromAppState(state: AppState): NodeStyleRecord[] {
  const records: NodeStyleRecord[] = [];
  for (const [nodeId, node] of Object.entries(nodeMap(state))) {
    const style = styleObject(node?.attributes?.["m3e:style"]);
    if (!style) continue;
    records.push({ nodeId, style });
  }
  return records;
}

export function applyNodeStyleRecords(state: AppState, records: readonly NodeStyleRecord[]): AppState {
  const styles = stylesByNode(requireArray(records, "styles"));
  const nextNodes: Record<string, TreeNode> = {};
  for (const [nodeId, node] of Object.entries(nodeMap(state))) {
    const attributes = { ...(node.attributes ?? {}) };
    const style = styles.get(nodeId);
    if (style) attributes["m3e:style"] = JSON.stringify(style);
    else delete attributes["m3e:style"];
    nextNodes[nodeId] = { ...node, children: [...(node.children ?? [])], attributes };
  }
  return { ...state, nodes: nextNodes };
}

function nodeMap(state: AppState): Record<string, TreeNode> {
  if (!state || typeof state !== "object" || !state.nodes || typeof state.nodes !== "object") {
    throw new Error("AppState.nodes is missing.");
  }
  return state.nodes;
}

function surfaceMap(state: AppState): Record<string, MapSurface> {
  const surfaces = state.surfaces;
  if (surfaces === undefined) return {};
  if (!surfaces || typeof surfaces !== "object") {
    throw new Error("AppState.surfaces is invalid.");
  }
  return surfaces;
}

function requireArray<T>(value: readonly T[] | undefined, label: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function placementsBySurface(
  records: readonly NodePlacementRecord[],
  knownNodes: ReadonlySet<string>,
): Map<string, Map<string, SurfaceNodeView>> {
  const bySurface = new Map<string, Map<string, SurfaceNodeView>>();
  for (const record of records) {
    if (!record || typeof record.surfaceId !== "string" || record.surfaceId.length === 0) continue;
    if (typeof record.nodeId !== "string" || record.nodeId.length === 0) continue;
    if (!knownNodes.has(record.nodeId)) continue;
    let bucket = bySurface.get(record.surfaceId);
    if (!bucket) {
      bucket = new Map();
      bySurface.set(record.surfaceId, bucket);
    }
    const view = placementView(record);
    if (!view) bucket.delete(record.nodeId);
    else bucket.set(record.nodeId, view);
  }
  return bySurface;
}

function placementView(view: {
  x?: unknown;
  y?: unknown;
  flowCol?: unknown;
  flowRow?: unknown;
  shape?: unknown;
}): SurfaceNodeView | undefined {
  const next: SurfaceNodeView = {};
  if (typeof view.x === "number" && Number.isFinite(view.x)) next.x = view.x;
  if (typeof view.y === "number" && Number.isFinite(view.y)) next.y = view.y;
  if (typeof view.flowCol === "number" && Number.isFinite(view.flowCol)) next.flowCol = view.flowCol;
  if (typeof view.flowRow === "number" && Number.isFinite(view.flowRow)) next.flowRow = view.flowRow;
  if (view.shape === "rect" || view.shape === "diamond" || view.shape === "rounded") next.shape = view.shape;
  return Object.keys(next).length > 0 ? next : undefined;
}

function stylesByNode(records: readonly NodeStyleRecord[]): Map<string, Record<string, unknown>> {
  const byNode = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    if (!record || typeof record.nodeId !== "string" || record.nodeId.length === 0) continue;
    const style = styleObject(record.style);
    if (!style) byNode.delete(record.nodeId);
    else byNode.set(record.nodeId, style);
  }
  return byNode;
}

function styleObject(raw: unknown): Record<string, unknown> | undefined {
  const parsed = typeof raw === "string" ? parseStyleJson(raw) : raw;
  if (!isPlainObject(parsed)) return undefined;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const json = copyJson(value);
    if (!json.ok) continue;
    copy[key] = json.value;
  }
  return Object.keys(copy).length > 0 ? copy : undefined;
}

function parseStyleJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

type Json = null | string | number | boolean | Json[] | { [key: string]: Json };

function copyJson(value: unknown): { ok: true; value: Json } | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (typeof value === "string" || typeof value === "boolean") return { ok: true, value };
  if (typeof value === "number") return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  if (Array.isArray(value)) {
    const next: Json[] = [];
    for (const item of value) {
      const copied = copyJson(item);
      if (!copied.ok) return { ok: false };
      next.push(copied.value);
    }
    return { ok: true, value: next };
  }
  if (isPlainObject(value)) {
    const next: { [key: string]: Json } = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      const copied = copyJson(item);
      if (!copied.ok) return { ok: false };
      next[key] = copied.value;
    }
    return { ok: true, value: next };
  }
  return { ok: false };
}
