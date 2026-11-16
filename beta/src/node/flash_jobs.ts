import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { M3eMcpService } from "./mcp_service";

type RecordValue = Record<string, any>;
export class FlashRequestError extends Error {}
export class FlashProviderRejection extends Error {}
export function flashPublicError(error: unknown): string {
  return error instanceof FlashRequestError ? error.message : "Flashの処理を完了できませんでした。接続を確認して再試行してください。";
}
function validateFile(source: RecordValue): void {
  if (!source || typeof source !== "object" || Array.isArray(source)
    || !["document", "image", "audio", "video"].includes(source.type)
    || Object.keys(source).some(k => !["type", "base64", "filename", "mime_type"].includes(k))
    || typeof source.filename !== "string" || !source.filename.trim() || source.filename.length > 255 || /[\\/\x00-\x1f]/.test(source.filename)
    || typeof source.mime_type !== "string" || !/^[\w.+-]+\/[\w.+-]+$/.test(source.mime_type)
    || typeof source.base64 !== "string" || !source.base64 || source.base64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(source.base64) || Buffer.from(source.base64, "base64").toString("base64") !== source.base64) {
    throw new FlashRequestError("File sources require filename, mime_type and base64");
  }
}
export interface FlashProvider { call(route: string, body?: unknown, key?: string): Promise<RecordValue>; }
/** Reuse the installed Flash connection. Credentials never enter jobs, responses or logs. */
export class InstalledFlashProvider implements FlashProvider {
  async call(route: string, body?: unknown, key?: string): Promise<RecordValue> {
    const file = process.env.FLASH_CLIENT_CONFIG || path.join(os.homedir(), "Library/Application Support/M3E-Flash/connection.json");
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    const url = new URL(config.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || typeof config.token !== "string" || config.token.length < 32) throw new Error("Flash connection unavailable");
    const response = await fetch(url.origin + route, {
      method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      if (body !== undefined && [400, 401, 403, 413, 415, 422].includes(response.status)) throw new FlashProviderRejection("Generation request rejected");
      throw new Error("Flash unavailable");
    }
    return response.json() as Promise<RecordValue>;
  }
}
interface Job {
  id: string; fingerprint: string; target: string; input: RecordValue; state: string;
  created_at: string; deadline: number; provider_job_id?: string; result?: RecordValue; error?: string;
}
export class FlashJobs {
  private running = new Set<string>();
  private closed = false;
  constructor(private dir: string, private mcp: M3eMcpService, private provider: FlashProvider, private delayMs = 3000) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  resume(): void {
    for (const file of fs.readdirSync(this.dir)) if (/^[a-f0-9]{64}\.json$/.test(file)) {
      const job = this.read(file.slice(0, -5));
      if (job.state === "processing") void this.run(job);
    }
  }
  close(): void { this.closed = true; }
  private read(id: string): Job {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new FlashRequestError("Invalid job id");
    return JSON.parse(fs.readFileSync(path.join(this.dir, id + ".json"), "utf8"));
  }
  private save(job: Job): void {
    const file = path.join(this.dir, job.id + ".json");
    fs.writeFileSync(file + ".tmp", JSON.stringify(job), { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
  }
  private view(j: Job): RecordValue { return { ok: true, job_id: j.id, state: j.state, created_at: j.created_at, target: j.target, ...(j.result ? { result: j.result } : {}), ...(j.error ? { error: j.state === "failed" ? "生成または保存を完了できませんでした。" : j.state === "indeterminate" ? "結果を確定できませんでした。同じ処理の状態を確認してください。" : "処理を継続しています。" } : {}) }; }
  get(id: string): RecordValue { return this.view(this.read(id)); }
  /** Retry only an already-generated result; never submit a second provider job. */
  async retryImport(id: string): Promise<RecordValue> {
    const job = this.read(id);
    if (job.state === "succeeded" || job.state === "processing") return this.view(job);
    if (!job.provider_job_id) throw new FlashRequestError("No generated provider result");
    let status: RecordValue;
    try { status = await this.provider.call(`/v1/jobs/${encodeURIComponent(job.provider_job_id)}`); } catch { throw new Error("Flash unavailable"); }
    if (status.state !== "succeeded") throw new FlashRequestError("Provider generation has not succeeded; import retry cannot regenerate");
    const target = this.mcp.call("m3e_get", { kind: "state", target: job.target, limit: 1 });
    if (!target.ok || target.nodes?.[0]?.node_type === "alias") throw new FlashRequestError("Destination no longer available");
    // A concurrent retry may have started or completed while provider status was read.
    const current = this.read(id);
    if (current.state === "succeeded" || current.state === "processing") return this.view(current);
    current.state = "processing"; current.deadline = Date.now() + 35 * 60_000;
    delete current.error; this.save(current); void this.run(current);
    return this.view(current);
  }
  submit(body: RecordValue): RecordValue {
    if (!body || typeof body !== "object" || Object.keys(body).some(k => !["request_id", "target", "source", "language", "instruction", "title", "attachments"].includes(k))) throw new FlashRequestError("Invalid job request");
    if (typeof body.request_id !== "string" || !body.request_id.trim() || body.request_id.length > 200 || typeof body.target !== "string") throw new FlashRequestError("request_id and target are required");
    const source = body.source;
    if (!source || typeof source !== "object" || Array.isArray(source) || !["text", "topic", "url", "document", "image", "audio", "video"].includes(source.type)) throw new FlashRequestError("Invalid source type");
    if (["text", "topic"].includes(source.type)) {
      if (typeof source.text !== "string" || !source.text.trim() || Object.keys(source).some(k => !["type", "text"].includes(k))) throw new FlashRequestError("Source text is required");
    } else if (source.url !== undefined) {
      let url: URL;
      try { url = new URL(source.url); } catch { throw new FlashRequestError("Invalid source URL"); }
      if (!["url", "audio", "video"].includes(source.type) || Object.keys(source).some(k => !["type", "url"].includes(k)) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new FlashRequestError("Invalid source URL");
    } else validateFile(source);
    if (body.attachments !== undefined && (!Array.isArray(body.attachments) || body.attachments.length > 10)) throw new FlashRequestError("追加添付は10件までです。");
    for (const attachment of body.attachments ?? []) validateFile(attachment);
    if ((body.attachments?.length ?? 0) + (source.base64 ? 1 : 0) > 10) throw new FlashRequestError("素材ファイルと追加添付は合計10件までです。");
    if ((body.attachments ?? []).some((file: RecordValue) => !["document", "image"].includes(file.type))) throw new FlashRequestError("追加添付は文書・画像に対応しています。音声・動画は素材として指定してください。");
    if (["audio", "video"].includes(source.type) && body.attachments?.length) throw new FlashRequestError("音声・動画の素材は追加添付に対応していません。");
    for (const file of [...(source.base64 ? [source] : []), ...(body.attachments ?? [])]) {
      if (file.type !== "document" && !file.mime_type.startsWith(file.type + "/")) throw new FlashRequestError("素材の種類とファイル形式が一致していません。");
      if (file.type === "image" && Buffer.byteLength(file.base64, "base64") > 15 * 1024 * 1024) throw new FlashRequestError("画像は15 MiB以下にしてください。");
    }
    for (const k of ["title", "instruction", "language"]) if (body[k] !== undefined && typeof body[k] !== "string") throw new FlashRequestError(`Invalid ${k}`);
    const input = { source, ...(body.attachments !== undefined ? { attachments: body.attachments } : {}), language: body.language ?? "ja", ...(body.title !== undefined ? { title: body.title } : {}), ...(body.instruction !== undefined ? { instruction: body.instruction } : {}) };
    const fingerprint = createHash("sha256").update(JSON.stringify({ target: body.target, input })).digest("hex");
    const id = createHash("sha256").update(body.request_id).digest("hex");
    if (fs.existsSync(path.join(this.dir, id + ".json"))) {
      const old = this.read(id);
      if (old.fingerprint !== fingerprint) throw new FlashRequestError("request_id already used with different input or target");
      if (old.state === "processing") void this.run(old);
      return this.view(old);
    }
    const target = this.mcp.call("m3e_get", { kind: "state", target: body.target, limit: 1 });
    if (!target.ok || target.nodes?.[0]?.node_type === "alias") throw new FlashRequestError("Target unavailable or cannot own children");
    const job: Job = { id, fingerprint, target: target.target.uri, input, state: "processing", created_at: new Date().toISOString(), deadline: Date.now() + 35 * 60_000 };
    this.save(job); void this.run(job); return this.view(job);
  }
  private async run(job: Job): Promise<void> {
    if (this.running.has(job.id) || this.closed) return;
    this.running.add(job.id);
    try {
      while (!this.closed && Date.now() < job.deadline) {
        try {
          if (!job.provider_job_id) {
            const submitted = await this.provider.call("/v1/jobs", job.input, `m3e-${job.id}`);
            if (typeof submitted.job_id !== "string" || !submitted.job_id) throw new FlashRequestError("Invalid provider job");
            job.provider_job_id = submitted.job_id; this.save(job);
          }
          const route = `/v1/jobs/${encodeURIComponent(job.provider_job_id)}`;
          const status = await this.provider.call(route);
          if (["failed", "indeterminate"].includes(status.state)) { job.state = status.state; job.error = "Flash generation did not succeed"; this.save(job); return; }
          if (status.state === "succeeded") {
            const graph = await this.provider.call(route + "/structure");
            const entered = this.mcp.call("m3e_context", { action: "enter", target: job.target });
            if (!entered.ok) throw new FlashRequestError("Destination no longer available");
            let result: RecordValue;
            try {
              result = this.mcp.call("m3e_create", { kind: "import_structure", context_id: entered.context_id, target: job.target, expected_revision: entered.revision, structure: graph, import_key: job.id });
            } finally { this.mcp.call("m3e_context", { action: "leave", context_id: entered.context_id }); }
            if (!result.ok) {
              job.state = "failed"; job.error = "IMPORT_FAILED"; this.save(job); return;
            }
            job.state = "succeeded"; job.result = { scope: result.created[0], node_count: graph.nodes.length, revision: result.revision, replayed: result.replayed === true }; delete job.error; this.save(job); return;
          }
        } catch (error) {
          if (error instanceof FlashProviderRejection) { job.state = "failed"; job.error = "GENERATION_REJECTED"; this.save(job); return; }
          job.error = "Processing interrupted; retrying the same provider request until deadline"; this.save(job);
        }
        await new Promise<void>(resolve => { const timer = setTimeout(resolve, this.delayMs); timer.unref(); });
      }
      if (!this.closed) { job.state = "indeterminate"; job.error = "Deadline reached; inspect provider state before resubmitting"; this.save(job); }
    } finally { this.running.delete(job.id); }
  }
}
