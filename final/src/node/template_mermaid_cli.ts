import fs from "fs";
import path from "path";
import YAML from "js-yaml";

import { compileFromMap } from "./graph_spec_compile";
import { buildTemplateSystemState } from "./template_system_builder";
import { graphSpecToMermaid } from "../shared/graph_spec_mermaid";
import { validateGraphSpec, type GraphSpec } from "../shared/graph_spec_types";
import { SYSTEM_BLOCK_TEMPLATES } from "../shared/system_block_templates";
import type { TemplateSystemScopeSpec, TemplateSystemSpec } from "../shared/template_system_spec";

interface MermaidDiagram {
  readonly specPath: string;
  readonly specId: string;
  readonly specLabel: string;
  readonly scopeId: string;
  readonly mermaid: string;
}

interface TemplateUsage {
  readonly blockId: string;
  readonly usedBy: readonly string[];
}

function repoRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function argValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function listTemplateSpecs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ya?ml|json)$/i.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function loadSpec(specPath: string): TemplateSystemSpec {
  const raw = fs.readFileSync(specPath, "utf8");
  const ext = path.extname(specPath).toLowerCase();
  const parsed = ext === ".json" ? JSON.parse(raw) : YAML.load(raw);
  if (!isTemplateSystemSpec(parsed)) {
    throw new Error(`Invalid Template System Spec: ${specPath}`);
  }
  return parsed;
}

function isTemplateSystemSpec(value: unknown): value is TemplateSystemSpec {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && obj.id.length > 0 && typeof obj.label === "string" && obj.label.length > 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlPage(
  title: string,
  sourceLabel: string,
  diagrams: readonly MermaidDiagram[],
  templateUsage: readonly TemplateUsage[],
): string {
  const navItems = diagrams.map((diagram) => `
      <li><a href="#${escapeHtml(sectionId(diagram))}">${escapeHtml(diagram.specId)} / ${escapeHtml(diagram.scopeId)}</a></li>
  `).join("\n");
  const templateUsageById = new Map(templateUsage.map((item) => [item.blockId, item.usedBy]));
  const templateRows = SYSTEM_BLOCK_TEMPLATES.map((template) => {
    const usedBy = templateUsageById.get(template.blockId) ?? [];
    const status = usedBy.length > 0 ? "USED" : "READY";
    const required = template.fields.filter((field) => field.required).map((field) => field.key).join(", ");
    return `
      <tr>
        <td><code>${escapeHtml(template.blockId)}</code></td>
        <td>${escapeHtml(template.kind)}</td>
        <td>${escapeHtml(template.langGraphPattern)}</td>
        <td><span class="status ${status.toLowerCase()}">${status}</span></td>
        <td>${escapeHtml(usedBy.join(", ") || "-")}</td>
        <td>${escapeHtml(required || "-")}</td>
      </tr>
    `;
  }).join("\n");
  const sections = diagrams.map((diagram) => `
    <section class="diagram-section" data-design-id="${escapeHtml(sectionId(diagram))}">
      <h2 id="${escapeHtml(sectionId(diagram))}">${escapeHtml(diagram.specLabel)} <span>${escapeHtml(diagram.scopeId)}</span></h2>
      <div class="source">${escapeHtml(diagram.specPath)}</div>
      <div class="feedback">
        <button type="button" data-feedback="accept">Accept</button>
        <button type="button" data-feedback="reject">Reject</button>
        <span class="feedback-status" data-feedback-status>unreviewed</span>
      </div>
      <div class="mermaid">${escapeHtml(diagram.mermaid)}</div>
      <details>
        <summary>Mermaid source</summary>
        <pre>${escapeHtml(diagram.mermaid)}</pre>
      </details>
    </section>
  `).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #202124; background: #f6f7f8; }
    header { padding: 16px 24px; background: #ffffff; border-bottom: 1px solid #d8dde3; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .source { color: #57606a; font-size: 13px; }
    main { padding: 20px 24px 36px; display: grid; gap: 20px; }
    nav { padding: 12px 24px; background: #ffffff; border-bottom: 1px solid #d8dde3; }
    nav ul { margin: 0; padding-left: 20px; display: flex; flex-wrap: wrap; gap: 8px 24px; }
    nav a { color: #245b91; text-decoration: none; }
    .diagram-section { background: #ffffff; border: 1px solid #d8dde3; border-radius: 8px; padding: 16px; overflow: auto; }
    h2 { margin: 0 0 4px; font-size: 16px; }
    h2 span { color: #57606a; font-weight: 500; margin-left: 8px; }
    .summary-section { background: #ffffff; border: 1px solid #d8dde3; border-radius: 8px; padding: 16px; overflow: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #d8dde3; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f2f4f7; }
    code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    .status { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .status.used { background: #eaf7ea; color: #2f6d32; }
    .status.ready { background: #eef2f6; color: #4a5563; }
    .feedback { display: flex; align-items: center; gap: 8px; margin: 10px 0 12px; }
    .feedback button { border: 1px solid #b7c0ca; background: #ffffff; border-radius: 6px; padding: 5px 10px; cursor: pointer; }
    .feedback button:hover { background: #f2f4f7; }
    .feedback-status { color: #57606a; font-size: 13px; }
    .feedback-status.accept { color: #2f6d32; font-weight: 600; }
    .feedback-status.reject { color: #9f2f2f; font-weight: 600; }
    .mermaid { min-width: 680px; }
    details { margin-top: 12px; }
    pre { overflow: auto; padding: 12px; background: #f2f4f7; border: 1px solid #d8dde3; border-radius: 6px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="source">${escapeHtml(sourceLabel)}</div>
  </header>
  <nav>
    <ul>
${navItems}
    </ul>
  </nav>
  <main>
    <section class="summary-section">
      <h2>LangGraph Node Template Status</h2>
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Kind</th>
            <th>LangGraph Pattern</th>
            <th>Status</th>
            <th>Used By</th>
            <th>Required Slots</th>
          </tr>
        </thead>
        <tbody>
${templateRows}
        </tbody>
      </table>
    </section>
${sections}
  </main>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, securityLevel: "strict", theme: "default" });
    const feedbackKey = "m3e:pj04-mermaid-feedback";
    const readFeedback = () => {
      try { return JSON.parse(localStorage.getItem(feedbackKey) || "{}"); } catch { return {}; }
    };
    const writeFeedback = (value) => localStorage.setItem(feedbackKey, JSON.stringify(value));
    const applyFeedback = () => {
      const state = readFeedback();
      document.querySelectorAll("[data-design-id]").forEach((section) => {
        const id = section.getAttribute("data-design-id");
        const status = section.querySelector("[data-feedback-status]");
        const value = state[id];
        status.textContent = value || "unreviewed";
        status.classList.remove("accept", "reject");
        if (value) status.classList.add(value);
      });
    };
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-feedback]");
      if (!button) return;
      const section = button.closest("[data-design-id]");
      if (!section) return;
      const state = readFeedback();
      state[section.getAttribute("data-design-id")] = button.getAttribute("data-feedback");
      writeFeedback(state);
      applyFeedback();
    });
    applyFeedback();
  </script>
</body>
</html>
`;
}

function sectionId(diagram: MermaidDiagram): string {
  return `${diagram.specId}-${diagram.scopeId}`.replace(/[^A-Za-z0-9_-]/g, "-");
}

function buildDiagrams(root: string, specPath: string, scopeArg: string | undefined): MermaidDiagram[] {
  const spec = loadSpec(specPath);
  const build = buildTemplateSystemState(spec);
  if (build.issues.length > 0) {
    throw new Error(`Template build issues: ${build.issues.map((issue) => `${issue.kind}:${issue.detail}`).join(", ")}`);
  }

  const graphSpecs: Record<string, GraphSpec> = {};
  for (const scopeId of Object.keys(build.state.scopes ?? {}).sort()) {
    const compiled = compileFromMap(build.state, scopeId);
    const validation = validateGraphSpec(compiled.spec);
    if (compiled.warnings.length > 0 || validation.length > 0) {
      throw new Error(`GraphSpec invalid: ${scopeId}`);
    }
    graphSpecs[scopeId] = compiled.spec;
  }

  const scopeIds = scopeArg ? [scopeArg] : Object.keys(graphSpecs).sort();
  return scopeIds.map((scopeId) => {
    const graphSpec = graphSpecs[scopeId];
    if (!graphSpec) throw new Error(`Unknown scope: ${scopeId}`);
    return {
      specPath: path.relative(root, specPath).replace(/\\/g, "/"),
      specId: spec.id,
      specLabel: spec.label,
      scopeId,
      mermaid: graphSpecToMermaid(graphSpec, { title: scopeId }),
    };
  });
}

function collectTemplateUsage(root: string, specPaths: readonly string[]): TemplateUsage[] {
  const usage = new Map<string, Set<string>>();
  for (const specPath of specPaths) {
    const spec = loadSpec(specPath);
    const specName = path.basename(specPath).replace(/\.(ya?ml|json)$/i, "");
    const register = (blockId: string | undefined): void => {
      if (!blockId) return;
      const current = usage.get(blockId) ?? new Set<string>();
      current.add(specName);
      usage.set(blockId, current);
    };
    walkSpecTemplates(spec, register);
  }
  return Array.from(usage.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([blockId, usedBy]) => ({ blockId, usedBy: Array.from(usedBy).sort() }));
}

function walkSpecTemplates(scope: TemplateSystemScopeSpec & { readonly template?: string }, register: (blockId: string | undefined) => void): void {
  register(scope.template);
  for (const node of scope.nodes ?? []) {
    register(node.template);
    if (node.subsystem) {
      walkSpecTemplates(node.subsystem, register);
    }
  }
}

function main(): void {
  const root = repoRoot();
  const args = process.argv.slice(2);
  const specDirArg = argValue(args, "--spec-dir");
  const specPathArg = argValue(args, "--spec");
  const defaultSpecPath = "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml";
  const outputPath = path.resolve(root, argValue(args, "--out") ?? (specDirArg ? "tmp/template-mermaid-index.html" : "tmp/template-mermaid-latest.html"));
  const scopeArg = argValue(args, "--scope");

  const specPaths = specDirArg
    ? listTemplateSpecs(path.resolve(root, specDirArg))
    : [path.resolve(root, specPathArg ?? defaultSpecPath)];
  if (specPaths.length === 0) {
    throw new Error(`No Template System Spec files found: ${specDirArg}`);
  }

  const diagrams = specPaths.flatMap((specPath) => buildDiagrams(root, specPath, scopeArg));
  const templateUsage = collectTemplateUsage(root, specPaths);
  const sourceLabel = specDirArg
    ? `${specDirArg} (${specPaths.length} specs)`
    : path.relative(root, specPaths[0]).replace(/\\/g, "/");

  ensureDir(path.dirname(outputPath));
  if (outputPath.toLowerCase().endsWith(".mmd")) {
    fs.writeFileSync(outputPath, diagrams.map((diagram) => diagram.mermaid).join("\n"), "utf8");
  } else {
    fs.writeFileSync(outputPath, htmlPage(specDirArg ? "M3E Mermaid Preview Index" : "M3E Mermaid Preview", sourceLabel, diagrams, templateUsage), "utf8");
  }
  console.log(`Mermaid preview written to ${path.relative(root, outputPath).replace(/\\/g, "/")}`);
  console.log(`Specs: ${specPaths.map((specPath) => path.relative(root, specPath).replace(/\\/g, "/")).join(", ")}`);
  console.log(`Diagrams: ${diagrams.map((diagram) => `${diagram.specId}/${diagram.scopeId}`).join(", ")}`);
}

main();
