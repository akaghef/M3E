import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { importVaultToSqlite } = require("../../dist/node/vault_importer.js");
const { exportVaultFromSqlite } = require("../../dist/node/vault_exporter.js");
const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

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
      mapId: "vault-export-map",
      options: { skipAiTransform: true },
    });

    const result = await exportVaultFromSqlite(dbPath, {
      mapId: "vault-export-map",
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

test("exportVaultFromSqlite writes frontmatter and related links with labels, embeds, and broken targets", async () => {
  const sourceVault = tmpDir();
  const dataDir = tmpDir();
  const outVault = tmpDir();
  try {
    writeFile(sourceVault, "daily.md", `---
tags:
  - inbox
aliases:
  - Daily Note
status: draft
---

Entry body.
Exact [[refs/exact-note|Exact Label]].
Embed ![[media/clip|Preview]].
Missing [[ghost]].
`);
    writeFile(sourceVault, "refs/exact-note.md", "# Exact");
    writeFile(sourceVault, "media/clip.md", "# Clip");

    const dbPath = path.join(dataDir, "export-fidelity.sqlite");
    await importVaultToSqlite(dbPath, {
      vaultPath: sourceVault,
      mapId: "vault-export-fidelity-map",
      options: { skipAiTransform: true },
    });

    const result = await exportVaultFromSqlite(dbPath, {
      mapId: "vault-export-fidelity-map",
      vaultPath: outVault,
      options: { skipAiTransform: true },
    });

    expect(result.ok).toBe(true);
    const exported = fs.readFileSync(path.join(outVault, "daily.md"), "utf8");
    expect(exported).toContain("---");
    expect(exported).toContain("aliases:\n  - Daily Note");
    expect(exported).toContain("status: \"draft\"");
    expect(exported).toContain("tags:\n  - inbox");
    expect(exported).toContain("Entry body.");
    expect(exported).toContain("## Related");
    expect(exported).toContain("- [[refs/exact-note|Exact Label]]");
    expect(exported).toContain("- ![[media/clip|Preview]]");
    expect(exported).toContain("- <!-- broken link: ghost -->");
  } finally {
    fs.rmSync(sourceVault, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(outVault, { recursive: true, force: true });
  }
});

test("vault export/import round-trip preserves node identities, body, text, and portable attributes", async () => {
  const sourceVault = tmpDir();
  const dataDir = tmpDir();
  const outVault = tmpDir();
  try {
    writeFile(sourceVault, "notes/alpha.md", "# Alpha\n\nOriginal body.\n");
    const dbPath = path.join(dataDir, "identity-roundtrip.sqlite");
    const mapId = "vault-identity-roundtrip";
    await importVaultToSqlite(dbPath, {
      vaultPath: sourceVault,
      mapId,
      options: { skipAiTransform: true },
    });

    const beforeModel = RapidMvpModel.loadFromSqlite(dbPath, mapId);
    const beforeNode = Object.values(beforeModel.state.nodes).find((node) => node.attributes["vault:path"] === "notes/alpha.md");
    expect(beforeNode).toBeTruthy();
    beforeNode.attributes.tags = "roundtrip,identity";
    beforeNode.attributes["m3e:provenance"] = "human-authored";
    beforeNode.attributes["m3e:role.icon"] = "orbit";
    beforeNode.attributes["m3e:actor.state"] = "active";
    beforeNode.attributes["m3e:component"] = "private-runtime";
    beforeModel.saveToSqlite(dbPath, mapId);
    const beforeState = beforeModel.toJSON();

    await exportVaultFromSqlite(dbPath, {
      mapId,
      vaultPath: outVault,
      options: { skipAiTransform: true },
    });
    const exportedPath = path.join(outVault, "notes", "alpha.md");
    const exported = fs.readFileSync(exportedPath, "utf8");
    expect(exported).toContain(`m3e:\n  nodeId: "${beforeNode.id}"`);
    expect(exported).toContain('"m3e:provenance": "human-authored"');
    expect(exported).toContain('"m3e:role.icon": "orbit"');
    expect(exported).toContain('"m3e:actor.state": "active"');
    expect(exported).not.toContain("m3e:component");
    expect(exported).not.toContain("vault:kind");

    const firstImport = await importVaultToSqlite(dbPath, {
      vaultPath: outVault,
      mapId,
      options: { skipAiTransform: true },
    });
    const secondImport = await importVaultToSqlite(dbPath, {
      vaultPath: outVault,
      mapId,
      options: { skipAiTransform: true },
    });

    expect(Object.keys(firstImport.state.nodes).sort()).toEqual(Object.keys(beforeState.nodes).sort());
    expect(Object.keys(secondImport.state.nodes).sort()).toEqual(Object.keys(beforeState.nodes).sort());
    expect(secondImport.nodeCount).toBe(firstImport.nodeCount);
    const roundTripped = secondImport.state.nodes[beforeNode.id];
    expect(roundTripped.text).toBe(beforeNode.text);
    expect(roundTripped.details).toBe(beforeNode.details);
    expect(roundTripped.attributes.tags).toBe("roundtrip,identity");
    expect(roundTripped.attributes["m3e:provenance"]).toBe("human-authored");
    expect(roundTripped.attributes["m3e:role.icon"]).toBe("orbit");
    expect(roundTripped.attributes["m3e:actor.state"]).toBe("active");
    expect(roundTripped.attributes["m3e:component"]).toBeUndefined();
  } finally {
    fs.rmSync(sourceVault, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(outVault, { recursive: true, force: true });
  }
});

test("vault export/import normalizes one file terminator and stays byte-stable across two round-trips", async () => {
  const sourceVault = tmpDir();
  const dataDir = tmpDir();
  const outVault = tmpDir();
  try {
    writeFile(sourceVault, "without-newline.md", "Body without newline.");
    writeFile(sourceVault, "with-newline.md", "Body with newline.\n");
    const dbPath = path.join(dataDir, "newline-roundtrip.sqlite");
    const mapId = "vault-newline-roundtrip";
    await importVaultToSqlite(dbPath, {
      vaultPath: sourceVault,
      mapId,
      options: { skipAiTransform: true },
    });

    const before = RapidMvpModel.loadFromSqlite(dbPath, mapId).toJSON();
    const beforeNodes = Object.values(before.nodes).filter((node) => node.attributes["vault:kind"] === "file");
    expect(beforeNodes.map((node) => node.details).sort()).toEqual([
      "Body with newline.",
      "Body without newline.",
    ]);

    await exportVaultFromSqlite(dbPath, {
      mapId,
      vaultPath: outVault,
      options: { skipAiTransform: true },
    });
    const firstExport = new Map(
      beforeNodes.map((node) => {
        const content = fs.readFileSync(path.join(outVault, node.attributes["vault:path"]), "utf8");
        expect(content.endsWith("\n")).toBe(true);
        expect(content.endsWith("\n\n")).toBe(false);
        return [node.attributes["vault:path"], content];
      }),
    );

    const imported = await importVaultToSqlite(dbPath, {
      vaultPath: outVault,
      mapId,
      options: { skipAiTransform: true },
    });
    expect(Object.keys(imported.state.nodes).sort()).toEqual(Object.keys(before.nodes).sort());
    for (const beforeNode of beforeNodes) {
      expect(imported.state.nodes[beforeNode.id].details).toBe(beforeNode.details);
    }

    await exportVaultFromSqlite(dbPath, {
      mapId,
      vaultPath: outVault,
      options: { skipAiTransform: true },
    });
    for (const [relativePath, firstContent] of firstExport) {
      expect(fs.readFileSync(path.join(outVault, relativePath), "utf8")).toBe(firstContent);
    }
  } finally {
    fs.rmSync(sourceVault, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(outVault, { recursive: true, force: true });
  }
});

test("editing an exported body updates only that node while preserving its identity and attributes", async () => {
  const sourceVault = tmpDir();
  const dataDir = tmpDir();
  const outVault = tmpDir();
  try {
    writeFile(sourceVault, "alpha.md", "Alpha original body.");
    writeFile(sourceVault, "beta.md", "Beta original body.");
    const dbPath = path.join(dataDir, "body-edit.sqlite");
    const mapId = "vault-body-edit";
    await importVaultToSqlite(dbPath, { vaultPath: sourceVault, mapId, options: { skipAiTransform: true } });
    const before = RapidMvpModel.loadFromSqlite(dbPath, mapId).toJSON();
    const alpha = Object.values(before.nodes).find((node) => node.attributes["vault:path"] === "alpha.md");
    const beta = Object.values(before.nodes).find((node) => node.attributes["vault:path"] === "beta.md");
    alpha.attributes.tags = "keep-me";
    RapidMvpModel.fromJSON(before).saveToSqlite(dbPath, mapId);

    await exportVaultFromSqlite(dbPath, { mapId, vaultPath: outVault, options: { skipAiTransform: true } });
    const alphaPath = path.join(outVault, "alpha.md");
    const exported = fs.readFileSync(alphaPath, "utf8");
    const closingFrontmatter = exported.indexOf("\n---\n\n");
    expect(closingFrontmatter).toBeGreaterThan(0);
    const editedBody = "Human-edited body.\n\nSecond paragraph.";
    fs.writeFileSync(alphaPath, `${exported.slice(0, closingFrontmatter + 6)}${editedBody}`, "utf8");

    const result = await importVaultToSqlite(dbPath, { vaultPath: outVault, mapId, options: { skipAiTransform: true } });
    expect(result.state.nodes[alpha.id].details).toBe(editedBody);
    expect(result.state.nodes[alpha.id].text).toBe(alpha.text);
    expect(result.state.nodes[alpha.id].attributes.tags).toBe("keep-me");
    expect(result.state.nodes[beta.id].details).toBe(beta.details);
  } finally {
    fs.rmSync(sourceVault, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(outVault, { recursive: true, force: true });
  }
});

test("an unknown frontmatter nodeId fails closed without overwriting the target map", async () => {
  const vaultDir = tmpDir();
  const dataDir = tmpDir();
  try {
    writeFile(vaultDir, "alpha.md", "Alpha body.");
    const dbPath = path.join(dataDir, "unknown-id.sqlite");
    const mapId = "vault-unknown-id";
    await importVaultToSqlite(dbPath, { vaultPath: vaultDir, mapId, options: { skipAiTransform: true } });
    const before = RapidMvpModel.loadFromSqlite(dbPath, mapId).toJSON();
    writeFile(vaultDir, "alpha.md", "---\nm3e:\n  nodeId: foreign-map-node\n---\n\nForeign body.");

    await expect(importVaultToSqlite(dbPath, {
      vaultPath: vaultDir,
      mapId,
      options: { skipAiTransform: true },
    })).rejects.toThrow(/does not exist in target map/);
    expect(RapidMvpModel.loadFromSqlite(dbPath, mapId).toJSON()).toEqual(before);
  } finally {
    fs.rmSync(vaultDir, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
