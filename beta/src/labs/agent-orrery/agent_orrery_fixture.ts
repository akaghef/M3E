export type AgentState = "queued" | "working" | "waiting" | "attention" | "finished";
export type TaskState = "queued" | "active" | "blocked" | "done";
export type TimelineKind =
  | "issue-created"
  | "assigned"
  | "finding"
  | "approval-requested"
  | "approval-granted"
  | "evidence-produced"
  | "gate-blocked"
  | "decision-requested"
  | "released"
  | "resolved";

export type Rg1Agent = {
  id: string;
  name: string;
  initials: string;
  promptRole: string;
  provider: "anthropic" | "openai";
  model: string;
  taskId: string;
  bornAt: number;
  finishedAt?: number;
  attention?: [number, number];
};

export type Rg1Task = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  assigneeId: string;
  startsAt: number;
  doneAt: number;
  deliverableId: string;
};

export type Rg1Deliverable = {
  id: string;
  taskId: string;
  title: string;
  path: string;
  producedAt: number;
};

export type Rg1ChatMessage = {
  id: string;
  at: number;
  from: string;
  to: string;
  subject: string;
  body: string;
  issueId: string;
  taskId?: string;
  agentId?: string;
  kind?: "message" | "system" | "approval" | "decision";
};

export type Rg1TimelineEvent = {
  at: number;
  kind: TimelineKind;
  label: string;
  detail: string;
  taskId?: string;
  agentId?: string;
};

export type M3ENodeKind = "text" | "folder" | "alias" | "agent";
export type M3EGraphNode = {
  id: string;
  entityId: string;
  kind: M3ENodeKind;
  label: string;
  scopeId: string;
  x: number;
  y: number;
  width?: number;
  taskId?: string;
  agentId?: string;
};
export type M3EGraphLink = {
  id: string;
  class: "edge" | "GraphLink";
  relation: "parent-child" | "assigned-to" | "produces" | "gated-by" | "references";
  from: string;
  to: string;
  taskId?: string;
};

const issueId = "PAY-4827";

const agents: Rg1Agent[] = [
  { id: "amber", name: "AmberKepler", initials: "AK", promptRole: "coordinator", provider: "anthropic", model: "Opus 5", taskId: "task-coordinate", bornAt: 0 },
  { id: "moss", name: "MossSomerville", initials: "MS", promptRole: "release", provider: "anthropic", model: "Opus 5", taskId: "task-release", bornAt: 0, attention: [154, 175] },
  { id: "slate", name: "SlateHooke", initials: "SH", promptRole: "reproduce", provider: "openai", model: "GPT 5.6", taskId: "task-reproduce", bornAt: 14, finishedAt: 88 },
  { id: "teal", name: "TealLamarr", initials: "TL", promptRole: "cause", provider: "openai", model: "GPT 5.6", taskId: "task-cause", bornAt: 20, finishedAt: 101 },
  { id: "copper", name: "CopperBose", initials: "CB", promptRole: "impact", provider: "anthropic", model: "Sonnet 5", taskId: "task-impact", bornAt: 25, finishedAt: 112, attention: [55, 76] },
  { id: "ivory", name: "IvoryNoether", initials: "IN", promptRole: "fix", provider: "openai", model: "GPT 5.6", taskId: "task-fix", bornAt: 66, finishedAt: 184 },
];

const tasks: Rg1Task[] = [
  { id: "task-coordinate", shortTitle: "Coordinate", title: "Coordinate incident", description: "Turn one report into a verified resolution", assigneeId: "amber", startsAt: 0, doneAt: 218, deliverableId: "report" },
  { id: "task-release", shortTitle: "Release gate", title: "Hold release gate", description: "Keep release closed until evidence and remediation exist", assigneeId: "moss", startsAt: 0, doneAt: 201, deliverableId: "decision" },
  { id: "task-reproduce", shortTitle: "Reproduce", title: "Reproduce safely", description: "One click, delayed confirmation, two records", assigneeId: "slate", startsAt: 14, doneAt: 42, deliverableId: "reproduction" },
  { id: "task-cause", shortTitle: "Root cause", title: "Trace root cause", description: "Find why the wait starts a second attempt", assigneeId: "teal", startsAt: 20, doneAt: 55, deliverableId: "cause" },
  { id: "task-impact", shortTitle: "Impact", title: "Count customer impact", description: "Use masked fields; expose totals only", assigneeId: "copper", startsAt: 25, doneAt: 94, deliverableId: "impact" },
  { id: "task-fix", shortTitle: "Fix + prove", title: "Fix and repeat-test", description: "Share payment identity and prove 10/10 passes", assigneeId: "ivory", startsAt: 66, doneAt: 118, deliverableId: "fix" },
];

const deliverables: Rg1Deliverable[] = [
  { id: "report", taskId: "task-coordinate", title: "Duplicate-charge incident report", path: "reports/duplicate-charge-incident.md", producedAt: 218 },
  { id: "decision", taskId: "task-release", title: "Release decision record", path: "reports/release-decision.md", producedAt: 175 },
  { id: "reproduction", taskId: "task-reproduce", title: "Reproduction steps and screenshots", path: "evidence/reproduction.md", producedAt: 42 },
  { id: "cause", taskId: "task-cause", title: "Plain-language cause timeline", path: "evidence/cause-timeline.md", producedAt: 55 },
  { id: "impact", taskId: "task-impact", title: "Affected-customer count", path: "reports/affected-count.md", producedAt: 94 },
  { id: "fix", taskId: "task-fix", title: "Fix and repeat-test evidence", path: "evidence/fix-and-repeat-test.md", producedAt: 118 },
];

const chat: Rg1ChatMessage[] = [
  { id: "chat-created", at: 0, from: "M3E", to: "Incident room", subject: "Issue added to list", body: "PAY-4827 · 1 click created 2 charges was added to the Issue List. A payment incident case is now tracking work, agents, evidence, and release authority.", issueId, kind: "system" },
  { id: "chat-reproduce", at: 16, from: "AmberKepler", to: "SlateHooke", subject: "Assigned · reproduce safely", body: "Use the safe checkout and press Pay exactly once. Slow the confirmation. Bring back exact steps and the two records side by side.", issueId, taskId: "task-reproduce", agentId: "slate" },
  { id: "chat-cause", at: 21, from: "AmberKepler", to: "TealLamarr", subject: "Assigned · trace root cause", body: "Trace one payment from button press to saved record. Explain in ordinary words why one payment becomes two records.", issueId, taskId: "task-cause", agentId: "teal" },
  { id: "chat-impact", at: 26, from: "AmberKepler", to: "CopperBose", subject: "Assigned · count impact", body: "Prepare a count using masked customer number, order number, amount and time only. Stop before reading production payment records and ask for approval.", issueId, taskId: "task-impact", agentId: "copper" },
  { id: "chat-repro-result", at: 42, from: "SlateHooke", to: "AmberKepler", subject: "Evidence · reproduced 3/3", body: "One click and an eight-second confirmation delay created two charges, three times in a row. Same order and amount; second record arrived four seconds later.", issueId, taskId: "task-reproduce", agentId: "slate" },
  { id: "chat-cause-result", at: 55, from: "TealLamarr", to: "AmberKepler", subject: "Finding · retry lacks shared identity", body: "After five seconds the page starts the payment again. The second attempt does not recognize the first, so both records are saved.", issueId, taskId: "task-cause", agentId: "teal" },
  { id: "chat-approval", at: 57, from: "CopperBose", to: "Human authority", subject: "Approval needed", body: "The count is ready, but it must read production payment records. Approve four masked fields for this incident, or I stop here.", issueId, taskId: "task-impact", agentId: "copper", kind: "approval" },
  { id: "chat-approved", at: 76, from: "Human authority", to: "CopperBose", subject: "Approved · constrained access", body: "Approved for this incident and date range. Read only the four masked fields; retain totals and close access when done.", issueId, taskId: "task-impact", agentId: "copper", kind: "approval" },
  { id: "chat-impact-result", at: 94, from: "CopperBose", to: "AmberKepler", subject: "Evidence · impact counted", body: "23 customers were affected, with 27 extra charges. The report contains totals only and access is closed.", issueId, taskId: "task-impact", agentId: "copper" },
  { id: "chat-fix", at: 67, from: "AmberKepler", to: "IvoryNoether", subject: "Assigned · fix and prove", body: "Make both attempts share one payment identity. Bring back the failing result before the passing one.", issueId, taskId: "task-fix", agentId: "ivory" },
  { id: "chat-fix-result", at: 118, from: "IvoryNoether", to: "AmberKepler", subject: "Evidence · repeat test 10/10", body: "Before the change: two charges. After the change: one charge on every one of ten delayed-confirmation attempts.", issueId, taskId: "task-fix", agentId: "ivory" },
  { id: "chat-gate", at: 132, from: "MossSomerville", to: "Incident room", subject: "Gate remains closed", body: "A working fix is not enough. The people already charged need a remediation plan before release.", issueId, taskId: "task-release", agentId: "moss" },
  { id: "chat-decision", at: 154, from: "MossSomerville", to: "Human authority", subject: "Decision needed · release timing", body: "All evidence is present. Choose: release now, or wait for the planned window.", issueId, taskId: "task-release", agentId: "moss", kind: "decision" },
  { id: "chat-released", at: 175, from: "Human authority", to: "Incident room", subject: "Release now", body: "Decision accepted. The release gate is open; MossSomerville will monitor live payments for recurrence.", issueId, taskId: "task-release", agentId: "moss", kind: "decision" },
  { id: "chat-resolved", at: 218, from: "AmberKepler", to: "Incident room", subject: "Issue resolved", body: "PAY-4827 is resolved: cause identified, 23 customers and 27 extra charges counted, fix proven 10/10, release monitored, follow-up recorded.", issueId, taskId: "task-coordinate", agentId: "amber", kind: "system" },
];

const timeline: Rg1TimelineEvent[] = [
  { at: 0, kind: "issue-created", label: "Issue added", detail: "PAY-4827 entered the Issue List and opened an incident case." },
  { at: 16, kind: "assigned", label: "Reproduction assigned", detail: "SlateHooke received a safe reproduction task.", taskId: "task-reproduce", agentId: "slate" },
  { at: 21, kind: "assigned", label: "Cause analysis assigned", detail: "TealLamarr began tracing the duplicate attempt.", taskId: "task-cause", agentId: "teal" },
  { at: 26, kind: "assigned", label: "Impact analysis assigned", detail: "CopperBose prepared a privacy-bounded count.", taskId: "task-impact", agentId: "copper" },
  { at: 42, kind: "evidence-produced", label: "Failure reproduced", detail: "One click produced two charges in three consecutive trials.", taskId: "task-reproduce", agentId: "slate" },
  { at: 55, kind: "finding", label: "Root cause found", detail: "A timeout retry started without the original payment identity.", taskId: "task-cause", agentId: "teal" },
  { at: 57, kind: "approval-requested", label: "Human approval requested", detail: "Production read paused before access.", taskId: "task-impact", agentId: "copper" },
  { at: 67, kind: "assigned", label: "Fix assigned", detail: "IvoryNoether received the cause and proof contract.", taskId: "task-fix", agentId: "ivory" },
  { at: 76, kind: "approval-granted", label: "Scoped access granted", detail: "Four masked fields, this incident, this date range only.", taskId: "task-impact", agentId: "copper" },
  { at: 94, kind: "evidence-produced", label: "Impact established", detail: "23 customers, 27 extra charges; no identities exposed.", taskId: "task-impact", agentId: "copper" },
  { at: 118, kind: "evidence-produced", label: "Fix proven", detail: "Failing before, then 10/10 passing after the change.", taskId: "task-fix", agentId: "ivory" },
  { at: 132, kind: "gate-blocked", label: "Gate remains closed", detail: "Customer remediation is still missing.", taskId: "task-release", agentId: "moss" },
  { at: 154, kind: "decision-requested", label: "Human decision requested", detail: "Release now or wait for the planned window.", taskId: "task-release", agentId: "moss" },
  { at: 175, kind: "released", label: "Released", detail: "Human chose release now; monitoring began.", taskId: "task-release", agentId: "moss" },
  { at: 218, kind: "resolved", label: "Issue resolved", detail: "Evidence, release, monitoring, and follow-up are linked." },
];

const scopes = [
  { id: "scope-support", label: "Support intake", x: 18, y: 238, width: 178, height: 174 },
  { id: "scope-case", label: "CASE-0914 · incident scope", x: 210, y: 28, width: 510, height: 642 },
  { id: "scope-evidence", label: "Evidence scope", x: 732, y: 28, width: 250, height: 642 },
] as const;

const graphNodes: M3EGraphNode[] = [
  { id: "support-root", entityId: "SUPPORT", kind: "folder", label: "Support intake", scopeId: "scope-support", x: 38, y: 270, width: 132 },
  { id: "issue-alias", entityId: issueId, kind: "alias", label: "PAY-4827 alias", scopeId: "scope-support", x: 43, y: 333, width: 128 },
  { id: "case-root", entityId: "CASE-0914", kind: "folder", label: "Incident case", scopeId: "scope-case", x: 238, y: 57, width: 140 },
  { id: "issue", entityId: issueId, kind: "text", label: "1 click → 2 charges", scopeId: "scope-case", x: 419, y: 56, width: 170 },
  { id: "gate", entityId: "GATE-PAY-4827", kind: "text", label: "Release gate", scopeId: "scope-case", x: 602, y: 56, width: 96 },
  { id: "evidence-root", entityId: "EVIDENCE-PAY-4827", kind: "folder", label: "Evidence", scopeId: "scope-evidence", x: 756, y: 57, width: 126 },
  ...tasks.map((task, index): M3EGraphNode => ({
    id: `graph-${task.id}`,
    entityId: task.id,
    kind: "text",
    label: task.shortTitle,
    scopeId: "scope-case",
    x: 245,
    y: 150 + index * 82,
    width: 146,
    taskId: task.id,
  })),
  ...agents.map((agent, index): M3EGraphNode => ({
    id: `graph-agent-${agent.id}`,
    entityId: agent.id,
    kind: "agent",
    label: agent.name,
    scopeId: "scope-case",
    x: 545,
    y: 150 + index * 82,
    taskId: agent.taskId,
    agentId: agent.id,
  })),
  ...deliverables.map((deliverable, index): M3EGraphNode => ({
    id: `graph-evidence-${deliverable.id}`,
    entityId: deliverable.id,
    kind: "text",
    label: deliverable.title,
    scopeId: "scope-evidence",
    x: 754,
    y: 150 + index * 82,
    width: 202,
    taskId: deliverable.taskId,
  })),
];

const graphLinks: M3EGraphLink[] = [
  { id: "edge-support-alias", class: "edge", relation: "parent-child", from: "support-root", to: "issue-alias" },
  { id: "edge-case-issue", class: "edge", relation: "parent-child", from: "case-root", to: "issue" },
  { id: "edge-evidence-root", class: "edge", relation: "parent-child", from: "evidence-root", to: "graph-evidence-report" },
  ...tasks.map((task): M3EGraphLink => ({ id: `edge-issue-${task.id}`, class: "edge", relation: "parent-child", from: "issue", to: `graph-${task.id}`, taskId: task.id })),
  ...tasks.map((task): M3EGraphLink => ({ id: `link-assigned-${task.id}`, class: "GraphLink", relation: "assigned-to", from: `graph-${task.id}`, to: `graph-agent-${task.assigneeId}`, taskId: task.id })),
  ...tasks.map((task): M3EGraphLink => ({ id: `link-produces-${task.id}`, class: "GraphLink", relation: "produces", from: `graph-agent-${task.assigneeId}`, to: `graph-evidence-${task.deliverableId}`, taskId: task.id })),
  { id: "link-gated", class: "GraphLink", relation: "gated-by", from: "issue", to: "gate" },
  { id: "link-reference", class: "GraphLink", relation: "references", from: "issue-alias", to: "issue" },
];

export const AGENT_ORRERY_FIXTURE = {
  title: "Duplicate charge incident",
  mapPath: "ws:demo / map:Payments / scope:CASE-0914",
  issue: { id: issueId, title: "1 click created 2 charges", severity: "SEV-1", openedAt: "09:12", source: "Customer support", owner: "Payments" },
  case: { id: "CASE-0914", issueId, title: "Duplicate charge containment & recovery", scope: "Payments / Checkout", leadAgentId: "amber" },
  agents,
  tasks,
  deliverables,
  chat,
  timeline,
  scopes,
  graphNodes,
  graphLinks,
  gate: { id: "GATE-PAY-4827", label: "Payment hotfix release", ownerAgentId: "moss", requiredDeliverableIds: ["reproduction", "cause", "impact", "fix"] },
  boundary: {
    runtime: "Fixture-only mock. No agent runtime, process control, mail delivery, or production API.",
    role: "promptRole is observed execution metadata, not a canonical Role/Contract.",
    layout: "Orrery-inspired view with static coordinates; no force solver or live telemetry.",
  },
} as const;

export function taskStateAt(task: Rg1Task, at: number): TaskState {
  if (at < task.startsAt) return "queued";
  if (task.id === "task-impact" && at >= 55 && at < 76) return "blocked";
  if (task.id === "task-release" && at >= 132 && at < 175) return "blocked";
  return at >= task.doneAt ? "done" : "active";
}

export function agentStateAt(agent: Rg1Agent, at: number): AgentState {
  if (at < agent.bornAt) return "queued";
  if (agent.attention && at >= agent.attention[0] && at < agent.attention[1]) return "attention";
  if (agent.finishedAt && at >= agent.finishedAt) return "finished";
  if ((agent.id === "moss" && at < 132) || (agent.id === "amber" && at > 0 && at < 14)) return "waiting";
  return "working";
}
