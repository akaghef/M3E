import type { AppState, GraphLink, MapScope, MapSurface, TreeNode } from "../shared/types";

const KERNEL_NODE_KIND_KEY = "m3e:kernel-node-kind";
const KERNEL_CALLABLE_REF_KEY = "m3e:kernel-callable-ref";
const KERNEL_SUBGRAPH_SCOPE_KEY = "m3e:kernel-subgraph-scope";
const KERNEL_LABEL_KEY = "m3e:kernel-label";
const KERNEL_METADATA_KEY = "m3e:kernel-metadata";
const KERNEL_ROUTER_REF_KEY = "m3e:kernel-router-ref";
const KERNEL_CHANNELS_KEY = "m3e:kernel-channels";
const KERNEL_ENTRY_KEY = "m3e:kernel-entry";

interface NodeSpec {
  readonly id: string;
  readonly parentId: string | null;
  readonly text: string;
  readonly children?: readonly string[];
  readonly nodeType?: TreeNode["nodeType"];
  readonly attributes?: Record<string, string>;
  readonly details?: string;
}

interface LinkSpec {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly relationType?: string;
  readonly label?: string;
}

function node(spec: NodeSpec): TreeNode {
  return {
    id: spec.id,
    parentId: spec.parentId,
    children: [...(spec.children ?? [])],
    nodeType: spec.nodeType ?? "text",
    scopeId: spec.id,
    text: spec.text,
    collapsed: false,
    details: spec.details ?? "",
    note: "",
    attributes: spec.attributes ?? {},
    link: "",
  };
}

function link(spec: LinkSpec): GraphLink {
  return {
    id: spec.id,
    sourceNodeId: spec.source,
    targetNodeId: spec.target,
    relationType: spec.relationType,
    label: spec.label,
    direction: "forward",
    style: "default",
  };
}

function metadata(values: Record<string, string>): string {
  return JSON.stringify(values);
}

function channels(names: Array<{ name: string; reducer: "append" | "replace" | "merge" | "custom"; typeHint: string }>): string {
  return JSON.stringify(names);
}

export function buildPjv34TemplateSystemState(): AppState {
  const rootId = "pjv34_system";
  const genId = "generate_doc";
  const nodes: Record<string, TreeNode> = {};
  const links: Record<string, GraphLink> = {};
  const scopes: Record<string, MapScope> = {};
  const surfaces: Record<string, MapSurface> = {};

  const addNode = (spec: NodeSpec) => {
    nodes[spec.id] = node(spec);
  };
  const addLink = (spec: LinkSpec) => {
    links[spec.id] = link(spec);
  };

  addNode({
    id: rootId,
    parentId: null,
    text: "PJv34 Weekly Review System",
    nodeType: "folder",
    children: ["load_context", genId, "write_output"],
    attributes: {
      "m3e:layout": "flow-lr",
      [KERNEL_LABEL_KEY]: "PJv34 Weekly Review System",
      [KERNEL_ENTRY_KEY]: "load_context",
      [KERNEL_CHANNELS_KEY]: channels([
        { name: "sourceFolder", reducer: "replace", typeHint: "resource:folder" },
        { name: "contextPackage", reducer: "replace", typeHint: "json" },
        { name: "docGoal", reducer: "replace", typeHint: "markdown" },
        { name: "draftDocument", reducer: "replace", typeHint: "markdown" },
        { name: "finalReport", reducer: "replace", typeHint: "resource:file" },
        { name: "trace", reducer: "append", typeHint: "jsonl" },
      ]),
      [KERNEL_METADATA_KEY]: metadata({
        template: "pjv34.weekly_review_system",
        strategy: "Template-first PJv34 Rebuild",
      }),
    },
  });

  addNode({
    id: "load_context",
    parentId: rootId,
    text: "Load Context",
    attributes: {
      "m3e:flow-col": "0",
      "m3e:flow-row": "0",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.load_context",
      [KERNEL_LABEL_KEY]: "Load Context",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "io.load_local_folder",
        reads: "resource.projectsFolder",
        writes: "state.contextPackage",
        trace_step_id: "load_context",
      }),
    },
  });

  addNode({
    id: genId,
    parentId: rootId,
    text: "Generate Doc",
    nodeType: "folder",
    children: ["build_prompt", "call_provider", "evaluate_response", "retry_backoff", "fallback_qn", "return_draft"],
    attributes: {
      "m3e:flow-col": "1",
      "m3e:flow-row": "0",
      "m3e:layout": "flow-lr",
      [KERNEL_NODE_KIND_KEY]: "subgraph",
      [KERNEL_SUBGRAPH_SCOPE_KEY]: genId,
      [KERNEL_LABEL_KEY]: "Generate Doc",
      [KERNEL_ENTRY_KEY]: "build_prompt",
      [KERNEL_CHANNELS_KEY]: channels([
        { name: "contextPackage", reducer: "replace", typeHint: "json" },
        { name: "docGoal", reducer: "replace", typeHint: "markdown" },
        { name: "prompt", reducer: "replace", typeHint: "markdown" },
        { name: "providerResponse", reducer: "replace", typeHint: "json" },
        { name: "draftDocument", reducer: "replace", typeHint: "markdown" },
        { name: "error", reducer: "replace", typeHint: "json" },
        { name: "retryCount", reducer: "replace", typeHint: "number" },
      ]),
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "llm.generate_doc.subsystem",
        reads: "state.contextPackage,state.docGoal",
        writes: "state.draftDocument",
        provider: "deepseek",
        model: "deepseek-chat",
        trace_step_id: "generate_doc",
      }),
    },
  });

  addNode({
    id: "write_output",
    parentId: rootId,
    text: "Write Output",
    attributes: {
      "m3e:flow-col": "2",
      "m3e:flow-row": "0",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.write_output",
      [KERNEL_LABEL_KEY]: "Write Output",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "io.write_artifact",
        reads: "state.draftDocument",
        writes: "resource.tmpWeeklyReview",
        trace_step_id: "write_output",
      }),
    },
  });

  addNode({
    id: "build_prompt",
    parentId: genId,
    text: "Build Prompt",
    attributes: {
      "m3e:flow-col": "0",
      "m3e:flow-row": "0",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.generate_doc.build_prompt",
      [KERNEL_LABEL_KEY]: "Build Prompt",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "langgraph.node.process",
        reads: "state.contextPackage,state.docGoal",
        writes: "state.prompt",
        trace_step_id: "build_prompt",
      }),
    },
  });

  addNode({
    id: "call_provider",
    parentId: genId,
    text: "Call Provider",
    attributes: {
      "m3e:flow-col": "1",
      "m3e:flow-row": "0",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.generate_doc.call_deepseek",
      [KERNEL_LABEL_KEY]: "Call Provider",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "langgraph.node.llm",
        provider: "deepseek",
        model: "deepseek-chat",
        reads: "state.prompt",
        writes: "state.providerResponse,state.error",
        trace_step_id: "call_provider",
      }),
    },
  });

  addNode({
    id: "evaluate_response",
    parentId: genId,
    text: "Evaluate Response",
    attributes: {
      "m3e:flow-col": "2",
      "m3e:flow-row": "0",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.generate_doc.evaluate_response",
      [KERNEL_ROUTER_REF_KEY]: "pjv34.generate_doc.route_evaluation",
      [KERNEL_LABEL_KEY]: "Evaluate Response",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "langgraph.node.router",
        reads: "state.providerResponse,state.error",
        writes: "state.draftDocument,state.error",
        route_keys: "pass,api_error,bad_output",
        trace_step_id: "evaluate_response",
      }),
    },
  });

  addNode({
    id: "retry_backoff",
    parentId: genId,
    text: "Retry / Backoff",
    attributes: {
      "m3e:flow-col": "2",
      "m3e:flow-row": "1",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.generate_doc.retry_backoff",
      [KERNEL_ROUTER_REF_KEY]: "pjv34.generate_doc.route_retry",
      [KERNEL_LABEL_KEY]: "Retry / Backoff",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "langgraph.flow.retry",
        reads: "state.error,state.retryCount",
        writes: "state.retryCount",
        max_attempts: "1",
        route_keys: "retry,exhausted",
        trace_step_id: "retry_backoff",
      }),
    },
  });

  addNode({
    id: "fallback_qn",
    parentId: genId,
    text: "Fallback / Qn",
    attributes: {
      "m3e:flow-col": "3",
      "m3e:flow-row": "1",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.generate_doc.fallback_qn",
      [KERNEL_LABEL_KEY]: "Fallback / Qn",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "langgraph.flow.human_gate",
        reads: "state.error,state.providerResponse",
        writes: "state.draftDocument,state.qn",
        trace_step_id: "fallback_qn",
      }),
    },
  });

  addNode({
    id: "return_draft",
    parentId: genId,
    text: "Return Draft",
    attributes: {
      "m3e:flow-col": "4",
      "m3e:flow-row": "0",
      [KERNEL_NODE_KIND_KEY]: "callable",
      [KERNEL_CALLABLE_REF_KEY]: "pjv34.generate_doc.return_draft",
      [KERNEL_LABEL_KEY]: "Return Draft",
      [KERNEL_METADATA_KEY]: metadata({
        block_id: "langgraph.node.process",
        reads: "state.draftDocument",
        writes: "state.draftDocument",
        trace_step_id: "return_draft",
      }),
    },
  });

  addLink({ id: "link_load_to_generate", source: "load_context", target: genId, label: "default" });
  addLink({ id: "link_generate_to_write", source: genId, target: "write_output", label: "default" });
  addLink({ id: "link_write_to_end", source: "write_output", target: "__end__", label: "done" });

  addLink({ id: "link_build_to_call", source: "build_prompt", target: "call_provider", label: "default" });
  addLink({ id: "link_call_to_eval", source: "call_provider", target: "evaluate_response", label: "default" });
  addLink({ id: "link_eval_pass", source: "evaluate_response", target: "return_draft", relationType: "cond:pass", label: "pass" });
  addLink({ id: "link_eval_api_error", source: "evaluate_response", target: "retry_backoff", relationType: "cond:api_error", label: "api_error" });
  addLink({ id: "link_eval_bad_output", source: "evaluate_response", target: "fallback_qn", relationType: "cond:bad_output", label: "bad_output" });
  addLink({ id: "link_retry_retry", source: "retry_backoff", target: "call_provider", relationType: "cond:retry", label: "retry" });
  addLink({ id: "link_retry_exhausted", source: "retry_backoff", target: "fallback_qn", relationType: "cond:exhausted", label: "exhausted" });
  addLink({ id: "link_fallback_to_end", source: "fallback_qn", target: "__end__", label: "fallback" });
  addLink({ id: "link_return_to_end", source: "return_draft", target: "__end__", label: "return" });

  scopes[rootId] = {
    id: rootId,
    label: "PJv34 Weekly Review System",
    rootNodeIds: [rootId],
    relationIds: ["link_load_to_generate", "link_generate_to_write", "link_write_to_end"],
    primarySurfaceId: "surface_pjv34_system",
  };
  scopes[genId] = {
    id: genId,
    label: "Generate Doc",
    rootNodeIds: [genId],
    relationIds: [
      "link_build_to_call",
      "link_call_to_eval",
      "link_eval_pass",
      "link_eval_api_error",
      "link_eval_bad_output",
      "link_retry_retry",
      "link_retry_exhausted",
      "link_fallback_to_end",
      "link_return_to_end",
    ],
    primarySurfaceId: "surface_generate_doc",
  };

  surfaces.surface_pjv34_system = {
    id: "surface_pjv34_system",
    scopeId: rootId,
    kind: "system",
    layout: "flow-lr",
  };
  surfaces.surface_generate_doc = {
    id: "surface_generate_doc",
    scopeId: genId,
    kind: "system",
    layout: "flow-lr",
  };

  return {
    rootId,
    nodes,
    links,
    scopes,
    surfaces,
    linearNotesByScope: {
      [rootId]: "PJv34 Weekly Review rebuilt from System Block Templates.",
      [genId]: "Generate Doc subsystem keeps provider retry/fallback loop inside the block.",
    },
  };
}
