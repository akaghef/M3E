// Test-only copy from agent-card-lab. Sprite imports are inert URLs; no image assets are copied.
import type { AgentCardSprite, AgentLifecycleState } from "../../../../src/shared/agent_card";
import catalogJson from "./pet_catalog.json";
const belayerCatUrl = "/synthetic-test-assets/pets/belayer-cat/spritesheet.webp";
const bilbyBirdUrl = "/synthetic-test-assets/pets/bilby-bird/spritesheet.webp";
const blackDragonUrl = "/synthetic-test-assets/pets/black-dragon-pet/spritesheet.webp";
const blueButtonBunnyUrl = "/synthetic-test-assets/pets/blue-button-bunny/spritesheet.webp";
const climberCatUrl = "/synthetic-test-assets/pets/climber-cat/spritesheet.webp";
const fatRobotUrl = "/synthetic-test-assets/pets/fat-robot/spritesheet.webp";
const foxdungeeUrl = "/synthetic-test-assets/pets/foxdungee/spritesheet.webp";
const glauciraUrl = "/synthetic-test-assets/pets/glaucira-blue-dragon/spritesheet.webp";
const greenSlimeUrl = "/synthetic-test-assets/pets/green-slime-v2/spritesheet.webp";
const machiDogUrl = "/synthetic-test-assets/pets/machi-dog/spritesheet.webp";
const momoBunnyUrl = "/synthetic-test-assets/pets/momo-bunny/spritesheet.webp";
const periOwlUrl = "/synthetic-test-assets/pets/peri-the-owl/spritesheet.webp";
const whiteDogUrl = "/synthetic-test-assets/pets/white-dog/spritesheet.webp";

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
}

interface PetCatalogSourceEntry extends Omit<PetCatalogEntry, "gridStatus" | "grid"> {
  gridStatus?: AgentCardSprite["gridStatus"];
  grid?: PetCatalogEntry["grid"];
}

const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 208;
const COLUMNS = 8;

const assetUrls: Record<string, string> = {
  "belayer-cat": belayerCatUrl,
  "bilby-bird": bilbyBirdUrl,
  "black-dragon-pet": blackDragonUrl,
  "blue-button-bunny": blueButtonBunnyUrl,
  "climber-cat": climberCatUrl,
  "fat-robot": fatRobotUrl,
  foxdungee: foxdungeeUrl,
  "glaucira-blue-dragon": glauciraUrl,
  "green-slime-v2": greenSlimeUrl,
  "machi-dog": machiDogUrl,
  "momo-bunny": momoBunnyUrl,
  "peri-the-owl": periOwlUrl,
  "white-dog": whiteDogUrl,
};

const catalogSource = catalogJson.pets as PetCatalogSourceEntry[];
const manifestStates = catalogSource.find((pet) => pet.id === "black-dragon-pet")?.states || {};

export function derivePetGrid(sheet: { width: number; height: number }): PetCatalogEntry["grid"] | undefined {
  if (sheet.width !== FRAME_WIDTH * COLUMNS || sheet.height % FRAME_HEIGHT !== 0) return undefined;
  return { columns: COLUMNS, rows: sheet.height / FRAME_HEIGHT, frameWidth: FRAME_WIDTH, frameHeight: FRAME_HEIGHT };
}

export const petCatalog: PetCatalogEntry[] = catalogSource.map((pet) => {
  const grid = derivePetGrid(pet.sheet);
  if (!grid) return { ...pet, gridStatus: "unconfirmed-static", grid: undefined, states: undefined };
  return {
    ...pet,
    grid,
    gridStatus: pet.id === "black-dragon-pet" ? "manifest-confirmed" : "dimension-confirmed",
    states: pet.states,
  };
});
export const initialLifecycleAnimationMapping = catalogJson.lifecycleAnimationCandidates as LifecycleAnimationMapping;
export const petAnimationNames = Object.keys(manifestStates) as PetAnimationName[];

export function isPetGridConfirmed(pet: PetCatalogEntry): boolean {
  return pet.gridStatus !== "unconfirmed-static";
}

export function resolvePetSprite(petId: string, state: AgentLifecycleState | undefined, mapping: LifecycleAnimationMapping, animate: boolean): AgentCardSprite {
  const pet = petCatalog.find((item) => item.id === petId) || petCatalog[0];
  const requestedAnimation = state ? mapping[state] : null;
  const confirmedState = isPetGridConfirmed(pet) && requestedAnimation ? pet.states?.[requestedAnimation] : undefined;
  return {
    petId: pet.id,
    imageUrl: assetUrls[pet.id],
    sheetWidth: pet.sheet.width,
    sheetHeight: pet.sheet.height,
    frameWidth: pet.grid?.frameWidth || 192,
    frameHeight: pet.grid?.frameHeight || 208,
    row: confirmedState?.row || 0,
    frames: confirmedState?.frames || 1,
    fps: confirmedState?.fps || 1,
    animate: animate && Boolean(confirmedState),
    gridStatus: pet.gridStatus,
    frameCountStatus: confirmedState ? "manifest-confirmed" : "inferred-static",
  };
}

export function resolvePetRowSprite(petId: string, requestedRow: number, animate: boolean): AgentCardSprite {
  const pet = petCatalog.find((item) => item.id === petId) || petCatalog[0];
  const grid = pet.grid;
  if (!grid) return resolvePetSprite(pet.id, undefined, initialLifecycleAnimationMapping, false);
  const row = Math.max(0, Math.min(Math.trunc(requestedRow), grid.rows - 1));
  const state = Object.values(pet.states || {}).find((candidate) => candidate?.row === row);
  return {
    petId: pet.id,
    imageUrl: assetUrls[pet.id],
    sheetWidth: pet.sheet.width,
    sheetHeight: pet.sheet.height,
    frameWidth: grid.frameWidth,
    frameHeight: grid.frameHeight,
    row,
    frames: state?.frames || 1,
    fps: state?.fps || 8,
    animate: animate && (state?.frames || 1) > 1,
    gridStatus: pet.gridStatus,
    frameCountStatus: state ? "manifest-confirmed" : "inferred-static",
  };
}
