import fs from "fs";
import path from "path";
import YAML from "js-yaml";

import { compileFromMap } from "./graph_spec_compile";
import { buildTemplateSystemState } from "./template_system_builder";
import { graphSpecToMermaid } from "../shared/graph_spec_mermaid";
import { validateGraphSpec, type GraphSpec } from "../shared/graph_spec_types";
import type { TemplateSystemSpec } from "../shared/template_system_spec";

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

function htmlPage(specPath: string, diagrams: readonly { scopeId: string; mermaid: string }[]): string {
  const sections = diagrams.map((diagram) => `
    <section class="diagram-section">
      <h2>${escapeHtml(diagram.scopeId)}</h2>
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
  <title>M3E Mermaid Preview</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #202124; background: #f6f7f8; }
    header { padding: 16px 24px; background: #ffffff; border-bottom: 1px solid #d8dde3; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .source { color: #57606a; font-size: 13px; }
    main { padding: 20px 24px 36px; display: grid; gap: 20px; }
    .diagram-section { background: #ffffff; border: 1px solid #d8dde3; border-radius: 8px; padding: 16px; overflow: auto; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    .mermaid { min-width: 680px; }
    details { margin-top: 12px; }
    pre { overflow: auto; padding: 12px; background: #f2f4f7; border: 1px solid #d8dde3; border-radius: 6px; }
  </style>
</head>
<body>
  <header>
    <h1>M3E Mermaid Preview</h1>
    <div class="source">${escapeHtml(specPath)}</div>
  </header>
  <main>
${sections}
  </main>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, securityLevel: "strict", theme: "default" });
  </script>
</body>
</html>
`;
}

function main(): void {
  const root = repoRoot();
  const args = process.argv.slice(2);
  const specPath = path.resolve(root, argValue(args, "--spec") ?? "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml");
  const outputPath = path.resolve(root, argValue(args, "--out") ?? "tmp/template-mermaid-latest.html");
  const scopeArg = argValue(args, "--scope");

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
  const diagrams = scopeIds.map((scopeId) => {
    const graphSpec = graphSpecs[scopeId];
    if (!graphSpec) throw new Error(`Unknown scope: ${scopeId}`);
    return {
      scopeId,
      mermaid: graphSpecToMermaid(graphSpec, { title: scopeId }),
    };
  });

  ensureDir(path.dirname(outputPath));
  if (outputPath.toLowerCase().endsWith(".mmd")) {
    fs.writeFileSync(outputPath, diagrams.map((diagram) => diagram.mermaid).join("\n"), "utf8");
  } else {
    fs.writeFileSync(outputPath, htmlPage(path.relative(root, specPath).replace(/\\/g, "/"), diagrams), "utf8");
  }
  console.log(`Mermaid preview written to ${path.relative(root, outputPath).replace(/\\/g, "/")}`);
  console.log(`Scopes: ${scopeIds.join(", ")}`);
}

main();

