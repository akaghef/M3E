import { expect, it } from 'vitest';
import { renderAgentCard, renderPetSprite } from '../../src/labs/node/agent_node';
import { petCatalog, resolvePetSprite, resolvePetRowSprite, initialLifecycleAnimationMapping } from '../../src/labs/node/pet_catalog';
import session from '../../src/labs/node/fixtures/current-session.json';
import type { AgentCardData } from '../../src/labs/node/agent_node';
const card = session as AgentCardData;

it('middle retains icon/name/title/time and excludes other content', () => {
  const sprite = resolvePetSprite('black-dragon-pet', 'thinking', initialLifecycleAnimationMapping, true);
  const result = renderAgentCard({ card, lod: 'middle', width: 320, displayAt: card.lastActiveAt, sprite });
  expect(result.svg).toContain('agent-card-pet');
  expect(result.svg.match(/data-field="([^"]+)"/g)).toEqual(['data-field="name"', 'data-field="time"', 'data-field="title"']);
  expect(result.svg).not.toContain('agent-card-outer');
  expect(result.bounds.h).toBe(60);
});

it('near keeps Realm/team distinct and compact at every width', () => {
  for (const width of [280, 320, 620]) {
    const result = renderAgentCard({ card, lod: 'near', width, displayAt: card.lastActiveAt });
    expect(result.bounds.h).toBe(128);
    expect(result.svg).toContain('data-field="team"');
    expect(result.svg).not.toContain('data-field="role"');
    expect(result.svg).not.toMatch(/>Title<|>msg<|agent-card-outer/);
  }
});

it('pending imports cannot animate or pretend to be cropped icons', () => {
  const pending = petCatalog.filter(pet => !pet.atlas);
  expect(pending).toHaveLength(12);
  for (const pet of pending) {
    const sprite = resolvePetSprite(pet.id, 'thinking', initialLifecycleAnimationMapping, true);
    expect(sprite.animate).toBe(false);
    expect(pet.grid).toBeUndefined();
    expect(sprite.frameWidth).toBe(pet.sheet.width);
    const svg = renderPetSprite(sprite, 0, 0, 48, 44, 'test');
    expect(svg).toContain('未取込');
    expect(svg).not.toMatch(/<image|<animate/);
  }
  expect(() => resolvePetSprite('missing', 'thinking', initialLifecycleAnimationMapping, true)).toThrow('Unknown pet');
});

for (const [name, entry] of Object.entries(petCatalog.find(pet => pet.id === 'black-dragon-pet')!.atlas!.animations)) {
  it(`${name}: one frame at every playback phase and loop boundary`, () => {
    const sprite = resolvePetRowSprite('black-dragon-pet', entry.row, true);
    const svg = renderPetSprite(sprite, 0, 0, 256, 224, 'test');
    const transitions = [...svg.matchAll(/attributeName="opacity" values="([^"]+)" keyTimes="([^"]+)"/g)];
    expect(transitions).toHaveLength(entry.frames.length);
    for (let step = 0; step <= entry.frames.length; step++) {
      expect(transitions.reduce((sum, match) => sum + Number(match[1].split(';')[step]), 0)).toBe(1);
    }
    const stopped = renderPetSprite({ ...sprite, animate: false }, 0, 0, 256, 224, 'test');
    expect(stopped.match(/data-sprite-frame=/g)).toHaveLength(1);
    expect(stopped).not.toContain('<animate');
  });
}
