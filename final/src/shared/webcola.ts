/** Temporary compile-time contract until npm installs the declared webcola dependency. */
declare module "webcola" {
  export interface Node { x?: number; y?: number; width?: number; height?: number; }
  export interface Link<T extends Node = Node> { source: number | T; target: number | T; length?: number; }
  export interface Group { leaves?: number[]; groups?: number[]; padding?: number; }
  export class Layout {
    size(size: [number, number]): this;
    nodes(nodes: Node[]): this;
    links(links: Link[]): this;
  groups(groups: Group[]): this;
  avoidOverlaps(avoid: boolean): this;
  handleDisconnected(handle: boolean): this;
  linkDistance(distance: number): this;
  start(unconstrained: number, userConstraints: number, allConstraints: number, gridSnap: number, keepRunning: boolean): this;
}
}
