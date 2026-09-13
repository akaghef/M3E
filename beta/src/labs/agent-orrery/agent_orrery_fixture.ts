export type AgentState = "working" | "waiting" | "attention" | "finished";
export type NodeKind = "text" | "image" | "folder" | "alias" | "agent";

export type OrreryNode = {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  state?: AgentState;
  promptRole?: string;
};

export type OrreryEdge = {
  from: string;
  to: string;
  relation: "spawn" | "communication" | "assignment";
};

export const AGENT_ORRERY_FIXTURE = {
  breadcrumb: "Disperse / Force / Orrery",
  note: "node type and force profile are separate axes.",
  promptRoleNote: "Prompt role is a runtime/execution adapter; it is not future canonical Role/Contract.",
  nodes: [
    { id: "text", kind: "text", label: "Research brief", x: 170, y: 210 },
    { id: "image", kind: "image", label: "Reference image", x: 430, y: 125 },
    { id: "folder", kind: "folder", label: "Experiment", x: 440, y: 330 },
    { id: "alias", kind: "alias", label: "↗ Shared notes", x: 700, y: 190 },
    { id: "lead", kind: "agent", label: "Aiko", promptRole: "lead", state: "working", x: 720, y: 390 },
    { id: "review", kind: "agent", label: "Ren", promptRole: "review", state: "waiting", x: 930, y: 120 },
    { id: "tests", kind: "agent", label: "Mina", promptRole: "tests", state: "attention", x: 940, y: 335 },
    { id: "docs", kind: "agent", label: "Sora", promptRole: "docs", state: "finished", x: 1150, y: 225 },
  ] satisfies OrreryNode[],
  edges: [
    { from: "lead", to: "review", relation: "spawn" },
    { from: "lead", to: "tests", relation: "assignment" },
    { from: "review", to: "docs", relation: "communication" },
    { from: "folder", to: "lead", relation: "assignment" },
  ] satisfies OrreryEdge[],
};
