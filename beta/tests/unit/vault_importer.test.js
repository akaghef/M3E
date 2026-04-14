import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { importVaultToAppState, importVaultToSqlite } = require("../../dist/node/vault_importer.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-vault-import-"));
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

function findNodeByText(state, text) {
  return Object.values(state.nodes).find((node) => node.text === text);
}

test("importVaultToAppState builds folder/file skeleton and maps frontmatter metadata", async () => {
  const vaultDir = tmpDir();
  try {
    writeFile(vaultDir, "index.md", `---
tags:
  - home
aliases:
  - Start
status: draft
---

# Welcome

This is the index note with [[research/note-a]].
`);
    writeFile(vaultDir, "research/note-a.md", `---
tags:
  - research
---

Line 1
Line 2
`);
    writeFile(vaultDir, ".obsidian/ignore.md", "# Ignore me");
    writeFile(vaultDir, "assets/image.png", "binary");

    const result = await importVaultToAppState({
      vaultPath: vaultDir,
      options: { skipAiTransform: true },
    });

    expect(result.ok).toBe(true);
    expect(result.documentId).toMatch(/^vault-/);
    expect(result.fileCount).toBe(2);
    expect(result.folderCount).toBe(5);
    expect(result.nodeCount).toBe(6);

    const model = RapidMvpModel.fromJSON(result.state);
    expect(model.validate()).toEqual([]);

    const root = result.state.nodes[result.state.rootId];
    expect(root.text).toBe(path.basename(vaultDir));
    expect(root.children.length).toBe(3);

    const researchFolder = findNodeByText(result.state, "research");
    expect(researchFolder).toBeTruthy();
    expect(researchFolder.nodeType).toBe("folder");

    const indexNode = findNodeByText(result.state, "index");
    expect(indexNode).toBeTruthy();
    expect(indexNode.nodeType).toBe("folder");
    expect(indexNode.attributes.tags).toBe("home");
    expect(indexNode.attributes.aliases).toBe("Start");
    expect(indexNode.attributes.status).toBe("draft");
    expect(indexNode.details).toContain("# Welcome");
    expect(Object.values(result.state.nodes).some((node) => node.nodeType === "alias")).toBe(true);

    const nestedFile = result.files.find((file) => file.relativePath === "research/note-a.md");
    expect(nestedFile).toBeTruthy();
    expect(nestedFile.wikilinkCount).toBe(0);
  } finally {
    cleanup(vaultDir);
  }
});

test("importVaultToAppState applies maxFiles and maxCharsPerFile limits", async () => {
  const vaultDir = tmpDir();
  try {
    writeFile(vaultDir, "a.md", "A".repeat(50));
    writeFile(vaultDir, "b.md", "B".repeat(50));

    const result = await importVaultToAppState({
      vaultPath: vaultDir,
      options: {
        maxFiles: 1,
        maxCharsPerFile: 10,
        skipAiTransform: true,
      },
    });

    expect(result.fileCount).toBe(1);
    expect(result.truncatedFiles).toBe(1);
    expect(result.warnings.some((warning) => warning.includes("File limit exceeded"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("Truncated"))).toBe(true);
    const importedNode = result.state.nodes[result.files[0].nodeId];
    expect(importedNode.details.length).toBe(10);
  } finally {
    cleanup(vaultDir);
  }
});

test("importVaultToSqlite persists imported document", async () => {
  const vaultDir = tmpDir();
  const dataDir = tmpDir();
  const dbPath = path.join(dataDir, "vault-test.sqlite");
  try {
    writeFile(vaultDir, "alpha.md", "# Alpha");
    const result = await importVaultToSqlite(dbPath, {
      vaultPath: vaultDir,
      documentId: "vault-test-doc",
      options: { skipAiTransform: true },
    });

    expect(result.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const loaded = RapidMvpModel.loadFromSqlite(dbPath, "vault-test-doc");
    expect(loaded.validate()).toEqual([]);
    expect(loaded.state.nodes[loaded.state.rootId].text).toBe(path.basename(vaultDir));
  } finally {
    cleanup(vaultDir);
    cleanup(dataDir);
  }
});

test("importVaultToAppState rejects relative vault paths", async () => {
  await expect(importVaultToAppState({ vaultPath: "relative/path" })).rejects.toThrow(/absolute path/);
});

test("importVaultToAppState rejects protected system directories", async () => {
  const protectedPath = process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32")
    : "/etc";
  await expect(importVaultToAppState({ vaultPath: protectedPath })).rejects.toThrow(/protected system directory/);
});
