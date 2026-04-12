import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { importVaultToSqlite } = require("../../dist/node/vault_importer.js");
const { exportVaultFromSqlite } = require("../../dist/node/vault_exporter.js");

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-vault-export-"));
}

function writeFile(rootDir, relativePath, content) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

test("exportVaultFromSqlite writes markdown files and preserves wikilinks", async () => {
  const sourceVault = tmpDir();
  const dataDir = tmpDir();
  const outVault = tmpDir();
  try {
    writeFile(sourceVault, "index.md", "# Index\n\nBody with [[notes/child]].");
    writeFile(sourceVault, "notes/child.md", "# Child\n\nChild body.");

    const dbPath = path.join(dataDir, "export.sqlite");
    await importVaultToSqlite(dbPath, {
      vaultPath: sourceVault,
      documentId: "vault-export-doc",
      options: { skipAiTransform: true },
    });

    const result = await exportVaultFromSqlite(dbPath, {
      documentId: "vault-export-doc",
      vaultPath: outVault,
      options: { skipAiTransform: true },
    });

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(outVault, "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(outVault, "notes", "child.md"))).toBe(true);
    const exported = fs.readFileSync(path.join(outVault, "index.md"), "utf8");
    expect(exported).toContain("Body with [[notes/child]].");
    expect(exported).toContain("[[notes/child]]");
  } finally {
    fs.rmSync(sourceVault, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(outVault, { recursive: true, force: true });
  }
});
