import type { MapCommand } from "../../shared/map_changes";
import type { MapColumns } from "./store";

export interface SyncIdentity {
  workspaceId: string;
  historyId: string;
  epoch: number;
}

export function sameSyncIdentity(expected: SyncIdentity, value: Partial<SyncIdentity>): boolean {
  return expected.workspaceId === value.workspaceId && expected.historyId === value.historyId && expected.epoch === value.epoch;
}

export type SyncMapOperation =
  | { mapOp: "create" }
  | { mapOp: "delete"; before?: string }
  | { mapOp: "rename"; newMapId: string }
  | { mapOp: "columns"; columns: MapColumns; before?: MapColumns };

export type SyncCommand = {
  mapId: string;
  command: MapCommand;
} & (SyncMapOperation | { mapOp?: undefined });
