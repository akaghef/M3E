import { describe, expect, it } from "vitest";
import { formatAgentCardAge, renderAgentCard, wrapAgentCardText, type AgentCardData, type AgentCardSprite } from "../../src/shared/agent_card";
import { derivePetGrid, petCatalog, resolvePetRowSprite, resolvePetSprite, initialLifecycleAnimationMapping } from "../fixtures/orrery/labs/pet_catalog";
import fixture from "../fixtures/orrery/labs/agent_cards.sample.json";

const card: AgentCardData = {
  id: "card<&>", agentKind: "ai", icon: "◆", realm: "local", role: "implementer", name: "Codex",
  title: "## Objective **Disperse（scatter / force 系）**", message: "日本語 and raw `markdown` remain visible.",
  model: "claude-opus-5-20260801", lifecycleState: "thinking", semanticColor: "normal",
  lastActiveAt: "2026-08-27T00:00:00.000Z", attention: false, actorCount: 1,
};

const sprite: AgentCardSprite = {
  petId: "black-dragon-pet", imageUrl: "/sprite.webp", sheetWidth: 1536, sheetHeight: 1872,
  frameWidth: 192, frameHeight: 208, row: 7, frames: 6, fps: 10, animate: true,
  gridStatus: "manifest-confirmed",
  frameCountStatus: "manifest-confirmed",
};

describe("Agent Card pure renderer", () => {
  it("derives elapsed time without persisting it", () => {
    expect(formatAgentCardAge("2026-08-29T08:05:00.000Z", card.lastActiveAt)).toBe("56h5m");
    expect(formatAgentCardAge("2026-08-27T00:00:30.000Z", card.lastActiveAt)).toBe("now");
  });

  it("wraps Japanese and raw markdown without content replacement", () => {
    const lines = wrapAgentCardText(card.title, 92, 12);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.join("")).toBe(card.title);
    expect(lines.join("")).toContain("**Disperse");
  });

  it("consumes the typed semantic color instead of mapping provider or raw state", () => {
    const output = renderAgentCard({ card, width: 280, lod: "near", displayAt: "2026-08-29T08:05:00.000Z", sprite });
    expect(output.svg).toContain("agent-semantic-normal");
    expect(output.svg).toContain("thinking");
    expect(output.svg).not.toContain("provider");
    expect(output.svg).toContain("## Objective **Disperse");
    expect(output.svg).toContain("data-agent-card-id=\"card&lt;&amp;&gt;\"");
    expect(output.svg).not.toContain(">Title</text>");
    expect(output.svg).not.toContain(">msg</text>");
    expect(output.svg).toContain("class=\"agent-card-rule\"");
    expect(output.svg).toContain("data-pet-id=\"black-dragon-pet\"");
    expect(output.svg).toContain("<animate attributeName=\"x\"");
    expect(output.bounds.h).toBe(140);
  });

  it("keeps the unlabeled rules when values are empty", () => {
    const output = renderAgentCard({ card: { ...card, title: "", message: "" }, width: 320, lod: "near", displayAt: 0 });
    expect(output.svg.match(/agent-card-rule/g)).toHaveLength(2);
    expect(output.svg).not.toContain(">Title</text>");
    expect(output.svg).not.toContain(">msg</text>");
    expect(output.svg.match(/agent-card-field-value/g)).toHaveLength(2);
  });

  it.each(["normal", "awaiting", "stalled", "done", "error", "archived", "unset"] as const)(
    "reflects the %s semantic color on the node",
    (semanticColor) => {
      const output = renderAgentCard({ card: { ...card, semanticColor }, width: 280, lod: "near", displayAt: 0 });
      expect(output.svg).toContain(`agent-semantic-${semanticColor}`);
      expect(output.svg).toContain(`data-semantic-color="${semanticColor}"`);
    },
  );

  it("adds a semantic color element to far LOD", () => {
    const output = renderAgentCard({ card, width: 280, lod: "far", displayAt: 0 });
    expect(output.svg).toContain("class=\"agent-card-semantic-dot\"");
    expect(output.svg).toContain('data-semantic-color="normal"');
  });

  it("keeps attention visually distinct from semantic color", () => {
    const normal = renderAgentCard({ card, width: 280, lod: "middle", displayAt: 0, attention: false });
    const attention = renderAgentCard({ card, width: 280, lod: "middle", displayAt: 0, attention: true });
    expect(normal.svg).not.toContain("agent-card-attention");
    expect(attention.svg).toContain("agent-card-attention");
    expect(attention.svg).toContain('data-semantic-color="normal"');
  });

  it("derives the fixed 192x208 pet grid and falls back when dimensions do not fit", () => {
    expect(petCatalog).toHaveLength(13);
    expect(petCatalog.every((pet) => pet.gridStatus !== "unconfirmed-static")).toBe(true);
    expect(petCatalog.filter((pet) => pet.grid?.rows === 9)).toHaveLength(12);
    expect(petCatalog.find((pet) => pet.id === "glaucira-blue-dragon")?.grid?.rows).toBe(11);
    expect(derivePetGrid({ width: 1536, height: 1873 })).toBeUndefined();
    expect(derivePetGrid({ width: 1728, height: 1872 })).toBeUndefined();
  });

  it("can address Glaucira extra rows directly for visual inspection", () => {
    const row = resolvePetRowSprite("glaucira-blue-dragon", 10, true);
    expect(row.row).toBe(10);
    expect(row.frames).toBe(1);
    expect(row.animate).toBe(false);
    expect(row.frameCountStatus).toBe("inferred-static");
  });

  it("uses manifest frame counts for black-dragon-pet states", () => {
    const expected = { idle: 6, runRight: 8, runLeft: 8, waving: 4, jumping: 5, failed: 8, waiting: 6, running: 6, review: 6 };
    for (const [name, frames] of Object.entries(expected)) {
      const row = resolvePetRowSprite("black-dragon-pet", petCatalog.find((pet) => pet.id === "black-dragon-pet")!.states![name as keyof typeof expected]!.row, true);
      expect(row.frames, name).toBe(frames);
      expect(row.animate, name).toBe(true);
      expect(row.frameCountStatus, name).toBe("manifest-confirmed");
    }
  });

  it("falls back to one static frame when a pet has no frame manifest", () => {
    const unmanifestedPets = petCatalog.filter((pet) => !pet.states);
    expect(unmanifestedPets).toHaveLength(12);
    for (const pet of unmanifestedPets) {
      const row = resolvePetRowSprite(pet.id, 4, true);
      expect(row.frames, pet.id).toBe(1);
      expect(row.animate, pet.id).toBe(false);
      expect(row.frameCountStatus, pet.id).toBe("inferred-static");
    }
    const lifecycle = resolvePetSprite("belayer-cat", "thinking", initialLifecycleAnimationMapping, true);
    expect(lifecycle.frames).toBe(1);
    expect(lifecycle.animate).toBe(false);
    expect(lifecycle.frameCountStatus).toBe("inferred-static");
  });

  it("keeps Attention and Actor multiplicity as separate outer-frame cues", () => {
    const output = renderAgentCard({ card, width: 320, lod: "middle", displayAt: 0, attention: true, actorCount: 3 });
    expect(output.svg.match(/data-actor-layer=/g)).toHaveLength(3);
    expect(output.svg.match(/agent-card-attention/g)).toHaveLength(3);
    expect(output.bounds.w).toBe(330);
  });

  it("leaves a human lifecycle state absent", () => {
    const human = { ...card, agentKind: "human" as const, lifecycleState: undefined, semanticColor: undefined, model: "" };
    const output = renderAgentCard({ card: human, width: 280, lod: "middle", displayAt: 0 });
    expect(output.svg).toContain("agent-semantic-unset");
    expect(output.svg).not.toContain("unobservable");
  });

  it("keeps the real-data fixture within scope and covers all lifecycle states", () => {
    expect(fixture.cards).toHaveLength(25);
    expect(new Set(fixture.cards.map((item) => item.lifecycleState).filter(Boolean))).toEqual(new Set([
      "starting", "thinking", "tool-running", "awaiting-user", "blocked",
      "idle", "completed", "failed", "disconnected", "unobservable",
    ]));
    expect(fixture.cards.filter((item) => item.extraction.syntheticFields.includes("lifecycleState"))).toHaveLength(6);
    expect(fixture.cards.filter((item) => item.extraction.syntheticFields.includes("actorCount"))).toHaveLength(2);
    expect(fixture.cards.filter((item) => item.attention)).toHaveLength(2);
    expect(fixture.selectionStats.titleNonEmpty).toBeGreaterThanOrEqual(18);
    expect(fixture.selectionStats.messageNonEmpty).toBeGreaterThanOrEqual(15);
    expect(fixture.selectionStats.longestUntruncatedTitle).toBeGreaterThan(42);
    const human = fixture.cards.find((item) => item.agentKind === "human");
    expect(human?.name).toBe("akaghef");
    expect(human).not.toHaveProperty("lifecycleState");
    expect(Math.max(...fixture.cards.map((item) => [...item.message].length))).toBeGreaterThan(18_000);
  });
});
