/**
 * GET `/api/maps/:mapId` が返す文書は `SavedMap` で、その本体は `state`
 * （Glossary: `AppState`、map 全体の state スナップショット）である。
 * 外側は `state` を含まない。
 *
 * コード上の所在:
 * - `version` と `savedAt` は `SavedMap` にあり、`loadSavedMapFromSqlite` が
 *   `maps.version` / `maps.saved_at` から読み、GET がそのまま返す。`version` は 1 のみ。
 * - `mapVersion` は `SavedMap` の任意フィールド。SQLite の GET 経路は付けない。
 *   cloud の保存文書と、viewer が GET 本文を `SavedMap & { mapVersion?: number }` として読む箇所にある。
 * - `tags` / `archived` / `pinned` / `source` は同じ `maps` 行の列で、
 *   `GET /api/maps` の `MapSummary` に出る。`GET /api/maps/:mapId` の現行実装は載せない。
 *   `source` が受理するのは `{ kind: "obsidian", path: string }` だけ。
 *
 * ここで定義: SavedMapEnvelope — 上記の外側。`state` は持たない。
 * ここで定義: SavedMapDocument — 外側と、引き数で受け取った `state` を一つに戻した文書。
 * この関数は `state` のプロパティを読まない。
 */
import type { MapSource } from "../../shared/home_types";

export type { MapSource };

export interface SavedMapEnvelope {
  version: 1;
  savedAt: string;
  mapVersion?: number;
  tags: readonly string[];
  archived: boolean;
  pinned: boolean;
  source?: MapSource;
}

export interface SavedMapDocument<State> {
  version: 1;
  savedAt: string;
  mapVersion?: number;
  tags: string[];
  archived: boolean;
  pinned: boolean;
  source?: MapSource;
  state: State;
}

export function assembleSavedMap<State>(envelope: SavedMapEnvelope, state: State): SavedMapDocument<State> {
  if (envelope.version !== 1) {
    throw new Error("Unsupported or invalid save format.");
  }
  if (typeof envelope.savedAt !== "string" || envelope.savedAt.length === 0) {
    throw new Error("savedAt must be a non-empty string.");
  }
  if (envelope.mapVersion !== undefined && (typeof envelope.mapVersion !== "number" || !Number.isFinite(envelope.mapVersion))) {
    throw new Error("mapVersion must be a finite number.");
  }
  if (!Array.isArray(envelope.tags) || envelope.tags.some((tag) => typeof tag !== "string")) {
    throw new Error("tags must be an array of strings.");
  }
  if (typeof envelope.archived !== "boolean") {
    throw new Error("archived must be a boolean.");
  }
  if (typeof envelope.pinned !== "boolean") {
    throw new Error("pinned must be a boolean.");
  }
  const source = envelope.source === undefined ? undefined : copySource(envelope.source);

  const document: SavedMapDocument<State> = {
    version: 1,
    savedAt: envelope.savedAt,
    tags: envelope.tags.slice(),
    archived: envelope.archived,
    pinned: envelope.pinned,
    state,
  };
  if (envelope.mapVersion !== undefined) {
    document.mapVersion = envelope.mapVersion;
  }
  if (source !== undefined) {
    document.source = source;
  }
  return document;
}

function copySource(source: MapSource): MapSource {
  if (source.kind !== "obsidian" || typeof source.path !== "string") {
    throw new Error("source must be an obsidian path binding.");
  }
  return { kind: "obsidian", path: source.path };
}
