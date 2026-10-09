import type { AgentCardSprite, AgentLifecycleState } from "../shared/agent_node";
import catalogJson from "../labs/node/pet_catalog.json";
import { assertPetAtlas, type PetAtlas } from "../shared/pet_sprite";

export type PetAnimationName = "idle" | "runRight" | "runLeft" | "waving" | "jumping" | "failed" | "waiting" | "running" | "review";
export type LifecycleAnimationMapping = Record<AgentLifecycleState, PetAnimationName | null>;

export interface PetState { row: number; frames: number; fps: number }
export interface PetCatalogEntry {
  id: string;
  displayName: string;
  sheet: { width: number; height: number };
  gridStatus: AgentCardSprite["gridStatus"];
  grid?: { columns: number; rows: number; frameWidth: number; frameHeight: number };
  states?: Partial<Record<PetAnimationName, PetState>>;
  evidence: string;
  atlas?: PetAtlas;
}

const assetUrls = import.meta.glob<string>("../labs/node/pets/*/spritesheet.webp", { eager: true, query: "?url", import: "default" });

const catalogSource = catalogJson.pets;
// Only a reviewed region manifest enables playback. Dimensions never imply a grid.
const atlases = import.meta.glob<PetAtlas>("../labs/node/pets/*/frame-regions.json", { eager: true, import: "default" });
export const petCatalog: PetCatalogEntry[] = catalogSource.map(pet => {
  const atlas = atlases[`../labs/node/pets/${pet.id}/frame-regions.json`];
  if (pet.status === "verified") {
    assertPetAtlas(atlas, pet.sourceSha256, pet.sheet);
    return { ...pet, atlas, gridStatus: "visually-verified-regions", grid: {
      columns: 0, rows: Object.keys(atlas.animations).length,
      frameWidth: atlas.viewport.width, frameHeight: atlas.viewport.height,
    }, states: Object.fromEntries(Object.entries(atlas.animations).map(([name, entry]) => [name, {
      row: entry.row, frames: entry.frames.length, fps: entry.fps,
    }])) };
  }
  return { ...pet, gridStatus: "unconfirmed-static", grid: undefined, states: undefined };
});
export const initialLifecycleAnimationMapping = catalogJson.lifecycleAnimationCandidates as LifecycleAnimationMapping;
export const petAnimationNames: PetAnimationName[] = ["idle", "runRight", "runLeft", "waving", "jumping", "failed", "waiting", "running", "review"];
export function isPetGridConfirmed(pet: PetCatalogEntry): boolean {
  return pet.gridStatus === "visually-verified-regions";
}
function requirePet(petId: string): PetCatalogEntry {
  const pet = petCatalog.find(item => item.id === petId);
  if (!pet) throw new Error(`Unknown pet: ${petId}`);
  return pet;
}
function spriteFor(pet: PetCatalogEntry, row: number, animate: boolean): AgentCardSprite {
  const entry = pet.atlas ? Object.values(pet.atlas.animations).find(value => value.row === row) : undefined;
  if (pet.atlas && !entry) throw new Error(`Unknown animation row ${row} for ${pet.id}`);
  return { petId: pet.id, imageUrl: assetUrls[`../labs/node/pets/${pet.id}/spritesheet.webp`], sheetWidth: pet.sheet.width, sheetHeight: pet.sheet.height,
    frameWidth: pet.atlas?.viewport.width ?? pet.sheet.width, frameHeight: pet.atlas?.viewport.height ?? pet.sheet.height,
    row, frames: entry?.frames.length ?? 1, fps: entry?.fps ?? 1, sourceFrames: entry?.frames,
    animate: Boolean(entry && animate), gridStatus: pet.gridStatus,
    frameCountStatus: entry ? "visually-verified-regions" : "inferred-static" };
}
export function resolvePetSprite(petId: string, state: AgentLifecycleState | undefined, mapping: LifecycleAnimationMapping, animate: boolean): AgentCardSprite {
  const pet = requirePet(petId);
  const name = state ? mapping[state] : null;
  const entry = name ? pet.atlas?.animations[name] : undefined;
  return spriteFor(pet, entry?.row ?? 0, Boolean(animate && entry));
}
export function resolvePetRowSprite(petId: string, requestedRow: number, animate: boolean): AgentCardSprite {
  const pet = requirePet(petId);
  return spriteFor(pet, pet.atlas ? Math.max(0, Math.min(Math.trunc(requestedRow), Object.keys(pet.atlas.animations).length - 1)) : 0, animate);
}
