const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const YAML = require("js-yaml");
import { describe, expect, test } from "vitest";

const { compileFromMap } = require("../../dist/node/graph_spec_compile");
const { buildTemplateSystemState } = require("../../dist/node/template_system_builder");
const { graphSpecToMermaid } = require("../../dist/shared/graph_spec_mermaid");
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

  test("renders PJv34 GraphSpec as read-only Mermaid source", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const specPath = path.join(repoRoot, "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml");
    const spec = YAML.load(fs.readFileSync(specPath, "utf8"));
    const result = buildTemplateSystemState(spec);
    const rootCompile = compileFromMap(result.state, "pjv34_system");
    const generateDocCompile = compileFromMap(result.state, "generate_doc");

    const rootMermaid = graphSpecToMermaid(rootCompile.spec);
    const generateDocMermaid = graphSpecToMermaid(generateDocCompile.spec);

    expect(rootMermaid).toContain('m3e_load_context["Load Context"]');
    expect(rootMermaid).toContain('m3e_generate_doc["Generate Doc"]');
    expect(rootMermaid).toContain("m3e_load_context -->|default| m3e_generate_doc");
    expect(generateDocMermaid).toContain('m3e_evaluate_response{"Evaluate Response"}');
    expect(generateDocMermaid).toContain("m3e_evaluate_response -->|bad_output| m3e_fallback_qn");
    expect(generateDocMermaid).toContain("m3e_retry_backoff -->|retry| m3e_call_provider");
  });

  test("template mermaid CLI writes an HTML preview", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-template-mermaid-"));
    const outPath = path.join(outDir, "preview.html");
    execFileSync(process.execPath, [
      path.join(repoRoot, "beta/dist/node/template_mermaid_cli.js"),
      "--spec",
      "projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml",
      "--out",
      outPath,
    ], {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const html = fs.readFileSync(outPath, "utf8");
    expect(html).toContain("M3E Mermaid Preview");
    expect(html).toContain("pjv34_system");
    expect(html).toContain("generate_doc");
    expect(html).toContain("m3e_evaluate_response --&gt;|bad_output| m3e_fallback_qn");
  });

  test("template run CLI resolves PJv35 callable refs without PJv34 aliases", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-template-run-pjv35-"));
    const outPath = path.join(outDir, "pjv35.md");
    execFileSync(process.execPath, [
      path.join(repoRoot, "beta/dist/node/template_run_cli.js"),
      "--spec",
      "projects/PJ04_MermaidSystemLangGraph/templates/pjv35_local_project_design_report.yaml",
      "--out",
      outPath,
    ], {
      cwd: repoRoot,
      env: { ...process.env, WEEKLY_REVIEW_PROVIDER: "mock" },
      stdio: "pipe",
    });

    const artifact = fs.readFileSync(outPath, "utf8");
    const trace = JSON.parse(fs.readFileSync(outPath.replace(/\.md$/i, ".json"), "utf8"));
    expect(artifact).toContain("# Project Design Report");
    expect(trace.trace.map((item) => item.nodeId)).toEqual([
      "load_projects",
      "build_prompt",
      "call_provider",
      "evaluate_response",
      "return_draft",
      "write_output",
    ]);
    expect(trace.prompt).toContain("Project Design Notes");
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

  test("reports unknown templates and missing required slots", () => {
    const unknownTemplate = buildTemplateSystemState({
      id: "bad_system",
      label: "Bad System",
      nodes: [
        { id: "bad_node", template: "missing.template" },
      ],
    });
    expect(unknownTemplate.issues).toContainEqual({
      kind: "unknown_template",
      detail: "bad_node: missing.template",
    });

    const missingSlot = buildTemplateSystemState({
      id: "missing_slot_system",
      label: "Missing Slot System",
      nodes: [
        {
          id: "process_without_callable",
          template: "langgraph.node.process",
          slots: {
            reads: "state.input",
            writes: "state.output",
            trace_step_id: "process_without_callable",
          },
        },
      ],
    });
    expect(missingSlot.issues).toContainEqual({
      kind: "missing_required_slot",
      detail: "process_without_callable.callable_ref",
    });
  });
});
