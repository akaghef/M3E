import fs from "node:fs";
import path from "node:path";
import { emptyOrrerySnapshot, markOrrerySourceUnavailable, mergeOrrerySnapshots, normalizeCodexAppSnapshot, reconcileOrrerySnapshot, validateOrrerySnapshot } from "../shared/orrery_observation";
import type { OrrerySnapshot, OrrerySnapshotReader, OrrerySourceConfig } from "../shared/orrery_seam_interface";

export interface OrreryRuntimeOptions {
  sources?: OrrerySourceConfig[];
  pollMs?: number;
  staleMs?: number;
  now?: () => number;
  configurationProblem?: string;
}
const MAX_BYTES = 8 * 1024 * 1024;
function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
export function orreryRuntimeOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): OrreryRuntimeOptions {
  const options: OrreryRuntimeOptions = {
    pollMs: bounded(env.M3E_ORRERY_POLL_MS, 2000, 1000, 60000),
    staleMs: bounded(env.M3E_ORRERY_STALE_MS, 120000, 1000, 86400000),
  };
  if (!env.M3E_ORRERY_SOURCES?.trim()) return options;
  try {
    const values = JSON.parse(env.M3E_ORRERY_SOURCES);
    if (!Array.isArray(values) || values.length > 32) throw new Error();
    const identities = new Set<string>();
    options.sources = values.map((value) => {
      if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.hostId !== "string" || !/^[a-zA-Z0-9_.-]{1,100}$/.test(value.id) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(value.hostId)
        || typeof value.path !== "string" || !path.isAbsolute(value.path) || !["codex-app-v1", "orrery-v1"].includes(value.format)) throw new Error();
      const key = JSON.stringify([value.id, value.hostId]);
      if (identities.has(key)) throw new Error();
      identities.add(key);
      return { id: value.id, hostId: value.hostId, path: value.path, format: value.format };
    });
  } catch { options.sources = []; options.configurationProblem = "configuration_invalid"; }
  return options;
}

/** One server-owned, bounded file poller. Never discovers paths or reads raw session/mail stores. */
export function createOrreryRuntime(options: OrreryRuntimeOptions = orreryRuntimeOptionsFromEnv()): OrrerySnapshotReader & { refresh(): void } {
  const now = options.now ?? Date.now;
  const configs = options.sources ?? [];
  const listeners = new Set<(snapshot: OrrerySnapshot) => void>();
  const lastGood = new Map<string, OrrerySnapshot>();
  let closed = false;
  let snapshot = emptyOrrerySnapshot(new Date(now()).toISOString());
  let signature = "";
  const staleMs = bounded(options.staleMs, 120000, 1, 86400000);
  const keyFor = (source: OrrerySourceConfig) => JSON.stringify([source.id, source.hostId]);
  function refresh(): void {
    if (closed) return;
    const timestamp = new Date(now()).toISOString();
    const inputs: OrrerySnapshot[] = configs.map((config): OrrerySnapshot => {
      const key = keyFor(config), previous = lastGood.get(key);
      let value: OrrerySnapshot;
      let problem = "source_invalid";
      try {
        // Opening once makes atomic file replacements safe; the byte cap also applies if the file grows.
        if (!fs.statSync(config.path).isFile()) throw new Error();
        const fd = fs.openSync(config.path, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
        let raw: string;
        try {
          if (!fs.fstatSync(fd).isFile()) throw new Error();
          const bytes = Buffer.alloc(MAX_BYTES + 1);
          let size = 0, count = 0;
          do { count = fs.readSync(fd, bytes, size, bytes.length - size, null); size += count; } while (count && size < bytes.length);
          if (size > MAX_BYTES) throw new Error();
          raw = bytes.toString("utf8", 0, size);
        } finally { fs.closeSync(fd); }
        const parsed: unknown = JSON.parse(raw);
        value = config.format === "codex-app-v1" ? normalizeCodexAppSnapshot(parsed, config, previous) : reconcileOrrerySnapshot(validateOrrerySnapshot(parsed), previous);
        // One configured file owns exactly one source/host boundary.
        if (value.sources.length !== 1 || value.sources[0].id !== config.id || value.sources[0].hostId !== config.hostId) throw new Error();
        if (previous && Date.parse(value.generatedAt) < Date.parse(previous.generatedAt)) { problem = "source_out_of_order"; throw new Error(); }
        // Reject cross-source identity collisions before changing the accepted value.
        mergeOrrerySnapshots([...lastGood.entries()].filter(([other]) => other !== key).map(([, item]) => item).concat(value), timestamp);
        lastGood.set(key, value);
      } catch (error) {
        if ((error as Error).message === "orrery_stale_snapshot") problem = "source_out_of_order";
        else if ((error as NodeJS.ErrnoException).code === "ENOENT") problem = "source_missing";
        else if (["EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) problem = "source_unavailable";
        value = previous ? markOrrerySourceUnavailable(previous, problem) : { ...emptyOrrerySnapshot(timestamp), sources: [{ id: config.id, hostId: config.hostId, state: "unobservable", observedAt: null, revision: null, problem }] };
      }
      if (value.sources[0].state === "connected" && now() - Date.parse(value.sources[0].observedAt ?? value.generatedAt) > staleMs) {
        value = { ...markOrrerySourceUnavailable(value, "source_stale"), sources: value.sources.map((source) => ({ ...source, state: "stale", problem: "source_stale" })) };
      }
      // This backend never advertises execution capability, even if a producer does.
      return { ...value, actors: value.actors.map((actor) => ({ ...actor, capabilities: [] })) };
    });
    if (!inputs.length) inputs.push({ ...emptyOrrerySnapshot(timestamp), sources: [{ id: "orrery", hostId: "local", state: "disabled", observedAt: null, revision: null, ...(options.configurationProblem ? { problem: options.configurationProblem } : {}) }] });
    const next = mergeOrrerySnapshots(inputs, timestamp);
    const nextSignature = JSON.stringify({ ...next, generatedAt: "" });
    if (nextSignature === signature) return;
    signature = nextSignature;
    snapshot = next;
    for (const listener of listeners) { try { listener(structuredClone(snapshot)); } catch { /* isolate disconnected subscribers */ } }
  }
  refresh();
  const timer = configs.length ? setInterval(refresh, bounded(options.pollMs, 2000, 10, 60000)) : undefined;
  timer?.unref();
  return {
    snapshot: () => structuredClone(snapshot),
    subscribe(listener) { if (closed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    close() { closed = true; if (timer) clearInterval(timer); listeners.clear(); },
  };
}
