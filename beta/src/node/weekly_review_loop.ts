import fs from "fs";
import path from "path";

type ProjectStatus = "active" | "paused" | "done" | "unknown";

interface ProjectSummary {
  id: string;
  name: string;
  relativePath: string;
  status: ProjectStatus;
  title: string;
  hasReadme: boolean;
  hasPlan: boolean;
  hasTasks: boolean;
  reviewCount: number;
  taskCounts: Record<string, number>;
  recentProgress: string[];
  nextActions: string[];
  warnings: string[];
}

interface WeeklyReviewOutput {
  ok: boolean;
  generatedAt: string;
  inputRoot: string;
  outputRoot: string;
  projects: ProjectSummary[];
  questions: Array<{ project: string; title: string; reason: string }>;
  summary: {
    projectCount: number;
    activeCount: number;
    pausedCount: number;
    doneCount: number;
    unknownCount: number;
  };
}

interface DeepSeekReviewOutput {
  ok: boolean;
  generatedAt: string;
  provider: "deepseek";
  model: string;
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  markdown?: string;
  error?: {
    message: string;
    status?: number;
  };
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

function ensureInside(parent: string, target: string): void {
  const relative = path.relative(parent, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escaped allowed root: ${target}`);
  }
}

function readTextIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return null;
  return fs.readFileSync(filePath, "utf8");
}

function parseFrontmatter(markdown: string | null): Record<string, string> {
  if (!markdown) return {};
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (item) fields[item[1]] = item[2].trim().replace(/^["']|["']$/g, "");
  }
  return fields;
}

function firstHeading(markdown: string | null): string {
  if (!markdown) return "";
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || "";
}

function normalizeStatus(raw: string | undefined): ProjectStatus {
  const value = (raw || "").toLowerCase();
  if (value === "active" || value === "paused" || value === "done") return value;
  if (value === "exploring" || value === "ready") return "active";
  return "unknown";
}

function discoverProjectDirs(projectsRoot: string): string[] {
  const dirs: string[] = [];

  function walk(current: string, depth: number): void {
    ensureInside(projectsRoot, current);
    if (depth > 4) return;

    const readme = path.join(current, "README.md");
    const base = path.basename(current);
    if (fs.existsSync(readme) && (base.startsWith("PJ") || current !== projectsRoot)) {
      dirs.push(current);
      return;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const child = path.join(current, entry.name);
      const childBase = path.basename(child);
      if (depth === 0 && !childBase.startsWith("PJ")) continue;
      walk(child, depth + 1);
    }
  }

  walk(projectsRoot, 0);
  return dirs.sort((a, b) => a.localeCompare(b));
}

function countTaskStatuses(tasksText: string | null): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!tasksText) return counts;
  const matches = tasksText.matchAll(/^\s*status:\s*([A-Za-z0-9_-]+)/gm);
  for (const match of matches) {
    const status = match[1];
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function extractRecentProgress(...texts: Array<string | null>): string[] {
  const lines: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (/^- \d{4}-\d{2}-\d{2}:/.test(trimmed) || /^- 20\d{2}-\d{2}-\d{2}:/.test(trimmed)) {
        lines.push(trimmed.replace(/^- /, ""));
      }
    }
  }
  return lines.slice(-5);
}

function extractNextActions(planText: string | null, tasksText: string | null): string[] {
  const actions: string[] = [];
  if (tasksText) {
    const blocks = tasksText.split(/\n(?=- id:\s*)/);
    for (const block of blocks) {
      if (!/status:\s*pending/.test(block)) continue;
      const id = block.match(/^- id:\s*(.+)$/m)?.[1]?.trim();
      const target = block.match(/^\s*target:\s*"?([^"\n]+)"?/m)?.[1]?.trim();
      if (id && target) actions.push(`${id}: ${target}`);
    }
  }
  if (actions.length === 0 && planText) {
    for (const line of planText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (/^- \[ \]/.test(trimmed)) actions.push(trimmed.replace(/^- \[ \]\s*/, ""));
    }
  }
  return actions.slice(0, 5);
}

function summarizeProject(projectDir: string, projectsRoot: string): ProjectSummary {
  ensureInside(projectsRoot, projectDir);
  const relativePath = path.relative(repoRoot(), projectDir).replace(/\\/g, "/");
  const readmePath = path.join(projectDir, "README.md");
  const planPath = path.join(projectDir, "plan.md");
  const tasksPath = path.join(projectDir, "tasks.yaml");
  const reviewsDir = path.join(projectDir, "reviews");

  const readme = readTextIfExists(readmePath);
  const plan = readTextIfExists(planPath);
  const tasks = readTextIfExists(tasksPath);
  const frontmatter = parseFrontmatter(readme);
  const planFrontmatter = parseFrontmatter(plan);
  const status = normalizeStatus(frontmatter.status || planFrontmatter.status);
  const reviewCount = fs.existsSync(reviewsDir) && fs.statSync(reviewsDir).isDirectory()
    ? fs.readdirSync(reviewsDir).filter((item) => item.endsWith(".md")).length
    : 0;

  const warnings: string[] = [];
  if (!readme) warnings.push("README.md missing");
  if (!plan) warnings.push("plan.md missing");
  if (!tasks) warnings.push("tasks.yaml missing");

  return {
    id: frontmatter.pj_id || path.basename(projectDir),
    name: frontmatter.project || path.basename(projectDir),
    relativePath,
    status,
    title: firstHeading(readme) || path.basename(projectDir),
    hasReadme: Boolean(readme),
    hasPlan: Boolean(plan),
    hasTasks: Boolean(tasks),
    reviewCount,
    taskCounts: countTaskStatuses(tasks),
    recentProgress: extractRecentProgress(readme, plan),
    nextActions: extractNextActions(plan, tasks),
    warnings,
  };
}

function buildOutput(projectsRoot: string, outputRoot: string): WeeklyReviewOutput {
  const projectDirs = discoverProjectDirs(projectsRoot);
  const projects = projectDirs.map((dir) => summarizeProject(dir, projectsRoot));
  const questions = projects.flatMap((project) => project.warnings.map((warning) => ({
    project: project.id,
    title: "Project input incomplete",
    reason: warning,
  })));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    inputRoot: path.relative(repoRoot(), projectsRoot).replace(/\\/g, "/"),
    outputRoot: path.relative(repoRoot(), outputRoot).replace(/\\/g, "/"),
    projects,
    questions,
    summary: {
      projectCount: projects.length,
      activeCount: projects.filter((project) => project.status === "active").length,
      pausedCount: projects.filter((project) => project.status === "paused").length,
      doneCount: projects.filter((project) => project.status === "done").length,
      unknownCount: projects.filter((project) => project.status === "unknown").length,
    },
  };
}

function renderMarkdown(output: WeeklyReviewOutput): string {
  const lines: string[] = [
    "# Weekly Project Review",
    "",
    `Generated: ${output.generatedAt}`,
    `Input: ${output.inputRoot}`,
    "",
    "## Summary",
    "",
    `- Projects: ${output.summary.projectCount}`,
    `- Active: ${output.summary.activeCount}`,
    `- Paused: ${output.summary.pausedCount}`,
    `- Done: ${output.summary.doneCount}`,
    `- Unknown: ${output.summary.unknownCount}`,
    "",
    "## Projects",
    "",
  ];

  for (const project of output.projects) {
    lines.push(`### ${project.id} ${project.title}`);
    lines.push("");
    lines.push(`- Path: ${project.relativePath}`);
    lines.push(`- Status: ${project.status}`);
    lines.push(`- Reviews: ${project.reviewCount}`);
    const taskSummary = Object.entries(project.taskCounts).map(([key, count]) => `${key}=${count}`).join(", ");
    lines.push(`- Tasks: ${taskSummary || "n/a"}`);
    if (project.recentProgress.length > 0) {
      lines.push("- Recent progress:");
      for (const item of project.recentProgress) lines.push(`  - ${item}`);
    }
    if (project.nextActions.length > 0) {
      lines.push("- Next actions:");
      for (const item of project.nextActions) lines.push(`  - ${item}`);
    }
    if (project.warnings.length > 0) {
      lines.push("- Warnings:");
      for (const item of project.warnings) lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  lines.push("## Questions");
  lines.push("");
  if (output.questions.length === 0) {
    lines.push("- None");
  } else {
    for (const question of output.questions) {
      lines.push(`- ${question.project}: ${question.reason}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function extractTextContent(payload: ChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => item.text || "").join("").trim();
  }
  if (payload.error?.message) throw new Error(payload.error.message);
  throw new Error("DeepSeek returned no text content.");
}

function buildDeepSeekPrompt(output: WeeklyReviewOutput): string {
  return [
    "以下はM3Eのローカル projects/ フォルダから抽出したsub-PJ週次レビュー用JSONです。",
    "事実ベースで、誇張せず、次の形式で日本語Markdownを返してください。",
    "",
    "# Weekly Review",
    "## 今週の要約",
    "## PJ別状況",
    "## リスク / Qn",
    "## 次の一手",
    "",
    "入力JSON:",
    JSON.stringify(output, null, 2),
  ].join("\n");
}

async function runDeepSeekReview(output: WeeklyReviewOutput): Promise<DeepSeekReviewOutput> {
  const apiKey = process.env.M3E_AI_API_KEY?.trim();
  const baseUrl = (process.env.M3E_AI_BASE_URL?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.M3E_AI_MODEL?.trim() || "deepseek-chat";
  const startedAt = Date.now();

  if (!apiKey) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      provider: "deepseek",
      model,
      latencyMs: Date.now() - startedAt,
      error: { message: "M3E_AI_API_KEY is missing." },
    };
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You produce concise factual weekly project review reports. Do not invent facts not present in the input JSON.",
          },
          { role: "user", content: buildDeepSeekPrompt(output) },
        ],
        temperature: 0.2,
        max_tokens: 1600,
      }),
    });
    const payload = await response.json() as ChatCompletionResponse;
    if (!response.ok) {
      return {
        ok: false,
        generatedAt: new Date().toISOString(),
        provider: "deepseek",
        model,
        latencyMs: Date.now() - startedAt,
        error: {
          message: payload.error?.message || `DeepSeek request failed with status ${response.status}.`,
          status: response.status,
        },
      };
    }

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      provider: "deepseek",
      model,
      latencyMs: Date.now() - startedAt,
      markdown: extractTextContent(payload),
      usage: payload.usage ? {
        inputTokens: payload.usage.prompt_tokens,
        outputTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens,
      } : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      provider: "deepseek",
      model,
      latencyMs: Date.now() - startedAt,
      error: { message: (err as Error).message || "DeepSeek request failed." },
    };
  }
}

export async function runWeeklyReviewLoop(): Promise<WeeklyReviewOutput> {
  const root = repoRoot();
  const projectsRoot = path.join(root, "projects");
  const outputRoot = path.join(root, "tmp");
  ensureInside(root, projectsRoot);
  ensureInside(root, outputRoot);
  fs.mkdirSync(outputRoot, { recursive: true });

  const output = buildOutput(projectsRoot, outputRoot);
  fs.writeFileSync(path.join(outputRoot, "weekly-review-latest.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputRoot, "weekly-review-latest.md"), renderMarkdown(output), "utf8");
  if ((process.env.WEEKLY_REVIEW_PROVIDER || "").toLowerCase() === "deepseek") {
    const deepSeekOutput = await runDeepSeekReview(output);
    fs.writeFileSync(
      path.join(outputRoot, "weekly-review-deepseek-latest.json"),
      `${JSON.stringify(deepSeekOutput, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(outputRoot, "weekly-review-deepseek-latest.md"),
      `${deepSeekOutput.markdown || `# DeepSeek Weekly Review\n\nDeepSeek call failed: ${deepSeekOutput.error?.message || "unknown error"}\n`}\n`,
      "utf8",
    );
  }
  return output;
}

if (require.main === module) {
  runWeeklyReviewLoop()
    .then((output) => {
      const suffix = (process.env.WEEKLY_REVIEW_PROVIDER || "").toLowerCase() === "deepseek"
        ? " and tmp/weekly-review-deepseek-latest.md"
        : "";
      console.log(`Weekly review written to tmp/weekly-review-latest.md${suffix} (${output.projects.length} projects).`);
    })
    .catch((err) => {
      console.error((err as Error).message || "Weekly review loop failed.");
      process.exitCode = 1;
    });
}
