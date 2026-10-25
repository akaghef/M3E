import { attributeScore, VIEW_FILTER_AXES, type FilterAxis, type FilterValue } from "./view_filter_axes";
export interface FilterNode { id: string; attributes?: Record<string, string> }
export interface FilterLink extends FilterNode { sourceNodeId: string; targetNodeId: string }
export interface FilterInput { nodes: readonly FilterNode[]; links: readonly FilterLink[] }
export type FilterSelection = Readonly<Record<string, FilterValue>>;
export interface AxisState { enabled: boolean; active: boolean; candidates: string[] }
export interface FilterResult {
  axes: Record<string, AxisState>; active: boolean; nodes: Set<string>; links: Set<string>;
  nodeCount: number; linkCount: number;
}
export const defaultFilterSelection = (axes = VIEW_FILTER_AXES): FilterSelection =>
  Object.fromEntries(axes.map(axis => [axis.id, Array.isArray(axis.all) ? [...axis.all] : axis.all]));
export function attributeValue(node: FilterNode, axis: FilterAxis): string | undefined {
  return axis.keys.map(key => node.attributes?.[key]).find(value => value != null);
}
export function domainNames(raw: string | undefined): string[] {
  return [...new Set((raw || "").split(",").map(value => value.trim()).filter(Boolean))];
}
export function axisMatches(node: FilterNode, axis: FilterAxis, value: FilterValue): boolean {
  const raw = attributeValue(node, axis);
  if (axis.kind === "multiple") return Array.isArray(value) && (!value.length || domainNames(raw).some(name => value.includes(name)));
  if (value === axis.all) return true;
  if (axis.kind === "exact") return raw === value;
  const option = axis.options.find(option => option.value === value);
  return option?.minimum !== undefined && attributeScore(raw) >= option.minimum;
}
export function evaluateViewFilter(input: FilterInput, selection: FilterSelection, definitions = VIEW_FILTER_AXES): FilterResult {
  const axes: Record<string, AxisState> = {};
  for (const axis of definitions) {
    const items = axis.target === "node" ? input.nodes : input.links;
    const enabled = items.some(item => axis.keys.some(key => Object.prototype.hasOwnProperty.call(item.attributes || {}, key)));
    const value = selection[axis.id] ?? axis.all;
    axes[axis.id] = { enabled, active: enabled && (Array.isArray(value) ? value.length > 0 : value !== axis.all),
      candidates: axis.kind === "multiple" ? [...new Set(items.flatMap(item => domainNames(attributeValue(item, axis))))].sort() : [] };
  }
  const matches = (item: FilterNode, target: FilterAxis["target"]) => definitions.every(axis =>
    axis.target !== target || !axes[axis.id].active || axisMatches(item, axis, selection[axis.id] ?? axis.all));
  const base = new Set(input.nodes.filter(node => matches(node, "node")).map(node => node.id));
  const links = input.links.filter(link => matches(link, "GraphLink") && base.has(link.sourceNodeId) && base.has(link.targetNodeId));
  const endpoints = new Set(links.flatMap(link => [link.sourceNodeId, link.targetNodeId]));
  const requiresEndpoint = definitions.some(axis => axis.target === "GraphLink" && axes[axis.id].active);
  return { axes, active: Object.values(axes).some(axis => axis.active),
    nodes: requiresEndpoint ? new Set([...base].filter(id => endpoints.has(id))) : base,
    links: new Set(links.map(link => link.id)), nodeCount: input.nodes.length, linkCount: input.links.length };
}
export const edgeMatches = (result: FilterResult, source: string, target: string): boolean => result.nodes.has(source) && result.nodes.has(target);
