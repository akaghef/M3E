import { describe, expect, it, vi } from "vitest";
import { OrreryCommandController } from "../../src/shared/orrery_commands";
import type { OrreryActor, OrreryCommand, OrreryCommandReceipt } from "../../src/shared/orrery_seam_interface";

const at = "2026-09-22T00:00:00Z";
const command: OrreryCommand = {
  id: "c1", actorId: "source:host:external", action: "send", requestedAt: at, expectedIncarnation: "run1",
};
const actor: OrreryActor = {
  id: command.actorId, externalId: "external", kind: "ai", name: "Name", backend: "example",
  incarnation: "run1", rawState: "idle", observationState: "observed", lastActiveAt: at,
  capabilities: ["send"], provenance: { sourceId: "source", hostId: "host", sourceRecordId: "external", observedAt: at, revision: "1" },
};
const receipt = (state: OrreryCommandReceipt["state"], evidenceRef?: string): OrreryCommandReceipt => ({
  commandId: command.id, state, observedAt: at, ...(evidenceRef ? { evidenceRef } : {}),
});
function setup(observed: OrreryActor | undefined = actor, capabilities = ["send"]) {
  const submit = vi.fn(async () => receipt("submitted"));
  const controller = new OrreryCommandController({ actor: () => observed, adapter: { capabilities, submit }, now: () => at });
  return { controller, submit };
}

describe("Orrery command outcomes", () => {
  it("keeps submission, observed completion and verification distinct", async () => {
    const { controller } = setup();
    const pending = controller.request(command);
    expect(controller.get(command.id)?.state).toBe("requested");
    expect((await pending).state).toBe("submitted");
    expect(controller.history(command.id).map(r => r.state)).toEqual(["requested", "accepted", "submitted"]);
    expect(controller.receive(receipt("verified", "check"))).toBe(false);
    expect(controller.receive(receipt("observed-finished"))).toBe(false);
    expect(controller.receive(receipt("observed-finished", "owner-result"))).toBe(true);
    expect(controller.receive(receipt("verified"))).toBe(false);
    expect(controller.receive(receipt("verified", "readback"))).toBe(true);
    expect(controller.receive(receipt("failed"))).toBe(false);
  });

  it("deduplicates concurrent and changed-payload requests without reexecution", async () => {
    const { controller, submit } = setup();
    let resolve!: (value: OrreryCommandReceipt) => void;
    submit.mockImplementation(() => new Promise(r => { resolve = r; }));
    const first = controller.request(command);
    const second = controller.request({ ...command, action: "other" });
    await Promise.resolve();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(controller.get(command.id)?.state).toBe("accepted");
    resolve(receipt("submitted"));
    expect(await first).toEqual(await second);
    await controller.request(command);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ...actor, observationState: "unobservable" as const }, command, ["send"], "actor-unobservable"],
    [{ ...actor, id: "other-host" }, command, ["send"], "actor-unobservable"],
    [{ ...actor, incarnation: "run2" }, command, ["send"], "incarnation-mismatch"],
    [actor, { ...command, expectedIncarnation: undefined }, ["send"], "incarnation-mismatch"],
    [{ ...actor, capabilities: [] }, command, ["send"], "actor-capability-unavailable"],
    [actor, command, [], "adapter-capability-unavailable"],
  ])("rejects unavailable/stale/unsupported targets", async (target, request, capabilities, problem) => {
    const { controller, submit } = setup(target, capabilities);
    expect(await controller.request(request)).toMatchObject({ state: "rejected", problem });
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not infer identity or capability for a missing actor", async () => {
    const submit = vi.fn();
    const controller = new OrreryCommandController({ actor: () => undefined, adapter: { capabilities: ["send"], submit }, now: () => at });
    expect((await controller.request(command)).state).toBe("rejected");
    expect(submit).not.toHaveBeenCalled();
  });

  it.each([
    { ...receipt("submitted"), commandId: "wrong" },
    receipt("verified", "submission-is-not-verification"),
    receipt("observed-finished", "submission-is-not-observation"),
    { ...receipt("submitted"), observedAt: "invalid" },
  ])("treats mismatched or overstated submission receipts as unknown", async invalid => {
    const { controller, submit } = setup();
    submit.mockResolvedValue(invalid);
    expect(await controller.request(command)).toMatchObject({ state: "unknown-outcome", problem: "invalid-submission-receipt" });
    await controller.request(command);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("sanitizes exceptions and requires evidence to reconcile, without retry", async () => {
    const { controller, submit } = setup();
    submit.mockRejectedValue(new Error("secret /private/path"));
    expect(await controller.request(command)).toEqual({ ...receipt("unknown-outcome"), problem: "transport-error" });
    expect(controller.receive(receipt("submitted"))).toBe(false);
    expect(controller.receive(receipt("observed-finished", "owner-readback"))).toBe(true);
    expect(controller.receive(receipt("verified", "verification"))).toBe(true);
    expect((await controller.request(command)).state).toBe("verified");
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("rejects stale, unknown and duplicate receipts and protects history from mutation", async () => {
    const { controller } = setup();
    await controller.request(command);
    expect(controller.receive({ ...receipt("failed"), commandId: "missing" })).toBe(false);
    expect(controller.receive({ ...receipt("failed"), observedAt: "2020-01-01" })).toBe(false);
    expect(controller.receive(receipt("submitted"))).toBe(false);
    controller.history(command.id)[0].state = "verified";
    expect(controller.history(command.id)[0].state).toBe("requested");
  });
});
