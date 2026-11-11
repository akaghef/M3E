/**
 * AppState の linear フィールド。
 * `linearNotesByScope` は scope id から linear-text 本文への写像（`Record<string, string>`）。
 * `linearTextFontScale` と `linearPanelWidth` は number で、map 単位。scope ごとではない。
 * viewer は読むときに font scale を 0.6–1.4、幅があるとき panel 幅を 220–10000 へ寄せる。
 * ここは保存値をそのまま往復し、その寄せはしない。
 *
 * ここで定義: LinearScopeBodyRecord — 1 scope の linear-text 本文。
 * ここで定義: body — `linearNotesByScope[scopeId]` の文字列。
 * ここで定義: LinearTextRecords — 本文レコード列と、map 単位の font scale / Panel 幅。
 * ここで定義: notesPresent — 抽出元に `linearNotesByScope` があったか。空の写像と未設定を区別する。
 */
import type { AppState } from "../../shared/types";

export type LinearTextFields = Pick<AppState, "linearNotesByScope" | "linearTextFontScale" | "linearPanelWidth">;

export interface LinearScopeBodyRecord {
  readonly scopeId: string;
  readonly body: string;
}

export interface LinearTextRecords {
  readonly bodies: readonly LinearScopeBodyRecord[];
  readonly notesPresent: boolean;
  readonly linearTextFontScale?: number;
  readonly linearPanelWidth?: number;
}

/** scope ごとの本文と、map 単位の font scale / Panel 幅をレコードにする。引数は変えない。 */
export function toLinearTextRecords(fields: LinearTextFields): LinearTextRecords {
  const notes = fields.linearNotesByScope;
  const fontScale = optionalFinite(fields.linearTextFontScale, "linearTextFontScale");
  const panelWidth = optionalFinite(fields.linearPanelWidth, "linearPanelWidth");
  return {
    bodies: notes === undefined ? [] : bodiesFromNotes(notes),
    notesPresent: notes !== undefined,
    ...(fontScale !== undefined ? { linearTextFontScale: fontScale } : {}),
    ...(panelWidth !== undefined ? { linearPanelWidth: panelWidth } : {}),
  };
}

/** レコードを AppState の linear フィールドへ戻す。本文は scope id ごとに分かれ、引数は変えない。 */
export function fromLinearTextRecords(records: LinearTextRecords): LinearTextFields {
  const bodies = requireArray(records.bodies, "bodies");
  if (records.notesPresent !== true && records.notesPresent !== false) {
    throw new Error("notesPresent must be a boolean.");
  }
  if (!records.notesPresent && bodies.length > 0) {
    throw new Error("linearNotesByScope is absent, so bodies must be empty.");
  }

  const fields: LinearTextFields = {};
  if (records.notesPresent) {
    fields.linearNotesByScope = notesFromBodies(bodies);
  }
  const fontScale = optionalFinite(records.linearTextFontScale, "linearTextFontScale");
  const panelWidth = optionalFinite(records.linearPanelWidth, "linearPanelWidth");
  if (fontScale !== undefined) {
    fields.linearTextFontScale = fontScale;
  }
  if (panelWidth !== undefined) {
    fields.linearPanelWidth = panelWidth;
  }
  return fields;
}

function bodiesFromNotes(notes: Record<string, string>): LinearScopeBodyRecord[] {
  if (!isRecord(notes)) {
    throw new Error("linearNotesByScope must be a record of scope id to body.");
  }
  const bodies: LinearScopeBodyRecord[] = [];
  for (const [scopeId, body] of Object.entries(notes)) {
    bodies.push(bodyRecord(scopeId, body));
  }
  return bodies;
}

function notesFromBodies(bodies: readonly LinearScopeBodyRecord[]): Record<string, string> {
  const seen = new Set<string>();
  const notes: Record<string, string> = {};
  for (const record of bodies) {
    const { scopeId, body } = bodyRecord(record?.scopeId, record?.body);
    if (seen.has(scopeId)) {
      throw new Error(`Duplicate scope: ${scopeId}`);
    }
    seen.add(scopeId);
    notes[scopeId] = body;
  }
  return notes;
}

function bodyRecord(scopeId: unknown, body: unknown): LinearScopeBodyRecord {
  if (typeof scopeId !== "string" || scopeId.length === 0) {
    throw new Error("scope id must be a non-empty string.");
  }
  if (typeof body !== "string") {
    throw new Error(`body for ${scopeId} must be a string.`);
  }
  return { scopeId, body };
}

function optionalFinite(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function requireArray<T>(value: readonly T[] | undefined, name: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
