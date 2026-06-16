import type { AppState, GraphLink, MapScope, MapSurface, TreeNode } from "../shared/types";
import { systemBlockTemplateById } from "../shared/system_block_templates";
import type {
  TemplateSlotValue,
  TemplateSystemChannelSpec,
  TemplateSystemEdgeSpec,
  TemplateSystemNodeSpec,
  TemplateSystemScopeSpec,
  TemplateSystemSpec,
} from "../shared/template_system_spec";

const KERNEL_NODE_KIND_KEY = "m3e:kernel-node-kind";
const KERNEL_CALLABLE_REF_KEY = "m3e:kernel-callable-ref";
const KERNEL_SUBGRAPH_SCOPE_KEY = "m3e:kernel-subgraph-scope";
const KERNEL_LABEL_KEY = "m3e:kernel-label";
const KERNEL_METADATA_KEY = "m3e:kernel-metadata";
const KERNEL_ROUTER_REF_KEY = "m3e:kernel-router-ref";
const KERNEL_CHANNELS_KEY = "m3e:kernel-channels";
const KERNEL_ENTRY_KEY = "m3e:kernel-entry";

export interface TemplateSystemBuildIssue {
  readonly kind:
    | "unknown_template"
    | "missing_required_slot"
    | "duplicate_node"
    | "duplicate_edge"
    | "unknown_edge_node";
  readonly detail: string;
}

export interface TemplateSystemBuildResult {
  readonly state: AppState;
  readonly issues: TemplateSystemBuildIssue[];
}

interface BuildContext {
  readonly nodes: Record<string, TreeNode>;
  readonly links: Record<string, GraphLink>;
  readonly scopes: Record<string, MapScope>;
  readonly surfaces: Record<string, MapSurface>;
  readonly linearNotesByScope: Record<string, string>;
  readonly issues: TemplateSystemBuildIssue[];
}

export function buildTemplateSystemState(spec: TemplateSystemSpec): TemplateSystemBuildResult {
  const ctx: BuildContext = {
    nodes: {},
    links: {},
    scopes: {},
    surfaces: {},
    linearNotesByScope: {},
    issues: [],
  };

  addScope(ctx, spec.id, null, spec.label, spec, {
    template: spec.template ?? "langgraph.subsystem.state_graph",
    strategy: spec.strategy,
    graph_spec_version: spec.graphSpecVersion ?? "0.1",
  });

  return {
    state: {
      rootId: spec.id,
      nodes: ctx.nodes,
      links: ctx.links,
      scopes: ctx.scopes,
      surfaces: ctx.surfaces,
      linearNotesByScope: ctx.linearNotesByScope,
    },
    issues: ctx.issues,
  };
}

function addScope(
  ctx: BuildContext,
  scopeId: string,
  parentId: string | null,
  label: string,
  scope: TemplateSystemScopeSpec,
  metadata: Record<string, TemplateSlotValue | undefined> = {},
): void {
  const childIds = (scope.nodes ?? []).map((node) => node.id);
  const scopeAttributes = {
    "m3e:layout": "flow-lr",
    [KERNEL_LABEL_KEY]: label,
    [KERNEL_ENTRY_KEY]: scope.entry ?? childIds[0] ?? "__start__",
    [KERNEL_CHANNELS_KEY]: JSON.stringify(normalizeChannels(scope.channels ?? [])),
    [KERNEL_METADATA_KEY]: metadataJson(metadata),
  };
  const existingScopeNode = ctx.nodes[scopeId];
  if (existingScopeNode) {
    existingScopeNode.children = childIds;
    existingScopeNode.nodeType = "folder";
    existingScopeNode.attributes = { ...existingScopeNode.attributes, ...scopeAttributes };
  } else {
    addNode(ctx, {
      id: scopeId,
      parentId,
      text: label,
      nodeType: "folder",
      children: childIds,
      attributes: scopeAttributes,
    });
  }

  for (const [index, child] of (scope.nodes ?? []).entries()) {
    addTemplateNode(ctx, child, scopeId, index);
  }

  const relationIds: string[] = [];
  for (const [index, edge] of (scope.edges ?? []).entries()) {
    const link = addTemplateEdge(ctx, edge, scopeId, index);
    relationIds.push(link.id);
  }

  const surfaceId = `surface_${scopeId}`;
  ctx.scopes[scopeId] = {
    id: scopeId,
    label,
    rootNodeIds: [scopeId],
    relationIds,
    primarySurfaceId: surfaceId,
  };
  ctx.surfaces[surfaceId] = {
    id: surfaceId,
    scopeId,
    kind: "system",
    layout: "flow-lr",
  };
  if (scope.note) {
    ctx.linearNotesByScope[scopeId] = scope.note;
  }
}

function addTemplateNode(ctx: BuildContext, spec: TemplateSystemNodeSpec, parentId: string, index: number): void {
  const template = systemBlockTemplateById(spec.template);
  if (!template) {
    ctx.issues.push({ kind: "unknown_template", detail: `${spec.id}: ${spec.template}` });
  } else {
    validateRequiredSlots(ctx, spec, template.fields.map((field) => field.key).filter((key) => {
      const field = template.fields.find((candidate) => candidate.key === key);
      return Boolean(field?.required);
    }));
  }

  const slots = spec.slots ?? {};
  const hasSubsystem = Boolean(spec.subsystem);
  const nodeKind = hasSubsystem ? "subgraph" : templateKindToKernelKind(spec.template);
  const label = spec.label ?? template?.label ?? spec.id;
  const attributes: Record<string, string> = {
    "m3e:flow-col": String(spec.flowCol ?? index),
    "m3e:flow-row": String(spec.flowRow ?? 0),
    [KERNEL_NODE_KIND_KEY]: nodeKind,
    [KERNEL_LABEL_KEY]: label,
    [KERNEL_METADATA_KEY]: metadataJson({ block_id: spec.template, ...slots }),
  };

  const callableRef = slotAsString(slots.callable_ref) ?? slotAsString(slots.tool_refs);
  if (callableRef) attributes[KERNEL_CALLABLE_REF_KEY] = callableRef;
  const routerRef = slotAsString(slots.router_ref);
  if (routerRef) attributes[KERNEL_ROUTER_REF_KEY] = routerRef;
  if (hasSubsystem) attributes[KERNEL_SUBGRAPH_SCOPE_KEY] = spec.id;

  addNode(ctx, {
    id: spec.id,
    parentId,
    text: label,
    nodeType: hasSubsystem ? "folder" : spec.nodeType ?? "text",
    children: spec.subsystem?.nodes?.map((node) => node.id) ?? [],
    attributes,
  });

  if (spec.subsystem) {
    addScope(ctx, spec.id, parentId, label, spec.subsystem, {
      template: spec.template,
      ...slots,
      trace_step_id: slots.trace_step_id,
    });
  }
}

function addTemplateEdge(
  ctx: BuildContext,
  spec: TemplateSystemEdgeSpec,
  scopeId: string,
  index: number,
): GraphLink {
  const id = spec.id ?? `link_${scopeId}_${index}_${spec.from}_to_${spec.to}`;
  if (ctx.links[id]) {
    ctx.issues.push({ kind: "duplicate_edge", detail: id });
  }
  if (spec.from !== "__start__" && !ctx.nodes[spec.from]) {
    ctx.issues.push({ kind: "unknown_edge_node", detail: `${id}.from=${spec.from}` });
  }
  if (spec.to !== "__end__" && spec.to !== "__start__" && !ctx.nodes[spec.to]) {
    ctx.issues.push({ kind: "unknown_edge_node", detail: `${id}.to=${spec.to}` });
  }
  const link: GraphLink = {
    id,
    sourceNodeId: spec.from,
    targetNodeId: spec.to,
    relationType: spec.branch ? `cond:${spec.branch}` : undefined,
    label: spec.label ?? spec.branch,
    direction: "forward",
    style: "default",
  };
  ctx.links[id] = link;
  return link;
}

function addNode(ctx: BuildContext, spec: {
  readonly id: string;
  readonly parentId: string | null;
  readonly text: string;
  readonly nodeType?: TreeNode["nodeType"];
  readonly children?: readonly string[];
  readonly attributes?: Record<string, string>;
}): void {
  if (ctx.nodes[spec.id]) {
    ctx.issues.push({ kind: "duplicate_node", detail: spec.id });
  }
  ctx.nodes[spec.id] = {
    id: spec.id,
    parentId: spec.parentId,
    children: [...(spec.children ?? [])],
    nodeType: spec.nodeType ?? "text",
    scopeId: spec.id,
    text: spec.text,
    collapsed: false,
    details: "",
    note: "",
    attributes: spec.attributes ?? {},
    link: "",
  };
}

function validateRequiredSlots(ctx: BuildContext, spec: TemplateSystemNodeSpec, requiredKeys: readonly string[]): void {
  const slots = spec.slots ?? {};
  for (const key of requiredKeys) {
    if (key in slots) continue;
    if ((key === "callable_ref" || key === "router_ref") && templateSuppliesEquivalent(spec.template, key, slots)) continue;
    ctx.issues.push({ kind: "missing_required_slot", detail: `${spec.id}.${key}` });
  }
}

function templateSuppliesEquivalent(
  templateId: string,
  key: string,
  slots: Record<string, TemplateSlotValue>,
): boolean {
  if (key === "callable_ref" && (slots.callable_ref || templateId.startsWith("langgraph.flow."))) return true;
  if (key === "router_ref" && slots.router_ref) return true;
  return false;
}

function templateKindToKernelKind(templateId: string): "callable" | "tool" | "terminal" | "entry" {
  const template = systemBlockTemplateById(templateId);
  if (template?.kind === "tool") return "tool";
  return "callable";
}

function normalizeChannels(channels: readonly TemplateSystemChannelSpec[]): Array<{
  readonly name: string;
  readonly reducer: string;
  readonly typeHint?: string;
  readonly reducerRef?: string;
}> {
  return channels.map((channel) => ({
    name: channel.name,
    reducer: channel.reducer ?? "replace",
    typeHint: channel.typeHint,
    reducerRef: channel.reducerRef,
  }));
}

function metadataJson(values: Record<string, TemplateSlotValue | undefined>): string {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    out[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  return JSON.stringify(out);
}

function slotAsString(value: TemplateSlotValue | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}
