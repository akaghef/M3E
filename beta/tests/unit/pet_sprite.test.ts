import { expect, it } from 'vitest';
import { assertPetAtlas } from '../../src/shared/pet_sprite';
import source from '../../src/labs/node/pets/black-dragon-pet/frame-regions.json';

it('accepts the reviewed atlas', () => {
  expect(() => assertPetAtlas(source, source.sourceSha256, source.sheet)).not.toThrow();
});
it('rejects stale evidence, missing frames and incomplete review', () => {
  for (const mutate of [
    (a: any) => a.sourceSha256 = '0'.repeat(64),
    (a: any) => a.review.animations.pop(),
    (a: any) => a.animations.idle.frames = [],
    (a: any) => a.animations.idle.fps = 0,
    (a: any) => a.animations.idle.frames[0].offsetX = 1000,
  ]) {
    const atlas = structuredClone(source); mutate(atlas);
    expect(() => assertPetAtlas(atlas, source.sourceSha256, source.sheet)).toThrow('Invalid pet import');
  }
});
