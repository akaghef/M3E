import {
  ORRERY_SCHEMA,
  type OrreryActor, type OrreryLifecycleState, type OrrerySnapshot,
  type OrrerySource, type OrrerySourceConfig,
} from "./orrery_seam_interface";

const LIFECYCLE = new Set<OrreryLifecycleState>([
  "starting", "thinking", "tool-running", "awaiting-user", "blocked", "idle",
  "completed", "failed", "disconnected", "unobservable",
]);
const RELATIONS = new Set(["conversation", "handoff", "assignment", "attention", "spawn", "resource-use"]);
const SOURCE_STATES = new Set(["connected", "stale", "unobservable", "disabled"]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("orrery_invalid_object");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("orrery_unknown_field");
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 100_000) throw new Error("orrery_invalid_string");
  return value;
}
function date(value: unknown): string {
  const result = string(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error("orrery_invalid_date");
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 100_000) throw new Error("orrery_invalid_array");
  return value;
}
function unique(values: unknown[], field: string): Set<string> {
  const ids = new Set<string>();
  for (const value of values) {
    const id = string(record(value)[field]);
    if (ids.has(id)) throw new Error("orrery_duplicate_identity");
    ids.add(id);
  }
  return ids;
}

export function orreryActorId(sourceId: string, hostId: string, externalId: string): string {
  return `orrery:${[sourceId, hostId, externalId].map((part) => encodeURIComponent(string(part))).join(":")}`;
}

export function emptyOrrerySnapshot(generatedAt = new Date().toISOString()): OrrerySnapshot {
  return { schema: ORRERY_SCHEMA, revision: "empty", generatedAt: date(generatedAt), sources: [], actors: [], relations: [], evidence: [], attention: [] };
}

/** Validate before using a portable observation. Does not trust IDs merely because JSON parsed. */
export function validateOrrerySnapshot(input: unknown): OrrerySnapshot {
  const value = record(input);
  fields(value, ["schema", "revision", "generatedAt", "sources", "actors", "relations", "evidence", "attention"]);
  if (value.schema !== ORRERY_SCHEMA) throw new Error("orrery_unsupported_schema");
  string(value.revision); date(value.generatedAt);
  const sources = array(value.sources), actors = array(value.actors), relations = array(value.relations);
  const evidence = array(value.evidence), attention = array(value.attention);
  const sourceKeys = new Set<string>();
  for (const item of sources) {
    const source = record(item);
    fields(source, ["id", "hostId", "state", "observedAt", "revision", "problem"]);
    const key = JSON.stringify([string(source.id), string(source.hostId)]);
    if (sourceKeys.has(key)) throw new Error("orrery_duplicate_source");
    sourceKeys.add(key);
    if (!SOURCE_STATES.has(string(source.state))) throw new Error("orrery_invalid_source_state");
    if (source.observedAt !== null) date(source.observedAt);
    if (source.revision !== null) string(source.revision);
    if (source.problem !== undefined && !/^[a-z0-9_-]{1,100}$/.test(string(source.problem))) throw new Error("orrery_invalid_problem");
  }
  const actorIds = unique(actors, "id"), evidenceIds = unique(evidence, "id");
  const evidenceById = new Map(evidence.map((item) => [string(record(item).id), record(item)]));
  unique(relations, "id"); unique(attention, "id");
  function provenance(item: Record<string, unknown>): void {
    const p = record(item.provenance);
    fields(p, ["sourceId", "hostId", "sourceRecordId", "observedAt", "revision"]);
    const key = JSON.stringify([string(p.sourceId), string(p.hostId)]);
    if (!sourceKeys.has(key)) throw new Error("orrery_unknown_source");
    string(p.sourceRecordId); string(p.revision); date(p.observedAt);
  }
  function endpoint(value: unknown): void {
    if (!actorIds.has(string(value))) throw new Error("orrery_unknown_endpoint");
  }
  for (const item of actors) {
    const actor = record(item); provenance(actor);
    fields(actor, ["id", "externalId", "kind", "name", "backend", "nativeSessionRef", "mailPrincipalRef", "parentActorId", "incarnation", "model", "title", "message", "rawState", "lifecycleState", "observationState", "lastActiveAt", "capabilities", "provenance"]);
    const p = record(actor.provenance);
    if (actor.id !== orreryActorId(string(p.sourceId), string(p.hostId), string(actor.externalId))) throw new Error("orrery_identity_mismatch");
    if (actor.kind !== "ai" && actor.kind !== "human") throw new Error("orrery_invalid_kind");
    string(actor.name); string(actor.backend); string(actor.rawState); date(actor.lastActiveAt);
    if (actor.observationState !== "observed" && actor.observationState !== "unobservable") throw new Error("orrery_invalid_observation_state");
    if (actor.lifecycleState !== undefined && !LIFECYCLE.has(actor.lifecycleState as OrreryLifecycleState)) throw new Error("orrery_invalid_lifecycle");
    array(actor.capabilities).forEach(string);
    for (const key of ["nativeSessionRef", "mailPrincipalRef", "incarnation", "model", "title", "message"]) {
      if (actor[key] !== undefined) string(actor[key]);
    }
    if (actor.parentActorId !== undefined) {
      endpoint(actor.parentActorId);
      if (actor.parentActorId === actor.id) throw new Error("orrery_invalid_parent");
    }
  }
  for (const item of evidence) {
    const message = record(item); provenance(message);
    fields(message, ["id", "sourceActorId", "targetActorId", "sentAt", "subject", "body", "deliveryState", "replyToId", "provenance"]);
    endpoint(message.sourceActorId); endpoint(message.targetActorId); date(message.sentAt);
    for (const key of ["subject", "body", "deliveryState", "replyToId"]) if (message[key] !== undefined) string(message[key]);
    if (message.replyToId !== undefined && (!evidenceIds.has(string(message.replyToId)) || message.replyToId === message.id)) throw new Error("orrery_unknown_reply");
  }
  for (const item of relations) {
    const relation = record(item); provenance(relation);
    fields(relation, ["id", "sourceActorId", "targetActorId", "type", "evidenceIds", "provenance"]);
    endpoint(relation.sourceActorId); endpoint(relation.targetActorId);
    if (!RELATIONS.has(string(relation.type))) throw new Error("orrery_invalid_relation");
    const refs = array(relation.evidenceIds);
    if ((relation.type === "conversation" || relation.type === "handoff") && refs.length === 0) throw new Error("orrery_missing_evidence");
    for (const id of refs) {
      if (!evidenceIds.has(string(id))) throw new Error("orrery_unknown_evidence");
      const message = evidenceById.get(string(id))!;
      if (message.sourceActorId !== relation.sourceActorId || message.targetActorId !== relation.targetActorId) throw new Error("orrery_evidence_endpoint_mismatch");
    }
  }
  for (const item of attention) {
    const request = record(item); provenance(request); endpoint(request.actorId); string(request.text);
    fields(request, ["id", "actorId", "requestedByActorId", "state", "text", "provenance"]);
    if (request.requestedByActorId !== undefined) endpoint(request.requestedByActorId);
    if (request.state !== "open" && request.state !== "resolved") throw new Error("orrery_invalid_attention");
  }
  // Detached data: caller-owned objects cannot change a validated snapshot afterwards.
  return JSON.parse(JSON.stringify(value)) as OrrerySnapshot;
}

/** Consume the existing sanitized Codex App snapshot; no session-log or mailbox reads. */
export function normalizeCodexAppSnapshot(
  input: unknown, source: Pick<OrrerySourceConfig, "id" | "hostId">,
  previous?: OrrerySnapshot,
): OrrerySnapshot {
  const payload = record(input);
  if (payload.schema_version !== 1) throw new Error("orrery_unsupported_schema");
  const generatedAt = date(payload.generated_at);
  const runtimes = array(payload.runtimes);
  unique(runtimes, "external_id");
  const previousSource = previous?.sources.find((item) => item.id === source.id && item.hostId === source.hostId);
  if (previousSource?.observedAt && Date.parse(generatedAt) < Date.parse(previousSource.observedAt)) throw new Error("orrery_stale_snapshot");
  const actors: OrreryActor[] = runtimes.map((item) => {
    const runtime = record(item), externalId = string(runtime.external_id), rawState = string(runtime.state);
    const actor: OrreryActor = {
      id: orreryActorId(source.id, source.hostId, externalId), externalId, kind: "ai",
      name: string(runtime.agent_name), backend: string(runtime.program), rawState,
      nativeSessionRef: string(runtime.session_id), observationState: "observed",
      lastActiveAt: date(runtime.last_seen_at), capabilities: array(runtime.capabilities).map(string),
      provenance: { sourceId: source.id, hostId: source.hostId, sourceRecordId: externalId, observedAt: generatedAt, revision: generatedAt },
    };
    if (runtime.model != null) actor.model = string(runtime.model);
    if (runtime.parent_external_id != null) actor.parentActorId = orreryActorId(source.id, source.hostId, string(runtime.parent_external_id));
    if (LIFECYCLE.has(rawState as OrreryLifecycleState)) actor.lifecycleState = rawState as OrreryLifecycleState;
    else if (rawState === "registering") actor.lifecycleState = "starting";
    // waiting/dormant are provider vocabulary, not proof of canonical idle.
    // 'working' does not establish thinking vs tool-running; keep it in rawState only.
    return actor;
  });
  const ids = new Set(actors.map((actor) => actor.id));
  for (const actor of previous?.actors ?? []) {
    if (actor.provenance.sourceId !== source.id || actor.provenance.hostId !== source.hostId || ids.has(actor.id)) continue;
    actors.push({ ...actor, capabilities: [], observationState: "unobservable", lifecycleState: "unobservable" });
    ids.add(actor.id);
  }
  // A parent ref is only a relation when both endpoints are present in the inventory.
  for (const actor of actors) if (actor.parentActorId && !ids.has(actor.parentActorId)) delete actor.parentActorId;
  return validateOrrerySnapshot({
    schema: ORRERY_SCHEMA, revision: generatedAt, generatedAt,
    sources: [{ id: source.id, hostId: source.hostId, state: "connected", observedAt: generatedAt, revision: generatedAt }],
    actors,
    relations: actors.filter((actor) => actor.parentActorId).map((actor) => ({
      id: `${actor.id}:spawn`, sourceActorId: actor.parentActorId!, targetActorId: actor.id,
      type: "spawn", evidenceIds: [], provenance: actor.provenance,
    })),
    evidence: [], attention: [],
  });
}

export function markOrrerySourceUnavailable(snapshot: OrrerySnapshot, problem = "source_unavailable"): OrrerySnapshot {
  return validateOrrerySnapshot({ ...snapshot,
    sources: snapshot.sources.map((source) => ({ ...source, state: "unobservable", problem })),
    actors: snapshot.actors.map((actor) => ({ ...actor, capabilities: [], observationState: "unobservable", lifecycleState: "unobservable" })),
  });
}

export function mergeOrrerySnapshots(snapshots: readonly OrrerySnapshot[], generatedAt = new Date().toISOString()): OrrerySnapshot {
  const merged = emptyOrrerySnapshot(generatedAt);
  merged.revision = JSON.stringify(snapshots.map((snapshot) => [snapshot.sources.map((source: OrrerySource) => [source.id, source.hostId, source.state]), snapshot.revision]));
  for (const snapshot of snapshots) {
    const checked = validateOrrerySnapshot(snapshot);
    merged.sources.push(...checked.sources); merged.actors.push(...checked.actors);
    merged.relations.push(...checked.relations); merged.evidence.push(...checked.evidence); merged.attention.push(...checked.attention);
  }
  return validateOrrerySnapshot(merged);
}

/** Reconcile complete portable inventories without mistaking disappearance for completion. */
export function reconcileOrrerySnapshot(next: OrrerySnapshot, previous?: OrrerySnapshot): OrrerySnapshot {
  const result = validateOrrerySnapshot(next);
  if (!previous) return result;
  const prior = validateOrrerySnapshot(previous);
  const sourceKey = (source: { id: string; hostId: string }) => JSON.stringify([source.id, source.hostId]);
  const newSources = new Map(result.sources.map((source) => [sourceKey(source), source]));
  for (const oldSource of prior.sources) {
    const current = newSources.get(sourceKey(oldSource));
    if (current?.observedAt && oldSource.observedAt && Date.parse(current.observedAt) < Date.parse(oldSource.observedAt)) {
      throw new Error("orrery_stale_snapshot");
    }
    if (!current) result.sources.push({ ...oldSource, state: "unobservable", problem: "source_missing" });
  }
  const ids = new Set(result.actors.map((actor) => actor.id));
  for (const actor of prior.actors) {
    if (ids.has(actor.id)) continue;
    result.actors.push({ ...actor, observationState: "unobservable", lifecycleState: "unobservable", capabilities: [] });
    ids.add(actor.id);
  }
  return validateOrrerySnapshot(result);
}
