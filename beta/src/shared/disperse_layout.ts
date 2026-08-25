/// <reference path="./webcola.ts" />
import * as cola from "webcola";

export type DisperseSubtype = "scatter" | "cluster" | "force";
export type DisperseSpace = "tight" | "normal" | "loose";
export type SuperNodeFootprint = "descendant-area" | "fixed";
export type EdgeAggregation = "bundle" | "weighted" | "hide-internal";

export interface DisperseNodeMetric { w: number; h: number; }
export interface DisperseGraphLink { id: string; sourceNodeId: string; targetNodeId: string; }
export interface DisperseGraph {
  nodeIds: string[];
  childrenOf: (id: string) => string[];
  graphLinks: DisperseGraphLink[];
}
export interface DisperseLayoutOptions {
  displayRootId?: string;
  subtype: DisperseSubtype;
  space?: DisperseSpace;
  collapsedNodeIds?: string[];
  superNodeFootprint?: SuperNodeFootprint;
  edgeAggregation?: EdgeAggregation;
  savedPositions?: Record<string, { x: number; y: number }>;
}
export interface DispersePosition extends DisperseNodeMetric { x: number; y: number; depth: number; sourceNodeId?: string; }
export interface DisperseEdge { id: string; sourceId: string; targetId: string; weight: number; internal: boolean; }
export interface DisperseGroupBoundary { id: string; memberIds: string[]; x: number; y: number; w: number; h: number; }
export interface DisperseLayoutResult {
  pos: Record<string, DispersePosition>;
  order: string[];
  edges: DisperseEdge[];
  groups: DisperseGroupBoundary[];
  totalWidth: number;
  totalHeight: number;
}

interface ReducedNode extends DisperseNodeMetric { id: string; depth: number; sourceNodeId?: string; }
interface ReducedGraph { nodes: ReducedNode[]; edges: DisperseEdge[]; groups: cola.Group[]; groupMembers: Map<string, string[]>; }

// Fixed rather than time-bound: enough constraint passes to finish the rectangular
// collision projection on the 100-node lab corpus without a live simulation loop.
const ITERATIONS = { unconstrained: 80, userConstraints: 0, allConstraints: 240, gridSnap: 0 } as const;
const SPACE = {
  tight: { edgeLength: 110, groupPadding: 20, nodeGap: 0, canvas: 1800 },
  normal: { edgeLength: 180, groupPadding: 52, nodeGap: 16, canvas: 2400 },
  loose: { edgeLength: 280, groupPadding: 108, nodeGap: 40, canvas: 3400 },
} as const;

function stableSeed(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function deterministicInitialPosition(id: string, index: number): { x: number; y: number } {
  const hash = stableSeed(id);
  return { x: 300 + (hash % 1300) + (index % 5) * 37, y: 240 + (Math.floor(hash / 2048) % 1100) + (index % 7) * 29 };
}

/**
 * WebCola preserves enough of its starting geometry that a hash-scattered
 * hierarchy can settle into a long strip once nested group constraints apply.
 * Seed cluster members by their tree groups: root children occupy a ring and
 * each descendant stays inside its parent's angular sector.
 */
function clusterInitialPositions(nodes: ReducedNode[], edges: DisperseEdge[], canvas: number, edgeLength: number): Map<string, { x: number; y: number }> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  edges.filter((edge) => edge.id.startsWith("tree:") && !edge.internal).forEach((edge) => {
    const list = children.get(edge.sourceId) || [];
    if (!list.includes(edge.targetId)) list.push(edge.targetId);
    children.set(edge.sourceId, list);
  });
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  const place = (id: string, x: number, y: number, angle: number, sector: number): void => {
    if (visited.has(id) || !nodeById.has(id)) return;
    visited.add(id);
    positions.set(id, { x, y });
    const childIds = children.get(id) || [];
    childIds.forEach((childId, index) => {
      const child = nodeById.get(childId);
      const parent = nodeById.get(id);
      if (!child || !parent) return;
      const childAngle = angle - sector / 2 + sector * (index + 0.5) / childIds.length;
      const radius = edgeLength + Math.max(parent.w, child.w) / 2 + Math.max(parent.h, child.h) / 4;
      place(childId, x + Math.cos(childAngle) * radius, y + Math.sin(childAngle) * radius, childAngle, sector / childIds.length * 0.82);
    });
  };
  const root = nodes.find((node) => node.depth === 0);
  if (root) place(root.id, canvas / 2, canvas / 2, -Math.PI / 2, Math.PI * 2);
  nodes.forEach((node, index) => {
    if (!positions.has(node.id)) positions.set(node.id, deterministicInitialPosition(node.id, index));
  });
  return positions;
}

function footprint(memberIds: string[], metrics: Record<string, DisperseNodeMetric>, mode: SuperNodeFootprint): DisperseNodeMetric {
  if (mode === "fixed") return { w: 220, h: 64 };
  const area = memberIds.reduce((sum, id) => sum + (metrics[id]?.w ?? 0) * (metrics[id]?.h ?? 0), 0);
  const widest = Math.max(...memberIds.map((id) => metrics[id]?.w ?? 0), 120);
  const tallest = Math.max(...memberIds.map((id) => metrics[id]?.h ?? 0), 48);
  const side = Math.sqrt(Math.max(area, 1));
  return { w: Math.max(widest, Math.round(side * 1.15)), h: Math.max(tallest, Math.round(side * 0.72)) };
}

function reduceGraph(graph: DisperseGraph, metrics: Record<string, DisperseNodeMetric>, options: DisperseLayoutOptions): ReducedGraph {
  const rootId = options.displayRootId || graph.nodeIds[0] || "";
  const collapsed = new Set(options.collapsedNodeIds || []);
  const parent = new Map<string, string>();
  graph.nodeIds.forEach((id) => graph.childrenOf(id).forEach((child) => parent.set(child, id)));
  const representative = new Map<string, string>();
  const members = new Map<string, string[]>();
  const depth = new Map<string, number>();
  const visit = (id: string, level: number, inherited?: string): void => {
    const rep = inherited || (collapsed.has(id) ? `collapse:${id}` : id);
    representative.set(id, rep);
    depth.set(rep, Math.min(depth.get(rep) ?? level, level));
    const list = members.get(rep) || [];
    list.push(id);
    members.set(rep, list);
    graph.childrenOf(id).forEach((child) => visit(child, level + 1, rep === id && !collapsed.has(id) ? undefined : rep));
  };
  if (rootId) visit(rootId, 0);
  graph.nodeIds.filter((id) => !representative.has(id)).forEach((id) => visit(id, 0));

  const nodes = [...members.entries()].map(([id, memberIds]) => {
    const sourceNodeId = id.startsWith("collapse:") ? id.slice("collapse:".length) : undefined;
    return { id, ...(sourceNodeId ? footprint(memberIds, metrics, options.superNodeFootprint || "descendant-area") : metrics[id]!), depth: depth.get(id) ?? 0, sourceNodeId };
  }).filter((node) => Number.isFinite(node.w) && Number.isFinite(node.h));

  const aggregate = new Map<string, DisperseEdge>();
  const addEdge = (id: string, sourceNodeId: string, targetNodeId: string): void => {
    const sourceId = representative.get(sourceNodeId) || sourceNodeId;
    const targetId = representative.get(targetNodeId) || targetNodeId;
    const internal = sourceId === targetId;
    const key = internal ? `internal:${sourceId}` : `${sourceId}->${targetId}`;
    const prior = aggregate.get(key);
    aggregate.set(key, prior ? { ...prior, weight: prior.weight + 1 } : { id, sourceId, targetId, weight: 1, internal });
  };
  graph.nodeIds.forEach((sourceId) => graph.childrenOf(sourceId).forEach((targetId) => addEdge(`tree:${sourceId}:${targetId}`, sourceId, targetId)));
  graph.graphLinks.forEach((edge) => addEdge(edge.id, edge.sourceNodeId, edge.targetNodeId));
  const edges = [...aggregate.values()].filter((edge) => !(options.edgeAggregation === "hide-internal" && edge.internal));

  const groupMembers = new Map<string, string[]>();
  const makeGroup = (id: string): number | undefined => {
    const childGroups: number[] = [];
    const directLeaves: string[] = [];
    graph.childrenOf(id).forEach((child) => {
      const childGroup = makeGroup(child);
      if (childGroup === undefined) directLeaves.push(representative.get(child)!);
      else childGroups.push(childGroup);
    });
    const own = representative.get(id)!;
    if (!own.startsWith("collapse:")) directLeaves.push(own);
    const uniqueLeaves = [...new Set(directLeaves)];
    const allMembers = [own, ...graph.childrenOf(id).flatMap((child) => groupMembers.get(child) || [])].filter((member, index, all) => all.indexOf(member) === index);
    groupMembers.set(id, allMembers);
    if (allMembers.length < 2) return undefined;
    const groupIndex = groups.length;
    groups.push({ leaves: uniqueLeaves.map((leaf) => nodes.findIndex((node) => node.id === leaf)).filter((index) => index >= 0), groups: childGroups, padding: SPACE[options.space || "normal"].groupPadding });
    return groupIndex;
  };
  const groups: cola.Group[] = [];
  if (rootId) makeGroup(rootId);
  return { nodes, edges, groups, groupMembers };
}

function boundingBox(pos: Record<string, DispersePosition>): { x: number; y: number; w: number; h: number } {
  const values = Object.values(pos);
  if (!values.length) return { x: 0, y: 0, w: 0, h: 0 };
  const left = Math.min(...values.map((node) => node.x));
  const top = Math.min(...values.map((node) => node.y - node.h / 2));
  const right = Math.max(...values.map((node) => node.x + node.w));
  const bottom = Math.max(...values.map((node) => node.y + node.h / 2));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function layoutDisperse(graph: DisperseGraph, metrics: Record<string, DisperseNodeMetric>, options: DisperseLayoutOptions): DisperseLayoutResult {
  const reduced = reduceGraph(graph, metrics, options);
  const space = SPACE[options.space || "normal"];
  // WebCola consumes width/height; retain w/h for the M3E layout seam result.
  const clusterPositions = options.subtype === "cluster"
    ? clusterInitialPositions(reduced.nodes, reduced.edges, space.canvas, space.edgeLength)
    : undefined;
  const collisionGap = options.subtype === "cluster" ? space.nodeGap : 0;
  const nodes = reduced.nodes.map((node, index) => ({
    ...node,
    // WebCola avoids overlaps of these collision rectangles. Enlarging each
    // dimension by one gap yields exactly that minimum box-to-box distance.
    width: node.w + collisionGap,
    height: node.h + collisionGap,
    ...(clusterPositions?.get(node.id) || deterministicInitialPosition(node.id, index)),
  }));
  if (options.subtype === "scatter") {
    nodes.forEach((node) => {
      const saved = options.savedPositions?.[node.sourceNodeId || node.id];
      if (saved) { node.x = saved.x + node.w / 2; node.y = saved.y; }
    });
  } else {
    const indexById = new Map(nodes.map((node, index) => [node.id, index]));
    const links: cola.Link[] = reduced.edges.filter((edge) => !edge.internal).map((edge) => ({ source: indexById.get(edge.sourceId)!, target: indexById.get(edge.targetId)!, length: space.edgeLength }));
    const layout = new cola.Layout()
      .size([space.canvas, space.canvas])
      .nodes(nodes)
      .links(links)
      .linkDistance(space.edgeLength)
      .avoidOverlaps(true)
      .handleDisconnected(false);
    if (options.subtype === "cluster") layout.groups(reduced.groups);
    // Cluster must retain its group-aware seed. Running an unconstrained phase
    // first discards it, then lets nested bounds settle into a long strip.
    layout.start(options.subtype === "cluster" ? 0 : ITERATIONS.unconstrained, ITERATIONS.userConstraints, ITERATIONS.allConstraints, ITERATIONS.gridSnap, false);
  }
  const pos: Record<string, DispersePosition> = {};
  nodes.forEach((node) => { pos[node.id] = { x: Math.round((node.x! - node.w / 2) * 1000) / 1000, y: Math.round(node.y! * 1000) / 1000, w: node.w, h: node.h, depth: node.depth, sourceNodeId: node.sourceNodeId }; });
  // WebCola is free to settle around a negative origin. Normalize calculated
  // layouts for a bounded canvas; scatter retains its exact saved coordinates.
  if (options.subtype !== "scatter") {
    const rawBox = boundingBox(pos);
    Object.values(pos).forEach((node) => {
      node.x = Math.round((node.x - rawBox.x + space.groupPadding) * 1000) / 1000;
      node.y = Math.round((node.y - rawBox.y + space.groupPadding) * 1000) / 1000;
    });
  }
  const groups = [...reduced.groupMembers.entries()].flatMap(([id, memberIds]) => {
    const members = memberIds.filter((memberId) => pos[memberId]);
    if (members.length < 2) return [];
    const box = boundingBox(Object.fromEntries(members.map((memberId) => [memberId, pos[memberId]!])));
    return [{ id, memberIds: members, x: box.x - space.groupPadding, y: box.y - space.groupPadding, w: box.w + space.groupPadding * 2, h: box.h + space.groupPadding * 2 }];
  });
  const box = boundingBox(pos);
  return { pos, order: nodes.map((node) => node.id), edges: reduced.edges, groups, totalWidth: Math.ceil(box.x + box.w + space.groupPadding), totalHeight: Math.ceil(box.y + box.h + space.groupPadding) };
}

export const disperseLayoutIterationPolicy = { ...ITERATIONS, convergence: "fixed iteration budget; no unbounded running pass" } as const;

