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

const ITERATIONS = { unconstrained: 80, userConstraints: 0, allConstraints: 40, gridSnap: 0 } as const;
const SPACE = {
  tight: { edgeLength: 110, groupPadding: 20, canvas: 1800 },
  normal: { edgeLength: 180, groupPadding: 52, canvas: 2400 },
  loose: { edgeLength: 280, groupPadding: 108, canvas: 3400 },
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
  const nodes = reduced.nodes.map((node, index) => ({ ...node, width: node.w, height: node.h, ...deterministicInitialPosition(node.id, index) }));
  if (options.subtype === "scatter") {
    nodes.forEach((node) => {
      const saved = options.savedPositions?.[node.sourceNodeId || node.id];
      if (saved) { node.x = saved.x + node.w / 2; node.y = saved.y; }
    });
  } else {
    const indexById = new Map(nodes.map((node, index) => [node.id, index]));
    const links: cola.Link[] = reduced.edges.filter((edge) => !edge.internal).map((edge) => ({ source: indexById.get(edge.sourceId)!, target: indexById.get(edge.targetId)!, length: space.edgeLength }));
    const layout = new cola.Layout().size([space.canvas, space.canvas]).nodes(nodes).links(links).avoidOverlaps(true).handleDisconnected(false);
    if (options.subtype === "cluster") layout.groups(reduced.groups);
    layout.start(ITERATIONS.unconstrained, ITERATIONS.userConstraints, ITERATIONS.allConstraints, ITERATIONS.gridSnap, false);
  }
  const pos: Record<string, DispersePosition> = {};
  nodes.forEach((node) => { pos[node.id] = { x: Math.round((node.x! - node.w / 2) * 1000) / 1000, y: Math.round(node.y! * 1000) / 1000, w: node.w, h: node.h, depth: node.depth, sourceNodeId: node.sourceNodeId }; });
  const groups = [...reduced.groupMembers.entries()].flatMap(([id, memberIds]) => {
    const members = memberIds.filter((memberId) => pos[memberId]);
    if (members.length < 2) return [];
    const box = boundingBox(Object.fromEntries(members.map((memberId) => [memberId, pos[memberId]!])));
    return [{ id, memberIds: members, x: box.x - space.groupPadding, y: box.y - space.groupPadding, w: box.w + space.groupPadding * 2, h: box.h + space.groupPadding * 2 }];
  });
  const box = boundingBox(pos);
  return { pos, order: nodes.map((node) => node.id), edges: reduced.edges, groups, totalWidth: Math.ceil(box.x + box.w + space.groupPadding), totalHeight: Math.ceil(box.y + box.h / 2 + space.groupPadding) };
}

export const disperseLayoutIterationPolicy = { ...ITERATIONS, convergence: "fixed iteration budget; no unbounded running pass" } as const;
