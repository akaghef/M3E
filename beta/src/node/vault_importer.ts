"use strict";

import fs from "fs";
import path from "path";
import { runLinearTransform } from "./linear_agent";
import { parseIndentedTextToNodes } from "./indented_text_parser";
import { RapidMvpModel } from "./rapid_mvp";
import { extractWikilinks, parseFrontmatter, type WikilinkRef } from "./md_reader";
import { validateVaultPath } from "./vault_path";
import type {
  AppState,
  TreeNode,
  VaultImportProgress,
  VaultImportRequest,
  VaultImportResult,
  VaultImportedFileSummary,
} from "../shared/types";

const DEFAULT_MAX_FILES = 1000;
const DEFAULT_MAX_CHARS_PER_FILE = 6000;
const DEFAULT_EXCLUDED_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);
const DEFAULT_IMPORT_INSTRUCTION = [
  "You are converting an Obsidian markdown note into an M3E tree structure.",
  "Return an indented outline where each line is a node.",
  "Top-level headings become parent nodes.",
  "Bullets and paragraphs become child nodes.",
  "Keep node text concise and use details: for longer explanations.",
  "Format as plain text, 2 spaces per indentation level.",
].join(" ");

type PendingFileEntry = {
  absolutePath: string;
  relativePath: string;
  relativeTargetPath: string;
  baseName: string;
  nodeId: string;
  wikilinks: WikilinkRef[];
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

function createFolderNode(id: string, parentId: string | null, text: string, kind: "folder" | "file", relativePath: string): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "folder",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {
      "vault:kind": kind,
      "vault:path": relativePath,
    },
    link: "",
  };
}

function applyFrontmatterAttributes(node: TreeNode, frontmatter: Record<string, unknown>): void {
  const attributes: Record<string, string> = { ...node.attributes };

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
      nodes[folderId] = createFolderNode(folderId, parentId, entry.name, "folder", relativeChild);
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
    const relativeTargetPath = relativeChild.replace(/\.md$/i, "");
    const fileNode = createFolderNode(fileId, parentId, path.basename(entry.name, ".md"), "file", relativeChild);
    nodes[fileId] = fileNode;
    ctx.folderCount += 1;
    appendChild(nodes, parentId, fileId);
    ctx.pendingFiles.push({
      absolutePath: absoluteChild,
      relativePath: relativeChild,
      relativeTargetPath,
      baseName: path.basename(relativeTargetPath),
      nodeId: fileId,
      wikilinks: [],
    });
  }
}

function mergeChildren(nodes: Record<string, TreeNode>, parentId: string, children: TreeNode[]): void {
  const parent = nodes[parentId]!;
  children.forEach((child) => {
    nodes[child.id] = child;
    parent.children.push(child.id);
  });
}

function normalizeWikilinkTarget(target: string): string {
  return target
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .replace(/#.*$/, "")
    .trim();
}

function createAliasNode(
  nextId: () => string,
  sourceNodeId: string,
  targetNodeId: string,
  fallbackLabel: string,
  options?: { aliasLabel?: string; embedded?: boolean; broken?: boolean },
): TreeNode {
  const display = options?.aliasLabel?.trim() || fallbackLabel;
  const broken = Boolean(options?.broken);
  return {
    id: nextId(),
    parentId: sourceNodeId,
    children: [],
    nodeType: "alias",
    text: broken ? `${display} (missing)` : display,
    collapsed: !options?.embedded,
    details: "",
    note: "",
    attributes: {},
    link: "",
    targetNodeId,
    aliasLabel: options?.aliasLabel?.trim() || undefined,
    access: "read",
    targetSnapshotLabel: broken ? display : undefined,
    isBroken: broken,
  };
}

async function maybeTransformFileBody(
  request: VaultImportRequest,
  fileEntry: PendingFileEntry,
  body: string,
  nodes: Record<string, TreeNode>,
  ctx: ImportContext,
  hooks?: { onProgress?: (progress: VaultImportProgress) => void },
): Promise<void> {
  if (request.options?.skipAiTransform || !body.trim()) {
    return;
  }

  hooks?.onProgress?.({
    phase: "transform",
    currentFile: fileEntry.relativePath,
    status: "ok",
  });

  try {
    const transformed = await runLinearTransform({
      direction: "linear-to-tree",
      sourceText: body,
      scopeRootId: fileEntry.nodeId,
      scopeLabel: fileEntry.relativePath,
      instruction: DEFAULT_IMPORT_INSTRUCTION,
      modelAlias: request.modelAlias ?? null,
    });

    const parsedNodes = parseIndentedTextToNodes(transformed.outputText, fileEntry.nodeId, ctx.nextId);
    mergeChildren(nodes, fileEntry.nodeId, parsedNodes);
  } catch (err) {
    ctx.warnings.push(`AI transform skipped for ${fileEntry.relativePath}: ${(err as Error).message}`);
  }
}

function resolveWikilinkTarget(
  target: string,
  fileEntries: PendingFileEntry[],
): { nodeId: string | null; label: string; ambiguous: boolean } {
  const normalizedTarget = normalizeWikilinkTarget(target);
  if (!normalizedTarget) {
    return { nodeId: null, label: target.trim() || "Untitled", ambiguous: false };
  }

  const direct = fileEntries.find((entry) => entry.relativeTargetPath === normalizedTarget);
  if (direct) {
    return { nodeId: direct.nodeId, label: direct.baseName, ambiguous: false };
  }

  const byName = fileEntries.filter((entry) => entry.baseName === path.basename(normalizedTarget));
  if (byName.length === 1) {
    return { nodeId: byName[0]!.nodeId, label: byName[0]!.baseName, ambiguous: false };
  }
  return { nodeId: null, label: path.basename(normalizedTarget), ambiguous: byName.length > 1 };
}

function resolveWikilinks(
  fileEntries: PendingFileEntry[],
  nodes: Record<string, TreeNode>,
  nextId: () => string,
  warnings: string[],
  hooks?: { onProgress?: (progress: VaultImportProgress) => void },
): void {
  hooks?.onProgress?.({
    phase: "links",
    total: fileEntries.length,
    message: "Resolving wikilinks to alias nodes.",
  });

  for (const fileEntry of fileEntries) {
    const fileNode = nodes[fileEntry.nodeId]!;
    for (const ref of fileEntry.wikilinks) {
      const resolved = resolveWikilinkTarget(ref.target, fileEntries);
      if (resolved.nodeId) {
        const alias = createAliasNode(nextId, fileEntry.nodeId, resolved.nodeId, resolved.label, {
          aliasLabel: ref.label,
          embedded: ref.embedded,
        });
        nodes[alias.id] = alias;
        fileNode.children.push(alias.id);
        continue;
      }

      if (resolved.ambiguous) {
        warnings.push(`Ambiguous wikilink in ${fileEntry.relativePath}: ${ref.target}`);
      } else {
        warnings.push(`Broken wikilink in ${fileEntry.relativePath}: ${ref.target}`);
      }
      const brokenAlias = createAliasNode(nextId, fileEntry.nodeId, `missing:${normalizeWikilinkTarget(ref.target)}`, resolved.label, {
        aliasLabel: ref.label,
        embedded: ref.embedded,
        broken: true,
      });
      nodes[brokenAlias.id] = brokenAlias;
      fileNode.children.push(brokenAlias.id);
    }
  }
}

export async function importVaultToAppState(
  request: VaultImportRequest,
  hooks?: { onProgress?: (progress: VaultImportProgress) => void },
): Promise<VaultImportResult> {
  const vaultPath = validateVaultPath(request.vaultPath, { mustExist: true });

  const mapId = request.mapId?.trim() || buildDefaultDocumentId(vaultPath);
  const nextId = createIdFactory();
  const rootId = nextId();
  const rootNode = createFolderNode(rootId, null, path.basename(vaultPath) || vaultPath, "folder", "");
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
    fileEntry.wikilinks = wikilinks;
    const node = nodes[fileEntry.nodeId]!;
    const truncated = body.length > ctx.maxCharsPerFile;
    const normalizedBody = truncated ? body.slice(0, ctx.maxCharsPerFile) : body;
    node.details = normalizedBody;
    applyFrontmatterAttributes(node, frontmatter as Record<string, unknown>);

    if (truncated) {
      truncatedFiles += 1;
      ctx.warnings.push(`Truncated ${fileEntry.relativePath} to ${ctx.maxCharsPerFile} characters.`);
    }

    hooks?.onProgress?.({
      phase: "parse",
      current: index + 1,
      total: ctx.pendingFiles.length,
      currentFile: fileEntry.relativePath,
      status: "ok",
    });

    await maybeTransformFileBody(request, fileEntry, normalizedBody, nodes, ctx, hooks);

    importedFiles.push({
      relativePath: fileEntry.relativePath,
      nodeId: fileEntry.nodeId,
      wikilinkCount: wikilinks.length,
      truncated,
    });
  }

  resolveWikilinks(ctx.pendingFiles, nodes, ctx.nextId, ctx.warnings, hooks);

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
    message: `Persisting imported vault as ${mapId}.`,
  });

  return {
    ok: true,
    mapId,
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
  model.saveToSqlite(dbPath, result.mapId);
  return {
    ...result,
    savedAt: new Date().toISOString(),
  };
}
