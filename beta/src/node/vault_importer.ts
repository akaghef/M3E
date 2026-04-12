"use strict";

import fs from "fs";
import path from "path";
import { RapidMvpModel } from "./rapid_mvp";
import { extractWikilinks, parseFrontmatter } from "./md_reader";
import type {
  AppState,
  TreeNode,
  VaultImportProgress,
  VaultImportRequest,
  VaultImportResult,
  VaultImportedFileSummary,
} from "../shared/types";

const DEFAULT_MAX_FILES = 500;
const DEFAULT_MAX_CHARS_PER_FILE = 6000;
const DEFAULT_EXCLUDED_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);

type PendingFileEntry = {
  absolutePath: string;
  relativePath: string;
  nodeId: string;
};

type ImportContext = {
  maxFiles: number;
  maxCharsPerFile: number;
  excludedPrefixes: string[];
  warnings: string[];
  pendingFiles: PendingFileEntry[];
  folderCount: number;
  fileLimitReached: boolean;
  nextId: () => string;
};

function createIdFactory(): () => string {
  let seq = 0;
  return () => {
    seq += 1;
    return `n_${Date.now()}_${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  };
}

function toPosixRelative(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).split(path.sep).join("/");
}

function buildDefaultDocumentId(vaultPath: string): string {
  const baseName = path.basename(vaultPath).trim() || "vault";
  const slug = baseName
    .normalize("NFKC")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `vault-${slug || "import"}`;
}

function resolveExcludedPrefixes(patterns: string[] | undefined): string[] {
  return (patterns ?? [])
    .map((pattern) => pattern.trim().replace(/\\/g, "/"))
    .filter(Boolean)
    .map((pattern) => pattern.replace(/\/+\*\*$/, "").replace(/\/+\*$/, "").replace(/^\.?\//, ""))
    .filter(Boolean);
}

function isExcludedRelativePath(relativePath: string, excludedPrefixes: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return excludedPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function appendChild(nodes: Record<string, TreeNode>, parentId: string, childId: string): void {
  nodes[parentId]!.children.push(childId);
}

function createFolderNode(id: string, parentId: string | null, text: string): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "folder",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
  };
}

function applyFrontmatterAttributes(node: TreeNode, frontmatter: Record<string, unknown>): void {
  const attributes: Record<string, string> = {};

  if (Array.isArray(frontmatter.tags)) {
    attributes.tags = frontmatter.tags.map(String).join(",");
  }
  if (Array.isArray(frontmatter.aliases)) {
    attributes.aliases = frontmatter.aliases.map(String).join(",");
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === "m3e" || key === "tags" || key === "aliases" || value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      attributes[key] = value.map(String).join(",");
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[key] = String(value);
    }
  }

  node.attributes = attributes;
}

async function walkVaultDirectory(
  vaultPath: string,
  absoluteDir: string,
  parentId: string,
  nodes: Record<string, TreeNode>,
  ctx: ImportContext,
): Promise<void> {
  const entries = await fs.promises.readdir(absoluteDir, { withFileTypes: true });
  const items = entries
    .filter((entry) => !entry.isSymbolicLink())
    .filter((entry) => {
      if (entry.isDirectory() && DEFAULT_EXCLUDED_DIRS.has(entry.name)) {
        return false;
      }
      const relativePath = toPosixRelative(vaultPath, path.join(absoluteDir, entry.name));
      return !isExcludedRelativePath(relativePath, ctx.excludedPrefixes);
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  for (const entry of items) {
    const absoluteChild = path.join(absoluteDir, entry.name);
    const relativeChild = toPosixRelative(vaultPath, absoluteChild);

    if (entry.isDirectory()) {
      const folderId = ctx.nextId();
      nodes[folderId] = createFolderNode(folderId, parentId, entry.name);
      ctx.folderCount += 1;
      appendChild(nodes, parentId, folderId);
      await walkVaultDirectory(vaultPath, absoluteChild, folderId, nodes, ctx);
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") {
      continue;
    }

    if (ctx.pendingFiles.length >= ctx.maxFiles) {
      if (!ctx.fileLimitReached) {
        ctx.fileLimitReached = true;
        ctx.warnings.push(`File limit exceeded. Imported first ${ctx.maxFiles} markdown files only.`);
      }
      continue;
    }

    const fileId = ctx.nextId();
    const fileNode = createFolderNode(fileId, parentId, path.basename(entry.name, ".md"));
    nodes[fileId] = fileNode;
    ctx.folderCount += 1;
    appendChild(nodes, parentId, fileId);
    ctx.pendingFiles.push({
      absolutePath: absoluteChild,
      relativePath: relativeChild,
      nodeId: fileId,
    });
  }
}

export async function importVaultToAppState(
  request: VaultImportRequest,
  hooks?: { onProgress?: (progress: VaultImportProgress) => void },
): Promise<VaultImportResult> {
  const vaultPath = path.resolve(request.vaultPath || "");
  if (!request.vaultPath || !path.isAbsolute(request.vaultPath)) {
    throw new Error("vaultPath must be an absolute path.");
  }

  const stats = await fs.promises.stat(vaultPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error("vaultPath must point to an existing directory.");
  }

  const documentId = request.documentId?.trim() || buildDefaultDocumentId(vaultPath);
  const nextId = createIdFactory();
  const rootId = nextId();
  const rootNode = createFolderNode(rootId, null, path.basename(vaultPath) || vaultPath);
  const nodes: Record<string, TreeNode> = { [rootId]: rootNode };
  const ctx: ImportContext = {
    maxFiles: Math.max(1, request.options?.maxFiles ?? DEFAULT_MAX_FILES),
    maxCharsPerFile: Math.max(1, request.options?.maxCharsPerFile ?? DEFAULT_MAX_CHARS_PER_FILE),
    excludedPrefixes: resolveExcludedPrefixes(request.options?.excludePatterns),
    warnings: [],
    pendingFiles: [],
    folderCount: 1,
    fileLimitReached: false,
    nextId,
  };

  await walkVaultDirectory(vaultPath, vaultPath, rootId, nodes, ctx);
  hooks?.onProgress?.({
    phase: "discovery",
    total: ctx.pendingFiles.length,
    message: `Found ${ctx.pendingFiles.length} markdown files.`,
  });

  const importedFiles: VaultImportedFileSummary[] = [];
  let truncatedFiles = 0;

  for (let index = 0; index < ctx.pendingFiles.length; index += 1) {
    const fileEntry = ctx.pendingFiles[index]!;
    const raw = await fs.promises.readFile(fileEntry.absolutePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);
    const wikilinks = extractWikilinks(body);
    const node = nodes[fileEntry.nodeId]!;
    const truncated = body.length > ctx.maxCharsPerFile;
    node.details = truncated ? body.slice(0, ctx.maxCharsPerFile) : body;
    applyFrontmatterAttributes(node, frontmatter as Record<string, unknown>);

    if (truncated) {
      truncatedFiles += 1;
      ctx.warnings.push(`Truncated ${fileEntry.relativePath} to ${ctx.maxCharsPerFile} characters.`);
    }

    importedFiles.push({
      relativePath: fileEntry.relativePath,
      nodeId: fileEntry.nodeId,
      wikilinkCount: wikilinks.length,
      truncated,
    });

    hooks?.onProgress?.({
      phase: "parse",
      current: index + 1,
      total: ctx.pendingFiles.length,
      currentFile: fileEntry.relativePath,
      status: "ok",
    });
  }

  const state: AppState = {
    rootId,
    nodes,
    links: {},
  };

  const model = RapidMvpModel.fromJSON(state);
  const errors = model.validate();
  if (errors.length > 0) {
    throw new Error(`Invalid imported model: ${errors.join(" | ")}`);
  }

  hooks?.onProgress?.({
    phase: "persist",
    total: ctx.pendingFiles.length,
    message: `Persisting imported vault as ${documentId}.`,
  });

  return {
    ok: true,
    documentId,
    savedAt: "",
    fileCount: ctx.pendingFiles.length,
    folderCount: ctx.folderCount,
    nodeCount: Object.keys(nodes).length,
    truncatedFiles,
    warnings: ctx.warnings,
    files: importedFiles,
    state,
  };
}

export async function importVaultToSqlite(
  dbPath: string,
  request: VaultImportRequest,
  hooks?: { onProgress?: (progress: VaultImportProgress) => void },
): Promise<VaultImportResult> {
  const result = await importVaultToAppState(request, hooks);
  const model = RapidMvpModel.fromJSON(result.state);
  model.saveToSqlite(dbPath, result.documentId);
  return {
    ...result,
    savedAt: new Date().toISOString(),
  };
}
