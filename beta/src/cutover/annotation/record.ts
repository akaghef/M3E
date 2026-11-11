/**
 * `AppState.annotations` は map 上の注釈である。
 * 正本の型は `beta/src/shared/types.ts` の `MapAnnotation`
 * （`PenAnnotation | TextAnnotation`）。
 * node でも edge でも GraphLink でもない。scope は任意の所属。
 *
 * Annotation Panel は Pen / Highlighter / Date label / Eraser / Select の
 * Panel であり、このレコードではない。Highlighter は別 kind を持たず
 * `kind: "pen"` のまま stroke・strokeWidth・opacity に載る。
 * Date label は `kind: "text"` かつ `variant: "date"` である。
 *
 * ここで定義: AnnotationRecord — `MapAnnotation` 1件と、
 * `AppState.annotations` の辞書キー。キーと `id` は別フィールド。
 * ここで定義: AnnotationLedger — フィールドの不在と AnnotationRecord の列。
 * `absent` が true のとき列は空で、`annotations` が無い状態を表す。
 */
import type { AppState, MapAnnotation, PenAnnotation, PenPoint, TextAnnotation } from "../../shared/types";

export interface PenAnnotationRecord {
  readonly key: string;
  readonly id: string;
  readonly kind: "pen";
  readonly scopeId?: string;
  readonly d: string;
  readonly points: readonly PenPoint[];
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly opacity?: number;
  readonly createdAt?: string;
}

export interface TextAnnotationRecord {
  readonly key: string;
  readonly id: string;
  readonly kind: "text";
  readonly scopeId?: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fill: string;
  readonly fontSize: number;
  readonly fontWeight?: number;
  readonly variant?: "date" | "label";
  readonly createdAt?: string;
}

export type AnnotationRecord = PenAnnotationRecord | TextAnnotationRecord;

export interface AnnotationLedger {
  readonly absent: boolean;
  readonly records: readonly AnnotationRecord[];
}

/** `AppState.annotations` を AnnotationLedger に写す。引数は変えない。 */
export function recordAnnotations(annotations: AppState["annotations"]): AnnotationLedger {
  if (annotations === undefined) {
    return { absent: true, records: [] };
  }
  if (annotations === null || typeof annotations !== "object" || Array.isArray(annotations)) {
    throw new Error("annotations must be a record.");
  }
  const records: AnnotationRecord[] = [];
  for (const [key, annotation] of Object.entries(annotations)) {
    records.push(copyRecord(key, annotation));
  }
  return { absent: false, records };
}

/** AnnotationLedger から `AppState.annotations` を組み立てる。台帳は変えない。 */
export function restoreAnnotations(ledger: AnnotationLedger): AppState["annotations"] {
  if (ledger.absent) {
    if (ledger.records.length !== 0) {
      throw new Error("Absent annotations cannot carry records.");
    }
    return undefined;
  }
  const restored: Record<string, MapAnnotation> = {};
  const seen = new Set<string>();
  for (const record of ledger.records) {
    if (seen.has(record.key)) {
      throw new Error(`Duplicate annotation key: ${record.key}`);
    }
    seen.add(record.key);
    restored[record.key] = annotationFromRecord(record);
  }
  return restored;
}

function copyRecord(key: string, annotation: MapAnnotation): AnnotationRecord {
  switch (annotation.kind) {
    case "pen":
      return copyPen(key, annotation);
    case "text":
      return copyText(key, annotation);
    default: {
      const unexpected: never = annotation;
      throw new Error(`Unknown annotation kind: ${JSON.stringify(unexpected)}`);
    }
  }
}

function copyPen(key: string, annotation: PenAnnotation): PenAnnotationRecord {
  return {
    key,
    id: requireString(annotation.id, "pen id"),
    kind: "pen",
    ...optionalString("scopeId", annotation.scopeId),
    d: requireString(annotation.d, "pen d"),
    points: copyPoints(annotation.points),
    stroke: requireString(annotation.stroke, "pen stroke"),
    strokeWidth: requireFinite(annotation.strokeWidth, "pen strokeWidth"),
    ...optionalFinite("opacity", annotation.opacity),
    ...optionalString("createdAt", annotation.createdAt),
  };
}

function copyText(key: string, annotation: TextAnnotation): TextAnnotationRecord {
  return {
    key,
    id: requireString(annotation.id, "text id"),
    kind: "text",
    ...optionalString("scopeId", annotation.scopeId),
    x: requireFinite(annotation.x, "text x"),
    y: requireFinite(annotation.y, "text y"),
    text: requireString(annotation.text, "text"),
    fill: requireString(annotation.fill, "text fill"),
    fontSize: requireFinite(annotation.fontSize, "text fontSize"),
    ...optionalFinite("fontWeight", annotation.fontWeight),
    ...optionalVariant(annotation.variant),
    ...optionalString("createdAt", annotation.createdAt),
  };
}

function annotationFromRecord(record: AnnotationRecord): MapAnnotation {
  switch (record.kind) {
    case "pen":
      return {
        id: record.id,
        kind: "pen",
        ...optionalString("scopeId", record.scopeId),
        d: record.d,
        points: copyPoints(record.points),
        stroke: record.stroke,
        strokeWidth: record.strokeWidth,
        ...optionalFinite("opacity", record.opacity),
        ...optionalString("createdAt", record.createdAt),
      };
    case "text":
      return {
        id: record.id,
        kind: "text",
        ...optionalString("scopeId", record.scopeId),
        x: record.x,
        y: record.y,
        text: record.text,
        fill: record.fill,
        fontSize: record.fontSize,
        ...optionalFinite("fontWeight", record.fontWeight),
        ...optionalVariant(record.variant),
        ...optionalString("createdAt", record.createdAt),
      };
    default: {
      const unexpected: never = record;
      throw new Error(`Unknown annotation kind: ${JSON.stringify(unexpected)}`);
    }
  }
}

function copyPoints(points: readonly PenPoint[]): PenPoint[] {
  if (!Array.isArray(points)) {
    throw new Error("Pen annotation points must be an array.");
  }
  return points.map((point, index) => {
    if (point === null || typeof point !== "object") {
      throw new Error(`Pen point ${index} must be an object.`);
    }
    return {
      x: requireFinite(point.x, `pen point ${index} x`),
      y: requireFinite(point.y, `pen point ${index} y`),
    };
  });
}

function optionalString<K extends string>(key: K, value: unknown): Partial<Record<K, string>> {
  if (value === undefined) {
    return {};
  }
  return { [key]: requireString(value, key) } as Record<K, string>;
}

function optionalFinite<K extends string>(key: K, value: unknown): Partial<Record<K, number>> {
  if (value === undefined) {
    return {};
  }
  return { [key]: requireFinite(value, key) } as Record<K, number>;
}

function optionalVariant(value: TextAnnotation["variant"]): { variant: "date" | "label" } | Record<string, never> {
  if (value === undefined) {
    return {};
  }
  if (value !== "date" && value !== "label") {
    throw new Error(`Invalid text variant: ${String(value)}`);
  }
  return { variant: value };
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}
