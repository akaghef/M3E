import fs from "fs";
import path from "path";
import type {
  AppState,
  CloudSyncTransport,
  PullResult,
  PushResult,
  SavedDoc,
  SyncStatus,
} from "../shared/types";
import { createConflictBackup } from "./conflict_backup";

// ---------------------------------------------------------------------------
// Conflict detection (shared logic)
// ---------------------------------------------------------------------------

/**
 * Detect cloud conflict using docVersion (monotonic integer) as primary,
 * with savedAt timestamp as fallback for backward compatibility.
 *
 * Returns true when the cloud document has been modified since the client
 * last pulled (i.e., the client's base version/timestamp does not match
 * the cloud's current version/timestamp).
 */
export function detectCloudConflict(
  existingCloudSavedAt: string | null,
  baseSavedAt: string | null,
  forcePush: boolean,
  cloudDocVersion?: number | null,
  baseDocVersion?: number | null,
): boolean {
  if (forcePush) {
    return false;
  }

  // Prefer docVersion-based comparison when both sides provide it
  if (cloudDocVersion != null && baseDocVersion != null) {
    return cloudDocVersion !== baseDocVersion;
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

interface FileDoc extends SavedDoc {
  docVersion?: number;
}

export class FileTransport implements CloudSyncTransport {
  readonly mode = "file-mirror";

  constructor(private readonly dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private docPath(docId: string): string {
    const safeId = docId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this.dir, `${safeId}.json`);
  }

  private readDoc(filePath: string): FileDoc | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as FileDoc;
    if (!parsed || parsed.version !== 1 || !parsed.state) {
      return null;
    }
    return parsed;
  }

  async push(docId: string, doc: SavedDoc, baseSavedAt: string | null, force: boolean, baseDocVersion?: number | null): Promise<PushResult> {
    const filePath = this.docPath(docId);
    const existing = this.readDoc(filePath);

    if (detectCloudConflict(
      existing?.savedAt ?? null,
      baseSavedAt,
      force,
      existing?.docVersion ?? null,
      baseDocVersion ?? null,
    )) {
      return {
        ok: false,
        savedAt: existing?.savedAt ?? "",
        documentId: docId,
        forced: false,
        conflict: true,
        cloudSavedAt: existing?.savedAt ?? null,
        cloudDocVersion: existing?.docVersion ?? undefined,
        remoteState: existing?.state ?? undefined,
        error: "Cloud conflict detected.",
      };
    }

    // Increment docVersion: if existing has one, increment it; otherwise start at 1
    const nextDocVersion = (existing?.docVersion ?? 0) + 1;

    const payload: FileDoc = {
      version: 1,
      savedAt: doc.savedAt || new Date().toISOString(),
      state: doc.state,
      docVersion: nextDocVersion,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return {
      ok: true,
      savedAt: payload.savedAt,
      documentId: docId,
      forced: force,
      cloudDocVersion: nextDocVersion,
    };
  }

  async pull(docId: string): Promise<PullResult> {
    const filePath = this.docPath(docId);
    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        documentId: docId,
        error: "Cloud document not found.",
      };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as FileDoc;
    if (!parsed || parsed.version !== 1 || !parsed.state) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        documentId: docId,
        error: "Cloud document has unsupported format.",
      };
    }

    return {
      ok: true,
      version: parsed.version,
      savedAt: parsed.savedAt || fs.statSync(filePath).mtime.toISOString(),
      state: parsed.state,
      documentId: docId,
      docVersion: parsed.docVersion ?? undefined,
    };
  }

  async status(docId: string): Promise<SyncStatus> {
    const filePath = this.docPath(docId);
    const exists = fs.existsSync(filePath);
    const cloudDoc = exists ? this.readDoc(filePath) : null;
    return {
      ok: true,
      enabled: true,
      mode: this.mode,
      documentId: docId,
      exists,
      cloudSavedAt: cloudDoc?.savedAt ?? null,
      cloudDocVersion: cloudDoc?.docVersion ?? null,
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
  doc_version: number;
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
  private readonly tableName = "documents";

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

  async push(docId: string, doc: SavedDoc, baseSavedAt: string | null, force: boolean, baseDocVersion?: number | null): Promise<PushResult> {
    const client = await this.getClient();
    const savedAt = doc.savedAt || new Date().toISOString();

    // Fetch existing for conflict check and version increment
    const { data: existing, error: fetchErr } = await client
      .from(this.tableName)
      .select("saved_at,doc_version,state")
      .eq("id", docId)
      .maybeSingle();

    if (fetchErr) {
      return {
        ok: false,
        savedAt: "",
        documentId: docId,
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
        existing.doc_version ?? null,
        baseDocVersion ?? null,
      );
      if (hasConflict) {
        return {
          ok: false,
          savedAt: existing.saved_at,
          documentId: docId,
          forced: false,
          conflict: true,
          cloudSavedAt: existing.saved_at,
          cloudDocVersion: existing.doc_version ?? undefined,
          remoteState: existing.state as unknown as AppState,
          error: "Cloud conflict detected.",
        };
      }
    }

    // Increment docVersion
    const nextDocVersion = ((existing?.doc_version as number) ?? 0) + 1;

    // Upsert the document
    const { error: upsertErr } = await client
      .from(this.tableName)
      .upsert(
        {
          id: docId,
          version: doc.version,
          doc_version: nextDocVersion,
          saved_at: savedAt,
          state: doc.state as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .eq("id", docId)
      .single();

    if (upsertErr) {
      return {
        ok: false,
        savedAt: "",
        documentId: docId,
        forced: force,
        error: `Supabase upsert error: ${upsertErr.message}`,
      };
    }

    return {
      ok: true,
      savedAt,
      documentId: docId,
      forced: force,
      cloudDocVersion: nextDocVersion,
    };
  }

  async pull(docId: string): Promise<PullResult> {
    const client = await this.getClient();

    const { data, error } = await client
      .from(this.tableName)
      .select("*")
      .eq("id", docId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        documentId: docId,
        error: `Supabase fetch error: ${error.message}`,
      };
    }

    if (!data) {
      return {
        ok: false,
        version: 0,
        savedAt: "",
        state: {} as AppState,
        documentId: docId,
        error: "Cloud document not found.",
      };
    }

    return {
      ok: true,
      version: data.version,
      savedAt: data.saved_at,
      state: data.state as unknown as AppState,
      documentId: docId,
      docVersion: data.doc_version ?? undefined,
    };
  }

  async status(docId: string): Promise<SyncStatus> {
    const client = await this.getClient();

    const { data, error } = await client
      .from(this.tableName)
      .select("saved_at,doc_version")
      .eq("id", docId)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        enabled: true,
        mode: this.mode,
        documentId: docId,
        exists: false,
        cloudSavedAt: null,
        lastSyncedAt: null,
      };
    }

    return {
      ok: true,
      enabled: true,
      mode: this.mode,
      documentId: docId,
      exists: !!data,
      cloudSavedAt: data?.saved_at ?? null,
      cloudDocVersion: data?.doc_version ?? null,
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
  getLocalState: () => Promise<SavedDoc | null>;
  /** Return the current document ID. */
  getDocId: () => string;
  /** Return the current baseSavedAt for conflict detection. */
  getBaseSavedAt: () => string | null;
  /** Return the current baseDocVersion for conflict detection. */
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
      const doc = await callbacks.getLocalState();
      if (!doc) return;

      const docId = callbacks.getDocId();
      const baseSavedAt = callbacks.getBaseSavedAt();
      const baseDocVersion = callbacks.getBaseDocVersion();

      const result = await withRetry(
        () => transport.push(docId, doc, baseSavedAt, false, baseDocVersion),
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
            doc.state,
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
      const docId = callbacks.getDocId();
      const result = await withRetry(
        () => transport.pull(docId),
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
  docId: string,
  doc: SavedDoc,
  baseSavedAt: string | null,
  force: boolean,
  dataDir: string,
  baseDocVersion?: number | null,
): Promise<PushResult> {
  const result = await withRetry(
    () => transport.push(docId, doc, baseSavedAt, force, baseDocVersion),
    (err) => {
      const msg = (err as Error)?.message ?? "";
      return !msg.includes("conflict") && !msg.includes("Conflict");
    },
  );

  if (!result.ok && result.conflict) {
    // Save local state as conflict backup before caller pulls remote
    createConflictBackup(dataDir, docId, doc.state, "cloud-conflict-push");
  }

  return result;
}
