const fs = require("fs");
const path = require("path");
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
});
