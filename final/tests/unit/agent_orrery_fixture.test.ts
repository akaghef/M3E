import { describe, expect, it } from "vitest";
import { AGENT_ORRERY_FIXTURE } from "../../src/labs/agent-orrery/agent_orrery_fixture";

describe("AgentStack × M3E RG1 fixture", () => {
  it("connects one issue to its case, tasks, assigned agents, evidence, and gate", () => {
    expect(AGENT_ORRERY_FIXTURE.issue.id).toBe("PAY-4827");
    expect(AGENT_ORRERY_FIXTURE.case.issueId).toBe(AGENT_ORRERY_FIXTURE.issue.id);
    expect(AGENT_ORRERY_FIXTURE.tasks).toHaveLength(6);
    expect(AGENT_ORRERY_FIXTURE.agents).toHaveLength(6);
    expect(AGENT_ORRERY_FIXTURE.tasks.every((task) => task.assigneeId)).toBe(true);
    expect(AGENT_ORRERY_FIXTURE.deliverables).toHaveLength(6);
    expect(AGENT_ORRERY_FIXTURE.gate.requiredDeliverableIds).toHaveLength(4);
  });

  it("carries the bug-report story as replayable M3E events and linked chat", () => {
    expect(AGENT_ORRERY_FIXTURE.timeline[0]).toMatchObject({ at: 0, kind: "issue-created" });
    expect(AGENT_ORRERY_FIXTURE.timeline.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["assigned", "approval-requested", "evidence-produced", "gate-blocked", "released", "resolved"]),
    );
    expect(AGENT_ORRERY_FIXTURE.chat.length).toBeGreaterThanOrEqual(8);
    expect(AGENT_ORRERY_FIXTURE.chat.every((message) => message.issueId === AGENT_ORRERY_FIXTURE.issue.id)).toBe(true);
    expect(AGENT_ORRERY_FIXTURE.chat.some((message) => message.taskId && message.agentId)).toBe(true);
  });

  it("keeps OT runtime vocabulary and M3E canon explicitly separate", () => {
    expect(AGENT_ORRERY_FIXTURE.boundary.runtime).toMatch(/fixture/i);
    expect(AGENT_ORRERY_FIXTURE.boundary.role).toMatch(/not.*canonical Role/i);
    expect(AGENT_ORRERY_FIXTURE.boundary.layout).toMatch(/static coordinates/i);
  });

  it("models the incident as an M3E map with scopes, node kinds, backbone edges, and typed GraphLinks", () => {
    expect(AGENT_ORRERY_FIXTURE.mapPath).toBe("ws:demo / map:Payments / scope:CASE-0914");
    expect(AGENT_ORRERY_FIXTURE.scopes.map((scope) => scope.id)).toEqual(
      expect.arrayContaining(["scope-support", "scope-case", "scope-evidence"]),
    );
    expect(AGENT_ORRERY_FIXTURE.graphNodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(["folder", "text", "alias", "agent"]),
    );
    expect(AGENT_ORRERY_FIXTURE.graphLinks.filter((link) => link.class === "edge").length).toBeGreaterThan(0);
    expect(AGENT_ORRERY_FIXTURE.graphLinks.filter((link) => link.class === "GraphLink").map((link) => link.relation)).toEqual(
      expect.arrayContaining(["assigned-to", "produces", "gated-by", "references"]),
    );
  });
});
