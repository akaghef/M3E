import fs from "fs";
import path from "path";
import YAML from "js-yaml";

import { compileFromMap } from "./graph_spec_compile";
import { buildTemplateSystemState } from "./template_system_builder";
import type { GraphSpec, GraphSpecConditionalEdge, GraphSpecEdge, GraphSpecNode } from "../shared/graph_spec_types";
import { GRAPH_SPEC_END, validateGraphSpec } from "../shared/graph_spec_types";
import type { TemplateSystemSpec } from "../shared/template_system_spec";

interface TemplateRunTrace {
  readonly nodeId: string;
  readonly at: string;
  readonly status: "ok" | "error" | "route";
  readonly message: string;
  readonly latencyMs?: number;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
  };
}

interface ProjectContext {
  readonly id: string;
  readonly title: string;
  readonly relativePath: string;
  readonly hasPlan: boolean;
  readonly hasTasks: boolean;
  readonly pendingTasks: readonly string[];
}

interface TemplateRunState {
  contextPackage?: {
    readonly generatedAt: string;
    readonly projects: readonly ProjectContext[];
  };
  docGoal?: string;
  prompt?: string;
  providerResponse?: string;
  draftDocument?: string;
  error?: string;
  retryCount: number;
  route?: string;
  finalReportPath?: string;
  qn?: string;
  trace: TemplateRunTrace[];
}

interface ChatCompletionResponse {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

type Callable = (state: TemplateRunState, ctx: RunContext, node: GraphSpecNode) => Promise<void>;

interface RunContext {
  readonly repoRoot: string;
  readonly outputMdPath: string;
  readonly outputJsonPath: string;
  readonly graphSpecs: Record<string, GraphSpec>;
}

function repoRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function argValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function loadSpec(specPath: string): TemplateSystemSpec {
  const raw = fs.readFileSync(specPath, "utf8");
  const parsed = path.extname(specPath).toLowerCase() === ".json" ? JSON.parse(raw) : YAML.load(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid Template System Spec: ${specPath}`);
  }
  const spec = parsed as Partial<TemplateSystemSpec>;
  if (!spec.id || !spec.label) {
    throw new Error(`Invalid Template System Spec: missing id/label: ${specPath}`);
  }
  return spec as TemplateSystemSpec;
}

function readTextIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return null;
  return fs.readFileSync(filePath, "utf8");
}

function firstHeading(markdown: string | null): string {
  if (!markdown) return "";
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || "";
}

function discoverProjectDirs(projectsRoot: string): string[] {
  if (!fs.existsSync(projectsRoot)) return [];
  return fs.readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("PJ"))
    .map((entry) => path.join(projectsRoot, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "README.md")))
    .sort((a, b) => a.localeCompare(b));
}

function pendingTasks(tasksText: string | null): string[] {
  if (!tasksText) return [];
  return tasksText
    .split(/\n(?=- id:\s*)/)
    .filter((block) => /status:\s*pending/.test(block))
    .map((block) => {
      const id = block.match(/^- id:\s*(.+)$/m)?.[1]?.trim();
      const target = block.match(/^\s*target:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
      return [id, target].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .slice(0, 5);
}

function extractMessageText(response: ChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text || "").join("").trim();
  }
  return "";
}

function trace(state: TemplateRunState, event: TemplateRunTrace): void {
  state.trace.push(event);
}

async function loadContext(state: TemplateRunState, ctx: RunContext, node: GraphSpecNode): Promise<void> {
  const projectsRoot = path.join(ctx.repoRoot, "projects");
  const projects = discoverProjectDirs(projectsRoot).map((dir) => {
    const readme = readTextIfExists(path.join(dir, "README.md"));
    const tasks = readTextIfExists(path.join(dir, "tasks.yaml"));
    return {
      id: path.basename(dir),
      title: firstHeading(readme) || path.basename(dir),
      relativePath: path.relative(ctx.repoRoot, dir).replace(/\\/g, "/"),
      hasPlan: fs.existsSync(path.join(dir, "plan.md")),
      hasTasks: Boolean(tasks),
      pendingTasks: pendingTasks(tasks),
    };
  });
  state.contextPackage = { generatedAt: new Date().toISOString(), projects };
  state.docGoal = node.metadata?.doc_goal || "ローカル projects/ を入力として、今週の作業状況と次アクションを日本語で簡潔にまとめる。";
  trace(state, {
    nodeId: node.id,
    at: new Date().toISOString(),
    status: "ok",
    message: `Loaded ${projects.length} projects.`,
  });
}

async function buildPrompt(state: TemplateRunState, _ctx: RunContext, node: GraphSpecNode): Promise<void> {
  if (!state.contextPackage) throw new Error("contextPackage missing");
  const promptInstruction = node.metadata?.prompt_text || "出力はMarkdown。セクションは Summary / Project Notes / Next Actions。";
  state.prompt = [
    "あなたはM3Eのプロジェクト設計レビューエージェントです。",
    "入力されたprojects/の要約から、指定された目的に合う日本語Markdownを作成してください。",
    promptInstruction,
    "",
    `Goal: ${state.docGoal}`,
    "",
    "Context JSON:",
    JSON.stringify(state.contextPackage, null, 2),
  ].join("\n");
  trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "ok", message: "Prompt built." });
}

async function callProvider(state: TemplateRunState, _ctx: RunContext, node: GraphSpecNode): Promise<void> {
  if (!state.prompt) throw new Error("prompt missing");
  if (process.env.M3E_TEMPLATE_FORCE_PROVIDER_ERROR === "1") {
    state.error = "Forced provider error for template runner test.";
    trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "error", message: state.error });
    return;
  }
  const apiKey = process.env.M3E_AI_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
  const providerMode = process.env.WEEKLY_REVIEW_PROVIDER?.trim() || (apiKey ? "deepseek" : "mock");
  if (providerMode === "mock") {
    state.providerResponse = mockWeeklyReview(state);
    trace(state, {
      nodeId: node.id,
      at: new Date().toISOString(),
      status: "ok",
      message: "Mock provider response produced.",
    });
    return;
  }

  const baseUrl = (process.env.M3E_AI_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.M3E_AI_MODEL?.trim() || "deepseek-chat";
  if (!apiKey) {
    state.error = "DeepSeek API key missing. Set M3E_AI_API_KEY or DEEPSEEK_API_KEY.";
    trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "error", message: state.error });
    return;
  }
  const started = Date.now();
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You produce concise Japanese project review reports." },
        { role: "user", content: state.prompt },
      ],
      temperature: 0.2,
      max_tokens: 1400,
    }),
  });
  const latencyMs = Date.now() - started;
  const body = await response.json() as ChatCompletionResponse;
  if (!response.ok || body.error) {
    state.error = body.error?.message || `DeepSeek request failed with HTTP ${response.status}`;
    trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "error", message: `Provider failed: ${state.error}`, latencyMs });
    return;
  }
  state.providerResponse = extractMessageText(body);
  trace(state, {
    nodeId: node.id,
    at: new Date().toISOString(),
    status: "ok",
    message: "Provider response received.",
    latencyMs,
    usage: {
      inputTokens: body.usage?.prompt_tokens,
      outputTokens: body.usage?.completion_tokens,
      totalTokens: body.usage?.total_tokens,
    },
  });
}

async function evaluateResponse(state: TemplateRunState, _ctx: RunContext, node: GraphSpecNode): Promise<void> {
  if (state.error) {
    state.route = "api_error";
  } else if (!state.providerResponse || state.providerResponse.trim().length < 80) {
    state.error = "Provider response is empty or too short.";
    state.route = "bad_output";
  } else {
    state.draftDocument = state.providerResponse;
    state.route = "pass";
  }
  trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "route", message: `route=${state.route}` });
}

async function retryBackoff(state: TemplateRunState, _ctx: RunContext, node: GraphSpecNode): Promise<void> {
  state.retryCount += 1;
  state.route = state.retryCount <= 1 ? "retry" : "exhausted";
  trace(state, {
    nodeId: node.id,
    at: new Date().toISOString(),
    status: "route",
    message: `route=${state.route}; retryCount=${state.retryCount}`,
  });
}

async function fallbackQn(state: TemplateRunState, _ctx: RunContext, node: GraphSpecNode): Promise<void> {
  state.qn = `Generate Doc failed: ${state.error || "unknown error"}`;
  state.draftDocument = [
    "# Weekly Project Review",
    "",
    "Provider generation failed and fallback Qn was produced.",
    "",
    `- ${state.qn}`,
  ].join("\n");
  trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "ok", message: "Fallback Qn produced." });
}

async function returnDraft(state: TemplateRunState, _ctx: RunContext, node: GraphSpecNode): Promise<void> {
  if (!state.draftDocument) throw new Error("draftDocument missing");
  trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "ok", message: "Draft returned." });
}

async function writeOutput(state: TemplateRunState, ctx: RunContext, node: GraphSpecNode): Promise<void> {
  if (!state.draftDocument) throw new Error("draftDocument missing");
  ensureDir(path.dirname(ctx.outputMdPath));
  ensureDir(path.dirname(ctx.outputJsonPath));
  fs.writeFileSync(ctx.outputMdPath, state.draftDocument, "utf8");
  state.finalReportPath = path.relative(ctx.repoRoot, ctx.outputMdPath).replace(/\\/g, "/");
  trace(state, { nodeId: node.id, at: new Date().toISOString(), status: "ok", message: `Wrote ${state.finalReportPath}.` });
}

const CALLABLES: Record<string, Callable> = {
  "pjv34.load_context": loadContext,
  "pjv34.generate_doc.build_prompt": buildPrompt,
  "pjv34.generate_doc.call_deepseek": callProvider,
  "pjv34.generate_doc.evaluate_response": evaluateResponse,
  "pjv34.generate_doc.retry_backoff": retryBackoff,
  "pjv34.generate_doc.fallback_qn": fallbackQn,
  "pjv34.generate_doc.return_draft": returnDraft,
  "pjv34.write_output": writeOutput,
};

function resolveCallable(ref: string | undefined): Callable | undefined {
  if (!ref) return undefined;
  const exact = CALLABLES[ref];
  if (exact) return exact;
  if (ref.endsWith(".load_context") || ref.endsWith(".load_sources")) return loadContext;
  if (ref.endsWith(".build_prompt")) return buildPrompt;
  if (ref.endsWith(".call_provider") || ref.endsWith(".call_deepseek")) return callProvider;
  if (ref.endsWith(".evaluate_response") || ref.endsWith(".evaluate_artifact")) return evaluateResponse;
  if (ref.endsWith(".retry_backoff")) return retryBackoff;
  if (ref.endsWith(".fallback_qn")) return fallbackQn;
  if (ref.endsWith(".return_draft") || ref.endsWith(".return_artifact")) return returnDraft;
  if (ref.endsWith(".write_output")) return writeOutput;
  return undefined;
}

async function executeGraph(spec: GraphSpec, state: TemplateRunState, ctx: RunContext): Promise<void> {
  let current = spec.entry;
  const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
  for (let steps = 0; steps < 100; steps += 1) {
    if (current === GRAPH_SPEC_END) return;
    const node = nodeById.get(current);
    if (!node) throw new Error(`Graph node not found: ${spec.scopeId}.${current}`);
    if (node.kind === "subgraph") {
      const subgraphId = node.subgraphScopeId;
      if (!subgraphId || !ctx.graphSpecs[subgraphId]) throw new Error(`Subgraph not found: ${node.id}`);
      await executeGraph(ctx.graphSpecs[subgraphId], state, ctx);
    } else {
      const callable = resolveCallable(node.ref);
      if (!callable) throw new Error(`Callable not registered: ${node.id}:${node.ref ?? ""}`);
      await callable(state, ctx, node);
    }
    current = nextNode(spec.edges, current, state.route);
  }
  throw new Error(`Recursion limit reached in scope ${spec.scopeId}`);
}

function nextNode(edges: readonly GraphSpecEdge[], source: string, route: string | undefined): string {
  const conditional = edges.find((edge): edge is GraphSpecConditionalEdge => edge.kind === "conditional" && edge.source === source);
  if (conditional) {
    const target = route ? conditional.branches[route] : undefined;
    if (target) return target;
    if (conditional.defaultTarget) return conditional.defaultTarget;
    throw new Error(`No conditional branch for ${source}: ${route ?? "undefined"}`);
  }
  const staticEdge = edges.find((edge) => edge.kind === "static" && edge.source === source);
  if (staticEdge?.kind !== "static") return GRAPH_SPEC_END;
  return staticEdge?.target ?? GRAPH_SPEC_END;
}

function mockWeeklyReview(state: TemplateRunState): string {
  const projects = state.contextPackage?.projects ?? [];
  const notes = projects.slice(0, 5).map((project) => (
    `- ${project.id}: ${project.title} (${project.pendingTasks.length} pending tasks)`
  ));
  const designMode = /設計|design/i.test(state.docGoal || "");
  const title = designMode ? "Project Design Report" : "Weekly Project Review";
  const notesTitle = designMode ? "Project Design Notes" : "Project Notes";
  return [
    `# ${title}`,
    "",
    "## Summary",
    "",
    `projects/ から ${projects.length} projects を読み込みました。`,
    "",
    `## ${notesTitle}`,
    "",
    ...notes,
    "",
    ...(designMode ? ["## Risk and Gaps", "", "- PJ04 以外の PJv* で template 汎用性を確認する必要があります。"] : []),
    "",
    "## Next Actions",
    "",
    "- PJ04 の Template System Spec を generic runner / tests へ接続する。",
    "- bridge/checkpoint/UI は契約が固まるまで後段に残す。",
  ].join("\n");
}

async function main(): Promise<void> {
  const root = repoRoot();
  const args = process.argv.slice(2);
  const specPath = path.resolve(root, argValue(args, "--spec") ?? "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml");
  const outputMdPath = path.resolve(root, argValue(args, "--out") ?? "tmp/template-run-latest.md");
  const outputJsonPath = outputMdPath.replace(/\.md$/i, ".json");
  const spec = loadSpec(specPath);
  const build = buildTemplateSystemState(spec);
  if (build.issues.length) throw new Error(`Template build issues: ${JSON.stringify(build.issues)}`);

  const graphSpecs: Record<string, GraphSpec> = {};
  for (const scopeId of Object.keys(build.state.scopes ?? {}).sort()) {
    const compiled = compileFromMap(build.state, scopeId);
    const validation = validateGraphSpec(compiled.spec);
    if (compiled.warnings.length || validation.length) {
      throw new Error(`GraphSpec invalid: ${scopeId}, warnings=${compiled.warnings.length}, validation=${validation.length}`);
    }
    graphSpecs[scopeId] = compiled.spec;
  }

  const state: TemplateRunState = { retryCount: 0, trace: [] };
  await executeGraph(graphSpecs[spec.id], state, { repoRoot: root, outputMdPath, outputJsonPath, graphSpecs });
  fs.writeFileSync(outputJsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`Template run written to ${path.relative(root, outputMdPath).replace(/\\/g, "/")}`);
  console.log(`Trace nodes: ${state.trace.map((item) => item.nodeId).join(" -> ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
