import fs from "fs";
import path from "path";
import YAML from "js-yaml";

import { compileFromMap } from "./graph_spec_compile";
import { buildTemplateSystemState } from "./template_system_builder";
import { SYSTEM_BLOCK_TEMPLATES } from "../shared/system_block_templates";
import { validateGraphSpec } from "../shared/graph_spec_types";
import type { TemplateSystemSpec } from "../shared/template_system_spec";

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

function main(): void {
  const root = repoRoot();
  const args = process.argv.slice(2);
  const specPath = path.resolve(root, argValue(args, "--spec") ?? "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml");
  const outputPath = path.resolve(root, argValue(args, "--out") ?? "tmp/template-system-latest.json");
  ensureDir(path.dirname(outputPath));

  const spec = loadSpec(specPath);
  const build = buildTemplateSystemState(spec);
  const graphSpecs: Record<string, ReturnType<typeof compileFromMap>["spec"]> = {};
  const warnings: Record<string, ReturnType<typeof compileFromMap>["warnings"]> = {};
  const validation: Record<string, ReturnType<typeof validateGraphSpec>> = {};

  for (const scopeId of Object.keys(build.state.scopes ?? {}).sort()) {
    const compiled = compileFromMap(build.state, scopeId);
    graphSpecs[scopeId] = compiled.spec;
    warnings[scopeId] = compiled.warnings;
    validation[scopeId] = validateGraphSpec(compiled.spec);
  }

  const result = {
    ok: build.issues.length === 0 &&
      Object.values(warnings).every((items) => items.length === 0) &&
      Object.values(validation).every((items) => items.length === 0),
    generatedAt: new Date().toISOString(),
    specPath: path.relative(root, specPath).replace(/\\/g, "/"),
    templates: SYSTEM_BLOCK_TEMPLATES,
    buildIssues: build.issues,
    state: build.state,
    graphSpecs,
    warnings,
    validation,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Template system written to ${path.relative(root, outputPath).replace(/\\/g, "/")}`);
  console.log(`Scopes: ${Object.keys(graphSpecs).sort().join(", ")}`);
  console.log(`Build issues: ${build.issues.length}`);
  console.log(`Warnings: ${Object.values(warnings).reduce((sum, items) => sum + items.length, 0)}`);
  console.log(`Validation issues: ${Object.values(validation).reduce((sum, items) => sum + items.length, 0)}`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

main();
