const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const YAML = require("js-yaml");
import { describe, expect, test } from "vitest";

const { compileFromMap } = require("../../dist/node/graph_spec_compile");
const { buildTemplateSystemState } = require("../../dist/node/template_system_builder");
const { validateGraphSpec } = require("../../dist/shared/graph_spec_types");

describe("Template System builder", () => {
  test("builds PJv34 AppState and GraphSpecs from YAML with no issues", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const specPath = path.join(repoRoot, "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml");
    const spec = YAML.load(fs.readFileSync(specPath, "utf8"));

    const result = buildTemplateSystemState(spec);
    expect(result.issues).toEqual([]);

    const rootCompile = compileFromMap(result.state, "pjv34_system");
    const generateDocCompile = compileFromMap(result.state, "generate_doc");

    expect(rootCompile.warnings).toEqual([]);
    expect(generateDocCompile.warnings).toEqual([]);
    expect(validateGraphSpec(rootCompile.spec)).toEqual([]);
    expect(validateGraphSpec(generateDocCompile.spec)).toEqual([]);
    expect(rootCompile.spec.nodes.map((node) => node.id)).toEqual([
      "load_context",
      "generate_doc",
      "write_output",
    ]);
    expect(generateDocCompile.spec.edges.find((edge) => edge.id === "cond:evaluate_response").branches).toEqual({
      pass: "return_draft",
      api_error: "retry_backoff",
      bad_output: "fallback_qn",
    });
  });

  test("template run CLI produces mock artifact and trace without secrets", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-template-run-"));
    const outPath = path.join(outDir, "run.md");
    execFileSync(process.execPath, [
      path.join(repoRoot, "beta/dist/node/template_run_cli.js"),
      "--spec",
      "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml",
      "--out",
      outPath,
    ], {
      cwd: repoRoot,
      env: { ...process.env, WEEKLY_REVIEW_PROVIDER: "mock" },
      stdio: "pipe",
    });

    const artifact = fs.readFileSync(outPath, "utf8");
    const trace = JSON.parse(fs.readFileSync(outPath.replace(/\.md$/i, ".json"), "utf8"));
    expect(artifact).toContain("# Weekly Project Review");
    expect(trace.trace.map((item) => item.nodeId)).toEqual([
      "load_context",
      "build_prompt",
      "call_provider",
      "evaluate_response",
      "return_draft",
      "write_output",
    ]);
    expect(`${artifact}\n${JSON.stringify(trace)}`).not.toMatch(/sk-|M3E_AI_API_KEY|DEEPSEEK_API_KEY/);
  });

  test("template run CLI routes provider failure to fallback_qn", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-template-run-failure-"));
    const outPath = path.join(outDir, "run.md");
    execFileSync(process.execPath, [
      path.join(repoRoot, "beta/dist/node/template_run_cli.js"),
      "--spec",
      "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml",
      "--out",
      outPath,
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        WEEKLY_REVIEW_PROVIDER: "mock",
        M3E_TEMPLATE_FORCE_PROVIDER_ERROR: "1",
      },
      stdio: "pipe",
    });

    const trace = JSON.parse(fs.readFileSync(outPath.replace(/\.md$/i, ".json"), "utf8"));
    expect(trace.trace.map((item) => item.nodeId)).toEqual([
      "load_context",
      "build_prompt",
      "call_provider",
      "evaluate_response",
      "retry_backoff",
      "call_provider",
      "evaluate_response",
      "retry_backoff",
      "fallback_qn",
      "write_output",
    ]);
    expect(trace.qn).toContain("Forced provider error");
  });
});
