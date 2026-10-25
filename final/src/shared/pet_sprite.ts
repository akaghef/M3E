/** Explicit sprite import contract. See docs/protocols/agent-node-icon-import.md. */
export interface PetFrame { x: number; y: number; width: number; height: number; offsetX: number; offsetY: number }
export interface PetAtlas {
  version: number;
  sourceSha256: string;
  sheet: { width: number; height: number };
  viewport: { width: number; height: number };
  review: { sourceSha256: string; date: string; method: string; animations: string[] };
  animations: Record<string, { row: number; fps: number; frames: PetFrame[] }>;
}

export function assertPetAtlas(value: unknown, expectedHash: string, sheet: PetAtlas['sheet']): asserts value is PetAtlas {
  const atlas = value as PetAtlas | undefined;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(`Invalid pet import: ${message}`); };
  check(atlas && atlas.version === 1, 'missing region manifest');
  if (!atlas) return;
  check(/^[a-f0-9]{64}$/.test(expectedHash) && atlas.sourceSha256 === expectedHash, 'source hash');
  check(atlas.sheet?.width === sheet.width && atlas.sheet?.height === sheet.height, 'sheet dimensions');
  check(Number.isFinite(atlas.viewport?.width) && atlas.viewport.width > 0 && Number.isFinite(atlas.viewport?.height) && atlas.viewport.height > 0, 'viewport');
  const names = Object.keys(atlas.animations ?? {});
  check(names.length > 0 && atlas.animations.idle, 'idle animation required');
  check(atlas.review?.sourceSha256 === expectedHash && atlas.review.date && atlas.review.method, 'review must match source');
  check(Array.isArray(atlas.review.animations) && names.length === atlas.review.animations.length && names.every(name => atlas.review.animations.includes(name)), 'every animation needs review');
  const rows = new Set<number>();
  for (const entry of Object.values(atlas.animations)) {
    check(Number.isInteger(entry.row) && entry.row >= 0 && entry.row < names.length && !rows.has(entry.row), 'unique contiguous rows');
    rows.add(entry.row);
    check(Number.isFinite(entry.fps) && entry.fps > 0 && entry.fps <= 60, 'fps');
    check(Array.isArray(entry.frames) && entry.frames.length > 0, 'explicit frames');
    for (const f of entry.frames) {
      check([f.x, f.y, f.width, f.height].every(Number.isInteger), 'integer source rectangles');
      check(f.x >= 0 && f.y >= 0 && f.width > 0 && f.height > 0 && f.x + f.width <= sheet.width && f.y + f.height <= sheet.height, 'source bounds');
      check(Number.isFinite(f.offsetX) && Number.isFinite(f.offsetY) && f.offsetX >= 0 && f.offsetY >= 0 && f.offsetX + f.width <= atlas.viewport.width && f.offsetY + f.height <= atlas.viewport.height, 'viewport bounds');
    }
  }
}
