// Joint Integration Hub — registry skeleton
// Spec: docs/03_Spec/Joint_Integration_Hub.md
// Plan 1 採用（A-small + C ハイブリッド、2026-04-22）
// このファイルは Phase 0 雛形。実装は Phase 1 以降で各 adapter を追加する。

// ---------------------------------------------------------------------------
// Adapter contracts (§2.1)
// ---------------------------------------------------------------------------

export type AdapterKind = "source" | "sink" | "both";

export interface AdapterCapabilities {
  fetch?: true;
  push?: true;
  notify?: true;
  webhook?: true;
}

export interface ScopeRef {
  workspaceId: string;
  mapId: string;
  scopeId?: string;
}

export type Timestamp = string; // ISO 8601

// Normalized cross-adapter event shape (§2.3)
export interface NormalizedEvent {
  source: string; // adapter id
  externalId: string;
  kind: "event" | "task" | "reminder" | "issue";
  title: string;
  body?: string;
  startsAt?: Timestamp;
  endsAt?: Timestamp;
  dueAt?: Timestamp;
  rrule?: string;
  status?: "open" | "done" | "cancelled";
  url?: string;
  tags?: string[];
  raw?: unknown;
}

export interface PushIntent {
  scope: ScopeRef;
  payload: NormalizedEvent;
  direction: "out-only" | "two-way";
}

export interface PushResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

export interface NotifyPayload {
  ruleId: string;
  nodeId: string;
  title: string;
  body?: string;
  url?: string;
  channel: string; // e.g. "os" / "banner" / "slack:#chan" / "email:foo@bar"
}

export interface NotifyResult {
  ok: boolean;
  deliveredAt?: Timestamp;
  error?: string;
}

export interface WebhookReq {
  headers: Record<string, string>;
  body: unknown;
}

export interface AttributeSchema {
  // Schema for the attribute namespace this adapter writes to a node.
  // Filled in when concrete adapters land. Kept opaque in the skeleton.
  namespace: string; // e.g. "external.gcal"
  fields: Record<string, "string" | "number" | "boolean" | "object">;
}

export interface JointAdapter {
  id: string; // "gcal" / "todoist" / "slack" / "os-notify" / ...
  kind: AdapterKind;
  capabilities: AdapterCapabilities;
  fetch?(scope: ScopeRef, since?: Timestamp): Promise<NormalizedEvent[]>;
  push?(intent: PushIntent): Promise<PushResult>;
  notify?(payload: NotifyPayload): Promise<NotifyResult>;
  webhook?(req: WebhookReq): Promise<void>;
  schema: AttributeSchema;
}

// ---------------------------------------------------------------------------
// Reminder rule schema (§3) — node attribute side
// ---------------------------------------------------------------------------

export type TriggerKind =
  | "absolute"
  | "relative"
  | "recurring"
  | "stale"
  | "event"
  | "manual";

export interface AbsoluteTrigger {
  kind: "absolute";
  at: Timestamp;
}

export interface RelativeTrigger {
  kind: "relative";
  from: "due" | "starts" | "ends";
  deltaMin: number; // negative = before
}

export interface RecurringTrigger {
  kind: "recurring";
  rrule: string;
}

export interface StaleTrigger {
  kind: "stale";
  noTouchDays: number;
}

export interface EventTrigger {
  kind: "event";
  source: string; // adapter id
  externalId: string;
}

export interface ManualTrigger {
  kind: "manual";
  on: "startup" | "explicit";
}

export type Trigger =
  | AbsoluteTrigger
  | RelativeTrigger
  | RecurringTrigger
  | StaleTrigger
  | EventTrigger
  | ManualTrigger;

export interface ReminderRule {
  id: string;
  trigger: Trigger;
  channel: string[]; // see NotifyPayload.channel format
  leadMin?: number;
  snoozeMin?: number[];
  until?: Timestamp;
  muted?: boolean;
  label?: string;
}

export interface ReminderHistoryEntry {
  rule: string;
  firedAt: Timestamp;
  channel: string;
  result: "ok" | "error";
  error?: string;
}

// ---------------------------------------------------------------------------
// Registry — Phase 0 stub
// ---------------------------------------------------------------------------

const adapters = new Map<string, JointAdapter>();

export function registerAdapter(adapter: JointAdapter): void {
  if (adapters.has(adapter.id)) {
    throw new Error(`joint: adapter id collision: ${adapter.id}`);
  }
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: string): JointAdapter | undefined {
  return adapters.get(id);
}

export function listAdapters(): JointAdapter[] {
  return Array.from(adapters.values());
}

export function unregisterAdapter(id: string): boolean {
  return adapters.delete(id);
}

// ---------------------------------------------------------------------------
// Phase 1+ entry points (placeholders, throw until implemented)
// ---------------------------------------------------------------------------

export async function fetchAll(_scope: ScopeRef, _since?: Timestamp): Promise<NormalizedEvent[]> {
  throw new Error("joint.fetchAll: not implemented (Phase 1+)");
}

export async function dispatchNotify(_payload: NotifyPayload): Promise<NotifyResult> {
  throw new Error("joint.dispatchNotify: not implemented (Phase 1+)");
}

export async function ingestWebhook(_adapterId: string, _req: WebhookReq): Promise<void> {
  throw new Error("joint.ingestWebhook: not implemented (Phase 6+)");
}
