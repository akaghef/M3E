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

// ---------------------------------------------------------------------------
// Conflict detection (shared logic)
// ---------------------------------------------------------------------------

export function detectCloudConflict(
  existingCloudSavedAt: string | null,
  baseSavedAt: string | null,
  forcePush: boolean,
): boolean {
  if (forcePush) {
    return false;
  }
  if (!existingCloudSavedAt || !baseSavedAt) {
    return false;
  }
  return existingCloudSavedAt !== baseSavedAt;
}

// ---------------------------------------------------------------------------
// FileTransport — file-based cloud sync (existing behaviour, now a class)
// ---------------------------------------------------------------------------

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

  private readDoc(filePath: string): SavedDoc | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as SavedDoc;
    if (!parsed || parsed.version !== 1 || !parsed.state) {
      return null;
    }
    return parsed;
  }

  async push(docId: string, doc: SavedDoc, baseSavedAt: string | null, force: boolean): Promise<PushResult> {
    const filePath = this.docPath(docId);
    const existing = this.readDoc(filePath);

    if (detectCloudConflict(existing?.savedAt ?? null, baseSavedAt, force)) {
      return {
        ok: false,
        savedAt: existing?.savedAt ?? "",
        documentId: docId,
        forced: false,
        conflict: true,
        cloudSavedAt: existing?.savedAt ?? null,
        error: "Cloud conflict detected.",
      };
    }

    const payload: SavedDoc = {
      version: 1,
      savedAt: doc.savedAt || new Date().toISOString(),
      state: doc.state,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return {
      ok: true,
      savedAt: payload.savedAt,
      documentId: docId,
      forced: force,
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

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as SavedDoc;
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

  async push(docId: string, doc: SavedDoc, baseSavedAt: string | null, force: boolean): Promise<PushResult> {
    const client = await this.getClient();
    const savedAt = doc.savedAt || new Date().toISOString();

    // Check for conflict if not forcing
    if (!force && baseSavedAt) {
      const { data: existing, error: fetchErr } = await client
        .from(this.tableName)
        .select("saved_at")
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

      if (existing && detectCloudConflict(existing.saved_at, baseSavedAt, false)) {
        return {
          ok: false,
          savedAt: existing.saved_at,
          documentId: docId,
          forced: false,
          conflict: true,
          cloudSavedAt: existing.saved_at,
          error: "Cloud conflict detected.",
        };
      }
    }

    // Upsert the document
    const { error: upsertErr } = await client
      .from(this.tableName)
      .upsert(
        {
          id: docId,
          version: doc.version,
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
    };
  }

  async status(docId: string): Promise<SyncStatus> {
    const client = await this.getClient();

    const { data, error } = await client
      .from(this.tableName)
      .select("saved_at")
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
}

export function loadCloudSyncConfig(): CloudSyncConfig {
  const enabled = process.env.M3E_CLOUD_SYNC === "1";
  if (!enabled) {
    return { enabled: false, transport: null };
  }

  const transportType = (process.env.M3E_CLOUD_TRANSPORT || "file").toLowerCase();

  if (transportType === "supabase") {
    const url = process.env.M3E_SUPABASE_URL;
    const anonKey = process.env.M3E_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      console.warn(
        "[cloud_sync] M3E_CLOUD_TRANSPORT=supabase but M3E_SUPABASE_URL or M3E_SUPABASE_ANON_KEY is missing. Falling back to disabled.",
      );
      return { enabled: false, transport: null };
    }
    return { enabled: true, transport: new SupabaseTransport(url, anonKey) };
  }

  // Default: file transport
  const dir = process.env.M3E_CLOUD_DIR
    ? path.resolve(process.env.M3E_CLOUD_DIR)
    : path.join(process.env.M3E_DATA_DIR || ".", "cloud-sync");
  return { enabled: true, transport: new FileTransport(dir) };
}
