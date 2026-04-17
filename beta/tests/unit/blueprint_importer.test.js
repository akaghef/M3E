import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { importBlueprintToAppState, importBlueprintToSqlite } = require("../../dist/node/blueprint_importer.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-blueprint-import-"));
}

function writeFile(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
  return absolutePath;
}

function cleanup(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function findNodeByAttr(state, key, value) {
  return Object.values(state.nodes).find((node) => node.attributes?.[key] === value);
}

test("importBlueprintToAppState parses chapter files into statements and graph links", async () => {
  const blueprintDir = tmpDir();
  try {
    writeFile(blueprintDir, "web.tex", `\\documentclass{report}
\\title{Mini Project}
\\begin{document}
\\input{chapter/main}
\\end{document}
`);
    writeFile(blueprintDir, "chapter/main.tex", `\\input{chapter/alpha}
\\input{chapter/beta}
`);
    writeFile(blueprintDir, "chapter/alpha.tex", `\\chapter{Alpha chapter}

\\begin{definition}[Entropy]
  \\label{entropy-def}
  \\lean{ProbabilityTheory.entropy}
  \\leanok
  Entropy body.
\\end{definition}

\\begin{lemma}[Relabeling]
  \\label{relabeled-entropy}
  \\label{entropy-relabel-alt}
  \\uses{entropy-def}
  \\lean{ProbabilityTheory.entropy_comp}
  \\leanok
  Relabeling body.
\\end{lemma}

\\begin{proof}
  \\uses{concave}
  \\leanok
  Proof body.
\\end{proof}

\\begin{theorem}[Auto Labeled]
  No explicit label here.
\\end{theorem}
`);
    writeFile(blueprintDir, "chapter/beta.tex", `\\chapter{Beta chapter}

\\begin{corollary}[Imported]
  \\label{beta-result}
  \\uses{entropy-relabel-alt}
  Imported body.
\\end{corollary}
`);

    const result = await importBlueprintToAppState({
      blueprintPath: blueprintDir,
    });

    expect(result.ok).toBe(true);
    expect(result.mapId).toBe("blueprint-" + path.basename(blueprintDir).toLowerCase());
    expect(result.chapterCount).toBe(2);
    expect(result.statementCount).toBe(4);
    expect(result.nodeCount).toBe(7);
    expect(result.linkCount).toBe(2);
    expect(result.warnings.some((warning) => warning.includes("generated alpha-auto-3"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("Skipping missing dependency concave"))).toBe(true);

    const model = RapidMvpModel.fromJSON(result.state);
    expect(model.validate()).toEqual([]);

    const root = result.state.nodes[result.state.rootId];
    expect(root.text).toBe("Mini Project Blueprint");

    const definitionNode = findNodeByAttr(result.state, "blueprint_label", "entropy-def");
    expect(definitionNode).toBeTruthy();
    expect(definitionNode.attributes.kind).toBe("definition");
    expect(definitionNode.attributes.lean4_decl).toBe("ProbabilityTheory.entropy");
    expect(definitionNode.details).toContain("Entropy body.");

    const lemmaNode = findNodeByAttr(result.state, "blueprint_label", "relabeled-entropy");
    expect(lemmaNode).toBeTruthy();
    expect(lemmaNode.attributes.blueprint_labels).toContain("entropy-relabel-alt");

    const autoNode = Object.values(result.state.nodes).find((node) => node.text === "Theorem: Auto Labeled");
    expect(autoNode).toBeTruthy();
    expect(autoNode.attributes.blueprint_label).toMatch(/^alpha-auto-/);

    const usesLinks = Object.values(result.state.links).filter((link) => link.relationType === "uses");
    expect(usesLinks).toHaveLength(2);
    expect(usesLinks.some((link) => link.sourceNodeId === definitionNode.id && link.targetNodeId === lemmaNode.id)).toBe(true);
    expect(usesLinks.some((link) => link.sourceNodeId === lemmaNode.id)).toBe(true);
  } finally {
    cleanup(blueprintDir);
  }
});

test("importBlueprintToAppState supports DAG layout with source grouping anchors", async () => {
  const blueprintDir = tmpDir();
  try {
    writeFile(blueprintDir, "web.tex", `\\documentclass{report}
\\title{DAG Project}
`);
    writeFile(blueprintDir, "chapter/main.tex", `\\input{chapter/core}
`);
    writeFile(blueprintDir, "chapter/core.tex", `\\chapter{Core}

\\begin{definition}[Seed]
  \\label{seed}
  Seed body.
\\end{definition}

\\begin{definition}[Aux]
  \\label{aux}
  Aux body.
\\end{definition}

\\begin{lemma}[Growth]
  \\label{growth}
  \\uses{seed, aux}
  Growth body.
\\end{lemma}

\\begin{theorem}[Harvest]
  \\label{harvest}
  \\uses{growth}
  Harvest body.
\\end{theorem}
`);

    const result = await importBlueprintToAppState({
      blueprintPath: blueprintDir,
      options: {
        layoutMode: "dag",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.chapterCount).toBe(1);
    expect(result.statementCount).toBe(4);
    expect(result.nodeCount).toBe(6);
    expect(result.linkCount).toBe(1);

    const model = RapidMvpModel.fromJSON(result.state);
    expect(model.validate()).toEqual([]);

    const root = result.state.nodes[result.state.rootId];
    expect(root.attributes["blueprint:layout"]).toBe("dag");
    const sourceGroup = Object.values(result.state.nodes).find((node) => node.attributes?.["blueprint:kind"] === "chapter-source-group");
    expect(sourceGroup).toBeTruthy();
    expect(sourceGroup.parentId).toBe(result.state.rootId);

    const seedNode = findNodeByAttr(result.state, "blueprint_label", "seed");
    const auxNode = findNodeByAttr(result.state, "blueprint_label", "aux");
    const growthNode = findNodeByAttr(result.state, "blueprint_label", "growth");
    const harvestNode = findNodeByAttr(result.state, "blueprint_label", "harvest");

    expect(seedNode.parentId).toBe(sourceGroup.id);
    expect(auxNode.parentId).toBe(sourceGroup.id);
    expect(growthNode.parentId).toBe(seedNode.id);
    expect(harvestNode.parentId).toBe(growthNode.id);
    expect(growthNode.attributes["dag:layer"]).toBe("1");
    expect(harvestNode.attributes["dag:layer"]).toBe("2");
    expect(seedNode.attributes["dag:source-group"]).toBe(sourceGroup.id);

    const usesLinks = Object.values(result.state.links).filter((link) => link.relationType === "uses");
    expect(usesLinks).toHaveLength(1);
    expect(usesLinks[0].sourceNodeId).toBe(auxNode.id);
    expect(usesLinks[0].targetNodeId).toBe(growthNode.id);
  } finally {
    cleanup(blueprintDir);
  }
});

test("importBlueprintToSqlite persists imported blueprint map", async () => {
  const blueprintDir = tmpDir();
  const dataDir = tmpDir();
  const dbPath = path.join(dataDir, "blueprint-test.sqlite");
  try {
    writeFile(blueprintDir, "web.tex", `\\documentclass{report}
\\title{Proof Demo}
`);
    writeFile(blueprintDir, "chapter/main.tex", `\\input{chapter/only}
`);
    writeFile(blueprintDir, "chapter/only.tex", `\\chapter{Only}
\\begin{lemma}[Demo]\\label{demo}\\uses{missing-ref} Demo body.\\end{lemma}
`);

    const result = await importBlueprintToSqlite(dbPath, {
      blueprintPath: blueprintDir,
      mapId: "blueprint-test-map",
    });

    expect(result.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const loaded = RapidMvpModel.loadFromSqlite(dbPath, "blueprint-test-map");
    expect(loaded.validate()).toEqual([]);
    expect(loaded.state.nodes[loaded.state.rootId].text).toBe("Proof Demo Blueprint");
  } finally {
    cleanup(blueprintDir);
    cleanup(dataDir);
  }
});
