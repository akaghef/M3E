"use strict";

import fs from "fs";
import path from "path";
import { runLinearTransform } from "./linear_agent";
import { buildSubtreeOutline } from "./indented_text_parser";
import { RapidMvpModel } from "./rapid_mvp";
import { validateVaultPath } from "./vault_path";
import type {
  AppState,
  TreeNode,
  VaultExportProgress,
  VaultExportRequest,
  VaultExportResult,
} from "../shared/types";

const DEFAULT_EXPORT_INSTRUCTION = [
  "You are converting an M3E tree structure back into Obsidian-compatible Markdown.",
  "Top-level items become headings and nested items become subheadings or bullets.",
  "Use details as paragraphs under the nearest node.",
  "Return valid Markdown only.",
].join(" ");

type ExportFolderEntry = {
  nodeId: string;
  relativePath: string;
};

type ExportFileEntry = {
  nodeId: string;
  relativePath: string;
};

function sanitizeSegment(text: string): string {
  const sanitized = text
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "untitled";
}

function isVaultFolder(node: TreeNode | undefined): boolean {
  return Boolean(node && node.nodeType === "folder" && node.attributes["vault:kind"] === "folder");
}

function isVaultFile(node: TreeNode | undefined): boolean {
  return Boolean(node && node.nodeType === "folder" && node.attributes["vault:kind"] === "file");
}

function buildExportPlan(
  state: AppState,
  rootNodeId: string,
): { folders: ExportFolderEntry[]; files: ExportFileEntry[] } {
  const folders: ExportFolderEntry[] = [];
  const files: ExportFileEntry[] = [];

  function visit(nodeId: string, relativeDir: string): void {
    const node = state.nodes[nodeId];
    if (!node) {
      return;
    }

    const children = node.children.map((childId) => state.nodes[childId]).filter(Boolean) as TreeNode[];
    for (const child of children) {
      if (isVaultFolder(child)) {
        const childRelative = relativeDir ? `${relativeDir}/${sanitizeSegment(child.text)}` : sanitizeSegment(child.text);
        folders.push({ nodeId: child.id, relativePath: childRelative });
        visit(child.id, childRelative);
        continue;
      }
      if (isVaultFile(child)) {
        const childRelative = relativeDir
          ? `${relativeDir}/${sanitizeSegment(child.text)}.md`
          : `${sanitizeSegment(child.text)}.md`;
        files.push({ nodeId: child.id, relativePath: childRelative });
      }
    }
  }

  visit(rootNodeId, "");
  return { folders, files };
}

function attributeFrontmatter(node: TreeNode): string {
  const lines: string[] = [];
  const attrs = node.attributes || {};
  const keys = Object.keys(attrs).sort();
  for (const key of keys) {
    if (key.startsWith("vault:") || key.startsWith("m3e:")) {
      continue;
    }
    const value = attrs[key];
    if (!value) {
      continue;
    }
    if (key === "tags" || key === "aliases") {
      const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length > 0) {
        lines.push(`${key}:`);
        parts.forEach((part) => lines.push(`  - ${part}`));
      }
      continue;
    }
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }

  if (lines.length === 0) {
    return "";
  }
  return ["---", ...lines, "---", ""].join("\n");
}

function collectAliasWikilinks(state: AppState, node: TreeNode, exportPlan: { files: ExportFileEntry[] }): string[] {
  const lines: string[] = [];
  for (const childId of node.children) {
    const child = state.nodes[childId];
    if (!child || child.nodeType !== "alias") {
      continue;
    }
    const target = exportPlan.files.find((entry) => entry.nodeId === child.targetNodeId);
    const label = child.aliasLabel?.trim();
    const targetLabel = target
      ? target.relativePath.replace(/\.md$/i, "")
      : (child.targetSnapshotLabel || child.text.replace(/\s+\(missing\)$/, ""));
    if (child.isBroken) {
      lines.push(`- <!-- broken link: ${targetLabel} -->`);
      continue;
    }
    const prefix = child.collapsed ? "" : "!";
    lines.push(`- ${prefix}[[${targetLabel}${label ? `|${label}` : ""}]]`);
  }
  return lines;
}

async function renderFileBody(
  state: AppState,
  node: TreeNode,
  request: VaultExportRequest,
): Promise<string> {
  const outline = buildSubtreeOutline(state, node.id);
  const hasContentChildren = node.children.some((childId) => {
    const child = state.nodes[childId];
    return child && child.nodeType !== "alias";
  });

  if (hasContentChildren && !request.options?.skipAiTransform && outline.trim()) {
    try {
      const transformed = await runLinearTransform({
        direction: "tree-to-linear",
        sourceText: outline,
        scopeRootId: node.id,
        scopeLabel: node.text,
        instruction: DEFAULT_EXPORT_INSTRUCTION,
        modelAlias: request.modelAlias ?? null,
      });
      return transformed.outputText.trim();
    } catch {
      return outline;
    }
  }

  if (hasContentChildren && outline.trim()) {
    return outline;
  }
  if (node.details.trim()) {
    return node.details.trim();
  }
  return `# ${node.text}`;
}

export async function exportVaultFromAppState(
  state: AppState,
  request: VaultExportRequest,
  hooks?: { onProgress?: (progress: VaultExportProgress) => void },
): Promise<VaultExportResult> {
  const outputRoot = validateVaultPath(request.vaultPath, { mustExist: false, allowCreate: true });

  const exportRootId = request.nodeId || state.rootId;
  const exportRoot = state.nodes[exportRootId];
  if (!exportRoot) {
    throw new Error(`Export root not found: ${exportRootId}`);
  }

  const exportPlan = buildExportPlan(state, exportRootId);
  hooks?.onProgress?.({
    phase: "analysis",
    total: exportPlan.files.length,
    message: `Planned ${exportPlan.files.length} markdown files.`,
  });

  await fs.promises.mkdir(outputRoot, { recursive: true });

  for (const folder of exportPlan.folders) {
    await fs.promises.mkdir(path.join(outputRoot, folder.relativePath), { recursive: true });
  }

  const warnings: string[] = [];
  for (let index = 0; index < exportPlan.files.length; index += 1) {
    const file = exportPlan.files[index]!;
    const node = state.nodes[file.nodeId]!;
    hooks?.onProgress?.({
      phase: "transform",
      current: index + 1,
      total: exportPlan.files.length,
      currentFile: file.relativePath,
      status: "ok",
    });

    const body = await renderFileBody(state, node, request);
    const wikilinks = collectAliasWikilinks(state, node, exportPlan);
    const frontmatter = attributeFrontmatter(node);
    const parts: string[] = [];
    if (frontmatter) {
      parts.push(frontmatter.trimEnd());
      parts.push("");
    }
    parts.push(body.trim());
    if (wikilinks.length > 0) {
      parts.push("");
      parts.push("---");
      parts.push("");
      parts.push("## Related");
      parts.push("");
      parts.push(...wikilinks);
    }
    const targetPath = path.join(outputRoot, file.relativePath);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    if (request.options?.overwrite === false && fs.existsSync(targetPath)) {
      warnings.push(`Skipped existing file: ${file.relativePath}`);
      continue;
    }
    await fs.promises.writeFile(targetPath, `${parts.join("\n").trim()}\n`, "utf8");
    hooks?.onProgress?.({
      phase: "write",
      current: index + 1,
      total: exportPlan.files.length,
      currentFile: file.relativePath,
      status: "ok",
    });
  }

  return {
    ok: true,
    documentId: request.documentId,
    vaultPath: outputRoot,
    fileCount: exportPlan.files.length,
    folderCount: exportPlan.folders.length,
    warnings,
    savedAt: new Date().toISOString(),
  };
}

export async function exportVaultFromSqlite(
  dbPath: string,
  request: VaultExportRequest,
  hooks?: { onProgress?: (progress: VaultExportProgress) => void },
): Promise<VaultExportResult> {
  const model = RapidMvpModel.loadFromSqlite(dbPath, request.documentId);
  return exportVaultFromAppState(model.toJSON(), request, hooks);
}
