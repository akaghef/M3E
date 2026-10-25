import { AGENT_LIFECYCLE_STATES, type AgentCardData, type AgentCardLod } from "./agent_node";
import type { TreeNode } from "./types";

/** Authored display data, stored with the ordinary node. No runtime transport. */
export const AGENT_NODE_ATTRIBUTE = "m3e:agent";
export type AgentNodeAttributes = Omit<AgentCardData, "id" | "title" | "message"> & { version: 1 };

export function readAgentNode(node: TreeNode | undefined): AgentCardData | null {
  const raw = node?.attributes?.[AGENT_NODE_ATTRIBUTE];
  if (!node || !raw) return null;
  let data: AgentNodeAttributes;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || data.version !== 1 || !["ai", "human"].includes(data.agentKind)
    || typeof data.icon !== "string" || !data.icon || typeof data.model !== "string"
    || typeof data.lastActiveAt !== "string" || !Number.isFinite(Date.parse(data.lastActiveAt))
    || typeof data.attention !== "boolean" || ![1, 2, 3].includes(data.actorCount)
    || [data.name, data.realm, data.team, data.role].some(value => value !== undefined && typeof value !== "string")
    || (data.lifecycleState !== undefined && !AGENT_LIFECYCLE_STATES.includes(data.lifecycleState))
    || (data.semanticColor !== undefined && !["normal", "awaiting", "stalled", "done", "error", "archived", "unset"].includes(data.semanticColor))) return null;
  return { ...data, id: node.id, title: node.text, message: node.details };
}

export function agentNodeMetric(card: AgentCardData): { w: number; h: number } {
  const stack = (card.actorCount - 1) * 5;
  return { w: 320 + stack, h: 128 + stack };
}

export function agentNodeLod(zoom: number): AgentCardLod {
  return zoom < .4 ? "far" : zoom < .8 ? "middle" : "near";
}
