import type { LayoutNodePosition } from "./layout_port";

export type SurfaceViewName = "Tree" | "Axial" | "Radial" | "Disperse" | "System";
export type NodeDrawKind = "root" | "plain" | "folder" | "latex" | "status";
export type NodeDrawType = "text" | "image" | "folder" | "alias";
export type AliasDrawState = "none" | "read" | "write" | "broken";
export type ScopeLockDrawState = "none" | "self" | "other";
export type NodeDrawShape = "rect" | "rounded" | "pill" | "diamond";
export type NodeDrawStatus = "placeholder" | "confirmed" | "contested" | "frozen" | "active" | "review";

export interface NodeDrawNode {
  id: string;
  type: NodeDrawType;
  kind: NodeDrawKind;
  label: string;
  text?: string;
  alias: AliasDrawState;
  aliasLabel?: string;
  targetLabel?: string;
  snapshotLabel?: string;
  isFolder: boolean;
  isScopePortal: boolean;
  isRoot: boolean;
  isLatex: boolean;
  isScatterGroup?: boolean;
  scatterRole?: "upstream" | "sample" | "downstream" | null;
  badge?: string;
}

export interface NodeDrawStyle {
  fill?: string;
  text?: string;
  border?: string;
  borderStyle?: "solid" | "dashed" | "dotted" | "none";
  borderWidth?: number;
  shape?: NodeDrawShape;
  icon?: string;
  status?: NodeDrawStatus;
  confidence?: number;
  urgency?: number;
  importance?: number;
  band?: "flash" | "rapid" | "deep";
}

export interface NodeDrawViewState {
  selected: boolean;
  primarySelected: boolean;
  multiSelected: boolean;
  linkSource: boolean;
  cutPending: boolean;
  reparentSource: boolean;
  dragSource: boolean;
  dropTarget: boolean;
  collapsedCount?: number;
  lockedBy: ScopeLockDrawState;
}

export interface NodeDrawSurface {
  view: SurfaceViewName;
  structuredMode?: SurfaceViewName;
  displayRootId?: string;
  rootless?: boolean;
}

export type NodeDrawContent =
  | { kind: "plainLabel"; labelLines: string[]; fontSize?: number; textAnchor?: "start" | "middle" }
  | { kind: "latexHtml"; html: string; displayMode: boolean };

export interface NodeDrawInput {
  node: NodeDrawNode;
  position: LayoutNodePosition;
  style: NodeDrawStyle;
  view: NodeDrawViewState;
  surface: NodeDrawSurface;
  content: NodeDrawContent;
}

export interface NodeDrawBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  maxX: number;
  maxY: number;
}

export interface NodeDrawOutput {
  svg: string;
  overlays?: string;
  bounds: NodeDrawBounds;
}

export interface NodeDrawLatexAdapter {
  renderLatex(source: string): { html: string; displayMode: boolean };
  measureLatex?(source: string): { w: number; h: number };
}

export interface RawNodeDrawStyleInput {
  styleJson?: string;
  legacy?: Record<string, string | undefined>;
  surfaceShape?: NodeDrawShape | "rounded" | null;
}

const VALID_STATUSES = new Set<NodeDrawStatus>([
  "placeholder",
  "confirmed",
  "contested",
  "frozen",
  "active",
  "review",
]);

export function normalizeNodeDrawStyle(raw: RawNodeDrawStyleInput): NodeDrawStyle {
  const legacy = raw.legacy || {};
  const parsed = parseStyleJson(raw.styleJson);
  const urgency = finiteNumber(parsed.urgency);
  const importance = finiteNumber(parsed.importance);
  const jsonFill = typeof parsed.fill === "string" ? sanitizeColor(parsed.fill) : undefined;
  const legacyFill = sanitizeColor(legacy["m3e:bg"]);
  const fill = jsonFill ?? legacyFill ?? (
    urgency !== undefined || importance !== undefined
      ? deriveFillFromUrgencyImportance(urgency ?? 0, importance ?? 0)
      : undefined
  );
  return dropUndefined({
    fill,
    text: (typeof parsed.text === "string" ? sanitizeColor(parsed.text) : undefined) ?? sanitizeColor(legacy["m3e:color"]),
    border: (typeof parsed.border === "string" ? sanitizeColor(parsed.border) : undefined) ?? sanitizeColor(legacy["m3e:border"]),
    borderStyle: sanitizeBorderStyle(legacy["m3e:border-style"]),
    borderWidth: sanitizeNumeric(legacy["m3e:border-width"], 0, 8),
    shape: raw.surfaceShape ?? sanitizeShape(legacy["m3e:shape"]),
    icon: sanitizeIcon(legacy["m3e:icon"]),
    status: sanitizeStatus(parsed.status) ?? sanitizeStatus(legacy["m3e:status"]),
    confidence: sanitizeNumeric(legacy["m3e:confidence"], 0, 1),
    urgency,
    importance,
    band: sanitizeBand(legacy["m3e:band"]),
  });
}

export function nodeDrawConfidenceColor(c: number): string {
  const v = clamp01(c);
  if (v <= 0.5) {
    const r = 220;
    const g = Math.round(60 + v * 2 * 160);
    return `rgb(${r},${g},40)`;
  }
  const r = Math.round(220 - (v - 0.5) * 2 * 180);
  const g = Math.round(180 + (v - 0.5) * 2 * 40);
  return `rgb(${r},${g},40)`;
}

export function canonicalSurfaceViewName(raw: string | undefined | null): SurfaceViewName {
  switch ((raw || "").trim().toLowerCase()) {
    case "timeline":
    case "axial":
      return "Axial";
    case "scatter":
    case "disperse":
      return "Disperse";
    case "system":
      return "System";
    case "radial":
      return "Radial";
    case "tree":
    case "mindmap":
    case "logic-chart":
    default:
      return "Tree";
  }
}

function parseStyleJson(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function sanitizeColor(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(value)) return value;
  return undefined;
}

function sanitizeBorderStyle(raw: unknown): NodeDrawStyle["borderStyle"] | undefined {
  if (raw === "solid" || raw === "dashed" || raw === "dotted" || raw === "none") return raw;
  return undefined;
}

function sanitizeShape(raw: unknown): NodeDrawShape | undefined {
  if (raw === "rect" || raw === "rounded" || raw === "pill" || raw === "diamond") return raw;
  return undefined;
}

function sanitizeIcon(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value.length > 0 && [...value].length <= 4 ? value : undefined;
}

function sanitizeBand(raw: unknown): NodeDrawStyle["band"] | undefined {
  if (raw === "flash" || raw === "rapid" || raw === "deep") return raw;
  return undefined;
}

function sanitizeStatus(raw: unknown): NodeDrawStatus | undefined {
  if (typeof raw !== "string") return undefined;
  const status = raw.trim().toLowerCase() as NodeDrawStatus;
  return VALID_STATUSES.has(status) ? status : undefined;
}

function sanitizeNumeric(raw: unknown, min: number, max: number): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined;
}

function finiteNumber(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function deriveFillFromUrgencyImportance(urgency: number, importance: number): string {
  const u = clamp01(urgency / 3);
  const i = clamp01(importance / 3);
  const w00 = (1 - u) * (1 - i);
  const w01 = (1 - u) * i;
  const w10 = u * (1 - i);
  const w11 = u * i;
  const r = Math.round(w00 * 255 + w01 * 255 + w10 * 0 + w11 * 255);
  const g = Math.round(w00 * 255 + w01 * 255 + w10 * 0 + w11 * 0);
  const b = Math.round(w00 * 255 + w01 * 0 + w10 * 255 + w11 * 0);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function dropUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
