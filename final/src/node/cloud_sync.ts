import fs from "fs";
import path from "path";
import type {
  AppState,
  CloudSyncTransport,
  PullResult,
  PushResult,
  SavedMap,
  SyncStatus,
} from "../shared/types";
import { createConflictBackup } from "./conflict_backup";

// ---------------------------------------------------------------------------
// Conflict detection (shared logic)
// ---------------------------------------------------------------------------

/**
 * Detect cloud conflict using mapVersion (monotonic integer) as primary,
 * with savedAt timestamp as fallback for backward compatibility.
 *
 * Returns true when the cloud map has been modified since the client
 * last pulled (i.e., the client's base version/timestamp does not match
 * the cloud's current version/timestamp).
 */
export function detectCloudConflict(
  existingCloudSavedAt: string | null,
  baseSavedAt: string | null,
  forcePush: boolean,
  cloudMapVersion?: number | null,
  baseMapVersion?: number | null,
): boolean {
  if (forcePush) {
    return false;
  }

  // Prefer mapVersion-based comparison when both sides provide it
  if (cloudMapVersion != null && baseMapVersion != null) {
    return cloudMapVersion !== baseMapVersion;
  }

  // Fallback to savedAt timestamp comparison
  if (!existingCloudSavedAt || !baseSavedAt) {
    return false;
  }
  return existingCloudSavedAt !== baseSavedAt;
}

// ---------------------------------------------------------------------------
// Retry helper — exponential backoff
// ---------------------------------------------------------------------------

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff.
 * Does NOT retry on conflict (409-like) errors — only on transient failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  opts?: RetryOptions,
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs } = { ...DEFAULT_RETRY, ...opts };
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries || !isRetryable(err)) {
        throw err;
      }
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// FileTransport — file-based cloud sync (existing behaviour, now a class)
// ---------------------------------------------------------------------------

interface FileMap extends SavedMap {
  mapVersion?: number;
}

export class FileTransport implements CloudSyncTransport {
  readonly mode = "file-mirror";

  constructor(private readonly dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private mapPath(mapId: string): string {
    const safeId = mapId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this.dir, `${safeId}.json`);
  }

  private readDoc(filePath: string): FileMap | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as FileMap;
    if (!parsed || parsed.version !== 1 || !parsed.state) {
      return null;
    }
    return parsed;
  }

  async push(mapId: string, map: SavedMap, baseSavedAt: string | null, force: boolean, baseMapVersion?: number | null): Promise<PushResult> {
    const filePath = this.mapPath(mapId);
    const existing = this.readDoc(filePath);

    if (detectCloudConflict(
      existing?.savedAt ?? null,
      baseSavedAt,
      force,
      existing?.mapVersion ?? null,
      baseMapVersion ?? null,
    )) {
      return {
        ok: false,
        savedAt: existing?.savedAt ?? "",
        mapId: mapId,
        forced: false,
        conflict: true,
        cloudSavedAt: existing?.savedAt ?? null,
        cloudMapVersion: existing?.mapVersion ?? undefined,
        remoteState: existing?.state ?? undefined,
        error: "Cloud conflict detected.",
      };
    }

    // Increment mapVersion: if existing has one, increment it; otherwise start at 1
    const nextMapVersion = (existing?.mapVersion ?? 0) + 1;

    const payload: FileMap = {
      version: 1,
      savedAt: map.savedAt || new Date().toISOString(),
      state: map.state,
      mapVersion: nextMapVersion,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return {
      ok: true,
      savedAt: payload.savedAt,
      mapId: mapId,
      forced: force,
      cloudMapVersion: nextMapVersion,
    };
  }

  async pull(mapId: string): Promise<PullResult> {
    const filePath = this.mapPath(mapId);
    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        mapId: mapId,
        error: "Cloud map not found.",
      };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as FileMap;
    if (!parsed || parsed.version !== 1 || !parsed.state) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        mapId: mapId,
        error: "Cloud map has unsupported format.",
      };
    }

    return {
      ok: true,
      version: parsed.version,
      savedAt: parsed.savedAt || fs.statSync(filePath).mtime.toISOString(),
      state: parsed.state,
      mapId: mapId,
      mapVersion: parsed.mapVersion ?? undefined,
    };
  }

  async status(mapId: string): Promise<SyncStatus> {
    const filePath = this.mapPath(mapId);
    const exists = fs.existsSync(filePath);
    const cloudDoc = exists ? this.readDoc(filePath) : null;
    return {
      ok: true,
      enabled: true,
      mode: this.mode,
      mapId: mapId,
      exists,
      cloudSavedAt: cloudDoc?.savedAt ?? null,
      cloudMapVersion: cloudDoc?.mapVersion ?? null,
      lastSyncedAt: exists ? fs.statSync(filePath).mtime.toISOString() : null,
    };
  }
}

// ---------------------------------------------------------------------------
// SupabaseTransport — Supabase-backed cloud sync
// ---------------------------------------------------------------------------

/**
 * Supabase client type — we use dynamic import to avoid hard dependency.
 * At runtime, `@supabase/supabase-js` must be installed.
 */
interface SupabaseRow {
  id: string;
  version: number;
  map_version: number;
  saved_at: string;
  state: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseClientLike {
  from(table: string): SupabaseQueryBuilder;
}

interface SupabaseQueryBuilder {
  select(columns?: string): SupabaseFilterBuilder;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): SupabaseFilterBuilder;
  insert(values: Record<string, unknown>[]): SupabaseFilterBuilder;
}

interface SupabaseFilterBuilder {
  eq(column: string, value: unknown): SupabaseFilterBuilder;
  select(columns?: string): SupabaseFilterBuilder;
  single(): Promise<{ data: SupabaseRow | null; error: SupabaseError | null }>;
  maybeSingle(): Promise<{ data: SupabaseRow | null; error: SupabaseError | null }>;
  then?: unknown; // allow awaiting directly
}

interface SupabaseError {
  message: string;
  code?: string;
}

export class SupabaseTransport implements CloudSyncTransport {
  readonly mode = "supabase";
  private client: SupabaseClientLike | null = null;
  private readonly url: string;
  private readonly anonKey: string;
  private readonly tableName = "maps";

  constructor(url: string, anonKey: string) {
    this.url = url;
    this.anonKey = anonKey;
  }

  private async getClient(): Promise<SupabaseClientLike> {
    if (this.client) {
      return this.client;
    }
    // Dynamic import so the module is optional at build time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = await import("@supabase/supabase-js");
    this.client = createClient(this.url, this.anonKey) as unknown as SupabaseClientLike;
    return this.client;
  }

  async push(mapId: string, map: SavedMap, baseSavedAt: string | null, force: boolean, baseMapVersion?: number | null): Promise<PushResult> {
    const client = await this.getClient();
    const savedAt = map.savedAt || new Date().toISOString();

    // Fetch existing for conflict check and version increment
    const { data: existing, error: fetchErr } = await client
      .from(this.tableName)
      .select("saved_at,map_version,state")
      .eq("id", mapId)
      .maybeSingle();

    if (fetchErr) {
      return {
        ok: false,
        savedAt: "",
        mapId: mapId,
        forced: false,
        error: `Supabase fetch error: ${fetchErr.message}`,
      };
    }

    // Conflict check (unless forcing)
    if (!force && existing) {
      const hasConflict = detectCloudConflict(
        existing.saved_at,
        baseSavedAt,
        false,
        existing.map_version ?? null,
        baseMapVersion ?? null,
      );
      if (hasConflict) {
        return {
          ok: false,
          savedAt: existing.saved_at,
          mapId: mapId,
          forced: false,
          conflict: true,
          cloudSavedAt: existing.saved_at,
          cloudMapVersion: existing.map_version ?? undefined,
          remoteState: existing.state as unknown as AppState,
          error: "Cloud conflict detected.",
        };
      }
    }

    // Increment mapVersion
    const nextMapVersion = ((existing?.map_version as number) ?? 0) + 1;

    // Upsert the map
    // Note: Do not chain .eq().single() after upsert — Supabase v2 upsert
    // already identifies the row via onConflict, and .single() can error
    // if the response shape doesn't contain exactly one row.
    const { error: upsertErr } = await client
      .from(this.tableName)
      .upsert(
        {
          id: mapId,
          version: map.version,
          map_version: nextMapVersion,
          saved_at: savedAt,
          state: map.state as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (upsertErr) {
      return {
        ok: false,
        savedAt: "",
        mapId: mapId,
        forced: force,
        error: `Supabase upsert error: ${upsertErr.message}`,
      };
    }

    return {
      ok: true,
      savedAt,
      mapId: mapId,
      forced: force,
      cloudMapVersion: nextMapVersion,
    };
  }

  async pull(mapId: string): Promise<PullResult> {
    const client = await this.getClient();

    const { data, error } = await client
      .from(this.tableName)
      .select("*")
      .eq("id", mapId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        mapId: mapId,
        error: `Supabase fetch error: ${error.message}`,
      };
    }

    if (!data) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        mapId: mapId,
        error: "Cloud map not found.",
      };
    }

    return {
      ok: true,
      version: data.version,
      savedAt: data.saved_at,
      state: data.state as unknown as AppState,
      mapId: mapId,
      mapVersion: data.map_version ?? undefined,
    };
  }

  async status(mapId: string): Promise<SyncStatus> {
    const client = await this.getClient();

    const { data, error } = await client
      .from(this.tableName)
      .select("saved_at,map_version")
      .eq("id", mapId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        enabled: true,
        mode: this.mode,
        mapId: mapId,
        exists: false,
        cloudSavedAt: null,
        lastSyncedAt: null,
      };
    }

    return {
      ok: true,
      enabled: true,
      mode: this.mode,
      mapId: mapId,
      exists: !!data,
      cloudSavedAt: data?.saved_at ?? null,
      cloudMapVersion: data?.map_version ?? null,
      lastSyncedAt: data?.saved_at ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

export interface CloudSyncConfig {
  enabled: boolean;
  transport: CloudSyncTransport | null;
  autoSync: boolean;
  autoSyncIntervalMs: number;
}

export function loadCloudSyncConfig(): CloudSyncConfig {
  const enabled = process.env.M3E_CLOUD_SYNC === "1";
  const autoSync = process.env.M3E_AUTO_SYNC === "1";
  const autoSyncIntervalMs = Number(process.env.M3E_AUTO_SYNC_INTERVAL_MS) || 30000;

  if (!enabled) {
    return { enabled: false, transport: null, autoSync: false, autoSyncIntervalMs };
  }

  const transportType = (process.env.M3E_CLOUD_TRANSPORT || "file").toLowerCase();

  if (transportType === "supabase") {
    const url = process.env.M3E_SUPABASE_URL;
    const anonKey = process.env.M3E_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      console.warn(
        "[cloud_sync] M3E_CLOUD_TRANSPORT=supabase but M3E_SUPABASE_URL or M3E_SUPABASE_ANON_KEY is missing. Falling back to disabled.",
      );
      return { enabled: false, transport: null, autoSync: false, autoSyncIntervalMs };
    }
    return { enabled: true, transport: new SupabaseTransport(url, anonKey), autoSync, autoSyncIntervalMs };
  }

  // Default: file transport
  const dir = process.env.M3E_CLOUD_DIR
    ? path.resolve(process.env.M3E_CLOUD_DIR)
    : path.join(process.env.M3E_DATA_DIR || ".", "cloud-sync");
  return { enabled: true, transport: new FileTransport(dir), autoSync, autoSyncIntervalMs };
}

// ---------------------------------------------------------------------------
// Auto Sync — periodic push with debounce
// ---------------------------------------------------------------------------

export interface AutoSyncHandle {
  stop(): void;
  /** Force an immediate push (resets the interval timer). */
  triggerNow(): void;
}

export interface AutoSyncCallbacks {
  /** Return the current local state to be pushed. */
  getLocalState: () => Promise<SavedMap | null>;
  /** Return the current map ID. */
  getDocId: () => string;
  /** Return the current baseSavedAt for conflict detection. */
  getBaseSavedAt: () => string | null;
  /** Return the current baseMapVersion for conflict detection. */
  getBaseDocVersion: () => number | null;
  /** Called when a push succeeds. */
  onPushSuccess?: (result: PushResult) => void;
  /** Called when a push fails with conflict. */
  onConflict?: (result: PushResult) => void;
  /** Called when a push fails with non-conflict error. */
  onError?: (error: string) => void;
  /** Called when initial pull succeeds. */
  onPullSuccess?: (result: PullResult) => void;
  /** Data directory for conflict backups. */
  dataDir?: string;
}

/**
 * Start automatic sync: pull on startup, then push at regular intervals.
 */
export function startAutoSync(
  transport: CloudSyncTransport,
  intervalMs: number,
  callbacks: AutoSyncCallbacks,
): AutoSyncHandle {
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const doPush = async (): Promise<void> => {
    if (stopped) return;
    try {
      const map = await callbacks.getLocalState();
      if (!map) return;

      const mapId = callbacks.getDocId();
      const baseSavedAt = callbacks.getBaseSavedAt();
      const baseMapVersion = callbacks.getBaseDocVersion();

      const result = await withRetry(
        () => transport.push(mapId, map, baseSavedAt, false, baseMapVersion),
        (err) => {
          const msg = (err as Error)?.message ?? "";
          // Do not retry conflicts
          return !msg.includes("conflict") && !msg.includes("Conflict");
        },
      );

      if (result.ok) {
        callbacks.onPushSuccess?.(result);
      } else if (result.conflict) {
        // Create conflict backup before notifying
        if (callbacks.dataDir) {
          createConflictBackup(
            callbacks.dataDir,
            callbacks.getDocId(),
            map.state,
            "auto-sync conflict",
          );
        }
        callbacks.onConflict?.(result);
      } else {
        callbacks.onError?.(result.error || "Push failed.");
      }
    } catch (err) {
      callbacks.onError?.((err as Error).message || "Auto-sync push error.");
    }
  };

  // Initial pull on startup
  const initialPull = async (): Promise<void> => {
    try {
      const mapId = callbacks.getDocId();
      const result = await withRetry(
        () => transport.pull(mapId),
        () => true, // retry all transient errors on pull
      );
      if (result.ok) {
        callbacks.onPullSuccess?.(result);
      }
    } catch (err) {
      callbacks.onError?.(`Initial pull failed: ${(err as Error).message}`);
    }
  };

  // Start: pull first, then begin periodic push
  initialPull().then(() => {
    if (stopped) return;
    timer = setInterval(doPush, intervalMs);
  });

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    triggerNow() {
      // Reset timer and push immediately
      if (timer) {
        clearInterval(timer);
      }
      doPush().then(() => {
        if (!stopped) {
          timer = setInterval(doPush, intervalMs);
        }
      });
    },
  };
}

/**
 * Stop auto sync.
 */
export function stopAutoSync(handle: AutoSyncHandle): void {
  handle.stop();
}

// ---------------------------------------------------------------------------
// Push with conflict backup — convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Push with automatic conflict backup creation.
 * When push returns a conflict (409), saves the local state as a backup
 * and returns the conflict result with remoteState for the caller to
 * decide how to proceed.
 */
export async function pushWithConflictBackup(
  transport: CloudSyncTransport,
  mapId: string,
  map: SavedMap,
  baseSavedAt: string | null,
  force: boolean,
  dataDir: string,
  baseMapVersion?: number | null,
): Promise<PushResult> {
  const result = await withRetry(
    () => transport.push(mapId, map, baseSavedAt, force, baseMapVersion),
    (err) => {
      const msg = (err as Error)?.message ?? "";
      return !msg.includes("conflict") && !msg.includes("Conflict");
    },
  );

  if (!result.ok && result.conflict) {
    // Save local state as conflict backup before caller pulls remote
    createConflictBackup(dataDir, mapId, map.state, "cloud-conflict-push");
  }

  return result;
}
