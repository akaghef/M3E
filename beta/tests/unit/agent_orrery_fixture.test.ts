import { describe, expect, it } from "vitest";
import { AGENT_ORRERY_FIXTURE } from "../../src/labs/agent-orrery/agent_orrery_fixture";

describe("Agent Orrery lab fixture", () => {
  it("contains the mixed node types, agent states, and mock relation semantics", () => {
    expect(AGENT_ORRERY_FIXTURE.breadcrumb).toBe("Disperse / Force / Orrery");
    expect(AGENT_ORRERY_FIXTURE.note).toMatch(/node type.*force profile/i);

    expect(AGENT_ORRERY_FIXTURE.nodes.filter((node) => node.kind !== "agent").map((node) => node.kind))
      .toEqual(expect.arrayContaining(["text", "image", "folder", "alias"]));
    expect(AGENT_ORRERY_FIXTURE.nodes.filter((node) => node.kind === "agent")).toHaveLength(4);
    expect(AGENT_ORRERY_FIXTURE.nodes.filter((node) => node.kind === "agent").map((node) => node.state))
      .toEqual(expect.arrayContaining(["working", "waiting", "attention", "finished"]));
    expect(AGENT_ORRERY_FIXTURE.nodes.filter((node) => node.kind === "agent").every((node) => node.promptRole)).toBe(true);
    expect(AGENT_ORRERY_FIXTURE.edges.map((edge) => edge.relation)).toEqual(
      expect.arrayContaining(["spawn", "communication", "assignment"]),
    );
    expect(AGENT_ORRERY_FIXTURE.promptRoleNote).toMatch(/Role\/Contract/);
  });
});
