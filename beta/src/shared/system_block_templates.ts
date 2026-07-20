export type SystemBlockKind =
  | "callable"
  | "router"
  | "subsystem"
  | "tool"
  | "flow"
  | "state"
  | "edge"
  | "io";

export interface SystemBlockTemplateField {
  readonly key: string;
  readonly example: string;
  readonly meaning: string;
  readonly required: boolean;
}

export interface SystemBlockTemplate {
  readonly blockId: string;
  readonly label: string;
  readonly kind: SystemBlockKind;
  readonly langGraphPattern: string;
  readonly summary: string;
  readonly fields: readonly SystemBlockTemplateField[];
}

export const SYSTEM_BLOCK_TEMPLATES: readonly SystemBlockTemplate[] = [
  {
    blockId: "langgraph.subsystem.state_graph",
    label: "State Graph",
    kind: "subsystem",
    langGraphPattern: "StateGraph",
    summary: "Define an executable System Scope with a Control Graph and State Contract.",
    fields: [
      { key: "state_schema", example: "WeeklyReviewState", meaning: "Name or inline definition of the State Contract.", required: true },
      { key: "channels", example: "contextPackage,draftDocument,trace", meaning: "State Channels owned by this system scope.", required: true },
      { key: "entry", example: "load_context", meaning: "Entry node id.", required: true },
      { key: "terminals", example: "write_output", meaning: "Terminal node ids or END aliases.", required: false },
      { key: "graph_spec_version", example: "0.1", meaning: "GraphSpec contract version.", required: true },
    ],
  },
  {
    blockId: "langgraph.state.channel",
    label: "State Channel",
    kind: "state",
    langGraphPattern: "TypedDict field + reducer annotation",
    summary: "Define a State Channel with reducer semantics and optional resource binding.",
    fields: [
      { key: "name", example: "draftDocument", meaning: "State Channel name.", required: true },
      { key: "type_hint", example: "markdown", meaning: "Human/compile-facing type hint.", required: true },
      { key: "reducer", example: "replace", meaning: "Merge semantics: replace, append, merge, or custom.", required: true },
      { key: "resource_binding", example: "file:tmp/weekly-review.md", meaning: "Optional file/artifact/API binding for Data View.", required: false },
    ],
  },
  {
    blockId: "langgraph.node.process",
    label: "Process",
    kind: "callable",
    langGraphPattern: "add_node",
    summary: "Run a deterministic callable that reads and writes State Channels.",
    fields: [
      { key: "reads", example: "state.contextPackage", meaning: "State Channels read by the callable.", required: true },
      { key: "writes", example: "state.prompt", meaning: "State Channels written by the callable.", required: true },
      { key: "callable_ref", example: "pjv34.generate_doc.build_prompt", meaning: "Runtime registry reference.", required: true },
      { key: "input_schema", example: "BuildPromptInput", meaning: "Optional input schema.", required: false },
      { key: "output_schema", example: "BuildPromptOutput", meaning: "Optional output schema.", required: false },
      { key: "trace_step_id", example: "build_prompt", meaning: "Trace id that binds map node, runtime step, and logs.", required: true },
    ],
  },
  {
    blockId: "langgraph.node.llm",
    label: "LLM Call",
    kind: "callable",
    langGraphPattern: "add_node",
    summary: "Call an LLM provider once and write the response into State Channels.",
    fields: [
      { key: "reads", example: "state.prompt", meaning: "Prompt/context channels read by the LLM node.", required: true },
      { key: "writes", example: "state.providerResponse,state.error", meaning: "Response/error channels written by the node.", required: true },
      { key: "provider", example: "deepseek", meaning: "LLM provider name.", required: true },
      { key: "model", example: "deepseek-chat", meaning: "Model id.", required: true },
      { key: "prompt_text", example: "{{state.prompt}}", meaning: "Prompt template or channel binding.", required: true },
      { key: "output_schema", example: "DraftDocument", meaning: "Expected structured output shape.", required: false },
      { key: "failure_ports", example: "api_error,bad_output", meaning: "Failure branch labels emitted by downstream router.", required: false },
      { key: "trace_step_id", example: "call_provider", meaning: "Trace id that binds map node, runtime step, and logs.", required: true },
    ],
  },
  {
    blockId: "langgraph.node.router",
    label: "Router",
    kind: "router",
    langGraphPattern: "add_conditional_edges",
    summary: "Choose the next node by returning a branch key.",
    fields: [
      { key: "reads", example: "state.evaluation,state.error", meaning: "State Channels used for routing.", required: true },
      { key: "router_ref", example: "pjv34.generate_doc.route_evaluation", meaning: "Runtime registry reference that returns a branch key.", required: true },
      { key: "route_keys", example: "pass,api_error,bad_output,default", meaning: "Allowed branch labels.", required: true },
      { key: "default_route", example: "default", meaning: "Fallback branch if the router returns unknown.", required: true },
      { key: "trace_step_id", example: "evaluate_response", meaning: "Trace id for route decision.", required: true },
    ],
  },
  {
    blockId: "langgraph.node.tool",
    label: "Tool Node",
    kind: "tool",
    langGraphPattern: "ToolNode",
    summary: "Execute one or more registered tools from state/tool calls.",
    fields: [
      { key: "reads", example: "state.messages", meaning: "State Channels containing tool calls or tool input.", required: true },
      { key: "writes", example: "state.messages", meaning: "State Channels receiving tool results.", required: true },
      { key: "tool_refs", example: "tool.search,tool.calc", meaning: "Allowed tool registry refs.", required: true },
      { key: "error_policy", example: "return_tool_error", meaning: "How tool exceptions are represented.", required: true },
      { key: "trace_step_id", example: "run_tools", meaning: "Trace id that binds map node, runtime step, and logs.", required: true },
    ],
  },
  {
    blockId: "langgraph.flow.retry",
    label: "Retry / Backoff",
    kind: "flow",
    langGraphPattern: "conditional edge + back edge",
    summary: "Route failures back to a target node until max attempts are exhausted.",
    fields: [
      { key: "reads", example: "state.error,state.retryCount", meaning: "Failure and counter channels read by retry logic.", required: true },
      { key: "writes", example: "state.retryCount", meaning: "Retry counter channel.", required: true },
      { key: "max_attempts", example: "2", meaning: "Maximum retry attempts before exhausted.", required: true },
      { key: "retry_target", example: "call_provider", meaning: "Node id to route back to.", required: true },
      { key: "exhausted_target", example: "fallback_qn", meaning: "Node id to route to after retries are exhausted.", required: true },
      { key: "trace_step_id", example: "retry_backoff", meaning: "Trace id for retry route decision.", required: true },
    ],
  },
  {
    blockId: "langgraph.flow.human_gate",
    label: "Human Gate",
    kind: "flow",
    langGraphPattern: "interrupt",
    summary: "Pause execution for human approval, Qn, rejection, or edit.",
    fields: [
      { key: "reads", example: "state.qn,state.draftDocument", meaning: "State shown to the human.", required: true },
      { key: "writes", example: "state.humanDecision", meaning: "State Channel receiving the decision.", required: true },
      { key: "interrupt", example: "before", meaning: "Interrupt timing: before, after, or dynamic.", required: true },
      { key: "decision_ports", example: "approve,reject,edit", meaning: "Branches available after human input.", required: true },
      { key: "trace_step_id", example: "human_gate", meaning: "Trace id for the human gate.", required: true },
    ],
  },
  {
    blockId: "langgraph.flow.parallel_send",
    label: "Parallel Send",
    kind: "flow",
    langGraphPattern: "Send",
    summary: "Fan out items to a target node and merge results with a reducer.",
    fields: [
      { key: "item_channel", example: "state.projects", meaning: "State Channel containing items to fan out.", required: true },
      { key: "target_node", example: "summarize_project", meaning: "Node id invoked for each item.", required: true },
      { key: "result_channel", example: "state.projectSummaries", meaning: "State Channel receiving merged results.", required: true },
      { key: "reducer", example: "append", meaning: "Reducer used to merge fan-out results.", required: true },
      { key: "trace_step_id", example: "parallel_summarize", meaning: "Trace id for fan-out dispatch.", required: true },
    ],
  },
  {
    blockId: "langgraph.flow.command",
    label: "Command",
    kind: "flow",
    langGraphPattern: "Command",
    summary: "Return state updates and goto target from one node.",
    fields: [
      { key: "reads", example: "state.currentTask", meaning: "State Channels read by the command.", required: true },
      { key: "writes", example: "state.nextTask,state.status", meaning: "State updates returned by the command.", required: true },
      { key: "goto_ports", example: "planner,executor,reviewer", meaning: "Allowed goto targets.", required: true },
      { key: "command_ref", example: "workflow.route_next", meaning: "Runtime registry ref returning update + goto.", required: true },
      { key: "trace_step_id", example: "route_next", meaning: "Trace id for command decision.", required: true },
    ],
  },
  {
    blockId: "langgraph.edge.default",
    label: "Default Edge",
    kind: "edge",
    langGraphPattern: "add_edge",
    summary: "Connect two nodes with an unconditional transition.",
    fields: [
      { key: "from", example: "load_context", meaning: "Source node id.", required: true },
      { key: "to", example: "generate_doc", meaning: "Target node id.", required: true },
      { key: "label", example: "default", meaning: "Optional display label.", required: false },
    ],
  },
  {
    blockId: "io.load_local_folder",
    label: "Load Context",
    kind: "io",
    langGraphPattern: "add_node",
    summary: "Read local files/folders and build a state channel for downstream nodes.",
    fields: [
      { key: "reads", example: "resource.projectsFolder", meaning: "Local folder or resource to read.", required: true },
      { key: "writes", example: "state.contextPackage", meaning: "State Channel populated from the source.", required: true },
      { key: "callable_ref", example: "pjv34.load_context", meaning: "Registry callable used by runtime.", required: true },
      { key: "trace_step_id", example: "load_context", meaning: "Trace id that binds map node, runtime step, and logs.", required: true },
    ],
  },
  {
    blockId: "llm.generate_doc.subsystem",
    label: "Generate Doc",
    kind: "subsystem",
    langGraphPattern: "StateGraph subgraph + add_node + add_conditional_edges",
    summary: "Generate a document with an LLM while keeping provider retry/fallback inside the subsystem.",
    fields: [
      { key: "reads", example: "state.contextPackage,state.docGoal", meaning: "State Channels used to build the prompt.", required: true },
      { key: "writes", example: "state.draftDocument", meaning: "Generated draft channel.", required: true },
      { key: "provider", example: "deepseek", meaning: "LLM provider name.", required: true },
      { key: "model", example: "deepseek-chat", meaning: "LLM model id.", required: true },
      { key: "prompt_text", example: "Write a weekly report from context.", meaning: "Prompt slot filled by AI/human.", required: true },
      { key: "failure_policy", example: "retry:1,on_error:fallback_qn", meaning: "Retry/fallback policy hidden inside subsystem.", required: true },
      { key: "trace_step_id", example: "generate_doc", meaning: "Trace id for the outer subsystem node.", required: true },
    ],
  },
  {
    blockId: "io.write_artifact",
    label: "Write Output",
    kind: "io",
    langGraphPattern: "add_node",
    summary: "Write a State Channel to a file or artifact destination.",
    fields: [
      { key: "reads", example: "state.draftDocument", meaning: "State Channel to persist.", required: true },
      { key: "writes", example: "resource.tmpWeeklyReview", meaning: "Artifact or file resource to write.", required: true },
      { key: "callable_ref", example: "pjv34.write_output", meaning: "Registry callable used by runtime.", required: true },
      { key: "trace_step_id", example: "write_output", meaning: "Trace id that binds map node, runtime step, and logs.", required: true },
    ],
  },
] as const;

export function systemBlockTemplateById(blockId: string): SystemBlockTemplate | undefined {
  return SYSTEM_BLOCK_TEMPLATES.find((template) => template.blockId === blockId);
}
