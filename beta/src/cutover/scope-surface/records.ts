/**
 * AppState の scope と surface の保存形。
 *
 * 正本は `SavedMap.state` の `scopes` と `surfaces`
 * （`beta/src/shared/types.ts` の `MapScope` / `MapSurface`）。
 * viewer の空 map は scope の保存キーを `scope:${nodeId}`、
 * surface の保存キーを `surface:${nodeId}:${kind}` とし、キーと `id` を一致させる。
 * キーと `id` が違うオブジェクトも、辞書のキーと `id` を別フィールドとして往復する。
 *
 * scope は認知境界である。Glossary では認知・表示・編集境界であり、
 * 普通の親子階層は scope を作らない。
 * Surface View は同じ Topology を表示・配置する方式である。
 * その保存値は MapSurface の `kind` / `layout` / `surfaceView` / `nodeViews` である。
 * `relationIds` は GraphLink の id である。
 *
 * ここで定義: ScopeSurfaceRecords — この保存形を往復するレコード束。
 * 親子の `parentId` / `children` は tree 側に残り、この束には載せない。
 */
import type {
  MapScope,
  MapSurface,
  SurfaceKind,
  SurfaceLayout,
  SurfaceNodeView,
} from "../../shared/types";

const SURFACE_KINDS = new Set<SurfaceKind>(["tree", "system", "scatter", "logic-chart", "timeline", "lane", "mindmap"]);
const SURFACE_LAYOUTS = new Set<SurfaceLayout>(["tree", "flow-lr", "scatter", "logic-chart", "timeline", "lane", "mindmap"]);
const DIRECTIONS = new Set<SavedSurfaceView["direction"]>(["left/right", "left", "right", "up/down", "up", "down"]);
const SPACES = new Set<SavedSurfaceView["space"]>(["tight", "normal", "loose"]);
const SHAPES = new Set<NonNullable<SurfaceNodeView["shape"]>>(["rect", "diamond", "rounded"]);

/** ここで定義: MapSurface.surfaceView の保存形。direction と space だけを持つ。 */
export interface SavedSurfaceView {
  direction: "left/right" | "left" | "right" | "up/down" | "up" | "down";
  space: "tight" | "normal" | "loose";
}

/** 認知境界 1 件。保存辞書のキーと MapScope のスカラー項目。 */
export interface ScopeRecord {
  key: string;
  id: string;
  label: string;
  primarySurfaceId?: string;
}

/**
 * ここで定義: MapScope.rootNodeIds の 1 要素。
 * 認知境界が列挙する node であり、親子 edge ではない。
 */
export interface ScopeRootRecord {
  scopeKey: string;
  nodeId: string;
  order: number;
}

/**
 * ここで定義: MapScope.relationIds の 1 要素。
 * GraphLink の id であり、親子 edge ではない。
 */
export interface ScopeRelationRecord {
  scopeKey: string;
  relationId: string;
  order: number;
}

/** Surface View の保存 1 件。MapSurface のスカラー項目と surfaceView。 */
export interface SurfaceRecord {
  key: string;
  id: string;
  scopeId: string;
  kind: SurfaceKind;
  layout: SurfaceLayout;
  surfaceView?: SavedSurfaceView;
  /** ここで定義: 保存オブジェクトに nodeViews があったか。空オブジェクトと欠落を区別する。 */
  nodeViewsPresent: boolean;
}

/**
 * ここで定義: MapSurface.nodeViews の 1 要素。
 * node の Layout 座標であり、親子 edge ではない。
 */
export interface SurfaceNodeViewRecord {
  surfaceKey: string;
  nodeId: string;
  x?: number;
  y?: number;
  flowCol?: number;
  flowRow?: number;
  shape?: "rect" | "diamond" | "rounded";
}

/** ここで定義: scope と surface の保存形を往復するレコード束。 */
export interface ScopeSurfaceRecords {
  /** ここで定義: 保存 JSON に scopes があったか。無ければ組み立てでも欠落のまま。 */
  scopesPresent: boolean;
  /** ここで定義: 保存 JSON に surfaces があったか。無ければ組み立てでも欠落のまま。 */
  surfacesPresent: boolean;
  scopes: readonly ScopeRecord[];
  scopeRoots: readonly ScopeRootRecord[];
  scopeRelations: readonly ScopeRelationRecord[];
  surfaces: readonly SurfaceRecord[];
  surfaceNodeViews: readonly SurfaceNodeViewRecord[];
}

/** AppState のうち、このモジュールが読む scope と surface。 */
export interface ScopeSurfaceState {
  scopes?: Record<string, MapScope>;
  surfaces?: Record<string, MapSurface>;
}

/**
 * 保存してある scope と surface をレコードにする。入力は変えない。
 * 引数に node の親子があっても読まない。
 */
export function extractScopeSurfaceRecords(state: object): ScopeSurfaceRecords {
  if (!isObject(state)) {
    throw new Error("state must be an object.");
  }
  const source = state as ScopeSurfaceState;
  const scopesPresent = source.scopes !== undefined;
  const surfacesPresent = source.surfaces !== undefined;
  const scopes: ScopeRecord[] = [];
  const scopeRoots: ScopeRootRecord[] = [];
  const scopeRelations: ScopeRelationRecord[] = [];
  const surfaces: SurfaceRecord[] = [];
  const surfaceNodeViews: SurfaceNodeViewRecord[] = [];

  if (scopesPresent) {
    for (const [key, raw] of Object.entries(requireDictionary(source.scopes, "scopes"))) {
      const scopeKey = requireId(key, "scope key");
      if (!isObject(raw)) {
        throw new Error(`Scope ${scopeKey} must be an object.`);
      }
      const source = raw as MapScope;
      const record: ScopeRecord = {
        key: scopeKey,
        id: requireId(source.id, `scope ${scopeKey} id`),
        label: requireString(source.label, `scope ${scopeKey} label`),
      };
      const primarySurfaceId = optionalId(source.primarySurfaceId, `scope ${scopeKey} primarySurfaceId`);
      if (primarySurfaceId !== undefined) {
        record.primarySurfaceId = primarySurfaceId;
      }
      scopes.push(record);
      requireArray(source.rootNodeIds, `scope ${scopeKey} rootNodeIds`).forEach((nodeId, order) => {
        scopeRoots.push({ scopeKey, nodeId: requireId(nodeId, `scope ${scopeKey} root node`), order });
      });
      requireArray(source.relationIds, `scope ${scopeKey} relationIds`).forEach((relationId, order) => {
        scopeRelations.push({
          scopeKey,
          relationId: requireId(relationId, `scope ${scopeKey} relation`),
          order,
        });
      });
    }
  }

  if (surfacesPresent) {
    for (const [key, raw] of Object.entries(requireDictionary(source.surfaces, "surfaces"))) {
      const surfaceKey = requireId(key, "surface key");
      if (!isObject(raw)) {
        throw new Error(`Surface ${surfaceKey} must be an object.`);
      }
      const source = raw as MapSurface;
      const record: SurfaceRecord = {
        key: surfaceKey,
        id: requireId(source.id, `surface ${surfaceKey} id`),
        scopeId: requireId(source.scopeId, `surface ${surfaceKey} scopeId`),
        kind: requireKind(source.kind, surfaceKey),
        layout: requireLayout(source.layout, surfaceKey),
        nodeViewsPresent: source.nodeViews !== undefined,
      };
      const surfaceView = readSurfaceView(surfaceKey, source.surfaceView);
      if (surfaceView !== undefined) {
        record.surfaceView = surfaceView;
      }
      surfaces.push(record);
      if (source.nodeViews !== undefined) {
        for (const [nodeId, view] of Object.entries(requireDictionary(source.nodeViews, `surface ${surfaceKey} nodeViews`))) {
          surfaceNodeViews.push(readNodeView(surfaceKey, nodeId, view));
        }
      }
    }
  }

  return { scopesPresent, surfacesPresent, scopes, scopeRoots, scopeRelations, surfaces, surfaceNodeViews };
}

/** レコードを AppState の scopes / surfaces へ戻す。レコードは変えない。 */
export function assembleScopeSurface(records: ScopeSurfaceRecords): ScopeSurfaceState {
  if (!isObject(records)) {
    throw new Error("records must be an object.");
  }
  const scopesPresent = requireBoolean(records.scopesPresent, "scopesPresent");
  const surfacesPresent = requireBoolean(records.surfacesPresent, "surfacesPresent");
  const scopeRows = requireArray(records.scopes, "scopes");
  const rootRows = requireArray(records.scopeRoots, "scopeRoots");
  const relationRows = requireArray(records.scopeRelations, "scopeRelations");
  const surfaceRows = requireArray(records.surfaces, "surfaces");
  const viewRows = requireArray(records.surfaceNodeViews, "surfaceNodeViews");

  if (!scopesPresent && (scopeRows.length > 0 || rootRows.length > 0 || relationRows.length > 0)) {
    throw new Error("Scope records exist while scopes are absent.");
  }
  if (!surfacesPresent && (surfaceRows.length > 0 || viewRows.length > 0)) {
    throw new Error("Surface records exist while surfaces are absent.");
  }

  const assembled: ScopeSurfaceState = {};
  if (scopesPresent) {
    const scopes: Record<string, MapScope> = {};
    const knownScopes = new Set<string>();
    for (const row of scopeRows) {
      const key = requireId(row.key, "scope key");
      if (knownScopes.has(key)) {
        throw new Error(`Duplicate scope: ${key}`);
      }
      knownScopes.add(key);
      const scope: MapScope = {
        id: requireId(row.id, `scope ${key} id`),
        label: requireString(row.label, `scope ${key} label`),
        rootNodeIds: [],
        relationIds: [],
      };
      const primarySurfaceId = optionalId(row.primarySurfaceId, `scope ${key} primarySurfaceId`);
      if (primarySurfaceId !== undefined) {
        scope.primarySurfaceId = primarySurfaceId;
      }
      scopes[key] = scope;
    }
    for (const row of ordered(rootRows)) {
      const scopeKey = requireId(row.scopeKey, "scope root scopeKey");
      const scope = scopes[scopeKey];
      if (!scope) {
        throw new Error(`Scope root refers to a missing scope: ${scopeKey}`);
      }
      requireOrder(row.order, `scope ${scopeKey} root order`);
      scope.rootNodeIds.push(requireId(row.nodeId, `scope ${scopeKey} root node`));
    }
    for (const row of ordered(relationRows)) {
      const scopeKey = requireId(row.scopeKey, "scope relation scopeKey");
      const scope = scopes[scopeKey];
      if (!scope) {
        throw new Error(`Scope relation refers to a missing scope: ${scopeKey}`);
      }
      requireOrder(row.order, `scope ${scopeKey} relation order`);
      scope.relationIds.push(requireId(row.relationId, `scope ${scopeKey} relation`));
    }
    assembled.scopes = scopes;
  }

  if (surfacesPresent) {
    const surfaces: Record<string, MapSurface> = {};
    const nodeViewsPresent = new Map<string, boolean>();
    for (const row of surfaceRows) {
      const key = requireId(row.key, "surface key");
      if (Object.prototype.hasOwnProperty.call(surfaces, key)) {
        throw new Error(`Duplicate surface: ${key}`);
      }
      const surface: MapSurface = {
        id: requireId(row.id, `surface ${key} id`),
        scopeId: requireId(row.scopeId, `surface ${key} scopeId`),
        kind: requireKind(row.kind, key),
        layout: requireLayout(row.layout, key),
      };
      const surfaceView = readSurfaceView(key, row.surfaceView);
      if (surfaceView !== undefined) {
        surface.surfaceView = surfaceView;
      }
      const present = requireBoolean(row.nodeViewsPresent, `surface ${key} nodeViewsPresent`);
      if (present) {
        surface.nodeViews = {};
      }
      nodeViewsPresent.set(key, present);
      surfaces[key] = surface;
    }
    for (const row of viewRows) {
      const surfaceKey = requireId(row.surfaceKey, "node view surfaceKey");
      const surface = surfaces[surfaceKey];
      if (!surface) {
        throw new Error(`Surface node view refers to a missing surface: ${surfaceKey}`);
      }
      if (nodeViewsPresent.get(surfaceKey) !== true) {
        throw new Error(`Surface ${surfaceKey} has node views while nodeViews is absent.`);
      }
      const nodeId = requireId(row.nodeId, `surface ${surfaceKey} node view`);
      if (Object.prototype.hasOwnProperty.call(surface.nodeViews, nodeId)) {
        throw new Error(`Duplicate node view ${nodeId} on ${surfaceKey}`);
      }
      surface.nodeViews![nodeId] = nodeViewFromRecord(surfaceKey, row);
    }
    assembled.surfaces = surfaces;
  }

  return assembled;
}

function ordered<T extends { order: number }>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => left.row.order - right.row.order || left.index - right.index)
    .map((item) => item.row);
}

function nodeViewFromRecord(surfaceKey: string, row: SurfaceNodeViewRecord): SurfaceNodeView {
  const view: SurfaceNodeView = {};
  copyCoordinate(view, "x", row.x, surfaceKey, row.nodeId);
  copyCoordinate(view, "y", row.y, surfaceKey, row.nodeId);
  copyCoordinate(view, "flowCol", row.flowCol, surfaceKey, row.nodeId);
  copyCoordinate(view, "flowRow", row.flowRow, surfaceKey, row.nodeId);
  if (row.shape !== undefined) {
    if (!SHAPES.has(row.shape)) {
      throw new Error(`Invalid shape on ${row.nodeId} of ${surfaceKey}.`);
    }
    view.shape = row.shape;
  }
  return view;
}

function readNodeView(surfaceKey: string, nodeId: string, raw: unknown): SurfaceNodeViewRecord {
  if (!isObject(raw)) {
    throw new Error(`Surface node view ${nodeId} on ${surfaceKey} must be an object.`);
  }
  const source = raw as SurfaceNodeView;
  const record: SurfaceNodeViewRecord = {
    surfaceKey,
    nodeId: requireId(nodeId, `surface ${surfaceKey} node view`),
  };
  copyCoordinate(record, "x", source.x, surfaceKey, nodeId);
  copyCoordinate(record, "y", source.y, surfaceKey, nodeId);
  copyCoordinate(record, "flowCol", source.flowCol, surfaceKey, nodeId);
  copyCoordinate(record, "flowRow", source.flowRow, surfaceKey, nodeId);
  if (source.shape !== undefined) {
    if (!SHAPES.has(source.shape)) {
      throw new Error(`Invalid shape on ${nodeId} of ${surfaceKey}.`);
    }
    record.shape = source.shape;
  }
  return record;
}

function readSurfaceView(surfaceKey: string, raw: unknown): SavedSurfaceView | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isObject(raw)) {
    throw new Error(`Surface ${surfaceKey} surfaceView must be an object.`);
  }
  const source = raw as SavedSurfaceView;
  if (!DIRECTIONS.has(source.direction) || !SPACES.has(source.space)) {
    throw new Error(`Surface ${surfaceKey} has an invalid surfaceView.`);
  }
  return { direction: source.direction, space: source.space };
}

function copyCoordinate(
  target: SurfaceNodeView,
  field: "x" | "y" | "flowCol" | "flowRow",
  value: unknown,
  surfaceKey: string,
  nodeId: string,
): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Surface node view ${nodeId} on ${surfaceKey} has an invalid ${field}.`);
  }
  target[field] = value;
}

function requireKind(value: unknown, surfaceKey: string): SurfaceKind {
  if (!SURFACE_KINDS.has(value as SurfaceKind)) {
    throw new Error(`Surface ${surfaceKey} has an invalid kind.`);
  }
  return value as SurfaceKind;
}

function requireLayout(value: unknown, surfaceKey: string): SurfaceLayout {
  if (!SURFACE_LAYOUTS.has(value as SurfaceLayout)) {
    throw new Error(`Surface ${surfaceKey} has an invalid layout.`);
  }
  return value as SurfaceLayout;
}

function requireDictionary(value: unknown, name: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray<T>(value: readonly T[] | undefined, name: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean.`);
  }
  return value;
}

function requireOrder(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return value;
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function optionalId(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireId(value, label);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
