/** Physics uses world-space centres; rendering/camera and persistence are adapters. */
export type ForceMode = "Radial" | "Disperse";
export type ForceStatus = "running" | "paused" | "settled" | "budget" | "blocked";
export interface ForceNode {
  id: string;
  label: string;
  parentId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pinned?: boolean;
}
export interface ForceLink { id: string; source: string; target: string; weight?: number; }
export interface ForceGraph { nodes: ForceNode[]; links: ForceLink[]; }
export interface ForceParameters { repulsion: number; length: number; spring: number; gravity: number; }
export interface ForceRect { x: number; y: number; w: number; h: number; }
export interface ForceGroup extends ForceRect { id: string; label: string; members: string[]; }
export interface ForceVisibleNode extends ForceNode { collapsed: boolean; hiddenCount: number; }
export interface ForceVisibleLink extends ForceLink { kind: "tree" | "graph"; weight: number; }
export interface ForceSnapshot {
  nodes: ForceVisibleNode[];
  groups: ForceGroup[];
  links: ForceVisibleLink[];
  mode: ForceMode;
  parameters: ForceParameters;
  status: ForceStatus;
  steps: number;
  remaining: number;
  maxMove: number;
  violations: number;
}
export interface ForceSimulation {
  snapshot(): ForceSnapshot;
  step(): ForceSnapshot;
  setParameters(patch: Partial<ForceParameters>): void;
  setMode(mode: ForceMode): void;
  setCollapsed(id: string, collapsed: boolean): void;
  setPinned(id: string, pinned: boolean): void;
  beginDrag(id: string, group?: boolean): void;
  moveDrag(dx: number, dy: number): void;
  endDrag(): void;
  pause(): void;
  reheat(): void;
  resetPositions(): void;
}
