import fs from "fs";
import path from "path";

import { buildPjv34TemplateSystemState } from "./system_block_instantiator";
import { compileFromMap } from "./graph_spec_compile";

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

function repoRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
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

async function loadContextNode(state: TemplateRunState, root: string): Promise<void> {
  const projectsRoot = path.join(root, "projects");
  const projects = discoverProjectDirs(projectsRoot).map((dir) => {
    const readme = readTextIfExists(path.join(dir, "README.md"));
    const tasks = readTextIfExists(path.join(dir, "tasks.yaml"));
    return {
      id: path.basename(dir),
      title: firstHeading(readme) || path.basename(dir),
      relativePath: path.relative(root, dir).replace(/\\/g, "/"),
      hasPlan: fs.existsSync(path.join(dir, "plan.md")),
      hasTasks: Boolean(tasks),
      pendingTasks: pendingTasks(tasks),
    };
  });
  state.contextPackage = {
    generatedAt: new Date().toISOString(),
    projects,
  };
  state.docGoal = "ローカル projects/ を入力として、今週の作業状況と次アクションを日本語で簡潔にまとめる。";
  trace(state, {
    nodeId: "load_context",
    at: new Date().toISOString(),
    status: "ok",
    message: `Loaded ${projects.length} projects.`,
  });
}

async function buildPromptNode(state: TemplateRunState): Promise<void> {
  if (!state.contextPackage) throw new Error("contextPackage missing");
  state.prompt = [
    "あなたはM3Eの週次レビュー作成エージェントです。",
    "入力されたprojects/の要約から、今週のレポートを日本語で作成してください。",
    "出力はMarkdown。セクションは Summary / Project Notes / Next Actions。",
    "",
    `Goal: ${state.docGoal}`,
    "",
    "Context JSON:",
    JSON.stringify(state.contextPackage, null, 2),
  ].join("\n");
  trace(state, {
    nodeId: "build_prompt",
    at: new Date().toISOString(),
    status: "ok",
    message: "Prompt built.",
  });
}

async function callProviderNode(state: TemplateRunState): Promise<void> {
  if (!state.prompt) throw new Error("prompt missing");
  const apiKey = process.env.M3E_AI_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
  const baseUrl = (process.env.M3E_AI_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.M3E_AI_MODEL?.trim() || "deepseek-chat";
  if (!apiKey) {
    throw new Error("DeepSeek API key missing. Set M3E_AI_API_KEY or DEEPSEEK_API_KEY.");
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
    trace(state, {
      nodeId: "call_provider",
      at: new Date().toISOString(),
      status: "error",
      message: `Provider failed: ${state.error}`,
      latencyMs,
    });
    return;
  }

  state.providerResponse = extractMessageText(body);
  trace(state, {
    nodeId: "call_provider",
    at: new Date().toISOString(),
    status: "ok",
    message: "DeepSeek response received.",
    latencyMs,
    usage: {
      inputTokens: body.usage?.prompt_tokens,
      outputTokens: body.usage?.completion_tokens,
      totalTokens: body.usage?.total_tokens,
    },
  });
}

async function evaluateResponseNode(state: TemplateRunState): Promise<void> {
  if (state.error) {
    state.route = "api_error";
  } else if (!state.providerResponse || state.providerResponse.trim().length < 80) {
    state.error = "Provider response is empty or too short.";
    state.route = "bad_output";
  } else {
    state.draftDocument = state.providerResponse;
    state.route = "pass";
  }
  trace(state, {
    nodeId: "evaluate_response",
    at: new Date().toISOString(),
    status: "route",
    message: `route=${state.route}`,
  });
}

async function retryBackoffNode(state: TemplateRunState): Promise<void> {
  state.retryCount += 1;
  state.route = state.retryCount <= 1 ? "retry" : "exhausted";
  trace(state, {
    nodeId: "retry_backoff",
    at: new Date().toISOString(),
    status: "route",
    message: `route=${state.route}; retryCount=${state.retryCount}`,
  });
}

async function fallbackQnNode(state: TemplateRunState): Promise<void> {
  state.qn = `Generate Doc failed: ${state.error || "unknown error"}`;
  state.draftDocument = [
    "# Weekly Project Review",
    "",
    "DeepSeek generation failed and fallback Qn was produced.",
    "",
    `- ${state.qn}`,
  ].join("\n");
  trace(state, {
    nodeId: "fallback_qn",
    at: new Date().toISOString(),
    status: "ok",
    message: "Fallback Qn produced.",
  });
}

async function returnDraftNode(state: TemplateRunState): Promise<void> {
  if (!state.draftDocument) throw new Error("draftDocument missing");
  trace(state, {
    nodeId: "return_draft",
    at: new Date().toISOString(),
    status: "ok",
    message: "Draft returned from Generate Doc subsystem.",
  });
}

async function writeOutputNode(state: TemplateRunState, root: string): Promise<void> {
  if (!state.draftDocument) throw new Error("draftDocument missing");
  const outputRoot = path.join(root, "tmp");
  ensureDir(outputRoot);
  const mdPath = path.join(outputRoot, "pjv34-template-run-latest.md");
  const jsonPath = path.join(outputRoot, "pjv34-template-run-latest.json");
  fs.writeFileSync(mdPath, state.draftDocument, "utf8");
  state.finalReportPath = path.relative(root, mdPath).replace(/\\/g, "/");
  fs.writeFileSync(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  trace(state, {
    nodeId: "write_output",
    at: new Date().toISOString(),
    status: "ok",
    message: `Wrote ${state.finalReportPath}.`,
  });
  fs.writeFileSync(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function runGenerateDocSubsystem(state: TemplateRunState): Promise<void> {
  await buildPromptNode(state);
  while (true) {
    state.error = undefined;
    await callProviderNode(state);
    await evaluateResponseNode(state);
    if (state.route === "pass") {
      await returnDraftNode(state);
      return;
    }
    if (state.route === "bad_output") {
      await fallbackQnNode(state);
      return;
    }
    await retryBackoffNode(state);
    if (state.route === "retry") continue;
    await fallbackQnNode(state);
    return;
  }
}

async function main(): Promise<void> {
  const root = repoRoot();
  const appState = buildPjv34TemplateSystemState();
  const rootCompile = compileFromMap(appState, "pjv34_system");
  const generateDocCompile = compileFromMap(appState, "generate_doc");
  if (rootCompile.warnings.length || generateDocCompile.warnings.length) {
    throw new Error(`Template GraphSpec warnings: root=${rootCompile.warnings.length}, generateDoc=${generateDocCompile.warnings.length}`);
  }

  const state: TemplateRunState = { retryCount: 0, trace: [] };
  await loadContextNode(state, root);
  await runGenerateDocSubsystem(state);
  await writeOutputNode(state, root);
  console.log(`PJv34 template run written to ${state.finalReportPath}`);
  console.log(`Trace nodes: ${state.trace.map((item) => item.nodeId).join(" -> ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
