import {
  GRAPH_SPEC_END,
  GRAPH_SPEC_START,
  type GraphSpec,
  type GraphSpecEdge,
  type GraphSpecNode,
} from "./graph_spec_types";

export interface GraphSpecMermaidOptions {
  readonly title?: string;
  readonly direction?: "LR" | "TD";
}

const START_NODE = "__m3e_start";
const END_NODE = "__m3e_end";

export function graphSpecToMermaid(spec: GraphSpec, options: GraphSpecMermaidOptions = {}): string {
  const direction = options.direction ?? "LR";
  const lines: string[] = [
    `flowchart ${direction}`,
  ];
  if (options.title) {
    lines.push(`  %% ${options.title}`);
  }

  const conditionalSources = new Set(
    spec.edges
      .filter((edge) => edge.kind === "conditional")
      .map((edge) => edge.source),
  );

  if (spec.entry && spec.entry !== GRAPH_SPEC_START) {
    lines.push(`  ${START_NODE}((START))`);
    lines.push(`  ${START_NODE} --> ${nodeRef(spec.entry)}`);
  }

  for (const node of spec.nodes) {
    lines.push(`  ${nodeRef(node.id)}${nodeShape(node, conditionalSources.has(node.id))}`);
  }
  if (usesEnd(spec.edges)) {
    lines.push(`  ${END_NODE}((END))`);
  }

  for (const edge of spec.edges) {
    lines.push(...edgeLines(edge));
  }

  lines.push(
    "  classDef router fill:#fff7d6,stroke:#8a6d1f,stroke-width:1px;",
    "  classDef subsystem fill:#e9f2ff,stroke:#3569a8,stroke-width:1px;",
    "  classDef sideEffect fill:#ffecec,stroke:#b44747,stroke-width:1px;",
    "  classDef terminal fill:#eaf7ea,stroke:#3f7d3f,stroke-width:1px;",
  );

  const classLines = classAssignments(spec.nodes, conditionalSources);
  lines.push(...classLines.map((line) => `  ${line}`));
  if (usesEnd(spec.edges)) {
    lines.push(`  class ${END_NODE} terminal;`);
  }

  return `${lines.join("\n")}\n`;
}

function edgeLines(edge: GraphSpecEdge): string[] {
  const source = nodeRef(edge.source);
  if (edge.kind === "static") {
    return [`  ${source} -->${edgeLabel(edge.label)} ${nodeRef(edge.target)}`];
  }
  return Object.entries(edge.branches).map(([branch, target]) =>
    `  ${source} -->${edgeLabel(branch)} ${nodeRef(target)}`,
  );
}

function nodeShape(node: GraphSpecNode, isRouter: boolean): string {
  const label = mermaidLabel(node.label || node.id);
  if (isRouter) return `{${label}}`;
  if (node.kind === "subgraph") return `[${label}]`;
  if (node.kind === "terminal") return `((${label}))`;
  return `[${label}]`;
}

function classAssignments(nodes: readonly GraphSpecNode[], conditionalSources: ReadonlySet<string>): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const classes: string[] = [];
    if (conditionalSources.has(node.id)) classes.push("router");
    if (node.kind === "subgraph") classes.push("subsystem");
    if (node.kind === "terminal") classes.push("terminal");
    if (isSideEffectNode(node)) classes.push("sideEffect");
    if (classes.length > 0) {
      lines.push(`class ${nodeRef(node.id)} ${classes.join(",")};`);
    }
  }
  return lines;
}

function isSideEffectNode(node: GraphSpecNode): boolean {
  const blockId = node.metadata?.block_id ?? "";
  return node.kind === "tool" ||
    blockId.startsWith("io.") ||
    blockId.includes("human_gate") ||
    blockId.includes("tool");
}

function usesEnd(edges: readonly GraphSpecEdge[]): boolean {
  return edges.some((edge) => {
    if (edge.kind === "static") return edge.target === GRAPH_SPEC_END;
    return Object.values(edge.branches).includes(GRAPH_SPEC_END);
  });
}

function nodeRef(id: string): string {
  if (id === GRAPH_SPEC_START) return START_NODE;
  if (id === GRAPH_SPEC_END) return END_NODE;
  return `m3e_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function edgeLabel(label: string | undefined): string {
  if (!label) return "";
  return `|${mermaidText(label)}|`;
}

function mermaidLabel(label: string): string {
  return `"${mermaidText(label).replace(/\n/g, "<br/>")}"`;
}

function mermaidText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\|/g, "&#124;");
}
