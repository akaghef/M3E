import fs from "fs";
import path from "path";

import { compileFromMap } from "./graph_spec_compile";
import { buildPjv34TemplateSystemState } from "./system_block_instantiator";
import { SYSTEM_BLOCK_TEMPLATES } from "../shared/system_block_templates";
import { validateGraphSpec } from "../shared/graph_spec_types";

function repoRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function main(): void {
  const root = repoRoot();
  const outputDir = path.join(root, "tmp");
  ensureDir(outputDir);

  const state = buildPjv34TemplateSystemState();
  const rootCompile = compileFromMap(state, "pjv34_system");
  const generateDocCompile = compileFromMap(state, "generate_doc");

  const result = {
    ok: true,
    generatedAt: new Date().toISOString(),
    strategy: "Template-first PJv34 Rebuild",
    templates: SYSTEM_BLOCK_TEMPLATES,
    state,
    graphSpecs: {
      root: rootCompile.spec,
      generateDoc: generateDocCompile.spec,
    },
    warnings: {
      root: rootCompile.warnings,
      generateDoc: generateDocCompile.warnings,
    },
    validation: {
      root: validateGraphSpec(rootCompile.spec),
      generateDoc: validateGraphSpec(generateDocCompile.spec),
    },
  };

  const outputPath = path.join(outputDir, "pjv34-template-system.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`PJv34 template system written to ${path.relative(root, outputPath).replace(/\\/g, "/")}`);
  console.log(`Templates: ${SYSTEM_BLOCK_TEMPLATES.map((template) => template.blockId).join(", ")}`);
  console.log(`Root warnings: ${rootCompile.warnings.length}; GenerateDoc warnings: ${generateDocCompile.warnings.length}`);
  console.log(`Root validation issues: ${result.validation.root.length}; GenerateDoc validation issues: ${result.validation.generateDoc.length}`);
}

main();
