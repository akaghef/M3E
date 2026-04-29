export type SystemBlockKind = "callable" | "router" | "subsystem" | "io";

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
