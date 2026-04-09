import fs from "fs";
import path from "path";
import type {
  AppState,
  CloudSyncConfig,
  CloudSyncTransport,
  CloudTransportKind,
  PullResult,
  PushResult,
  SavedDoc,
  SyncStatus,
} from "../shared/types";

// ---------------------------------------------------------------------------
// Conflict detection (unchanged public API)
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
// FileTransport — file-mirror implementation
// ---------------------------------------------------------------------------

function sanitizeDocId(docId: string): string {
  return docId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class FileTransport implements CloudSyncTransport {
  readonly kind: CloudTransportKind = "file";
  private readonly cloudDir: string;

  constructor(cloudDir: string) {
    this.cloudDir = cloudDir;
  }

  private docPath(docId: string): string {
    return path.join(this.cloudDir, `${sanitizeDocId(docId)}.json`);
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.cloudDir)) {
      fs.mkdirSync(this.cloudDir, { recursive: true });
    }
  }

  private readCloudDoc(filePath: string): SavedDoc | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as SavedDoc;
    if (!parsed || parsed.version !== 1 || !parsed.state) {
      return null;
    }
    return parsed;
  }

  async push(
    docId: string,
    savedDoc: SavedDoc,
    options?: { baseSavedAt?: string | null; force?: boolean },
  ): Promise<PushResult> {
    this.ensureDir();
    const filePath = this.docPath(docId);
    const existingDoc = this.readCloudDoc(filePath);
    const baseSavedAt = options?.baseSavedAt ?? null;
    const forcePush = Boolean(options?.force);

    if (detectCloudConflict(existingDoc?.savedAt ?? null, baseSavedAt, forcePush)) {
      return {
        ok: false,
        savedAt: savedDoc.savedAt,
        forced: false,
        error: "Cloud conflict detected.",
        code: "CLOUD_CONFLICT",
        cloudSavedAt: existingDoc?.savedAt ?? null,
        baseSavedAt,
      };
    }

    fs.writeFileSync(filePath, JSON.stringify(savedDoc, null, 2), "utf8");
    return {
      ok: true,
      savedAt: savedDoc.savedAt,
      forced: forcePush,
    };
  }

  async pull(docId: string): Promise<PullResult> {
    this.ensureDir();
    const filePath = this.docPath(docId);

    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        version: 1,
        savedAt: "",
        state: { rootId: "", nodes: {} },
        error: "Cloud document not found.",
        code: "SYNC_CLOUD_NOT_FOUND",
      };
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: number; state?: AppState; savedAt?: string };
    if (!parsed || parsed.version !== 1 || !parsed.state) {
      return {
        ok: false,
        version: 1,
        savedAt: "",
        state: { rootId: "", nodes: {} },
        error: "Cloud document has unsupported format.",
        code: "SYNC_CLOUD_UNSUPPORTED_FORMAT",
      };
    }

    return {
      ok: true,
      version: 1,
      savedAt: parsed.savedAt || fs.statSync(filePath).mtime.toISOString(),
      state: parsed.state,
    };
  }

  async status(docId: string): Promise<SyncStatus> {
    this.ensureDir();
    const filePath = this.docPath(docId);
    const exists = fs.existsSync(filePath);
    const cloudDoc = exists ? this.readCloudDoc(filePath) : null;

    return {
      ok: true,
      enabled: true,
      mode: "file",
      documentId: docId,
      exists,
      cloudSavedAt: cloudDoc?.savedAt ?? null,
      lastSyncedAt: exists ? fs.statSync(filePath).mtime.toISOString() : null,
    };
  }
}

// ---------------------------------------------------------------------------
// HttpTransport — stub for future HTTP/REST remote sync
// ---------------------------------------------------------------------------

export class HttpTransport implements CloudSyncTransport {
  readonly kind: CloudTransportKind = "http";
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async push(_docId: string, _savedDoc: SavedDoc, _options?: { baseSavedAt?: string | null; force?: boolean }): Promise<PushResult> {
    throw new Error("HttpTransport.push is not implemented. Endpoint: " + this.endpoint);
  }

  async pull(_docId: string): Promise<PullResult> {
    throw new Error("HttpTransport.pull is not implemented. Endpoint: " + this.endpoint);
  }

  async status(_docId: string): Promise<SyncStatus> {
    throw new Error("HttpTransport.status is not implemented. Endpoint: " + this.endpoint);
  }
}

// ---------------------------------------------------------------------------
// SupabaseTransport — stub for future Supabase remote sync
// ---------------------------------------------------------------------------

export class SupabaseTransport implements CloudSyncTransport {
  readonly kind: CloudTransportKind = "supabase";
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async push(_docId: string, _savedDoc: SavedDoc, _options?: { baseSavedAt?: string | null; force?: boolean }): Promise<PushResult> {
    throw new Error("SupabaseTransport.push is not implemented. Endpoint: " + this.endpoint);
  }

  async pull(_docId: string): Promise<PullResult> {
    throw new Error("SupabaseTransport.pull is not implemented. Endpoint: " + this.endpoint);
  }

  async status(_docId: string): Promise<SyncStatus> {
    throw new Error("SupabaseTransport.status is not implemented. Endpoint: " + this.endpoint);
  }
}

// ---------------------------------------------------------------------------
// Factory and config
// ---------------------------------------------------------------------------

export function loadCloudSyncConfig(): CloudSyncConfig {
  const enabled = process.env.M3E_CLOUD_SYNC === "1";
  const transport = (process.env.M3E_CLOUD_TRANSPORT as CloudTransportKind) || "file";
  const cloudDir = process.env.M3E_CLOUD_DIR
    ? path.resolve(process.env.M3E_CLOUD_DIR)
    : "";
  const endpoint = process.env.M3E_CLOUD_ENDPOINT || null;

  return { enabled, transport, cloudDir, endpoint };
}

export function createTransport(config: CloudSyncConfig): CloudSyncTransport {
  switch (config.transport) {
    case "http":
      if (!config.endpoint) {
        throw new Error("M3E_CLOUD_ENDPOINT is required for http transport.");
      }
      return new HttpTransport(config.endpoint);

    case "supabase":
      if (!config.endpoint) {
        throw new Error("M3E_CLOUD_ENDPOINT is required for supabase transport.");
      }
      return new SupabaseTransport(config.endpoint);

    case "file":
    default:
      if (!config.cloudDir) {
        throw new Error("M3E_CLOUD_DIR is required for file transport.");
      }
      return new FileTransport(config.cloudDir);
  }
}
