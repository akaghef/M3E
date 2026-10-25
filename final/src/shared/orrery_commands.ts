import type {
  OrreryActor, OrreryCommand, OrreryCommandAdapter, OrreryCommandReceipt, OrreryCommandState,
} from "./orrery_seam_interface.js";

const transitions: Record<OrreryCommandState, readonly OrreryCommandState[]> = {
  requested: ["accepted", "rejected"],
  accepted: ["submitted", "rejected", "failed", "unknown-outcome"],
  submitted: ["observed-finished", "failed", "unknown-outcome"],
  "observed-finished": ["verified"],
  verified: [], rejected: [], failed: [],
  "unknown-outcome": ["submitted", "observed-finished", "failed"],
};

export interface OrreryCommandControllerOptions {
  /** Resolve the latest observation, never a display-name match. */
  actor: (actorId: string) => OrreryActor | undefined;
  adapter: OrreryCommandAdapter;
  now?: () => string;
}

interface Entry {
  command: OrreryCommand;
  receipts: OrreryCommandReceipt[];
  pending: Promise<OrreryCommandReceipt>;
  submitting: boolean;
}

const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const copy = <T>(value: T): T => structuredClone(value);

/** In-memory outcome tracking only. The owner adapter retains execution and authorization.
 * Keep this controller alive for the command ID lifetime. Restart persistence belongs
 * to the canonical owner; this controller provides no cross-process exactly-once claim.
 */
export class OrreryCommandController {
  private readonly entries = new Map<string, Entry>();
  private readonly now: () => string;

  constructor(private readonly options: OrreryCommandControllerOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  get(commandId: string): OrreryCommandReceipt | undefined {
    const receipts = this.entries.get(commandId)?.receipts;
    return receipts ? copy(receipts[receipts.length - 1]) : undefined;
  }

  history(commandId: string): OrreryCommandReceipt[] {
    return copy(this.entries.get(commandId)?.receipts ?? []);
  }

  /** Duplicate IDs return the existing operation, even if their payload differs. */
  request(command: OrreryCommand): Promise<OrreryCommandReceipt> {
    if (!text(command.id)) return Promise.reject(new Error("invalid-command-id"));
    const existing = this.entries.get(command.id);
    if (existing) return existing.pending.then(() => this.get(command.id)!);
    const entry: Entry = {
      command: copy(command),
      receipts: [{ commandId: command.id, state: "requested", observedAt: this.now() }],
      pending: undefined!,
      submitting: true,
    };
    // Claim before any external code executes, including synchronous adapter re-entry.
    this.entries.set(command.id, entry);
    entry.pending = Promise.resolve().then(() => this.submit(entry));
    return entry.pending.then(copy);
  }

  /** Ingest independently observed owner receipts. Invalid/stale receipts do not
   * replace the last known outcome. Reconciliation never resubmits a command.
   */
  receive(receipt: OrreryCommandReceipt): boolean {
    const entry = this.entries.get(receipt.commandId);
    if (!entry || entry.submitting || !timestamp(receipt.observedAt)) return false;
    const previous = entry.receipts[entry.receipts.length - 1];
    if (Date.parse(receipt.observedAt) < Date.parse(previous.observedAt)) return false;
    if (!transitions[previous.state].includes(receipt.state)) return false;
    if ((receipt.state === "observed-finished" || receipt.state === "verified"
      || previous.state === "unknown-outcome") && !text(receipt.evidenceRef)) return false;
    entry.receipts.push(copy(receipt));
    return true;
  }

  private record(entry: Entry, state: OrreryCommandState, problem?: string): OrreryCommandReceipt {
    const previous = entry.receipts[entry.receipts.length - 1];
    const now = this.now();
    const receipt: OrreryCommandReceipt = {
      commandId: entry.command.id, state,
      observedAt: Date.parse(now) >= Date.parse(previous.observedAt) ? now : previous.observedAt,
      ...(problem ? { problem } : {}),
    };
    entry.receipts.push(receipt);
    return copy(receipt);
  }

  private async submit(entry: Entry): Promise<OrreryCommandReceipt> {
    const command = entry.command;
    let actor: OrreryActor | undefined;
    try { actor = this.options.actor(command.actorId); }
    catch { return this.record(entry, "rejected", "observation-unavailable"); }
    let problem: string | undefined;
    if (!text(command.actorId) || !text(command.action) || !timestamp(command.requestedAt)) {
      problem = "invalid-command";
    } else if (!actor || actor.id !== command.actorId || actor.observationState !== "observed") {
      problem = "actor-unobservable";
    } else if (!text(command.expectedIncarnation) || !text(actor.incarnation)
      || command.expectedIncarnation !== actor.incarnation) {
      problem = "incarnation-mismatch";
    } else if (!actor.capabilities.includes(command.action)) {
      problem = "actor-capability-unavailable";
    } else if (!this.options.adapter.capabilities.includes(command.action)) {
      problem = "adapter-capability-unavailable";
    }
    if (problem) return this.record(entry, "rejected", problem);
    this.record(entry, "accepted");
    try {
      const receipt = await this.options.adapter.submit(copy(command));
      entry.submitting = false;
      // Submission alone cannot supply independent completion/verification evidence.
      if (!receipt || receipt.commandId !== command.id
        || !["submitted", "rejected", "failed", "unknown-outcome"].includes(receipt.state)
        || !this.receive(receipt)) {
        return this.record(entry, "unknown-outcome", "invalid-submission-receipt");
      }
      return this.get(command.id)!;
    } catch {
      entry.submitting = false;
      // Do not expose transport exceptions (which may contain credentials or paths).
      return this.record(entry, "unknown-outcome", "transport-error");
    }
  }
}
